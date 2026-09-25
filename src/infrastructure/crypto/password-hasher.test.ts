import { describe, expect, it } from 'vitest';
import { PasswordHasher } from './password-hasher.js';

describe('Password Hasher', () => {
  const passwordHasher = new PasswordHasher();
  const password: string = 'qwerty123';

  it('should return a non-empty string starting with $argon2id$', async () => {
    const hashedPassword = await passwordHasher.hash(password);

    expect(hashedPassword).toBeTypeOf('string');
    expect(hashedPassword.length).toBeGreaterThan(0);
    expect(hashedPassword.startsWith('$argon2id$')).toBe(true);
  });

  it('verify that 2 generated hashes of same password are not the same', async () => {
    const hashedPasswordFirst = await passwordHasher.hash(password);
    const hashedPasswordSecond = await passwordHasher.hash(password);

    expect(hashedPasswordFirst).not.toBe(hashedPasswordSecond);
  });

  it('verify hash correctly verifies passwords', async () => {
    const hashedPassword = await passwordHasher.hash(password);

    const isValid = await passwordHasher.verify(hashedPassword, password);
    const isNotValid = await passwordHasher.verify(hashedPassword, 'random123');
    const isHashNotValid = await passwordHasher.verify(hashedPassword + '345', password);

    expect(isValid).toBe(true);
    expect(isNotValid).toBe(false);
    expect(isHashNotValid).toBe(false);
  });
});
