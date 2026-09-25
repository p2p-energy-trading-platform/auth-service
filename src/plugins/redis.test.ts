import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import redisPlugin from './redis.js';
import { createClient } from 'redis';

vi.mock('redis', () => {
  const mockClient = {
    on: vi.fn<(event: string, listener: (...args: any[]) => void) => void>(),
    connect: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    close: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };

  return {
    createClient: vi.fn<(options?: any) => typeof mockClient>(() => mockClient),
  };
});

describe('Redis Plugin', () => {
  const TEST_REDIS_URL = 'redis://localhost:6379';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully connect, decorate fastify.redis, and close on shutdown', async () => {
    const fastify = Fastify({ logger: false });

    fastify.decorate('config', {
      REDIS_URL: TEST_REDIS_URL,
    } as any);

    await fastify.register(redisPlugin);
    await fastify.ready();

    expect(createClient).toHaveBeenCalledWith({
      url: TEST_REDIS_URL,
    });

    expect(fastify.redis).toBeDefined();

    expect(fastify.redis.connect).toHaveBeenCalledTimes(1);

    await fastify.close();
    expect(fastify.redis.close).toHaveBeenCalledTimes(1);
  });

  it('should throw an error and fail startup if Redis connection fails', async () => {
    const fastify = Fastify({ logger: false });

    fastify.decorate('config', {
      REDIS_URL: TEST_REDIS_URL,
    } as any);

    // Force client.connect() to fail
    const mockClient = createClient();
    vi.mocked(mockClient.connect).mockRejectedValueOnce(new Error('Redis connection refused'));

    await expect(fastify.register(redisPlugin).ready()).rejects.toThrow('Redis connection refused');
  });
});
