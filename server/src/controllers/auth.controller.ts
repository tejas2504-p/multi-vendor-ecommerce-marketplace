import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { ApiResponse } from '../utils/apiResponse';
import { AUTH_COOKIE_NAME, getAuthCookieOptions, getClearCookieOptions } from '../utils/token';

export class AuthController {
  /**
   * POST /api/auth/register
   * Registers a new user and delivers an HTTP-only JWT cookie
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, token } = await AuthService.register(req.body);

      // Set secure HTTP-only cookie
      res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

      ApiResponse.created(
        res,
        { user, token },
        'Account registered successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/login
   * Validates credentials and sets an HTTP-only JWT cookie
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, token } = await AuthService.login(req.body);

      // Set secure HTTP-only cookie
      res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

      ApiResponse.success(
        res,
        { user, token },
        'Login successful'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Clears the HTTP-only authentication cookie
   */
  static async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.clearCookie(AUTH_COOKIE_NAME, getClearCookieOptions());

      ApiResponse.success(
        res,
        null,
        'Logged out successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   * Returns safe profile for the currently authenticated session
   */
  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await AuthService.getProfile(req.user!.id);

      ApiResponse.success(
        res,
        { user },
        'Profile retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
}

