import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db, services, staff, salon, bookingsFor, hashPassword, verifyPassword, mapUser, audit, demoEnabled } from '@/lib/db';
import { AppError, getSlots, ownedBooking, createBooking, rescheduleBooking, transaction, localDate } from '@/lib/booking';
import { currentUser, requireUser, signIn, signOut, checkOrigin, body, rateLimit, textField, failure } from '@/lib/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
function getPath(request: NextRequest) { return request.nextUrl.pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean); }
export async function GET(request: NextRequest) {
  try {
    const [section,id,action] = getPath(request);
    if(section === 'catalog') return json({services:services(),staff,salon});
    if(section === 'auth' && id === 'me') return json({user:currentUser(request),demoMode:demoEnabled()});
    if(section === 'slots') {
      const q = request.nextUrl.searchParams;
      const exclude=q.get('excludeBookingId')||'';
      if(exclude) ownedBooking(exclude,requireUser(request));
      return json({slots:getSlots(q.get('serviceId')||'',q.get('staffId')||'any',q.get('date')||'',exclude),timezone:salon.timezone});
    }
    if(section === 'bookings') {
      const user = requireUser(request);
      if(id && action === 'calendar') {
        const booking = ownedBooking(id,user);
        const icalDate=(s:string)=>s.replace(/[-:]/g,'').replace(/\.\d{3}/,'');
        const escape=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
        const calendar=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//BookWise//Salon Booking//EN','BEGIN:VEVENT',`UID:${booking.id}@bookwise.local`,`DTSTAMP:${icalDate(new Date().toISOString())}`,`DTSTART:${icalDate(String(booking.start_at))}`,`DTEND:${icalDate(String(booking.end_at))}`,`SUMMARY:${escape(String(booking.service_name))} at BookWise`, `DESCRIPTION:${escape(`Booking ${booking.reference}. Stylist: ${booking.staff_name}. Pay at salon.`)}`,`LOCATION:${escape(salon.address)}`,`STATUS:${booking.status==='cancelled'?'CANCELLED':'CONFIRMED'}`,'END:VEVENT','END:VCALENDAR',''].join('\r\n');
        return new NextResponse(calendar,{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':`attachment; filename="${booking.reference}.ics"`,'Cache-Control':'no-store'}});
      }
      return json({bookings:bookingsFor(user),user});
    }
    if(section === 'dashboard') {
      const user=requireUser(request,['admin','stylist']); const bookings=bookingsFor(user); const now=new Date().toISOString();
      const timeOff=db().prepare(`SELECT * FROM time_off ${user.role==='stylist'?'WHERE staff_id=?':''} ORDER BY start_at`).all(...(user.role==='stylist'?[user.staffId||'']:[])).map(t=>({id:t.id,staffId:t.staff_id,staffName:staff.find(s=>s.id===t.staff_id)?.name,startAt:t.start_at,endAt:t.end_at,reason:t.reason}));
      return json({user,bookings,services:services(true),staff:user.role==='stylist'?staff.filter(s=>s.id===user.staffId):staff,timeOff,salon,stats:{total:bookings.length,today:bookings.filter(b=>localDate(new Date(b.startAt))===localDate()).length,upcoming:bookings.filter(b=>b.startAt>now && ['pending','confirmed'].includes(b.status)).length,revenue:bookings.filter(b=>b.status==='completed').reduce((sum,b)=>sum+b.price,0)}});
    }
    throw new AppError('Page not found.',404);
  } catch(e) { return failure(e); }
}
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request); const [section,id,action]=getPath(request); const input=await body(request);
    if(section==='auth') {
      if(id==='logout') return signOut(request,json({ok:true}));
      if(!['register','login'].includes(id)) throw new AppError('Not found.',404);
      const email=textField(input,'email').toLowerCase(); const password=typeof input.password==='string'?input.password:'';
      rateLimit(`auth:${request.headers.get('x-forwarded-for')?.split(',')[0]||'local'}:${email}`,12);
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length>128) throw new AppError('Enter a valid email address and password.');
      if(id==='register') {
        const name=textField(input,'name',80);
        if(name.length<2 || password.length<10) throw new AppError('Enter your name and a password with at least 10 characters.');
        if(db().prepare('SELECT id FROM users WHERE email=?').get(email)) throw new AppError('An account could not be created with those details. Try signing in.',409);
        const userId=randomUUID(); db().prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(userId,name,email,hashPassword(password),'customer',null);
        const user=mapUser(db().prepare('SELECT * FROM users WHERE id=?').get(userId)!);
        return signIn(json({user},201),user.id);
      }
      const row=db().prepare('SELECT * FROM users WHERE email=?').get(email);
      if(!row || (!demoEnabled() && String(row.id).startsWith('demo-')) || !verifyPassword(password,String(row.password_hash))) throw new AppError('The email or password is incorrect.',401);
      const user=mapUser(row); return signIn(json({user}),user.id);
    }
    const user=requireUser(request);
    if(section==='bookings') {
      rateLimit(`bookings:${user.id}`,60);
      if(!id) return json({booking:createBooking(user,{serviceId:textField(input,'serviceId'),staffId:textField(input,'staffId'),startAt:textField(input,'startAt'),note:textField(input,'note',1000)})},201);
      const row=ownedBooking(id,user);
      if(action==='cancel' || action==='status') {
        let status=action==='cancel'?'cancelled':textField(input,'status');
        if(action==='status' && user.role==='customer') throw new AppError('Only salon staff can update appointment status.',403);
        if(!['confirmed','completed','no-show','cancelled'].includes(status)) throw new AppError('Choose a valid appointment status.');
        if(!['pending','confirmed'].includes(String(row.status))) throw new AppError('This appointment has already been closed.');
        if(user.role==='customer' && new Date(String(row.start_at)).getTime()-Date.now()<2*3600000) throw new AppError('Please contact the salon to cancel an appointment less than 2 hours away.');
        if(['completed','no-show'].includes(status) && String(row.start_at)>new Date().toISOString()) throw new AppError('An appointment cannot be completed or marked no-show before its start time.');
        db().prepare('UPDATE bookings SET status=? WHERE id=?').run(status,id); audit(user.id,`booking.${status}`,id); return json({ok:true});
      }
    }
    if(section==='admin') {
      requireUser(request,['admin']);
      if(id==='services') {
        const service=services(true).find(s=>s.id===textField(input,'id'));
        if(!service) throw new AppError('Service not found.',404);
        const name=textField(input,'name',100)||service.name;
        const price=input.price===undefined?service.price:Number(input.price); const duration=input.duration===undefined?service.duration:Number(input.duration);
        if(!Number.isInteger(price)||price<0||price>1000000||!Number.isInteger(duration)||duration<15||duration>240) throw new AppError('Use a valid whole-number price and a duration from 15 to 240 minutes.');
        db().prepare('UPDATE services SET name=?,price=?,duration=?,active=? WHERE id=?').run(name,price,duration,input.active===undefined?Number(service.active):Number(Boolean(input.active)),service.id);
        audit(user.id,'service.updated'); return json({ok:true});
      }
      if(id==='time-off') {
        const staffId=textField(input,'staffId'); const start=new Date(textField(input,'startAt'));const end=new Date(textField(input,'endAt'));const reason=textField(input,'reason',200)||'Unavailable';
        if(!staff.some(s=>s.id===staffId)||Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<=start) throw new AppError('Choose a stylist and a valid start and end time.');
        transaction(()=>{ if(db().prepare("SELECT id FROM bookings WHERE staff_id=? AND status IN ('pending','confirmed') AND start_at < ? AND end_at > ?").get(staffId,end.toISOString(),start.toISOString())) throw new AppError('This time overlaps an appointment. Reschedule or cancel it first.',409); db().prepare('INSERT INTO time_off VALUES(?,?,?,?,?)').run(randomUUID(),staffId,start.toISOString(),end.toISOString(),reason);audit(user.id,'availability.blocked'); });
        return json({ok:true,timeOff:db().prepare('SELECT * FROM time_off').all()},201);
      }
    }
    throw new AppError('Action not found.',404);
  } catch(e) { return failure(e); }
}
export async function PATCH(request: NextRequest) { try { checkOrigin(request); const [section,id]=getPath(request); const user=requireUser(request); const input=await body(request); if(section!=='bookings'||!id) throw new AppError('Not found.',404); return json({booking:rescheduleBooking(id,user,{staffId:textField(input,'staffId'),startAt:textField(input,'startAt')})}); } catch(e) { return failure(e); } }
export async function DELETE(request: NextRequest) { try { checkOrigin(request); const [section,id]=getPath(request); const user=requireUser(request,['admin']); if(section!=='admin'||id!=='time-off') throw new AppError('Not found.',404); db().prepare('DELETE FROM time_off WHERE id=?').run(request.nextUrl.searchParams.get('id')||''); audit(user.id,'availability.unblocked'); return json({ok:true}); } catch(e) { return failure(e); } }
