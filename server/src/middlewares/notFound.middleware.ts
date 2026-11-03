import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/apiError';

export const notFoundMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  next(AppError.notFound(`Cannot find endpoint ${req.method} ${req.originalUrl}`));
};

