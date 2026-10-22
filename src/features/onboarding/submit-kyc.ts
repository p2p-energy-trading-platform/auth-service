import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { FileStorage } from '../../infrastructure/storage/provider.js';
import { isAllowedKycDocument, isOwnKycDocumentKey } from './kyc-documents.js';
import { isValidSriLankanNicNumber } from './nic-ocr.js';
import { isIsoDate } from './kyc-helper.js';
import type { KycRepository } from './repository.js';
import { assertValidOnboardingTransition } from './state.js';

export interface SubmitKycInput {
  userId: string;
  fullName: string;
  dateOfBirth: string;
  nicNumber: string;
  documentPath: string;
}

export class SubmitKycUseCase {
  constructor(
    private readonly kyc: KycRepository,
    private readonly storage: FileStorage,
  ) {}

  async execute(input: SubmitKycInput) {
    if (!input.userId) {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Authenticated user is required');
    }

    const fullName = input.fullName.trim();
    const dateOfBirth = input.dateOfBirth.trim();
    const nicNumber = input.nicNumber.trim();
    const documentPath = input.documentPath.trim();

    if (!fullName || !dateOfBirth || !nicNumber || !documentPath) {
      throw new AppError(
        ErrorCodes.INVALID_ARGUMENT,
        'Full name, date of birth, NIC number, and ID document are required',
      );
    }

    if (!isIsoDate(dateOfBirth)) {
      throw new AppError(
        ErrorCodes.INVALID_ARGUMENT,
        'Date of birth must be a valid YYYY-MM-DD date',
      );
    }

    if (fullName.length > 255) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'KYC information exceeds the allowed length');
    }

    if (!isValidSriLankanNicNumber(nicNumber)) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Enter a valid Sri Lankan NIC number');
    }

    if (nicNumber.length > 12) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Enter a valid Sri Lankan NIC number');
    }

    if (!isOwnKycDocumentKey(input.userId, documentPath)) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'ID document is invalid');
    }

    const currentSubmission = await this.kyc.findByUserId(input.userId);
    assertValidOnboardingTransition(currentSubmission?.state ?? 'NOT_REQUIRED', 'PENDING');

    const document = await this.storage.getObjectInfo(documentPath);

    if (!document) {
      throw new AppError(
        ErrorCodes.INVALID_ARGUMENT,
        'ID document upload was not found. Please upload it again',
      );
    }

    if (!isAllowedKycDocument(document.contentType, document.sizeBytes)) {
      throw new AppError(
        ErrorCodes.INVALID_ARGUMENT,
        'ID document must be a JPEG, PNG or PDF file of up to 10 MB',
      );
    }

    const submission = await this.kyc.saveSubmission({
      userId: input.userId,
      fullName,
      dateOfBirth,
      nicNumber,
      documentPath,
    });

    if (!submission) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'User not found');
    }

    return submission;
  }
}
