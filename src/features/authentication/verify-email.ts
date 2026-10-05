import { AppError } from "../../errors/app-error.js";
import { ErrorCodes } from "../../errors/codes.js";
import type { OTPRepository } from "../../infrastructure/redis/otp-repository.js";
import type { UserRepository } from "../users/repository.js";

interface VerifyEmailInput {
    email: string;
    otp: string;
}

export class VerifyEmailUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly otpRepo: OTPRepository,
  ) {}

  async execute(input: VerifyEmailInput): Promise<void> {
    if (!input.email || !input.otp) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Email and OTP are required');
    }

    const normalizedEmail = input.email.trim().toLowerCase();

    const user = await this.userRepo.findByEmail(normalizedEmail);
    if (!user) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'User not found');
    }

    if (user.status === 'ACTIVE') {
      throw new AppError(ErrorCodes.CONFLICT, 'User is already verified');
    }

    const storedOtp = await this.otpRepo.getOtp(normalizedEmail);
    if (!storedOtp) {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'OTP has expired or was not requested');
    }

    const { isExceeded } = await this.otpRepo.incrementAttempts(normalizedEmail);
    if (isExceeded) {
      await this.otpRepo.deleteOtp(normalizedEmail);
      throw new AppError(ErrorCodes.RATE_LIMITED, 'Too many invalid attempts. Please request a new OTP.');
    }

    if (storedOtp !== input.otp.trim()) {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Invalid OTP code');
    }

    await this.userRepo.updateStatus(user.id, 'ACTIVE');

    await this.otpRepo.deleteOtp(normalizedEmail);
  }
}