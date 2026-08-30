"use client";

// Appearance settings, applied to <html> as data attributes and CSS variables
// that global.css reacts to. Stored per account, not per browser.

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
  glitch: "on",         // on | off (corruption visuals)
};

export const ACCENTS = [
  { id: "#e03d0c", name: "Vault orange" },
  { id: "#c8a84b", name: "Brass" },
  { id: "#16a34a", name: "Green" },
  { id: "#38bdf8", name: "Sky" },
  { id: "#a855f7", name: "Violet" },
  { id: "#f43f5e", name: "Rose" },
];

// Whose settings are in force. null = nobody signed in, so defaults apply.
let currentUserId = null;

/** Point the appearance at an account, or at nobody. Call on session change. */
export function setAppearanceScope(userId) {
  const next = userId || null;
  if (next === currentUserId) return;
  currentUserId = next;

  // One-time hand-over from the old shared key to the first account to sign in.
  if (currentUserId && typeof localStorage !== "undefined") {
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy && !localStorage.getItem(keyFor(currentUserId))) {
        localStorage.setItem(keyFor(currentUserId), legacy);
      }
      if (legacy) localStorage.removeItem(LEGACY_KEY);
    } catch { /* private mode; ignore */ }
  }

  const settings = loadAppearance();
  applyAppearance(settings);
  if (typeof window !== "undefined") {
    // the page builds its colours in JS, so it has to be told to re-read them
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
      /* private mode or quota; ignore */
    }
  }
  applyAppearance(next);
  // Colours are built in JS from a theme object, so CSS alone cannot recolour
  // the page; announce the change and let it re-read.
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

  // only accept an offered colour; never write an arbitrary stored string
  // into a style property
  const accent = ACCENTS.some((a) => a.id === s.accent)
    ? s.accent : APPEARANCE_DEFAULTS.accent;
  root.style.setProperty("--sv-accent", accent);
}
