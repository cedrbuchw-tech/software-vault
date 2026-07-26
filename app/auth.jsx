"use client";
// app/auth.jsx — self-contained user accounts (Supabase Auth)
// ----------------------------------------------------------
// Drops one <AuthButton lang th /> into the header. Everything else — session
// restore, login/signup modal, logout, profile lookup, and its own translations
// — lives here so the main page is barely touched. Uses the shared anon client
// from lib/vault_client (sessions persist + refresh automatically in the browser).

import { useState, useEffect, useRef } from "react";
import { useBackdropClose, useScrollLock, Portal, scrollPanel } from "@/lib/modal_ux";
import { loadAppearance, saveAppearance, applyAppearance, ACCENTS } from "@/lib/appearance";
import { uploadAvatar, clearAvatar, initialsFor } from "@/lib/avatar";
import { supabase } from "@/lib/vault_client";

// ---- translations (same 8 languages as the site) ---------------------------
const AUTH_T = {
  en: { in_:"Sign in", up_:"Create account", signin:"Sign in", signup:"Sign up",
        signout:"Log out", email:"Email", pass:"Password", user:"Username", emailOrUsername:"Email or username",
        toIn:"Already have an account? Sign in", toUp:"Need an account? Sign up",
        check:"Almost there — check your email to confirm your account.",
        err:"Something went wrong. Please try again.",
        err_taken:"That email is already registered.",
        err_creds:"Wrong email or password.",
        err_unconf:"Please confirm your email first (check your inbox).",
        forgot:"Forgot password?", reset:"Reset password", resetSent:"Check your email for a reset link.",
        like:"Sign in to like", myapps:"My Apps", save:"+ Save", saved:"✓ Saved", libhint:"Sign in to save apps" },
  de: { in_:"Anmelden", up_:"Konto erstellen", signin:"Anmelden", signup:"Registrieren",
        signout:"Abmelden", email:"E-Mail", pass:"Passwort", user:"Benutzername", emailOrUsername:"E-Mail oder Benutzername",
        toIn:"Schon ein Konto? Anmelden", toUp:"Noch kein Konto? Registrieren",
        check:"Fast geschafft — bestätige dein Konto per E-Mail.",
        err:"Etwas ist schiefgelaufen. Bitte erneut versuchen.",
        err_taken:"Diese E-Mail ist bereits registriert.",
        err_creds:"Falsche E-Mail oder Passwort.",
        err_unconf:"Bitte bestätige zuerst deine E-Mail (Posteingang prüfen).",
        forgot:"Passwort vergessen?", reset:"Passwort zurücksetzen", resetSent:"Prüfe deine E-Mail für einen Zurücksetzen-Link.",
        like:"Zum Liken anmelden", myapps:"Meine Apps", save:"+ Speichern", saved:"✓ Gespeichert", libhint:"Zum Speichern anmelden" },
  es: { in_:"Iniciar sesión", up_:"Crear cuenta", signin:"Entrar", signup:"Registrarse",
        signout:"Cerrar sesión", email:"Correo", pass:"Contraseña", user:"Usuario",
        toIn:"¿Ya tienes cuenta? Entrar", toUp:"¿No tienes cuenta? Regístrate",
        check:"Casi listo — confirma tu cuenta en tu correo.",
        err:"Algo salió mal. Inténtalo de nuevo.",
        err_taken:"Ese correo ya está registrado.",
        err_creds:"Correo o contraseña incorrectos.",
        err_unconf:"Confirma tu correo primero (revisa tu bandeja).",
        forgot:"¿Olvidaste tu contraseña?", reset:"Restablecer contraseña", resetSent:"Revisa tu correo para el enlace de restablecimiento.",
        like:"Inicia sesión para dar me gusta", myapps:"Mis Apps", save:"+ Guardar", saved:"✓ Guardado", libhint:"Inicia sesión para guardar" },
  no: { in_:"Logg inn", up_:"Opprett konto", signin:"Logg inn", signup:"Registrer",
        signout:"Logg ut", email:"E-post", pass:"Passord", user:"Brukernavn", emailOrUsername:"E-post eller brukernavn",
        toIn:"Har du allerede konto? Logg inn", toUp:"Trenger du konto? Registrer",
        check:"Nesten der — bekreft kontoen din på e-post.",
        err:"Noe gikk galt. Prøv igjen.",
        err_taken:"Denne e-posten er allerede registrert.",
        err_creds:"Feil e-post eller passord.",
        err_unconf:"Bekreft e-posten din først (sjekk innboksen).",
        forgot:"Glemt passord?", reset:"Tilbakestill passord", resetSent:"Sjekk e-posten din for en tilbakestillingslenke.",
        like:"Logg inn for å like", myapps:"Mine Apper", save:"+ Lagre", saved:"✓ Lagret", libhint:"Logg inn for å lagre" },
  pt: { in_:"Entrar", up_:"Criar conta", signin:"Entrar", signup:"Registrar",
        signout:"Sair", email:"E-mail", pass:"Senha", user:"Usuário", emailOrUsername:"E-mail ou usuário",
        toIn:"Já tem conta? Entrar", toUp:"Não tem conta? Registre-se",
        check:"Quase lá — confirme sua conta no e-mail.",
        err:"Algo deu errado. Tente novamente.",
        err_taken:"Esse e-mail já está registrado.",
        err_creds:"E-mail ou senha incorretos.",
        err_unconf:"Confirme seu e-mail primeiro (verifique a caixa de entrada).",
        forgot:"Esqueceu a senha?", reset:"Redefinir senha", resetSent:"Verifique seu e-mail para o link de redefinição.",
        like:"Entre para curtir", myapps:"Meus Apps", save:"+ Salvar", saved:"✓ Salvo", libhint:"Entre para salvar apps" },
  ja: { in_:"ログイン", up_:"アカウント作成", signin:"ログイン", signup:"登録",
        signout:"ログアウト", email:"メール", pass:"パスワード", user:"ユーザー名",
        toIn:"アカウントをお持ちですか？ ログイン", toUp:"アカウントが必要ですか？ 登録",
        check:"あと少し — メールでアカウントを確認してください。",
        err:"問題が発生しました。もう一度お試しください。",
        err_taken:"このメールは既に登録されています。",
        err_creds:"メールまたはパスワードが違います。",
        err_unconf:"先にメールを確認してください（受信箱をご確認ください）。",
        forgot:"パスワードを忘れましたか？", reset:"パスワードをリセット", resetSent:"メールでリセットリンクを確認してください。",
        like:"いいねするにはログイン", myapps:"マイアプリ", save:"+ 保存", saved:"✓ 保存済み", libhint:"保存するにはログイン" },
  zh: { in_:"登录", up_:"创建账户", signin:"登录", signup:"注册",
        signout:"退出", email:"邮箱", pass:"密码", user:"用户名",
        toIn:"已有账户？登录", toUp:"还没有账户？注册",
        check:"就快好了 — 请查收邮件确认账户。",
        err:"出错了，请重试。",
        err_taken:"该邮箱已被注册。",
        err_creds:"邮箱或密码错误。",
        err_unconf:"请先确认邮箱（查看收件箱）。",
        forgot:"忘记密码？", reset:"重置密码", resetSent:"请检查您的邮件以获取重置链接。",
        like:"登录后点赞", myapps:"我的应用", save:"+ 收藏", saved:"✓ 已收藏", libhint:"登录后收藏" },
  ru: { in_:"Войти", up_:"Создать аккаунт", signin:"Войти", signup:"Регистрация",
        signout:"Выйти", email:"Эл. почта", pass:"Пароль", user:"Имя пользователя",
        toIn:"Уже есть аккаунт? Войти", toUp:"Нет аккаунта? Зарегистрируйтесь",
        check:"Почти готово — подтвердите аккаунт по почте.",
        err:"Что-то пошло не так. Попробуйте снова.",
        err_taken:"Эта почта уже зарегистрирована.",
        err_creds:"Неверная почта или пароль.",
        err_unconf:"Сначала подтвердите почту (проверьте входящие).",
        forgot:"Забыли пароль?", reset:"Сброс пароля", resetSent:"Проверьте свою почту для ссылки на сброс.",
        like:"Войдите, чтобы лайкнуть", myapps:"Мои приложения", save:"+ Сохранить", saved:"✓ Сохранено", libhint:"Войдите, чтобы сохранять" },
};
const T = (lang) => AUTH_T[lang] || AUTH_T.en;

