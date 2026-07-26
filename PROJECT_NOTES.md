# PROJECT NOTES — softwarevault.dev (Project 14)

## Status: Live Next.js + Supabase site. Per-OS downloads + launcher auto-pick (Session 41); personal library "My Apps" + launcher API (Session 39); files consolidated (Session 38); per-account likes (Session 37); user accounts (Session 36); web-tagged "Open" (Session 35).

## Session 98 (2026-07-25) — the site and VaultLaunch now fit together properly
Merged Cedric's newer website (2FA, /api/auth/*, welcome mail) with the newer
launcher, then closed the gaps between them.
- **NEW `POST /api/downloads`** + `MIGRATION_DOWNLOAD_COUNTER.sql`. Downloads were
  counted by POSTing the ENTIRE programs array back through `/api/programs` — racy
  (simultaneous downloads overwrite each other with stale copies) and impossible
  for the launcher to use, since it would need write access to every row. The new
  route adds 1 to one counter via an atomic `UPDATE ... RETURNING` SQL function,
  with a read-then-write fallback if the migration hasn't been run. `page.jsx`
  now calls it instead of `saveProgs`, and the launcher calls it too, so
  launcher installs finally show up in the stats.
- **`/api/download` rewritten.** It buffered whole files with `arrayBuffer()`
  (a 300 MB build sat in server memory before a byte was sent) and dropped
  `Range` headers, so nothing downloaded through it could ever resume. It now
  streams the upstream body and forwards Range, passing `206` plus
  `Content-Range`/`Accept-Ranges` back untouched — which is exactly what the
  launcher's new resume support needs. Filenames are sanitised before going
  into `Content-Disposition` (CR/LF/quote injection).
- `LAUNCHER_API.md` documents the three endpoints the launcher relies on that
  weren't written down: `/api/downloads`, `/api/auth/resolve-email`, and the
  Range behaviour of `/api/download`.
- Verified: all touched routes parse (`node --check`), `page.jsx` and `auth.jsx`
  parse with the project's own Babel, launcher selfcheck 15/15, vault_check green.

### ⚠ Two security findings (NOT changed — they need your call)
1. **`POST /api/programs` has no auth at all.** Anyone who knows the URL can
   replace the entire catalog. It was open because the download counter needed
   it from the browser; that reason is now gone, so it can be locked down —
   but the admin panel uses the same route, so tell me how admins should
   authenticate and I'll do it.
2. **2FA is never enforced at sign-in.** `two_fa_enabled` is only written by the
   enable/disable routes and read to show status in the profile. Both the site
   (`signInWithPassword`) and the launcher log in with password only, so turning
   2FA on currently protects nothing.

## Session 51 (2026-06-23) — account modal (change username + sign out)
Logged-in users can now manage their account from the header.
- **`app/auth.jsx`**: the username in the header is now a button that opens a new
  `AccountModal` — it shows the email (read-only), a username editor (Save changes),
  and a Sign out button. Saving **upserts `profiles.username`** (the field the UI reads
  first) and mirrors the value into auth `user_metadata` (best-effort); a duplicate
  username is caught (unique-violation `23505`) and shown as "taken". `useAuth()` now
  also returns `refreshProfile()`, called after a successful save so the header name
  updates immediately. Added `ACCT_T` strings for all 8 languages. The existing header
  Log out button stays for quick access.
- **`SETUP_SUPABASE.sql`**: added a `profiles_insert_own` RLS policy (`INSERT WITH CHECK
  auth.uid() = id`) so the client upsert is allowed for every user. The signup trigger
  already creates the row, but this covers legacy accounts and makes the upsert safe.
  Re-run `SETUP_SUPABASE.sql` (idempotent) to apply it.
- Validated with esbuild (bundles clean). Needs a browser + live Supabase to confirm
  the actual save round-trip and the header refresh.

