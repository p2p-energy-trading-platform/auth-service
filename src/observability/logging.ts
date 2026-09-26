import type { FastifyServerOptions, RawServerDefault } from 'fastify';
import { type AppConfig } from '../config/types.js';

type LoggerOptions = NonNullable<FastifyServerOptions<RawServerDefault>['logger']>;

export function createLoggerOptions(config: AppConfig): LoggerOptions {
  return {
    level: config.LOG_LEVEL,

    base: {
      service: 'Auth Service',
      version: '1.00',
      environment: config.NODE_ENV,
    },

    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.accessToken',
        '*.refreshToken',
        '*.token',
      ],
      censor: '[REDACTED]',
    },
  };
}
