import { createTlsOptions } from './credentials.js';
import * as http2 from 'node:http2';
import { connectNodeAdapter } from '@connectrpc/connect-node';

import type { AppConfig } from '../../config/types.js';
import type { ConnectRouter } from '@connectrpc/connect';
import { AuthService } from '@p2p-energy-trading-platform/typescript-sdk/gen/gridx/auth/v1/auth_pb';
import { createAuthServiceImplementation } from './services/auth-service.js';
import { RegisterUseCase } from '../../features/authentication/register.js';
import { LoginUseCase } from '../../features/authentication/login.js';
import { LogoutUseCase } from '../../features/authentication/logout.js';
import { LogoutAllUseCase } from '../../features/authentication/logout-all.js';
import { GetProfileUseCase } from '../../features/users/get-profile.js';
import { UpdateProfileUseCase } from '../../features/users/update-profile.js';
import { ChangePasswordUseCase } from '../../features/authentication/change-password.js';
import { RequestPasswordResetUseCase } from '../../features/authentication/request-password-reset.js';

export interface GrpcServerDependencies {
  config: AppConfig;
  registerUseCase: RegisterUseCase;
  loginUseCase: LoginUseCase;
  logoutUseCase: LogoutUseCase;
  logoutAllUseCase: LogoutAllUseCase;
  getProfileUseCase: GetProfileUseCase;
  updateProfileUseCase: UpdateProfileUseCase;
  changePasswordUseCase: ChangePasswordUseCase;
  requestPasswordResetUseCase: RequestPasswordResetUseCase;
}

export class GrpcServer {
  private config: AppConfig;
  private deps: GrpcServerDependencies;
  private server?: http2.Http2Server | http2.Http2SecureServer;
  private started = false;

  constructor(deps: GrpcServerDependencies) {
    this.config = deps.config;
    this.deps = deps;
  }

  private registerRoutes(router: ConnectRouter): void {
    // Inject dependencies into the service implementation.
    router.service(
      AuthService,
      createAuthServiceImplementation({
        registerUseCase: this.deps.registerUseCase,
        loginUseCase: this.deps.loginUseCase,
        logoutUseCase: this.deps.logoutUseCase,
        logoutAllUseCase: this.deps.logoutAllUseCase,
        getProfileUseCase: this.deps.getProfileUseCase,
        updateProfileUseCase: this.deps.updateProfileUseCase,
        changePasswordUseCase: this.deps.changePasswordUseCase,
        requestPasswordResetUseCase: this.deps.requestPasswordResetUseCase,
      }),
    );
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    const handler = connectNodeAdapter({
      routes: (router) => this.registerRoutes(router),
    });

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
