import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { PasswordHasher } from '../../infrastructure/crypto/password-hasher.js';
import type { SessionRepository } from '../sessions/repository.js';
import type { UserRepository } from '../users/repository.js';

interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResult {
  success: boolean;
}

export class ChangePasswordUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessionRepo: SessionRepository,
  ) {}

  async execute(input: ChangePasswordInput): Promise<ChangePasswordResult> {
    if (!input.userId) {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Authenticated user is required');
    }

    if (!input.currentPassword || !input.newPassword) {
      throw new AppError(
        ErrorCodes.INVALID_ARGUMENT,
        'Current password and new password are required',
      );
    }

    if (input.newPassword.length < 8) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Password must be at least 8 characters');
    }

    const currentPasswordHash = await this.userRepo.findPasswordHashById(input.userId);

    if (!currentPasswordHash) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'User credentials not found');
    }

    const currentPasswordValid = await this.passwordHasher.verify(
      currentPasswordHash,
      input.currentPassword,
    );

    if (!currentPasswordValid) {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Current password is incorrect');
    }

    const newPasswordHash = await this.passwordHasher.hash(input.newPassword);

    const updated = await this.userRepo.updatePasswordHash(input.userId, newPasswordHash);

    if (!updated) {
      throw new AppError(ErrorCodes.INTERNAL, 'Failed to update password');
    }

    await this.sessionRepo.revokeAllByUserId(input.userId);

    return {
      success: true,
    };
  }
}
