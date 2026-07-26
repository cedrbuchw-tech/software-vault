# Resend + Namecheap: Domain‑Verifikation und Projekt‑Setup

Diese Anleitung beschreibt Schritt für Schritt, wie du eine Domain bei Resend verifizierst, die DNS‑Einträge bei Namecheap anlegst und dein Projekt so konfigurierst, dass E‑Mails (z. B. Bestätigungs‑ oder 2FA‑Mails) zuverlässig gesendet werden.

---

## Überblick

Ziel: E‑Mails aus deiner App mit einer verifizierten `from`‑Adresse senden (nicht `noreply@resend.dev`). Dazu brauchst du:

- Einen gültigen Resend API Key (`RESEND_API_KEY`).
- Eine verifizierte Domain bei Resend (z. B. `example.com`).
- DNS‑Einträge (CNAME/TXT) in Namecheap gemäß Resend‑Anweisungen.
- `RESEND_FROM_EMAIL` in deiner `.env.local`, passend zur verifizierten Domain.

---

## 1) Domain in Resend anlegen

1. Melde dich bei Resend an: https://resend.com
2. Gehe zu: **Domains** → **Add Domain**.
3. Trage deine Domain ein (z. B. `example.com`) und starte den Vorgang.
4. Resend zeigt nach dem Anlegen die erforderlichen DNS‑Einträge (meist mehrere DKIM CNAMEs und ein TXT). Kopiere alle Einträge genau so wie angezeigt.

Wichtig: Resend liefert konkrete `Host`‑ und `Value`/`Target`‑Angaben. Verwende niemals eigene Varianten — setze die Werte 1:1 in Namecheap.

---

## 2) DNS‑Einträge in Namecheap anlegen

1. Logge dich bei Namecheap ein: https://namecheap.com
2. Öffne **Domain List** → klicke bei deiner Domain auf **Manage**.
3. Reiter: **Advanced DNS**.
4. Für jeden Eintrag aus Resend:
   - Klicke **Add new record**.
   - Typ: `CNAME` oder `TXT` (wie Resend vorgibt).
   - Host: exakte Zeichenkette aus Resend (z. B. `k1._domainkey` oder `_resend_verification`).
   - Value / Target: exakter Wert aus Resend (z. B. `k1._domainkey.resend.com.` oder langer TXT‑String).
   - TTL: `Automatic` oder `30 min`.
   - Speichern.

Hinweis zu SPF (TXT): Wenn bereits ein SPF TXT für deine Domain existiert, darfst du nicht ein zweites SPF TXT anlegen. Füge stattdessen die Empfehlung von Resend in den existierenden SPF‑Eintrag ein (merge‑ähnlich). Poste hier den bestehenden SPF‑TXT, wenn du unsicher bist — ich helfe beim Mergen.

---

## 3) DNS‑Propagation prüfen

Warte einige Minuten bis Stunden (meist < 1 Stunde, in Einzelfällen bis 24–48 Stunden).

Prüfe die Einträge lokal:

- PowerShell (Windows):

```powershell
Resolve-DnsName -Name "k1._domainkey.example.com" -Type CNAME
Resolve-DnsName -Name "example.com" -Type TXT
```

- oder mit nslookup (Linux/macOS/WSL):

```bash
nslookup -type=CNAME k1._domainkey.example.com
nslookup -type=TXT example.com
```

Wenn die Werte mit denen in Resend übereinstimmen, klicke in Resend auf **Verify**.

---

## 4) `.env.local` aktualisieren

Öffne im Projekt‑Root deine `.env.local` und setze mindestens:

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@example.com
```

- `RESEND_FROM_EMAIL` muss eine Adresse sein, die zur verifizierten Domain gehört (z. B. `noreply@example.com`).
- Speichere die Datei.

Wenn du Vercel oder eine andere Plattform benutzt: füge die beiden Variablen auch in den Environment Variables des Providers hinzu.

---

## 5) Dev‑Server neu starten

Im Projekt‑Ordner:

```bash
npm run dev
```

(Dein `package.json` nutzt `next dev` — dieser Befehl startet den Dev‑Server.)

---

## 6) Testen

- Erstelle ein neues Konto in der App oder nutze die Admin‑Test‑Mail (falls vorhanden).
- Achte auf die UI‑Meldung — falls Resend noch im Testmodus ist, kann es weiterhin nur an deine verifizierte Resend‑E‑Mailadresse senden.

Wenn Resend einen Fehler zurückgibt, kopiere hier die komplette Response JSON (oder den Screenshots‑Text). Ich helfe dann beim Diagnostizieren.

---

## 7) Häufige Fehler & Lösungen

- 403 / `validation_error`: Testmodus / `from` ist `resend.dev` → verifiziere Domain und setze `RESEND_FROM_EMAIL`.
- DNS‑Einträge übernommen, aber Resend zeigt „not verified“: Warte noch (Propagation) und prüfe mit den DNS Kommandos oben. Manche DNS‑Provider zeigen alte Werte bei Caching; versuche ein anderes DNS‑Resolver (z. B. `1.1.1.1`).
- SPF Probleme: Nur ein SPF‑TXT pro Domain — wenn bereits vorhanden, erweitere ihn statt einen neuen zu setzen.

---

## 8) Wenn du willst, mache ich das für dich

Ich kann dir helfen mit:

- Prüfen der Resend‑angezeigten DNS‑Einträge und Umwandeln in konkrete Namecheap‑Felder (kopiere hier die Einträge von Resend).
- Prüfen deiner aktuellen `.env.local` auf Korrektheit (wenn du mir bestätigst, dass ich die Datei öffnen darf).

---

Datei erstellt für die Projekt‑Dokumentation. Viel Erfolg — sag mir, welche Domain du verifizierst, dann bereite ich die exakten Namecheap‑Einträge für dich vor.