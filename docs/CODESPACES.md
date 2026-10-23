# Share BookWise from GitHub Codespaces

Use this for a temporary interactive demonstration when a hosting provider asks for a payment card. GitHub includes a limited Codespaces allowance for eligible personal accounts. Check your own allowance before creating a Codespace; no paid plan or card is required by the project configuration. If GitHub asks you to add billing details, stop rather than accepting a charge.

## Open the preview workspace

1. Sign in to GitHub, then [open BookWise in Codespaces](https://codespaces.new/Mehru-cyber-maker/parlour-app-?ref=bookwise-website).
2. Confirm the repository and the **bookwise-website** branch. Choose a **2-core** machine to conserve your allowance.
3. Create the Codespace. Its first setup installs Node.js 24 dependencies, builds the application, and starts the website on port **3000**. No database credentials are needed.
4. Wait for the setup to complete and the message **BookWise is ready on port 3000**. If the terminal is hidden, use the Codespaces Terminal panel.

The `.devcontainer` configuration runs the optimized server with demo accounts and secure cookies for the HTTPS preview. The SQLite file stays inside this Codespace's `.data` folder; it is not your Windows database. It may survive stopping the same Codespace, but deleting the Codespace deletes its local data. Do not use it for real customer records.

## Allow other people to open the website

1. In the Codespaces browser editor, open the **Ports** tab next to Terminal. If port **3000** is not listed, choose **Forward a Port** and enter `3000`.
2. Right-click the port **3000** row and choose **Port Visibility → Public**. Account or organization policy may limit this option.
3. Keep the forwarded port's protocol set to **HTTP**: the Codespaces gateway provides the public **HTTPS** address. Changing the internal protocol to HTTPS would require a TLS server inside the container, which this app does not run.
4. Copy the port's **Forwarded Address**. Use that website address, not the Codespaces editor URL.
5. Open the address in a private/incognito window to confirm it loads without GitHub sign-in. Test the customer, stylist, and admin demo roles.

Public visibility makes the sample app and its sample admin account accessible to anyone with the URL. Use sample details only. Stop the Codespace when the demonstration is finished.

## Put the actual preview link on GitHub

After verifying the forwarded address, add `[Live Demo](YOUR_VERIFIED_FORWARDED_HTTPS_ADDRESS)` near the top of the root README. You can also put the address in the repository's **About → Website** field. Never use the Codespaces creation link as if it were an already running public website.

The preview works only while this Codespace is running. Idle timeouts and usage limits can stop it. This is not permanent, always-on hosting. People opening the website alone should not be assumed to prevent the Codespace from timing out. Resume the same Codespace when you need to demonstrate it again; confirm the forwarded address and visibility before sharing.

## Restart or inspect the server

From the Codespaces terminal in the repository directory:

```bash
bash .devcontainer/start-demo.sh
```

The command reuses an already responding BookWise server. Logs are in `/tmp/bookwise-codespaces-3000.log`. If application code changed, stop only the BookWise process you started, run `npm run build`, and start it again. Do not run a build while a development server is active.

Official references: [Codespaces port forwarding](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace) and [Codespaces billing](https://docs.github.com/en/billing/concepts/product-billing/github-codespaces).
