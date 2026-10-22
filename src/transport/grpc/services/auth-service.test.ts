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
import type { SubmitKycUseCase } from '../../../features/onboarding/submit-kyc.js';
import type { CreateKycUploadUrlUseCase } from '../../../features/onboarding/create-kyc-upload-url.js';
import type { ExtractKycNicOcrUseCase } from '../../../features/onboarding/extract-kyc-nic-ocr.js';
import { describe, expect, it, vi } from 'vitest';
import { Code, ConnectError } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import { DateSchema } from '@p2p-energy-trading-platform/typescript-sdk/gen/google/type/date_pb';
import {
  GetProfileRequestSchema,
  UpdateProfileRequestSchema,
  ChangePasswordRequestSchema,
  RequestPasswordResetRequestSchema,
  VerifyEmailChangeRequestSchema,
  SubmitKycRequestSchema,
  CreateKycUploadUrlRequestSchema,
  ExtractKycNicOcrRequestSchema,
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
  logger: {
    error: ReturnType<typeof vi.fn>;
  };
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
  submitKycUseCase: {
    execute: ReturnType<typeof vi.fn<SubmitKycUseCase['execute']>>;
  };
  createKycUploadUrlUseCase: {
    execute: ReturnType<typeof vi.fn<CreateKycUploadUrlUseCase['execute']>>;
  };
  extractKycNicOcrUseCase: {
    execute: ReturnType<typeof vi.fn<ExtractKycNicOcrUseCase['execute']>>;
  };
};

