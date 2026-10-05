import { describe, expect, it, vi } from 'vitest';
import { ResetPasswordUseCase } from './reset-password.js';

describe('ResetPasswordUseCase', () => {
  const userRepo = {
    updatePasswordHash: vi.fn<(userId: string, passwordHash: string) => Promise<boolean>>(),
  };

  const passwordHasher = {
    hash: vi.fn<(password: string) => Promise<string>>(),
  };

  const temporaryTokenStore = {
    get: vi.fn<
      (purpose: 'password-reset' | 'email-verification', token: string) => Promise<string | null>
    >(),
    delete:
      vi.fn<(purpose: 'password-reset' | 'email-verification', token: string) => Promise<void>>(),
  };

  const sessionRepo = {
    revokeAllByUserId: vi.fn<(userId: string) => Promise<boolean>>(),
  };

  const createUseCase = () =>
    new ResetPasswordUseCase(
      userRepo as never,
      passwordHasher as never,
      temporaryTokenStore as never,
      sessionRepo as never,
    );

  it('resets the password, deletes the token, and revokes all sessions', async () => {
    temporaryTokenStore.get.mockResolvedValue('user-123');
    passwordHasher.hash.mockResolvedValue('new-password-hash');
    userRepo.updatePasswordHash.mockResolvedValue(true);
    temporaryTokenStore.delete.mockResolvedValue(undefined);
    sessionRepo.revokeAllByUserId.mockResolvedValue(true);

    const result = await createUseCase().execute({
      token: 'reset-token-123',
      newPassword: 'new-password',
    });

    expect(result).toEqual({ success: true });

    expect(temporaryTokenStore.get).toHaveBeenCalledWith('password-reset', 'reset-token-123');

    expect(passwordHasher.hash).toHaveBeenCalledWith('new-password');

    expect(userRepo.updatePasswordHash).toHaveBeenCalledWith('user-123', 'new-password-hash');

    expect(temporaryTokenStore.delete).toHaveBeenCalledWith('password-reset', 'reset-token-123');

    expect(sessionRepo.revokeAllByUserId).toHaveBeenCalledWith('user-123');
  });

  it('rejects a missing token', async () => {
    await expect(
      createUseCase().execute({
        token: '',
        newPassword: 'new-password',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });

    expect(temporaryTokenStore.get).not.toHaveBeenCalled();
  });

  it('rejects a missing new password', async () => {
    await expect(
      createUseCase().execute({
        token: 'reset-token-123',
        newPassword: '',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });

    expect(temporaryTokenStore.get).not.toHaveBeenCalled();
  });

  it('rejects a password shorter than 8 characters', async () => {
    await expect(
      createUseCase().execute({
        token: 'reset-token-123',
        newPassword: 'short',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });

    expect(temporaryTokenStore.get).not.toHaveBeenCalled();
  });

  it('rejects an invalid or expired reset token', async () => {
    temporaryTokenStore.get.mockResolvedValue(null);

    await expect(
      createUseCase().execute({
        token: 'expired-token',
        newPassword: 'new-password',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });

    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(userRepo.updatePasswordHash).not.toHaveBeenCalled();
    expect(temporaryTokenStore.delete).not.toHaveBeenCalled();
    expect(sessionRepo.revokeAllByUserId).not.toHaveBeenCalled();
  });

  it('does not consume the token when the password update fails', async () => {
    temporaryTokenStore.get.mockResolvedValue('user-123');
    passwordHasher.hash.mockResolvedValue('new-password-hash');
    userRepo.updatePasswordHash.mockResolvedValue(false);

    await expect(
      createUseCase().execute({
        token: 'reset-token-123',
        newPassword: 'new-password',
      }),
    ).rejects.toMatchObject({
      code: 'INTERNAL',
    });

    expect(temporaryTokenStore.delete).not.toHaveBeenCalled();
    expect(sessionRepo.revokeAllByUserId).not.toHaveBeenCalled();
  });

  it('does not revoke sessions if token deletion fails', async () => {
    temporaryTokenStore.get.mockResolvedValue('user-123');
    passwordHasher.hash.mockResolvedValue('new-password-hash');
    userRepo.updatePasswordHash.mockResolvedValue(true);
    temporaryTokenStore.delete.mockRejectedValue(new Error('Redis unavailable'));

    await expect(
      createUseCase().execute({
        token: 'reset-token-123',
        newPassword: 'new-password',
      }),
    ).rejects.toThrow('Redis unavailable');

    expect(sessionRepo.revokeAllByUserId).not.toHaveBeenCalled();
  });
});