// ---- account-modal strings (same 8 languages) ------------------------------
const ACCT_T = {
  en: { account:"Account", save:"Save changes", updated:"Saved.", taken:"That username is taken.", uerr:"Couldn't save. Please try again.",
        twofa:"Two-Factor Auth", enable2fa:"Enable 2FA", disable2fa:"Disable 2FA", enabled2fa:"2FA is enabled",
        scan:"Scan with authenticator app:", enter2fa:"Enter 6-digit code:", verify:"Verify", copying:"Copy", copied:"Copied!" },
  de: { account:"Konto", save:"Änderungen speichern", updated:"Gespeichert.", taken:"Dieser Benutzername ist vergeben.", uerr:"Speichern fehlgeschlagen. Bitte erneut versuchen.",
        twofa:"Zwei-Faktor-Authentifizierung", enable2fa:"2FA aktivieren", disable2fa:"2FA deaktivieren", enabled2fa:"2FA ist aktiviert",
        scan:"Mit Authentifizierungs-App scannen:", enter2fa:"6-stelligen Code eingeben:", verify:"Bestätigen", copying:"Kopieren", copied:"Kopiert!" },
  es: { account:"Cuenta", save:"Guardar cambios", updated:"Guardado.", taken:"Ese usuario ya existe.", uerr:"No se pudo guardar. Inténtalo de nuevo.",
        twofa:"Autenticación de dos factores", enable2fa:"Activar 2FA", disable2fa:"Desactivar 2FA", enabled2fa:"2FA está activado",
        scan:"Escanea con tu app autenticadora:", enter2fa:"Ingresa código de 6 dígitos:", verify:"Verificar", copying:"Copiar", copied:"¡Copiado!" },
  no: { account:"Konto", save:"Lagre endringer", updated:"Lagret.", taken:"Det brukernavnet er opptatt.", uerr:"Kunne ikke lagre. Prøv igjen.",
        twofa:"To-faktor-autentisering", enable2fa:"Aktiver 2FA", disable2fa:"Deaktiver 2FA", enabled2fa:"2FA er aktivert",
        scan:"Skann med autentiseringsapp:", enter2fa:"Skriv inn 6-sifret kode:", verify:"Bekreft", copying:"Kopier", copied:"Kopiert!" },
  pt: { account:"Conta", save:"Salvar alterações", updated:"Salvo.", taken:"Esse usuário já existe.", uerr:"Não foi possível salvar. Tente novamente.",
        twofa:"Autenticação de dois fatores", enable2fa:"Ativar 2FA", disable2fa:"Desativar 2FA", enabled2fa:"2FA está ativado",
        scan:"Escaneie com seu app autenticador:", enter2fa:"Digite código de 6 dígitos:", verify:"Verificar", copying:"Copiar", copied:"Copiado!" },
  ja: { account:"アカウント", save:"変更を保存", updated:"保存しました。", taken:"そのユーザー名は使用されています。", uerr:"保存できませんでした。もう一度お試しください。",
        twofa:"二段階認証", enable2fa:"2FAを有効にする", disable2fa:"2FAを無効にする", enabled2fa:"2FAは有効です",
        scan:"認証アプリでスキャン:", enter2fa:"6桁のコードを入力:", verify:"確認", copying:"コピー", copied:"コピー済み!" },
  zh: { account:"账户", save:"保存更改", updated:"已保存。", taken:"该用户名已被使用。", uerr:"保存失败，请重试。",
        twofa:"双因素认证", enable2fa:"启用2FA", disable2fa:"禁用2FA", enabled2fa:"2FA已启用",
        scan:"用身份验证应用扫描:", enter2fa:"输入6位代码:", verify:"验证", copying:"复制", copied:"已复制!" },
  ru: { account:"Аккаунт", save:"Сохранить", updated:"Сохранено.", taken:"Это имя уже занято.", uerr:"Не удалось сохранить. Попробуйте снова.",
        twofa:"Двухфакторная аутентификация", enable2fa:"Включить 2FA", disable2fa:"Отключить 2FA", enabled2fa:"2FA включена",
        scan:"Отсканируйте с помощью приложения аутентификации:", enter2fa:"Введите 6-значный код:", verify:"Проверить", copying:"Копировать", copied:"Скопировано!" },
};
const AT = (lang) => ACCT_T[lang] || ACCT_T.en;

