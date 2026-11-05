import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env.config';
import { logger } from '../utils/logger';

/**
 * Reusable AWS S3 client instance.
 * Credentials are loaded from environment variables only — never from client code.
 */
let s3Client: S3Client;

export const getS3Client = (): S3Client => {
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.AWS_REGION,
      credentials:
        env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: env.AWS_ACCESS_KEY_ID,
              secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            }
          : undefined, // Falls back to IAM role / instance profile
    });
    logger.info(`✅ AWS S3 client initialised [region: ${env.AWS_REGION}, bucket: ${env.AWS_S3_BUCKET_NAME}]`);
  }
  return s3Client;
};

export const S3_BUCKET = env.AWS_S3_BUCKET_NAME;

/** Root prefix — all product image objects live under products/ */
export const PRODUCT_IMAGE_PREFIX = 'products';

/**
 * Build a canonical S3 object key for a product image.
 * Pattern: products/<vendorId>/<productId>/<uniqueFilename>
 */
export const buildObjectKey = (
  vendorId: string,
  productId: string,
  uniqueFilename: string
): string => {
  // Sanitise every segment to prevent path traversal
  const safeVendor  = vendorId.replace(/[^a-zA-Z0-9]/g, '');
  const safeProduct = productId.replace(/[^a-zA-Z0-9]/g, '');
  const safeName    = uniqueFilename.replace(/[^a-zA-Z0-9._-]/g, '');
  return `${PRODUCT_IMAGE_PREFIX}/${safeVendor}/${safeProduct}/${safeName}`;
};

