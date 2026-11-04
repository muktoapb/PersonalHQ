// Reset the dashboard password from the server, for when both the password
// and the recovery key are lost. Having access to this machine is the proof.
//
//   pnpm reset-password
//
// Sets a new password, signs out every device, and clears sign-in lockouts.
// The recovery key is replaced too; the new one is printed once.
import { randomBytes, randomInt, scrypt } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { promisify } from "node:util";
import { createClient } from "@libsql/client";

const scryptAsync = promisify(scrypt);
// Same format as src/lib/secrets.ts.
async function hashSecret(secret) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(secret, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}
// Same scheme as src/lib/core/credentials.ts.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const recoveryKey = () => Array.from({ length: 25 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("").match(/.{5}/g).join("-");

// Reads one line per question; typing is hidden on a terminal. (Line by line
// so piped input works too.)
const rl = createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY });
let muted = false;
const writeOut = rl._writeToOutput?.bind(rl);
if (writeOut) rl._writeToOutput = (text) => { if (!muted) writeOut(text); };
const lines = rl[Symbol.asyncIterator]();
async function ask(question, hidden = false) {
  stdout.write(question);
  muted = hidden && stdin.isTTY;
  const { value } = await lines.next();
  if (muted) stdout.write("\n");
  muted = false;
  return (value ?? "").trim();
}

const db = createClient({
  url: process.env.DATABASE_URL ?? "file:./data/dashboard.db",
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});
const { rows } = await db.execute("select username from settings where id = 1");
if (!rows.length) {
  console.error("This dashboard isn't set up yet — open it in a browser to create your account.");
  process.exit(1);
}
const username = rows[0].username;
console.log(`Resetting the password${username ? ` for "${username}"` : ""}.`);
const password = await ask("New password (10+ characters): ", true);
const confirm = await ask("Confirm: ", true);
rl.close();
if (password.length < 10) {
  console.error("Password must be at least 10 characters.");
  process.exit(1);
}
if (password !== confirm) {
  console.error("Passwords don't match.");
  process.exit(1);
}
if (username && password.toLowerCase().includes(username)) {
  console.error("Password can't contain your username.");
  process.exit(1);
}
const key = recoveryKey();
await db.batch([
  {
    sql: "update settings set password_hash = ?, session_secret = ?, recovery_hash = ?, mcp_token_hash = null where id = 1",
    args: [await hashSecret(password), randomBytes(32).toString("hex"), await hashSecret(key.replace(/-/g, ""))],
  },
  "delete from login_attempts",
  // apps connected by sign-in (OAuth) must approve again
  "delete from oauth_tokens",
  "delete from oauth_codes",
  "delete from oauth_clients",
]);
console.log("\nPassword changed. Every device has been signed out and AI-assistant (MCP) access was revoked, including connected apps.");
console.log(`\nNew recovery key (save it now, it won't be shown again):\n\n  ${key}\n`);
