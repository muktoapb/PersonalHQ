import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Password / PIN / token hashing (scrypt, random salt).

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(secret, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifySecret(secret: string, stored: string | null | undefined): Promise<boolean> {
  const [algo, salt, hash] = (stored ?? "").split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scryptAsync(secret, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

export const newSecret = (bytes = 32) => randomBytes(bytes).toString("hex");
