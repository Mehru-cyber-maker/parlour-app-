# BookWise

A full-stack salon booking application built from `BookWise_Guide.pdf`. Includes a responsive salon website, searchable service menu, stylist selection, real availability, account registration, booking receipts and calendar downloads, customer appointment management, and role-scoped staff dashboards.

## Run locally

Requires Node.js 24 or later (uses the built-in `node:sqlite` driver).

```sh
cd /workspace/parlour-app-
npm ci
npm run dev
```

The server listens on port 3000. Use the existing checkout: cloud tasks already have isolated workspaces, so a separate Git worktree is unnecessary.

SQLite creates `.data/bookwise.sqlite` automatically. Bookings and accounts survive server restarts. Keep that directory to retain data; back it up with a SQLite-aware backup or while the server is stopped. Do not commit the database.

For a locally optimized demo:

```sh
npm run build
BOOKWISE_DEMO_MODE=true BOOKWISE_SECURE_COOKIES=false npm start
```

Stop the development server before running a production build; both use `.next`. Use one server at a time.

## Try the three roles

Open Sign in, expand **Explore the local demo**, and select a role. These sample accounts are available by default in development:

| Role | Email |
| --- | --- |
| Customer | customer@bookwise.local |
| Stylist | stylist@bookwise.local |
| Admin | admin@bookwise.local |

Their local demo password is `BookwiseDemo2026!`. New registrations always create customer accounts. Demo accounts are disabled in production unless `BOOKWISE_DEMO_MODE=true` is explicitly set, including demo accounts already present in a retained database. The salon, team, address, and prices are demonstration content. Imagery was generated for this project.

## Features and booking rules

- Home, service catalog and detail pages, About, Contact, and policies.
- Customer registration and sign-in with individually salted scrypt password hashes; random session cookies with HttpOnly, SameSite, hashed session storage, and seven-day expiry.
- Real server-generated availability with eligible stylists, service duration, bookings, and staff time off.
- Salon timezone: **Asia/Karachi**; UTC timestamps in storage. Working hours: **Monday–Saturday, 09:00–18:00**, with **13:00–14:00** lunch. Sunday closed.
- Thirty-minute start intervals, one-hour booking lead time, bookings up to 60 days ahead, and two-hour customer cancellation/reschedule notice. Buffers are not configured.
- Atomic appointment creation/rescheduling with SQLite write transactions and database overlap triggers. Conflicts return HTTP 409 instead of a false confirmation.
- Customer access is restricted to their own bookings. Stylists see only assigned appointments. Admins can manage all appointments, edit service names/prices/durations/visibility, and add/remove staff time off. Active appointment conflicts must be resolved before blocking time.
- Booking prices and names are captured when booked, so later menu edits do not change existing receipts.
- Booking receipts, `.ics` calendar download, upcoming/past/cancelled filters, reschedule, and cancellation.
- Staff appointment filters and status updates. Completion/no-show cannot be recorded before the appointment begins. Payment remains **due at salon**; completed service value is not proof of payment.
- Input validation, same-origin checks on mutations, and process-local authentication/booking rate limits. API SQL uses parameters; role and ownership checks run on the server.

## Validation

```sh
npm run typecheck
npm test
# Start the app first in another terminal:
npm run test:e2e
npm run build
```

Backend tests use an isolated temporary database and include a real two-process double-booking race. Browser tests cover registration, booking, receipt/calendar, reschedule, cancellation, customer access restrictions, admin screens, service filters, and mobile navigation. Browser tests assume Chromium at `/usr/bin/chromium`; change the executable in `playwright.config.ts` if necessary. Set `BOOKWISE_TEST_URL` to run them against another running local instance. Browser tests create identifiable test accounts and cancelled test bookings in that instance.

## Configuration and deployment scope

See `.env.example` for optional settings:

- `BOOKWISE_DB_PATH`: absolute path to the local database; defaults to `.data/bookwise.sqlite`.
- `BOOKWISE_DEMO_MODE`: `true` to enable demo accounts, `false` to disable; defaults to enabled in development and disabled in production.
- `BOOKWISE_SECURE_COOKIES`: defaults to secure in production; set to `true` when served through HTTPS, and use `false` only for a local HTTP demo.

This implementation is a working local MVP. The guide’s Neon/Postgres, Prisma, and Auth.js integrations are not configured: the app uses embedded SQLite and a server-side session implementation so it runs without external credentials. Deploying SQLite requires a persistent writable disk and a long-lived Node server; this database cannot be used as-is on ephemeral serverless hosting. Before a public multi-instance launch, migrate the persistence layer to managed Postgres with equivalent atomic overlap constraints, configure a maintained authentication provider with email verification and password recovery, distributed rate limiting, account deletion, backups, monitoring, and real salon content. No email, password-reset delivery, payment gateway, or external hosting service is connected. Contact links use demonstration details; no contact message is falsely reported as sent.

Optional emails and online payments were intentionally left for a later integration. No card data is collected.
