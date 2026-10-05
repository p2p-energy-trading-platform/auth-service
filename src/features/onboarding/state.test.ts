import { describe, expect, it } from 'vitest';

import { assertValidOnboardingTransition } from './state.js';

describe('onboarding state machine', () => {
  it.each([
    ['NOT_REQUIRED', 'PENDING'],
    ['PENDING', 'VERIFIED'],
    ['PENDING', 'REJECTED'],
    ['REJECTED', 'PENDING'],
  ] as const)('allows %s -> %s', (currentState, nextState) => {
    expect(() => assertValidOnboardingTransition(currentState, nextState)).not.toThrow();
  });

  it.each([
    ['NOT_REQUIRED', 'VERIFIED'],
    ['NOT_REQUIRED', 'REJECTED'],
    ['VERIFIED', 'PENDING'],
    ['VERIFIED', 'REJECTED'],
    ['REJECTED', 'VERIFIED'],
  ] as const)('rejects %s -> %s', (currentState, nextState) => {
    expect(() => assertValidOnboardingTransition(currentState, nextState)).toThrow(
      'Invalid onboarding state transition',
    );
  });
});
