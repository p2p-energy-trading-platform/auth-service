import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EmailProvider } from '../../infrastructure/email/provider.js';
import type { OTPRepository } from '../../infrastructure/redis/otp-repository.js';
import type { PasswordHasher } from '../../infrastructure/crypto/password-hasher.js';
import type { UserRepository } from '../users/repository.js';

import { RegisterUseCase } from './register.js';
import { VerifyEmailUseCase } from './verify-email.js';
import { ResendOtpUseCase } from './resend-otp.js';

const userRepo = {
  findByEmail: vi.fn<UserRepository['findByEmail']>(),
  createUsersWithCredentials: vi.fn<UserRepository['createUsersWithCredentials']>(),
  updateStatus: vi.fn<UserRepository['updateStatus']>(),
};

const passwordHasher = {
  hash: vi.fn<PasswordHasher['hash']>(),
};

const emailProvider = {
  send: vi.fn<EmailProvider['send']>(),
};

const otpRepo = {
  setOtp: vi.fn<OTPRepository['setOtp']>(),
  getOtp: vi.fn<OTPRepository['getOtp']>(),
  incrementAttempts: vi.fn<OTPRepository['incrementAttempts']>(),
  deleteOtp: vi.fn<OTPRepository['deleteOtp']>(),
  setResendCooldown: vi.fn<OTPRepository['setResendCooldown']>(),
};

