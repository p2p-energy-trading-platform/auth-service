import { createTlsOptions } from './credentials.js';
import * as http2 from 'node:http2';
import { connectNodeAdapter } from '@connectrpc/connect-node';

import type { AppConfig } from '../../config/types.js';
import type { ConnectRouter } from '@connectrpc/connect';

export class GrpcServer {
  private config: AppConfig;
  private server?: http2.Http2Server | http2.Http2SecureServer;
  private started = false;

  constructor(config: AppConfig) {
    this.config = config;
  }

  private registerRoutes(_: ConnectRouter): void {
    // Inject dependencies into your service factory here
    // router.service(AuthService, createAuthServiceImplementation(deps));
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    const handler = connectNodeAdapter({
      routes: (router) => this.registerRoutes(router),
    })

    const tlsOptions = createTlsOptions(this.config);

    if (tlsOptions) {
      this.server = http2.createSecureServer(tlsOptions, handler);
    } else {
      this.server = http2.createServer(handler);
    }

    const host = this.config.GRPC_HOST;
    const port = this.config.GRPC_PORT;


    await new Promise<void>((resolve, reject) => {
      this.server?.listen(port, host, () => {
        this.started = true;

        resolve();
      });

      this.server?.once('error', reject);
    });
  }

  async stop(): Promise<void> {
    if (!this.started || !this.server) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.server?.close(() => {
        this.started = false;
        resolve();
      });
    });
  }
}
