import { describe, expect, it, vi } from 'vitest';
import type { TemporaryTokenStore } from '../../infrastructure/redis/temporary-token-store.js';
import type { UserRepository, RegisteredUser } from '../users/repository.js';
import { VerifyEmailChangeUseCase } from './verify-email-change.js';

const user: RegisteredUser = {
  id: 'user-123',
  email: 'old@example.com',
  name: 'Test User',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  role: 'user'
};

const createUseCase = () => {
  const userRepo = {
    findById: vi.fn<UserRepository['findById']>(),
    findByEmail: vi.fn<UserRepository['findByEmail']>(),
    updateEmail: vi.fn<UserRepository['updateEmail']>(),
  } satisfies Pick<UserRepository, 'findById' | 'findByEmail' | 'updateEmail'>;

  const temporaryTokenStore = {
    get: vi.fn<TemporaryTokenStore['get']>(),
    delete: vi.fn<TemporaryTokenStore['delete']>(),
  } satisfies Pick<TemporaryTokenStore, 'get' | 'delete'>;

  const useCase = new VerifyEmailChangeUseCase(
    userRepo as unknown as UserRepository,
    temporaryTokenStore as unknown as TemporaryTokenStore,
  );

  return {
    useCase,
    userRepo,
    temporaryTokenStore,
  };
};

describe('VerifyEmailChangeUseCase', () => {
  it('updates the email and returns the updated profile', async () => {
    const { useCase, userRepo, temporaryTokenStore } = createUseCase();

    temporaryTokenStore.get.mockResolvedValue(
      JSON.stringify({
        userId: user.id,
        newEmail: ' NewEmail@Example.com ',
      }),
    );
    userRepo.findById.mockResolvedValue(user);
    userRepo.findByEmail.mockResolvedValue(null);

    const updatedUser: RegisteredUser = {
      ...user,
      email: 'newemail@example.com',
    };

    userRepo.updateEmail.mockResolvedValue(updatedUser);
    temporaryTokenStore.delete.mockResolvedValue(undefined);

    const result = await useCase.execute({
      token: 'verification-token',
    });

    expect(userRepo.updateEmail).toHaveBeenCalledWith(user.id, 'newemail@example.com');
    expect(temporaryTokenStore.delete).toHaveBeenCalledWith(
      'email-verification',
      'verification-token',
    );
    expect(result).toEqual(updatedUser);
  });

  it('rejects a missing token', async () => {
    const { useCase } = createUseCase();

    await expect(
      useCase.execute({
        token: '',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
  });

  it('rejects an invalid or expired token', async () => {
    const { useCase, temporaryTokenStore } = createUseCase();

    temporaryTokenStore.get.mockResolvedValue(null);

    await expect(
      useCase.execute({
        token: 'invalid-token',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
  });

  it('rejects a malformed token payload', async () => {
    const { useCase, temporaryTokenStore } = createUseCase();

    temporaryTokenStore.get.mockResolvedValue('{invalid-json');

    await expect(
      useCase.execute({
        token: 'verification-token',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
  });

  it('rejects a token with an incomplete payload', async () => {
    const { useCase, temporaryTokenStore } = createUseCase();

    temporaryTokenStore.get.mockResolvedValue(
      JSON.stringify({
        userId: user.id,
      }),
    );

    await expect(
      useCase.execute({
        token: 'verification-token',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
  });

  it('rejects when the user no longer exists', async () => {
    const { useCase, userRepo, temporaryTokenStore } = createUseCase();

    temporaryTokenStore.get.mockResolvedValue(
      JSON.stringify({
        userId: user.id,
        newEmail: 'new@example.com',
      }),
    );
    userRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        token: 'verification-token',
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects when the new email is already used by another user', async () => {
    const { useCase, userRepo, temporaryTokenStore } = createUseCase();

    temporaryTokenStore.get.mockResolvedValue(
      JSON.stringify({
        userId: user.id,
        newEmail: 'taken@example.com',
      }),
    );
    userRepo.findById.mockResolvedValue(user);
    userRepo.findByEmail.mockResolvedValue({
      id: 'another-user',
    });

    await expect(
      useCase.execute({
        token: 'verification-token',
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    });

    expect(userRepo.updateEmail).not.toHaveBeenCalled();
  });

  it('maps a database unique constraint violation to conflict', async () => {
    const { useCase, userRepo, temporaryTokenStore } = createUseCase();

    temporaryTokenStore.get.mockResolvedValue(
      JSON.stringify({
        userId: user.id,
        newEmail: 'new@example.com',
      }),
    );
    userRepo.findById.mockResolvedValue(user);
    userRepo.findByEmail.mockResolvedValue(null);

    userRepo.updateEmail.mockRejectedValue({
      code: '23505',
    });

    await expect(
      useCase.execute({
        token: 'verification-token',
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    });

    expect(temporaryTokenStore.delete).not.toHaveBeenCalled();
  });

  it('does not delete the token when the email update fails', async () => {
    const { useCase, userRepo, temporaryTokenStore } = createUseCase();

    temporaryTokenStore.get.mockResolvedValue(
      JSON.stringify({
        userId: user.id,
        newEmail: 'new@example.com',
      }),
    );
    userRepo.findById.mockResolvedValue(user);
    userRepo.findByEmail.mockResolvedValue(null);

    userRepo.updateEmail.mockRejectedValue(new Error('database failure'));

    await expect(
      useCase.execute({
        token: 'verification-token',
      }),
    ).rejects.toThrow('database failure');

    expect(temporaryTokenStore.delete).not.toHaveBeenCalled();
  });

  it('propagates token deletion failures after the email is updated', async () => {
    const { useCase, userRepo, temporaryTokenStore } = createUseCase();

    temporaryTokenStore.get.mockResolvedValue(
      JSON.stringify({
        userId: user.id,
        newEmail: 'new@example.com',
      }),
    );
    userRepo.findById.mockResolvedValue(user);
    userRepo.findByEmail.mockResolvedValue(null);

    const updatedUser: RegisteredUser = {
      ...user,
      email: 'new@example.com',
    };

    userRepo.updateEmail.mockResolvedValue(updatedUser);
    temporaryTokenStore.delete.mockRejectedValue(new Error('redis failure'));

    await expect(
      useCase.execute({
        token: 'verification-token',
      }),
    ).rejects.toThrow('redis failure');

    expect(userRepo.updateEmail).toHaveBeenCalledWith(user.id, 'new@example.com');
  });
});
