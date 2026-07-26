"use client";

// Appearance settings that actually take effect.
//
// The old settings block wrote "brightness" and "buttonStyle" into localStorage
// and stopped there — nothing ever read them, so choosing "Smooth (rounded)"
// changed precisely nothing. Everything here is applied to <html> as data
// attributes and CSS variables, and global.css reacts to those, so a change is
// visible immediately and survives a reload.

const KEY = "vault_appearance";

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

export function loadAppearance() {
  if (typeof localStorage === "undefined") return { ...APPEARANCE_DEFAULTS };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { ...APPEARANCE_DEFAULTS, ...raw };
  } catch {
    return { ...APPEARANCE_DEFAULTS };
  }
}

export function saveAppearance(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode, quota — not worth breaking the page over */
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
