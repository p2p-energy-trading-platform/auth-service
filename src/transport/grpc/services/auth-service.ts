import type { ServiceImpl } from '@connectrpc/connect';
import type { RegisterUseCase } from '../../../features/authentication/register.js';
import type { LoginUseCase } from '../../../features/authentication/login.js';
import type { LogoutUseCase } from '../../../features/authentication/logout.js';
import { toGrpcError } from '../errors.js';
import type { LogoutAllUseCase } from '../../../features/authentication/logout-all.js';
import { AppError } from '../../../errors/app-error.js';
import { ErrorCodes } from '../../../errors/codes.js';
import type { GetProfileUseCase } from '../../../features/users/get-profile.js';
import type { UpdateProfileUseCase } from '../../../features/users/update-profile.js';
import type { ChangePasswordUseCase } from '../../../features/authentication/change-password.js';
import type { RequestPasswordResetUseCase } from '../../../features/authentication/request-password-reset.js';
import type { ResetPasswordUseCase } from '../../../features/authentication/reset-password.js';
import type { RequestEmailChangeUseCase } from '../../../features/authentication/request-email-change.js';
import type { VerifyEmailChangeUseCase } from '../../../features/authentication/verify-email-change.js';

import {
  AuthService,
  GetProfileResponseSchema,
  UpdateProfileResponseSchema,
  ChangePasswordResponseSchema,
  RequestPasswordResetResponseSchema,
  ResetPasswordResponseSchema,
  LoginResponseSchema,
  LogoutAllResponseSchema,
  LogoutResponseSchema,
  RegisterResponseSchema,
  RequestEmailChangeResponseSchema,
  VerifyEmailChangeResponseSchema,
} from '@p2p-energy-trading-platform/typescript-sdk/gen/gridx/auth/v1/auth_pb';
import { create } from '@bufbuild/protobuf';

interface AuthServiceDependencies {
  registerUseCase: RegisterUseCase;
  loginUseCase: LoginUseCase;
  logoutUseCase: LogoutUseCase;
  logoutAllUseCase: LogoutAllUseCase;
  getProfileUseCase: GetProfileUseCase;
  updateProfileUseCase: UpdateProfileUseCase;
  changePasswordUseCase: ChangePasswordUseCase;
  requestPasswordResetUseCase: RequestPasswordResetUseCase;
  requestEmailChangeUseCase: RequestEmailChangeUseCase;
  resetPasswordUseCase: ResetPasswordUseCase;
  verifyEmailChangeUseCase: VerifyEmailChangeUseCase;
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
          throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Authenticated user is required');
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
          throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Authenticated user is required');
        }

        const profile = await deps.getProfileUseCase.execute({
          userId,
        });

        return create(GetProfileResponseSchema, {
          profile: {
            userId: profile.id,
            email: profile.email,
            name: profile.name ?? '',
            status: profile.status,
            createdAt: profile.createdAt,
          },
        });
      } catch (error) {
        throw toGrpcError(error);
      }
    },

    updateProfile: async (req, context) => {
      try {
        const userId = context.requestHeader.get('x-gridx-user-id');

        if (!userId) {
          throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Authenticated user is required');
        }

        const profile = await deps.updateProfileUseCase.execute({
          userId,
          name: req.name,
        });

        return create(UpdateProfileResponseSchema, {
          profile: {
            userId: profile.id,
            email: profile.email,
            name: profile.name ?? '',
            status: profile.status,
            createdAt: profile.createdAt,
          },
        });
      } catch (error) {
        throw toGrpcError(error);
      }
    },

    changePassword: async (req, context) => {
      try {
        const userId = context.requestHeader.get('x-gridx-user-id');

        if (!userId) {
          throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Authenticated user is required');
        }

        const result = await deps.changePasswordUseCase.execute({
          userId,
          currentPassword: req.currentPassword,
          newPassword: req.newPassword,
        });

        return create(ChangePasswordResponseSchema, {
          success: result.success,
        });
      } catch (error) {
        throw toGrpcError(error);
      }
    },

    requestPasswordReset: async (req) => {
      try {
        const result = await deps.requestPasswordResetUseCase.execute({
          email: req.email,
        });

        return create(RequestPasswordResetResponseSchema, {
          success: result.success,
        });
      } catch (error) {
        throw toGrpcError(error);
      }
    },

    resetPassword: async (req) => {
      try {
        const result = await deps.resetPasswordUseCase.execute({
          token: req.token,
          newPassword: req.newPassword,
        });

        return create(ResetPasswordResponseSchema, {
          success: result.success,
        });
      } catch (error) {
        throw toGrpcError(error);
      }
    },

    requestEmailChange: async (req, context) => {
      try {
        const userId = context.requestHeader.get('x-gridx-user-id');

        if (!userId) {
          throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Authenticated user is required');
        }

        const result = await deps.requestEmailChangeUseCase.execute({
          userId,
          newEmail: req.newEmail,
        });

        return create(RequestEmailChangeResponseSchema, {
          success: result.success,
        });
      } catch (error) {
        throw toGrpcError(error);
      }
    },

    verifyEmailChange: async (req) => {
      try {
        const profile = await deps.verifyEmailChangeUseCase.execute({
          token: req.token,
        });

        return create(VerifyEmailChangeResponseSchema, {
          profile: {
            userId: profile.id,
            email: profile.email,
            name: profile.name ?? '',
            status: profile.status,
            createdAt: profile.createdAt,
          },
        });
      } catch (error) {
        throw toGrpcError(error);
      }
    },
  };
}
