import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import { AppError } from '../utils/apiError';
import { logger } from '../utils/logger';
import { env } from '../config/env.config';

export const errorMiddleware = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  let message = 'An unexpected error occurred';
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let details: unknown = undefined;

  // Custom AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errorCode = StatusCodes[statusCode] || 'APP_ERROR';
    details = err.details;
  }
  // Zod Validation Error
  else if (err instanceof ZodError) {
    statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
    message = 'Validation failed';
    errorCode = 'VALIDATION_ERROR';
    details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
  }
  // JWT Errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = StatusCodes.UNAUTHORIZED;
    message = 'Invalid authentication token';
    errorCode = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = StatusCodes.UNAUTHORIZED;
    message = 'Authentication token expired';
    errorCode = 'TOKEN_EXPIRED';
  }
  // Mongoose Duplicate Key Error
  else if ((err as { code?: number }).code === 11000) {
    statusCode = StatusCodes.CONFLICT;
    message = 'Duplicate field value entered';
    errorCode = 'DUPLICATE_KEY';
  }
  // Mongoose CastError
  else if (err.name === 'CastError') {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Invalid resource identifier format';
    errorCode = 'INVALID_ID';
  }

  // Log error
  if (statusCode >= 500) {
    logger.error(`[${req.method}] ${req.originalUrl} - ${err.message}`, {
      stack: err.stack,
    });
  } else {
    logger.warn(`[${req.method}] ${req.originalUrl} - ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      ...(details ? { details } : {}),
      ...(env.NODE_ENV === 'development' && statusCode >= 500 ? { stack: err.stack } : {}),
    },
  });
};

