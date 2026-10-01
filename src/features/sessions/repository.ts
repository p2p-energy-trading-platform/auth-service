import type { DbClient } from '../../infrastructure/database/client.js';

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
  constructor(private readonly db: DbClient) {}

  async create(params: CreateSessionParams): Promise<Session> {
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

    return session;
  }

  async findActiveByRefreshTokenHash(refreshTokenHash: string): Promise<Session | null> {
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

    return session ?? null;
  }

  async revokeByRefreshTokenHash(refreshTokenHash: string): Promise<boolean> {
    const result = await this.db`
      UPDATE sessions
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE refresh_token_hash = ${refreshTokenHash}
        AND revoked_at IS NULL;
    `;

    return result.count > 0;
  }
}
