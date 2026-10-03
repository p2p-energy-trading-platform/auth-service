export function sessionCacheKey(refreshTokenHash: string): string {
  return `session:${refreshTokenHash}`;
}

export type TemporaryTokenPurpose = 'password-reset' | 'email-verification';

export function temporaryTokenKey(purpose: TemporaryTokenPurpose, tokenHash: string): string {
  return `auth:${purpose}:${tokenHash}`;
}
