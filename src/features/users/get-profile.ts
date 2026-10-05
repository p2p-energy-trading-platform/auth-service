import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { UserRepository } from './repository.js';

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  status: string;
  createdAt: string;
}

export interface GetProfileInput {
  userId: string;
}

export class GetProfileUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(input: GetProfileInput): Promise<UserProfile> {
    if (!input.userId) {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Authenticated user is required');
    }

    const user = await this.users.findById(input.userId);

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
