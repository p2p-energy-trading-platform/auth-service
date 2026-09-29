import { Code, ConnectError } from '@connectrpc/connect';
import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';

export function toGrpcError(error: unknown): ConnectError {
  if (error instanceof AppError) {
    const status = mapStatus(error.code);
    return new ConnectError(error.message, status);
  }

  if (error instanceof ConnectError) {
    return error;
  }

  return new ConnectError('Internal Server Error', Code.Internal);
}

function mapStatus(code: AppError['code']): Code {
  switch (code) {
    case ErrorCodes.INVALID_ARGUMENT:
      return Code.InvalidArgument;

    case ErrorCodes.UNAUTHENTICATED:
      return Code.Unauthenticated;

    case ErrorCodes.FORBIDDEN:
      return Code.PermissionDenied;

    case ErrorCodes.NOT_FOUND:
      return Code.NotFound;

    case ErrorCodes.CONFLICT:
      return Code.AlreadyExists;

    case ErrorCodes.RATE_LIMITED:
      return Code.ResourceExhausted;

    case ErrorCodes.NOT_IMPLEMENTED:
      return Code.Unimplemented;

    default:
      return Code.Internal;
  }
}
