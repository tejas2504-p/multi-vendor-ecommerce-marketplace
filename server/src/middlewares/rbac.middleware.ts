import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/user.model';
import { AppError } from '../utils/apiError';

/**
 * Reusable Role-Based Authorization Middleware
 * Usage:
 *   authorize("admin")
 *   authorize("vendor", "admin")
 *   authorize("customer", "vendor", "admin")
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // 1. Ensure user has been authenticated via JWT middleware
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required to access this resource'));
    }

    // 2. Validate role field presence on authenticated user
    const userRole = req.user.role;
    if (!userRole) {
      return next(AppError.forbidden('User role information is missing or invalid'));
    }

    // 3. Verify user's role against permitted roles
    if (!allowedRoles.includes(userRole)) {
      return next(
        AppError.forbidden(
          `Access forbidden: Role '${userRole}' does not have sufficient permissions. Required: [${allowedRoles.join(
            ', '
          )}]`
        )
      );
    }

    next();
  };
};

