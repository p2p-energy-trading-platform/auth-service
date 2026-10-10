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
import type { SubmitKycUseCase } from '../../../features/onboarding/submit-kyc.js';

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
  GetUserResponseSchema,
  CheckPermissionResponseSchema,
  VerifyEmailChangeResponseSchema,
  RefreshTokenResponseSchema,
  VerifyEmailResponseSchema,
  ResendOtpResponseSchema,
  SubmitKycResponseSchema,
  KycSubmissionSchema,
} from '@p2p-energy-trading-platform/typescript-sdk/gen/gridx/auth/v1/auth_pb';
import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { DateSchema } from '@p2p-energy-trading-platform/typescript-sdk/gen/google/type/date_pb';
import type { CheckPermissionUseCase } from '../../../features/authorization/check-permission.js';
import type { GetUseCase } from '../../../features/authorization/get-user.js';
import type { RefreshUseCase } from '../../../features/authentication/refresh.js';
import type { VerifyEmailUseCase } from '../../../features/authentication/verify-email.js';
import type { ResendOtpUseCase } from '../../../features/authentication/resend-otp.js';
import {
  formatKycDate,
  parseKycDate,
  toKycState,
} from '../../../features/onboarding/kyc-helper.js';
import type { FastifyBaseLogger } from 'fastify';

interface AuthServiceDependencies {
  logger: FastifyBaseLogger;
  registerUseCase: RegisterUseCase;
  loginUseCase: LoginUseCase;
  refreshUseCase: RefreshUseCase;
  logoutUseCase: LogoutUseCase;
  logoutAllUseCase: LogoutAllUseCase;
  getUserUseCase: GetUseCase;
  updateProfileUseCase: UpdateProfileUseCase;
  changePasswordUseCase: ChangePasswordUseCase;
  requestPasswordResetUseCase: RequestPasswordResetUseCase;
  requestEmailChangeUseCase: RequestEmailChangeUseCase;
  resetPasswordUseCase: ResetPasswordUseCase;
  checkPermissionUseCase: CheckPermissionUseCase;
  getProfileUseCase: GetProfileUseCase;
  verifyEmailChangeUseCase: VerifyEmailChangeUseCase;
  verifyEmailUseCase: VerifyEmailUseCase;
  resendOtpUseCase: ResendOtpUseCase;
  submitKycUseCase: SubmitKycUseCase;
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
          createdAt: user.createdAt.toISOString(),
          createdAtTime: timestampFromDate(user.createdAt),
        });
      } catch (error) {
        deps.logger.error({ err: error }, 'Failed to register user in gRPC service');
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
        deps.logger.error({ err: error }, 'Failed to login user in gRPC service');
        throw toGrpcError(error);
      }
    },

    refreshToken: async (req, _context) => {
      try {
        const result = await deps.refreshUseCase.execute({
          refreshToken: req.refreshToken,
        });

        return create(RefreshTokenResponseSchema, {
          refreshToken: result.refreshToken,
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
        });
      } catch (error) {
        deps.logger.error({ err: error }, 'Failed to refresh token');
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
        deps.logger.error({ err: error }, 'Failed to logout user');
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
        deps.logger.error({ err: error }, 'Failed to logout all instances of user');
        throw toGrpcError(error);
      }
    },
    getUser: async (req, _context) => {
      try {
        const result = await deps.getUserUseCase.execute({
          userId: req.userId,
        });

        return create(GetUserResponseSchema, {
          userId: result.id,
          email: result.email,
          status: result.status,
          role: result.role,
        });
      } catch (error) {
        deps.logger.error({ err: error }, 'Failed to get user data');
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
            createdAt: profile.createdAt.toISOString(),
            createdAtTime: timestampFromDate(profile.createdAt),
          },
        });
      } catch (error) {
        deps.logger.error({ err: error }, 'Failed to get profile data');
        throw toGrpcError(error);
      }
    },
    checkPermission: async (req, _context) => {
      try {
        const result = await deps.checkPermissionUseCase.execute({
          userId: req.userId,
          permissionName: req.permissionName,
        });

        return create(CheckPermissionResponseSchema, {
          allowed: result.allowed,
        });
      } catch (error) {
        deps.logger.error({ err: error }, 'Failed to check permission');
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
            createdAt: profile.createdAt.toISOString(),
            createdAtTime: timestampFromDate(profile.createdAt),
          },
        });
      } catch (error) {
        deps.logger.error({ err: error }, 'Failed to update profile');
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
        deps.logger.error({ err: error }, 'Failed to change password');
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
        deps.logger.error({ err: error }, 'Failed to request password reset');
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
        deps.logger.error({ err: error }, 'Failed to reset password');
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
        deps.logger.error({ err: error }, 'Failed to request email change');
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
            createdAt: profile.createdAt.toISOString(),
            createdAtTime: timestampFromDate(profile.createdAt),
          },
        });
      } catch (error) {
        deps.logger.error({ err: error }, 'Failed to verify email change');
        throw toGrpcError(error);
      }
    },

    verifyEmail: async (req, _context) => {
      try {
        await deps.verifyEmailUseCase.execute({
          email: req.email,
          otp: req.otp,
        });

        return create(VerifyEmailResponseSchema, {
          success: true,
          message: 'Email verified successfully',
        });
      } catch (error) {
        deps.logger.error({ err: error }, 'Failed to verify email');
        throw toGrpcError(error);
      }
    },

    resendOtp: async (req, _context) => {
      try {
        await deps.resendOtpUseCase.execute(req.email);
        return create(ResendOtpResponseSchema, {
          success: true,
        });
      } catch (error) {
        deps.logger.error({ err: error }, 'Failed to resend otp');
        throw toGrpcError(error);
      }
    },

    submitKyc: async (req, context) => {
      try {
        const userId = context.requestHeader.get('x-gridx-user-id');

        if (!userId) {
          throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Authenticated user is required');
        }

        const submission = await deps.submitKycUseCase.execute({
          userId,
          fullName: req.fullName,
          dateOfBirth: req.dateOfBirth ? formatKycDate(req.dateOfBirth) : '',
          dubaiId: req.dubaiId,
          documentPath: req.documentPath,
        });

        return create(SubmitKycResponseSchema, {
          submission: create(KycSubmissionSchema, {
            id: submission.id,
            userId: submission.userId,
            fullName: submission.fullName,
            dateOfBirth: create(DateSchema, parseKycDate(submission.dateOfBirth)),
            dubaiId: submission.dubaiId,
            documentPath: submission.documentPath,
            state: toKycState(submission.state),
            rejectionReason: submission.rejectionReason ?? '',
            verifiedAt: submission.verifiedAt
              ? timestampFromDate(new Date(submission.verifiedAt))
              : undefined,
            createdAt: timestampFromDate(new Date(submission.createdAt)),
            updatedAt: timestampFromDate(new Date(submission.updatedAt)),
          }),
        });
      } catch (error) {
        deps.logger.error({ err: error }, 'Failed to submit kyc');
        throw toGrpcError(error);
      }
    },
  };
}
