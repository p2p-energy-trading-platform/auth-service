import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RedisClient } from './client.js';
import { LoginAttemptRepository } from './login-attempt-repository.js';


const redis = {

    incr: vi.fn(),
    expire: vi.fn(),
    get: vi.fn(),
    del: vi.fn()

} as unknown as RedisClient;


describe('LoginAttemptRepository', () => {

    let repository: LoginAttemptRepository;

    beforeEach(() => {

        vi.clearAllMocks();

        repository = new LoginAttemptRepository(redis);

        vi.mocked(redis.incr).mockResolvedValue(1);
        vi.mocked(redis.expire).mockResolvedValue(1);
        vi.mocked(redis.get).mockResolvedValue(null);
        vi.mocked(redis.del).mockResolvedValue(1);

    });


    it('records a failed login attempt', async() => {

        const attempts = await repository.recordFailure('user@example.com');

        expect(attempts).toBe(1);
        expect(redis.incr).toHaveBeenCalledWith('auth:login:attempts:user@example.com');

    });


    it('sets the expiry when the first failed attempt occurs', async() => {

        await repository.recordFailure('user@example.com');

        expect(redis.expire).toHaveBeenCalledWith(

            'auth:login:attempts:user@example.com',
            300,

        );

    });


    it('does not reset the expiry on subsequent attempts', async() => {

        vi.mocked(redis.incr).mockResolvedValue(2);

        await repository.recordFailure('user@example.com');

        expect(redis.expire).not.toHaveBeenCalled();

    });


    it('returns zero when no attempts are recorded', async() => {

        const attempts = await repository.getAttempts('user@example.com');

        expect(attempts).toBe(0);

    });


    it('limits login after five failed attempts', async() => {

        vi.mocked(redis.get).mockResolvedValue('5');

        await expect(
            repository.isLimited('user@example.com'),
        ).resolves.toBe(true);

    });


    it('does not limit login before five failed attempts', async() => {

        vi.mocked(redis.get).mockResolvedValue('4');

        await expect(
            repository.isLimited('user@example.com'),
        ).resolves.toBe(false);

    });


    it('resets the failed login counts', async() => {

        await repository.reset('user@example.com');

        expect(redis.del).toHaveBeenCalledWith(            
            'auth:login:attempts:user@example.com',
        );

    });


});

