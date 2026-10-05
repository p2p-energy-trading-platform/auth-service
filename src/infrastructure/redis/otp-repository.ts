import type { RedisClient } from './client.js';
import { otpAttemptsKey, otpCooldownKey, otpKey } from './keys.js';

export class OTPRepository {
  constructor(
    private readonly redis: RedisClient,
    private readonly ttlSeconds = 600,
    private readonly maxAttempts = 5,
  ) {}

  async setOtp(email: string, otp: string): Promise<void> {
    await this.redis
      .multi()
      .set(otpKey(email), otp, { EX: this.ttlSeconds })
      .del(otpAttemptsKey(email))
      .exec();
  }

  async getOtp(email: string): Promise<string | null> {
    return await this.redis.get(otpKey(email));
  }

  async deleteOtp(email: string): Promise<void> {
    await this.redis.del([otpKey(email), otpAttemptsKey(email)]);
  }

  async incrementAttempts(email: string): Promise<{ attempts: number; isExceeded: boolean }> {
    const attempts = await this.redis.incr(otpAttemptsKey(email));

    if (attempts === 1) {
      await this.redis.expire(otpAttemptsKey(email), this.ttlSeconds);
    }

    return {
      attempts,
      isExceeded: attempts > this.maxAttempts,
    };
  }

  async setResendCooldown(email: string, cooldownSeconds: number = 60): Promise<boolean> {
    const result = await this.redis.set(otpCooldownKey(email), '1', {
      EX: cooldownSeconds,
      condition: 'NX',
    });

    return result === 'OK';
  }
}
