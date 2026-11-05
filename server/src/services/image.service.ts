import { v4 as uuidv4 } from 'uuid';
import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3Client, S3_BUCKET, buildObjectKey } from '../config/s3.config';
import { AppError } from '../utils/apiError';
import { logger } from '../utils/logger';

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

const EXTENSION_MAP: Record<AllowedMimeType, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export interface UploadedImageMeta {
  /** Stable S3 object key stored in MongoDB — never a presigned URL */
  key: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

/**
 * Reusable Image Storage Service using AWS S3 SDK v3.
 * Stored as a class with static methods so methods can be cleanly mocked in tests.
 */
export class ImageStorageService {
  /**
   * Upload a single image buffer to S3.
   * Returns the stable object key and metadata — not a presigned URL.
   */
  static uploadImageToS3 = async (
    buffer: Buffer,
    mimeType: string,
    originalName: string,
    vendorId: string,
    productId: string
  ): Promise<UploadedImageMeta> => {
    if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType)) {
      throw AppError.badRequest(
        `Unsupported image format. Accepted types: JPEG, PNG, WebP.`
      );
    }

    const ext = EXTENSION_MAP[mimeType as AllowedMimeType];
    const uniqueFilename = `${uuidv4()}${ext}`;
    const objectKey = buildObjectKey(vendorId, productId, uniqueFilename);

    try {
      await getS3Client().send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: objectKey,
          Body: buffer,
          ContentType: mimeType,
          ContentLength: buffer.length,
          // Private bucket, no public ACL
        })
      );

      logger.info(`Image uploaded to S3: ${objectKey} (${buffer.length} bytes)`);

      return {
        key: objectKey,
        originalName,
        mimeType,
        sizeBytes: buffer.length,
        uploadedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error(`S3 upload failed for key ${objectKey}: ${error.message}`);
      throw AppError.internal('Image upload failed. Please try again.');
    }
  };

  /**
   * Delete a single S3 object by key.
   * Swallows NoSuchKey errors (idempotent); throws on unexpected errors.
   */
  static deleteImageFromS3 = async (objectKey: string): Promise<void> => {
    try {
      await getS3Client().send(
        new DeleteObjectCommand({
          Bucket: S3_BUCKET,
          Key: objectKey,
        })
      );
      logger.info(`Deleted S3 object: ${objectKey}`);
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        logger.warn(`S3 object not found (already deleted?): ${objectKey}`);
        return;
      }
      logger.error(`S3 delete failed for key ${objectKey}: ${error.message}`);
      throw AppError.internal('Failed to delete image from storage.');
    }
  };

  /**
   * Delete multiple S3 objects by key.
   * Partial failures are logged but do not throw — cleanup is best-effort.
   */
  static deleteImagesFromS3 = async (objectKeys: string[]): Promise<void> => {
    await Promise.allSettled(
      objectKeys.map((key) => ImageStorageService.deleteImageFromS3(key))
    );
  };

  /**
   * Generate a short-lived presigned GET URL for a private S3 object.
   * Default expiry: 60 minutes (3600 seconds).
   * These are NEVER stored in MongoDB — only generated on demand.
   */
  static generatePresignedGetUrl = async (
    objectKey: string,
    expiresInSeconds: number = 3600
  ): Promise<string> => {
    try {
      const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: objectKey,
      });
      const url = await getSignedUrl(getS3Client(), command, {
        expiresIn: expiresInSeconds,
      });
      return url;
    } catch (error: any) {
      logger.error(`Failed to generate presigned URL for ${objectKey}: ${error.message}`);
      throw AppError.internal('Failed to generate image access URL.');
    }
  };

  /**
   * Generate presigned GET URLs for multiple keys in parallel.
   */
  static generatePresignedGetUrls = async (
    objectKeys: string[],
    expiresInSeconds: number = 3600
  ): Promise<string[]> => {
    return Promise.all(
      objectKeys.map((key) => ImageStorageService.generatePresignedGetUrl(key, expiresInSeconds))
    );
  };
}

// Function aliases for backward compatibility
export const uploadImageToS3 = ImageStorageService.uploadImageToS3;
export const deleteImageFromS3 = ImageStorageService.deleteImageFromS3;
export const deleteImagesFromS3 = ImageStorageService.deleteImagesFromS3;
export const generatePresignedGetUrl = ImageStorageService.generatePresignedGetUrl;
export const generatePresignedGetUrls = ImageStorageService.generatePresignedGetUrls;
