# How to Test-Run — SoftwareVault Website

> Written from the project's actual entry point and dependencies. Commands assume you start in this project folder.

**What it is:** The live public site + admin panel (programs, downloads, accounts, 2FA) for softwarevault.dev.

**Stack:** Next.js (React) + Supabase + Resend

**Status:** ✅ Runnable — has a working entry point.

---

## 1. Prerequisites
**Node.js 18.18+** (or 20+) and npm. A Supabase project (free tier is fine) for the database/auth.

## 2. Install dependencies
```bash
npm install
```

## 3. Configure
Create `.env.local` with your keys (see `SETUP.md` for the full list):
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_SECRET=<any long random string>
RESEND_API_KEY=...        # optional, for 2FA / password-reset emails
```
Then run **`SETUP_SUPABASE.sql`** once in the Supabase SQL editor and enable the Email auth provider.

## 4. Run it
```bash
npm run dev        # then open http://localhost:3000
```

## 5. What you should see — verify it works
Work through these in order; if any step fails, note exactly where and what the console says.

1. `npm install` completes without peer-dependency errors.
2. `npm run dev` starts Next.js and http://localhost:3000 loads the site.
3. Programs list renders; switching language and light/dark theme works.
4. Admin: first-run setup creates an admin; login, add a program with per-OS downloads, and a download button appears.
5. Account sign-up/login works and likes + **My Apps** persist to your account.

## 6. Troubleshooting
- `Module not found` / SWC errors after copying `node_modules` between OSes → delete `node_modules` + `.next` and run `npm install` fresh.
- DB/auth errors → run `SETUP_SUPABASE.sql` in the Supabase SQL editor and enable Email auth (see `SETUP.md`).
- Admin actions say "Unauthorized" → set `ADMIN_SECRET` (any long random string); the token layer also auto-persists a secret, but one extra login may be needed after first deploy.
