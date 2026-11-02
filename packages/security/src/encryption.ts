import * as crypto from 'crypto';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits

function getEncryptionKey(): Buffer {
  const keyEnv = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!keyEnv) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY environment variable is required for credential encryption');
  }

  // Derive a 32-byte key from the provided string using SHA-256
  return crypto.createHash('sha256').update(keyEnv).digest();
}

/**
 * Encrypts a plaintext credential string using AES-256-GCM.
 * Returns the encrypted data as a base64url-encoded string containing:
 *   base64url(iv + tag + ciphertext)
 */
export function encryptCredential(plaintext: string): { encrypted: string; iv: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine IV + tag + ciphertext for storage
  const combined = Buffer.concat([iv, tag, ciphertext]);
  return {
    encrypted: combined.toString('base64url'),
    iv: iv.toString('base64url')
  };
}

/**
 * Decrypts a credential string that was encrypted with encryptCredential.
 * Expects base64url-encoded combined (iv + tag + ciphertext).
 */
export function decryptCredential(encryptedData: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, 'base64url');

  if (combined.length < 16 + 16) {
    throw new Error('Encrypted credential data is too short');
  }

  const iv = combined.subarray(0, 16);
  const tag = combined.subarray(16, 32);
  const ciphertext = combined.subarray(32);

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

/**
 * Encrypts credentials and returns both the encrypted blob and the IV
 * suitable for storage in CloudEnvironment.credentialsEncrypted and
 * CloudEnvironment.credentialsIv.
 */
export function encryptCloudCredentials(credentialsJson: string): {
  credentialsEncrypted: string;
  credentialsIv: string;
} {
  const result = encryptCredential(credentialsJson);
  return {
    credentialsEncrypted: result.encrypted,
    credentialsIv: result.iv
  };
}

/**
 * Decrypts cloud credentials from stored encrypted + IV fields.
 */
export function decryptCloudCredentials(
  credentialsEncrypted: string,
  credentialsIv: string
): string {
  // Reconstruct the combined format (iv + tag + ciphertext) for decryptCredential
  const iv = Buffer.from(credentialsIv, 'base64url');
  const combined = Buffer.from(credentialsEncrypted, 'base64url');

  // combined = iv (16) + tag (16) + ciphertext
  const tag = combined.subarray(0, 16);
  const ciphertext = combined.subarray(16);

  // Rebuild: iv + tag + ciphertext
  const full = Buffer.concat([iv, tag, ciphertext]);
  return decryptCredential(full.toString('base64url'));
}

export const encryptionKeyId = 'circuitsoul-v1';
