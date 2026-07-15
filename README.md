# InternDesk — Intern HRIS

A lightweight HR information system for student interns. Interns can sign in, clock in and out on a daily time record, file leave requests, and lodge concerns. HR admins can add and deactivate intern accounts, review attendance, approve or deny leave, and resolve concerns.

## Quick start

```bash
npm install
npm run dev
```

Then open the printed local URL. Sign in with the seeded admin account:

- **Email:** `admin@company.com`
- **Password:** `admin123`

Change this account's details before real use — add yourself as needed and treat the seed credentials as disposable.

## Roles

**HR admin**
- Overview dashboard: active interns, who's clocked in today, pending leaves, open concerns
- Add intern accounts (name, email, school, department, starting password)
- Deactivate / reactivate accounts
- Approve or deny leave requests
- Resolve concerns with an optional note visible to the intern
- Full attendance log

**Intern**
- Daily time record punch card (clock in / clock out, one record per day)
- File leave requests (type, date range, reason) and track their status
- Lodge concerns by category and track resolution
- Personal history of attendance, leave, and concerns

## Deployment

`npm run build` produces a static site in `dist/`. Deploy it to Vercel, Netlify, or any static host.

## ⚠️ Important limitations of this version

1. **Storage is per-browser.** The app currently persists to `localStorage` via the adapter in `src/storage.js`. Each device keeps its own copy of the data — an intern clocking in on their laptop will **not** appear on HR's dashboard. This version is suitable for demos and evaluation only.
2. **Passwords are stored in plain text** in that same local storage. Do not reuse real passwords.

## Upgrading to real multi-user use (recommended: Supabase)

All persistence goes through four functions in `src/storage.js` (`get`, `set`, `delete`). To make the system genuinely shared:

1. Create a free project at supabase.com.
2. Create a table, e.g. `kv (key text primary key, value text)`.
3. Install the client: `npm install @supabase/supabase-js`.
4. Rewrite `src/storage.js` to read/write that table instead of `localStorage`, using your project URL and anon key from environment variables (`.env`, which is gitignored).

For production-grade security you should go further: move authentication to Supabase Auth (hashed passwords, sessions), split the single key-value store into proper tables (`users`, `attendance`, `leaves`, `concerns`), and enforce row-level security so interns can only read their own records. The UI code can remain largely unchanged.

## Tech

- React 18 + Vite
- No UI framework — styles are inline with a small design-token system
- Fonts: Space Grotesk / IBM Plex Sans / IBM Plex Mono (loaded from Google Fonts)
