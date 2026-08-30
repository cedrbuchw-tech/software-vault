"use client";

// Landing page for password-reset mails. It reads the link itself, in every
// shape Supabase can send, and shows nothing but the reset form.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/vault_client";

const MONO = "'IBM Plex Mono',monospace";

const THEMES = {
  light: { bg:"#f0ece0", card:"#ffffff", blk:"#111111", mut:"#7a766c",
           bdr:"2px solid #111111", shd:"4px 4px 0 #111111", inputBg:"#ffffff" },
  dark:  { bg:"#141414", card:"#1c1c1c", blk:"#e8e4d8", mut:"#8a867c",
           bdr:"2px solid #e8e4d8", shd:"4px 4px 0 #555", inputBg:"#252525" },
};

/** Everything Supabase might put in a recovery link, in one place. */
function readLink() {
  if (typeof window === "undefined") return {};
  const hash = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search || "");
  const pick = (k) => hash.get(k) || query.get(k) || "";
  return {
    accessToken: pick("access_token"),
    refreshToken: pick("refresh_token"),
    code: pick("code"),
    tokenHash: pick("token_hash"),
    type: pick("type"),
    error: pick("error_description") || pick("error"),
  };
}

/** Drop the tokens out of the address bar once they have been used. */
function cleanUrl() {
  if (typeof window === "undefined") return;
  window.history.replaceState({}, "", window.location.pathname);
}

