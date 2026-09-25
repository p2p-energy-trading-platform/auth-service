import * as grpc from '@grpc/grpc-js';

import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';

export function toGrpcError(error: unknown): grpc.ServiceError {
  if (error instanceof AppError) {
    const status = mapStatus(error.code);

    return Object.assign(new Error(error.message), {
      code: status,
      details: error.message,
    }) as grpc.ServiceError;
  }

  return Object.assign(new Error('Internal server error'), {
    code: grpc.status.INTERNAL,
    details: 'Internal server error',
  }) as grpc.ServiceError;
}

function mapStatus(code: AppError['code']): grpc.status {
  switch (code) {
    case ErrorCodes.INVALID_ARGUMENT:
      return grpc.status.INVALID_ARGUMENT;

    case ErrorCodes.UNAUTHENTICATED:
      return grpc.status.UNAUTHENTICATED;

    case ErrorCodes.FORBIDDEN:
      return grpc.status.PERMISSION_DENIED;

    case ErrorCodes.NOT_FOUND:
      return grpc.status.NOT_FOUND;

    case ErrorCodes.CONFLICT:
      return grpc.status.ALREADY_EXISTS;

    case ErrorCodes.RATE_LIMITED:
      return grpc.status.RESOURCE_EXHAUSTED;

    case ErrorCodes.NOT_IMPLEMENTED:
      return grpc.status.UNIMPLEMENTED;

    default:
      return grpc.status.INTERNAL;
  }
}
