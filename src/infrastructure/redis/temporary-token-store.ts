import { randomBytes } from 'node:crypto';

import type { RedisClient } from './client.js';
import { temporaryTokenKey, type TemporaryTokenPurpose } from './keys.js';
import { hashOpaqueToken } from '../crypto/token-hasher.js';

export interface TemporaryTokenStore {
  create(purpose: TemporaryTokenPurpose, payload: string, ttlSeconds: number): Promise<string>;

  get(purpose: TemporaryTokenPurpose, token: string): Promise<string | null>;

  consume(purpose: TemporaryTokenPurpose, token: string): Promise<string | null>;

  delete(purpose: TemporaryTokenPurpose, token: string): Promise<void>;
}

export class RedisTemporaryTokenStore implements TemporaryTokenStore {
  constructor(private readonly redis: RedisClient) {}

  async create(
    purpose: TemporaryTokenPurpose,
    payload: string,
    ttlSeconds: number,
  ): Promise<string> {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error('Temporary token TTL must be a positive integer');
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashOpaqueToken(token);
    const key = temporaryTokenKey(purpose, tokenHash);

    await this.redis.set(key, payload, {
      EX: ttlSeconds,
    });

    return token;
  }

  async get(purpose: TemporaryTokenPurpose, token: string): Promise<string | null> {
    const tokenHash = hashOpaqueToken(token);
    const key = temporaryTokenKey(purpose, tokenHash);

    return this.redis.get(key);
  }

  async consume(purpose: TemporaryTokenPurpose, token: string): Promise<string | null> {
    const tokenHash = hashOpaqueToken(token);
    const key = temporaryTokenKey(purpose, tokenHash);

    return this.redis.getDel(key);
  }

  async delete(purpose: TemporaryTokenPurpose, token: string): Promise<void> {
    const tokenHash = hashOpaqueToken(token);
    const key = temporaryTokenKey(purpose, tokenHash);

    await this.redis.del(key);
  }
}
