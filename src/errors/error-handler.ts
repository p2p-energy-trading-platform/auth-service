import type { FastifyInstance } from 'fastify';

import { AppError } from './app-error.js';

export function registerErrorHandler(fastify: FastifyInstance): void {
  fastify.setErrorHandler(async (error, request, reply) => {
    if (error instanceof AppError) {
      request.log.warn(
        {
          code: error.code,
        },
        error.message,
      );

      return reply.code(error.httpStatus).send({
        error: error.code,
        message: error.message,
      });
    }

    request.log.error({ err: error }, 'Unhandled application error');

    return reply.code(500).send({
      error: 'INTERNAL',
      message: 'Internal server error',
    });
  });
}
