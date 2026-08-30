# SoftwareVault

The site behind [softwarevault.dev](https://softwarevault.dev): a place to publish
small programs and let people download them for free. Public catalogue, per-OS
builds, user accounts with a personal library, and an admin panel for managing
all of it.

Next.js (App Router) + Supabase (Postgres, Auth, Storage) + Resend for email.
Deployed on Vercel.

---

## Running it locally

Needs Node 18.18+ and a Supabase project (the free tier is enough).

```bash
npm install
npm run dev          # http://localhost:3000
```

Before the first run:

1. Create `.env.local` with the variables listed below.
2. Paste `SETUP_SUPABASE.sql` into the Supabase SQL editor and run it. It builds
   the whole schema and is safe to re-run.
3. In Supabase, go to Authentication > Providers and enable **Email**.
   Set Authentication > URL Configuration > Site URL to your domain.
   Leave "Confirm email" on for real use; turning it off makes test signups instant.

The first account created becomes the admin.

## Environment variables

| Variable | Required | What it is |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL. Public. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon key. Public, ships in the browser. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server only. Bypasses RLS. Never expose this. |
| `ADMIN_SECRET` | yes | Any long random string, used by the admin token layer. |
| `ADMIN_EMAILS` | no | Comma-separated addresses that are always admins, regardless of the `is_admin` flag. The way back in if admin rights get removed by mistake. |
| `RESEND_API_KEY` | no | Enables 2FA codes, password reset and the monthly report. |
| `RESEND_FROM_EMAIL` | no | Sender address. Must be on a domain verified in Resend. |
| `NEXT_PUBLIC_APP_URL` | no | Absolute base URL, used in email links. |
| `CRON_SECRET` | no | Guards the monthly report endpoint against being triggered by anyone. |
| `CUSTOM_CONFIRMATION_EMAIL` | no | Set to send signup confirmation through Resend rather than Supabase. |

Anything without `NEXT_PUBLIC_` is server-side only and must not appear in client code.

## Deploying

Push to the repo connected to Vercel. Set every variable above in
Settings > Environment Variables, for Production and Preview both, then redeploy
so the new values are picked up.

`vercel.json` schedules `POST /api/admin/monthly-report` for 01:00 on the 1st of
each month, which emails a download summary. It needs `RESEND_API_KEY`,
`RESEND_FROM_EMAIL` and `CRON_SECRET` to be set.

## Email

Emails go through Resend. To send to addresses other than your own, verify a
domain at resend.com/domains and set `RESEND_FROM_EMAIL` to an address on it
(for example `noreply@yourdomain.com`). Verification is a handful of DNS records
at your registrar; Resend shows the exact values.

Without `RESEND_API_KEY`, email 2FA and password reset are unavailable and the
site says so rather than failing silently.

## Security notes

Worth knowing before changing anything in this area.

- **The anon key is public.** It ships in the browser, so treat it as known to
  everybody. Anything the anon key may do, any visitor may do.
- **Writes go through the API**, which uses the service role and bypasses RLS.
  The public roles have no INSERT/UPDATE/DELETE on `programs`.
- **Column-level grants on `profiles`.** RLS filters rows, not columns, so
  sensitive columns are withheld with column grants instead. `prefs` is not
  granted to anyone; `is_admin` is readable but never writable by a user, or
  accounts could promote themselves.
- **Identity always comes from the verified bearer token**, never from an id in
  a request body.
- The grant block at the bottom of `SETUP_SUPABASE.sql` rebuilds those
  privileges from the columns that exist, so it must stay last in the file. If
  you add a column that users should be able to read, add it to the `readable`
  array there rather than granting it separately.

## API

Used by the VaultLaunch launcher and the mobile app. Base URL in production is
`https://softwarevault.dev`.

Accounts are Supabase Auth. A client signs in with the Supabase SDK using the
same project URL and anon key the website uses, gets an access token, and sends
it as `Authorization: Bearer <access_token>`. The server derives the user from
the token, so a client can only ever touch its own library.

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /api/catalog` | public | Every published program. |
| `GET /api/library` | bearer | The signed-in user's saved apps, as full program objects. |
| `POST /api/library` | bearer | Add a program. Body: `{ "programId": "abc" }` |
| `DELETE /api/library?programId=abc` | bearer | Remove one. |
| `POST /api/downloads` | public | Record a download. Body: `{ "programId": "abc" }` |
| `POST /api/auth/resolve-email` | public | Turn a username into the email to sign in with. |
| `GET /api/download?url=…&name=…` | public | Proxy for files in this project's Supabase Storage, so they arrive with a real filename and support resuming. Refuses any other host. |

A catalogue entry carries a `downloads` object keyed by platform
(`win`, `mac`, `lin`, `android`, `ios`), each with `url`, `name` and `size`.
Pick the one matching the user's platform; fall back to `fileUrl`, or open `url`
for web-only entries.

Links pasted into the admin panel (Google Drive, MEGA, GitHub releases) are
opened directly rather than proxied. A MEGA file cannot be proxied at all: its
decryption key lives in the part of the URL after the `#`, which is never sent
to a server.

## Layout

```
app/
  page.jsx           the whole public site and admin panel
  auth.jsx           auth modal, account settings, library and likes helpers
  global.css         theme tokens, appearance options, mobile overrides
  api/               route handlers (server only)
lib/                 shared modules: supabase clients, auth guards, appearance,
                     download resolution, email templates
SETUP_SUPABASE.sql   the entire database schema, idempotent
MIGRATION_PREFS.sql  pending: adds profiles.prefs, run once
```
