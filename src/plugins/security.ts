import fp from 'fastify-plugin';

import { JwtSigner } from '../infrastructure/crypto/jwt-signer.js';
import { KeyProvider } from '../infrastructure/crypto/key-provider.js';
import { KeyService } from '../features/keys/service.js';

export default fp(async (fastify) => {
  const keyProvider = await KeyProvider.fromFiles({
    privateKeyPath: fastify.config.AUTH_PRIVATE_KEY_PATH,
    publicKeyPath: fastify.config.AUTH_PUBLIC_KEY_PATH,
    keyId: fastify.config.AUTH_KEY_ID,
  });

  const keyService = new KeyService(keyProvider);

  const jwtSigner = new JwtSigner(
    keyProvider,
    fastify.config.AUTH_ISSUER,
    fastify.config.AUTH_AUDIENCE,
    fastify.config.AUTH_ACCESS_TOKEN_TTL_SECONDS,
  );

  fastify.decorate('keyProvider', keyProvider);
  fastify.decorate('keyService', keyService);
  fastify.decorate('jwtSigner', jwtSigner);

  fastify.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
  });
});
