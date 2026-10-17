import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCodes } from '../../errors/codes.js';
import type { JwtSigner } from '../../infrastructure/crypto/jwt-signer.js';
import type { PasswordHasher } from '../../infrastructure/crypto/password-hasher.js';
import type { LoginAttemptRepository } from '../../infrastructure/redis/login-attempt-repository.js';
import type { SessionRepository } from '../sessions/repository.js';
import type { UserRepository } from '../users/repository.js';

import { LoginUseCase } from './login.js';

describe('LoginUseCase security tests', () => {
  const userRepo = {
    findByEmailWithCredentials: vi.fn<UserRepository['findByEmailWithCredentials']>(),
  };

  const passwordHasher = {
    verify: vi.fn<PasswordHasher['verify']>(),
  };

  const jwtSigner = {
    signAccessToken: vi.fn<JwtSigner['signAccessToken']>(),
  };

  const sessionRepo = {
    create: vi.fn<SessionRepository['create']>(),
  };

  const loginAttemptRepo = {
    isLimited: vi.fn<LoginAttemptRepository['isLimited']>(),
    recordFailure: vi.fn<LoginAttemptRepository['recordFailure']>(),
    reset: vi.fn<LoginAttemptRepository['reset']>(),
  };

  let useCase: LoginUseCase;

  beforeEach(() => {
    vi.resetAllMocks();

    useCase = new LoginUseCase(
      userRepo as unknown as UserRepository,
      passwordHasher as unknown as PasswordHasher,
      jwtSigner as unknown as JwtSigner,
      sessionRepo as unknown as SessionRepository,
      loginAttemptRepo as unknown as LoginAttemptRepository,
      900,
      604800,
    );

    loginAttemptRepo.isLimited.mockResolvedValue(false);
    loginAttemptRepo.recordFailure.mockResolvedValue(1);
    loginAttemptRepo.reset.mockResolvedValue(undefined);

    userRepo.findByEmailWithCredentials.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
      passwordHash: 'stored-password-hash',
      status: 'ACTIVE',
      role: 'user',
      createdAt: new Date(),
    });

    passwordHasher.verify.mockResolvedValue(true);
    jwtSigner.signAccessToken.mockResolvedValue('test-access-token');
    sessionRepo.create.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      refreshTokenHash: 'test-refresh-token-hash',
      expiresAt: new Date(Date.now() + 604800 * 1000).toISOString(),
      revokedAt: null,
    });
  });

  it('rejects missing email or password', async () => {
    await expect(useCase.execute({ email: '', password: 'password123' })).rejects.toMatchObject({
      code: ErrorCodes.INVALID_ARGUMENT,
    });

    await expect(
      useCase.execute({ email: 'user@example.com', password: '' }),
    ).rejects.toMatchObject({
      code: ErrorCodes.INVALID_ARGUMENT,
    });

    expect(loginAttemptRepo.isLimited).not.toHaveBeenCalled();
    expect(userRepo.findByEmailWithCredentials).not.toHaveBeenCalled();
    expect(passwordHasher.verify).not.toHaveBeenCalled();
  });

  it('rejects login when the attempt limit is reached', async () => {
    loginAttemptRepo.isLimited.mockResolvedValue(true);

    await expect(
      useCase.execute({
        email: 'USER@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({
      code: ErrorCodes.RATE_LIMITED,
      httpStatus: 429,
    });

    expect(loginAttemptRepo.isLimited).toHaveBeenCalledWith('user@example.com');
    expect(userRepo.findByEmailWithCredentials).not.toHaveBeenCalled();
    expect(passwordHasher.verify).not.toHaveBeenCalled();
    expect(sessionRepo.create).not.toHaveBeenCalled();
  });

  it('records a failed attempt when the email does not exist', async () => {
    userRepo.findByEmailWithCredentials.mockResolvedValue(null);

    await expect(
      useCase.execute({
        email: 'UNKNOWN@example.com',
        password: 'password123',
      }),
    ).rejects.toMatchObject({
      code: ErrorCodes.UNAUTHENTICATED,
    });

    expect(userRepo.findByEmailWithCredentials).toHaveBeenCalledWith('unknown@example.com');
    expect(loginAttemptRepo.recordFailure).toHaveBeenCalledWith('unknown@example.com');
    expect(passwordHasher.verify).not.toHaveBeenCalled();
  });

  it('records a failed attempt when the password is incorrect', async () => {
    passwordHasher.verify.mockResolvedValue(false);

    await expect(
      useCase.execute({
        email: 'USER@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({
      code: ErrorCodes.UNAUTHENTICATED,
    });

    expect(passwordHasher.verify).toHaveBeenCalledWith('stored-password-hash', 'wrong-password');

    expect(loginAttemptRepo.recordFailure).toHaveBeenCalledWith('user@example.com');
    expect(sessionRepo.create).not.toHaveBeenCalled();
  });

  it('resets failed attempts and creates a session after successful login', async () => {
    // First login: simulate an incorrect password.
    passwordHasher.verify.mockResolvedValueOnce(false);

    await expect(
      useCase.execute({
        email: 'USER@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({
      code: ErrorCodes.UNAUTHENTICATED,
    });

    expect(loginAttemptRepo.recordFailure).toHaveBeenCalledWith('user@example.com');

    // Second login: simulate the correct password.
    passwordHasher.verify.mockResolvedValueOnce(true);

    const result = await useCase.execute({
      email: 'USER@example.com',
      password: 'correct-password',
    });

    expect(result.userId).toBe('user-1');
    expect(result.email).toBe('user@example.com');
    expect(result.accessToken).toBe('test-access-token');

    expect(loginAttemptRepo.reset).toHaveBeenCalledWith('user@example.com');

    expect(loginAttemptRepo.recordFailure).toHaveBeenCalledTimes(1);

    // Confirm that a session is created after successful login.
    expect(sessionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        refreshTokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    );
  });

  it('blocks further login attempts after the configured limit is reached', async () => {
    loginAttemptRepo.isLimited
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    passwordHasher.verify.mockResolvedValue(false);

    for (let i = 0; i < 5; i++) {
      await expect(
        useCase.execute({
          email: 'user@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toMatchObject({
        code: ErrorCodes.UNAUTHENTICATED,
      });
    }

    await expect(
      useCase.execute({
        email: 'user@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({
      code: ErrorCodes.RATE_LIMITED,
      httpStatus: 429,
    });

    expect(loginAttemptRepo.recordFailure).toHaveBeenCalledTimes(5);
    expect(passwordHasher.verify).toHaveBeenCalledTimes(5);
    expect(sessionRepo.create).not.toHaveBeenCalled();
  });

  it('keeps login blocked while the rate limit is active', async () => {
    loginAttemptRepo.isLimited.mockResolvedValue(true);

    await expect(
      useCase.execute({
        email: 'user@example.com',
        password: 'password123',
      }),
    ).rejects.toMatchObject({
      code: ErrorCodes.RATE_LIMITED,
      httpStatus: 429,
    });

    await expect(
      useCase.execute({
        email: 'user@example.com',
        password: 'password123',
      }),
    ).rejects.toMatchObject({
      code: ErrorCodes.RATE_LIMITED,
      httpStatus: 429,
    });

    expect(loginAttemptRepo.isLimited).toHaveBeenCalledTimes(2);

    expect(userRepo.findByEmailWithCredentials).not.toHaveBeenCalled();
    expect(passwordHasher.verify).not.toHaveBeenCalled();
    expect(sessionRepo.create).not.toHaveBeenCalled();
  });

  it('normalizes email casing when checking and recording failed attempts', async () => {
    passwordHasher.verify.mockResolvedValue(false);

    await expect(
      useCase.execute({
        email: 'USER@EXAMPLE.COM',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({
      code: ErrorCodes.UNAUTHENTICATED,
    });

    expect(loginAttemptRepo.isLimited).toHaveBeenCalledWith('user@example.com');

    expect(userRepo.findByEmailWithCredentials).toHaveBeenCalledWith('user@example.com');

    expect(loginAttemptRepo.recordFailure).toHaveBeenCalledWith('user@example.com');

    expect(sessionRepo.create).not.toHaveBeenCalled();
  });
});
