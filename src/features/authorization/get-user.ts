import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import type { UserRepository } from '../users/repository.js';


interface GetUserInput {
    userId: string;
}

export interface GetUserResult {
    id: string;
    email: string;
    status: string;
    role: string;
    name: string | null;
}


export class  GetUseCase {

    constructor(private readonly userRepo: UserRepository) {

    }

    async execute(input: GetUserInput): Promise<GetUserResult> {

        if(!input.userId){
            throw new AppError(ErrorCodes.INVALID_ARGUMENT, 'User ID is required');
        }


        const user = await this.userRepo.findById(input.userId);

        if(!user){
            throw new AppError(ErrorCodes.NOT_FOUND, 'User not found');
        }

        return {
            id: user.id,
            email: user.email,
            status: user.status,
            role: user.role,
            name: user.name
        };

    }


}