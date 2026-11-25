// Password hashing with scrypt (node:crypto), stored as a PHC string that carries its own parameters.
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

interface ScryptParams {
  /** log2 of the cost N. */
  ln: number;
  r: number;
  p: number;
}

// One of OWASP's equivalent scrypt settings: the one with the least memory (16 MiB a hash), so that
// sign-ins at the same moment stay within a small server's memory.
const currentParams: ScryptParams = { ln: 14, r: 8, p: 5 };
const saltBytes = 16;
const keyBytes = 32;

const phcPattern = /^\$scrypt\$ln=(\d{1,2}),r=(\d{1,2}),p=(\d{1,2})\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

/** `$scrypt$ln=14,r=8,p=5$<salt>$<hash>`, base64 without padding; a new salt every time. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(saltBytes);
  const key = await derive(password, salt, currentParams, keyBytes);
  const { ln, r, p } = currentParams;
  return `$scrypt$ln=${ln},r=${r},p=${p}$${toBase64(salt)}$${toBase64(key)}`;
}

/** Whether `password` matches `stored`, with the parameters `stored` names; false for a malformed hash. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parse(stored);
  if (parsed === undefined) return false;
  const key = await derive(password, parsed.salt, parsed.params, parsed.key.length);
  return timingSafeEqual(key, parsed.key);
}

/** True when `stored` was made with other parameters than today's: rehash it at the next sign-in. */
export function needsRehash(stored: string): boolean {
  const params = parse(stored)?.params;
  return params === undefined || (Object.keys(currentParams) as (keyof ScryptParams)[]).some((name) => params[name] !== currentParams[name]);
}

function parse(stored: string) {
  const match = phcPattern.exec(stored);
  if (match === null) return undefined;
  const [, ln = '', r = '', p = '', salt = '', key = ''] = match;
  const params = { ln: Number(ln), r: Number(r), p: Number(p) };
  // Beyond these, a tampered row would make one sign-in take seconds or gigabytes.
  if (params.ln < 1 || params.ln > 20 || params.r < 1 || params.r > 32 || params.p < 1 || params.p > 16) return undefined;
  const parsed = { params, salt: Buffer.from(salt, 'base64'), key: Buffer.from(key, 'base64') };
  // A key of a few bytes (or none: "A" decodes to nothing) would match almost any password.
  if (parsed.salt.length < saltBytes || parsed.key.length < keyBytes) return undefined;
  return parsed;
}

function derive(password: string, salt: Buffer, { ln, r, p }: ScryptParams, length: number): Promise<Buffer> {
  const N = 2 ** ln;
  return new Promise((resolve, reject) => {
    // NFKC, so the same password typed on systems that compose accents differently matches.
    // Node's default maxmem (32 MiB) is below what stronger settings need (128 * N * r bytes).
    scrypt(password.normalize('NFKC'), salt, length, { N, r, p, maxmem: 256 * N * r }, (error, key) => {
      if (error === null) resolve(key);
      else reject(error);
    });
  });
}

function toBase64(bytes: Buffer): string {
  return bytes.toString('base64').replace(/=+$/, '');
}
