import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import { hashOpaqueToken } from '../../infrastructure/crypto/token-hasher.js';
import type { SessionRepository } from '../sessions/repository.js';

interface LogoutInput {
  refreshToken: string;
}

export interface LogoutResult {
  success: boolean;
}

export class LogoutUseCase {
  constructor(private readonly sessionRepo: SessionRepository) {}

  async execute(input: LogoutInput): Promise<LogoutResult> {
    if (!input.refreshToken) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Refresh token is required');
    }

    const refreshTokenHash = hashOpaqueToken(input.refreshToken);

    await this.sessionRepo.revokeByRefreshTokenHash(refreshTokenHash);

    return {
      success: true,
    };
  }
}
