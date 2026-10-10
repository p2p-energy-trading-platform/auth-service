import { describe, expect, it, vi } from 'vitest';

import type { PasswordHasher } from '../../infrastructure/crypto/password-hasher.js';
import type { EmailProvider } from '../../infrastructure/email/provider.js';
import type { OTPRepository } from '../../infrastructure/redis/otp-repository.js';
import type { UserRepository } from '../users/repository.js';
import { RegisterUseCase } from './register.js';

function createUseCase() {
  const userRepo = {
    findByEmail: vi.fn<UserRepository['findByEmail']>().mockResolvedValue(null),
    createUsersWithCredentials: vi
      .fn<UserRepository['createUsersWithCredentials']>()
      .mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        name: 'John Doe',
        status: 'PENDING',
      role: 'user',
        createdAt: new Date('2026-10-10T00:00:00.000Z'),
      }),
  };
  const passwordHasher = {
    hash: vi.fn<PasswordHasher['hash']>().mockResolvedValue('hashed-password'),
  };
  const emailProvider = { send: vi.fn<EmailProvider['send']>().mockResolvedValue(undefined) };
  const otpRepo = { setOtp: vi.fn<OTPRepository['setOtp']>().mockResolvedValue(undefined) };

  const useCase = new RegisterUseCase(
    userRepo as never,
    passwordHasher as never,
    emailProvider as never,
    otpRepo as never,
  );

  return { useCase, userRepo };
}

describe('RegisterUseCase', () => {
  it('creates the user with the trimmed name', async () => {
    const { useCase, userRepo } = createUseCase();

    await useCase.execute({
      name: '  John Doe  ',
      email: 'User@Example.com',
      password: 'a-long-password',
    });

    expect(userRepo.createUsersWithCredentials).toHaveBeenCalledWith({
      email: 'user@example.com',
      passwordHash: 'hashed-password',
      name: 'John Doe',
    });
  });

  it.each([
    ['an empty name', '', 'Name is required'],
    ['a whitespace-only name', '   ', 'Name is required'],
    ['a 101-character name', 'x'.repeat(101), 'Name must not exceed 100 characters'],
  ])('rejects %s', async (_case, name, message) => {
    const { useCase, userRepo } = createUseCase();

    await expect(
      useCase.execute({ name, email: 'user@example.com', password: 'a-long-password' }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT', message });

    expect(userRepo.createUsersWithCredentials).not.toHaveBeenCalled();
  });
});
