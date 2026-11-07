import { randomInt } from 'node:crypto';
import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { EmailProvider } from '../../infrastructure/email/provider.js';
import { resendOtpEmail } from '../../infrastructure/email/templates/auth-emails.js';
import {
  OTP_EXPIRY_MINUTES,
  type OTPRepository,
} from '../../infrastructure/redis/otp-repository.js';
import type { UserRepository } from '../users/repository.js';

export class ResendOtpUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly emailProvider: EmailProvider,
    private readonly otpRepo: OTPRepository,
  ) {}

  async execute(email: string): Promise<void> {
    if (!email) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Email is required');
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.userRepo.findByEmail(normalizedEmail);
    if (!user) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'User not found');
    }

    if (user.status === 'ACTIVE') {
      throw new AppError(ErrorCodes.CONFLICT, 'User is already verified');
    }

    // Rate limiting check
    const canResend = await this.otpRepo.setResendCooldown(normalizedEmail, 60);
    if (!canResend) {
      throw new AppError(
        ErrorCodes.RATE_LIMITED,
        'Please wait 60 seconds before requesting a new OTP',
      );
    }

    const otp = randomInt(100000, 1000000).toString();
    await this.otpRepo.setOtp(normalizedEmail, otp);

    await this.emailProvider.send({
      to: normalizedEmail,
      ...resendOtpEmail({ name: user.name, otp, expiresInMinutes: OTP_EXPIRY_MINUTES }),
    });
  }
}
