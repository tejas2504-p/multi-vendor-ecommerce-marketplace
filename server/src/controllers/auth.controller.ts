import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { ApiResponse } from '../utils/apiResponse';
import {
  AUTH_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  getAuthCookieOptions,
  getRefreshCookieOptions,
  getClearCookieOptions,
} from '../utils/token';

export class AuthController {
  /**
   * POST /api/auth/register
   * Registers a new user and delivers HTTP-only JWT cookies
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, token, refreshToken } = await AuthService.register(req.body);

      // Set secure HTTP-only cookies
      res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
      if (refreshToken) {
        res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());
      }

      ApiResponse.created(
        res,
        { user, token, refreshToken },
        'Account registered successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/login
   * Validates credentials and sets HTTP-only JWT cookies
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, token, refreshToken } = await AuthService.login(req.body);

      // Set secure HTTP-only cookies
      res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
      if (refreshToken) {
        res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());
      }

      ApiResponse.success(
        res,
        { user, token, refreshToken },
        'Login successful'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/refresh
   * Rotates and delivers fresh access and refresh tokens
   */
  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const incomingRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
      const { user, token, refreshToken } = await AuthService.refresh(incomingRefreshToken);

      res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
      if (refreshToken) {
        res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());
      }

      ApiResponse.success(
        res,
        { user, token, refreshToken },
        'Token refreshed successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Clears the HTTP-only authentication and refresh cookies
   */
  static async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.clearCookie(AUTH_COOKIE_NAME, getClearCookieOptions());
      res.clearCookie(REFRESH_COOKIE_NAME, getClearCookieOptions());

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

