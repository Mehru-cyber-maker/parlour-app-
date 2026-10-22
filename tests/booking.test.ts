import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import type { User } from '../lib/db.ts';

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'bookwise-tests-'));
process.env.BOOKWISE_DB_PATH = join(temporaryDirectory, 'test.sqlite');
process.env.BOOKWISE_DEMO_MODE = 'true';
const { db, hashPassword, verifyPassword, services, bookingsFor } = await import('../lib/db.ts');
const { AppError, getSlots, createBooking, ownedBooking, rescheduleBooking, localDate, validDate } = await import('../lib/booking.ts');

const customer: User = { id: 'demo-customer', name: 'Sana Malik', email: 'customer@bookwise.local', role: 'customer', staffId: null };
const otherCustomer: User = { id: 'other-customer', name: 'Second Customer', email: 'second@example.test', role: 'customer', staffId: null };
const admin: User = { id: 'demo-admin', name: 'Studio Admin', email: 'admin@bookwise.local', role: 'admin', staffId: null };
const stylist: User = { id: 'demo-stylist', name: 'Ayesha Khan', email: 'stylist@bookwise.local', role: 'stylist', staffId: 'ayesha' };
const anotherStylist: User = { id: 'unrelated-stylist', name: 'Zara Ali', email: 'zara@example.test', role: 'stylist', staffId: 'zara' };

function futureOpenDate(offset = 3) {
  const day = new Date(`${localDate()}T12:00:00+05:00`);
  day.setUTCDate(day.getUTCDate() + offset);
  while (day.getUTCDay() === 0) day.setUTCDate(day.getUTCDate() + 1);
  return localDate(day);
}
function slotFor(serviceId = 'hair-cut', staffId = 'ayesha', date = futureOpenDate(), index = 0) {
  const slot = getSlots(serviceId, staffId, date)[index];
  assert.ok(slot, `Expected a bookable ${serviceId} appointment on ${date}`);
  return { serviceId, staffId: slot.staffId, startAt: slot.startAt };
}
function isAppError(status: number) {
  return (error: unknown) => error instanceof AppError && error.status === status;
}

beforeEach(() => {
  db().exec('DELETE FROM audit_log; DELETE FROM bookings; DELETE FROM time_off;');
  db().prepare('INSERT OR IGNORE INTO users VALUES(?,?,?,?,?,?)').run(otherCustomer.id, otherCustomer.name, otherCustomer.email, hashPassword('AnotherPassword!123'), 'customer', null);
});

