import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { EmailProvider } from '../../infrastructure/email/provider.js';
import type { TemporaryTokenStore } from '../../infrastructure/redis/temporary-token-store.js';
import type { UserRepository } from '../users/repository.js';

interface RequestPasswordResetInput {
  email: string;
}

export interface RequestPasswordResetResult {
  success: boolean;
}

export class RequestPasswordResetUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly temporaryTokenStore: TemporaryTokenStore,
    private readonly emailProvider: EmailProvider,
    private readonly passwordResetTokenTtlSeconds: number,
    private readonly passwordResetUrl: string,
  ) {}

  async execute(input: RequestPasswordResetInput): Promise<RequestPasswordResetResult> {
    if (!input.email) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Email is required');
    }

    const normalizedEmail = input.email.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Email is required');
    }

    const user = await this.userRepo.findByEmail(normalizedEmail);

    // Do not reveal whether an account exists for this email.
    if (!user) {
      return { success: true };
    }

    const token = await this.temporaryTokenStore.create(
      'password-reset',
      user.id,
      this.passwordResetTokenTtlSeconds,
    );

    const resetUrl = new URL(this.passwordResetUrl);
    resetUrl.searchParams.set('token', token);

    await this.emailProvider.send({
      to: normalizedEmail,
      subject: 'Reset your GridX password',
      text: [
        'We received a request to reset your GridX password.',
        '',
        `Use this link to reset your password: ${resetUrl.toString()}`,
        '',
        `This link expires in ${Math.floor(this.passwordResetTokenTtlSeconds / 60)} minutes.`,
        '',
        'If you did not request a password reset, you can ignore this email.',
      ].join('\n'),
      html: `
        <p>We received a request to reset your GridX password.</p>
        <p>
          <a href="${resetUrl.toString()}">Reset your password</a>
        </p>
        <p>
          This link expires in
          ${Math.floor(this.passwordResetTokenTtlSeconds / 60)} minutes.
        </p>
        <p>If you did not request a password reset, you can ignore this email.</p>
      `.trim(),
    });

    return { success: true };
  }
}
