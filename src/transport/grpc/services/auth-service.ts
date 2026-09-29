import type { ServiceImpl } from '@connectrpc/connect';
import type { RegisterUseCase } from '../../../features/authentication/register.js';
import { toGrpcError } from '../errors.js';

import {
  AuthService,
  RegisterResponseSchema,
} from '@p2p-energy-trading-platform/typescript-sdk/gen/gridx/auth/v1/auth_pb';
import { create } from '@bufbuild/protobuf';

interface AuthServiceDependencies {
  registerUseCase: RegisterUseCase;
}

export function createAuthServiceImplementation(
  deps: AuthServiceDependencies,
): ServiceImpl<typeof AuthService> {
  return {
    register: async (req, _context) => {
      try {
        const user = await deps.registerUseCase.execute({
          email: req.email,
          password: req.password,
        });

        return create(RegisterResponseSchema, {
          userId: user.id,
          email: user.email,
          status: user.status,
          createdAt: user.createdAt,
        });
      } catch (error) {
        throw toGrpcError(error);
      }
    },
  };
}
