import fp from 'fastify-plugin';
import type { FastifyRequest } from 'fastify';

import {
  httpRequestDuration,
  httpRequestsTotal,
  metricsRegistry,
} from '../observability/metrics.js';

export default fp(async (fastify) => {
  const starts = new WeakMap<FastifyRequest, bigint>();

  fastify.addHook('onRequest', async (request) => {
    starts.set(request, process.hrtime.bigint());
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const start = starts.get(request);

    if (!start) {
      return;
    }

    const elapsedNs = process.hrtime.bigint() - start;

    const elapsedSeconds = Number(elapsedNs) / 1_000_000_000;

    const route = request.routeOptions.url ?? request.url;

    httpRequestsTotal.inc({
      method: request.method,
      route,
      status_code: String(reply.statusCode),
    });

    httpRequestDuration.observe(
      {
        method: request.method,
        route,
      },
      elapsedSeconds,
    );
  });

  fastify.get('/metrics', async (_request, reply) => {
    reply.type(metricsRegistry.contentType).send(await metricsRegistry.metrics());
  });
});
