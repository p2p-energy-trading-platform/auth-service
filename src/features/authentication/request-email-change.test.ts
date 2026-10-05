import { describe, expect, it, vi } from 'vitest';
import type { UserRepository } from '../users/repository.js';
import { RequestEmailChangeUseCase } from './request-email-change.js';
import type { TemporaryTokenStore } from '../../infrastructure/redis/temporary-token-store.js';

describe('RequestEmailChangeUseCase', () => {
  const userRepo = {
    findByEmail: vi.fn<(email: string) => Promise<{ id: string } | null>>(),
    findById: vi.fn<
      (userId: string) => Promise<{
        id: string;
        email: string;
        name: string | null;
        status: string;
        createdAt: string;
        role: string;
      } | null>
    >(),
  } satisfies Pick<UserRepository, 'findByEmail' | 'findById'>;

  const temporaryTokenStore = {
    create:
      vi.fn<
        (
          purpose: 'password-reset' | 'email-verification',
          payload: string,
          ttlSeconds: number,
        ) => Promise<string>
      >(),
  };

  const emailProvider = {
    send: vi.fn<
      (message: { to: string; subject: string; text: string; html?: string }) => Promise<void>
    >(),
  };

  const createUseCase = () =>
    new RequestEmailChangeUseCase(
      userRepo as unknown as UserRepository,
      temporaryTokenStore as unknown as TemporaryTokenStore,
      emailProvider,
      900,
      'http://localhost:3000/verify-email-change',
    );

  const currentUser = {
    id: 'user-123',
    email: 'old@example.com',
    name: 'Test User',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    role: 'user'
  };

  it('creates an email verification token and sends a verification email', async () => {
    userRepo.findByEmail.mockResolvedValue(null);
    userRepo.findById.mockResolvedValue(currentUser);
    temporaryTokenStore.create.mockResolvedValue('verification-token-123');

    const result = await createUseCase().execute({
      userId: 'user-123',
      newEmail: ' NEW@example.com ',
    });

    expect(result).toEqual({ success: true });

    expect(userRepo.findByEmail).toHaveBeenCalledWith('new@example.com');

    expect(temporaryTokenStore.create).toHaveBeenCalledWith(
      'email-verification',
      JSON.stringify({
        userId: 'user-123',
        newEmail: 'new@example.com',
      }),
      900,
    );

    expect(emailProvider.send).toHaveBeenCalledTimes(1);

    const emailCall = emailProvider.send.mock.calls[0];

    expect(emailCall).toBeDefined();

    const email = emailCall![0];

    expect(email.to).toBe('new@example.com');
    expect(email.subject).toBe('Verify your new GridX email address');
    expect(email.text).toContain(
      'http://localhost:3000/verify-email-change?token=verification-token-123',
    );
    expect(email.html).toContain(
      'http://localhost:3000/verify-email-change?token=verification-token-123',
    );
  });

  it('rejects when the user is not authenticated', async () => {
    await expect(
      createUseCase().execute({
        userId: '',
        newEmail: 'new@example.com',
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('rejects when the new email is missing', async () => {
    await expect(
      createUseCase().execute({
        userId: 'user-123',
        newEmail: '',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
  });

  it('rejects when the new email is whitespace only', async () => {
    await expect(
      createUseCase().execute({
        userId: 'user-123',
        newEmail: '   ',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
  });

  it('rejects when the new email is already used by another user', async () => {
    userRepo.findByEmail.mockResolvedValue({
      id: 'another-user',
    });

    await expect(
      createUseCase().execute({
        userId: 'user-123',
        newEmail: 'existing@example.com',
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    });

    expect(userRepo.findById).not.toHaveBeenCalled();
    expect(temporaryTokenStore.create).not.toHaveBeenCalled();
    expect(emailProvider.send).not.toHaveBeenCalled();
  });

  it('rejects when the user does not exist', async () => {
    userRepo.findByEmail.mockResolvedValue(null);
    userRepo.findById.mockResolvedValue(null);

    await expect(
      createUseCase().execute({
        userId: 'missing-user',
        newEmail: 'new@example.com',
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    expect(temporaryTokenStore.create).not.toHaveBeenCalled();
    expect(emailProvider.send).not.toHaveBeenCalled();
  });

  it('rejects when the new email is the current email', async () => {
    userRepo.findByEmail.mockResolvedValue({
      id: 'user-123',
    });
    userRepo.findById.mockResolvedValue(currentUser);

    await expect(
      createUseCase().execute({
        userId: 'user-123',
        newEmail: 'OLD@example.com',
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    });

    expect(temporaryTokenStore.create).not.toHaveBeenCalled();
    expect(emailProvider.send).not.toHaveBeenCalled();
  });

  it('does not send an email when token creation fails', async () => {
    userRepo.findByEmail.mockResolvedValue(null);
    userRepo.findById.mockResolvedValue(currentUser);
    temporaryTokenStore.create.mockRejectedValue(new Error('Redis unavailable'));

    await expect(
      createUseCase().execute({
        userId: 'user-123',
        newEmail: 'new@example.com',
      }),
    ).rejects.toThrow('Redis unavailable');

    expect(emailProvider.send).not.toHaveBeenCalled();
  });

  it('propagates email provider failures', async () => {
    userRepo.findByEmail.mockResolvedValue(null);
    userRepo.findById.mockResolvedValue(currentUser);
    temporaryTokenStore.create.mockResolvedValue('verification-token-123');
    emailProvider.send.mockRejectedValue(new Error('Email provider failed'));

    await expect(
      createUseCase().execute({
        userId: 'user-123',
        newEmail: 'new@example.com',
      }),
    ).rejects.toThrow('Email provider failed');
  });
});
