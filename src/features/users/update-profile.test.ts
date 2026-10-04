import { describe, expect, it, vi } from 'vitest';

import { UpdateProfileUseCase } from './update-profile.js';

interface MockUser {
  id: string;
  email: string;
  name: string | null;
  status: string;
  createdAt: string;
}

type UpdateName = (userId: string, name: string) => Promise<MockUser | null>;

describe('UpdateProfileUseCase', () => {
  it('updates and returns the authenticated user profile', async () => {
    const users = {
      updateName: vi.fn<UpdateName>().mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        name: 'John Doe',
        status: 'ACTIVE',
        createdAt: '2026-10-03T00:00:00.000Z',
      }),
    };

    const useCase = new UpdateProfileUseCase(users as never);

    const result = await useCase.execute({
      userId: 'user-123',
      name: '  John Doe  ',
    });

    expect(result).toEqual({
      id: 'user-123',
      email: 'user@example.com',
      name: 'John Doe',
      status: 'ACTIVE',
      createdAt: '2026-10-03T00:00:00.000Z',
    });

    expect(users.updateName).toHaveBeenCalledWith('user-123', 'John Doe');
  });

  it('rejects when the authenticated user ID is missing', async () => {
    const users = {
      updateName: vi.fn<UpdateName>(),
    };

    const useCase = new UpdateProfileUseCase(users as never);

    await expect(
      useCase.execute({
        userId: '',
        name: 'John Doe',
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'Authenticated user is required',
    });

    expect(users.updateName).not.toHaveBeenCalled();
  });

  it('rejects when the name is empty', async () => {
    const users = {
      updateName: vi.fn<UpdateName>(),
    };

    const useCase = new UpdateProfileUseCase(users as never);

    await expect(
      useCase.execute({
        userId: 'user-123',
        name: '   ',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
      message: 'Name is required',
    });

    expect(users.updateName).not.toHaveBeenCalled();
  });

  it('rejects when the name exceeds 100 characters', async () => {
    const users = {
      updateName: vi.fn<UpdateName>(),
    };

    const useCase = new UpdateProfileUseCase(users as never);

    await expect(
      useCase.execute({
        userId: 'user-123',
        name: 'a'.repeat(101),
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
      message: 'Name must not exceed 100 characters',
    });

    expect(users.updateName).not.toHaveBeenCalled();
  });

  it('rejects when the user does not exist', async () => {
    const users = {
      updateName: vi.fn<UpdateName>().mockResolvedValue(null),
    };

    const useCase = new UpdateProfileUseCase(users as never);

    await expect(
      useCase.execute({
        userId: 'unknown-user',
        name: 'John Doe',
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'User not found',
    });

    expect(users.updateName).toHaveBeenCalledWith('unknown-user', 'John Doe');
  });
});
