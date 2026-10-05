import { describe, expect, it, vi } from 'vitest';

import { RedisTemporaryTokenStore } from './temporary-token-store.js';

function createRedisMock() {
  return {
    set: vi.fn<(key: string, value: string, options: { EX: number }) => Promise<string>>(),
    get: vi.fn<(key: string) => Promise<string | null>>(),
    del: vi.fn<(key: string) => Promise<number>>(),
  };
}

describe('RedisTemporaryTokenStore', () => {
  it('should generate a token and store only its hash', async () => {
    const redis = createRedisMock();
    redis.set.mockResolvedValue('OK');

    const store = new RedisTemporaryTokenStore(redis as never);

    const token = await store.create('password-reset', 'user-123', 900);

    expect(token).toBeTruthy();
    expect(token.length).toBeGreaterThan(20);

    expect(redis.set).toHaveBeenCalledTimes(1);

    const [key, payload, options] = redis.set.mock.calls[0]!;

    expect(key).toMatch(/^auth:password-reset:[a-f0-9]{64}$/);
    expect(key).not.toContain(token);
    expect(payload).toBe('user-123');
    expect(options).toEqual({ EX: 900 });
  });

  it('should retrieve a token payload using the token hash', async () => {
    const redis = createRedisMock();
    redis.get.mockResolvedValue('user-123');

    const store = new RedisTemporaryTokenStore(redis as never);

    const result = await store.get('password-reset', 'test-token');

    expect(result).toBe('user-123');

    expect(redis.get).toHaveBeenCalledTimes(1);

    const [key] = redis.get.mock.calls[0]!;

    expect(key).toMatch(/^auth:password-reset:[a-f0-9]{64}$/);
    expect(key).not.toContain('test-token');
  });

  it('should return null when the token does not exist', async () => {
    const redis = createRedisMock();
    redis.get.mockResolvedValue(null);

    const store = new RedisTemporaryTokenStore(redis as never);

    const result = await store.get('password-reset', 'missing-token');

    expect(result).toBeNull();
  });

  it('should delete a token using its hash', async () => {
    const redis = createRedisMock();
    redis.del.mockResolvedValue(1);

    const store = new RedisTemporaryTokenStore(redis as never);

    await store.delete('email-verification', 'test-token');

    expect(redis.del).toHaveBeenCalledTimes(1);

    const [key] = redis.del.mock.calls[0]!;

    expect(key).toMatch(/^auth:email-verification:[a-f0-9]{64}$/);
    expect(key).not.toContain('test-token');
  });

  it('should reject a non-positive TTL', async () => {
    const redis = createRedisMock();

    const store = new RedisTemporaryTokenStore(redis as never);

    await expect(store.create('password-reset', 'user-123', 0)).rejects.toThrow(
      'Temporary token TTL must be a positive integer',
    );

    expect(redis.set).not.toHaveBeenCalled();
  });
});
