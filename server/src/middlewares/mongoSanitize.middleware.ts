import { Request, Response, NextFunction } from 'express';

/**
 * Strips keys containing '$' or '.' from user-supplied input objects
 * to prevent NoSQL operator injection in MongoDB queries.
 */
function cleanNoSqlInjection(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(cleanNoSqlInjection);
  }

  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else {
      cleanNoSqlInjection(obj[key]);
    }
  }

  return obj;
}

export const mongoSanitizeMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  // Webhook raw payloads must be preserved bit-for-bit for HMAC signature verification
  const isWebhook = req.originalUrl?.includes('/webhook') || req.path?.includes('/webhook');

  if (!isWebhook && req.body && typeof req.body === 'object') {
    cleanNoSqlInjection(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    cleanNoSqlInjection(req.query);
  }

  if (req.params && typeof req.params === 'object') {
    cleanNoSqlInjection(req.params);
  }

  next();
};
