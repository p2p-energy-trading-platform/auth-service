import { describe, expect, it, vi } from 'vitest';

import type { KycSubmission } from './repository.js';
import { SubmitKycUseCase } from './submit-kyc.js';

describe('SubmitKycUseCase', () => {
  it('stores the KYC details and moves onboarding to pending', async () => {
    const kyc = {
      findByUserId: vi.fn<() => Promise<KycSubmission | null>>().mockResolvedValue(null),
      saveSubmission: vi.fn<() => Promise<KycSubmission | null>>().mockResolvedValue({
        id: 'kyc-123',
        userId: 'user-123',
        fullName: 'Jane Doe',
        dateOfBirth: '1990-01-01',
        dubaiId: '784-1990-1234567-1',
        documentPath: 'uploads/document.pdf',
        state: 'PENDING',
        rejectionReason: null,
        verifiedAt: null,
        createdAt: new Date('2026-10-05T00:00:00.000Z'),
        updatedAt: new Date('2026-10-05T00:00:00.000Z'),
      }),
    };

    const useCase = new SubmitKycUseCase(kyc as never);

    await expect(
      useCase.execute({
        userId: 'user-123',
        fullName: ' Jane Doe ',
        dateOfBirth: '1990-01-01',
        dubaiId: ' 784-1990-1234567-1 ',
        documentPath: ' uploads/document.pdf ',
      }),
    ).resolves.toMatchObject({ state: 'PENDING' });

    expect(kyc.saveSubmission).toHaveBeenCalledWith({
      userId: 'user-123',
      fullName: 'Jane Doe',
      dateOfBirth: '1990-01-01',
      dubaiId: '784-1990-1234567-1',
      documentPath: 'uploads/document.pdf',
    });
  });

  it('does not allow resubmission after verification', async () => {
    const kyc = {
      findByUserId: vi
        .fn<() => Promise<Pick<KycSubmission, 'state'> | null>>()
        .mockResolvedValue({ state: 'VERIFIED' }),
      saveSubmission: vi.fn<() => Promise<KycSubmission | null>>(),
    };

    const useCase = new SubmitKycUseCase(kyc as never);

    await expect(
      useCase.execute({
        userId: 'user-123',
        fullName: 'Jane Doe',
        dateOfBirth: '1990-01-01',
        dubaiId: '784-1990-1234567-1',
        documentPath: 'uploads/document.pdf',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(kyc.saveSubmission).not.toHaveBeenCalled();
  });

  it('rejects an invalid date of birth', async () => {
    const kyc = {
      findByUserId: vi.fn<() => Promise<KycSubmission | null>>(),
      saveSubmission: vi.fn<() => Promise<KycSubmission | null>>(),
    };

    const useCase = new SubmitKycUseCase(kyc as never);

    await expect(
      useCase.execute({
        userId: 'user-123',
        fullName: 'Jane Doe',
        dateOfBirth: '1990-02-30',
        dubaiId: '784-1990-1234567-1',
        documentPath: 'uploads/document.pdf',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
      message: 'Date of birth must be a valid YYYY-MM-DD date',
    });

    expect(kyc.findByUserId).not.toHaveBeenCalled();
  });
});
