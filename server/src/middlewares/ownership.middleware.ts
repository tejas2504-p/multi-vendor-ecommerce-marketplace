import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/apiError';

export type OwnerIdResolver = (req: Request) => Promise<string | null | undefined> | string | null | undefined;

/**
 * Reusable helper to verify if the authenticated user owns the resource or is an admin.
 */
export const isResourceOwner = (
  resourceOwnerId: string,
  currentUserId: string,
  currentUserRole: string
): boolean => {
  // Admins possess override privileges
  if (currentUserRole === 'admin') {
    return true;
  }
  return resourceOwnerId.toString() === currentUserId.toString();
};

/**
 * Reusable Middleware Factory for Resource Ownership Verification
 *
 * Example Usage:
 *   authorizeOwnership((req) => req.params.vendorId)
 *   authorizeOwnership(async (req) => {
 *     const product = await Product.findById(req.params.id);
 *     return product ? product.vendorId.toString() : null;
 *   })
 */
export const authorizeOwnership = (resolveOwnerId: OwnerIdResolver) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(AppError.unauthorized('Authentication required to verify resource ownership'));
      }

      const resourceOwnerId = await resolveOwnerId(req);

      if (!resourceOwnerId) {
        return next(AppError.notFound('Target resource not found for ownership verification'));
      }

      // Check if current user owns the resource or is a platform admin
      if (!isResourceOwner(resourceOwnerId, req.user.id, req.user.role)) {
        return next(
          AppError.forbidden('Access forbidden: You do not possess ownership permissions for this resource')
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

