import { describe, expect, it, vi } from 'vitest';

import { GetProfileUseCase } from './get-profile.js';

interface MockUser {
  id: string;
  email: string;
  status: string;
  createdAt: string;
}

type FindById = (userId: string) => Promise<MockUser | null>;

describe('GetProfileUseCase', () => {
  it('returns the authenticated user profile', async () => {
    const users = {
      findById: vi.fn<FindById>().mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        status: 'ACTIVE',
        createdAt: '2026-10-03T00:00:00.000Z',
      }),
    };

    const useCase = new GetProfileUseCase(users as never);

    const result = await useCase.execute({
      userId: 'user-123',
    });

    expect(result).toEqual({
      id: 'user-123',
      email: 'user@example.com',
      firstName: '',
      lastName: '',
      status: 'ACTIVE',
      createdAt: '2026-10-03T00:00:00.000Z',
    });

    expect(users.findById).toHaveBeenCalledWith('user-123');
  });

  it('rejects when the authenticated user ID is missing', async () => {
    const users = {
      findById: vi.fn<FindById>(),
    };

    const useCase = new GetProfileUseCase(users as never);

    await expect(
      useCase.execute({ userId: '' }),
    ).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'Authenticated user is required',
    });

    expect(users.findById).not.toHaveBeenCalled();
  });

  it('rejects when the user does not exist', async () => {
    const users = {
      findById: vi.fn<FindById>().mockResolvedValue(null),
    };

    const useCase = new GetProfileUseCase(users as never);

    await expect(
      useCase.execute({ userId: 'unknown-user' }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'User not found',
    });

    expect(users.findById).toHaveBeenCalledWith('unknown-user');
  });

  it('does not expose password hashes or authentication tokens', async () => {
    const users = {
      findById: vi.fn<FindById>().mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        status: 'ACTIVE',
        createdAt: '2026-10-03T00:00:00.000Z',
      }),
    };

    const useCase = new GetProfileUseCase(users as never);

    const result = await useCase.execute({
      userId: 'user-123',
    });

    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('refreshToken');
  });
});