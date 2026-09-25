import { describe, it, expect, beforeAll } from 'vitest';
import { generateKeyPair, jwtVerify } from 'jose';

import { JwtSigner, type AccessTokenClaims } from './jwt-signer.js';
import type { KeyProvider } from './key-provider.js';

describe('JwtSigner', () => {
  const ISSUER = 'https://auth.gridx.io';
  const AUDIENCE = 'gridx-services';
  const TTL_SECONDS = 3600; // 1 hour
  const KEY_ID = 'test-key-2026-01';

  let publicKey: CryptoKey;
  let privateKey: CryptoKey;
  let mockKeyProvider: KeyProvider;

  beforeAll(async () => {
    // Generate a real Ed25519 key pair for cryptographic validation
    const keyPair = await generateKeyPair('EdDSA');
    publicKey = keyPair.publicKey;
    privateKey = keyPair.privateKey;

    mockKeyProvider = {
      keyId: KEY_ID,
      privateKey,
      publicKey,
    } as unknown as KeyProvider;
  });

  it('should sign a valid JWT token with correct header and claims', async () => {
    const signer = new JwtSigner(mockKeyProvider, ISSUER, AUDIENCE, TTL_SECONDS);

    const claims: AccessTokenClaims = {
      sub: 'usr_12345',
      scope: ['read:energy', 'write:energy'],
      roles: ['prosumer'],
    };

    const token = await signer.signAccessToken(claims);

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // Standard JWT header.payload.signature format

    // Verify token cryptographic signature, issuer, and audience using jose
    const { payload, protectedHeader } = await jwtVerify(token, publicKey, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    expect(protectedHeader).toEqual({
      alg: 'EdDSA',
      kid: KEY_ID,
      typ: 'JWT',
    });

    // Verify Standard & Custom Claims
    expect(payload.sub).toBe('usr_12345');
    expect(payload.iss).toBe(ISSUER);
    expect(payload.aud).toBe(AUDIENCE);
    expect(payload.typ).toBe('access');
    expect(payload.ver).toBe(1);
    expect(payload.scope).toEqual(['read:energy', 'write:energy']);
    expect(payload.roles).toEqual(['prosumer']);
  });

  it('should set correct issuedAt (iat) and expiration (exp) timestamps based on ttlSeconds', async () => {
    const signer = new JwtSigner(mockKeyProvider, ISSUER, AUDIENCE, TTL_SECONDS);

    const token = await signer.signAccessToken({ sub: 'usr_99999' });

    const { payload } = await jwtVerify(token, publicKey, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();

    expect(payload.exp! - payload.iat!).toBe(TTL_SECONDS);
  });

  it('should support additional arbitrary custom claims in payload', async () => {
    const signer = new JwtSigner(mockKeyProvider, ISSUER, AUDIENCE, TTL_SECONDS);

    const claims: AccessTokenClaims = {
      sub: 'usr_custom',
      tenantId: 'tenant_abc',
      isVerified: true,
    };

    const token = await signer.signAccessToken(claims);

    const { payload } = await jwtVerify(token, publicKey, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    expect(payload.tenantId).toBe('tenant_abc');
    expect(payload.isVerified).toBe(true);
  });
});
