# Publish a BookWise live demo

GitHub stores the source code and can show a link to your demo. The running BookWise app needs a Node.js host: GitHub Pages cannot run its API, sign-in, or SQLite database.

The repository includes `render.yaml` for a free **demonstration** web service. The hosted database is temporary: accounts, sessions, service edits, and bookings can reset after a restart, redeployment, or instance replacement. Free services may sleep when idle, so the first visit can take longer. Check Render's current free-plan terms during setup; do not select a paid plan unless you intend to pay.

## If Render asks for a payment card

Render can require payment-card verification even when a service is configured as free. The blueprint is not a guarantee of card-free signup. You may try creating **New → Web Service** manually and selecting **Free**, using the settings below. If your account still requires billing details, stop: there is no bypass supplied by this project. Use the [temporary GitHub Codespaces preview](CODESPACES.md) with your account’s available allowance instead.

## Create the hosted service

1. Open [Render](https://dashboard.render.com/) and sign in, or create an account.
2. Choose **New → Web Service**, connect your GitHub account, and select `Mehru-cyber-maker/parlour-app-`.
3. Select the **bookwise-website** branch. The `main` branch originally contains only the guide PDF.
4. Configure the following values. Leave Root Directory blank because `package.json` is at the repository root.

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Branch | `bookwise-website` |
| Instance type | Free, if available in your account |
| Build command | `npm ci --include=dev --no-audit --no-fund && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/catalog` |

5. Add these **environment variables**, then create the web service:

| Variable | Value |
| --- | --- |
| `NODE_VERSION` | `24` |
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `BOOKWISE_DB_PATH` | `/tmp/bookwise/bookwise.sqlite` |
| `BOOKWISE_DEMO_MODE` | `true` |
| `BOOKWISE_SECURE_COOKIES` | `true` |

Alternatively, create a **Blueprint**, select this repository and the `bookwise-website` branch, and use `render.yaml`. The blueprint disables automatic deploys; trigger subsequent deployments manually when you want them.

The app binds to `0.0.0.0` and reads Render's `PORT` environment variable. It initializes the SQLite database and sample roles automatically. HTTPS must be enabled for the secure session cookie, as it is for Render's generated HTTPS address.

## Verify the actual public URL

Wait for deployment to finish and copy the HTTPS URL Render assigns to **your** service. Do not assume a URL from the example service name: names may already be taken.

Open that URL in a private/incognito browser window and check:

- Home, Services, and images load.
- Sign in → **Explore the demo** offers customer, stylist, and admin roles.
- A customer can choose a treatment, stylist, and date; confirm; see the booking in My bookings; reschedule; and cancel.
- The admin dashboard shows the resulting appointment and service menu.

The demo password is `BookwiseDemo2026!`; role emails are listed in the main README. Everyone with the demo link can try the sample admin account, so use sample details only. Do not collect real salon/customer information in this public demonstration.

## Add “Live Demo” to GitHub

After the actual URL passes the checks above:

1. Open [the BookWise source branch](https://github.com/Mehru-cyber-maker/parlour-app-/tree/bookwise-website).
2. Edit the root `README.md` and add a link near the top in this format, replacing the entire placeholder with the actual HTTPS address:

   ```markdown
   [Live Demo](YOUR_VERIFIED_PUBLIC_HTTPS_URL)
   ```

3. On the repository home page, click the gear beside **About**, paste the same address into **Website**, and save.
4. Keep `bookwise-website` selected when sharing the source, since the project is on that branch.

The root README includes the current temporary Codespaces preview address. Creating a separate hosted service is optional. Adding Render configuration or pushing to GitHub does not itself create a Render deployment.

## Durable hosting for real data

For retained appointments, use a long-running Node host with a persistent disk and set `BOOKWISE_DB_PATH` inside the mounted disk. A persistent Render disk generally requires a paid service; the free blueprint deliberately does not request one. Use one app instance with SQLite. For multiple app instances or serverless hosting, migrate to a managed Postgres database with equivalent atomic booking protection first.

For a real salon, disable the shared demo accounts, configure real salon content, email verification and password recovery, backups, rate limiting across processes, account management, and operational monitoring. This free demo setup is for showing the website, not collecting production customer data.
