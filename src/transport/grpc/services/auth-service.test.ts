import type { RegisterUseCase } from '../../../features/authentication/register.js';
import type { LoginUseCase } from '../../../features/authentication/login.js';
import type { LogoutUseCase } from '../../../features/authentication/logout.js';
import type { LogoutAllUseCase } from '../../../features/authentication/logout-all.js';
import type { GetProfileUseCase } from '../../../features/users/get-profile.js';
import type { UpdateProfileUseCase } from '../../../features/users/update-profile.js';
import type { ChangePasswordUseCase } from '../../../features/authentication/change-password.js';
import type { RequestPasswordResetUseCase } from '../../../features/authentication/request-password-reset.js';
import type { RequestEmailChangeUseCase } from '../../../features/authentication/request-email-change.js';
import type { ResetPasswordUseCase } from '../../../features/authentication/reset-password.js';
import type { VerifyEmailChangeUseCase } from '../../../features/authentication/verify-email-change.js';
import { describe, expect, it, vi } from 'vitest';
import { Code, ConnectError } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import {
  GetProfileRequestSchema,
  UpdateProfileRequestSchema,
  ChangePasswordRequestSchema,
  RequestPasswordResetRequestSchema,
  VerifyEmailChangeRequestSchema,
} from '@p2p-energy-trading-platform/typescript-sdk/gen/gridx/auth/v1/auth_pb';
import { AppError } from '../../../errors/app-error.js';
import { ErrorCodes } from '../../../errors/codes.js';
import { createAuthServiceImplementation } from './auth-service.js';

const profile = {
  id: 'user-123',
  email: 'user@example.com',
  name: 'Test User',
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  role: 'user',
};

type MockDependencies = {
  registerUseCase: { execute: ReturnType<typeof vi.fn<RegisterUseCase['execute']>> };
  loginUseCase: { execute: ReturnType<typeof vi.fn<LoginUseCase['execute']>> };
  logoutUseCase: { execute: ReturnType<typeof vi.fn<LogoutUseCase['execute']>> };
  logoutAllUseCase: { execute: ReturnType<typeof vi.fn<LogoutAllUseCase['execute']>> };
  getProfileUseCase: { execute: ReturnType<typeof vi.fn<GetProfileUseCase['execute']>> };
  updateProfileUseCase: {
    execute: ReturnType<typeof vi.fn<UpdateProfileUseCase['execute']>>;
  };
  changePasswordUseCase: {
    execute: ReturnType<typeof vi.fn<ChangePasswordUseCase['execute']>>;
  };
  requestPasswordResetUseCase: {
    execute: ReturnType<typeof vi.fn<RequestPasswordResetUseCase['execute']>>;
  };
  requestEmailChangeUseCase: {
    execute: ReturnType<typeof vi.fn<RequestEmailChangeUseCase['execute']>>;
  };
  resetPasswordUseCase: {
    execute: ReturnType<typeof vi.fn<ResetPasswordUseCase['execute']>>;
  };
  verifyEmailChangeUseCase: {
    execute: ReturnType<typeof vi.fn<VerifyEmailChangeUseCase['execute']>>;
  };
};

function createDependencies(): MockDependencies {
  return {
    registerUseCase: {
      execute: vi.fn<RegisterUseCase['execute']>(),
    },
    loginUseCase: {
      execute: vi.fn<LoginUseCase['execute']>(),
    },
    logoutUseCase: {
      execute: vi.fn<LogoutUseCase['execute']>(),
    },
    logoutAllUseCase: {
      execute: vi.fn<LogoutAllUseCase['execute']>(),
    },
    getProfileUseCase: {
      execute: vi.fn<GetProfileUseCase['execute']>(),
    },
    updateProfileUseCase: {
      execute: vi.fn<UpdateProfileUseCase['execute']>(),
    },
    changePasswordUseCase: {
      execute: vi.fn<ChangePasswordUseCase['execute']>(),
    },
    requestPasswordResetUseCase: {
      execute: vi.fn<RequestPasswordResetUseCase['execute']>(),
    },
    requestEmailChangeUseCase: {
      execute: vi.fn<RequestEmailChangeUseCase['execute']>(),
    },
    resetPasswordUseCase: {
      execute: vi.fn<ResetPasswordUseCase['execute']>(),
    },
    verifyEmailChangeUseCase: {
      execute: vi.fn<VerifyEmailChangeUseCase['execute']>(),
    },
  };
}

function createContext(userId?: string) {
  return {
    requestHeader: new Headers(userId ? { 'x-gridx-user-id': userId } : undefined),
  } as never;
}