## Session 45 (2026-06-23) — forgot-password / email reset flow
Rounds out the admin auth: an admin who forgot the password can reset it via a code
emailed to the admin address (reuses the existing Resend integration + OTP storage).
- **`app/api/admin/route.js`**: two new actions.
  - `reset_request`: requires an admin + a configured admin email; generates a 6-digit
    code stored under `admin_reset_otp`/`admin_reset_otp_exp` (15-min window, separate
    from the 2FA login OTP) and emails it via /api/email. No code-in-response in prod
    (reset has no other factor) — only with `ADMIN_2FA_DEV_CODE=true` for local testing.
    Clear errors if no email is set or the send fails.
  - `reset_confirm`: verifies the code (fresh read, not expired, matches), sets the new
    password hash, clears the code, and signs the user in (admin_token cookie via the
    persisted token secret).
  - Added the two reset keys to the settings read.
- **`app/page.jsx`**: a "Forgot password?" link on the login modal (hidden during the 2FA
  step) opens a two-step reset modal — request (emails the code) then confirm (enter code
  + new password). New state (resetStep/resetCode/resetMsg/resetErr) + requestReset() /
  confirmReset() handlers. German/English labels inline.
- Validated: node --check (admin route), esbuild (page.jsx), and a logic test of the
  reset-code verification (correct/wrong/expired/missing). Needs a browser + real email
  for the full round-trip.
- LIMITATION: if the admin has NO email set AND forgot the password, the UI cannot reset
  it (email is the only recovery factor) — fallback is to clear the `admin_pw` row in
  Supabase, which re-enables first-run setup.

## Session 44 (2026-06-23) — per-OS downloads in the EDIT form (feature complete)
The Edit form was metadata-only before (it preserved an existing `downloads` object via
spread but could not change builds). It now manages per-OS builds like the Add form.
- **`app/page.jsx`**: added `freshEditBuilds()` (per-OS slots + a `remove` flag);
  `editForm` now carries the program's existing `downloads` plus fresh edit slots. The
  edit modal shows, per platform (Windows/macOS/Linux): the current build name, a
  "remove" checkbox, and file + URL inputs to replace or add a build. Relabelled the old
  "leave blank to keep file" URL field as "Web app URL (optional)". Removed the now-
  redundant OsToggle from edit (platform tags are derived). `saveEdit` rebuilds
  `downloads` (remove / replace-by-file / replace-by-URL / keep), uploads new files via
  /api/upload, and re-derives `os`: from the build keys when any build exists, otherwise
  it preserves the program's existing platform tags so legacy (single-`fileUrl`) programs
  are not broken; the `web` tag follows the URL field. Added a busy guard (try/finally) +
  a "Saving…" state on the edit Save button.
- Validated: esbuild OK; a Node logic test of the rebuild + os-derivation covering
  remove/add/keep, legacy-preservation, web-only, and legacy→build migration. Needs a
  browser to confirm the modal flow + uploads.

## Session 43 (2026-06-23) — fix: banner shown twice + admin email/2FA not saveable
Two bugs.
- **Announcement banner showed the message twice** (`app/page.jsx`): the marquee
  duplicates the text into two spans for a seamless loop, but `@keyframes annMarquee`
  was never defined, so it never scrolled — short messages just sat side by side.
  Added the missing `annMarquee` keyframes (translateX 0 → -50%); now it only
  duplicates + animates when the text is long (>60 chars), and shows a single centred
  copy otherwise.
- **Admin email / 2FA could not be changed** (same token-layer issue as the password):
  `set_email` / `set_2fa` / `test-email` verify the `admin_token` cookie, which fails
  whenever `ADMIN_SECRET` is unset (or the token expired / the cookie was dropped).
  Fixed by signing/verifying the token against a *persisted* secret:
  - NEW `lib/admin_secret.js` `getTokenSecret()` — returns `ADMIN_SECRET` if set, else an
    auto-generated random secret persisted in the `settings` table (key
    `admin_token_secret`), with a local-file fallback. Resolved per request.
  - `lib/admin_utils.js`: `signToken`/`verifyToken` now take that secret (env stays the
    fallback when none is passed).
  - `app/api/admin/route.js` + `app/api/test-email/route.js` resolve the secret and pass
    it to every sign/verify call. Login / email / 2FA now work with no env var required.
  - No DB migration needed (the `settings` table already exists). If `ADMIN_SECRET` was
    never set, one extra login may be needed once (old cookies were signed with an empty
    key and no longer verify).
