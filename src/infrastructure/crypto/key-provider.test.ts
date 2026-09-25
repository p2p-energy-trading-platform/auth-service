import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { generateKeyPair, exportPKCS8, exportSPKI } from 'jose';

import { KeyProvider } from './key-provider.js';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn<(path: string, encoding?: string) => Promise<string>>(),
}));

describe('KeyProvider', () => {
  const KEY_ID = 'dev-key-2026';
  const PRIVATE_KEY_PATH = '/secrets/auth-private.pem';
  const PUBLIC_KEY_PATH = '/secrets/auth-public.pem';

  let validPrivatePem: string;
  let validPublicPem: string;

  beforeAll(async () => {
    // Generate real Ed25519 keys in PKCS#8 and SPKI format for testing
    const keyPair = await generateKeyPair('EdDSA', { extractable: true });
    validPrivatePem = await exportPKCS8(keyPair.privateKey);
    validPublicPem = await exportSPKI(keyPair.publicKey);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully load PEM files and construct KeyProvider with JWK metadata', async () => {
    vi.mocked(readFile).mockImplementation(async (path) => {
      if (path === PRIVATE_KEY_PATH) return validPrivatePem;
      if (path === PUBLIC_KEY_PATH) return validPublicPem;
      throw new Error(`Unexpected file path: ${String(path)}`);
    });

    const provider = await KeyProvider.fromFiles({
      privateKeyPath: PRIVATE_KEY_PATH,
      publicKeyPath: PUBLIC_KEY_PATH,
      keyId: KEY_ID,
    });

    expect(readFile).toHaveBeenCalledWith(PRIVATE_KEY_PATH, 'utf8');
    expect(readFile).toHaveBeenCalledWith(PUBLIC_KEY_PATH, 'utf8');

    expect(provider.keyId).toBe(KEY_ID);
    expect(provider.privateKey).toBeDefined();
    expect(provider.publicKey).toBeDefined();

    expect(provider.publicJwk).toMatchObject({
      kid: KEY_ID,
      alg: 'EdDSA',
      use: 'sig',
      key_ops: ['verify'],
      kty: 'OKP',
      crv: 'Ed25519',
    });
    expect(provider.publicJwk.x).toBeDefined();
  });

  it('should throw an error if reading key files from disk fails', async () => {
    vi.mocked(readFile).mockRejectedValueOnce(new Error('ENOENT: no such file or directory'));

    await expect(
      KeyProvider.fromFiles({
        privateKeyPath: PRIVATE_KEY_PATH,
        publicKeyPath: PUBLIC_KEY_PATH,
        keyId: KEY_ID,
      }),
    ).rejects.toThrow('ENOENT: no such file or directory');
  });

  it('should throw an error if the PEM content is invalid or corrupted', async () => {
    vi.mocked(readFile).mockResolvedValue('-----BEGIN INVALID KEY-----');

    await expect(
      KeyProvider.fromFiles({
        privateKeyPath: PRIVATE_KEY_PATH,
        publicKeyPath: PUBLIC_KEY_PATH,
        keyId: KEY_ID,
      }),
    ).rejects.toThrow('"pkcs8" must be PKCS#8 formatted string');
  });
});
