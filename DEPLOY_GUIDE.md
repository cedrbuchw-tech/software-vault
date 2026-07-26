# SoftwareVault Website — Deploy-Guide (Schritt für Schritt, Windows)

> Session 74. Geschrieben aus dem echten Projektstand: Next.js 16, Supabase
> (programs/settings/profiles/likes/library + RLS-Policies + Trigger), Resend
> für E-Mail, Admin-Token über `ADMIN_SECRET`, 9 API-Routen.
> Alle lokalen Befehle sind **PowerShell (Windows 11)**.

---

## Phase 0 — Konten & Werkzeuge (einmalig, alles kostenlos startbar)

| Was | Wofür | Wo |
|---|---|---|
| Node.js LTS | lokal bauen/testen | `winget install OpenJS.NodeJS.LTS` |
| GitHub-Account | Code-Hosting → Auto-Deploy | github.com |
| Vercel-Account | Hosting der Next.js-Seite | vercel.com (mit GitHub anmelden) |
| Supabase-Account | Datenbank + Auth | supabase.com |
| Resend-Account | E-Mail-Versand | resend.com |
| Deine Domain | softwarevault.dev | bei deinem Registrar |

---

## Phase 1 — Lokal starten (funktioniert schon OHNE Supabase)

Die API-Routen haben Fallbacks (`SUPABASE_ENABLED`): ohne Keys läuft die Seite
mit leerem Katalog — perfekt zum ersten Sehen.

```powershell
cd <dein Vault>\14_SoftwareVault_Website
npm install
Copy-Item .env.example .env.local -ErrorAction SilentlyContinue
npm run dev
```

→ `http://localhost:3000` im Browser. Seite lädt = Phase 1 fertig.
(Fehler bei `npm install` → Node-Version prüfen: `node -v` sollte ≥ 20 sein.)

---

## Phase 2 — Supabase einrichten (Datenbank + Login)

1. supabase.com → **New project** (Region: `eu-central-1`, starkes DB-Passwort
   notieren).
2. Links **SQL Editor** → New query → den **kompletten Inhalt von
   `SETUP_SUPABASE.sql`** einfügen → **Run**. Das Script ist idempotent
   (`IF NOT EXISTS` / `DROP POLICY IF EXISTS`) — du kannst es gefahrlos
   erneut ausführen.
3. **Authentication → Providers → Email**: aktivieren. („Confirm email" nach
   Geschmack — mit Resend aus Phase 3 funktionieren Bestätigungsmails.)
4. **Settings → API**: drei Werte kopieren →
   - `Project URL`
   - `anon public` Key
   - `service_role` Key (**geheim!** Niemals ins Frontend, niemals committen —
     die Root-`.gitignore` schließt `.env*` bereits aus.)
5. In `.env.local` eintragen:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

6. `npm run dev` neu starten → auf der Seite **registrieren** → in Supabase
   unter **Table Editor → profiles** muss dein Eintrag auftauchen (der Trigger
   legt ihn automatisch an). Like/Library kurz anklicken → Tabellen füllen sich.

---

## Phase 3 — Resend (E-Mail-Versand)

1. resend.com → API Key erstellen → in `.env.local`:
   `RESEND_API_KEY=re_...`
2. **Domain verifizieren** (damit Mails nicht im Spam landen): Resend →
   Domains → Add `softwarevault.dev` → die angezeigten **DNS-Records (TXT/
   MX/DKIM)** beim Registrar eintragen → auf „Verified" warten.
   (Zum reinen Testen geht anfangs auch Resends Onboarding-Absender.)
3. Test lokal über die Seite auslösen (die `api/test-email`-Route existiert
   genau dafür — **nur lokal benutzen**, siehe Phase 7!).

---

## Phase 4 — Admin einrichten & erste Inhalte

1. Starkes Admin-Secret erzeugen und in `.env.local` eintragen:

```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})
```

```
ADMIN_SECRET=<der erzeugte String>
```

   (Ohne `ADMIN_SECRET` erzeugt die Seite ein Zufalls-Secret und persistiert
   es in `settings` — funktioniert, aber ein explizites Secret ist sauberer
   und überlebt Umgebungswechsel. **Gleicher Wert später in Vercel!**)
