import { describe, expect, it, vi } from 'vitest';

import type { FileStorage, StoredObjectInfo } from '../../infrastructure/storage/provider.js';
import type { KycSubmission } from './repository.js';
import { SubmitKycUseCase } from './submit-kyc.js';

const DOCUMENT_KEY = 'kyc/user-123/3f1c2b9e-8d4a-4c5e-9b1a-2e7f6d5c4b3a.pdf';

const validInput = {
  userId: 'user-123',
  fullName: 'Jane Doe',
  dateOfBirth: '1990-01-01',
  nicNumber: '199000112345',
  documentPath: DOCUMENT_KEY,
};

function savedSubmission(): KycSubmission {
  return {
    id: 'kyc-123',
    userId: 'user-123',
    fullName: 'Jane Doe',
    dateOfBirth: '1990-01-01',
    nicNumber: '199000112345',
    documentPath: DOCUMENT_KEY,
    state: 'PENDING',
    rejectionReason: null,
    verifiedAt: null,
    createdAt: new Date('2026-10-05T00:00:00.000Z'),
    updatedAt: new Date('2026-10-05T00:00:00.000Z'),
  };
}

function setup(
  options: {
    currentState?: KycSubmission['state'];
    document?: StoredObjectInfo | null;
  } = {},
) {
  const kyc = {
    findByUserId: vi
      .fn<() => Promise<Pick<KycSubmission, 'state'> | null>>()
      .mockResolvedValue(options.currentState ? { state: options.currentState } : null),
    saveSubmission: vi
      .fn<() => Promise<KycSubmission | null>>()
      .mockResolvedValue(savedSubmission()),
  };

  const storage = {
    createUploadUrl: vi.fn<FileStorage['createUploadUrl']>(),
    getObjectInfo: vi
      .fn<FileStorage['getObjectInfo']>()
      .mockResolvedValue(
        options.document === undefined
          ? { sizeBytes: 2048, contentType: 'application/pdf' }
          : options.document,
      ),
    getObjectBytes: vi.fn<FileStorage['getObjectBytes']>(),
  };

  return { kyc, storage, useCase: new SubmitKycUseCase(kyc as never, storage) };
}

describe('SubmitKycUseCase', () => {
  it('stores the KYC details and moves onboarding to pending', async () => {
    const { kyc, storage, useCase } = setup();

    await expect(
      useCase.execute({
        ...validInput,
        fullName: ' Jane Doe ',
        nicNumber: ' 199000112345 ',
        documentPath: ` ${DOCUMENT_KEY} `,
      }),
    ).resolves.toMatchObject({ state: 'PENDING' });

    expect(storage.getObjectInfo).toHaveBeenCalledWith(DOCUMENT_KEY);
    expect(kyc.saveSubmission).toHaveBeenCalledWith(validInput);
  });

  it('does not allow resubmission after verification', async () => {
    const { kyc, useCase } = setup({ currentState: 'VERIFIED' });

    await expect(useCase.execute(validInput)).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(kyc.saveSubmission).not.toHaveBeenCalled();
  });

  it('rejects an invalid date of birth', async () => {
    const { kyc, useCase } = setup();

    await expect(
      useCase.execute({ ...validInput, dateOfBirth: '1990-02-30' }),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
      message: 'Date of birth must be a valid YYYY-MM-DD date',
    });

    expect(kyc.findByUserId).not.toHaveBeenCalled();
  });

  it.each([
    ['another user', 'kyc/user-999/3f1c2b9e-8d4a-4c5e-9b1a-2e7f6d5c4b3a.pdf'],
    ['a path outside the KYC folder', 'uploads/document.pdf'],
    ['a path traversal', 'kyc/user-123/../user-999/3f1c2b9e-8d4a-4c5e-9b1a-2e7f6d5c4b3a.pdf'],
    ['an unexpected file extension', 'kyc/user-123/3f1c2b9e-8d4a-4c5e-9b1a-2e7f6d5c4b3a.exe'],
  ])('rejects a document key from %s', async (_case, documentPath) => {
    const { kyc, storage, useCase } = setup();

    await expect(useCase.execute({ ...validInput, documentPath })).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
      message: 'ID document is invalid',
    });

    expect(storage.getObjectInfo).not.toHaveBeenCalled();
    expect(kyc.saveSubmission).not.toHaveBeenCalled();
  });

  it('rejects a document that was never uploaded', async () => {
    const { kyc, useCase } = setup({ document: null });

    await expect(useCase.execute(validInput)).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
      message: 'ID document upload was not found. Please upload it again',
    });

    expect(kyc.saveSubmission).not.toHaveBeenCalled();
  });

  it.each([
    ['an unsupported file type', { sizeBytes: 2048, contentType: 'text/html' }],
    ['an empty file', { sizeBytes: 0, contentType: 'image/png' }],
    ['a file over 10 MB', { sizeBytes: 10 * 1024 * 1024 + 1, contentType: 'image/jpeg' }],
  ])('rejects %s', async (_case, document) => {
    const { kyc, useCase } = setup({ document });

    await expect(useCase.execute(validInput)).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
      message: 'ID document must be a JPEG, PNG or PDF file of up to 10 MB',
    });

    expect(kyc.saveSubmission).not.toHaveBeenCalled();
  });
});
