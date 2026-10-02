import type { DbClient } from '../../infrastructure/database/client.js'


export class AuthorizationRepository {

    constructor(private readonly db: DbClient){

    }

    async getUserRoles(userId: string): Promise<string[]> {

        const rows = await this.db<{ name: string }[]>`
        
            SELECT r.name
            FROM user_roles ur
            INNER JOIN roles r ON r.id = ur.role_id
            WHERE ur.user.id = ${userId}
        
        `;

        return rows.map((row) => row.name);

    }


}