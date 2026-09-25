import 'dotenv/config';

import { envSchema } from './schema.js';
import type { AppConfig } from './types.js';

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment configuration:');
  console.error(result.error.format());
  throw new Error('Invalid environment configuration');
}

export const config: AppConfig = result.data;
