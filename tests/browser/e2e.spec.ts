import { test, expect } from '@playwright/test';

function bookableDate(offset = 14) {
  const date = new Date(Date.now() + offset * 86400000);
  while (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

test('a customer can register, book, reschedule, download a calendar event, and cancel', async ({ page }) => {
  const email = `bookwise-e2e-${Date.now()}@example.test`;
  await page.goto('/login');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Full name').fill('Browser Guest');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('AstrongTestPassword2026!');
  await page.getByRole('button', { name: 'Create my account' }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole('heading', { name: /Hello, Browser/ })).toBeVisible();

  await page.goto('/book?service=hair-cut');
  await expect(page.getByRole('heading', { name: 'You’re in good hands.' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Choose appointment date').fill(bookableDate());
  const firstSlot = page.locator('.bw-time-grid button').first();
  await expect(firstSlot).toBeVisible();
  await firstSlot.click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Anything you’d like us to know?').fill('Automated browser test: a gentle finishing style, please.');
  const bookingResponse = page.waitForResponse(response => response.url().endsWith('/api/bookings') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirm appointment', exact: true }).click();
  const saved = await (await bookingResponse).json();
  expect(saved.booking.id).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'You’re on the calendar.' })).toBeVisible();
  await expect(page.getByText(saved.booking.reference, { exact: true })).toBeVisible();

  const calendar = await page.request.get(`/api/bookings/${saved.booking.id}/calendar`);
  expect(calendar.status()).toBe(200);
  expect(await calendar.text()).toContain('BEGIN:VCALENDAR');
  expect(await calendar.text()).toContain('Signature haircut');

  await page.getByRole('link', { name: 'View my appointments' }).click();
  let appointment = page.locator('.appointment-card').filter({ hasText: saved.booking.reference });
  await expect(appointment).toBeVisible();
  await expect(appointment.getByText('confirmed', { exact: true })).toBeVisible();
  await appointment.getByRole('button', { name: 'Reschedule', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Find a new time.' });
  await dialog.getByLabel('New date').fill(bookableDate(16));
  await dialog.locator('.reschedule-slots button').first().click();
  await dialog.getByRole('button', { name: 'Confirm new time' }).click();
  await expect(page.getByText('Your new appointment time is confirmed.')).toBeVisible();
  await expect(dialog).not.toBeVisible();
  appointment = page.locator('.appointment-card').filter({ hasText: saved.booking.reference });
  await appointment.getByRole('button', { name: 'Cancel', exact: true }).click();
  await appointment.getByRole('button', { name: 'Yes, cancel', exact: true }).click();
  await expect(page.getByText('Your appointment has been cancelled.')).toBeVisible();
  await page.getByRole('tab', { name: 'Cancelled', exact: true }).click();
  await expect(page.locator('.appointment-card').filter({ hasText: saved.booking.reference }).getByText('cancelled', { exact: true })).toBeVisible();
  const denied = await page.request.get('/api/dashboard');
  expect(denied.status()).toBe(403);
});

test('service browsing supports category and text filters with a working detail page', async ({ page }) => {
  await page.goto('/services');
  await expect(page.locator('.svc-card')).toHaveCount(6);
  await page.getByRole('button', { name: 'Nails', exact: true }).click();
  await expect(page.locator('.svc-card')).toHaveCount(1);
  await expect(page.locator('.svc-card').getByRole('heading', { name: 'Signature manicure' })).toBeVisible();
  await page.getByRole('button', { name: 'All services', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search services' }).fill('blowout');
  await expect(page.locator('.svc-card')).toHaveCount(1);
  await page.getByRole('link', { name: 'The perfect blowout', exact: true }).click();
  await expect(page).toHaveURL(/\/services\/blow-dry$/);
  await expect(page.getByRole('heading', { name: 'The perfect blowout', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Book this treatment' }).click();
  await expect(page).toHaveURL(/\/book\?service=blow-dry/);
  await expect(page.getByRole('heading', { name: 'You’re in good hands.' })).toBeVisible();
});

test('admin can sign in and browse the protected salon management views', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('admin@bookwise.local');
  await page.getByLabel('Password', { exact: true }).fill('BookwiseDemo2026!');
  await page.locator('form').getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'A beautiful day ahead.' })).toBeVisible();
  await expect(page.getByText('Administrator', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Services', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your service menu' })).toBeVisible();
  await expect(page.locator('.dashboard-service-card')).toHaveCount(6);
  await page.getByRole('tab', { name: 'Availability', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Block time' })).toBeVisible();
  await expect(page.locator('.staff-hours-grid > div')).toHaveCount(3);
});

test('mobile navigation and booking remain usable without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const nav = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(nav).toBeVisible();
  await nav.getByRole('link', { name: 'Services', exact: true }).click();
  await expect(page).toHaveURL(/\/services$/);
  await expect(nav).not.toBeVisible();
  await expect(page.locator('.svc-card')).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto('/book');
  await expect(page.getByRole('heading', { name: 'What feels good today?' })).toBeVisible();
  await page.getByRole('button', { name: /Signature haircut/ }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'You’re in good hands.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('a guest keeps their stylist, time, and note through sign-in', async ({ page }) => {
  await page.goto('/book?service=hair-cut');
  await expect(page.getByRole('heading', { name: 'You’re in good hands.' })).toBeVisible();
  await page.getByRole('button', { name: /Ayesha Khan/ }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Choose appointment date').fill(bookableDate(20));
  await page.locator('.bw-time-grid button').first().click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const note = 'Please keep my selected time and style consultation.';
  await page.getByLabel('Anything you’d like us to know?').fill(note);
  await page.getByRole('link', { name: 'Sign in to book' }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
  const draft = await page.evaluate(() => JSON.parse(sessionStorage.getItem('bookwise-booking-draft')!));
  expect(draft.staffId).toBe('ayesha');
  expect(draft.date).toBe(bookableDate(20));
  expect(draft.note).toBe(note);
  await page.getByLabel('Email address').fill('customer@bookwise.local');
  await page.getByLabel('Password', { exact: true }).fill('BookwiseDemo2026!');
  await page.locator('form').getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your little moment of me-time.' })).toBeVisible();
  await expect(page.getByLabel('Anything you’d like us to know?')).toHaveValue(note);
  await expect(page.locator('.bw-review-details')).toContainText('Ayesha Khan');
  const response = page.waitForResponse(response => response.url().endsWith('/api/bookings') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirm appointment', exact: true }).click();
  const saved = await (await response).json();
  expect(saved.booking.startAt).toBe(draft.slot.startAt);
  expect(saved.booking.staffId).toBe(draft.slot.staffId);
  expect(saved.booking.note).toBe(note);
  await expect(page.getByRole('heading', { name: 'You’re on the calendar.' })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('bookwise-booking-draft'))).toBeNull();
  await page.getByRole('link', { name: 'View my appointments' }).click();
  const appointment = page.locator('.appointment-card').filter({ hasText: saved.booking.reference });
  await appointment.getByRole('button', { name: 'Cancel', exact: true }).click();
  await appointment.getByRole('button', { name: 'Yes, cancel', exact: true }).click();
  await expect(page.getByText('Your appointment has been cancelled.')).toBeVisible();
});
