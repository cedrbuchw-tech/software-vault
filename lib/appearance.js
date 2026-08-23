"use client";

// Appearance settings that actually take effect.
//
// The old settings block wrote "brightness" and "buttonStyle" into localStorage
// and stopped there — nothing ever read them, so choosing "Smooth (rounded)"
// changed precisely nothing. Everything here is applied to <html> as data
// attributes and CSS variables, and global.css reacts to those, so a change is
// visible immediately and survives a reload.
//
// Appearance belongs to an ACCOUNT, not to the browser. It used to live under
// one global key, so signing out left the last user's accent colour, rounded
// buttons and font sitting on the page for whoever came next. Each account now
// has its own slot and a signed-out visitor always sees the site defaults.

const LEGACY_KEY = "vault_appearance";
const keyFor = (userId) => `vault_appearance:${userId}`;

export const APPEARANCE_DEFAULTS = {
  corners: "edgy",      // edgy | smooth
  accent: "#e03d0c",    // brand orange
  textSize: "normal",   // small | normal | large
  motion: "full",       // full | reduced
  density: "normal",    // normal | compact
  font: "mono",         // mono | sans
  contrast: "normal",   // normal | high
  glitch: "on",         // on | off  — the corruption visuals
};

export const ACCENTS = [
  { id: "#e03d0c", name: "Vault orange" },
  { id: "#c8a84b", name: "Brass" },
  { id: "#16a34a", name: "Green" },
  { id: "#38bdf8", name: "Sky" },
  { id: "#a855f7", name: "Violet" },
  { id: "#f43f5e", name: "Rose" },
];

// Whose settings are in force right now. null = nobody signed in → defaults.
let currentUserId = null;

/**
 * Point the appearance at an account (or at nobody).
 *
 * Called whenever the session changes. Signing in loads that account's saved
 * look, signing out drops straight back to the site defaults — no reload, and
 * nothing of the previous account left behind.
 */
export function setAppearanceScope(userId) {
  const next = userId || null;
  if (next === currentUserId) return;
  currentUserId = next;

  // One-time hand-over: whoever signs in first inherits the settings that were
  // saved back when there was a single shared slot, and the old key is retired.
  if (currentUserId && typeof localStorage !== "undefined") {
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy && !localStorage.getItem(keyFor(currentUserId))) {
        localStorage.setItem(keyFor(currentUserId), legacy);
      }
      if (legacy) localStorage.removeItem(LEGACY_KEY);
    } catch { /* private mode — not worth breaking the page over */ }
  }

  const settings = loadAppearance();
  applyAppearance(settings);
  if (typeof window !== "undefined") {
    // the page builds its colours in JavaScript, so it has to be told to re-read
    window.dispatchEvent(new CustomEvent("vault-appearance", { detail: settings }));
  }
}

export function loadAppearance() {
  if (!currentUserId || typeof localStorage === "undefined") {
    return { ...APPEARANCE_DEFAULTS };
  }
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(currentUserId)) || "{}");
    return { ...APPEARANCE_DEFAULTS, ...raw };
  } catch {
    return { ...APPEARANCE_DEFAULTS };
  }
}

export function saveAppearance(next) {
  if (currentUserId) {
    try {
      localStorage.setItem(keyFor(currentUserId), JSON.stringify(next));
    } catch {
      /* private mode, quota — not worth breaking the page over */
    }
  }
  applyAppearance(next);
  // The page builds its colours in JavaScript (a theme object with hard-coded
  // hex values), so CSS alone can't recolour it. Announce the change and let
  // the page re-read it.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("vault-appearance", { detail: next }));
  }
}

export function applyAppearance(settings) {
  if (typeof document === "undefined") return;
  const s = { ...APPEARANCE_DEFAULTS, ...(settings || {}) };
  const root = document.documentElement;

  root.dataset.corners = s.corners;
  root.dataset.text = s.textSize;
  root.dataset.motion = s.motion;
  root.dataset.density = s.density;
  root.dataset.font = s.font;
  root.dataset.contrast = s.contrast;
  root.dataset.glitch = s.glitch;

  // only accept one of the offered colours — never write an arbitrary string
  // from storage straight into a style property
  const accent = ACCENTS.some((a) => a.id === s.accent)
    ? s.accent : APPEARANCE_DEFAULTS.accent;
  root.style.setProperty("--sv-accent", accent);
}
