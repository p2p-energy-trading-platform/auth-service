import type { DbClient } from '../../infrastructure/database/client.js';
import type { RedisClient } from '../../infrastructure/redis/client.js';
import { sessionCacheKey } from '../../infrastructure/redis/keys.js';

interface CreateSessionParams {
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
}

export class SessionRepository {
  constructor(
    private readonly db: DbClient,
    private readonly redis: RedisClient,
  ) {}

  private getTtlSeconds(expiresAt: string | Date): number {
    const remainingMs = new Date(expiresAt).getTime() - Date.now();

    return Math.max(1, Math.ceil(remainingMs / 1000));
  }

  async create(params: CreateSessionParams): Promise<Session> {
    // PostgreSQL remains the source of truth.
    const [session] = await this.db<Session[]>`
      INSERT INTO sessions (
        user_id,
        refresh_token_hash,
        expires_at
      )
      VALUES (
        ${params.userId},
        ${params.refreshTokenHash},
        ${params.expiresAt}
      )
      RETURNING
        id,
        user_id AS "userId",
        refresh_token_hash AS "refreshTokenHash",
        expires_at AS "expiresAt",
        revoked_at AS "revokedAt";
    `;

    if (!session) {
      throw new Error('Failed to create session');
    }

    // Cache only after the database write succeeds.
    try {
      await this.redis.set(sessionCacheKey(params.refreshTokenHash), JSON.stringify(session), {
        EX: this.getTtlSeconds(session.expiresAt),
      });
    } catch {
      // Redis is a cache, so a cache failure must not invalidate
      // an otherwise successful database-backed login.
    }

    return session;
  }

  async findActiveByRefreshTokenHash(refreshTokenHash: string): Promise<Session | null> {
    const cacheKey = sessionCacheKey(refreshTokenHash);

    // Fast path: Redis.
    try {
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        const session = JSON.parse(cached) as Session;

        // Redis is not the source of truth. Do not return an
        // obviously expired cached session.
        if (session.revokedAt === null && new Date(session.expiresAt).getTime() > Date.now()) {
          return session;
        }

        await this.redis.del(cacheKey);
      }
    } catch {
      // Fall through to PostgreSQL.
    }

    // PostgreSQL remains the authoritative source.
    const [session] = await this.db<Session[]>`
      SELECT
        id,
        user_id AS "userId",
        refresh_token_hash AS "refreshTokenHash",
        expires_at AS "expiresAt",
        revoked_at AS "revokedAt"
      FROM sessions
      WHERE refresh_token_hash = ${refreshTokenHash}
        AND revoked_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP;
    `;

    if (!session) {
      return null;
    }

    // Repopulate Redis after a cache miss.
    try {
      await this.redis.set(cacheKey, JSON.stringify(session), {
        EX: this.getTtlSeconds(session.expiresAt),
      });
    } catch {
      // Database lookup succeeded; cache failure should not affect
      // the result.
    }

    return session;
  }

  async revokeByRefreshTokenHash(refreshTokenHash: string): Promise<boolean> {
    // Database first: source of truth.
    const result = await this.db`
      UPDATE sessions
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE refresh_token_hash = ${refreshTokenHash}
        AND revoked_at IS NULL;
    `;

    // Remove the cached session after the database is updated.
    try {
      await this.redis.del(sessionCacheKey(refreshTokenHash));
    } catch {
      // The database remains authoritative even if cache deletion fails.
    }

    return result.count > 0;
  }

  async revokeAllByUserId(userId: string): Promise<boolean> {
    // Database first: source of truth.
    const sessions = await this.db<{ refreshTokenHash: string }[]>`
      UPDATE sessions
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE user_id = ${userId}
        AND revoked_at IS NULL
      RETURNING refresh_token_hash AS "refreshTokenHash";
    `;

    // Remove all cached sessions after the database is updated.
    try {
      const cacheKeys = sessions.map((session) => sessionCacheKey(session.refreshTokenHash));

      if (cacheKeys.length > 0) {
        await this.redis.del(cacheKeys);
      }
    } catch {
      // The database remains authoritative even if cache deletion fails.
    }

    return sessions.length > 0;
  }
}
