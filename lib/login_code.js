// One-time code emailed for two-step verification. The alphabet omits 0/O and
// 1/I/L so a misread code can't be another valid one; sender and verifier
// share this module so the alphabet and normalisation can't drift apart.

import crypto from "crypto";

export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 6;

/** A fresh code. crypto.randomInt is unbiased, unlike Math.random % n. */
export function generateLoginCode() {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Canonical form hashed on both sides: uppercased, non-alphanumerics dropped,
 * so codes retyped with spaces or a dash still match.
 */
export function normalizeLoginCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashLoginCode(value) {
  return crypto.createHash("sha256").update(normalizeLoginCode(value)).digest("hex");
}
