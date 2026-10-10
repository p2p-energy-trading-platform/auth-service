export function sessionCacheKey(refreshTokenHash: string): string {
  return `session:${refreshTokenHash}`;
}

export type TemporaryTokenPurpose = 'password-reset' | 'email-verification';

export function temporaryTokenKey(purpose: TemporaryTokenPurpose, tokenHash: string): string {
  return `auth:${purpose}:${tokenHash}`;
}

export const otpKey = (email: string) => `otp:email_verification:${email}`;
export const otpAttemptsKey = (email: string) => `otp:attempts:${email}`;
export const otpCooldownKey = (email: string) => `otp:cooldown:${email}`;

export const loginAttemptsKey = (email: string) => `auth:login:attempts:${email}`;
export const loginLockKey = (email: string) => `auth:login:lock:${email}`;
