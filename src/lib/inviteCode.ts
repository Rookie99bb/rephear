import { randomBytes } from "node:crypto";

// Short, URL-safe, human-typeable invite codes: rephear.com/invite/8JAK32.
// Deliberately excludes visually-ambiguous characters (0/O, 1/I/L) so a
// code read aloud or handwritten is never misheard/mistyped into a
// different valid code.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 8;

export function generateInviteCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}
