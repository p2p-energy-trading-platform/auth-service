import { randomBytes } from 'node:crypto';
import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';

import type { JwtSigner } from '../../infrastructure/crypto/jwt-signer.js';
import { hashOpaqueToken } from '../../infrastructure/crypto/token-hasher.js';
import type { SessionRepository } from '../sessions/repository.js';
import type { UserRepository } from '../users/repository.js';



interface RefreshInput {
    refreshToken: string;
}


export interface RefreshOutput {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}


export class RefreshUseCase {

    constructor(

        private readonly userRepo: UserRepository,
        private readonly jwtSigner:  JwtSigner,
        private readonly sessionRepo: SessionRepository,
        private readonly accessTokenTtlSeconds: number,
        private readonly refreshTokenTtlSeconds: number

    ){

    }


    async execute(input: RefreshInput): Promise<RefreshOutput> {

        if(!input.refreshToken){
            throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'Refresh token is required');
        }

        const refreshTokenHash = hashOpaqueToken(input.refreshToken);

        const session = await this.sessionRepo.findActiveByRefreshTokenHash(refreshTokenHash);

        if(!session){
            throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Invalid refresh token');
        }

        const user = await this.userRepo.findByIdWithRoles(session.userId);

        if(!user){
            throw new AppError(ErrorCodes.UNAUTHENTICATED, 'User not found');
        }        

        if(user.status !== 'ACTIVE'){
            throw new AppError(ErrorCodes.UNAUTHENTICATED, 'User is not active');
        }

        const accessToken = await this.jwtSigner.signAccessToken({
            sub: user.id,
            roles: user.roles,
        });

        const newRefreshToken = randomBytes(32).toString('base64url')

        const newRefreshTokenHash = hashOpaqueToken(newRefreshToken);

    }

}