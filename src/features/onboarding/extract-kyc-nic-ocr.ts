import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { FileStorage } from '../../infrastructure/storage/provider.js';
import {
  isAllowedKycDocument,
  isOwnKycDocumentKey,
  KYC_DOCUMENT_MAX_BYTES,
} from './kyc-documents.js';
import { extractNicOcrText } from './nic-ocr-engine.js';
import { parseSriLankanNicOcrText } from './nic-ocr.js';

export interface ExtractKycNicOcrInput {
  userId: string;
  objectKey: string;
}

export type NicOcrTextExtractor = (bytes: Uint8Array, contentType: string) => Promise<string>;

function invalidDocument(): AppError {
  return new AppError(
    ErrorCodes.INVALID_ARGUMENT,
    'ID document must be a valid JPEG, PNG or PDF file of up to 10 MB.',
    400,
  );
}

export class ExtractKycNicOcrUseCase {
  constructor(
    private readonly storage: FileStorage,
    private readonly extractText: NicOcrTextExtractor = extractNicOcrText,
  ) {}

  async execute(input: ExtractKycNicOcrInput) {
    const userId = input.userId.trim();
    const objectKey = input.objectKey.trim();

    if (!userId) {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Authenticated user is required.', 401);
    }

    if (!objectKey) {
      throw invalidDocument();
    }

    if (!isOwnKycDocumentKey(userId, objectKey)) {
      const belongsToAnotherUser =
        objectKey.startsWith('kyc/') && !objectKey.startsWith(`kyc/${userId}/`);

      throw new AppError(
        belongsToAnotherUser ? ErrorCodes.FORBIDDEN : ErrorCodes.INVALID_ARGUMENT,
        'ID document is invalid or not accessible.',
        belongsToAnotherUser ? 403 : 400,
      );
    }

    const info = await this.storage.getObjectInfo(objectKey);

    if (!info) {
      throw new AppError(
        ErrorCodes.NOT_FOUND,
        'Uploaded ID document was not found. Please upload it again.',
        404,
      );
    }

    if (!isAllowedKycDocument(info.contentType, info.sizeBytes)) {
      throw invalidDocument();
    }

    const bytes = await this.storage.getObjectBytes(objectKey, KYC_DOCUMENT_MAX_BYTES);

    if (!bytes) {
      throw new AppError(
        ErrorCodes.NOT_FOUND,
        'Uploaded ID document was not found. Please upload it again.',
        404,
      );
    }

    if (
      bytes.byteLength === 0 ||
      bytes.byteLength > KYC_DOCUMENT_MAX_BYTES ||
      bytes.byteLength !== info.sizeBytes
    ) {
      throw invalidDocument();
    }

    const text = await this.extractText(bytes, info.contentType);

    return parseSriLankanNicOcrText(text);
  }
}
