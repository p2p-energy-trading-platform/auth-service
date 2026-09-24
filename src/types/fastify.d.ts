import type { RedisClientType } from 'redis';

import type { GrpcServer } from '../transport/grpc/server.js';
import type { KeyProvider } from '../infrastructure/crypto/key-provider.js';
import type { JwtSigner } from '../infrastructure/crypto/jwt-signer.js';
import type { KeyService } from '../features/keys/service.js';
import type postgres from 'postgres';
import type { AppConfig } from '../config/types.ts';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;

    db: postgres.Sql;
    redis: RedisClientType;

    keyProvider: KeyProvider;
    keyService: KeyService;
    jwtSigner: JwtSigner;

    grpcServer: GrpcServer;
  }
}