function friendlyError(msg, t) {
  if (!msg) return t.err;
  const m = msg.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered")) return t.err_taken;
  if (m.includes("invalid login")) return t.err_creds;
  if (m.includes("email not confirmed")) return t.err_unconf;
  return msg;
}

// ---- per-account likes + opening the sign-in modal from elsewhere -----------
export async function fetchMyLikes(userId) {
  if (!userId) return [];
  const { data, error } = await supabase.from("likes").select("program_id").eq("user_id", userId);
  if (error) return [];
  return (data || []).map((r) => r.program_id);
}
export async function setLike(userId, programId, liked) {
  if (!userId) throw new Error("not signed in");
  if (liked) {
    const { error } = await supabase.from("likes").upsert({ user_id: userId, program_id: programId });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("likes").delete().eq("user_id", userId).eq("program_id", programId);
    if (error) throw error;
  }
}
export async function fetchMyLibrary(userId) {
  if (!userId) return [];
  const { data, error } = await supabase.from("library").select("program_id").eq("user_id", userId);
  if (error) return [];
  return (data || []).map((r) => r.program_id);
}
export async function setLibrary(userId, programId, inLib) {
  if (!userId) throw new Error("not signed in");
  if (inLib) {
    const { error } = await supabase.from("library").upsert({ user_id: userId, program_id: programId });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("library").delete().eq("user_id", userId).eq("program_id", programId);
    if (error) throw error;
  }
}
export function libT(lang) { const t = T(lang); return { myapps: t.myapps, save: t.save, saved: t.saved, hint: t.libhint }; }
const _authBus = (typeof window !== "undefined") ? new EventTarget() : null;
export function openAuthModal() { if (_authBus) _authBus.dispatchEvent(new Event("open")); }
export function likeHint(lang) { return T(lang).like; }

async function resolveEmail(identifier) {
  const value = (identifier || "").trim();
  if (!value) throw new Error("Missing email or username");
  if (value.includes("@")) return value;

  const res = await fetch("/api/auth/resolve-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: value }),
  });
  const json = await res.json();
  if (!res.ok || !json.email) throw new Error(json.error || "Username not found");
  return json.email;
}

// ---- session hook ----------------------------------------------------------
export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // saved appearance has to be in place on first paint, not only once the
  // account dialog happens to be opened
  useEffect(() => { applyAppearance(loadAppearance()); }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data?.session?.user ?? null);
      setLoading(false);
    }).catch(() => active && setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => { active = false; sub?.subscription?.unsubscribe?.(); };
  }, []);

  useEffect(() => {
    if (!user) { setProfile(null); return; }
    let active = true;
    supabase.from("profiles").select("username, avatar_url").eq("id", user.id).single()
      .then(({ data }) => { if (active) setProfile(data || null); })
      .catch(() => {});
    return () => { active = false; };
  }, [user]);

  function refreshProfile() {
    if (!user) { setProfile(null); return; }
    supabase.from("profiles").select("username, avatar_url").eq("id", user.id).single()
      .then(({ data }) => setProfile(data || null))
      .catch(() => {});
  }

  return { user, profile, loading, refreshProfile };
}

function displayName(user, profile) {
  return profile?.username || user?.user_metadata?.username ||
    (user?.email ? user.email.split("@")[0] : "account");
}

// ---- header control --------------------------------------------------------
export function AuthButton({ lang, th, partyUnlocked, partyMode, onTogglePartyMode }) {
  const t = T(lang);
  const { user, profile, loading, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [acct, setAcct] = useState(false);

  // Arriving from a password-reset mail must land on the "choose a new
  // password" screen instead of silently dropping you on the homepage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = window.location.hash || "";
    const q = window.location.search || "";
    if (h.includes("type=recovery") || q.includes("type=recovery")) setOpen(true);
  }, []);

  useEffect(() => {
    if (!_authBus) return;
    const h = () => setOpen(true);
    _authBus.addEventListener("open", h);
    return () => _authBus.removeEventListener("open", h);
  }, []);

  const shadow = "drop-shadow(2px 2px 0 " + th.sh2.split(" ").slice(3).join(" ") + ")";
  const btnBase = {
    fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, cursor: "pointer",
    border: th.bdr, padding: "6px 10px", filter: shadow,
    transition: "filter .1s, transform .1s",
  };
  const press = {
    onMouseDown: (e) => { e.currentTarget.style.transform = "translate(1px,1px)"; },
    onMouseUp: (e) => { e.currentTarget.style.transform = "none"; },
    onMouseLeave: (e) => { e.currentTarget.style.transform = "none"; },
  };

  if (loading) return null;

  if (user) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={() => setAcct(true)} title={user.email} {...press}
          style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: th.blk,
                   background: "none", border: "none", cursor: "pointer", padding: "4px 4px",
                   display: "flex", alignItems: "center", gap: 7,
                   maxWidth: 170, overflow: "hidden" }}>
          <Avatar url={profile?.avatar_url} name={displayName(user, profile)}
            email={user.email} size={26} th={th} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                         textDecoration: "underline", textUnderlineOffset: 3 }}>
            {displayName(user, profile)}
          </span>
        </button>
        <button onClick={() => supabase.auth.signOut()}
          style={{ ...btnBase, background: th.card, color: th.blk }} {...press}>
          {t.signout}
        </button>
        {acct && <AccountModal lang={lang} th={th} user={user} profile={profile}
                   onClose={() => setAcct(false)} onSaved={refreshProfile}
                   partyUnlocked={partyUnlocked} partyMode={partyMode} onTogglePartyMode={onTogglePartyMode} />}
      </div>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ ...btnBase, background: th.org, color: "#fff", fontWeight: 600 }} {...press}>
        {t.signin}
      </button>
      {open && <AuthModal lang={lang} th={th} onClose={() => setOpen(false)} />}
    </>
  );
}

