# SoftwareVault API — for the VaultLaunch launcher

Endpoints the launcher (and the mobile app) use to show the store and sync each
user's personal library ("My Apps"). Base URL in production: `https://softwarevault.dev`.

## Auth model
Accounts are Supabase Auth (email + password). A client logs the user in with the
Supabase Python/JS SDK using the **same** project URL + anon key the website uses
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — both are public),
gets back an **access token**, and sends it on library calls:

```
Authorization: Bearer <access_token>
```

The server validates the token and derives the user from it, so a client can only
ever read or change its own library.

## Endpoints

### `GET /api/catalog`  (public)
Every published program. No auth.
```json
{ "programs": [
  { "id": "abc", "name": "ClickForge", "desc": "...", "ver": "1.2", "cat": "Tools",
    "os": ["win"], "url": "...", "fileUrl": "https://.../clickforge.zip",
    "fileName": "clickforge.zip", "fileSize": 1048576, "coverImage": "...",
    "screenshots": ["..."], "dl": 42, "likes": 7, "featured": true, "date": "...",
    "downloads": { "win": {"url": "...", "name": "app-win.zip", "size": 1048576},
                   "mac": {"url": "...", "name": "app-mac.zip", "size": 1048576},
                   "lin": {"url": "...", "name": "app-linux.zip", "size": 1048576} } }
] }
```
Download a program by fetching its `fileUrl` (or open `url` for web-only entries).

### `GET /api/library`  (auth required)
The signed-in user's saved apps, as full program objects (same shape as catalog).
```json
{ "library": [ { "id": "abc", "name": "ClickForge", ... } ] }
```

### `POST /api/library`  (auth required)
Add an app to the library.
```json
// body
{ "programId": "abc" }
// -> { "ok": true }
```

### `DELETE /api/library?programId=abc`  (auth required)
Remove an app (also accepts `{ "programId": "abc" }` as a JSON body). → `{ "ok": true }`

### `POST /api/downloads`  (public)

Registers ONE completed download and returns the new count.

```
POST /api/downloads
{ "programId": "abc" }
-> { "ok": true, "dl": 128 }
```

The launcher calls this once a file has finished downloading, so apps installed
through VaultLaunch show up in the same counter as browser downloads. It is
deliberately tiny: the only thing it can do is add 1 to one program's counter.

Run `MIGRATION_DOWNLOAD_COUNTER.sql` once so the increment happens atomically in
the database; without it the route falls back to read-then-write, which still
works but can lose a count when two people download at the same moment.

### `POST /api/auth/resolve-email`  (public)

Turns a username into the email Supabase Auth expects. The launcher's sign-in box
accepts an email or a username and calls this for the latter, matching the
website's login exactly.

```
POST /api/auth/resolve-email
{ "username": "cedric" }
-> { "email": "cedric@example.com" }      404 if unknown
```

### `GET /api/download?url=…&name=…`  (public)

Streaming proxy that attaches a download filename. It forwards `Range` headers
and passes `206 Partial Content` (plus `Content-Range`/`Accept-Ranges`) straight
back, so **interrupted downloads can be resumed** — the launcher relies on this.
The body is streamed rather than buffered, so large builds don't sit in server
memory.

## Alternative: talk to Supabase directly
Because the library lives in Supabase with row-level security, a Python client can
skip the HTTP API entirely and use `supabase-py`:
- sign in → `supabase.auth.sign_in_with_password({...})`
- read catalog → `supabase.table("programs").select("*")`
- read library → `supabase.table("library").select("program_id")` (RLS returns only
  the user's own rows)
- add / remove → `upsert` / `delete` on `library`

Both approaches hit the same data; the HTTP endpoints above are handy if you'd
rather keep Supabase keys out of the client or reuse them from the mobile app.

## Notes / still to do on the launcher side
- The PyQt5 app (`pc/`) is still scaffolding — the login button and catalog area
  are placeholders. Wiring them to the above is the next step.
- Requires running `SETUP_SUPABASE.sql` (creates the `library` table) + Email auth
  enabled — see `SETUP.md`.

## Per-OS downloads
Each program carries a `downloads` object with optional `win` / `mac` / `lin`
builds (each `{url, name, size}`). The launcher's `api.download_for(prog)` picks
the build matching the user's OS automatically (and falls back to the legacy
single `fileUrl` for older programs). Older programs may have an empty
`downloads` and just a `fileUrl`.
