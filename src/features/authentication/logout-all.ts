import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { SessionRepository } from '../sessions/repository.js';

interface LogoutAllInput {
  userId: string;
}

export interface LogoutAllResult {
  success: boolean;
}

export class LogoutAllUseCase {
  constructor(private readonly sessionRepo: SessionRepository) {}

  async execute(input: LogoutAllInput): Promise<LogoutAllResult> {
    if (!input.userId) {
      throw new AppError(
        ErrorCodes.UNAUTHENTICATED,
        'Authenticated user is required',
      );
    }

    await this.sessionRepo.revokeAllByUserId(input.userId);

    return {
      success: true,
    };
  }
}
