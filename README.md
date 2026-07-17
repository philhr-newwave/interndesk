# InternDesk — Intern HRIS

A lightweight HR information system for student interns. Interns can sign in, clock in and out on a daily time record, file leave requests, and lodge concerns. HR admins can add and deactivate intern accounts, review attendance, approve or deny leave, and resolve concerns.

## Quick start

```bash
npm install
npm run dev
```

Then open the printed local URL. Sign in with the seeded admin account:

- **Email:** `philhr@new-wave.com.au`
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

## Data & accounts (Supabase)

The app uses a shared Supabase database (`src/db.js`), so all interns and HR see the same live data from any device. Tables are defined in `supabase-setup.sql` — run it once in the Supabase SQL Editor when setting up a new project.

Passwords are stored as salted SHA-256 hashes, never plain text. New and reset accounts are flagged to choose their own password on first sign-in.

## ⚠️ Remaining security limitations

Access control currently relies on the app itself: the database's row-level-security policies grant full access to the anon key, which ships in the front-end bundle. A technically savvy person could read or modify data directly with that key. For a small internal pilot this is an accepted trade-off; the hardening path is Supabase Auth with per-role RLS policies (interns read/write only their own rows).

## Tech

- React 18 + Vite
- No UI framework — styles are inline with a small design-token system
- Fonts: Space Grotesk / IBM Plex Sans / IBM Plex Mono (loaded from Google Fonts)
