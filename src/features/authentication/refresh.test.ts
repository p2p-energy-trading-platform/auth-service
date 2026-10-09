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

        });

        sessionRepo.revokeByRefreshTokenHash.mockResolvedValue(true);
        sessionRepo.create.mockResolvedValue({ id: 'new-session-1' });

    });

    it('rejects a missing refresh token', async() => {

        await expect(
            useCase.execute({ refreshToken: '' })
        ).rejects.toMatchObject({
            code: ErrorCodes.INVALID_ARGUMENT,
        });

        expect(sessionRepo.findActiveByRefreshTokenHash).not.toHaveBeenCalled();

    });

    it('rejects an invalid or revoked refresh token', async() => {

        sessionRepo.findActiveByRefreshTokenHash.mockResolvedValue(null);

        await expect(
            useCase.execute({ refreshToken: 'oldrefreshToken' })
        ).rejects.toMatchObject({
            code: ErrorCodes.UNAUTHENTICATED,
        });

        expect(userRepo.findById).not.toHaveBeenCalled();

    });


    it('rejects a refresh token when its user is suspended', async() => {

        userRepo.findById.mockResolvedValue({

            id: 'user-1',
            email: 'user@example.com',
            name: 'Test User',
            status: 'SUSPENDED',
            role: 'user',
            createdAt: new Date().toISOString(),

        });

        await expect(
            useCase.execute({ refreshToken: 'oldrefreshToken' })
        ).rejects.toMatchObject({
            code: ErrorCodes.UNAUTHENTICATED,
        });

        expect(sessionRepo.revokeByRefreshTokenHash).not.toHaveBeenCalled();

    });


    it('rotates a valid refresh token and revokes the old token', async () => {
        
        const result = await useCase.execute({ refreshToken: 'old-refresh-token' });

        expect(result.accessToken).toBe('new-access-token');
        expect(result.refreshToken).toBeTruthy();
        expect(result.refreshToken).not.toBe('old-refresh-token');

        expect(sessionRepo.revokeByRefreshTokenHash).toHaveBeenCalledWith(expect.any(String));

        expect(sessionRepo.create).toHaveBeenCalledWith(

            expect.objectContaining({
                userId: 'user-1',
                refreshTokenHash: expect.any(String),
                expiresAt: expect.any(Date),
            }),
            
        );

    });

    it('rejects replay when the old token is no longer active', async () => {
        
        sessionRepo.findActiveByRefreshTokenHash.mockResolvedValueOnce({

            id: 'session-1',
            userId: 'user-1',
            refreshTokenHash: 'old-token-hash',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            revokedAt: null,

        }).mockResolvedValueOnce(null);

        await useCase.execute({ refreshToken: 'old-refresh-token' });

        await expect(
            useCase.execute({ refreshToken: 'old-refresh-token' }),
        ).rejects.toMatchObject({
            code: ErrorCodes.UNAUTHENTICATED,
        });

    });
    

});