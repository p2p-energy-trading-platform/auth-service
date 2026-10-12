import { randomUUID } from 'node:crypto';
import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { FileStorage } from '../../infrastructure/storage/provider.js';
import {
  KYC_DOCUMENT_EXTENSIONS,
  isAllowedKycDocument,
  kycDocumentKeyPrefix,
} from './kyc-documents.js';
import type { KycRepository } from './repository.js';
import { assertValidOnboardingTransition } from './state.js';

export const KYC_UPLOAD_URL_TTL_SECONDS = 300;

export interface CreateKycUploadUrlInput {
  userId: string;
  contentType: string;
  sizeBytes: number;
}

export interface CreateKycUploadUrlResult {
  uploadUrl: string;
  objectKey: string;
  expiresIn: number;
}

export class CreateKycUploadUrlUseCase {
  constructor(
    private readonly kyc: KycRepository,
    private readonly storage: FileStorage,
  ) {}

  async execute(input: CreateKycUploadUrlInput): Promise<CreateKycUploadUrlResult> {
    if (!input.userId) {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Authenticated user is required');
    }

    const contentType = input.contentType.trim().toLowerCase();

    if (!isAllowedKycDocument(contentType, input.sizeBytes)) {
      throw new AppError(
        ErrorCodes.INVALID_ARGUMENT,
        'ID document must be a JPEG, PNG or PDF file of up to 10 MB',
      );
    }

    const currentSubmission = await this.kyc.findByUserId(input.userId);
    assertValidOnboardingTransition(currentSubmission?.state ?? 'NOT_REQUIRED', 'PENDING');

    const objectKey = `${kycDocumentKeyPrefix(input.userId)}${randomUUID()}.${KYC_DOCUMENT_EXTENSIONS[contentType]}`;

    const uploadUrl = await this.storage.createUploadUrl({
      key: objectKey,
      contentType,
      sizeBytes: input.sizeBytes,
      expiresInSeconds: KYC_UPLOAD_URL_TTL_SECONDS,
    });

    return { uploadUrl, objectKey, expiresIn: KYC_UPLOAD_URL_TTL_SECONDS };
  }
}
