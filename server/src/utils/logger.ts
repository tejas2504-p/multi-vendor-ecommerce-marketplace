import winston from 'winston';
import { env } from '../config/env.config';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const customFormat = printf(({ level, message, timestamp: time, stack }) => {
  return `${time} [${level}]: ${stack || message}`;
});

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    env.NODE_ENV === 'development' ? colorize() : winston.format.json(),
    customFormat
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

