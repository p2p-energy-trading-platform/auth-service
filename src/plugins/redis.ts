import fp from 'fastify-plugin';
import { createClient } from 'redis';

export default fp(async (fastify) => {
  const client = createClient({
    url: fastify.config.REDIS_URL,
  });

  client.on('error', (error) => {
    fastify.log.error({ err: error }, 'Redis client error');
  });

  await client.connect();

  fastify.decorate('redis', client);

  fastify.addHook('onClose', async () => {
    await client.close();
  });
});
