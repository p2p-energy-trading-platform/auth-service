import * as grpc from '@grpc/grpc-js';

import { createServerCredentials } from './credentials.js';
// import {
//   authServiceImplementation,
// } from "./services/auth-service.js";
// import {
//   authorizationServiceImplementation,
// } from "./services/authorization-service.js";

/*
 * Import rpc from typescript sdk
 */
// import {
//   AuthServiceService,
//   AuthorizationServiceService,
// } from "@gridx/protobuf/grpc";
// import {
import type { AppConfig } from '../../config/types.js';

// } from "@p2p-energy-trading-platform/typescript-sdk"

export class GrpcServer {
  private config: AppConfig;
  private readonly server: grpc.Server;
  private started = false;

  constructor(config: AppConfig) {
    this.server = new grpc.Server();
    this.config = config;

    // this.server.addService(
    //   AuthServiceService,
    //   authServiceImplementation,
    // );

    // this.server.addService(
    //   AuthorizationServiceService,
    //   authorizationServiceImplementation,
    // );
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    const address = `${this.config.GRPC_HOST}:${this.config.GRPC_PORT}`;

    const credentials = createServerCredentials(this.config);

    await new Promise<void>((resolve, reject) => {
      this.server.bindAsync(address, credentials, (error) => {
        if (error) {
          reject(error);
          return;
        }

        this.server.start();
        this.started = true;

        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.server.tryShutdown(() => {
        this.started = false;
        resolve();
      });
    });
  }
}
