import type { FastifyInstance } from 'fastify';

export async function readiness(fastify: FastifyInstance) {
  const checks = {
    database: false,
    redis: false,
  };

  try {
    await fastify.db`SELECT 1`;
    checks.database = true;
  } catch (error) {
    fastify.log.error({ err: error }, 'Database readiness check failed');
  }

  try {
    await fastify.redis.ping();
    checks.redis = true;
  } catch (error) {
    fastify.log.error({ err: error }, 'Redis readiness check failed');
  }

  const ready = checks.database && checks.redis;

  return {
    status: ready ? 'ok' : 'not_ready',
    checks,
  };
}
