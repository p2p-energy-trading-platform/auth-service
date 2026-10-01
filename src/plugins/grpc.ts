import fp from 'fastify-plugin';

import { GrpcServer } from '../transport/grpc/server.js';
import { UserRepository } from '../features/users/repository.js';
import { SessionRepository } from '../features/sessions/repository.js';
import { PasswordHasher } from '../infrastructure/crypto/password-hasher.js';
import { RegisterUseCase } from '../features/authentication/register.js';
import { LoginUseCase } from '../features/authentication/login.js';
import { LogoutUseCase } from '../features/authentication/logout.js';

export default fp(async (fastify) => {
  const userRepository = new UserRepository(fastify.db);
  const sessionRepository = new SessionRepository(fastify.db);
  const passwordHasher = new PasswordHasher();

  const registerUseCase = new RegisterUseCase(userRepository, passwordHasher);

  const loginUseCase = new LoginUseCase(
    userRepository,
    passwordHasher,
    fastify.jwtSigner,
    sessionRepository,
    fastify.config.AUTH_ACCESS_TOKEN_TTL_SECONDS,
    fastify.config.AUTH_REFRESH_TOKEN_TTL_SECONDS,
  );

  const logoutUseCase = new LogoutUseCase(sessionRepository);

  const grpcServer = new GrpcServer({
    config: fastify.config,
    registerUseCase,
    loginUseCase,
    logoutUseCase,
  });

  fastify.decorate('grpcServer', grpcServer);

  fastify.addHook('onClose', async () => {
    await grpcServer.stop();
  });
});
