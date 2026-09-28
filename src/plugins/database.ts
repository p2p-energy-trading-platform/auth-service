import fp from 'fastify-plugin';
import { createDbClient } from '../infrastructure/database/client.js';

export default fp(async (fastify) => {
  const sql = createDbClient({
    databaseUrl: fastify.config.DATABASE_URL,
    max: 10,
    idleTimeout: 30, // seconds
    connectTimeout: 5, // seconds
    onNotice: (notice) => fastify.log.debug({ notice }, 'PostgreSQL notice'),
  });

  // Test the database connection on startup
  try {
    await sql`SELECT 1`;
    fastify.log.info('PostgreSQL database connected');
  } catch (error) {
    fastify.log.error({ err: error }, 'Failed to connect to PostgreSQL');
    throw error;
  }

  fastify.decorate('db', sql);

  fastify.addHook('onClose', async () => {
    await sql.end({ timeout: 5 });
  });
});
