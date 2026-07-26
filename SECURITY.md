# Security review — 2026-07-26

A full pass over the API routes, the database policies and the account flows.
Everything below was found in the live code. Each item says what was wrong, what
it allowed, and what changed.

**Two migrations must be run in the Supabase SQL editor for this to be complete:**

1. `MIGRATION_SECURITY.sql` — closes the database-level holes (items 1 and 2)
2. `MIGRATION_FIX_SIGNUP.sql` — repairs account creation

---

## Critical — anyone could do this with no account

### 1. The whole catalogue was writable by the public
`SETUP_SUPABASE.sql` created this policy on `public.programs`:

```sql
FOR ALL USING (true) WITH CHECK (true)
```

Despite being named "Allow authenticated write", it has no role restriction, so
INSERT/UPDATE/DELETE were granted to everyone — including anonymous visitors.
The anon key is shipped to every browser, so it is public knowledge. One request
could have emptied or rewritten the catalogue.

**Fixed** in `MIGRATION_SECURITY.sql`: policy dropped, write privileges revoked
from `anon` and `authenticated`. Writes go through the API with the service role.

### 2. Every user's 2FA secret was readable by anyone
`profiles` holds `two_fa_secret`, and its read policy is `FOR SELECT USING
(true)`. Anyone could read every account's TOTP secret with the public anon key
and generate valid codes at will — the second factor protected nothing.

**Fixed** in `MIGRATION_SECURITY.sql`: `SELECT` on the secret columns revoked
from the public roles (RLS can't filter columns, so this is done with column
privileges). `is_admin` and the 2FA columns are no longer writable by users
either — previously a user could grant themselves admin.

### 3. `POST /api/programs` had no authentication
The route accepted a complete programs array from anyone. It was left open
because the browser used it to bump download counters.

**Fixed:** now `requireAdmin`. Counting moved to the dedicated `/api/downloads`
endpoint, which can only add 1 to one counter.

### 4. `POST /api/upload` had no authentication
Anyone could upload files of any size and type into the storage bucket and get
public URLs on this project's domain — malware hosting, storage-bill abuse.

**Fixed:** `requireAdmin`, a 500 MB ceiling, and the stored filename is
sanitised (no traversal, no exotic characters).

### 5. `POST /api/email` was an open mail relay
It took `{ email, otp }` from anyone and sent "Your 2FA Code" from the verified
domain to any address, with attacker-supplied text in the code field. Ideal for
phishing that appears to come from you, and a fast way to get the sending domain
blacklisted.

**Fixed:** requires a signed-in caller, always sends to *that account's own*
address, and only accepts a 4–8 digit numeric code. Rate limited.

### 6. `POST /api/welcome` was a second open relay
Same problem, fixed template. Nothing in the app calls it.

**Fixed:** admin-only. Consider deleting the file if it stays unused.

### 7. `GET /api/download` fetched any URL you gave it
The proxy passed `?url=` straight to `fetch` server-side. That is server-side
request forgery: an attacker could point it at internal addresses (for example
cloud metadata endpoints) and read the response through your server.

**Fixed:** the target must be `https` on this project's own Supabase host.

---

## High — anyone could act as another user

### 8. `POST /api/auth/2fa/disable` — no authentication
It took `{ userId }` from the body and switched off that account's 2FA. Because
profiles were world-readable, collecting user ids was trivial. Anyone could
strip everyone's second factor.

**Fixed:** the account comes from the verified access token; the body is ignored.

### 9. `POST /api/auth/2fa/verify` — no authentication, secret from the client
It accepted `{ userId, code, secret }` and validated the code against the secret
*in the request*. Anyone could therefore enable 2FA on someone else's account
using a secret they control — locking the owner out.

**Fixed:** identity from the token; the secret is read from the caller's own
pending enrolment row and never accepted from the client. Codes are compared in
constant time and the endpoint is rate limited.

### 10. `POST /api/auth/2fa/setup` — no authentication
Anyone could start enrolment on another account.

**Fixed:** identity from the token.

### 11. The TOTP secret was handed to a third party
Setup built the QR code by putting the secret into an `api.qrserver.com` URL, so
the shared secret landed in another company's request logs.

**Fixed:** the QR code is now rendered locally (`qrcode` package, added to
`package.json`) and returned as a data URI.

---

## Medium

### 12. No rate limiting on the pre-login endpoints
`resend-confirmation`, `reset-password` and `resolve-email` are necessarily
public. Unthrottled they allow mail bombing and username enumeration.

**Fixed:** a small in-memory throttle (`lib/api_auth.js`). Serverless instances
aren't shared, so this is a speed bump, not a guarantee — put a real limiter in
front of the site if abuse appears.

### 13. Signup could be broken by a taken username
See `MIGRATION_FIX_SIGNUP.sql` — a unique-constraint collision inside the signup
trigger aborted account creation with "Database error saving new user".

---

## Still open — needs your decision

### 2FA — now on Supabase's built-in MFA (was: not enforced at all)
**Resolved.** The hand-rolled TOTP (secret in `profiles`, checked by our own
routes) is gone, along with those three routes. Enrolment, the sign-in challenge
and removal all go through `supabase.auth.mfa`, so the secret never leaves the
auth service and a session only reaches `aal2` by presenting a valid code.
Run `MIGRATION_2FA_NATIVE.sql` to drop the old columns — anyone who had the old
2FA on must enrol again.

**One caveat, stated plainly.** The website now demands the code, but a session
created straight against the Supabase API with only a password is still a valid
`aal1` session, and the RLS policies check *who* you are, not *how strongly* you
proved it. To make the second factor binding for personal data, the policies must
require `aal2` — the statements are in `MIGRATION_2FA_NATIVE.sql`, commented out,
because switching them on locks out the VaultLaunch launcher for anyone with 2FA
enabled (it signs in with a password and cannot answer a TOTP challenge yet).

### `resolve-email` confirms whether a username exists
Required for username sign-in, and the website has always worked this way. Now
rate limited; be aware it makes usernames enumerable.

---

## Notes

- The launcher's `tests/selfcheck.py` includes a contract test that reads these
  route files, so a breaking change to the API shapes fails that test.
- After deploying, admin actions (saving programs, uploading files) require a
  signed-in admin — the browser now sends its access token with those calls.
