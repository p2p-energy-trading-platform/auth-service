import { describe, expect, it, vi } from 'vitest';

import type { FileStorage } from '../../infrastructure/storage/provider.js';
import { CreateKycUploadUrlUseCase } from './create-kyc-upload-url.js';
import type { KycSubmission } from './repository.js';

function setup(currentState?: KycSubmission['state']) {
  const kyc = {
    findByUserId: vi
      .fn<() => Promise<Pick<KycSubmission, 'state'> | null>>()
      .mockResolvedValue(currentState ? { state: currentState } : null),
  };

  const storage = {
    createUploadUrl: vi
      .fn<FileStorage['createUploadUrl']>()
      .mockResolvedValue('http://localhost:9000/signed-url'),
    getObjectInfo: vi.fn<FileStorage['getObjectInfo']>(),
  };

  return { kyc, storage, useCase: new CreateKycUploadUrlUseCase(kyc as never, storage) };
}

describe('CreateKycUploadUrlUseCase', () => {
  it.each([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['application/pdf', 'pdf'],
  ])('returns a signed URL and a key under the user folder for %s', async (contentType, ext) => {
    const { storage, useCase } = setup();

    const result = await useCase.execute({ userId: 'user-123', contentType, sizeBytes: 2048 });

    expect(result.uploadUrl).toBe('http://localhost:9000/signed-url');
    expect(result.expiresIn).toBe(300);
    expect(result.objectKey).toMatch(new RegExp(`^kyc/user-123/[0-9a-f-]{36}\\.${ext}$`));
    expect(storage.createUploadUrl).toHaveBeenCalledWith({
      key: result.objectKey,
      contentType,
      sizeBytes: 2048,
      expiresInSeconds: 300,
    });
  });

  it('creates a different key for every upload', async () => {
    const { useCase } = setup();
    const input = { userId: 'user-123', contentType: 'image/png', sizeBytes: 2048 };

    const first = await useCase.execute(input);
    const second = await useCase.execute(input);

    expect(first.objectKey).not.toBe(second.objectKey);
  });

  it('requires an authenticated user', async () => {
    const { storage, useCase } = setup();

    await expect(
      useCase.execute({ userId: '', contentType: 'image/png', sizeBytes: 2048 }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });

    expect(storage.createUploadUrl).not.toHaveBeenCalled();
  });

  it.each([
    ['an unsupported type', 'text/html', 2048],
    ['an empty file', 'image/png', 0],
    ['a file over 10 MB', 'image/jpeg', 10 * 1024 * 1024 + 1],
    ['a fractional size', 'image/png', 1.5],
  ])('rejects %s', async (_case, contentType, sizeBytes) => {
    const { storage, useCase } = setup();

    await expect(
      useCase.execute({ userId: 'user-123', contentType, sizeBytes }),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
      message: 'ID document must be a JPEG, PNG or PDF file of up to 10 MB',
    });

    expect(storage.createUploadUrl).not.toHaveBeenCalled();
  });

  it('does not create an upload URL once KYC is verified', async () => {
    const { storage, useCase } = setup('VERIFIED');

    await expect(
      useCase.execute({ userId: 'user-123', contentType: 'image/png', sizeBytes: 2048 }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(storage.createUploadUrl).not.toHaveBeenCalled();
  });
});
