import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { PasswordHasher } from '../../infrastructure/crypto/password-hasher.js';
import type { TemporaryTokenStore } from '../../infrastructure/redis/temporary-token-store.js';
import type { SessionRepository } from '../sessions/repository.js';
import type { UserRepository } from '../users/repository.js';

interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export interface ResetPasswordResult {
  success: boolean;
}

export class ResetPasswordUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly temporaryTokenStore: TemporaryTokenStore,
    private readonly sessionRepo: SessionRepository,
  ) {}

  async execute(input: ResetPasswordInput): Promise<ResetPasswordResult> {
    if (!input.token || !input.newPassword) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Reset token and new password are required');
    }

    if (input.newPassword.length < 8) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Password must be at least 8 characters');
    }

    const userId = await this.temporaryTokenStore.consume('password-reset', input.token);

    if (!userId) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Invalid or expired password reset token');
    }

    const passwordHash = await this.passwordHasher.hash(input.newPassword);

    const updated = await this.userRepo.updatePasswordHash(userId, passwordHash);

    if (!updated) {
      throw new AppError(ErrorCodes.INTERNAL, 'Failed to update password');
    }

    await this.sessionRepo.revokeAllByUserId(userId);

    return {
      success: true,
    };
  }
}
