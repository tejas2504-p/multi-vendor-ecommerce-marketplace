import jwt, { SignOptions } from 'jsonwebtoken';
import { CookieOptions } from 'express';
import { env } from '../config/env.config';
import { AppError } from './apiError';

export const AUTH_COOKIE_NAME = 'access_token';

export interface TokenPayload {
  id: string;
  email: string;
  role: 'customer' | 'vendor' | 'admin';
}

export const generateAccessToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRY as any,
  };

  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
};

export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized('Authentication token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw AppError.unauthorized('Invalid authentication token');
    }
    throw AppError.unauthorized('Authentication verification failed');
  }
};

export const getAuthCookieOptions = (): CookieOptions => {
  const isProduction = env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/',
  };
};

export const getClearCookieOptions = (): CookieOptions => {
  const isProduction = env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/',
  };
};

