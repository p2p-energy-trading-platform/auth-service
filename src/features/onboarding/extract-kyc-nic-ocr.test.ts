import { describe, expect, it, vi } from 'vitest';

import type { FileStorage } from '../../infrastructure/storage/provider.js';
import { ExtractKycNicOcrUseCase } from './extract-kyc-nic-ocr.js';

const documentKey = `kyc/user-123/${'a'.repeat(8)}-${'b'.repeat(4)}-${'c'.repeat(4)}-${'d'.repeat(4)}-${'e'.repeat(12)}.jpg`;
const imageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);

function setup() {
  const storage = {
    createUploadUrl: vi.fn<FileStorage['createUploadUrl']>(),
    getObjectInfo: vi.fn<FileStorage['getObjectInfo']>().mockResolvedValue({
      sizeBytes: imageBytes.length,
      contentType: 'image/jpeg',
    }),
    getObjectBytes: vi.fn<FileStorage['getObjectBytes']>().mockResolvedValue(imageBytes),
  };

  const ocr = vi.fn<() => Promise<string>>().mockResolvedValue(
    'NIC: 199012012345\nNAME: KUMAR SILVA\nDATE OF BIRTH: 12/01/1990',
  );

  const useCase = new ExtractKycNicOcrUseCase(storage, ocr);

  return { storage, ocr, useCase };
}

describe('ExtractKycNicOcrUseCase', () => {
  it('extracts suggestions from the authenticated user’s uploaded document', async () => {
    const { storage, ocr, useCase } = setup();

    await expect(
      useCase.execute({ userId: 'user-123', objectKey: documentKey }),
    ).resolves.toEqual({
      nicNumber: '199012012345',
      dateOfBirth: '1990-01-12',
      fullName: 'KUMAR SILVA',
    });

    expect(storage.getObjectInfo).toHaveBeenCalledWith(documentKey);
    expect(storage.getObjectBytes).toHaveBeenCalledWith(
      documentKey,
      10 * 1024 * 1024,
    );
    expect(ocr).toHaveBeenCalledWith(imageBytes, 'image/jpeg');
  });

  it('requires an authenticated user', async () => {
    const { storage, useCase } = setup();

    await expect(
      useCase.execute({ userId: '', objectKey: documentKey }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });

    expect(storage.getObjectInfo).not.toHaveBeenCalled();
  });

  it('rejects another user’s object key before accessing storage', async () => {
    const { storage, useCase } = setup();

    await expect(
      useCase.execute({
        userId: 'user-123',
        objectKey: documentKey.replace('user-123', 'user-456'),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(storage.getObjectInfo).not.toHaveBeenCalled();
  });

  it('rejects keys that do not match the generated KYC document format', async () => {
    const { storage, useCase } = setup();

    await expect(
      useCase.execute({
        userId: 'user-123',
        objectKey: 'kyc/user-123/../../other.jpg',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

    expect(storage.getObjectInfo).not.toHaveBeenCalled();
  });

  it('rejects a missing uploaded object', async () => {
    const { storage, useCase } = setup();
    storage.getObjectInfo.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId: 'user-123', objectKey: documentKey }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(storage.getObjectBytes).not.toHaveBeenCalled();
  });

  it('rejects unsupported stored content types before reading bytes', async () => {
    const { storage, useCase } = setup();
    storage.getObjectInfo.mockResolvedValue({
      sizeBytes: imageBytes.length,
      contentType: 'text/html',
    });

    await expect(
      useCase.execute({ userId: 'user-123', objectKey: documentKey }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

    expect(storage.getObjectBytes).not.toHaveBeenCalled();
  });

  it('rejects empty or oversized stored objects before reading bytes', async () => {
    const { storage, useCase } = setup();

    for (const sizeBytes of [0, 10 * 1024 * 1024 + 1]) {
      storage.getObjectInfo.mockResolvedValue({
        sizeBytes,
        contentType: 'image/jpeg',
      });

      await expect(
        useCase.execute({ userId: 'user-123', objectKey: documentKey }),
      ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    }

    expect(storage.getObjectBytes).not.toHaveBeenCalled();
  });

  it('rejects an object that disappears before its bytes are read', async () => {
    const { storage, useCase } = setup();
    storage.getObjectBytes.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId: 'user-123', objectKey: documentKey }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
