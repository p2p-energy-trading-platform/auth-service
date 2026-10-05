import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { AuthorizationRepository } from './repository.js';

interface CheckPermissionInput {
  userId: string;
  permissionName: string;
}

export interface CheckPermissionResult {
  allowed: boolean;
}

export class CheckPermissionUseCase {
  constructor(private readonly authorizationRepo: AuthorizationRepository) {}

  async execute(input: CheckPermissionInput): Promise<CheckPermissionResult> {
    if (!input.userId) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'userId is required');
    }

    if (!input.permissionName) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'PermissionName is required');
    }

    const allowed = await this.authorizationRepo.hasPermission(input.userId, input.permissionName);

    return { allowed };
  }
}