// ---- login / signup modal --------------------------------------------------
// Supabase sends people back from a password-reset mail with the tokens in the
// URL fragment and type=recovery. supabase-js consumes the fragment to create a
// session, but nothing used to notice WHY they arrived — so the link just
// dropped you on the homepage with no way to set a new password.
function isRecoveryLink() {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash || "";
  const query = window.location.search || "";
  return hash.includes("type=recovery") || query.includes("type=recovery");
}

function AuthModal({ lang, th, onClose }) {
  const t = T(lang);
  // "in" = sign in, "up" = create account, "reset" = ask for a reset mail,
  // "newpw" = arrived from a reset link and must choose a new password
  const [mode, setMode] = useState(() => (isRecoveryLink() ? "newpw" : "in"));
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [code2fa, setCode2fa] = useState("");
  const [ticket, setTicket] = useState("");

  // a drag ending on the backdrop must not throw away what was typed; and the
  // page behind the dialog shouldn't scroll while it's open
  const backdrop = useBackdropClose(onClose);
  useScrollLock();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function submit() {
    if (busy) return;
    setErr(""); setMsg(""); setBusy(true);
    try {
      if (mode === "newpw") {
        if (pw.length < 8) throw new Error("Password must be at least 8 characters.");
        if (pw !== pw2) throw new Error("The two passwords don't match.");
        // the recovery link already established a session, so this updates the
        // password of the account that link belonged to
        const { error } = await supabase.auth.updateUser({ password: pw });
        if (error) throw error;
        // drop the tokens out of the address bar once they've been used
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", window.location.pathname);
        }
        setMsg("Password updated — you're signed in.");
        setTimeout(() => { onClose && onClose(); }, 1500);
      } else if (mode === "reset") {
        const resolvedEmail = await resolveEmail(email);
        const { error } = await supabase.auth.resetPasswordForEmail(resolvedEmail, {
          redirectTo: `${window.location.origin}`,
        });
        if (error) throw error;
        setMsg(t.resetSent);
        setTimeout(() => { setMode("in"); setEmail(""); setMsg(""); }, 3000);
      } else if (mode === "up") {
        const actualEmail = email.trim();
        const actualUsername = username.trim() || actualEmail.split("@")[0];

        const { data, error } = await supabase.auth.signUp({
          email: actualEmail,
          password: pw,
          options: { data: { username: actualUsername } },
        });
        if (error) throw error;
        if (data.user && !data.session) {
          const sentTo = data?.user?.email || actualEmail;
          setMsg(t.check);

          // The confirmation link is usually opened on a phone, which leaves this
          // browser sitting on an unconfirmed account. Quietly retry the sign-in
          // until it goes through, so tapping the link on the phone also lands
          // you logged in here. Gives up after five minutes.
          const started = Date.now();
          const poll = setInterval(async () => {
            if (Date.now() - started > 5 * 60_000) { clearInterval(poll); return; }
            const { data: ok } = await supabase.auth.signInWithPassword({
              email: actualEmail, password: pw,
            }).catch(() => ({ data: null }));
            if (ok?.session) { clearInterval(poll); onClose(); }
          }, 4000);
          try {
            const res = await fetch('/api/auth/resend-confirmation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: sentTo, redirectTo: window.location.origin }),
            });
            const info = await res.json().catch(() => ({}));
            // Never leave someone waiting for a mail that was never sent: if the
            // send failed, say so instead of showing "check your inbox".
            if (!res.ok || info.ok === false) {
              setMsg("");
              if (info.info === 'email_exists') {
                setErr("That email is already registered — try signing in instead.");
              } else if (info.info === 'resend_missing' || info.info === 'resend_from_missing') {
                setErr("Your account was created, but confirmation email is not configured yet. Ask the admin to set RESEND_FROM_EMAIL.");
              } else {
                setErr("Your account was created, but the confirmation email could not be sent: " + (info.error || "unknown error"));
              }
            } else if (info.info === 'recovery_sent') {
              setMsg("That email already has an account — we sent a password reset link instead.");
            }
          } catch (e) {
            setMsg("");
            setErr("Your account was created, but the confirmation email could not be sent. Please try again shortly.");
          }
        } else onClose();                                   // confirmation off → logged in
      } else if (mode === "mfa") {
        // second step of sign-in: the password already produced an aal1 session,
        // and this lifts it to aal2. Anything guarded by aal2 stays out of reach
        // until this succeeds — the auth server decides that, not this page.
        const { data: factors, error: fErr } = await supabase.auth.mfa.listFactors();
        if (fErr) throw fErr;
        const totp = (factors?.totp || []).find((f) => f.status === "verified");
        if (!totp) throw new Error("No authenticator is set up for this account.");
        const { error } = await supabase.auth.mfa.challengeAndVerify({
          factorId: totp.id,
          code: code2fa.trim(),
        });
        if (error) throw error;
        onClose();
      } else if (mode === "emailcode") {
        const res = await fetch("/api/auth/login/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticket, code: code2fa.trim() }),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error || "Could not verify the code");
        const { error } = await supabase.auth.setSession(out.session);
        if (error) throw error;
        onClose();
      } else {
        // The server decides which second factor this account needs. For the
        // email factor it deliberately withholds the session until the code is
        // confirmed, so an unverified sign-in never reaches the browser.
        const res = await fetch("/api/auth/login/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: email.trim(), password: pw }),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error || "Invalid login credentials");

        if (out.mfaRequired === "email") {
          setTicket(out.ticket);
          setMode("emailcode");
          setPw("");
          setMsg("We sent a code to your email address.");
          setBusy(false);
          return;
        }

        const { error } = await supabase.auth.setSession(out.session);
        if (error) throw error;

        if (out.mfaRequired === "totp") {
          setMode("mfa");
          setPw("");
          setBusy(false);
          return;
        }
        onClose();
      }
    } catch (e) {
      setErr(friendlyError(e?.message, t));
    } finally {
      setBusy(false);
    }
  }

  const input = {
    width: "100%", boxSizing: "border-box", padding: "9px 10px", marginBottom: 10,
    border: th.bdr, background: th.inputBg, color: th.blk,
    fontFamily: "'IBM Plex Mono',monospace", fontSize: 13,
  };
  const linkBtn = {
    background: "none", border: "none", color: th.org, cursor: "pointer",
    textDecoration: "underline", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, padding: 0,
  };

  return (
    <Portal>
    <div {...backdrop}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)",
               display: "grid", placeItems: "center", zIndex: 1000, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(360px,92vw)", background: th.card, border: th.bdr,
                 boxShadow: th.shd, padding: 22, color: th.blk,
                 fontFamily: "'IBM Plex Mono',monospace", ...scrollPanel }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <strong style={{ fontSize: 16 }}>
            {mode === "emailcode" ? "Check your email"
              : mode === "mfa" ? "Two-factor code"
              : mode === "newpw" ? "Set a new password"
              : mode === "reset" ? t.reset : (mode === "up" ? t.up_ : t.in_)}
          </strong>
          <button onClick={onClose} style={{ ...linkBtn, fontSize: 16, textDecoration: "none" }}>✕</button>
        </div>

        {msg ? (
          <p style={{ fontSize: 13, lineHeight: 1.5, color: th.blk }}>{msg}</p>
        ) : (
          <>
            {mode === "up" && (
              <input value={username} onChange={(e) => setUsername(e.target.value)}
                name="username" placeholder={t.user} autoComplete="username" style={input} maxLength={24} />
            )}
            {(mode === "mfa" || mode === "emailcode") && (
              <>
                <p style={{ fontSize: 11, opacity: .75, margin: "0 0 10px" }}>
                  {mode === "emailcode"
                    ? "Enter the 6-digit code we emailed you. It expires in 10 minutes."
                    : "Enter the 6-digit code from your authenticator app."}
                </p>
                <input value={code2fa} onChange={(e) => setCode2fa(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  name="otp" placeholder="000000" inputMode="numeric" autoComplete="one-time-code"
                  maxLength={6} autoFocus style={{ ...input, letterSpacing: 4, textAlign: "center" }}
                  onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
              </>
            )}
            {mode !== "up" && mode !== "newpw" && mode !== "mfa" && mode !== "emailcode" && (
              <input value={email} onChange={(e) => setEmail(e.target.value)}
                name="emailOrUsername" placeholder={t.emailOrUsername || t.email} type="text" autoComplete="username" style={input} />
            )}
            {mode === "newpw" && (
              <p style={{ fontSize: 11, opacity: .75, margin: "0 0 10px" }}>
                Choose a new password for your account.
              </p>
            )}
            {mode === "up" && (
              <input value={email} onChange={(e) => setEmail(e.target.value)}
                name="email" placeholder={t.email} type="email" autoComplete="email" style={input} />
            )}
            {mode !== "reset" && mode !== "mfa" && mode !== "emailcode" && (
              <input value={pw} onChange={(e) => setPw(e.target.value)}
                name="password" placeholder={t.pass} type="password"
                autoComplete={mode === "up" || mode === "newpw" ? "new-password" : "current-password"} style={input}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
            )}
            {mode === "newpw" && (
              <input value={pw2} onChange={(e) => setPw2(e.target.value)}
                name="password2" placeholder="Repeat new password" type="password"
                autoComplete="new-password" style={input}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
            )}

            {err && <p style={{ color: "var(--sv-accent)", fontSize: 11, margin: "2px 0 10px" }}>{err}</p>}

            <button onClick={submit} disabled={busy}
              style={{ width: "100%", padding: 10, background: th.org, color: "#fff",
                       border: th.bdr, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
                       fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, fontWeight: 600 }}>
              {busy ? "…" : ((mode === "mfa" || mode === "emailcode") ? "Verify"
                : mode === "newpw" ? "Save new password"
                : mode === "reset" ? t.reset : (mode === "up" ? t.up_ : t.in_))}
            </button>

            <div style={{ textAlign: "center", marginTop: 12 }}>
              {mode === "in" ? (
                <>
                  <div>
                    <button style={linkBtn}
                      onClick={() => { setErr(""); setMode("up"); }}>
                      {t.toUp}
                    </button>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <button style={linkBtn}
                      onClick={() => { setErr(""); setEmail(""); setMode("reset"); }}>
                      {t.forgot}
                    </button>
                  </div>
                </>
              ) : mode === "up" ? (
                <button style={linkBtn}
                  onClick={() => { setErr(""); setMode("in"); }}>
                  {t.toIn}
                </button>
              ) : (
                <button style={linkBtn}
                  onClick={() => { setErr(""); setMode("in"); }}>
                  {t.toIn}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
    </Portal>
  );
}

// ---- account modal (change username + sign out) ----------------------------
const CROP_VIEW = 220;   // on-screen size of the round crop window

/** Pick the visible part of a picture — drag to move, slider to zoom. */
function AvatarCropper({ file, th, onCancel, onConfirm, busy }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  const url = useRef("");
  if (!url.current && file) url.current = URL.createObjectURL(file);
  useEffect(() => () => { if (url.current) URL.revokeObjectURL(url.current); }, []);

  const start = (px, py) => { drag.current = { px, py, ...offset }; };
  const move = (px, py) => {
    if (!drag.current) return;
    setOffset({
      x: drag.current.x + (px - drag.current.px),
      y: drag.current.y + (py - drag.current.py),
    });
  };
  const stop = () => { drag.current = null; };

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        onMouseDown={(e) => start(e.clientX, e.clientY)}
        onMouseMove={(e) => move(e.clientX, e.clientY)}
        onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={(e) => start(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); }}
        onTouchEnd={stop}
        style={{ width: CROP_VIEW, height: CROP_VIEW, margin: "0 auto 10px",
                 borderRadius: "50%", overflow: "hidden", position: "relative",
                 border: th.bdr, cursor: "grab", touchAction: "none",
                 background: "#000" }}>
        <img src={url.current} alt="" draggable={false}
          style={{ position: "absolute", left: "50%", top: "50%",
                   transform: `translate(-50%,-50%) translate(${offset.x}px,${offset.y}px) scale(${zoom})`,
                   // "cover": the short side fills the circle, same rule the
                   // export uses so what you see is what gets saved
                   minWidth: "100%", minHeight: "100%",
                   objectFit: "cover", userSelect: "none", pointerEvents: "none" }} />
      </div>

      <input type="range" min="1" max="3" step="0.01" value={zoom}
        onChange={(e) => setZoom(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: th.org, marginBottom: 8 }} />

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onConfirm({ zoom, offset, viewport: CROP_VIEW })}
          disabled={busy}
          style={{ flex: 1, padding: 9, background: th.org, color: "#fff", border: th.bdr,
                   cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
                   fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>
          {busy ? "…" : "Use this"}
        </button>
        <button onClick={onCancel} disabled={busy}
          style={{ padding: "9px 14px", background: th.card, color: th.blk, border: th.bdr,
                   cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>
          Cancel
        </button>
      </div>
      <p style={{ fontSize: 10, opacity: .6, margin: "6px 0 0", textAlign: "center" }}>
        Drag to move · slider to zoom
      </p>
    </div>
  );
}

/** Round avatar with an initials fallback, used in the header and the dialog. */
export function Avatar({ url, name, email, size = 32, th }) {
  const [broken, setBroken] = useState(false);
  const show = url && !broken;
  return (
    <span
      title={name || email || ""}
      style={{
        width: size, height: size, borderRadius: "50%", overflow: "hidden",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: show ? "transparent" : (th?.org || "var(--sv-accent)"),
        color: "#fff", fontSize: Math.round(size * 0.4), fontWeight: 700,
        fontFamily: "'IBM Plex Mono',monospace", flexShrink: 0,
        border: `2px solid ${th?.blk || "#e8e4d8"}`, lineHeight: 1,
      }}>
      {show
        ? <img src={url} alt="" onError={() => setBroken(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        : initialsFor(name, email)}
    </span>
  );
}

function AccountModal({ lang, th, user, profile, onClose, onSaved, partyUnlocked, partyMode, onTogglePartyMode }) {
  const backdrop = useBackdropClose(onClose);
  useScrollLock();
  const t = T(lang);
  const at = AT(lang);
  const current = displayName(user, profile);
  const [username, setUsername] = useState(current);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [twofa, setTwofa] = useState(false);
  const [setup2fa, setSetup2fa] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code2fa, setCode2fa] = useState("");
  const [verify2faBusy, setVerify2faBusy] = useState(false);
  const [factorId, setFactorId] = useState("");
  const [emailTwofa, setEmailTwofa] = useState(false);
  const [otpauth, setOtpauth] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const fileRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [appearance, setAppearance] = useState(loadAppearance);

  function updateAppearance(patch) {
    setAppearance((prev) => {
      const next = { ...prev, ...patch };
      saveAppearance(next);      // writes to storage AND applies it immediately
      return next;
    });
  }

  useEffect(() => {
    // 2FA now lives in Supabase's own MFA system, so ask it which factors the
    // account actually has instead of trusting a flag in our profiles table.
    supabase.from("profiles").select("email_2fa_enabled, avatar_url").eq("id", user.id).single()
      .then(({ data }) => {
        setEmailTwofa(!!data?.email_2fa_enabled);
        setAvatarUrl(data?.avatar_url || "");
      })
      .catch(() => {});
    supabase.auth.mfa.listFactors()
      .then(({ data }) => {
        const verified = (data?.totp || []).find((f) => f.status === "verified");
        setTwofa(!!verified);
        setFactorId(verified?.id || "");
      })
      .catch(() => {});
  }, [user.id]);

  function pickAvatar(e) {
    const file = e.target.files?.[0];
    e.target.value = "";              // let the same file be chosen again later
    if (!file) return;
    setErr(""); setMsg("");
    setPendingFile(file);             // opens the crop view
  }

  async function confirmCrop(crop) {
    setErr(""); setAvatarBusy(true);
    try {
      const url = await uploadAvatar(pendingFile, user.id, crop);
      setAvatarUrl(url);
      setPendingFile(null);
      setMsg(at.updated);
      onSaved && onSaved();
    } catch (e2) {
      setErr(e2?.message || at.uerr);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function dropAvatar() {
    setErr(""); setAvatarBusy(true);
    try {
      await clearAvatar(user.id);
      setAvatarUrl("");
      setMsg(at.updated);
      onSaved && onSaved();
    } catch (e2) {
      setErr(e2?.message || at.uerr);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function toggleEmail2fa(next) {
    setErr(""); setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const res = await fetch("/api/auth/email2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: next }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || at.uerr);
      setEmailTwofa(out.enabled);
      setMsg(at.updated);
    } catch (e) {
      setErr(e?.message || at.uerr);
    } finally {
      setBusy(false);
    }
  }

  async function initiate2fa() {
    setErr(""); setBusy(true);
    try {
      // clear out any half-finished enrolment from an earlier attempt, otherwise
      // Supabase refuses with "factor already exists"
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of (existing?.totp || [])) {
        if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "SoftwareVault " + Date.now(),
      });
      if (error) throw error;

      setFactorId(data.id);
      setQrCode(data.totp.qr_code);   // Supabase returns a ready-made SVG data URI
      setSecret(data.totp.secret);    // shown for manual entry
      setOtpauth(data.totp.uri);      // lets a phone hand it to its authenticator
      setSetup2fa(true);
    } catch (e) {
      setErr(e?.message || at.uerr);
    } finally {
      setBusy(false);
    }
  }

  async function verify2fa() {
    if (!code2fa || code2fa.length !== 6) return;
    setErr(""); setVerify2faBusy(true);
    try {
      // proves the authenticator works AND lifts this session to aal2
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: code2fa,
      });
      if (error) throw error;
      setMsg(at.updated);
      setTwofa(true);
      setSetup2fa(false);
      setCode2fa("");
      setSecret("");
      setQrCode("");
    } catch (e) {
      setErr(e?.message || "Invalid code");
    } finally {
      setVerify2faBusy(false);
    }
  }

  async function disable2fa() {
    if (!confirm("Disable 2FA?")) return;
    setErr(""); setBusy(true);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      for (const f of (data?.totp || [])) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
        if (error) throw error;
      }
      setMsg(at.updated);
      setTwofa(false);
      setFactorId("");
    } catch (e) {
      setErr(e?.message || at.uerr);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const name = username.trim();
    if (!name || busy) return;
    if (name === current) { setMsg(at.updated); return; }
    setErr(""); setMsg(""); setBusy(true);
    try {
      const { error } = await supabase.from("profiles")
        .upsert({ id: user.id, username: name }, { onConflict: "id" });
      if (error) {
        if (error.code === "23505" || /duplicate|unique/i.test(error.message || "")) {
          setErr(at.taken); setBusy(false); return;
        }
        throw error;
      }
      await supabase.auth.updateUser({ data: { username: name } }).catch(() => {});
      setMsg(at.updated);
      onSaved && onSaved();
    } catch (e) {
      setErr(at.uerr);
    } finally {
      setBusy(false);
    }
  }

  const input = {
    width: "100%", boxSizing: "border-box", padding: "9px 10px", marginBottom: 6,
    border: th.bdr, background: th.inputBg, color: th.blk,
    fontFamily: "'IBM Plex Mono',monospace", fontSize: 13,
  };
  const linkBtn = {
    background: "none", border: "none", color: th.org, cursor: "pointer",
    textDecoration: "underline", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, padding: 0,
  };
  const label = { fontSize: 11, color: th.blk, opacity: 0.7, margin: "0 0 4px" };

  return (
    <Portal>
    <div {...backdrop}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)",
               display: "grid", placeItems: "center", zIndex: 1000, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(360px,92vw)", background: th.card, border: th.bdr,
                 boxShadow: th.shd, padding: 22, color: th.blk,
                 fontFamily: "'IBM Plex Mono',monospace", ...scrollPanel }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                      marginBottom: 14, position: "sticky", top: -22, zIndex: 2,
                      background: th.card, paddingTop: 4, paddingBottom: 8 }}>
          <strong style={{ fontSize: 16 }}>{at.account}</strong>
          <button onClick={onClose} style={{ ...linkBtn, fontSize: 16, textDecoration: "none" }}>✕</button>
        </div>

        {pendingFile && (
          <AvatarCropper file={pendingFile} th={th} busy={avatarBusy}
            onCancel={() => setPendingFile(null)} onConfirm={confirmCrop} />
        )}

        {/* profile header: picture, name, address */}
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
          <button onClick={() => fileRef.current?.click()} disabled={avatarBusy}
            title="Change picture"
            style={{ background: "none", border: "none", padding: 0,
                     cursor: avatarBusy ? "default" : "pointer", opacity: avatarBusy ? 0.5 : 1,
                     position: "relative" }}>
            <Avatar url={avatarUrl} name={username} email={user.email} size={64} th={th} />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {username || user.email}
            </div>
            <div style={{ fontSize: 11, opacity: 0.7, overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.email}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button onClick={() => fileRef.current?.click()} disabled={avatarBusy}
                style={linkBtn}>
                {avatarBusy ? "…" : (avatarUrl ? "Change picture" : "Add picture")}
              </button>
              {avatarUrl && (
                <button onClick={dropAvatar} disabled={avatarBusy} style={linkBtn}>
                  Remove
                </button>
              )}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={pickAvatar} style={{ display: "none" }} />
        </div>
        <p style={{ fontSize: 10, opacity: .6, margin: "-8px 0 14px" }}>
          Square-cropped and scaled to 256px in your browser before uploading.
        </p>

        <p style={label}>{t.user}</p>
        <input value={username} onChange={(e) => { setUsername(e.target.value); setErr(""); setMsg(""); }}
          placeholder={t.user} autoComplete="username" maxLength={24} style={input}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }} />

        {err && <p style={{ color: "var(--sv-accent)", fontSize: 11, margin: "2px 0 8px" }}>{err}</p>}
        {msg && <p style={{ color: th.org, fontSize: 11, margin: "2px 0 8px" }}>{msg}</p>}

        <button onClick={save} disabled={busy}
          style={{ width: "100%", padding: 10, marginTop: 4, background: th.org, color: "#fff",
                   border: th.bdr, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
                   fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, fontWeight: 600 }}>
          {busy ? "…" : at.save}
        </button>

        <div style={{ height: 1, background: th.blk, opacity: 0.15, margin: "16px 0" }} />

        {/* 2FA Section */}
        <div>
          <p style={{ ...label, marginBottom: 8 }}>{at.twofa}</p>
          {setup2fa ? (
            <div style={{ fontSize: 12, marginBottom: 12 }}>
              {qrCode && (
                <div style={{ marginBottom: 10, textAlign: "center" }}>
                  <img src={qrCode} alt="QR" style={{ width: 150, height: 150 }} />
                </div>
              )}
              <p style={{ fontSize: 11, marginBottom: 6 }}>{at.scan}</p>

              {/* On a phone you can't scan the screen you're reading, so offer
                  the two things that do work there: hand the code straight to an
                  installed authenticator, or copy the secret and type it in. */}
              {otpauth && (
                <a href={otpauth}
                  style={{ display: "block", textAlign: "center", padding: 9, marginBottom: 8,
                           background: th.card, color: th.blk, border: th.bdr,
                           textDecoration: "none", fontSize: 12 }}>
                  Open in authenticator app
                </a>
              )}
              {secret && (
                <div style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 10, opacity: .7, margin: "0 0 4px" }}>
                    …or enter this key manually:
                  </p>
                  <div style={{ display: "flex", gap: 6 }}>
                    <code style={{ flex: 1, padding: "7px 8px", background: th.inputBg,
                                   border: th.bdr, fontSize: 11, wordBreak: "break-all" }}>
                      {secret}
                    </code>
                    <button onClick={() => {
                        navigator.clipboard?.writeText(secret)
                          .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })
                          .catch(() => {});
                      }}
                      style={{ padding: "7px 10px", background: th.card, color: th.blk,
                               border: th.bdr, cursor: "pointer", fontSize: 11 }}>
                      {copied ? "✓" : "Copy"}
                    </button>
                  </div>
                </div>
              )}
              <input value={code2fa} onChange={(e) => setCode2fa(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000" maxLength={6} style={input} />
              <button onClick={verify2fa} disabled={verify2faBusy || code2fa.length !== 6}
                style={{ width: "100%", padding: 8, background: th.org, color: "#fff",
                         border: th.bdr, cursor: "pointer", opacity: verify2faBusy ? 0.6 : 1,
                         fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>
                {verify2faBusy ? "…" : at.verify}
              </button>
              <button onClick={() => setSetup2fa(false)} style={linkBtn}>Cancel</button>
            </div>
          ) : emailTwofa ? (
            <>
              <p style={{ fontSize: 11, opacity: .75, margin: "0 0 8px" }}>
                Codes are emailed to you when you sign in.
              </p>
              <button onClick={() => toggleEmail2fa(false)} disabled={busy}
                style={{ width: "100%", padding: 10, background: "var(--sv-accent)", color: "#fff",
                         border: th.bdr, cursor: "pointer", opacity: busy ? 0.6 : 1,
                         fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>
                {busy ? "…" : "Turn off email codes"}
              </button>
            </>
          ) : twofa ? (
            <button onClick={disable2fa} disabled={busy}
              style={{ width: "100%", padding: 10, background: "var(--sv-accent)", color: "#fff",
                       border: th.bdr, cursor: "pointer", opacity: busy ? 0.6 : 1,
                       fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>
              {at.disable2fa}
            </button>
          ) : (
            <>
              <button onClick={initiate2fa} disabled={busy}
                style={{ width: "100%", padding: 10, background: th.org, color: "#fff",
                         border: th.bdr, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
                         fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>
                {busy ? "…" : at.enable2fa + " (app)"}
              </button>
              <button onClick={() => toggleEmail2fa(true)} disabled={busy}
                style={{ width: "100%", padding: 10, marginTop: 8, background: th.card,
                         color: th.blk, border: th.bdr, cursor: busy ? "default" : "pointer",
                         opacity: busy ? 0.6 : 1, fontFamily: "'IBM Plex Mono',monospace",
                         fontSize: 12 }}>
                {busy ? "…" : "Email me a code instead"}
              </button>
              <p style={{ fontSize: 10, opacity: .6, margin: "8px 0 0", lineHeight: 1.5 }}>
                The app option is checked by the login server itself. Email codes are
                checked by this website — more convenient, slightly weaker.
              </p>
            </>
          )}
        </div>

        {user && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ height: 1, background: th.blk, opacity: 0.15, margin: "16px 0" }} />
            <p style={{ ...label, marginBottom: 8 }}>Party mode</p>
            {partyUnlocked ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button onClick={() => onTogglePartyMode(!partyMode)}
                  style={{ padding: 10, background: partyMode ? "#ec4899" : th.card, color: partyMode ? "#fff" : th.blk,
                           border: th.bdr, cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12,
                           fontWeight: 600, minWidth: 172 }}>
                  {partyMode ? "Disable party mode" : "Enable party mode"}
                </button>
                <span style={{ fontSize: 11, color: th.mut, opacity: 0.85 }}>
                  {partyMode ? "Party mode is active." : "Party mode unlocked — enable it anytime."}
                </span>
              </div>
            ) : (
              <p style={{ fontSize: 11, color: th.mut, margin: 0 }}>
                Find party mode once while logged in to unlock this setting.
              </p>
            )}
          </div>
        )}

        <div style={{ height: 1, background: th.blk, opacity: 0.15, margin: "16px 0" }} />

        {/* Appearance — every option here is actually applied (lib/appearance.js) */}
        <div>
          <p style={{ ...label, marginBottom: 8 }}>Appearance</p>

          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11, marginBottom: 4 }}>Corners</p>
            <select value={appearance.corners}
              onChange={(e) => updateAppearance({ corners: e.target.value })}
              style={{ ...input, marginBottom: 0, background: th.inputBg }}>
              <option value="edgy">Edgy (square)</option>
              <option value="smooth">Smooth (rounded)</option>
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11, marginBottom: 4 }}>Accent colour</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {ACCENTS.map((a) => (
                <button key={a.id} title={a.name}
                  onClick={() => updateAppearance({ accent: a.id })}
                  style={{ width: 28, height: 28, background: a.id, cursor: "pointer",
                           border: appearance.accent === a.id
                             ? `3px solid ${th.blk}` : "1px solid rgba(0,0,0,.3)" }} />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11, marginBottom: 4 }}>Text size</p>
            <select value={appearance.textSize}
              onChange={(e) => updateAppearance({ textSize: e.target.value })}
              style={{ ...input, marginBottom: 0, background: th.inputBg }}>
              <option value="small">Small</option>
              <option value="normal">Normal</option>
              <option value="large">Large</option>
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11, marginBottom: 4 }}>Density</p>
            <select value={appearance.density}
              onChange={(e) => updateAppearance({ density: e.target.value })}
              style={{ ...input, marginBottom: 0, background: th.inputBg }}>
              <option value="normal">Normal</option>
              <option value="compact">Compact</option>
            </select>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12,
                          cursor: "pointer", marginBottom: 4 }}>
            <input type="checkbox" checked={appearance.motion === "reduced"}
              onChange={(e) => updateAppearance({ motion: e.target.checked ? "reduced" : "full" })}
              style={{ width: 14, height: 14, cursor: "pointer", accentColor: th.org }} />
            Reduce animations
          </label>
          <p style={{ fontSize: 10, opacity: .6, margin: "0 0 4px", lineHeight: 1.5 }}>
            Calms the glitch effects and party mode. Your device's own
            "reduce motion" setting is respected automatically.
          </p>

          <button onClick={() => updateAppearance({ corners: "edgy", accent: "#e03d0c",
                                                   textSize: "normal", motion: "full",
                                                   density: "normal" })}
            style={{ ...linkBtn, marginTop: 4 }}>
            Reset appearance
          </button>
        </div>

        <div style={{ height: 1, background: th.blk, opacity: 0.15, margin: "16px 0" }} />
        <button onClick={() => supabase.auth.signOut()}
          style={{ width: "100%", padding: 10, background: th.card, color: th.blk,
                   border: th.bdr, cursor: "pointer",
                   fontFamily: "'IBM Plex Mono',monospace", fontSize: 13 }}>
          {t.signout}
        </button>
      </div>
    </div>
    </Portal>
  );
}
