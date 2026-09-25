import { Counter, Histogram, Registry, collectDefaultMetrics } from '@prometheus-io/client';

export const metricsRegistry = new Registry();

collectDefaultMetrics({
  register: metricsRegistry,
});

export const httpRequestsTotal = new Counter({
  name: 'auth_http_requests_total',
  help: 'Total HTTP requests handled by the auth service',
  labelNames: ['method', 'route', 'status_code'],
  registers: [metricsRegistry],
});

export const httpRequestDuration = new Histogram({
  name: 'auth_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  registers: [metricsRegistry],
});
