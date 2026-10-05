import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { DbClient } from '../../infrastructure/database/client.js';

interface CreateUserParams {
  email: string;
  passwordHash: string;
  name: string;
}

export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';

export interface RegisteredUser {
  id: string;
  email: string;
  name: string | null;
  status: string;
  role: string;
  createdAt: string;
}

export interface AuthenticatedUser extends RegisteredUser {
  passwordHash: string;
}

export class UserRepository {
  constructor(private readonly db: DbClient) {}

  async findByEmail(email: string): Promise<RegisteredUser | null> {
    const [user] = await this.db<RegisteredUser[]>`
           SELECT
            u.id,
            u.email,
            u.name,
            u.status,
            r.name AS role,
            u.created_at AS "createdAt",
          FROM users u
          INNER JOIN credentials c ON c.user_id = u.id
          LEFT JOIN roles r ON r.id = u.role_id
          WHERE LOWER(u.email) = LOWER(${email});      
        `;

    return user ?? null;
  }

  async findByEmailWithCredentials(email: string): Promise<AuthenticatedUser | null> {
    const [user] = await this.db<AuthenticatedUser[]>`
      SELECT
        u.id,
        u.email,
        u.name,
        u.status,
        r.name AS role,
        u.created_at AS "createdAt",
        c.password_hash AS "passwordHash"
      FROM users u
      INNER JOIN credentials c ON c.user_id = u.id
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE LOWER(u.email) = LOWER(${email});
    `;

    return user ?? null;
  }

  async createUsersWithCredentials(params: CreateUserParams): Promise<RegisteredUser> {
    const [newUser] = await this.db<RegisteredUser[]>`
      WITH default_role AS (
        SELECT id FROM roles WHERE name = 'user'
      ),
      new_user AS (
          INSERT INTO users (email, name, status, role_id)
          SELECT ${params.email}, ${params.name}, 'PENDING', dr.id
          FROM default_role dr
          RETURNING id, email, name, status, role_id, created_at AS "createdAt"
      )
      SELECT 
        nu.id,
        nu.email,
        nu.name,
        nu.status,
        r.name AS role,
        nu."createdAt"
      FROM new_user nu
      JOIN roles r ON r.id = nu.role_id;
  `;

    if (!newUser) {
      throw new AppError(ErrorCodes.INTERNAL, 'Failed to create user record.');
    }

    return newUser;
  }

  async findById(userId: string): Promise<RegisteredUser | null> {
    const [user] = await this.db<RegisteredUser[]>`
      SELECT
        u.id,
        u.email,
        u.name,
        u.status,
        r.name AS role,
        created_at AS "createdAt"
      FROM users
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE id = ${userId};
    `;

    return user ?? null;
  }

  async updateName(userId: string, name: string): Promise<RegisteredUser | null> {
    const [user] = await this.db<RegisteredUser[]>`
      WITH updated_user AS (
        UPDATE users
        SET name = ${name}
        WHERE id = ${userId}
        RETURNING
          id,
          email,
          name,
          status,
          role_id,
          created_at AS "createdAt"
      )
      SELECT
        u.id,
        u.email,
        u.name,
        u.status,
        r.name AS role,
        u."createdAt"
      FROM updated_user u
      LEFT JOIN roles r ON r.id = u.role_id;
    `;

    return user ?? null;
  }

  async updateEmail(userId: string, email: string): Promise<RegisteredUser | null> {
    const [user] = await this.db<RegisteredUser[]>`
      WITH updated_user AS (
        UPDATE users
        SET email = ${email}
        WHERE id = ${userId}
        RETURNING
          id,
          email,
          name,
          status,
          role_id,
          created_at AS "createdAt"
      )
      SELECT
        u.id,
        u.email,
        u.name,
        u.status,
        r.name AS role,
        u."createdAt"
      FROM updated_user u
      LEFT JOIN roles r ON r.id = u.role_id;
    `;

    return user ?? null;
  }

  async updateStatus(userId: string, status: UserStatus): Promise<boolean> {
    const result = await this.db`
      UPDATE users
      SET status = ${status}
      WHERE id = ${userId};
    `;

    return result.count > 1;
  }

  async findPasswordHashById(userId: string): Promise<string | null> {
    const [user] = await this.db<{ passwordHash: string }[]>`
      SELECT password_hash AS "passwordHash"
      FROM credentials
      WHERE user_id = ${userId};
    `;

    return user?.passwordHash ?? null;
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<boolean> {
    const result = await this.db`
      UPDATE credentials
      SET password_hash = ${passwordHash}
      WHERE user_id = ${userId};
    `;

    return result.count > 0;
  }
}
