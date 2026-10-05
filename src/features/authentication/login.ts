import { randomBytes } from 'node:crypto';
import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { JwtSigner } from '../../infrastructure/crypto/jwt-signer.js';
import { hashOpaqueToken } from '../../infrastructure/crypto/token-hasher.js';
import type { PasswordHasher } from '../../infrastructure/crypto/password-hasher.js';
import type { SessionRepository } from '../sessions/repository.js';
import type { UserRepository } from '../users/repository.js';

interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class LoginUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly jwtSigner: JwtSigner,
    private readonly sessionRepo: SessionRepository,
    private readonly accessTokenTtlSeconds: number,
    private readonly refreshTokenTtlSeconds: number,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    if (!input.email || !input.password) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Email and password are required');
    }

    const normalizedEmail = input.email.trim().toLowerCase();

    const user = await this.userRepo.findByEmailWithCredentials(normalizedEmail);

    if (!user) {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Invalid email or password');
    }

    const passwordValid = await this.passwordHasher.verify(user.passwordHash, input.password);

    if (!passwordValid) {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Account is not active');
    }

    const accessToken = await this.jwtSigner.signAccessToken({
      sub: user.id,
      role: user.role,
    });

    const refreshToken = randomBytes(32).toString('base64url');
    const refreshTokenHash = hashOpaqueToken(refreshToken);

    const expiresAt = new Date(Date.now() + this.refreshTokenTtlSeconds * 1000);

    await this.sessionRepo.create({
      userId: user.id,
      refreshTokenHash,
      expiresAt,
    });

    return {
      userId: user.id,
      email: user.email,
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenTtlSeconds,
    };
  }
}
