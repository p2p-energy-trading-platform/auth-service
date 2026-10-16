import { randomBytes } from 'node:crypto';
import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { JwtSigner } from '../../infrastructure/crypto/jwt-signer.js';
import type { GoogleClient } from '../../infrastructure/oauth/google-client.js';
import type { SessionRepository } from '../sessions/repository.js';
import type { RegisteredUser, UserRepository } from '../users/repository.js';
import { hashOpaqueToken } from '../../infrastructure/crypto/token-hasher.js';

interface LoginWithGoogleInput {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  nonce: string;
}

export interface LoginWithGoogleResult {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  isNewUser: boolean;
}

export class LoginWithGoogleUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly googleClient: GoogleClient,
    private readonly jwtSigner: JwtSigner,
    private readonly sessionRepo: SessionRepository,
    private readonly accessTokenTtlSeconds: number,
    private readonly refreshTokenTtlSeconds: number,
  ) {}

  async execute(input: LoginWithGoogleInput): Promise<LoginWithGoogleResult> {
    if (!input.code || !input.codeVerifier || !input.redirectUri || !input.nonce) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Missing required Google OAuth parameters');
    }

    const idToken = await this.googleClient.exchangeCode(
      input.code,
      input.redirectUri,
      input.codeVerifier,
    );

    // Verify ID token signature, audience, and nonce
    const googleUser = await this.googleClient.verifyIdToken(idToken, input.nonce);

    if (!googleUser.email_verified) {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Google email is not verified');
    }

    const normalizedEmail = googleUser.email.trim().toLowerCase();
    let isNewUser = false;
    let user: RegisteredUser | null = null;

    user = await this.userRepo.findByIdentity('google', googleUser.sub);

    if (!user) {
      user = await this.userRepo.findByEmail(normalizedEmail);

      if (user) {
        await this.userRepo.linkIdentity(user.id, 'google', googleUser.sub, normalizedEmail);

        if (user.status === 'PENDING') {
          await this.userRepo.markEmailVerifiedAndActive(user.id);
        }
      } else {
        isNewUser = true;
        const fallbackName = normalizedEmail.split('@')[0] ?? 'User';
        const rawName = googleUser.name?.trim() || fallbackName;
        const name = rawName.slice(0, 100); // Matches DB schema (max 100 chars)

        user = await this.userRepo.createUserWithIdentity({
          email: normalizedEmail,
          name,
          provider: 'google',
          providerSubject: googleUser.sub,
        });
      }
    }

    if (user.status === 'SUSPENDED' || user.status === 'DISABLED') {
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
      isNewUser,
    };
  }
}