const registeredUser = {
  id: 'user-123',
  email: 'user@example.com',
  name: 'Test User',
  status: 'PENDING',
  role: 'user',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const createRegisterUseCase = () =>
  new RegisterUseCase(
    userRepo as unknown as UserRepository,
    passwordHasher as unknown as PasswordHasher,
    emailProvider as unknown as EmailProvider,
    otpRepo as unknown as OTPRepository,
  );

const createVerifyEmailUseCase = () =>
  new VerifyEmailUseCase(
    userRepo as unknown as UserRepository,
    otpRepo as unknown as OTPRepository,
  );

const createResendOtpUseCase = () =>
  new ResendOtpUseCase(
    userRepo as unknown as UserRepository,
    emailProvider as unknown as EmailProvider,
    otpRepo as unknown as OTPRepository,
  );

beforeEach(() => {
  vi.clearAllMocks();

  userRepo.findByEmail.mockResolvedValue(null);
  userRepo.createUsersWithCredentials.mockResolvedValue(registeredUser);
  userRepo.updateStatus.mockResolvedValue(true);

  passwordHasher.hash.mockResolvedValue('hashed-password');

  emailProvider.send.mockResolvedValue(undefined);

  otpRepo.setOtp.mockResolvedValue(undefined);
  otpRepo.getOtp.mockResolvedValue('123456');
  otpRepo.incrementAttempts.mockResolvedValue({
    attempts: 1,
    isExceeded: false,
  });
  otpRepo.deleteOtp.mockResolvedValue(undefined);
  otpRepo.setResendCooldown.mockResolvedValue(true);
});

describe('RegisterUseCase', () => {
  it('creates a pending account, stores an OTP, and sends a verification email', async () => {
    const result = await createRegisterUseCase().execute({
      name: 'Test User',
      email: ' USER@EXAMPLE.COM ',
      password: 'Password123!',
    });

    expect(result).toEqual(registeredUser);
    expect(userRepo.findByEmail).toHaveBeenCalledWith('user@example.com');
    expect(passwordHasher.hash).toHaveBeenCalledWith('Password123!');

    expect(userRepo.createUsersWithCredentials).toHaveBeenCalledWith({
      email: 'user@example.com',
      passwordHash: 'hashed-password',
      name: 'Test User',
    });

    expect(otpRepo.setOtp).toHaveBeenCalledWith(
      'user@example.com',
      expect.stringMatching(/^\d{6}$/),
    );

    expect(emailProvider.send).toHaveBeenCalledTimes(1);

    const email = emailProvider.send.mock.calls[0]![0];
    expect(email.to).toBe('user@example.com');
    expect(email.subject).toBe('Verify your GridX account');
    expect(email.text).toContain('OTP');
    expect(email.html).toContain('OTP Number');
  });

  it('rejects when the email is missing', async () => {
    await expect(
      createRegisterUseCase().execute({
        name: 'Test User',
        email: '',
        password: 'Password123!',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });

  it('rejects when the password is missing', async () => {
    await expect(
      createRegisterUseCase().execute({
        name: 'Test User',
        email: 'user@example.com',
        password: '',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });

  it('rejects passwords shorter than eight characters', async () => {
    await expect(
      createRegisterUseCase().execute({
        name: 'Test User',
        email: 'user@example.com',
        password: 'short',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

    expect(userRepo.createUsersWithCredentials).not.toHaveBeenCalled();
  });

  it('rejects an email that already has an account', async () => {
    userRepo.findByEmail.mockResolvedValue(registeredUser);

    await expect(
      createRegisterUseCase().execute({
        name: 'Test User',
        email: 'user@example.com',
        password: 'Password123!',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(userRepo.createUsersWithCredentials).not.toHaveBeenCalled();
    expect(emailProvider.send).not.toHaveBeenCalled();
  });
});

describe('VerifyEmailUseCase', () => {
  it('activates the account and deletes the OTP after successful verification', async () => {
    userRepo.findByEmail.mockResolvedValue(registeredUser);
    otpRepo.getOtp.mockResolvedValue('123456');

    await expect(
      createVerifyEmailUseCase().execute({
        email: ' USER@EXAMPLE.COM ',
        otp: '123456',
      }),
    ).resolves.toBeUndefined();

    expect(userRepo.findByEmail).toHaveBeenCalledWith('user@example.com');
    expect(userRepo.updateStatus).toHaveBeenCalledWith('user-123', 'ACTIVE');
    expect(otpRepo.deleteOtp).toHaveBeenCalledWith('user@example.com');
  });

  it('rejects when email or OTP is missing', async () => {
    await expect(
      createVerifyEmailUseCase().execute({ email: '', otp: '123456' }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

    await expect(
      createVerifyEmailUseCase().execute({
        email: 'user@example.com',
        otp: '',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });

  it('rejects when the account does not exist', async () => {
    userRepo.findByEmail.mockResolvedValue(null);

    await expect(
      createVerifyEmailUseCase().execute({
        email: 'missing@example.com',
        otp: '123456',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(otpRepo.getOtp).not.toHaveBeenCalled();
  });

  it('rejects when the account is already active', async () => {
    userRepo.findByEmail.mockResolvedValue({
      ...registeredUser,
      status: 'ACTIVE',
    });

    await expect(
      createVerifyEmailUseCase().execute({
        email: 'user@example.com',
        otp: '123456',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects an expired or missing OTP', async () => {
    userRepo.findByEmail.mockResolvedValue(registeredUser);
    otpRepo.getOtp.mockResolvedValue(null);

    await expect(
      createVerifyEmailUseCase().execute({
        email: 'user@example.com',
        otp: '123456',
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });

    expect(userRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('rejects an incorrect OTP', async () => {
    userRepo.findByEmail.mockResolvedValue(registeredUser);
    otpRepo.getOtp.mockResolvedValue('654321');

    await expect(
      createVerifyEmailUseCase().execute({
        email: 'user@example.com',
        otp: '123456',
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });

    expect(userRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('deletes the OTP after too many verification attempts', async () => {
    userRepo.findByEmail.mockResolvedValue(registeredUser);
    otpRepo.incrementAttempts.mockResolvedValue({
      attempts: 6,
      isExceeded: true,
    });

    await expect(
      createVerifyEmailUseCase().execute({
        email: 'user@example.com',
        otp: '123456',
      }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });

    expect(otpRepo.deleteOtp).toHaveBeenCalledWith('user@example.com');
    expect(userRepo.updateStatus).not.toHaveBeenCalled();
  });
});

describe('ResendOtpUseCase', () => {
  it('generates and emails a new OTP when resend is allowed', async () => {
    userRepo.findByEmail.mockResolvedValue(registeredUser);

    await expect(createResendOtpUseCase().execute(' USER@EXAMPLE.COM ')).resolves.toBeUndefined();

    expect(userRepo.findByEmail).toHaveBeenCalledWith('user@example.com');
    expect(otpRepo.setResendCooldown).toHaveBeenCalledWith('user@example.com', 60);
    expect(otpRepo.setOtp).toHaveBeenCalledWith(
      'user@example.com',
      expect.stringMatching(/^\d{6}$/),
    );
    expect(emailProvider.send).toHaveBeenCalledTimes(1);
    expect(emailProvider.send.mock.calls[0]![0].to).toBe('user@example.com');
  });

  it('rejects when the email is missing', async () => {
    await expect(createResendOtpUseCase().execute('')).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
  });

  it('rejects when the account does not exist', async () => {
    userRepo.findByEmail.mockResolvedValue(null);

    await expect(createResendOtpUseCase().execute('missing@example.com')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    expect(emailProvider.send).not.toHaveBeenCalled();
  });

  it('rejects resend requests for an already verified account', async () => {
    userRepo.findByEmail.mockResolvedValue({
      ...registeredUser,
      status: 'ACTIVE',
    });

    await expect(createResendOtpUseCase().execute('user@example.com')).rejects.toMatchObject({
      code: 'CONFLICT',
    });

    expect(otpRepo.setResendCooldown).not.toHaveBeenCalled();
  });

  it('rejects when the resend cooldown is active', async () => {
    userRepo.findByEmail.mockResolvedValue(registeredUser);
    otpRepo.setResendCooldown.mockResolvedValue(false);

    await expect(createResendOtpUseCase().execute('user@example.com')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });

    expect(otpRepo.setOtp).not.toHaveBeenCalled();
    expect(emailProvider.send).not.toHaveBeenCalled();
  });
});
