import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCodes } from '../../errors/codes.js';
import type { JwtSigner } from '../../infrastructure/crypto/jwt-signer.js';
import type { PasswordHasher } from '../../infrastructure/crypto/password-hasher.js';
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

  let useCase: LoginUseCase;

  beforeEach(() => {
    vi.resetAllMocks();

    useCase = new LoginUseCase(
      userRepo as unknown as UserRepository,
      passwordHasher as unknown as PasswordHasher,
      jwtSigner as unknown as JwtSigner,
      sessionRepo as unknown as SessionRepository,
      900,
      604800,
    );

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

    expect(userRepo.findByEmailWithCredentials).not.toHaveBeenCalled();
    expect(passwordHasher.verify).not.toHaveBeenCalled();
  });

  it('rejects login when the email does not exist', async () => {
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
    expect(passwordHasher.verify).not.toHaveBeenCalled();
  });

  it('rejects login when the password is incorrect', async () => {
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

    expect(sessionRepo.create).not.toHaveBeenCalled();
  });

  it('creates a session after successful login', async () => {
    const result = await useCase.execute({
      email: 'USER@example.com',
      password: 'correct-password',
    });

    expect(result.userId).toBe('user-1');
    expect(result.email).toBe('user@example.com');
    expect(result.accessToken).toBe('test-access-token');
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.expiresIn).toBe(900);

    expect(sessionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        refreshTokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    );
  });

  it('rejects incorrect passwords without creating a session', async () => {
    passwordHasher.verify.mockResolvedValue(false);

    for (let i = 0; i < 2; i++) {
      await expect(
        useCase.execute({
          email: 'user@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toMatchObject({
        code: ErrorCodes.UNAUTHENTICATED,
      });
    }

    expect(userRepo.findByEmailWithCredentials).toHaveBeenCalledTimes(2);
    expect(passwordHasher.verify).toHaveBeenCalledTimes(2);
    expect(sessionRepo.create).not.toHaveBeenCalled();
  });

  it('normalizes the email address before looking up the user', async () => {
    passwordHasher.verify.mockResolvedValue(false);

    await expect(
      useCase.execute({
        email: 'USER@EXAMPLE.COM',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({
      code: ErrorCodes.UNAUTHENTICATED,
    });

    expect(userRepo.findByEmailWithCredentials).toHaveBeenCalledWith('user@example.com');

    expect(sessionRepo.create).not.toHaveBeenCalled();
  });
});
