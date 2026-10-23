import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db, mapUser, type User } from './db.ts';
import { AppError } from './booking.ts';
import { isAllowedOrigin } from './request-origin.ts';
const COOKIE = 'bookwise_session';
const tokenHash = (s: string) => createHash('sha256').update(s).digest('hex');
export function currentUser(request: NextRequest): User | null {
  const token = request.cookies.get(COOKIE)?.value;
  if (!token) return null;
  const row = db().prepare('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?').get(tokenHash(token), new Date().toISOString());
  return row ? mapUser(row) : null;
}
export function requireUser(request: NextRequest, roles?: string[]) { const user = currentUser(request); if (!user) throw new AppError('Sign in to continue.',401); if (roles && !roles.includes(user.role)) throw new AppError('You do not have permission to do that.',403); return user; }
export function signIn(response: NextResponse, userId: string) {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 7 * 86400000);
  db().prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
  db().prepare('INSERT INTO sessions VALUES(?,?,?)').run(tokenHash(token),userId,expires.toISOString());
  response.cookies.set(COOKIE,token,{httpOnly:true,sameSite:'lax',secure:process.env.BOOKWISE_SECURE_COOKIES==='true' || (process.env.BOOKWISE_SECURE_COOKIES!=='false' && process.env.NODE_ENV==='production'),path:'/',expires});
  return response;
}
export function signOut(request: NextRequest, response: NextResponse) { const token = request.cookies.get(COOKIE)?.value; if (token) db().prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(token)); response.cookies.set(COOKIE,'',{httpOnly:true,path:'/',maxAge:0}); return response; }
export function checkOrigin(request: NextRequest) { if (!isAllowedOrigin(request)) throw new AppError('This request could not be verified. Refresh and try again.',403); }
export async function body(request: NextRequest): Promise<Record<string,unknown>> { if (Number(request.headers.get('content-length')) > 16000) throw new AppError('Request too large.',413); const text = await request.text(); if (text.length > 16000) throw new AppError('Request too large.',413); try { const data = JSON.parse(text); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(); return data; } catch { throw new AppError('Please submit a valid form.'); } }
const rateState = globalThis as unknown as { bookwiseRate?: Map<string,{count:number;until:number}> };
export function rateLimit(key: string, max = 12) { const map = rateState.bookwiseRate ||= new Map(); const now=Date.now(); for (const [key,value] of map) if (value.until<now) map.delete(key); const existing=map.get(key); if (existing && existing.count>=max) throw new AppError('Too many attempts. Please try again in 10 minutes.',429); map.set(key, {count:(existing?.count||0)+1,until:existing?.until||now+600000}); }
export function textField(input: Record<string,unknown>, key: string, max=200) { return typeof input[key]==='string' ? input[key].trim().slice(0,max) : ''; }
export function failure(error: unknown) { if (error instanceof AppError) return NextResponse.json({error:error.message},{status:error.status}); console.error('BookWise request failed', error instanceof Error ? error.message : 'Unknown error'); return NextResponse.json({error:'Something went wrong. Please try again.'},{status:500}); }
