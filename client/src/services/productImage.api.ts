/**
 * productImage.api.ts
 *
 * API client for Phase 4B product image endpoints.
 * AWS credentials are NEVER included here — all S3 operations happen server-side.
 */
import { apiClient } from './api';

export interface ProductImage {
  _id: string;
  key: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  /** Short-lived presigned URL for display (not stored in DB, generated fresh by server) */
  url?: string;
}

export interface ImageUploadResponse {
  images: ProductImage[];
}

/** Upload multiple images to a product (multipart/form-data) */
export const uploadProductImages = async (
  productId: string,
  files: File[],
  onProgress?: (percent: number) => void
): Promise<ImageUploadResponse> => {
  const form = new FormData();
  files.forEach((file) => form.append('images', file));

  const response = await apiClient.post<{ success: true; message: string; data: ImageUploadResponse }>(
    `/api/products/${productId}/images`,
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
        ? (evt) => {
            if (evt.total) {
              onProgress(Math.round((evt.loaded * 100) / evt.total));
            }
          }
        : undefined,
    }
  );
  return response.data.data;
};

/** Replace a single product image */
export const replaceProductImage = async (
  productId: string,
  imageId: string,
  file: File
): Promise<{ image: ProductImage }> => {
  const form = new FormData();
  form.append('image', file);

  const response = await apiClient.put<{ success: true; data: { image: ProductImage } }>(
    `/api/products/${productId}/images/${imageId}`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return response.data.data;
};

/** Delete a single product image */
export const deleteProductImage = async (
  productId: string,
  imageId: string
): Promise<void> => {
  await apiClient.delete(`/api/products/${productId}/images/${imageId}`);
};

/** Fetch product images with fresh presigned URLs */
export const getProductImages = async (
  productId: string
): Promise<ProductImage[]> => {
  const response = await apiClient.get<{ success: true; data: { images: ProductImage[] } }>(
    `/api/products/${productId}/images`
  );
  return response.data.data.images;
};

