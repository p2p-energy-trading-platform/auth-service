import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { TemporaryTokenStore } from '../../infrastructure/redis/temporary-token-store.js';
import type { UserRepository, RegisteredUser } from '../users/repository.js';

interface VerifyEmailChangeInput {
  token: string;
}

interface EmailChangeTokenPayload {
  userId: string;
  newEmail: string;
}

export class VerifyEmailChangeUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly temporaryTokenStore: TemporaryTokenStore,
  ) {}

  async execute(input: VerifyEmailChangeInput): Promise<RegisteredUser> {
    if (!input.token) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Verification token is required');
    }

    const storedPayload = await this.temporaryTokenStore.get('email-verification', input.token);

    if (!storedPayload) {
      throw new AppError(
        ErrorCodes.INVALID_ARGUMENT,
        'Invalid or expired email verification token',
      );
    }

    let payload: EmailChangeTokenPayload;

    try {
      payload = JSON.parse(storedPayload) as EmailChangeTokenPayload;
    } catch {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Invalid email verification token');
    }

    if (!payload.userId || !payload.newEmail) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Invalid email verification token');
    }

    const normalizedEmail = payload.newEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Invalid email verification token');
    }

    const user = await this.userRepo.findById(payload.userId);

    if (!user) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'User not found');
    }

    const existingUser = await this.userRepo.findByEmail(normalizedEmail);

    if (existingUser && existingUser.id !== payload.userId) {
      throw new AppError(ErrorCodes.CONFLICT, 'Email address is already in use');
    }

    try {
      const updatedUser = await this.userRepo.updateEmail(payload.userId, normalizedEmail);

      if (!updatedUser) {
        throw new AppError(ErrorCodes.INTERNAL, 'Failed to update email address');
      }

      await this.temporaryTokenStore.delete('email-verification', input.token);

      return updatedUser;
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new AppError(ErrorCodes.CONFLICT, 'Email address is already in use');
      }

      throw error;
    }
  }
}
