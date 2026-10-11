import type { DbClient } from '../../infrastructure/database/client.js';
import type { OnboardingState } from './state.js';

export interface KycSubmission {
  id: string;
  userId: string;
  fullName: string;
  dateOfBirth: string;
  dubaiId: string;
  documentPath: string;
  state: OnboardingState;
  rejectionReason: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaveKycSubmissionParams {
  userId: string;
  fullName: string;
  dateOfBirth: string;
  dubaiId: string;
  documentPath: string;
}

export class KycRepository {
  constructor(private readonly db: DbClient) {}

  async findByUserId(userId: string): Promise<KycSubmission | null> {
    const [submission] = await this.db<KycSubmission[]>`
      SELECT
        k.id,
        k.user_id AS "userId",
        k.full_legal_name AS "fullName",
        k.date_of_birth AS "dateOfBirth",
        k.dubai_id AS "dubaiId",
        k.document_path AS "documentPath",
        u.kyc_status AS state,
        k.rejection_reason AS "rejectionReason",
        k.verified_at AS "verifiedAt",
        k.created_at AS "createdAt",
        k.updated_at AS "updatedAt"
      FROM kyc_submissions k
      INNER JOIN users u ON u.id = k.user_id
      WHERE k.user_id = ${userId};
    `;

    return submission ?? null;
  }

  async saveSubmission(params: SaveKycSubmissionParams): Promise<KycSubmission | null> {
    const [submission] = await this.db<KycSubmission[]>`
      WITH updated_user AS (
        UPDATE users
        SET kyc_status = 'PENDING'
        WHERE id = ${params.userId}
          AND kyc_status IN ('NOT_REQUIRED', 'PENDING', 'REJECTED')
        RETURNING id
      )
      INSERT INTO kyc_submissions (
        user_id,
        full_legal_name,
        date_of_birth,
        dubai_id,
        document_path,
        status,
        rejection_reason,
        verified_at
      )
      SELECT
        id,
        ${params.fullName},
        ${params.dateOfBirth},
        ${params.dubaiId},
        ${params.documentPath},
        'PENDING',
        NULL,
        NULL
      FROM updated_user
      ON CONFLICT (user_id) DO UPDATE SET
        full_legal_name = EXCLUDED.full_legal_name,
        date_of_birth = EXCLUDED.date_of_birth,
        dubai_id = EXCLUDED.dubai_id,
        document_path = EXCLUDED.document_path,
        status = EXCLUDED.status,
        rejection_reason = EXCLUDED.rejection_reason,
        verified_at = EXCLUDED.verified_at
      RETURNING
        id,
        user_id AS "userId",
        full_legal_name AS "fullName",
        date_of_birth AS "dateOfBirth",
        dubai_id AS "dubaiId",
        document_path AS "documentPath",
        status AS state,
        rejection_reason AS "rejectionReason",
        verified_at AS "verifiedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt";
    `;

    return submission ?? null;
  }
}
