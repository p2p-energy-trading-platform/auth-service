import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { UserRepository } from './repository.js';

export interface UpdateProfileInput {
  userId: string;
  name: string;
}

export class UpdateProfileUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(input: UpdateProfileInput) {
    if (!input.userId) {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Authenticated user is required');
    }

    const name = input.name.trim();

    if (!name) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Name is required');
    }

    if (name.length > 100) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Name must not exceed 100 characters');
    }

    const user = await this.users.updateName(input.userId, name);

    if (!user) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      createdAt: user.createdAt,
    };
  }
}