2. Admin-Panel öffnen und anmelden (Weg/Details: `SETUP.md` des Projekts).
3. Erste Programme über das Panel hochladen (→ `api/upload`, landet in
   `programs`) — deine frisch gebauten ZIPs aus dem Vault sind die Kandidaten.

---

## Phase 5 — Auf GitHub

Das ganze Vault-Repo pushen (du hast es in Session 73 committet); Vercel kann
Unterordner deployen:

```powershell
cd <dein Vault>
git remote add origin https://github.com/<du>/SoftwareVault.git
git push -u origin main
```

---

## Phase 6 — Vercel-Deploy + Domain

1. vercel.com → **Add New… → Project** → dein GitHub-Repo importieren.
2. **Root Directory** auf `14_SoftwareVault_Website` setzen (Framework
   „Next.js" erkennt Vercel selbst).
3. **Environment Variables** (Production **und** Preview): alle **fünf** —
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ADMIN_SECRET`.
4. **Deploy** → nach ~1 Min hast du eine `*.vercel.app`-URL. Alles testen.
5. **Domain**: Project → Settings → Domains → `softwarevault.dev` (+ `www`)
   hinzufügen → die von Vercel angezeigten DNS-Werte beim Registrar setzen
   (typisch: `A @ 76.76.21.21`, `CNAME www cname.vercel-dns.com`).
6. Ab jetzt: **jeder `git push` deployt automatisch.**

---

## Phase 7 — VOR dem echten Launch (Sicherheit)

-- **`app/api/debug` und `app/api/test-email` dürfen nicht öffentlich live
   gehen** — entweder Ordner löschen oder die Routen schützen. In diesem Zweig
   wurden `api/debug` und `api/test-email` so geändert, dass sie eine gültige
   Bearer-Authentifizierung erwarten: sendet `Authorization: Bearer <supabase-access-token>` und
   prüft, ob das zugehörige Profil `is_admin = true` hat. Stelle sicher, dass
   die Supabase-Auth korrekt eingerichtet ist und dass Admins in `profiles` als
   `is_admin` markiert sind (der `SETUP_SUPABASE.sql`-Trigger macht den ersten
   registrierten Benutzer automatisch zum Admin). Alternativ kannst du die Routen
   komplett entfernen, wenn du sie nicht benötigst.
- `service_role`-Key existiert **nur** in `.env.local` und Vercel-Env.
- RLS ist durch das SQL aktiv (Policies auf profiles/likes/library) —
  im Supabase-Dashboard unter Authentication → Policies gegenprüfen.

---

## Phase 8 — Launch-Checkliste

1. `https://softwarevault.dev` lädt (HTTPS, beide mit/ohne `www`).
2. Registrieren → Bestätigungsmail kommt an (nicht im Spam).
3. Login, Like setzen/entfernen (Zähler stimmt), Library füllen.
4. Download eines Programms → `downloads`-Zähler steigt.
5. Admin-Login geht; Upload eines neuen Programms erscheint im Katalog.
6. `…/api/debug` und `…/api/test-email` liefern **404/401**.
7. `git push` → Vercel baut automatisch neu.
8. VaultLaunch (04) laut `LAUNCHER_API.md` gegen die Live-URL testen.

---

## Troubleshooting

| Symptom | Ursache/Fix |
|---|---|
| `npm install` scheitert | Node < 20 → LTS installieren, Terminal neu öffnen |
| „Could not find the table …" | `SETUP_SUPABASE.sql` (erneut) im SQL-Editor ausführen |
| Signup ohne Mail | Email-Provider in Supabase aktiv? Resend-Domain „Verified"? Spam-Ordner? |
| Admin-Login 401 auf Vercel | `ADMIN_SECRET` in Vercel ≠ lokal → gleichen Wert setzen, Redeploy |
| Seite live, Katalog leer | Env-Variablen in Vercel fehlen/Preview vergessen → setzen, Redeploy |
