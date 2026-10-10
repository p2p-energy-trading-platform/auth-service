import type { RedisClient } from './client.js';
import { loginAttemptsKey } from './keys.js';


export class LoginAttemptRepository{

    constructor(

        private readonly redis: RedisClient,
        private readonly maxAttempts = 5,
        private readonly windowSeconds = 300

    ){

    }

    async recordFailure(email: string): Promise<number>{

        const key = loginAttemptsKey(email);

        const attempts = await this.redis.incr(key);

        if(attempts === 1){
            await this.redis.expire(key, this.windowSeconds);
        }

        return attempts;

    }

    async getAttempts(email: string): Promise<number>{

        const attempts = await this.redis.get(loginAttemptsKey(email));

        return attempts === null ? 0 : Number(attempts);

    }

    async isLimited(email: string): Promise<boolean> {

        return (await this.getAttempts(email)) >= this.maxAttempts;

    }

    async reset(email: string): Promise<void> {

        await this.redis.del(loginAttemptsKey(email));

    }

}