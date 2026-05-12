import crypto from 'crypto';

/**
 * Generates a cryptographically strong API key.
 * Format: rsk_ + 48 random alphanumeric characters (A-Z, a-z, 0-9)
 * Total length: 52 characters
 */
export function generateStrongAPIKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = crypto.randomBytes(48);
  let key = 'rsk_';
  for (let i = 0; i < 48; i++) {
    key += chars[randomBytes[i] % chars.length];
  }
  return key;
}
