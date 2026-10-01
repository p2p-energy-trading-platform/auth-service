export function sessionCacheKey(refreshTokenHash: string): string {
  return `session:${refreshTokenHash}`;
}
