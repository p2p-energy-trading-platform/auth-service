import { SignJWT } from 'jose';

import type { KeyProvider } from './key-provider.js';

export interface AccessTokenClaims {
  sub: string;
  scope?: string[];
  roles?: string[];
  [key: string]: unknown;
}

export class JwtSigner {
  constructor(
    private readonly keys: KeyProvider,
    private readonly issuer: string,
    private readonly audience: string,
    private readonly ttlSeconds: number,
  ) {}

  async signAccessToken(claims: AccessTokenClaims): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    return new SignJWT({
      ...claims,
      typ: 'access',
      ver: 1,
    })
      .setProtectedHeader({
        alg: 'EdDSA',
        kid: this.keys.keyId,
        typ: 'JWT',
      })
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt(now)
      .setExpirationTime(now + this.ttlSeconds)
      .setSubject(claims.sub)
      .sign(this.keys.privateKey);
  }
}