function createDependencies(): MockDependencies {
  return {
    logger: {
      error: vi.fn<(...args: unknown[]) => void>(),
    },
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
    submitKycUseCase: {
      execute: vi.fn<SubmitKycUseCase['execute']>(),
    },
    createKycUploadUrlUseCase: {
      execute: vi.fn<CreateKycUploadUrlUseCase['execute']>(),
    },
    extractKycNicOcrUseCase: {
      execute: vi.fn<ExtractKycNicOcrUseCase['execute']>(),
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

  it('submits KYC for the authenticated user and maps the response', async () => {
    const deps = createDependencies();
    deps.submitKycUseCase.execute.mockResolvedValue({
      id: 'kyc-123',
      userId: 'user-123',
      fullName: 'Jane Doe',
      dateOfBirth: '1990-01-01',
      nicNumber: '199012012345',
      documentPath: 'uploads/document.pdf',
      state: 'PENDING',
      rejectionReason: null,
      verifiedAt: null,
      createdAt: new Date('2026-10-05T00:00:00.000Z'),
      updatedAt: new Date('2026-10-05T00:00:00.000Z'),
    });

    const service = createAuthServiceImplementation(deps as never);
    const request = create(SubmitKycRequestSchema, {
      fullName: ' Jane Doe ',
      dateOfBirth: create(DateSchema, { year: 1990, month: 1, day: 1 }),
      nicNumber: ' 199012012345 ',
      documentPath: ' uploads/document.pdf ',
    });

    const response = await service.submitKyc(request, createContext('user-123'));

    expect(deps.submitKycUseCase.execute).toHaveBeenCalledWith({
      userId: 'user-123',
      fullName: ' Jane Doe ',
      dateOfBirth: '1990-01-01',
      nicNumber: ' 199012012345 ',
      documentPath: ' uploads/document.pdf ',
    });
    expect(response.submission?.userId).toBe('user-123');
    expect(response.submission?.dateOfBirth).toMatchObject({
      year: 1990,
      month: 1,
      day: 1,
    });
    expect(response.submission?.state).toBe(1);
  });

  it('requires authentication for SubmitKyc', async () => {
    const deps = createDependencies();
    const service = createAuthServiceImplementation(deps as never);
    const request = create(SubmitKycRequestSchema);

    await expect(service.submitKyc(request, createContext())).rejects.toMatchObject({
      code: Code.Unauthenticated,
    });

    expect(deps.submitKycUseCase.execute).not.toHaveBeenCalled();
  });

  it('extracts NIC OCR suggestions for the authenticated user', async () => {
    const deps = createDependencies();
    deps.extractKycNicOcrUseCase.execute.mockResolvedValue({
      fullName: 'Jane Doe',
      dateOfBirth: '1990-01-01',
      nicNumber: '199012012345',
    });

    const service = createAuthServiceImplementation(deps as never);
    const request = create(ExtractKycNicOcrRequestSchema, {
      objectKey: 'kyc/user-123/document.pdf',
    });

    const response = await service.extractKycNicOcr(request, createContext('user-123'));

    expect(deps.extractKycNicOcrUseCase.execute).toHaveBeenCalledWith({
      userId: 'user-123',
      objectKey: 'kyc/user-123/document.pdf',
    });
    expect(response.fullName).toBe('Jane Doe');
    expect(response.dateOfBirth).toMatchObject({
      year: 1990,
      month: 1,
      day: 1,
    });
    expect(response.nicNumber).toBe('199012012345');
  });

  it('requires authentication for ExtractKycNicOcr', async () => {
    const deps = createDependencies();
    const service = createAuthServiceImplementation(deps as never);
    const request = create(ExtractKycNicOcrRequestSchema, {
      objectKey: 'kyc/user-123/document.pdf',
    });

    await expect(service.extractKycNicOcr(request, createContext())).rejects.toMatchObject({
      code: ErrorCodes.UNAUTHENTICATED,
    });

    expect(deps.extractKycNicOcrUseCase.execute).not.toHaveBeenCalled();
  });

  it('does not log OCR errors or extracted identity data', async () => {
    const deps = createDependencies();
    deps.extractKycNicOcrUseCase.execute.mockRejectedValue(
      new Error('OCR failed for Jane Doe NIC 199012012345'),
    );

    const service = createAuthServiceImplementation(deps as never);
    const request = create(ExtractKycNicOcrRequestSchema, {
      objectKey: 'kyc/user-123/document.pdf',
    });

    await expect(
      service.extractKycNicOcr(request, createContext('user-123')),
    ).rejects.toMatchObject({
      code: Code.Internal,
    });

    expect(deps.logger.error).toHaveBeenCalledWith('Failed to extract KYC NIC OCR');
    expect(deps.logger.error).not.toHaveBeenCalledWith(expect.stringContaining('199012012345'));
    expect(deps.logger.error).not.toHaveBeenCalledWith(expect.stringContaining('Jane Doe'));
  });

  it('creates a KYC upload URL for the authenticated user', async () => {
    const deps = createDependencies();
    deps.createKycUploadUrlUseCase.execute.mockResolvedValue({
      uploadUrl: 'http://localhost:9000/gridx-kyc/kyc/user-123/doc.pdf?X-Amz-Signature=abc',
      objectKey: 'kyc/user-123/doc.pdf',
      expiresIn: 300,
    });

    const service = createAuthServiceImplementation(deps as never);
    const request = create(CreateKycUploadUrlRequestSchema, {
      contentType: 'application/pdf',
      sizeBytes: 2048n,
    });

    const response = await service.createKycUploadUrl(request, createContext('user-123'));

    expect(deps.createKycUploadUrlUseCase.execute).toHaveBeenCalledWith({
      userId: 'user-123',
      contentType: 'application/pdf',
      sizeBytes: 2048,
    });
    expect(response.uploadUrl).toContain('X-Amz-Signature');
    expect(response.objectKey).toBe('kyc/user-123/doc.pdf');
    expect(response.expiresIn).toBe(300n);
  });

  it('requires authentication for CreateKycUploadUrl', async () => {
    const deps = createDependencies();
    const service = createAuthServiceImplementation(deps as never);
    const request = create(CreateKycUploadUrlRequestSchema);

    await expect(service.createKycUploadUrl(request, createContext())).rejects.toMatchObject({
      code: Code.Unauthenticated,
    });

    expect(deps.createKycUploadUrlUseCase.execute).not.toHaveBeenCalled();
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
