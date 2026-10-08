import { beforeEach, describe, expect, it , vi } from 'vitest';
import { ErrorCodes } from '../../errors/codes.js';
import type { JwtSigner } from '../../infrastructure/crypto/jwt-signer.js';
import type { SessionRepository } from '../sessions/repository.js';
import type { UserRepository } from '../users/repository.js';
import { RefreshUseCase } from './refresh.js';


describe('RefreshUseCase security tests', () => {

    const userRepo = { findById: vi.fn() };
    const jwtSigner = { signAccessToken: vi.fn() };

    const sessionRepo = { 

        findActiveByRefreshTokenHash: vi.fn(),
        revokeByRefreshTokenHash: vi.fn(),
        create: vi.fn(),

    };

    let useCase: RefreshUseCase;

    beforeEach(() => {

        vi.resetAllMocks();

        useCase = new RefreshUseCase(

            userRepo as unknown as UserRepository,
            jwtSigner as unknown as JwtSigner,
            sessionRepo as unknown as SessionRepository,
            900,
            604800

        );


        userRepo.findById.mockResolvedValue({
            
            id: 'user-1',
            email: 'user@example.com',
            name: 'Test User',
            status: 'ACTIVE',
            role: 'user',
            createdAt: new Date().toISOString(),

        });

        jwtSigner.signAccessToken.mockResolvedValue('new-access-token');

        sessionRepo.findActiveByRefreshTokenHash.mockResolvedValue({

            id: 'session-1',
            userId: 'user-1',
            refreshTokenHash: 'old-token-hash',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            revokedAt: null,

        })

    })

});