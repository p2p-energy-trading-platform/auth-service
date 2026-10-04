import { describe, expect, it, vi } from 'vitest';
import { ChangePasswordUseCase } from './change-password.js';

const createDependencies = () => {
  const userRepo = {
    findPasswordHashById: vi.fn<(userId: string) => Promise<string | null>>(),
    updatePasswordHash: vi.fn<(userId: string, passwordHash: string) => Promise<boolean>>(),
  };

  const passwordHasher = {
    verify: vi.fn<(passwordHash: string, password: string) => Promise<boolean>>(),
    hash: vi.fn<(password: string) => Promise<string>>(),
  };

  const sessionRepo = {
    revokeAllByUserId: vi.fn<(userId: string) => Promise<unknown>>(),
  };

  return {
    userRepo,
    passwordHasher,
    sessionRepo,
    useCase: new ChangePasswordUseCase(
      userRepo as never,
      passwordHasher as never,
      sessionRepo as never,
    ),
  };
};

describe('ChangePasswordUseCase', () => {
  it('changes the password successfully', async () => {
    const { userRepo, passwordHasher, sessionRepo, useCase } = createDependencies();

    userRepo.findPasswordHashById.mockResolvedValue('old-password-hash');
    passwordHasher.verify.mockResolvedValue(true);
    passwordHasher.hash.mockResolvedValue('new-password-hash');
    userRepo.updatePasswordHash.mockResolvedValue(true);
    sessionRepo.revokeAllByUserId.mockResolvedValue(true);

    const result = await useCase.execute({
      userId: 'user-123',
      currentPassword: 'OldPassword123',
      newPassword: 'NewPassword123',
    });

    expect(result).toEqual({ success: true });

    expect(userRepo.findPasswordHashById).toHaveBeenCalledWith('user-123');
    expect(passwordHasher.verify).toHaveBeenCalledWith('old-password-hash', 'OldPassword123');
    expect(passwordHasher.hash).toHaveBeenCalledWith('NewPassword123');
    expect(userRepo.updatePasswordHash).toHaveBeenCalledWith('user-123', 'new-password-hash');
    expect(sessionRepo.revokeAllByUserId).toHaveBeenCalledWith('user-123');
  });

  it('rejects when the user is not authenticated', async () => {
    const { useCase } = createDependencies();

    await expect(
      useCase.execute({
        userId: '',
        currentPassword: 'OldPassword123',
        newPassword: 'NewPassword123',
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('rejects when current or new password is missing', async () => {
    const { useCase } = createDependencies();

    await expect(
      useCase.execute({
        userId: 'user-123',
        currentPassword: '',
        newPassword: 'NewPassword123',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });

    await expect(
      useCase.execute({
        userId: 'user-123',
        currentPassword: 'OldPassword123',
        newPassword: '',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
  });

  it('rejects a new password shorter than 8 characters', async () => {
    const { useCase } = createDependencies();

    await expect(
      useCase.execute({
        userId: 'user-123',
        currentPassword: 'OldPassword123',
        newPassword: 'short',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
  });

  it('rejects when the user credentials are not found', async () => {
    const { userRepo, useCase } = createDependencies();

    userRepo.findPasswordHashById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId: 'user-123',
        currentPassword: 'OldPassword123',
        newPassword: 'NewPassword123',
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects when the current password is incorrect', async () => {
    const { userRepo, passwordHasher, useCase } = createDependencies();

    userRepo.findPasswordHashById.mockResolvedValue('old-password-hash');
    passwordHasher.verify.mockResolvedValue(false);

    await expect(
      useCase.execute({
        userId: 'user-123',
        currentPassword: 'WrongPassword123',
        newPassword: 'NewPassword123',
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });

    expect(passwordHasher.hash).not.toHaveBeenCalled();
  });

  it('does not revoke sessions when the password update fails', async () => {
    const { userRepo, passwordHasher, sessionRepo, useCase } = createDependencies();

    userRepo.findPasswordHashById.mockResolvedValue('old-password-hash');
    passwordHasher.verify.mockResolvedValue(true);
    passwordHasher.hash.mockResolvedValue('new-password-hash');
    userRepo.updatePasswordHash.mockResolvedValue(false);

    await expect(
      useCase.execute({
        userId: 'user-123',
        currentPassword: 'OldPassword123',
        newPassword: 'NewPassword123',
      }),
    ).rejects.toMatchObject({
      code: 'INTERNAL',
    });

    expect(sessionRepo.revokeAllByUserId).not.toHaveBeenCalled();
  });
});
