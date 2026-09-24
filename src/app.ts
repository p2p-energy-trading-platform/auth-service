import Fastify from 'fastify';

import databasePlugin from './plugins/database.js';
import grpcPlugin from './plugins/grpc.js';
import observabilityPlugin from './plugins/observability.js';
import redisPlugin from './plugins/redis.js';
import securityPlugin from './plugins/security.js';

import httpRoutes from './transport/http/routes.js';

import { registerErrorHandler } from './errors/error-handler.js';
import { config } from './config/env.js';
import type { AppConfig } from './config/types.js';

export interface BuildAppOptions {
  config?: AppConfig;
}

export function buildApp(options: BuildAppOptions = {}) {
  const cfg = options.config ?? config;
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
    },

    bodyLimit: 1_048_576,
  });

  app.decorate('config', cfg);

  registerErrorHandler(app);

  app.register(observabilityPlugin);
  app.register(databasePlugin);
  app.register(redisPlugin);
  app.register(securityPlugin);
  app.register(grpcPlugin);

  app.register(httpRoutes);

  return app;
}
