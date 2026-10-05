import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { EmailProvider } from '../../infrastructure/email/provider.js';
import type { TemporaryTokenStore } from '../../infrastructure/redis/temporary-token-store.js';
import type { UserRepository } from '../users/repository.js';

interface RequestEmailChangeInput {
  userId: string;
  newEmail: string;
}

export interface RequestEmailChangeResult {
  success: boolean;
}

interface EmailChangeTokenPayload {
  userId: string;
  newEmail: string;
}

export class RequestEmailChangeUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly temporaryTokenStore: TemporaryTokenStore,
    private readonly emailProvider: EmailProvider,
    private readonly emailChangeTokenTtlSeconds: number,
    private readonly emailChangeUrl: string,
  ) {}

  async execute(input: RequestEmailChangeInput): Promise<RequestEmailChangeResult> {
    if (!input.userId) {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Authenticated user is required');
    }

    if (!input.newEmail) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'New email is required');
    }

    const normalizedEmail = input.newEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'New email is required');
    }

    const existingUser = await this.userRepo.findByEmail(normalizedEmail);

    if (existingUser && existingUser.id !== input.userId) {
      throw new AppError(ErrorCodes.CONFLICT, 'Email address is already in use');
    }

    const currentUser = await this.userRepo.findById(input.userId);

    if (!currentUser) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'User not found');
    }

    if (currentUser.email.toLowerCase() === normalizedEmail) {
      throw new AppError(ErrorCodes.CONFLICT, 'New email must be different from the current email');
    }

    const payload: EmailChangeTokenPayload = {
      userId: input.userId,
      newEmail: normalizedEmail,
    };

    const token = await this.temporaryTokenStore.create(
      'email-verification',
      JSON.stringify(payload),
      this.emailChangeTokenTtlSeconds,
    );

    const verificationUrl = new URL(this.emailChangeUrl);
    verificationUrl.searchParams.set('token', token);

    await this.emailProvider.send({
      to: normalizedEmail,
      subject: 'Verify your new GridX email address',
      text: [
        'We received a request to change the email address on your GridX account.',
        '',
        `Use this link to verify your new email address: ${verificationUrl.toString()}`,
        '',
        `This link expires in ${Math.floor(this.emailChangeTokenTtlSeconds / 60)} minutes.`,
        '',
        'If you did not request this change, you can ignore this email.',
      ].join('\n'),
      html: `
        <p>We received a request to change the email address on your GridX account.</p>
        <p>
          <a href="${verificationUrl.toString()}">Verify your new email address</a>
        </p>
        <p>
          This link expires in
          ${Math.floor(this.emailChangeTokenTtlSeconds / 60)} minutes.
        </p>
        <p>If you did not request this change, you can ignore this email.</p>
      `.trim(),
    });

    return {
      success: true,
    };
  }
}
