import Fastify from 'fastify';

import databasePlugin from './plugins/database.js';
import grpcPlugin from './plugins/grpc.js';
import observabilityPlugin from './plugins/observability.js';
import redisPlugin from './plugins/redis.js';
import securityPlugin from './plugins/security.js';

import httpRoutes from './transport/http/routes.js';

import { registerErrorHandler } from './errors/error-handler.js';
import type { AppConfig } from './config/types.js';
import { createLoggerOptions } from './observability/logging.js';

export interface BuildAppOptions {
  config: AppConfig;
  registerInfrastructure?: boolean;
}

export function buildApp(options: BuildAppOptions) {
  const { config, registerInfrastructure = true } = options;

  const app = Fastify({
    logger: createLoggerOptions(config),

    bodyLimit: 1_048_576,
  });

  app.decorate('config', config);

  registerErrorHandler(app);

  app.register(observabilityPlugin);

  if (registerInfrastructure) {
    app.register(databasePlugin);
    app.register(redisPlugin);
  }

  app.register(securityPlugin);
  app.register(grpcPlugin);

  app.register(httpRoutes);

  return app;
}
