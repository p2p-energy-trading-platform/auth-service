import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';

export const ONBOARDING_STATES = ['NOT_REQUIRED', 'PENDING', 'VERIFIED', 'REJECTED'] as const;

export type OnboardingState = (typeof ONBOARDING_STATES)[number];

const allowedTransitions: Record<OnboardingState, readonly OnboardingState[]> = {
  NOT_REQUIRED: ['NOT_REQUIRED', 'PENDING'],
  PENDING: ['PENDING', 'VERIFIED', 'REJECTED'],
  VERIFIED: ['VERIFIED'],
  REJECTED: ['REJECTED', 'PENDING'],
};

export function assertValidOnboardingTransition(
  currentState: OnboardingState,
  nextState: OnboardingState,
): void {
  if (!allowedTransitions[currentState].includes(nextState)) {
    throw new AppError(
      ErrorCodes.CONFLICT,
      `Invalid onboarding state transition: ${currentState} -> ${nextState}`,
    );
  }
}
