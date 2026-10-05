import { describe, expect, it, vi } from 'vitest';
import { CheckPermissionUseCase } from './check-permission.js';

describe('CheckPermissionUseCase', () => {
  it('returns allowed true when user has permission', async () => {
    const authorizationRepo = {
      hasPermission: vi
        .fn<(userId: string, permissionName: string) => Promise<boolean>>()
        .mockResolvedValue(true),
    };

    const useCase = new CheckPermissionUseCase(authorizationRepo as any);

    const result = await useCase.execute({
      userId: 'user-123',
      permissionName: 'trade:create',
    });

    expect(result).toEqual({
      allowed: true,
    });

    expect(authorizationRepo.hasPermission).toHaveBeenCalledWith('user-123', 'trade:create');
  });

  it('returns allowed false when user does not have permission', async () => {
    const authorizationRepo = {
      hasPermission: vi
        .fn<(userId: string, permissionName: string) => Promise<boolean>>()
        .mockResolvedValue(false),
    };

    const useCase = new CheckPermissionUseCase(authorizationRepo as any);

    const result = await useCase.execute({
      userId: 'user-123',
      permissionName: 'trade:create',
    });

    expect(result).toEqual({
      allowed: false,
    });

    expect(authorizationRepo.hasPermission).toHaveBeenCalledWith('user-123', 'trade:create');
  });

  it('throws INVALID_ARGUMENT when userId is missing', async () => {
    const authorizationRepo = {
      hasPermission: vi.fn<(userId: string, permissionName: string) => Promise<boolean>>(),
    };

    const useCase = new CheckPermissionUseCase(authorizationRepo as any);

    await expect(
      useCase.execute({
        userId: '',
        permissionName: 'trade:create',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
  });

  it('throws INVALID_ARGUMENT when permissionName is missing', async () => {
    const authorizationRepo = {
      hasPermission: vi.fn<(userId: string, permissionName: string) => Promise<boolean>>(),
    };

    const useCase = new CheckPermissionUseCase(authorizationRepo as any);

    await expect(
      useCase.execute({
        userId: 'user-123',
        permissionName: '',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
  });
});