- Validated: node --check (all routes + libs), esbuild (page.jsx), and a real token
  round-trip test (same-secret verifies; wrong-secret and expired are rejected). Needs a
  browser to confirm the banner visual and the admin settings flow.

## Session 42 (2026-06-23) — fix: admin password could not be changed
The "change password" action only authorised via the `admin_token` cookie, which
silently fails when `ADMIN_SECRET` is unset, the token is older than 24h, or the
cookie was dropped — you could sign in but then got "Unauthorized" on change.
- **`app/api/admin/route.js`** (`change`): now accepts a valid token OR the correct
  current password (re-hashes `currentPw` with the stored salt and compares), and
  on success **refreshes the `admin_token` cookie** so a stale/expired token is
  replaced. Clear error messages ("Current password is incorrect." / "Enter your
  current password...").
- **`app/page.jsx`**: the change-password modal now has a "current password" field;
  `changePw()` sends `currentPw` and requires it. New `curPw` state.
- NOTE: if *other* admin actions (set email, enable 2FA) also say "Unauthorized",
  the root cause is `ADMIN_SECRET` not being set in the deployment env (Vercel) —
  those still depend on the cookie token. Set ADMIN_SECRET to fix them too.
- Validated: esbuild (page.jsx) + node --check (admin route) + a Node test of the
  scrypt current-password verification (correct/wrong/new all behave). Needs a real
  browser to confirm the modal flow.

## Session 41 (2026-06-23) — per-OS downloads (Windows / macOS / Linux)
Programs can now have a separate build per platform instead of one file.
- **DB**: added a `downloads JSONB` column to `programs` ({win,mac,lin:{url,name,size}}).
  Legacy `fileurl/filename/filesize` kept as a fallback for old programs.
- **`app/page.jsx`**: added OS_DL/freshBuilds/hasBuilds + a `DownloadButtons`
  component; the admin ADD form now has a file+URL slot per OS (Win/macOS/Linux)
  plus an optional Web-app URL (the old url/file toggle + manual OS tags are gone —
  `os` is derived from which builds exist + web). `upload()` uploads each build via
  /api/upload and writes the `downloads` object; `download(prog,target)` takes an OS;
  card + detail modal show one ↓ button per available OS (legacy/web fall back to a
  single button).
- **API**: `/api/programs` POST persists `downloads`; `/api/catalog` + `/api/library`
  already pass it through (spread). 
- **Launcher (04)**: `core/api.py` gained `current_os()` + `download_for(prog)`
  (auto-picks the user's OS build, falls back to legacy); `main_window._download`
  uses it and says "no download for your OS" when missing. Tested headless.
- Validated: esbuild OK (page.jsx); node --check OK (programs route); launcher
  py_compile + OS-picker tested. Needs SETUP_SUPABASE.sql re-run (downloads column)
  + a real browser to verify upload/download UI.

## Session 39 (2026-06-23) — personal library ("My Apps") + launcher API
Accounts now unlock a personal library that the VaultLaunch launcher can sync.
- **DB**: added a `library` table (PK user_id+program_id, RLS so a user manages
  only their own) to `SETUP_SUPABASE.sql`. Also FIXED the `programs` DDL in that
  file to match the live schema (description/fileurl/filename/filesize/coverimage
  — the committed DDL had drifted to `desc`/no-file-cols; IF NOT EXISTS means the
  live table is untouched, this only fixes fresh setups).
- **`app/auth.jsx`**: `fetchMyLibrary` / `setLibrary` helpers + a `libT(lang)`
  string set (My Apps / + Save / ✓ Saved / sign-in hint) in all 8 languages.
- **`app/page.jsx`**: `library` + `myAppsOnly` state, loads the library on login,
  `handleToggleLibrary` (optimistic, reverts on error, prompts sign-in when logged
  out), a "My Apps" filter toggle in the controls bar, and a Save/Saved button on
  both the program card and the detail modal (green #16a34a when saved).
- **API (for the launcher)**: NEW `app/api/catalog/route.js` (GET, public, full
  program list) and `app/api/library/route.js` (GET/POST/DELETE, Bearer-token
  auth — validates the Supabase access token and derives the user, so a caller
  only touches their own library).
- **`LAUNCHER_API.md`** (new): endpoint + auth reference for the launcher, incl.
  the supabase-py direct-access alternative.
- Validated: esbuild OK (page.jsx, auth.jsx); node --check OK (catalog, library).
- ⚠ Needs `SETUP_SUPABASE.sql` re-run (adds `library`) + a real browser/Supabase
  to verify. Launcher (Project 04) client side is still scaffolding — next step.

## Session 38 (2026-06-23) — file cleanup / consolidation (no behaviour change)
- **SQL → one file**: merged the old SETUP_SUPABASE.sql + SETUP_AUTH.sql + SETUP_LIKES.sql
  into a single idempotent **`SETUP_SUPABASE.sql`** (programs + settings + profiles +
  likes). Deleted SETUP_AUTH.sql and SETUP_LIKES.sql.
- **Docs → one file**: folded the Supabase + accounts setup into the single
  **`SETUP.md`** (Step 1 now points at SETUP_SUPABASE.sql; added an email-auth step
  + the new features under "what you changed"). Deleted the redundant
  SUPABASE_SETUP.md (outdated duplicate schema) and AUTH_SETUP.md.
- Moved the stray `software-vault/.gitattributes` to the project root; removed the
  empty `software-vault/` folder.
- **No code touched** — `app/auth.jsx`, `app/page.jsx`, the API routes are unchanged.
  Setup is now simply: run `SETUP_SUPABASE.sql` once + enable Email auth (all in SETUP.md).
  (Earlier session entries below mention SETUP_AUTH.sql / SETUP_LIKES.sql / AUTH_SETUP.md —
  those were merged into the two files above.)

## Session 37 (2026-06-23) — per-account likes (accounts now do something)
Likes are now tied to the logged-in account instead of per-browser localStorage.
- **`SETUP_LIKES.sql`** (new): a `likes` table (PK user_id+program_id, RLS so a
  user manages only their own) + a `security definer` trigger that keeps
  `programs.likes` in sync (+1 insert / −1 delete).
- **`app/auth.jsx`**: added `fetchMyLikes(userId)`, `setLike(userId,programId,liked)`
  (upsert/delete on the likes table via the user's session → RLS), an `openAuthModal()`
  event bus (so the like button can pop the sign-in modal), `likeHint(lang)`, a
  localized "sign in to like" string in all 8 langs, and an AuthButton listener
  for the bus.
- **`app/page.jsx`**: `const {user}=useAuth()` + an effect that loads the user's
  likes on login / clears on logout; `handleLike` rewritten — logged out → toast +
  open sign-in modal; logged in → optimistic ±1 then `setLike` (no more saveProgs
  for likes); reverts on error. Removed the old localStorage liked-set load.
- **`app/api/programs/route.js`**: POST now PRESERVES the stored `likes` value
  (fetches existing id+likes, keeps it) so full-row saves (download dl-count, admin
  edits) can't clobber the trigger-maintained count. New programs still take 0.
- Validated: esbuild OK for auth.jsx + page.jsx; node --check OK for route.js.
- Behaviour notes: existing like counts stay as a baseline, per-account likes
  add/remove on top. Liking now requires an account (anonymous liking removed).
- ⚠ Needs SETUP_AUTH.sql **and** SETUP_LIKES.sql run, plus a real browser/Supabase
  to verify the full like→DB→count loop end to end.

## Session 36 (2026-06-23) — user accounts (Supabase Auth)
Added real sign-up / log-in / log-out with persistent sessions, as a single
self-contained module so the live page is barely touched.
- **`app/auth.jsx`** (new): exports `useAuth()` (session via `getSession` +
  `onAuthStateChange`, plus a `profiles` lookup) and `<AuthButton lang th/>` —
  the header control + a login/signup modal (email + password, username on
  signup), with friendly error mapping and its OWN 8-language translation table
  (so page.jsx's translations were left alone). Styled to the brutalist theme via
  the passed `th`. Uses the shared anon client from `lib/vault_client`
  (sessions persist + auto-refresh in the browser).
- **`app/page.jsx`**: two-line touch only — `import { AuthButton }` and
  `<AuthButton lang={lang} th={th}/>` placed in the header after the theme toggle.
- **`SETUP_AUTH.sql`** (new): `profiles` table + RLS + a trigger that
  auto-creates a profile (username from signup metadata) on `auth.users` insert.
- **`AUTH_SETUP.md`** (new): one-time steps — run the SQL, enable the Email
  provider (+ set Site URL if email confirmation is on); env vars already present;
  no new packages.
- Validated: esbuild transforms both `app/auth.jsx` and `app/page.jsx` with no
  errors. Look unchanged.
- NOT yet wired into features: likes are still anonymous, uploads still
  admin-only. Tying likes/uploads to the account is the next step (needs a small
  `likes` table + API tweaks). Password-reset / account page / OAuth are optional
  follow-ups.
- ⚠ Can't be run here (no live Supabase + browser) — needs the SETUP_AUTH.sql run
  and a real sign-up to verify end to end.

## Session 35 (2026-06-23) — web-tagged programs open instead of download
For programs tagged **Web** (`os` array contains `"web"` — see `OSS` in
`app/page.jsx`), the action button now:
- **Labels "Open" instead of "Download"**, localized in all 8 languages
  (en Open / de Öffnen / es+pt Abrir / no Åpne / ja 開く / zh 打开 / ru Открыть),
  via a new `open` key in each translation object. Non-web programs are unchanged.
- **Opens a new tab** instead of triggering a file download: the `download()`
  handler now, for web-tagged programs, does
  `window.open(prog.url || "https://softwarevault.dev", "_blank")` (uses the
  program's own URL, falling back to the softwarevault.dev domain). Non-web
  download behaviour (hosted file / data URL) is untouched.
- Touched only `app/page.jsx` (DetailModal button, ProgramCard button, the 8
  translation objects, and the `download` handler). Look unchanged — same button
  styling, only the label + action differ for web items.
- Validated: esbuild transforms `app/page.jsx` with no syntax errors.
- NOTE: a web program must be uploaded with its URL set (Upload → URL mode) and
  the **Web** platform toggled on for the button to read "Open" and launch it.

## Status (historical): Existing production codebase imported. NOT yet worked on by AI.

This is the real Next.js + Supabase site, dropped in as-is from the user's
upload. Nothing has been touched yet. Treat this as a live codebase, not a
scaffold — read everything before changing anything.

## What's here
Next.js app (app/ router), Supabase backend (lib/vault_client.js), API routes
for programs, admin, upload, download, email. AGENTS.md at the project root
has framework-specific rules — READ IT FIRST, it says this Next.js version
has breaking changes from training data and points to node_modules/next/dist/docs/.

## What the user asked for (not started yet)
1. **Bug fixes** — user didn't specify which bugs. Ask them, or read through
   app/api/*/route.js and lib/vault_client.js for obvious issues first
   (error handling gaps, unguarded null checks, etc.) and propose a list.
2. **Account system** — sign up either with Google OAuth or a normal
   email/password flow. Supabase Auth supports both natively
   (supabase.auth.signInWithOAuth({provider:'google'}) and
   supabase.auth.signUp()/signInWithPassword()). Check SUPABASE_SETUP.md
   and SETUP_SUPABASE.sql for the existing schema before adding tables.
   This almost certainly needs: a users/profiles table, auth UI (login/signup
   forms or a Supabase Auth UI component), session handling in layout.jsx,
   and Google OAuth credentials configured in the Supabase dashboard
   (external, can't be done from code alone — flag this to the user).

## Priority: CRITICAL
This is the live site at softwarevault.dev — the project hub for everything
else in this repo. Treat bugs here as high-impact.
