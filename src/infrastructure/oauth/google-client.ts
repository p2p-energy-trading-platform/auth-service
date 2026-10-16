import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';

export interface GoogleTokenPayload {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string | undefined;
}

export class GoogleClient {
  private JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

  constructor(
    private clientId: string,
    private clientSecret: string,
  ) {}

  async exchangeCode(code: string, redirectUri: string, codeVerifier: string): Promise<string> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new AppError(
        ErrorCodes.INTERNAL,
        `Failed to exchange Google authorization code: ${errText}`,
      );
    }

    const data = (await response.json()) as { id_token?: string };
    if (!data.id_token) {
      throw new AppError(ErrorCodes.INTERNAL, 'Google token response missing id_token');
    }
    return data.id_token;
  }

  async verifyIdToken(idToken: string, expectedNonce: string): Promise<GoogleTokenPayload> {
    const { payload } = await jwtVerify(idToken, this.JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: this.clientId,
    });

    if (payload.nonce !== expectedNonce) {
      throw new Error('Invalid Google ID token nonce');
    }

    return {
      sub: payload.sub as string,
      email: payload.email as string,
      email_verified: payload.email_verified as boolean,
      name: payload.name as string | undefined,
    };
  }
}
