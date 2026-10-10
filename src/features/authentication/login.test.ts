import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCodes } from '../../errors/codes.js';
import type { JwtSigner } from '../../infrastructure/crypto/jwt-signer.js';
import type { PasswordHasher } from '../../infrastructure/crypto/password-hasher.js';
import type { LoginAttemptRepository } from "../../infrastructure/redis/login-attempt-repository.js";
import type { SessionRepository } from "../sessions/repository.js";
import type { UserRepository } from "../users/repository.js";
import { LoginUseCase } from "./login.js";


describe('LoginUseCase security tests', () => {

    const userRepo = { findByEmailWithCredentials: vi.fn() };
    const passwordHasher = { verify: vi.fn() };
    const jwtSigner = { signAccessToken: vi.fn() };
    const sessionRepo = { create: vi.fn() };
    
    const loginAttemptRepo = { 
        
        isLimited: vi.fn(),
        recordFailure: vi.fn(),
        reset: vi.fn(),

    };

    let useCase: LoginUseCase;

    beforeEach(() => {

        vi.resetAllMocks();

        useCase = new LoginUseCase(

            userRepo as unknown as UserRepository,
            passwordHasher as unknown as PasswordHasher,
            jwtSigner as unknown as JwtSigner,
            sessionRepo as unknown as SessionRepository,
            loginAttemptRepo as unknown as LoginAttemptRepository,
            900,
            604800,

        );

        loginAttemptRepo.isLimited.mockResolvedValue(false);
        loginAttemptRepo.recordFailure.mockResolvedValue(1);
        loginAttemptRepo.reset.mockResolvedValue(undefined);

        userRepo.findByEmailWithCredentials.mockResolvedValue({
        
            id: 'user-1',
            email: 'user@example.com',
            name: 'Test User',
            passwordHash: 'stored-password-hash',
            status: 'ACTIVE',
            role: 'user',
            createdAt: new Date().toISOString(),
        
        });

        passwordHasher.verify.mockResolvedValue(true);
        jwtSigner.signAccessToken.mockResolvedValue('test-access-token');
        sessionRepo.create.mockResolvedValue({ id: 'session-1' });

    });


    it('rejects missing email or password', async () => {

        await expect(
            useCase.execute({ email: '', password: 'password123' }),
        ).rejects.toMatchObject({
            code: ErrorCodes.INVALID_ARGUMENT,
        });

        expect(loginAttemptRepo.isLimited).not.toHaveBeenCalled();
        expect(userRepo.findByEmailWithCredentials).not.toHaveBeenCalled();
        expect(passwordHasher.verify).not.toHaveBeenCalled();

    });


    it('rejects login when the attempt limit is reached', async () => {

        loginAttemptRepo.isLimited.mockResolvedValue(true);

        await expect(

            useCase.execute({
                email: 'USER@example.com',
                password: 'wrong-password',
            }),

        ).rejects.toMatchObject({
            
            code: ErrorCodes.RATE_LIMITED,
            httpStatus: 429,
        
        });

        expect(loginAttemptRepo.isLimited).toHaveBeenCalledWith('user@example.com');
        expect(userRepo.findByEmailWithCredentials).not.toHaveBeenCalled();
        expect(passwordHasher.verify).not.toHaveBeenCalled();

    });


    it('records a failed attempt when the email does not exist', async () => {

        userRepo.findByEmailWithCredentials.mockResolvedValue(null);

        await expect(
            
            useCase.execute({
                email: 'UNKNOWN@example.com',
                password: 'password123',
            }),

        ).rejects.toMatchObject({
            code: ErrorCodes.UNAUTHENTICATED,
        });

        expect(userRepo.findByEmailWithCredentials).toHaveBeenCalledWith('unknown@example.com');
        expect(loginAttemptRepo.recordFailure).toHaveBeenCalledWith('unknown@example.com');
        expect(passwordHasher.verify).not.toHaveBeenCalled();

    });


    it('records a failed attempt when the password is incorrect', async () => {

        passwordHasher.verify.mockResolvedValue(false);

        await expect(

            useCase.execute({
                email: 'USER@example.com',
                password: 'wrong-password',
            }),

        ).rejects.toMatchObject({
            code: ErrorCodes.UNAUTHENTICATED,
        });

        expect(passwordHasher.verify).toHaveBeenCalledWith(
            'stored-password-hash',
            'wrong-password',
        );

        expect(loginAttemptRepo.recordFailure).toHaveBeenCalledWith('user@example.com');
        expect(sessionRepo.create).not.toHaveBeenCalled();

    });


    it('resets failed attempts and creates a session after successful login', async () => {

        const result = await useCase.execute({
            email: 'USER@example.com',
            password: 'correct-password',
        });

        expect(result.userId).toBe('user-1');
        expect(result.email).toBe('user@example.com');
        expect(result.accessToken).toBe('test-access-token');
        expect(result.refreshToken).toBeTruthy();
        expect(result.expiresIn).toBe(900);

        expect(loginAttemptRepo.reset).toHaveBeenCalledWith('user@example.com');
        
        expect(jwtSigner.signAccessToken).toHaveBeenCalledWith({
            sub: 'user-1',
            role: 'user',
        });

        expect(sessionRepo.create).toHaveBeenCalledWith(
            
            expect.objectContaining({
                userId: 'user-1',
                refreshTokenHash: expect.any(String),
                expiresAt: expect.any(Date),
            }),

        );

        expect(loginAttemptRepo.recordFailure).not.toHaveBeenCalled();

    });


});