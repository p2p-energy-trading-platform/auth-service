import type { ServiceImpl } from '@connectrpc/connect';
import type { RegisterUseCase } from '../../../features/authentication/register.js';
import type { LoginUseCase } from '../../../features/authentication/login.js';
import type { LogoutUseCase } from '../../../features/authentication/logout.js';
import { toGrpcError } from '../errors.js';
import type { LogoutAllUseCase } from '../../../features/authentication/logout-all.js';
import { AppError } from '../../../errors/app-error.js';
import { ErrorCodes } from '../../../errors/codes.js';
import type { GetProfileUseCase } from '../../../features/users/get-profile.js';

import {
  AuthService,
  GetProfileResponseSchema,
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
  getProfileUseCase: GetProfileUseCase;
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

    getProfile: async (_req, context) => {
      try {
        const userId = context.requestHeader.get('x-gridx-user-id');

        if (!userId) {
          throw new AppError(
            ErrorCodes.UNAUTHENTICATED,
            'Authenticated user is required',
          );
        }

        const profile = await deps.getProfileUseCase.execute({
          userId,
        });

        return create(GetProfileResponseSchema, {
          profile: {
            userId: profile.id,
            email: profile.email,
            firstName: profile.firstName,
            lastName: profile.lastName,
            status: profile.status,
            createdAt: profile.createdAt,
          },
        });
      } catch (error) {
        throw toGrpcError(error);
      }
    },
        updateProfile: async () => {
      throw new AppError(
        ErrorCodes.NOT_IMPLEMENTED,
        'UpdateProfile is not implemented yet',
      );
    },

    changePassword: async () => {
      throw new AppError(
        ErrorCodes.NOT_IMPLEMENTED,
        'ChangePassword is not implemented yet',
      );
    },

    requestPasswordReset: async () => {
      throw new AppError(
        ErrorCodes.NOT_IMPLEMENTED,
        'RequestPasswordReset is not implemented yet',
      );
    },

    resetPassword: async () => {
      throw new AppError(
        ErrorCodes.NOT_IMPLEMENTED,
        'ResetPassword is not implemented yet',
      );
    },

    requestEmailChange: async () => {
      throw new AppError(
        ErrorCodes.NOT_IMPLEMENTED,
        'RequestEmailChange is not implemented yet',
      );
    },

    verifyEmailChange: async () => {
      throw new AppError(
        ErrorCodes.NOT_IMPLEMENTED,
        'VerifyEmailChange is not implemented yet',
      );
    },
  };
}