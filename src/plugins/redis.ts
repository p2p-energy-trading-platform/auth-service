import fp from 'fastify-plugin';
import { createRedisClient } from '../infrastructure/redis/client.js';

export default fp(async (fastify) => {
  const client = createRedisClient({
    url: fastify.config.REDIS_URL,
    onError: (error) => {
      fastify.log.error({ err: error }, 'Redis client error');
    },
  });

  await client.connect();

  fastify.decorate('redis', client);

  fastify.addHook('onClose', async () => {
    await client.close();
  });
});