describe('AuthService gRPC implementation', () => {
  it('gets the authenticated user profile using x-gridx-user-id', async () => {
    const deps = createDependencies();
    deps.getProfileUseCase.execute.mockResolvedValue(profile);

    const service = createAuthServiceImplementation(deps as never);
    const request = create(GetProfileRequestSchema);

    const response = await service.getProfile(request, createContext('user-123'));

    expect(deps.getProfileUseCase.execute).toHaveBeenCalledWith({
      userId: 'user-123',
    });

    expect(response.profile?.userId).toBe('user-123');
    expect(response.profile?.email).toBe('user@example.com');
    expect(response.profile?.name).toBe('Test User');
  });

  it('rejects GetProfile when authentication metadata is missing', async () => {
    const deps = createDependencies();
    const service = createAuthServiceImplementation(deps as never);
    const request = create(GetProfileRequestSchema);

    let error: unknown;

    try {
      await service.getProfile(request, createContext());
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).toBeInstanceOf(ConnectError);
    expect(error).toMatchObject({
      code: Code.Unauthenticated,
    });
    expect((error as ConnectError).message).toBe(
      '[unauthenticated] Authenticated user is required',
    );

    expect(deps.getProfileUseCase.execute).not.toHaveBeenCalled();
  });

  it('requires authentication for UpdateProfile', async () => {
    const deps = createDependencies();
    const service = createAuthServiceImplementation(deps as never);
    const request = create(UpdateProfileRequestSchema, {
      name: 'Updated Name',
    });

    await expect(service.updateProfile(request, createContext())).rejects.toMatchObject({
      code: Code.Unauthenticated,
    });

    expect(deps.updateProfileUseCase.execute).not.toHaveBeenCalled();
  });

  it('passes authenticated user ID and name to UpdateProfile', async () => {
    const deps = createDependencies();
    deps.updateProfileUseCase.execute.mockResolvedValue({
      ...profile,
      name: 'Updated Name',
    });

    const service = createAuthServiceImplementation(deps as never);
    const request = create(UpdateProfileRequestSchema, {
      name: 'Updated Name',
    });

    const response = await service.updateProfile(request, createContext('user-123'));

    expect(deps.updateProfileUseCase.execute).toHaveBeenCalledWith({
      userId: 'user-123',
      name: 'Updated Name',
    });

    expect(response.profile?.name).toBe('Updated Name');
  });

  it('requires authentication for ChangePassword', async () => {
    const deps = createDependencies();
    const service = createAuthServiceImplementation(deps as never);
    const request = create(ChangePasswordRequestSchema, {
      currentPassword: 'old-password',
      newPassword: 'new-password',
    });

    await expect(service.changePassword(request, createContext())).rejects.toMatchObject({
      code: Code.Unauthenticated,
    });

    expect(deps.changePasswordUseCase.execute).not.toHaveBeenCalled();
  });

  it('requires authentication for RequestEmailChange', async () => {
    const deps = createDependencies();
    const service = createAuthServiceImplementation(deps as never);

    const request = {
      newEmail: 'new@example.com',
    } as never;

    await expect(service.requestEmailChange(request, createContext())).rejects.toMatchObject({
      code: Code.Unauthenticated,
    });

    expect(deps.requestEmailChangeUseCase.execute).not.toHaveBeenCalled();
  });

  it('passes the verification token to VerifyEmailChange', async () => {
    const deps = createDependencies();
    deps.verifyEmailChangeUseCase.execute.mockResolvedValue({
      ...profile,
      email: 'new@example.com',
    });

    const service = createAuthServiceImplementation(deps as never);
    const request = create(VerifyEmailChangeRequestSchema, {
      token: 'verification-token',
    });

    const response = await service.verifyEmailChange(request, {} as never);

    expect(deps.verifyEmailChangeUseCase.execute).toHaveBeenCalledWith({
      token: 'verification-token',
    });

    expect(response.profile?.email).toBe('new@example.com');
  });

  it('maps AppError to the corresponding gRPC status', async () => {
    const deps = createDependencies();

    deps.getProfileUseCase.execute.mockRejectedValue(
      new AppError(ErrorCodes.NOT_FOUND, 'User not found'),
    );

    const service = createAuthServiceImplementation(deps as never);
    const request = create(GetProfileRequestSchema);

    let error: unknown;

    try {
      await service.getProfile(request, createContext('user-123'));
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).toBeInstanceOf(ConnectError);
    expect(error).toMatchObject({
      code: Code.NotFound,
    });
    expect((error as ConnectError).message).toBe('[not_found] User not found');
  });

  it('maps unexpected errors to Internal', async () => {
    const deps = createDependencies();

    deps.getProfileUseCase.execute.mockRejectedValue(new Error('database connection failed'));

    const service = createAuthServiceImplementation(deps as never);
    const request = create(GetProfileRequestSchema);

    let error: unknown;

    try {
      await service.getProfile(request, createContext('user-123'));
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).toBeInstanceOf(ConnectError);
    expect(error).toMatchObject({
      code: Code.Internal,
    });
    expect((error as ConnectError).message).toBe('[internal] Internal Server Error');
  });

  it('preserves an existing ConnectError', async () => {
    const deps = createDependencies();

    const connectError = new ConnectError('Request failed', Code.ResourceExhausted);

    deps.requestPasswordResetUseCase.execute.mockRejectedValue(connectError);

    const service = createAuthServiceImplementation(deps as never);
    const request = create(RequestPasswordResetRequestSchema, {
      email: 'user@example.com',
    });

    await expect(service.requestPasswordReset(request, {} as never)).rejects.toBe(connectError);
  });

  it('allows password reset requests without authentication metadata', async () => {
    const deps = createDependencies();
    deps.requestPasswordResetUseCase.execute.mockResolvedValue({
      success: true,
    });

    const service = createAuthServiceImplementation(deps as never);
    const request = create(RequestPasswordResetRequestSchema, {
      email: 'user@example.com',
    });

    const response = await service.requestPasswordReset(request, {} as never);

    expect(deps.requestPasswordResetUseCase.execute).toHaveBeenCalledWith({
      email: 'user@example.com',
    });

    expect(response.success).toBe(true);
  });
});
