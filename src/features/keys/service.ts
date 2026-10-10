import type { JWK } from 'jose';
import type { JwksResponse } from './jwks.js';
import type { KeyProvider } from '../../infrastructure/crypto/key-provider.js';

export class KeyService {
  constructor(
    private readonly keyProvider: KeyProvider,
    private readonly previousPublicJwks: JWK[] = [],
  ) {}

  getJwks(): JwksResponse {
    return {
      keys: [
        this.keyProvider.publicJwk,
        ...this.previousPublicJwks,
      ],
    };
  }
}
