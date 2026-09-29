import { readFileSync } from 'node:fs';

import type { AppConfig } from '../../config/types.js';
import type { SecureServerOptions } from 'node:http2';

export function createTlsOptions(config: AppConfig): SecureServerOptions | null {
  if (!config.GRPC_TLS_ENABLED) {
    return null;
  }

  if (!config.GRPC_TLS_CERT_PATH || !config.GRPC_TLS_KEY_PATH) {
    throw new Error('TLS is enabled but certificate/key paths are missing');
  }

  const certChain = readFileSync(config.GRPC_TLS_CERT_PATH);

  const privateKey = readFileSync(config.GRPC_TLS_KEY_PATH);

  let rootCerts: Buffer | undefined;

  if (config.GRPC_TLS_CA_PATH) {
    rootCerts = readFileSync(config.GRPC_TLS_CA_PATH);
  }

  if (config.GRPC_TLS_REQUIRE_CLIENT_CERT && !rootCerts) {
    throw new Error('Client certificate verification requires a CA certificate');
  }

  return {
    cert: certChain,
    key: privateKey,
    ca: rootCerts,
    requestCert: config.GRPC_TLS_REQUIRE_CLIENT_CERT,
    rejectUnauthorized: config.GRPC_TLS_REQUIRE_CLIENT_CERT,
  }
}
