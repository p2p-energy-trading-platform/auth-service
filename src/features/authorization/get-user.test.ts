import { describe, expect, it, vi } from 'vitest';
import { GetUseCase } from './get-user.js';
import type { AuthenticatedUser } from '../users/repository.js';


describe('GetUseCase', () => {

    it('returns user details and roles for a valid user', async () => {

        const userRepo = {

            findByIdWithRoles: vi.fn<(userId: string) => Promise<AuthenticatedUser | null>>().mockResolvedValue({
                id: 'user-123',
                email: 'user@example.com',
                status: 'ACTIVE',
                roles: ['user'],
                passwordHash: 'test-password-hash',
                name: 'Test User',
            }),
            
        };

        const useCase = new GetUseCase(userRepo as any);

        const result = await useCase.execute({ userId: 'user-123' });

        expect(result).toEqual({
            id: 'user-123',
            email: 'user@example.com',
            status: 'ACTIVE',
            roles: ['user'],
            name: 'Test User',
        });

        expect(userRepo.findByIdWithRoles).toHaveBeenCalledWith('user-123');

    });


    it('throws INVALID_ARGUMENT when userId is missing', async () => {

        const userRepo = {
            findByIdWithRoles: vi.fn<(userId: string) => Promise<AuthenticatedUser | null>>(),
        };

        const useCase = new GetUseCase(userRepo as any);

        await expect(useCase.execute({ userId: '' })).rejects.toMatchObject({code: 'INVALID_ARGUMENT'});

    });


    it('throws NOT_FOUND when the user does not exist', async () => {

        const userRepo = {
            findByIdWithRoles: vi.fn<(userId: string) => Promise<AuthenticatedUser | null>>().mockResolvedValue(null),
        };

        const useCase = new GetUseCase(userRepo as any);

        await expect(useCase.execute({ userId: 'user-123' })).rejects.toMatchObject({code: 'NOT_FOUND'});

    });


    it('returns null when user name is not set', async () => {

        const userRepo = {

            findByIdWithRoles: vi.fn<(userId: string) => Promise<AuthenticatedUser | null>>().mockResolvedValue({
                id: 'user-123',
                email: 'user@example.com',
                status: 'ACTIVE',
                roles: ['user'],
                passwordHash: 'test-password-hash',
                name: null,
            }),

        };

        const useCase = new GetUseCase(userRepo as any);

        const result = await useCase.execute({ userId: 'user-123' });

        expect(result).toEqual({
            id: 'user-123',
            email: 'user@example.com',
            status: 'ACTIVE',
            roles: ['user'],
            name: null,
        });

    });

});