export default function ResetPasswordPage() {
  // "checking" → "form" → "saved", or "invalid" when the link is no good
  const [stage, setStage] = useState("checking");
  const [isDark, setIsDark] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const handled = useRef(false);

  const th = isDark ? THEMES.dark : THEMES.light;

  useEffect(() => {
    try {
      const saved = localStorage.getItem("vault_dark");
      if (saved !== null) setIsDark(JSON.parse(saved));
      else setIsDark(window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
    } catch { /* default light */ }
  }, []);

  useEffect(() => {
    // React runs effects twice in development; redeeming a one-shot token twice
    // would fail the second time and show a false "link expired".
    if (handled.current) return;
    handled.current = true;

    (async () => {
      const link = readLink();

      if (link.error) {
        cleanUrl();
        setErr(link.error);
        setStage("invalid");
        return;
      }

      try {
        if (link.accessToken && link.refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: link.accessToken,
            refresh_token: link.refreshToken,
          });
          if (error) throw error;
        } else if (link.tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: link.tokenHash,
            type: link.type || "recovery",
          });
          if (error) throw error;
        } else if (link.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(link.code);
          if (error) throw error;
        }

        cleanUrl();

        // A session here means the link just created one, or one was already open;
        // either way this browser may set a new password.
        const { data } = await supabase.auth.getSession();
        if (!data?.session) {
          setErr("This reset link is no longer valid. Request a new one below.");
          setStage("invalid");
          return;
        }
        setEmail(data.session.user?.email || "");
        setStage("form");
      } catch (e) {
        cleanUrl();
        setErr(e?.message || "This reset link is no longer valid.");
        setStage("invalid");
      }
    })();
  }, []);

  async function save() {
    if (busy) return;
    setErr("");
    if (pw.length < 8) { setErr("Password must be at least 8 characters."); return; }
    if (pw !== pw2) { setErr("The two passwords don't match."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setPw(""); setPw2("");
      setStage("saved");
    } catch (e) {
      setErr(e?.message || "Could not save the new password.");
    } finally {
      setBusy(false);
    }
  }

  async function sendNewLink() {
    if (busy) return;
    const address = email.trim();
    if (!address.includes("@")) { setErr("Enter the email address of your account."); return; }
    setErr(""); setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(address, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setNote("If that address has an account, a new reset link is on its way.");
    } catch (e) {
      setErr(e?.message || "Could not send a new link.");
    } finally {
      setBusy(false);
    }
  }

  const input = {
    width: "100%", boxSizing: "border-box", padding: "10px 12px", marginBottom: 10,
    border: th.bdr, background: th.inputBg, color: th.blk, fontFamily: MONO, fontSize: 13,
  };
  const primary = {
    width: "100%", padding: 11, background: "var(--sv-accent)", color: "#fff",
    border: th.bdr, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
    fontFamily: MONO, fontSize: 13, fontWeight: 600,
  };
  const linkStyle = {
    display: "inline-block", marginTop: 16, color: "var(--sv-accent)",
    fontFamily: MONO, fontSize: 12,
  };

  return (
    <div style={{ minHeight: "100vh", background: th.bg, color: th.blk,
                  display: "grid", placeItems: "center", padding: 20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=IBM+Plex+Mono:wght@400;500&display=swap');
        input:focus { outline: 2px solid var(--sv-accent); outline-offset: -1px; }
      `}</style>

      <div style={{ width: "min(400px,94vw)", background: th.card, border: th.bdr,
                    boxShadow: th.shd, padding: 30 }}>

        {/* the same mark the site header uses */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <svg width="34" height="34" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <circle cx="16" cy="16" r="14.5" stroke="var(--sv-accent)" strokeWidth="2.5" opacity="0.9" />
            <circle cx="16" cy="16" r="10" stroke={th.blk} strokeWidth="1" opacity="0.2" />
            <circle cx="16" cy="16" r="3.5" fill="var(--sv-accent)" />
            <line x1="16" y1="5" x2="16" y2="10.5" stroke="var(--sv-accent)" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
            <line x1="16" y1="21.5" x2="16" y2="27" stroke="var(--sv-accent)" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
            <line x1="5" y1="16" x2="10.5" y2="16" stroke="var(--sv-accent)" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
            <line x1="21.5" y1="16" x2="27" y2="16" stroke="var(--sv-accent)" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
          </svg>
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1, gap: 3 }}>
            <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 3,
                           color: th.mut, textTransform: "uppercase" }}>Software</span>
            <span style={{ fontFamily: "'Anton',sans-serif", fontSize: 22, letterSpacing: .8 }}>Vault</span>
          </span>
        </div>

        {stage === "checking" && (
          <p style={{ fontFamily: MONO, fontSize: 13, color: th.mut }}>Checking your link…</p>
        )}

        {stage === "form" && (
          <>
            <h1 style={{ fontFamily: "'Anton',sans-serif", fontSize: 24, fontWeight: 400,
                         marginBottom: 6 }}>Set a new password</h1>
            <p style={{ fontFamily: MONO, fontSize: 11, color: th.mut, marginBottom: 18, lineHeight: 1.6 }}>
              {email ? <>For <strong style={{ color: th.blk }}>{email}</strong>. </> : null}
              At least 8 characters.
            </p>

            <input value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }}
              type="password" placeholder="New password" autoComplete="new-password"
              autoFocus style={input}
              onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
            <input value={pw2} onChange={(e) => { setPw2(e.target.value); setErr(""); }}
              type="password" placeholder="Repeat new password" autoComplete="new-password"
              style={input}
              onKeyDown={(e) => { if (e.key === "Enter") save(); }} />

            {err && <p style={{ color: "var(--sv-accent)", fontFamily: MONO, fontSize: 11,
                                margin: "2px 0 10px" }}>{err}</p>}

            <button onClick={save} disabled={busy} style={primary}>
              {busy ? "…" : "Save new password"}
            </button>
            <a href="/" style={linkStyle}>← Back to SoftwareVault</a>
          </>
        )}

        {stage === "saved" && (
          <>
            <h1 style={{ fontFamily: "'Anton',sans-serif", fontSize: 24, fontWeight: 400,
                         marginBottom: 8 }}>Password updated</h1>
            <p style={{ fontFamily: MONO, fontSize: 12, color: th.mut, lineHeight: 1.7,
                        marginBottom: 18 }}>
              You&apos;re signed in with the new password on this device. Other devices will
              need it the next time they sign in.
            </p>
            <a href="/" style={{ ...primary, display: "block", textAlign: "center",
                                 textDecoration: "none", boxSizing: "border-box" }}>
              Continue to SoftwareVault
            </a>
          </>
        )}

        {stage === "invalid" && (
          <>
            <h1 style={{ fontFamily: "'Anton',sans-serif", fontSize: 24, fontWeight: 400,
                         marginBottom: 8 }}>Link no longer valid</h1>
            <p style={{ fontFamily: MONO, fontSize: 12, color: th.mut, lineHeight: 1.7,
                        marginBottom: 16 }}>
              Reset links expire, and each one works only once. Enter your email
              address and we&apos;ll send a fresh one.
            </p>

            {note ? (
              <p style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.6 }}>{note}</p>
            ) : (
              <>
                <input value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }}
                  type="email" placeholder="you@example.com" autoComplete="email" style={input}
                  onKeyDown={(e) => { if (e.key === "Enter") sendNewLink(); }} />
                {err && <p style={{ color: "var(--sv-accent)", fontFamily: MONO, fontSize: 11,
                                    margin: "2px 0 10px" }}>{err}</p>}
                <button onClick={sendNewLink} disabled={busy} style={primary}>
                  {busy ? "…" : "Send a new reset link"}
                </button>
              </>
            )}
            <a href="/" style={linkStyle}>← Back to SoftwareVault</a>
          </>
        )}
      </div>
    </div>
  );
}
