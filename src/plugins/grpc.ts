import fp from 'fastify-plugin';

import { GrpcServer } from '../transport/grpc/server.js';
import { UserRepository } from '../features/users/repository.js';
import { PasswordHasher } from '../infrastructure/crypto/password-hasher.js';
import { RegisterUseCase } from '../features/authentication/register.js';

export default fp(async (fastify) => {
  const userRepository = new UserRepository(fastify.db);
  const passwordHasher = new PasswordHasher();
  const registerUseCase = new RegisterUseCase(userRepository, passwordHasher);

  const grpcServer = new GrpcServer({
    config: fastify.config,
    registerUseCase: registerUseCase,
  });

  fastify.decorate('grpcServer', grpcServer);

  fastify.addHook('onClose', async () => {
    await grpcServer.stop();
  });
});
