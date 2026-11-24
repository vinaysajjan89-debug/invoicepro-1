# InvoicePro

InvoicePro is a browser-based invoice and billing dashboard built with HTML, CSS, and vanilla JavaScript. It stores business settings and invoices in the browser's LocalStorage. The included authentication is a frontend-only demonstration and is not suitable for production.

## Run with VS Code Live Server

1. Open the `InvoicePro` folder itself (not its parent) in VS Code.
2. Install the **Live Server** extension if it is not already installed.
3. Right-click `index.html` and select **Open with Live Server**. Workspace settings pin Live Server to port **5500**.
4. The login page opens automatically when signed out. The app pages all share the same origin and port:
   - Login: `http://127.0.0.1:5500/login.html`
   - Signup: `http://127.0.0.1:5500/signup.html`
   - Dashboard: `http://127.0.0.1:5500/index.html#dashboard`
   - New invoice: `http://127.0.0.1:5500/index.html#new`
5. Create an account, sign in, and use the dashboard's **Log out** button to end the session.

Use Live Server rather than opening the files directly: secure browser cryptography for password hashing is available on localhost, and direct file access may block it.

The previous development URLs used two different Live Server ports and a third temporary static-server port. Relative links work only when the pages are served from one project root and one origin. The configured project URL is now port 5500; stop any old Live Server instance on port 5501 before launching the workspace if necessary.

Browser storage is origin-specific (host and port). Data last saved on port 5501 or 8765 will not automatically appear on port 5500; it remains in that origin's browser storage. Keep using one URL consistently, and manually back up any data you need before switching origins.

## Features

- Landing page, dashboard, invoice list, business settings, and invoice editor.
- Create, edit, duplicate, delete, search, filter, and update invoice statuses.
- Print invoice previews or save them as PDF through the browser's print dialog.
- Automatic overdue status, live invoice totals, and six-month invoiced-versus-paid chart.
- INR, USD, EUR, GBP, AED, AUD, CAD, and SGD currency formatting.
- Sample invoices on first use; clear them from the dashboard or invoice list.
- Business profile and invoice data persist in LocalStorage for this browser.
- Login, signup, remember-me, logout, and a frontend demo password-reset flow.
- Signup/reset password policy: at least 8 characters, including a letter and a number.
- Authentication pages: `login.html`, `signup.html`, `forgot-password.html`, and `reset-password.html`.
- Client CRM with searchable records, notes, invoice history, and per-currency balances; saved clients can populate new invoices.
- Expense tracking with categories, filtering, receipt attachments (up to 1 MB), and CSV export.
- Payment ledger for multiple partial payments, references, methods, dates, and remaining invoice balances.
- Recurring invoice schedules (daily, weekly, monthly, yearly) with a manual due-generation workflow when the app is open.
- Payment reminders with editable templates, scheduled reminders, history, and copy-to-clipboard support.
- Reports with date and currency filters, revenue received, invoiced totals, expenses, net income, receivables, overdue totals, and CSV export. Currency totals are never converted or combined.
- Invoice template choices, accent color, logo, tax visibility, custom footer, and print/PDF support.
- Notification history, global record search, quick actions, dashboard widget preferences, light/dark theme, activity history, and validated JSON backup/restore.

## Authentication prototype

The demo stores account names, emails, salts, and PBKDF2-SHA-256 password hashes in LocalStorage. It never saves plaintext passwords. This does **not** make client-side authentication secure: a user can modify browser storage, and reset codes are shown in the browser rather than emailed. Production use requires a secure backend or authentication provider for credential verification, sessions, and password resets. Invoices and business details remain browser-local and are not separated by account.

## Advanced feature limitations

The advanced modules are local-first demonstration features. Invoice, client, expense, payment, schedule, reminder, notification, activity, and preference data are saved in the browser's LocalStorage on the current origin and device. They are not synchronized, user-isolated, encrypted at rest, or a shared database. JSON restore validates records and asks before replacing current data; keep a separate backup before importing.

- Recurring schedules are checked when the app is opened. Use **Generate due** to create invoices; there is no background job while the browser is closed.
- Reminders can be copied, recorded, or scheduled locally. Actual email delivery requires a configured mail service/backend.
- Payments record money received; they do not charge cards or process online payments. A payment gateway is required for processing.
- Invoice PDF output uses the browser print dialog's **Save as PDF** option. CSV/JSON exports are generated in the browser.
- No exchange-rate API is configured. Reports preserve each invoice/expense currency and do not invent conversion rates.
- Activity history and notifications can be edited with browser developer tools and are not tamper-proof.
- Receipt/logo attachments are kept in browser storage (maximum 1 MB per selected file); browser storage capacity is limited.

Secure production deployment still requires backend authentication and authorization, account-scoped database storage, server-side validation, email delivery, scheduler infrastructure, and a payment provider if online payments are needed.

Authentication form handling uses the `authService` boundary in `js/auth.js`. It currently implements the demo with browser storage and Web Crypto; replace that provider with asynchronous backend calls and server-managed, `HttpOnly`, `Secure`, `SameSite` session cookies for a production deployment. Never trust a client-side session check as authorization.

## Project files

- `index.html` — application shell and shared navigation.
- `css/style.css` — original InvoicePro styles.
- `css/auth.css` — responsive login, signup, and reset page styles.
- `js/script.js` — original routing, invoice behavior, and LocalStorage.
- `js/advanced.js` — client, expense, payment, recurring, reminder, reporting, export, backup, notification, theme, search, and activity modules.
- `js/auth.js` — prototype account, session, and password-reset flows.
- `.vscode/settings.json` — Live Server port configuration (5500).

The Inter and Space Grotesk fonts are loaded from Google Fonts when an internet connection is available; system font fallbacks are included.
