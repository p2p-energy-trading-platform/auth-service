import { randomInt } from 'node:crypto';
import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { PasswordHasher } from '../../infrastructure/crypto/password-hasher.js';
import type { RegisteredUser, UserRepository } from '../users/repository.js';

interface RegisterInput {
  email: string;
  password: string;
}

export class RegisterUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: RegisterInput): Promise<RegisteredUser> {
    if (!input.email || !input.password) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Email and password are required');
    }

    if (input.password.length < 8) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Invalid Password');
    }

    const normalizedEmail = input.email.trim().toLowerCase();

    const existingUser = await this.userRepo.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new AppError(ErrorCodes.CONFLICT, 'An account with this email already exists');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const name = `user${randomInt(1000, 10000)}`;

    try {
      return await this.userRepo.createUsersWithCredentials({
        email: normalizedEmail,
        passwordHash,
        name,
      });
    } catch (error: any) {
      if (error.code === '23505') {
        throw new AppError(ErrorCodes.CONFLICT, 'An account with this email already exists');
      }

      throw error;
    }
  }
}
