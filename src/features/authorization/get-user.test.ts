import { describe, expect, it, vi } from 'vitest';
import { KycState } from '@p2p-energy-trading-platform/typescript-sdk/gen/gridx/auth/v1/auth_pb';
import { GetUseCase } from './get-user.js';
import type { AuthenticatedUser } from '../users/repository.js';

const createUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  id: 'user-123',
  email: 'user@example.com',
  status: 'ACTIVE',
  role: 'user',
  passwordHash: 'test-password-hash',
  name: 'Test User',
  createdAt: new Date('2026-10-05T13:02:47.452Z'),
  ...overrides,
});

const createUserRepo = (user: AuthenticatedUser | null) => ({
  findById: vi.fn<(userId: string) => Promise<AuthenticatedUser | null>>().mockResolvedValue(user),
});

const createKycRepo = (submission: { state: string } | null) => ({
  findByUserId: vi
    .fn<(userId: string) => Promise<{ state: string } | null>>()
    .mockResolvedValue(submission),
});

describe('GetUseCase', () => {
  it('returns user details and pending KYC state for a valid user', async () => {
    const userRepo = createUserRepo(createUser());
    const kycRepo = createKycRepo({ state: 'PENDING' });
    const useCase = new GetUseCase(userRepo as any, kycRepo as any);

    const result = await useCase.execute({ userId: 'user-123' });

    expect(result).toEqual({
      id: 'user-123',
      email: 'user@example.com',
      status: 'ACTIVE',
      role: 'user',
      name: 'Test User',
      kycState: KycState.PENDING,
    });
    expect(userRepo.findById).toHaveBeenCalledWith('user-123');
    expect(kycRepo.findByUserId).toHaveBeenCalledWith('user-123');
  });

  it.each([
    { databaseState: 'VERIFIED', expectedState: KycState.VERIFIED },
    { databaseState: 'REJECTED', expectedState: KycState.REJECTED },
  ])('maps $databaseState KYC state correctly', async ({ databaseState, expectedState }) => {
    const userRepo = createUserRepo(createUser());
    const kycRepo = createKycRepo({ state: databaseState });
    const useCase = new GetUseCase(userRepo as any, kycRepo as any);

    const result = await useCase.execute({ userId: 'user-123' });

    expect(result.kycState).toBe(expectedState);
  });

  it('returns UNSPECIFIED when the user has no KYC submission', async () => {
    const userRepo = createUserRepo(createUser());
    const kycRepo = createKycRepo(null);
    const useCase = new GetUseCase(userRepo as any, kycRepo as any);

    const result = await useCase.execute({ userId: 'user-123' });

    expect(result.kycState).toBe(KycState.UNSPECIFIED);
    expect(kycRepo.findByUserId).toHaveBeenCalledWith('user-123');
  });

  it('throws INVALID_ARGUMENT when userId is missing', async () => {
    const userRepo = createUserRepo(null);
    const kycRepo = createKycRepo(null);
    const useCase = new GetUseCase(userRepo as any, kycRepo as any);

    await expect(useCase.execute({ userId: '' })).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
    expect(userRepo.findById).not.toHaveBeenCalled();
    expect(kycRepo.findByUserId).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND when the user does not exist', async () => {
    const userRepo = createUserRepo(null);
    const kycRepo = createKycRepo(null);
    const useCase = new GetUseCase(userRepo as any, kycRepo as any);

    await expect(useCase.execute({ userId: 'user-123' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(kycRepo.findByUserId).not.toHaveBeenCalled();
  });

  it('returns null when user name is not set', async () => {
    const userRepo = createUserRepo(createUser({ name: null }));
    const kycRepo = createKycRepo(null);
    const useCase = new GetUseCase(userRepo as any, kycRepo as any);

    const result = await useCase.execute({ userId: 'user-123' });

    expect(result.name).toBeNull();
    expect(result.kycState).toBe(KycState.UNSPECIFIED);
  });
});
