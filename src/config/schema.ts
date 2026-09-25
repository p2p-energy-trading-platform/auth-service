import { z } from 'zod';

const booleanFromEnv = z.preprocess((value) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}, z.boolean().default(false));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  HTTP_HOST: z.string().default('0.0.0.0'),
  HTTP_PORT: z.coerce.number().int().positive().default(3000),

  GRPC_HOST: z.string().default('0.0.0.0'),
  GRPC_PORT: z.coerce.number().int().positive().default(50051),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  AUTH_ISSUER: z.string().url(),
  AUTH_AUDIENCE: z.string().min(1),

  AUTH_KEY_ID: z.string().min(1),

  AUTH_PRIVATE_KEY_PATH: z.string().min(1),
  AUTH_PUBLIC_KEY_PATH: z.string().min(1),

  AUTH_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  GRPC_TLS_ENABLED: booleanFromEnv,

  GRPC_TLS_CA_PATH: z.string().optional(),
  GRPC_TLS_CERT_PATH: z.string().optional(),
  GRPC_TLS_KEY_PATH: z.string().optional(),

  GRPC_TLS_REQUIRE_CLIENT_CERT: booleanFromEnv,
});

export type Env = z.infer<typeof envSchema>;
