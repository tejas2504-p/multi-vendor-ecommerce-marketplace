import mongoose, { Types } from 'mongoose';
import { Product, IProductImage } from '../models/product.model';
import { ImageStorageService, UploadedImageMeta } from './image.service';
import { verifyImageBuffer, MAX_IMAGES_PER_PRODUCT } from '../middlewares/imageUpload.middleware';
import { AppError } from '../utils/apiError';
import { logger } from '../utils/logger';

export interface ProductImageWithUrl extends IProductImage {
  url: string;
}

/**
 * Upload one or more images for a product.
 * - Verifies ownership
 * - Validates magic bytes for each file
 * - Enforces per-product image limit
 * - Uploads all to S3
 * - Saves keys + metadata to MongoDB
 * - On MongoDB failure: deletes all newly-uploaded S3 objects (cleanup)
 */
export const uploadProductImages = async (
  productId: string,
  vendorUserId: string,
  userRole: string,
  files: Express.Multer.File[]
): Promise<IProductImage[]> => {
  if (!mongoose.isValidObjectId(productId)) {
    throw AppError.badRequest('Invalid product ID format');
  }
  if (!files || files.length === 0) {
    throw AppError.badRequest('At least one image file is required');
  }

  const product = await Product.findOne({ _id: productId, isDeleted: false });
  if (!product) {
    throw AppError.notFound('Product not found');
  }

  // Ownership check
  if (userRole !== 'admin' && product.vendorId.toString() !== vendorUserId) {
    throw AppError.forbidden('Access forbidden: You do not own this product');
  }

  // Image limit check
  const remaining = MAX_IMAGES_PER_PRODUCT - product.images.length;
  if (remaining <= 0) {
    throw AppError.badRequest(
      `Product already has the maximum of ${MAX_IMAGES_PER_PRODUCT} images. Delete existing images before adding new ones.`
    );
  }
  if (files.length > remaining) {
    throw AppError.badRequest(
      `You can only add ${remaining} more image(s). Product already has ${product.images.length} image(s).`
    );
  }

  // Validate each file's magic bytes
  for (const file of files) {
    if (!verifyImageBuffer(file.buffer, file.mimetype)) {
      throw AppError.badRequest(
        `File "${file.originalname}" content does not match its declared type (${file.mimetype}). Ensure it is a valid JPEG, PNG or WebP image.`
      );
    }
  }

  // Upload all files to S3
  const uploadResults: UploadedImageMeta[] = [];
  const uploadErrors: string[] = [];

  for (const file of files) {
    try {
      const meta = await ImageStorageService.uploadImageToS3(
        file.buffer,
        file.mimetype,
        file.originalname,
        vendorUserId,
        productId
      );
      uploadResults.push(meta);
    } catch (err: any) {
      uploadErrors.push(file.originalname);
      logger.error(`Failed to upload ${file.originalname}: ${err.message}`);
    }
  }

  if (uploadResults.length === 0) {
    throw AppError.internal('All image uploads failed. Please try again.');
  }

  if (uploadErrors.length > 0) {
    logger.warn(`Partial upload failure: ${uploadErrors.join(', ')}`);
  }

  // Build image subdocuments
  const newImages: IProductImage[] = uploadResults.map((meta) => ({
    _id: new Types.ObjectId(),
    key: meta.key,
    originalName: meta.originalName,
    mimeType: meta.mimeType,
    sizeBytes: meta.sizeBytes,
    uploadedAt: new Date(meta.uploadedAt),
  }));

  // Save to MongoDB — cleanup S3 on failure
  try {
    product.images.push(...newImages);
    await product.save();
  } catch (dbError: any) {
    logger.error(`MongoDB save failed after S3 upload. Rolling back S3 objects.`);
    await ImageStorageService.deleteImagesFromS3(uploadResults.map((r) => r.key));
    throw AppError.internal('Failed to save image references. Uploaded files have been cleaned up.');
  }

  return newImages;
};

/**
 * Replace a single product image.
 * - Uploads new image to S3 first
 * - Updates MongoDB reference
 * - Deletes old S3 object on success
 * - Rolls back new S3 object if MongoDB fails
 */
