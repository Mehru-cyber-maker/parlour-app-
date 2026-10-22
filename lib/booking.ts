import { randomBytes, randomUUID } from 'node:crypto';
import { db, services, staff, mapBooking, audit, type User } from './db.ts';

export class AppError extends Error { status: number; constructor(message: string, status = 400) { super(message); this.status = status; } }
export const localDate = (instant: Date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
export function validDate(date: string) { return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date; }
export function getSlots(serviceId: string, staffId: string, date: string, excludeBookingId = '', now = new Date()) {
  const service = services().find(s => s.id === serviceId);
  if (!service) throw new AppError('Please select an available service.');
  if (!validDate(date)) throw new AppError('Choose a valid date.');
  if (date < localDate(now) || date > localDate(new Date(now.getTime() + 60 * 86400000))) throw new AppError('Please choose a date within the next 60 days.');
  if (new Date(`${date}T12:00:00+05:00`).getUTCDay() === 0) return [];
  const eligible = service.staffIds.filter(id => staffId === 'any' || !staffId || id === staffId);
  const busy = db().prepare("SELECT staff_id,start_at,end_at FROM bookings WHERE status IN ('pending','confirmed') AND id != ? UNION ALL SELECT staff_id,start_at,end_at FROM time_off").all(excludeBookingId) as { staff_id: string; start_at: string; end_at: string }[];
  const slots: { startAt: string; endAt: string; label: string; staffId: string; staffName: string }[] = [];
  for (let minutes = 9 * 60; minutes + service.duration <= 18 * 60; minutes += 30) {
    if (minutes < 14 * 60 && minutes + service.duration > 13 * 60) continue;
    const start = new Date(`${date}T${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00+05:00`);
    if (start.getTime() < now.getTime() + 60 * 60 * 1000) continue;
    const end = new Date(start.getTime() + service.duration * 60000);
    const startAt = start.toISOString(); const endAt = end.toISOString();
    for (const id of eligible) {
      if (busy.some(b => b.staff_id === id && b.start_at < endAt && b.end_at > startAt)) continue;
      const stylist = staff.find(s => s.id === id)!;
      slots.push({ startAt, endAt, label: new Intl.DateTimeFormat('en', { timeZone: 'Asia/Karachi', hour: 'numeric', minute: '2-digit' }).format(start), staffId: id, staffName: stylist.name });
      if (staffId === 'any' || !staffId) break;
    }
  }
  return slots;
}
export function ownedBooking(id: string, user: User) {
  const row = db().prepare('SELECT * FROM bookings WHERE id=?').get(id);
  if (!row || (user.role === 'customer' && row.customer_id !== user.id) || (user.role === 'stylist' && row.staff_id !== user.staffId)) throw new AppError('Appointment not found.', 404);
  return row;
}
export function transaction<T>(work: () => T): T {
  const conn = db(); conn.exec('BEGIN IMMEDIATE');
  try { const result = work(); conn.exec('COMMIT'); return result; }
  catch (e) { conn.exec('ROLLBACK'); if (e instanceof Error && e.message.includes('BOOKING_CONFLICT')) throw new AppError('That time was just booked. Please choose another available time.', 409); throw e; }
}
export function createBooking(user: User, input: {serviceId: string; staffId: string; startAt: string; note?: string}) {
  return transaction(() => {
    const service = services().find(s => s.id === input.serviceId);
    if (!service) throw new AppError('This service is unavailable.');
    const instant = new Date(input.startAt);
    if (!input.startAt || Number.isNaN(instant.getTime())) throw new AppError('Please select a valid time.');
    const chosen = getSlots(service.id, input.staffId, localDate(instant)).find(s => s.startAt === instant.toISOString() && (input.staffId === 'any' || input.staffId === s.staffId));
    if (!chosen) throw new AppError('That time is unavailable. Please choose another available time.', 409);
    const id = randomUUID(); const reference = `BW-${randomBytes(6).toString('hex').toUpperCase()}`;
    db().prepare('INSERT INTO bookings VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,reference,user.id,service.id,service.name,chosen.staffId,chosen.staffName,chosen.startAt,chosen.endAt,service.price,'confirmed',(input.note || '').slice(0,1000),new Date().toISOString());
    audit(user.id, 'booking.created', id);
    return mapBooking(db().prepare('SELECT * FROM bookings WHERE id=?').get(id)!);
  });
}
export function rescheduleBooking(id: string, user: User, input: { staffId: string; startAt: string }) {
  return transaction(() => {
    const row = ownedBooking(id, user);
    if (!['pending','confirmed'].includes(String(row.status))) throw new AppError('Only upcoming appointments can be rescheduled.');
    if (user.role !== 'admin' && new Date(String(row.start_at)).getTime() - Date.now() < 2 * 3600000) throw new AppError('Please contact the salon to change an appointment less than 2 hours away.');
    const instant = new Date(input.startAt);
    if (!input.startAt || Number.isNaN(instant.getTime())) throw new AppError('Choose a valid time.');
    const chosen = getSlots(String(row.service_id), String(row.staff_id), localDate(instant), id).find(s => s.startAt === instant.toISOString());
    if (!chosen || (input.staffId && input.staffId !== row.staff_id)) throw new AppError('That time is unavailable. Please choose another available time.',409);
    db().prepare('UPDATE bookings SET start_at=?,end_at=? WHERE id=?').run(chosen.startAt,chosen.endAt,id);
    audit(user.id, 'booking.rescheduled', id);
    return mapBooking(db().prepare('SELECT * FROM bookings WHERE id=?').get(id)!);
  });
}
