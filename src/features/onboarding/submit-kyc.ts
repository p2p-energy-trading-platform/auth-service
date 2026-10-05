import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { KycRepository } from './repository.js';
import { assertValidOnboardingTransition } from './state.js';

export interface SubmitKycInput {
  userId: string;
  fullName: string;
  dateOfBirth: string;
  dubaiId: string;
  documentPath: string;
}

export class SubmitKycUseCase {
  constructor(private readonly kyc: KycRepository) {}

  async execute(input: SubmitKycInput) {
    if (!input.userId) {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Authenticated user is required');
    }

    const fullName = input.fullName.trim();
    const dateOfBirth = input.dateOfBirth.trim();
    const dubaiId = input.dubaiId.trim();
    const documentPath = input.documentPath.trim();

    if (!fullName || !dateOfBirth || !dubaiId || !documentPath) {
      throw new AppError(
        ErrorCodes.INVALID_ARGUMENT,
        'Full name, date of birth, Dubai ID, and ID document are required',
      );
    }

    if (!isIsoDate(dateOfBirth)) {
      throw new AppError(
        ErrorCodes.INVALID_ARGUMENT,
        'Date of birth must be a valid YYYY-MM-DD date',
      );
    }

    if (fullName.length > 255 || dubaiId.length > 100) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'KYC information exceeds the allowed length');
    }

    const currentSubmission = await this.kyc.findByUserId(input.userId);
    assertValidOnboardingTransition(currentSubmission?.state ?? 'NOT_REQUIRED', 'PENDING');

    const submission = await this.kyc.saveSubmission({
      userId: input.userId,
      fullName,
      dateOfBirth,
      dubaiId,
      documentPath,
    });

    if (!submission) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'User not found');
    }

    return submission;
  }
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
