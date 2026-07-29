import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

// The promisified type omits the options overload, so type it explicitly.
const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: ScryptOptions,
) => Promise<Buffer>;

// scrypt parameters. N is the CPU/memory cost; 16384 keeps a hash well under a
// second while costing an attacker real memory per guess. Stored with the hash
// so these can be raised later without invalidating existing credentials.
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024;

/** Hash a password: scrypt with a fresh random salt. Returns a self-describing string. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM })) as Buffer;
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

/** Verify a password against a stored hash, in constant time. Never throws on bad input. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4] ?? "", "base64");
  const expected = Buffer.from(parts[5] ?? "", "base64");
  if (!n || !r || !p || salt.length === 0 || expected.length === 0) return false;
  try {
    const derived = (await scrypt(password, salt, expected.length, { N: n, r, p, maxmem: MAXMEM })) as Buffer;
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
