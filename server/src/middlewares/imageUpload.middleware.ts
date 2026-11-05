import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import { ALLOWED_MIME_TYPES } from '../services/image.service';

/** Maximum file size per image: 5 MB */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Maximum images per product */
export const MAX_IMAGES_PER_PRODUCT = 5;

/**
 * Multer configuration using memory storage.
 * Files are kept in-memory as Buffer objects so we can inspect content
 * before uploading to S3. No files are written to disk.
 */
export const imageUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_IMAGES_PER_PRODUCT,
  },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype as any)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type '${file.mimetype}'. Only JPEG, PNG and WebP images are accepted.`
        )
      );
    }
  },
});

/**
 * Magic-byte signatures for content-based MIME type verification.
 * Prevents disguising non-image files with a fake extension.
 */
const MAGIC_BYTES: { mime: string; header: number[] }[] = [
  { mime: 'image/jpeg', header: [0xff, 0xd8, 0xff] },
  { mime: 'image/png',  header: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/webp', header: [0x52, 0x49, 0x46, 0x46] }, // RIFF....WEBP
];

/**
 * Verify that the uploaded buffer actually matches a supported image format
 * by checking its magic bytes, not just the MIME type the client declared.
 */
export const verifyImageBuffer = (buffer: Buffer, declaredMime: string): boolean => {
  if (!buffer || buffer.length < 8) return false;

  for (const sig of MAGIC_BYTES) {
    const match = sig.header.every((byte, i) => buffer[i] === byte);
    if (match) {
      // Extra check for WebP: bytes 8-11 must be 'WEBP'
      if (sig.mime === 'image/webp') {
        const riffTag = buffer.slice(8, 12).toString('ascii');
        if (riffTag !== 'WEBP') continue;
      }
      return sig.mime === declaredMime;
    }
  }
  return false;
};