export const replaceProductImage = async (
  productId: string,
  imageId: string,
  vendorUserId: string,
  userRole: string,
  file: Express.Multer.File
): Promise<IProductImage> => {
  if (!mongoose.isValidObjectId(productId)) throw AppError.badRequest('Invalid product ID');
  if (!mongoose.isValidObjectId(imageId)) throw AppError.badRequest('Invalid image ID');

  const product = await Product.findOne({ _id: productId, isDeleted: false });
  if (!product) throw AppError.notFound('Product not found');

  if (userRole !== 'admin' && product.vendorId.toString() !== vendorUserId) {
    throw AppError.forbidden('Access forbidden: You do not own this product');
  }

  // Validate magic bytes
  if (!verifyImageBuffer(file.buffer, file.mimetype)) {
    throw AppError.badRequest(
      `File "${file.originalname}" content does not match its declared type. Ensure it is a valid JPEG, PNG or WebP image.`
    );
  }

  const existingImage = product.images.find((img) => img._id.toString() === imageId);
  if (!existingImage) {
    throw AppError.notFound('Image not found on this product');
  }

  // Upload new image to S3 first
  const newMeta = await ImageStorageService.uploadImageToS3(
    file.buffer,
    file.mimetype,
    file.originalname,
    vendorUserId,
    productId
  );

  const newImageDoc: IProductImage = {
    _id: new Types.ObjectId(),
    key: newMeta.key,
    originalName: newMeta.originalName,
    mimeType: newMeta.mimeType,
    sizeBytes: newMeta.sizeBytes,
    uploadedAt: new Date(newMeta.uploadedAt),
  };

  const oldKey = existingImage.key;

  // Update MongoDB
  try {
    product.images = product.images.map((img) =>
      img._id.toString() === imageId ? newImageDoc : img
    );
    await product.save();
  } catch (dbError: any) {
    // Rollback: delete the newly uploaded S3 object
    await ImageStorageService.deleteImageFromS3(newMeta.key).catch(() => {});
    throw AppError.internal('Failed to update image reference. New upload has been cleaned up.');
  }

  // Delete old S3 object after successful DB update
  await ImageStorageService.deleteImageFromS3(oldKey).catch((err) => {
    logger.warn(`Failed to delete old S3 object ${oldKey}: ${err.message}`);
  });

  return newImageDoc;
};

/**
 * Delete a single product image.
 * - Verifies ownership and image membership
 * - Removes the MongoDB reference
 * - Deletes the S3 object (best-effort after DB success)
 */
export const deleteProductImage = async (
  productId: string,
  imageId: string,
  vendorUserId: string,
  userRole: string
): Promise<void> => {
  if (!mongoose.isValidObjectId(productId)) throw AppError.badRequest('Invalid product ID');
  if (!mongoose.isValidObjectId(imageId)) throw AppError.badRequest('Invalid image ID');

  const product = await Product.findOne({ _id: productId, isDeleted: false });
  if (!product) throw AppError.notFound('Product not found');

  if (userRole !== 'admin' && product.vendorId.toString() !== vendorUserId) {
    throw AppError.forbidden('Access forbidden: You do not own this product');
  }

  const image = product.images.find((img) => img._id.toString() === imageId);
  if (!image) {
    throw AppError.notFound('Image not found on this product');
  }

  const keyToDelete = image.key;

  // Remove from MongoDB first
  product.images = product.images.filter((img) => img._id.toString() !== imageId);
  await product.save();

  // Delete from S3 (best-effort — log but don't throw if S3 deletion fails)
  await ImageStorageService.deleteImageFromS3(keyToDelete).catch((err) => {
    logger.warn(`S3 cleanup partial failure for ${keyToDelete}: ${err.message}`);
  });
};

/**
 * Get product images with freshly generated presigned URLs.
 * Presigned URLs expire in 1 hour and are NEVER stored in MongoDB.
 */
export const getProductImagesWithUrls = async (
  productId: string,
  expiresInSeconds: number = 3600
): Promise<ProductImageWithUrl[]> => {
  if (!mongoose.isValidObjectId(productId)) throw AppError.badRequest('Invalid product ID');

  const product = await Product.findOne({ _id: productId, isDeleted: false });
  if (!product) throw AppError.notFound('Product not found');

  const keys = product.images.map((img) => img.key);
  const urls = await ImageStorageService.generatePresignedGetUrls(keys, expiresInSeconds);

  return product.images.map((img, i) => ({
    _id: img._id,
    key: img.key,
    originalName: img.originalName,
    mimeType: img.mimeType,
    sizeBytes: img.sizeBytes,
    uploadedAt: img.uploadedAt,
    url: urls[i],
  })) as ProductImageWithUrl[];
};
