import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { UserRepository } from '../users/repository.js';
import type { KycRepository } from '../onboarding/repository.js';
import { KycState } from '@p2p-energy-trading-platform/typescript-sdk/gen/gridx/auth/v1/auth_pb';
import { toKycState } from '../onboarding/kyc-helper.js';

interface GetUserInput {
  userId: string;
}

export interface GetUserResult {
  id: string;
  email: string;
  status: string;
  role: string;
  name: string | null;
  kycState: KycState;
}

export class GetUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly kycRepo: KycRepository,
  ) {}

  async execute(input: GetUserInput): Promise<GetUserResult> {
    if (!input.userId) {
      throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'User ID is required');
    }

    const user = await this.userRepo.findById(input.userId);

    if (!user) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'User not found');
    }

    const kycSubmission = await this.kycRepo.findByUserId(user.id);

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      role: user.role,
      name: user.name,
      kycState: kycSubmission ? toKycState(kycSubmission.state) : KycState.UNSPECIFIED,
    };
  }
}
