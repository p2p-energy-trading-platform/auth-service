import type { DbClient } from '../../infrastructure/database/client.js'


export class AuthorizationRepository {

    constructor(private readonly db: DbClient){

    }

    async getUserRoles(userId: string): Promise<string[]> {

        const rows = await this.db<{ name: string }[]>`
        
            SELECT r.name
            FROM user_roles ur
            INNER JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = ${userId}
        
        `;

        return rows.map((row) => row.name);

    }


    async hasPermission(userId: string, permissionName: string): Promise<boolean> {

        const rows = await this.db<{ exists: boolean}[]>`
        
            SELECT EXISTS (
                SELECT 1
                FROM user_roles ur
                INNER JOIN role_permissions rp ON rp.role_id = ur.role_id
                INNER JOIN permissions p ON p.id = rp.permission_id
                WHERE ur.user_id = ${userId}
                AND p.name = ${permissionName}
            ) AS exists
        
        `;

        return rows[0]?.exists ?? false;

    }    
 
}