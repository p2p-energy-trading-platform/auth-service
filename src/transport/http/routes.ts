import type { FastifyPluginAsync } from 'fastify';

import healthRoutes from './health/routes.js';
import jwksRoute from './jwks.js';

const httpRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(healthRoutes);
  await fastify.register(jwksRoute);
};

export default httpRoutes;
