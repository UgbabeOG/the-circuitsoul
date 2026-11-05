import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decryptCloudCredentials,
  encryptCloudCredentials
} from './encryption';

test('cloud credentials decrypt with the matching IV and reject tampering', () => {
  const originalKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  process.env.CREDENTIAL_ENCRYPTION_KEY = 'test-encryption-key-for-cloud-credentials';

  try {
    const plaintext = JSON.stringify({ accessKeyId: 'test-key', secretAccessKey: 'test-secret' });
    const encrypted = encryptCloudCredentials(plaintext);
    assert.equal(
      decryptCloudCredentials(encrypted.credentialsEncrypted, encrypted.credentialsIv),
      plaintext
    );

    const combined = Buffer.from(encrypted.credentialsEncrypted, 'base64url');
    combined[combined.length - 1] ^= 1;
    assert.throws(() =>
      decryptCloudCredentials(combined.toString('base64url'), encrypted.credentialsIv)
    );

    const mismatchedIv = Buffer.alloc(16, 1).toString('base64url');
    assert.throws(() =>
      decryptCloudCredentials(encrypted.credentialsEncrypted, mismatchedIv),
      /IV does not match/
    );
  } finally {
    if (originalKey === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    else process.env.CREDENTIAL_ENCRYPTION_KEY = originalKey;
  }
});
