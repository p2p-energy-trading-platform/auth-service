import type { ErrorCode } from './codes.js';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly httpStatus = 500,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
