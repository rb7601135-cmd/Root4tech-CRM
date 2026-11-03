import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * Verifies password against Django pbkdf2_sha256 or bcrypt hash.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;

  // 1. Django PBKDF2 hash format: pbkdf2_sha256$iterations$salt$hash
  if (storedHash.startsWith('pbkdf2_sha256$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;

    const [, iterationsStr, salt, expectedHash] = parts;
    const iterations = parseInt(iterationsStr, 10);
    if (isNaN(iterations) || iterations <= 0) return false;

    try {
      const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
      const computedHash = derivedKey.toString('base64');
      const bufA = Buffer.from(computedHash);
      const bufB = Buffer.from(expectedHash);
      if (bufA.length !== bufB.length) return false;
      return crypto.timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }

  // 2. Standard bcrypt format
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    try {
      return bcrypt.compareSync(password, storedHash);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Creates Django-compatible pbkdf2_sha256 password hash.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 22);
  const iterations = 720000;
  const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  const hash = derivedKey.toString('base64');
  return `pbkdf2_sha256$${iterations}$${salt}$${hash}`;
}

