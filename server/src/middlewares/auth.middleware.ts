import { Request, Response, NextFunction } from 'express';
import { User } from '../models/user.model';
import { AUTH_COOKIE_NAME, verifyAccessToken } from '../utils/token';
import { AppError } from '../utils/apiError';

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;

    // 1. Extract from HTTP-only cookie
    if (req.cookies && req.cookies[AUTH_COOKIE_NAME]) {
      token = req.cookies[AUTH_COOKIE_NAME];
    }
    // 2. Fallback to Authorization Header (Bearer <token>)
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(AppError.unauthorized('Authentication token is required. Please log in.'));
    }

    // 3. Verify JWT signature & expiration
    const decoded = verifyAccessToken(token);

    // 4. Verify user exists and is active in database
    const user = await User.findById(decoded.id).select('+isActive');
    if (!user) {
      return next(AppError.unauthorized('User associated with this token no longer exists.'));
    }

    if (!user.isActive) {
      return next(AppError.forbidden('Your account has been deactivated. Please contact support.'));
    }

    // 5. Attach safe user metadata to Express Request
    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};

