import { randomInt } from 'node:crypto';
import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { PasswordHasher } from '../../infrastructure/crypto/password-hasher.js';
import type { RegisteredUser, UserRepository } from '../users/repository.js';
import type { EmailProvider } from '../../infrastructure/email/provider.js';
import type { OTPRepository } from '../../infrastructure/redis/otp-repository.js';

interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export class RegisterUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly emailProvider: EmailProvider,
    private readonly otpRepo: OTPRepository,
  ) {}

  async execute(input: RegisterInput): Promise<RegisteredUser> {
    if (!input.email || !input.password) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Email and password are required');
    }

    if (input.password.length < 8) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Invalid Password');
    }

    const name = input.name.trim();

    if (!name) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Name is required');
    }

    if (name.length > 100) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Name must not exceed 100 characters');
    }

    const normalizedEmail = input.email.trim().toLowerCase();

    const existingUser = await this.userRepo.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new AppError(ErrorCodes.CONFLICT, 'An account with this email already exists');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    try {
      const user = await this.userRepo.createUsersWithCredentials({
        email: normalizedEmail,
        passwordHash,
        name,
      });

      const otp = randomInt(100000, 1000000).toString();
      await this.otpRepo.setOtp(normalizedEmail, otp);

      await this.emailProvider.send({
        to: normalizedEmail,
        subject: 'Verify your GridX account',
        text: [
          'You signed up to GridX website',
          '',
          `Enter the following OTP to verify your account = ${otp}`,
          '',
          `This OTp expires in 10 minutes.`,
          '',
          'If you did not sign up for gridx, you can ignore this email.',
        ].join('\n'),
        html: `
          <p>You signed up to GridX website</p>
          <p>
            OTP Number: ${otp}
          </p>
          <p>
            This OTP expires in 10 minutes.
          </p>
          <p>If you did not sign up for gridx, you can ignore this email.</p>
        `.trim(),
      });

      return user;
    } catch (error: any) {
      if (error.code === '23505') {
        throw new AppError(ErrorCodes.CONFLICT, 'An account with this email already exists');
      }

      throw error;
    }
  }
}