after(() => {
  db().close();
  delete (globalThis as unknown as { bookwiseDb?: unknown }).bookwiseDb;
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

describe('Password and date validation', () => {
  test('password hashes are independently salted and reject the wrong password', () => {
    const password = 'A-long-test-password!42';
    const first = hashPassword(password);
    const second = hashPassword(password);
    assert.notEqual(first, second);
    assert.ok(verifyPassword(password, first));
    assert.ok(verifyPassword(password, second));
    assert.equal(verifyPassword('wrong password', first), false);
    assert.equal(verifyPassword(password, 'malformed'), false);
    assert.equal(verifyPassword(password, 'salt:00'), false);
  });

  test('invalid calendar dates are rejected instead of rolling into another month', () => {
    assert.equal(validDate('2030-02-30'), false);
    assert.equal(validDate('2030-13-01'), false);
    assert.equal(validDate('2030-01-01T09:00:00Z'), false);
    assert.equal(validDate('2032-02-29'), true);
  });
});

describe('Salon availability', () => {
  const fixedNow = new Date('2030-01-07T02:00:00Z');

  test('Sunday is closed and an ineligible stylist is never offered', () => {
    assert.deepEqual(getSlots('hair-cut', 'ayesha', '2030-01-13', '', fixedNow), []);
    assert.deepEqual(getSlots('hair-color', 'zara', '2030-01-08', '', fixedNow), []);
    const available = getSlots('hair-color', 'any', '2030-01-08', '', fixedNow);
    assert.ok(available.length > 0);
    assert.ok(available.every(slot => slot.staffId === 'ayesha'));
  });

  test('the full service fits opening hours and never overlaps the lunch break', () => {
    const slots = getSlots('hair-color', 'ayesha', '2030-01-08', '', fixedNow);
    assert.ok(slots.length > 0);
    for (const slot of slots) {
      const start = Date.parse(slot.startAt);
      const end = Date.parse(slot.endAt);
      assert.equal(end - start, 90 * 60_000);
      assert.ok(start >= Date.parse('2030-01-08T09:00:00+05:00'));
      assert.ok(end <= Date.parse('2030-01-08T18:00:00+05:00'));
      assert.ok(end <= Date.parse('2030-01-08T13:00:00+05:00') || start >= Date.parse('2030-01-08T14:00:00+05:00'));
    }
    assert.equal(slots.at(-1)?.startAt, new Date('2030-01-08T16:30:00+05:00').toISOString());
  });

  test('past dates, dates beyond the booking horizon, and last-minute slots are excluded', () => {
    assert.throws(() => getSlots('hair-cut', 'ayesha', '2030-01-06', '', fixedNow), isAppError(400));
    assert.throws(() => getSlots('hair-cut', 'ayesha', '2030-04-08', '', fixedNow), isAppError(400));
    const now = new Date('2030-01-08T09:20:00+05:00');
    const slots = getSlots('hair-cut', 'ayesha', '2030-01-08', '', now);
    assert.ok(slots.length > 0);
    assert.ok(slots.every(slot => Date.parse(slot.startAt) >= now.getTime() + 60 * 60_000));
    assert.equal(slots[0].startAt, new Date('2030-01-08T10:30:00+05:00').toISOString());
  });

  test('blocked staff time removes every overlapping slot without blocking other stylists', () => {
    const date = futureOpenDate();
    const blockedStart = new Date(`${date}T09:00:00+05:00`).toISOString();
    const blockedEnd = new Date(`${date}T11:00:00+05:00`).toISOString();
    db().prepare('INSERT INTO time_off VALUES(?,?,?,?,?)').run('leave-test', 'ayesha', blockedStart, blockedEnd, 'Leave');
    const unavailable = getSlots('hair-cut', 'ayesha', date);
    assert.ok(unavailable.every(slot => slot.startAt >= blockedEnd));
    const alternative = getSlots('hair-cut', 'any', date);
    assert.equal(alternative[0].staffId, 'noor');
    assert.equal(alternative[0].startAt, blockedStart);
  });
});

describe('Bookings and permissions', () => {
  test('confirmation saves the authoritative service duration, price, customer, and audit event', () => {
    const input = slotFor();
    const booking = createBooking(customer, { ...input, note: 'Please keep some length.' });
    const service = services().find(service => service.id === input.serviceId)!;
    assert.match(booking.reference, /^BW-[A-F0-9]{12}$/);
    assert.equal(booking.customerId, customer.id);
    assert.equal(booking.price, service.price);
    assert.equal(Date.parse(booking.endAt) - Date.parse(booking.startAt), service.duration * 60_000);
    assert.equal(booking.status, 'confirmed');
    assert.equal(booking.note, 'Please keep some length.');
    assert.equal(db().prepare('SELECT COUNT(*) AS n FROM audit_log WHERE booking_id=? AND action=?').get(booking.id, 'booking.created')?.n, 1);
  });

  test('a second confirmation for the same stylist and time returns a conflict', () => {
    const input = slotFor();
    const first = createBooking(customer, input);
    assert.throws(() => createBooking(otherCustomer, input), isAppError(409));
    assert.equal(db().prepare('SELECT COUNT(*) AS n FROM bookings').get()?.n, 1);
    assert.equal(ownedBooking(first.id, customer).customer_id, customer.id);
  });

  test('database protection also rejects overlapping inserts that bypass the availability check', () => {
    const first = createBooking(customer, slotFor());
    const rawInsert = db().prepare('INSERT INTO bookings SELECT ?,?,customer_id,service_id,service_name,staff_id,staff_name,?,?,price,status,note,created_at FROM bookings WHERE id=?');
    assert.throws(() => rawInsert.run('raw-conflict', 'BW-RAW123', new Date(Date.parse(first.startAt) + 15 * 60_000).toISOString(), new Date(Date.parse(first.endAt) + 15 * 60_000).toISOString(), first.id), /BOOKING_CONFLICT/);
    assert.equal(db().prepare('SELECT COUNT(*) AS n FROM bookings').get()?.n, 1);
  });

  test('separate stylists can work simultaneously and appointments may touch without overlapping', () => {
    const date = futureOpenDate();
    const input = slotFor('blow-dry', 'ayesha', date);
    const first = createBooking(customer, input);
    const parallel = createBooking(otherCustomer, { ...input, staffId: 'noor' });
    const adjacent = createBooking(customer, { ...input, startAt: first.endAt });
    assert.equal(first.startAt, parallel.startAt);
    assert.equal(first.endAt, adjacent.startAt);
    assert.equal(bookingsFor(admin).length, 3);
  });

  test('customers and stylists can access only appointments assigned to them', () => {
    const ayesha = createBooking(customer, slotFor());
    const zara = createBooking(otherCustomer, slotFor('nails', 'zara'));
    assert.equal(ownedBooking(ayesha.id, customer).id, ayesha.id);
    assert.equal(ownedBooking(ayesha.id, stylist).id, ayesha.id);
    assert.equal(ownedBooking(zara.id, admin).id, zara.id);
    assert.throws(() => ownedBooking(ayesha.id, otherCustomer), isAppError(404));
    assert.throws(() => ownedBooking(ayesha.id, anotherStylist), isAppError(404));
    assert.throws(() => ownedBooking(zara.id, stylist), isAppError(404));
    assert.deepEqual(bookingsFor(customer).map(booking => booking.id), [ayesha.id]);
    assert.deepEqual(bookingsFor(stylist).map(booking => booking.id), [ayesha.id]);
    assert.equal(bookingsFor(admin).length, 2);
  });

  test('cancelled appointments release their slot', () => {
    const input = slotFor();
    const booking = createBooking(customer, input);
    db().prepare("UPDATE bookings SET status='cancelled' WHERE id=?").run(booking.id);
    const replacement = createBooking(otherCustomer, input);
    assert.notEqual(booking.id, replacement.id);
    assert.equal(replacement.status, 'confirmed');
  });

  test('rescheduling into a conflict is atomic and leaves the original booking intact', () => {
    const date = futureOpenDate();
    const initialSlots = getSlots('hair-cut', 'ayesha', date);
    const first = createBooking(customer, { serviceId: 'hair-cut', staffId: 'ayesha', startAt: initialSlots[0].startAt });
    const second = createBooking(otherCustomer, { serviceId: 'hair-cut', staffId: 'ayesha', startAt: initialSlots[3].startAt });
    assert.throws(() => rescheduleBooking(first.id, customer, { staffId: 'ayesha', startAt: second.startAt }), isAppError(409));
    const unchanged = ownedBooking(first.id, customer);
    assert.equal(unchanged.start_at, first.startAt);
    assert.equal(unchanged.end_at, first.endAt);
    assert.equal(db().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='booking.rescheduled'").get()?.n, 0);
  });

  test('successful rescheduling frees the old slot and reserves the replacement', () => {
    const initial = slotFor();
    const first = createBooking(customer, initial);
    const replacement = slotFor('hair-cut', 'ayesha', futureOpenDate(5));
    const moved = rescheduleBooking(first.id, customer, replacement);
    assert.equal(moved.id, first.id);
    assert.equal(moved.startAt, replacement.startAt);
    assert.ok(getSlots('hair-cut', 'ayesha', localDate(new Date(initial.startAt))).some(slot => slot.startAt === initial.startAt));
    assert.equal(getSlots('hair-cut', 'ayesha', localDate(new Date(replacement.startAt))).some(slot => slot.startAt === replacement.startAt), false);
    assert.equal(db().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE booking_id=? AND action='booking.rescheduled'").get(first.id)?.n, 1);
  });

  test('customers cannot change appointments less than two hours away', () => {
    const first = createBooking(customer, slotFor());
    const startAt = new Date(Date.now() + 60 * 60_000).toISOString();
    const endAt = new Date(Date.now() + 105 * 60_000).toISOString();
    db().prepare('UPDATE bookings SET start_at=?,end_at=? WHERE id=?').run(startAt, endAt, first.id);
    assert.throws(() => rescheduleBooking(first.id, customer, slotFor('hair-cut', 'ayesha', futureOpenDate(5))), /less than 2 hours/);
    assert.equal(ownedBooking(first.id, customer).start_at, startAt);
  });

  test('independent processes racing for one appointment produce exactly one confirmation', async () => {
    const input = slotFor();
    const modulePath = pathToFileURL(resolve('lib/booking.ts')).href;
    const worker = (id: string) => new Promise<{ success: boolean; status?: number }>((resolveWorker, rejectWorker) => {
      const source = `import { createBooking } from ${JSON.stringify(modulePath)}; try { createBooking(${JSON.stringify({ ...customer, id })}, ${JSON.stringify(input)}); console.log(JSON.stringify({success:true})); } catch(error) { console.log(JSON.stringify({success:false,status:error.status})); }`;
      execFile(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', source], { env: { ...process.env }, timeout: 20_000 }, (error, stdout) => {
        if (error) return rejectWorker(error);
        try { resolveWorker(JSON.parse(stdout.trim())); } catch (parseError) { rejectWorker(parseError); }
      });
    });
    const results = await Promise.all([worker(customer.id), worker(otherCustomer.id)]);
    assert.equal(results.filter(result => result.success).length, 1);
    assert.equal(results.filter(result => !result.success && result.status === 409).length, 1);
    assert.equal(db().prepare('SELECT COUNT(*) AS n FROM bookings').get()?.n, 1);
  });
});
