import type { FastifyPluginAsync } from 'fastify';

const jwksRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/.well-known/jwks.json', async (_request, reply) => {
    reply.header('Cache-Control', 'public, max-age=300');

    return fastify.keyService.getJwks();
  });
};

export default jwksRoute;
