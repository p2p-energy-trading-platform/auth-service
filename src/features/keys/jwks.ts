import type { JWK } from 'jose';

export interface JwksResponse {
  keys: JWK[];
}
