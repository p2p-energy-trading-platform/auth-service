import type { FastifyPluginAsync } from 'fastify';

import { liveness } from './liveness.js';
import { readiness } from './readiness.js';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health/live', async () => {
    return liveness();
  });

  fastify.get('/health/ready', async (_request, reply) => {
    const result = await readiness(fastify);

    if (result.status !== 'ok') {
      return reply.code(503).send(result);
    }

    return result;
  });
};

export default healthRoutes;
