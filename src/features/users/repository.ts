import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { DbClient } from '../../infrastructure/database/client.js';

interface CreateUserParams {
  email: string;
  passwordHash: string;
  name: string;
}

export interface RegisteredUser {
  id: string;
  email: string;
  name: string | null;
  status: string;
  createdAt: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  status: string;
  passwordHash: string;
  roles: string[];
}

export class UserRepository {
  constructor(private readonly db: DbClient) {}

  async findByEmail(email: string): Promise<{ id: string } | null> {
    const [user] = await this.db<{ id: string }[]>`
            SELECT id FROM users WHERE LOWER(email) = LOWER(${email});       
        `;

    return user || null;
  }

  async findByEmailWithCredentials(email: string): Promise<AuthenticatedUser | null> {
    const [user] = await this.db<AuthenticatedUser[]>`
      SELECT
        u.id,
        u.email,
        u.status,
        c.password_hash AS "passwordHash",
        COALESCE(
          array_agg(r.name) FILTER (WHERE r.name IS NOT NULL),
          '{}'
        ) AS roles
      FROM users u
      INNER JOIN credentials c ON c.user_id = u.id
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE LOWER(u.email) = LOWER(${email})
      GROUP BY u.id, u.email, u.status, c.password_hash;
    `;

    return user ?? null;
  }

  async createUsersWithCredentials(params: CreateUserParams): Promise<RegisteredUser> {
    const [newUser] = await this.db<RegisteredUser[]>`
            WITH new_user AS (
                INSERT INTO users (email, name, status)
                VALUES (${params.email}, ${params.name}, 'PENDING')
                RETURNING id, email, name, status, created_at AS "createdAt"
            ),
            new_credentials AS (
                INSERT INTO credentials (user_id, password_hash)
                SELECT id, ${params.passwordHash} FROM new_user
            ),
            new_role AS (
                INSERT INTO user_roles (user_id, role_id)
                SELECT new_user.id, roles.id 
                FROM new_user, roles 
                WHERE roles.name = 'user'
            )
            SELECT * FROM new_user;
        `;

    if (!newUser) {
      throw new AppError(ErrorCodes.INTERNAL, 'Failed to create user record.');
    }

    return newUser;
  }

  async findByIdWithRoles(userId: string): Promise<AuthenticatedUser | null> {

    const [user] = await this.db<AuthenticatedUser[]>`

      SELECT u.id, 
             u.email, 
             u.name,
             u.status,
             c.password_hash AS "passwordHash",
             COALESCE(
               array_agg(r.name) FILTER (WHERE r.name IS NOT NULL),
               '{}'
             ) AS roles
             FROM users u
             INNER JOIN credentials c ON c.user_id = u.id
             LEFT JOIN user_roles ur ON ur.user_id = u.id
             LEFT JOIN roles r ON r.id = ur.role_id
             WHERE u.id = ${userId}
             GROUP BY u.id, u.email, u.name, u.status, c.password_hash;

    `

    if (!user) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'User not found.');
    }

    return user ?? null;

  }

  async findById(userId: string): Promise<RegisteredUser | null> {
    const [user] = await this.db<RegisteredUser[]>`
      SELECT
        id,
        email,
        name,
        status,
        created_at AS "createdAt"
      FROM users
      WHERE id = ${userId};
    `;

    return user ?? null;
  }

  async updateName(userId: string, name: string): Promise<RegisteredUser | null> {
    const [user] = await this.db<RegisteredUser[]>`
      UPDATE users
      SET name = ${name}
      WHERE id = ${userId}
      RETURNING
        id,
        email,
        name,
        status,
        created_at AS "createdAt";
    `;

    return user ?? null;
  }

  async updateEmail(userId: string, email: string): Promise<RegisteredUser | null> {
    const [user] = await this.db<RegisteredUser[]>`
      UPDATE users
      SET email = ${email}
      WHERE id = ${userId}
      RETURNING
        id,
        email,
        name,
        status,
        created_at AS "createdAt";
    `;

    return user ?? null;
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
