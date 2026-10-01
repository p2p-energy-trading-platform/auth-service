import type { ServiceImpl } from '@connectrpc/connect';
import type { RegisterUseCase } from '../../../features/authentication/register.js';
import type { LoginUseCase } from '../../../features/authentication/login.js';
import type { LogoutUseCase } from '../../../features/authentication/logout.js';
import { toGrpcError } from '../errors.js';
import type { LogoutAllUseCase } from '../../../features/authentication/logout-all.js';
import { AppError } from '../../../errors/app-error.js';
import { ErrorCodes } from '../../../errors/codes.js';

import {
  AuthService,
  LoginResponseSchema,
  LogoutAllResponseSchema,
  LogoutResponseSchema,
  RegisterResponseSchema,
} from '@p2p-energy-trading-platform/typescript-sdk/gen/gridx/auth/v1/auth_pb';
import { create } from '@bufbuild/protobuf';

interface AuthServiceDependencies {
  registerUseCase: RegisterUseCase;
  loginUseCase: LoginUseCase;
  logoutUseCase: LogoutUseCase;
  logoutAllUseCase: LogoutAllUseCase;
}

export function createAuthServiceImplementation(
  deps: AuthServiceDependencies,
): ServiceImpl<typeof AuthService> {
  return {
    register: async (req, _context) => {
      try {
        const user = await deps.registerUseCase.execute({
          email: req.email,
          password: req.password,
        });

        return create(RegisterResponseSchema, {
          userId: user.id,
          email: user.email,
          status: user.status,
          createdAt: user.createdAt,
        });
      } catch (error) {
        throw toGrpcError(error);
      }
    },

    login: async (req, _context) => {
      try {
        const result = await deps.loginUseCase.execute({
          email: req.email,
          password: req.password,
        });

        return create(LoginResponseSchema, {
          userId: result.userId,
          email: result.email,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: BigInt(result.expiresIn),
        });
      } catch (error) {
        throw toGrpcError(error);
      }
    },

    logout: async (req, _context) => {
      try {
        const result = await deps.logoutUseCase.execute({
          refreshToken: req.refreshToken,
        });

        return create(LogoutResponseSchema, {
          success: result.success,
        });
      } catch (error) {
        throw toGrpcError(error);
      }
    },
    logoutAll: async (_req, context) => {
      try {
        const userId = context.requestHeader.get('x-gridx-user-id');

        if (!userId) {
          throw new AppError(
            ErrorCodes.UNAUTHENTICATED,
            'Authenticated user is required',
          );
        }

        const result = await deps.logoutAllUseCase.execute({
          userId,
        });

        return create(LogoutAllResponseSchema, {
          success: result.success,
        });
      } catch (error) {
        throw toGrpcError(error);
      }
    },
  };
}
