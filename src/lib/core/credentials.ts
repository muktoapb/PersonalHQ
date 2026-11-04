import "server-only";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { hashSecret } from "@/lib/secrets";

// Credential rules shared by setup (settings.ts) and the account flows
// (account.ts): the username format, password strength, and recovery keys.

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, "Username: 3–32 letters, numbers, dots, dashes or underscores.");

export function checkPassword(password: string, username?: string | null): string | null {
  if (password.length < 10) return "Password must be at least 10 characters.";
  if (password.length > 200) return "Password is too long.";
  if (username && password.toLowerCase().includes(username)) return "Password can't contain your username.";
  return null;
}

// ---------- recovery keys ----------

// 25 characters from an unambiguous alphabet (no 0/O, 1/I/L): ~120 bits,
// shown as five groups of five.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newRecoveryKey() {
  const chars = Array.from({ length: 25 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return chars.match(/.{5}/g)!.join("-");
}
// Typed keys may have lowercase letters, spaces or no dashes.
export const normalizeKey = (key: string) => key.toUpperCase().replace(/[^A-Z0-9]/g, "");
export const hashKey = (key: string) => hashSecret(normalizeKey(key));
