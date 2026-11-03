import { StatusCodes } from 'http-status-codes';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
    isOperational: boolean = true,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(message, StatusCodes.BAD_REQUEST, true, details);
  }

  static unauthorized(message: string = 'Unauthorized') {
    return new AppError(message, StatusCodes.UNAUTHORIZED);
  }

  static forbidden(message: string = 'Forbidden resource') {
    return new AppError(message, StatusCodes.FORBIDDEN);
  }

  static notFound(message: string = 'Resource not found') {
    return new AppError(message, StatusCodes.NOT_FOUND);
  }

  static conflict(message: string) {
    return new AppError(message, StatusCodes.CONFLICT);
  }

  static internal(message: string = 'Internal server error') {
    return new AppError(message, StatusCodes.INTERNAL_SERVER_ERROR, false);
  }
}

