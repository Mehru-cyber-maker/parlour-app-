import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

export type Role = 'customer' | 'stylist' | 'admin';
export type User = { id: string; name: string; email: string; role: Role; staffId: string | null };
export type Service = { id: string; name: string; category: string; description: string; duration: number; price: number; image: string; staffIds: string[]; active: boolean };
export function demoEnabled() { return process.env.BOOKWISE_DEMO_MODE === 'true' || (process.env.BOOKWISE_DEMO_MODE !== 'false' && process.env.NODE_ENV !== 'production'); }
export const salon = { name: 'BookWise Studio', timezone: 'Asia/Karachi', address: '24 Main Boulevard, Gulberg, Lahore', phone: '+92 300 123 4567', email: 'hello@bookwise.example', currency: 'PKR', hours: 'Monday–Saturday, 9 am–6 pm' };
const serviceSeed: Service[] = [
  { id: 'hair-cut', name: 'Signature haircut', category: 'Hair', description: 'A thoughtful consultation, precision cut, and a beautiful finish. Made for your hair, your routine, and you.', duration: 45, price: 2500, image: '/images/hair.jpg', staffIds: ['ayesha', 'noor'], active: true },
  { id: 'hair-color', name: 'Hair color & gloss', category: 'Hair', description: 'Rich, luminous color with a custom gloss and finishing style. Includes a consultation; final color pricing confirmed at the salon.', duration: 90, price: 6500, image: '/images/hair.jpg', staffIds: ['ayesha'], active: true },
  { id: 'blow-dry', name: 'The perfect blowout', category: 'Hair', description: 'A relaxing wash and professional blow-dry for soft movement, beautiful shine, and a fresh start.', duration: 30, price: 1800, image: '/images/hair.jpg', staffIds: ['ayesha', 'noor'], active: true },
  { id: 'nails', name: 'Signature manicure', category: 'Nails', description: 'Careful shaping, cuticle care, and your choice of polish. Small details, beautifully considered.', duration: 45, price: 2000, image: '/images/nails.jpg', staffIds: ['zara'], active: true },
  { id: 'facial', name: 'Glow facial', category: 'Skincare', description: 'A gentle cleanse, exfoliation, and hydrating mask tailored to your skin. A quiet moment to reset.', duration: 60, price: 3500, image: '/images/skin.jpg', staffIds: ['zara', 'noor'], active: true },
  { id: 'makeup', name: 'Soft glam makeup', category: 'Makeup', description: 'Fresh, luminous makeup that still feels like you. Includes skin preparation and a personalized look.', duration: 60, price: 5000, image: '/images/skin.jpg', staffIds: ['noor'], active: true },
];
export const staff = [
  { id: 'ayesha', name: 'Ayesha Khan', role: 'Lead hair stylist', specialties: 'Precision cuts · Color', image: '/images/hair.jpg' },
  { id: 'zara', name: 'Zara Ali', role: 'Nail & skin specialist', specialties: 'Nail care · Skincare', image: '/images/nails.jpg' },
  { id: 'noor', name: 'Noor Ahmed', role: 'Beauty stylist', specialties: 'Hair · Makeup · Skincare', image: '/images/skin.jpg' },
];
const globals = globalThis as unknown as { bookwiseDb?: DatabaseSync };
export function hashPassword(password: string) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; }
export function verifyPassword(password: string, hash: string) { const [salt, hex] = hash.split(':'); if (!salt || !hex) return false; const expected = Buffer.from(hex, 'hex'); const actual = scryptSync(password, salt, 64); return expected.length === actual.length && timingSafeEqual(expected, actual); }
export function db() {
  if (globals.bookwiseDb) return globals.bookwiseDb;
  const path = process.env.BOOKWISE_DB_PATH || resolve('.data/bookwise.sqlite');
  mkdirSync(dirname(path), { recursive: true });
  const connection = new DatabaseSync(path);
  connection.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('customer','stylist','admin')), staff_id TEXT);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS services (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, duration INTEGER NOT NULL CHECK(duration BETWEEN 15 AND 240), price INTEGER NOT NULL CHECK(price >= 0), image TEXT NOT NULL, staff_ids TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, reference TEXT UNIQUE NOT NULL, customer_id TEXT NOT NULL REFERENCES users(id), service_id TEXT NOT NULL REFERENCES services(id), service_name TEXT NOT NULL, staff_id TEXT NOT NULL, staff_name TEXT NOT NULL, start_at TEXT NOT NULL, end_at TEXT NOT NULL, price INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('pending','confirmed','completed','cancelled','no-show')), note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, CHECK(end_at > start_at));
    CREATE INDEX IF NOT EXISTS booking_staff_time ON bookings(staff_id,start_at,end_at);
    CREATE TABLE IF NOT EXISTS time_off (id TEXT PRIMARY KEY, staff_id TEXT NOT NULL, start_at TEXT NOT NULL, end_at TEXT NOT NULL, reason TEXT NOT NULL, CHECK(end_at > start_at));
    CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL, booking_id TEXT, at TEXT NOT NULL);
    CREATE TRIGGER IF NOT EXISTS prevent_overlap_insert BEFORE INSERT ON bookings WHEN NEW.status IN ('pending','confirmed') BEGIN SELECT RAISE(ABORT,'BOOKING_CONFLICT') WHERE EXISTS (SELECT 1 FROM bookings WHERE staff_id=NEW.staff_id AND status IN ('pending','confirmed') AND start_at < NEW.end_at AND end_at > NEW.start_at); END;
    CREATE TRIGGER IF NOT EXISTS prevent_overlap_update BEFORE UPDATE ON bookings WHEN NEW.status IN ('pending','confirmed') BEGIN SELECT RAISE(ABORT,'BOOKING_CONFLICT') WHERE EXISTS (SELECT 1 FROM bookings WHERE id!=NEW.id AND staff_id=NEW.staff_id AND status IN ('pending','confirmed') AND start_at < NEW.end_at AND end_at > NEW.start_at); END;
  `);
  globals.bookwiseDb = connection;
  const insert = connection.prepare('INSERT OR IGNORE INTO services VALUES(?,?,?,?,?,?,?,?,?)');
  for (const service of serviceSeed) insert.run(service.id, service.name, service.category, service.description, service.duration, service.price, service.image, JSON.stringify(service.staffIds), 1);
  if (demoEnabled()) {
    const password = hashPassword('BookwiseDemo2026!');
    const insertUser = connection.prepare('INSERT OR IGNORE INTO users VALUES(?,?,?,?,?,?)');
    insertUser.run('demo-customer','Sana Malik','customer@bookwise.local',password,'customer',null);
    insertUser.run('demo-admin','Studio Admin','admin@bookwise.local',password,'admin',null);
    insertUser.run('demo-stylist','Ayesha Khan','stylist@bookwise.local',password,'stylist','ayesha');
  }
  return connection;
}
export function services(includeInactive = false): Service[] { return (db().prepare(`SELECT * FROM services ${includeInactive ? '' : 'WHERE active=1'}`).all() as Record<string, unknown>[]).map(row => ({ id: String(row.id), name: String(row.name), category: String(row.category), description: String(row.description), duration: Number(row.duration), price: Number(row.price), image: String(row.image), staffIds: JSON.parse(String(row.staff_ids)), active: Boolean(row.active) })); }
export function audit(actor: string, action: string, bookingId?: string) { db().prepare('INSERT INTO audit_log VALUES(?,?,?,?,?)').run(randomUUID(), actor, action, bookingId || null, new Date().toISOString()); }
export function mapUser(row: Record<string, unknown>): User { return { id: String(row.id), name: String(row.name), email: String(row.email), role: row.role as Role, staffId: row.staff_id ? String(row.staff_id) : null }; }
export function bookingsFor(user: User) {
  const where = user.role === 'admin' ? '' : user.role === 'stylist' ? 'WHERE b.staff_id=?' : 'WHERE b.customer_id=?';
  const args = user.role === 'admin' ? [] : [user.role === 'stylist' ? user.staffId || '' : user.id];
  return db().prepare(`SELECT b.*, u.name AS customer_name, u.email AS customer_email FROM bookings b JOIN users u ON u.id=b.customer_id ${where} ORDER BY b.start_at DESC`).all(...args).map(mapBooking);
}
export function mapBooking(row: Record<string, unknown>) { return { id: String(row.id), reference: String(row.reference), customerId: String(row.customer_id), serviceId: String(row.service_id), serviceName: String(row.service_name), staffId: String(row.staff_id), staffName: String(row.staff_name), startAt: String(row.start_at), endAt: String(row.end_at), price: Number(row.price), status: String(row.status), note: String(row.note), customerName: row.customer_name ? String(row.customer_name) : undefined, customerEmail: row.customer_email ? String(row.customer_email) : undefined }; }
