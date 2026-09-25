import argon2 from 'argon2';

export class PasswordHasher {
  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
    });
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    return argon2.verify(passwordHash, password);
  }
}
