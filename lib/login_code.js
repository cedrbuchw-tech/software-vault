// lib/login_code.js — the one-time code emailed for two-step verification.
//
// Six characters from a deliberately reduced alphabet: digits 2-9 and A-Z
// without I, L and O. Everything that looks like something else on a phone
// screen (0/O, 1/I/L) is simply not in there, so a code can't be misread into a
// different valid code. That leaves 31 symbols, so 31^6 is about 888 million
// combinations, against five attempts inside a ten minute window.
//
// Both ends of the check import this, so the alphabet and the tidy-up rule can
// never drift apart between the route that sends a code and the route that
// verifies it.

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
 * What gets hashed, on both sides.
 *
 * People retype these out of a mail client, so lower case, stray spaces and the
 * dash some of them add in the middle are all forgiven. Anything else is
 * dropped rather than silently changing the code's length.
 */
export function normalizeLoginCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashLoginCode(value) {
  return crypto.createHash("sha256").update(normalizeLoginCode(value)).digest("hex");
}
