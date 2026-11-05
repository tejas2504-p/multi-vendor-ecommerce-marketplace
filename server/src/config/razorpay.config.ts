import Razorpay from 'razorpay';
import { env } from './env.config';
import { logger } from '../utils/logger';

export const getRazorpayClient = (): Razorpay => {
  return new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
};

export const razorpayClient = getRazorpayClient();

logger.info(`Razorpay client initialized with Key ID: ${env.RAZORPAY_KEY_ID.substring(0, 8)}...`);

