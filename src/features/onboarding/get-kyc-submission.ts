import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { KycRepository } from './repository.js';

export interface GetKycSubmissionInput {
  userId: string;
}

export class GetKycSubmissionUseCase {
  constructor(private readonly kyc: KycRepository) {}

  async execute(input: GetKycSubmissionInput) {
    if (!input.userId) {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Authenticated user is required');
    }

    return this.kyc.findByUserId(input.userId);
  }
}
