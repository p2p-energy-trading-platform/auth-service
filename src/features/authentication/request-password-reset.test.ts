import { describe, expect, it, vi } from 'vitest';
import { RequestPasswordResetUseCase } from './request-password-reset.js';

const createDependencies = () => {
  const userRepo = {
    findByEmail: vi.fn<(email: string) => Promise<{ id: string } | null>>(),
  };

  const temporaryTokenStore = {
    create:
      vi.fn<
        (
          purpose: 'password-reset' | 'email-verification',
          payload: string,
          ttlSeconds: number,
        ) => Promise<string>
      >(),
    get: vi.fn<
      (purpose: 'password-reset' | 'email-verification', token: string) => Promise<string | null>
    >(),
    delete:
      vi.fn<(purpose: 'password-reset' | 'email-verification', token: string) => Promise<void>>(),
  };

  const emailProvider = {
    send: vi.fn<
      (message: { to: string; subject: string; text: string; html?: string }) => Promise<void>
    >(),
  };

  return {
    userRepo,
    temporaryTokenStore,
    emailProvider,
    useCase: new RequestPasswordResetUseCase(
      userRepo as never,
      temporaryTokenStore as never,
      emailProvider as never,
      900,
      'http://localhost:3000/reset-password',
    ),
  };
};

describe('RequestPasswordResetUseCase', () => {
  it('creates a reset token and sends a password reset email', async () => {
    const { userRepo, temporaryTokenStore, emailProvider, useCase } = createDependencies();

    userRepo.findByEmail.mockResolvedValue({ id: 'user-123' });
    temporaryTokenStore.create.mockResolvedValue('reset-token-123');
    emailProvider.send.mockResolvedValue(undefined);

    const result = await useCase.execute({
      email: '  USER@Example.COM ',
    });

    expect(result).toEqual({ success: true });

    expect(userRepo.findByEmail).toHaveBeenCalledWith('user@example.com');

    expect(temporaryTokenStore.create).toHaveBeenCalledWith('password-reset', 'user-123', 900);

    expect(emailProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Reset your GridX password',
      }),
    );

    const email = emailProvider.send.mock.calls[0]?.[0];

    expect(email.text).toContain('http://localhost:3000/reset-password?token=reset-token-123');

    expect(email.html).toContain('http://localhost:3000/reset-password?token=reset-token-123');
  });

  it('returns success without revealing whether the email exists', async () => {
    const { userRepo, temporaryTokenStore, emailProvider, useCase } = createDependencies();

    userRepo.findByEmail.mockResolvedValue(null);

    const result = await useCase.execute({
      email: 'unknown@example.com',
    });

    expect(result).toEqual({ success: true });

    expect(temporaryTokenStore.create).not.toHaveBeenCalled();
    expect(emailProvider.send).not.toHaveBeenCalled();
  });

  it('rejects when the email is missing', async () => {
    const { useCase } = createDependencies();

    await expect(useCase.execute({ email: '' })).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
  });

  it('rejects when the email contains only whitespace', async () => {
    const { useCase } = createDependencies();

    await expect(useCase.execute({ email: '   ' })).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
  });

  it('does not send an email when token creation fails', async () => {
    const { userRepo, temporaryTokenStore, emailProvider, useCase } = createDependencies();

    userRepo.findByEmail.mockResolvedValue({ id: 'user-123' });
    temporaryTokenStore.create.mockRejectedValue(new Error('Redis unavailable'));

    await expect(
      useCase.execute({
        email: 'user@example.com',
      }),
    ).rejects.toThrow('Redis unavailable');

    expect(emailProvider.send).not.toHaveBeenCalled();
  });

  it('propagates email provider failures', async () => {
    const { userRepo, temporaryTokenStore, emailProvider, useCase } = createDependencies();

    userRepo.findByEmail.mockResolvedValue({ id: 'user-123' });
    temporaryTokenStore.create.mockResolvedValue('reset-token-123');
    emailProvider.send.mockRejectedValue(new Error('Email delivery failed'));

    await expect(
      useCase.execute({
        email: 'user@example.com',
      }),
    ).rejects.toThrow('Email delivery failed');
  });
});
