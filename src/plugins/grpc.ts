import fp from 'fastify-plugin';

import { GrpcServer } from '../transport/grpc/server.js';

export default fp(async (fastify) => {
  const grpcServer = new GrpcServer(fastify.config);

  fastify.decorate('grpcServer', grpcServer);

  fastify.addHook('onClose', async () => {
    await grpcServer.stop();
  });
});
