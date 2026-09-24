import { readFileSync } from 'node:fs';

import * as grpc from '@grpc/grpc-js';
import type { AppConfig } from '../../config/types.js';

export function createServerCredentials(config: AppConfig): grpc.ServerCredentials {
  if (!config.GRPC_TLS_ENABLED) {
    return grpc.ServerCredentials.createInsecure();
  }

  if (!config.GRPC_TLS_CERT_PATH || !config.GRPC_TLS_KEY_PATH) {
    throw new Error('GRPC TLS is enabled but certificate/key paths are missing');
  }

  const certChain = readFileSync(config.GRPC_TLS_CERT_PATH);

  const privateKey = readFileSync(config.GRPC_TLS_KEY_PATH);

  let rootCerts: Buffer | null = null;

  if (config.GRPC_TLS_CA_PATH) {
    rootCerts = readFileSync(config.GRPC_TLS_CA_PATH);
  }

  if (config.GRPC_TLS_REQUIRE_CLIENT_CERT && !rootCerts) {
    throw new Error('Client certificate verification requires a CA certificate');
  }

  return grpc.ServerCredentials.createSsl(
    rootCerts,
    [
      {
        private_key: privateKey,
        cert_chain: certChain,
      },
    ],
    config.GRPC_TLS_REQUIRE_CLIENT_CERT,
  );
}
