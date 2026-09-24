import fp from 'fastify-plugin';
import postgres from 'postgres';

export default fp(async (fastify) => {
  const sql = postgres(fastify.config.DATABASE_URL, {
    max: 10,
    idle_timeout: 30, // seconds
    connect_timeout: 5, // seconds
    onnotice: (notice) => fastify.log.debug({ notice }, 'PostgreSQL notice'),
  });

  // Test the database connection on startup
  try {
    await sql`SELECT 1`;
    fastify.log.info('PostgreSQL database connected');
  } catch (error) {
    fastify.log.error({ err: error }, 'Failed to connect to PostgreSQL');
    throw error;
  }

  fastify.decorate('sql', sql);

  fastify.addHook('onClose', async () => {
    await sql.end({ timeout: 5 });
  });
});
