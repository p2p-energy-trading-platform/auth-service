import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import dbPlugin from './database.js';
import postgres from 'postgres';

// Mock the 'postgres' package
vi.mock('postgres', () => {
  const mockSql = vi.fn<(...args: any[]) => Promise<any>>().mockResolvedValue([{ '?column?': 1 }]);
  (mockSql as any).end = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

  return {
    default: vi.fn<() => typeof mockSql>(() => mockSql),
  };
});

describe('Database Plugin', () => {
  const TEST_DB_URL = 'postgres://user:pass@localhost:5432/test_db';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully connect, decorate fastify.sql, and close on shutdown', async () => {
    const fastify = Fastify({ logger: false });

    fastify.decorate('config', {
      DATABASE_URL: TEST_DB_URL,
    } as any);

    await fastify.register(dbPlugin);
    await fastify.ready();

    expect(postgres).toHaveBeenCalledWith(
      TEST_DB_URL,
      expect.objectContaining({
        max: 10,
        idle_timeout: 30,
        connect_timeout: 5,
      }),
    );

    // Verify fastify was decorated with the sql instance
    expect(fastify.db).toBeDefined();

    // Test onClose hook triggers sql.end()
    await fastify.close();
    expect(fastify.db.end).toHaveBeenCalledWith({ timeout: 5 });
  });

  it('should throw an error and fail startup if database connection fails', async () => {
    const fastify = Fastify({ logger: false });
    fastify.decorate('config', {
      DATABASE_URL: TEST_DB_URL,
    } as any);

    // Force sql`SELECT 1` to throw an error
    const mockSql = (postgres as any)();
    mockSql.mockRejectedValueOnce(new Error('Connection timeout'));

    await expect(fastify.register(dbPlugin).ready()).rejects.toThrow('Connection timeout');
  });
});
