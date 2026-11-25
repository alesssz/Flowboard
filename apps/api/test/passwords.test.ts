// Password hashing: what a stored hash accepts and refuses, and when it is due for a rehash.
import { randomBytes, scryptSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashPassword, needsRehash, verifyPassword } from '../src/auth/passwords.ts';

const password = 'correct horse battery staple';

// A hash made with weaker parameters than today's, as an older release would have stored it.
function legacyHash(secret: string) {
  const salt = randomBytes(16);
  const key = scryptSync(secret, salt, 32, { N: 2 ** 10, r: 8, p: 1 });
  const b64 = (bytes: Buffer) => bytes.toString('base64').replace(/=+$/, '');
  return `$scrypt$ln=10,r=8,p=1$${b64(salt)}$${b64(key)}`;
}

describe('password hashing', () => {
  it('stores a PHC string with the parameters, never the password', async () => {
    const stored = await hashPassword(password);

    expect(stored).toMatch(/^\$scrypt\$ln=14,r=8,p=5\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/);
    expect(stored).not.toContain(password);
  });

  it('verifies the password it hashed, and refuses any other', async () => {
    const stored = await hashPassword(password);

    expect(await verifyPassword(password, stored)).toBe(true);
    expect(await verifyPassword('correct horse battery stapler', stored)).toBe(false);
    expect(await verifyPassword('Correct horse battery staple', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('gives the same password a different hash each time', async () => {
    expect(await hashPassword(password)).not.toBe(await hashPassword(password));
  });

  it('matches an accented password however its accents are encoded', async () => {
    const stored = await hashPassword('café au lait'); // é as one code point

    expect(await verifyPassword('café au lait', stored)).toBe(true); // e + combining accent
  });

  it('verifies a hash made with other parameters, and marks it for a rehash', async () => {
    const stored = legacyHash(password);

    expect(await verifyPassword(password, stored)).toBe(true);
    expect(needsRehash(stored)).toBe(true);
    expect(needsRehash(await hashPassword(password))).toBe(false);
  });

  it.each([
    ['empty', ''],
    ['not a PHC string', password],
    ['another algorithm', '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g'],
    ['an empty key', '$scrypt$ln=14,r=8,p=5$c2FsdHNhbHRzYWx0c2FsdA$A'],
    ['a cost past the cap', '$scrypt$ln=30,r=8,p=5$c2FsdHNhbHRzYWx0c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g'],
  ])('refuses a stored hash that is %s, without throwing', async (_scenario, stored) => {
    expect(await verifyPassword(password, stored)).toBe(false);
    expect(needsRehash(stored)).toBe(true);
  });

  it('refuses a hash whose key was altered', async () => {
    const stored = await hashPassword(password);
    // The key's first character: the last one also carries padding bits, which decoding drops.
    const at = stored.lastIndexOf('$') + 1;
    const altered = stored.slice(0, at) + (stored[at] === 'A' ? 'B' : 'A') + stored.slice(at + 1);

    expect(await verifyPassword(password, altered)).toBe(false);
  });
});
