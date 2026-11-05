/**
 * ProductImageUploader.tsx
 *
 * Reusable vendor-facing component for uploading, previewing, and managing
 * product images. All file uploads are sent to the backend via multipart/form-data —
 * AWS credentials never touch the browser.
 *
 * Features:
 *  - Multiple image selection (up to 5)
 *  - Instant local preview before upload
 *  - Upload progress bar
 *  - Client-side validation (type, size, count)
 *  - Remove selected images before upload
 *  - Display and delete uploaded product images
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  uploadProductImages,
  deleteProductImage,
  ProductImage,
} from '../../services/productImage.api';

interface ProductImageUploaderProps {
  productId: string;
  initialImages?: ProductImage[];
  onImagesChange?: (images: ProductImage[]) => void;
  maxImages?: number;
}

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface LocalPreview {
  file: File;
  previewUrl: string;
  error?: string;
}

export const ProductImageUploader: React.FC<ProductImageUploaderProps> = ({
  productId,
  initialImages = [],
  onImagesChange,
  maxImages = 5,
}) => {
  const [uploadedImages, setUploadedImages] = useState<ProductImage[]>(initialImages);
  const [pendingPreviews, setPendingPreviews] = useState<LocalPreview[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remaining = maxImages - uploadedImages.length;

  const validateFile = (file: File): string | undefined => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `"${file.name}" is not a supported image type. Use JPEG, PNG or WebP.`;
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `"${file.name}" exceeds the ${MAX_SIZE_MB} MB size limit.`;
    }
    if (file.size === 0) {
      return `"${file.name}" is empty.`;
    }
    return undefined;
  };

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (fileInputRef.current) fileInputRef.current.value = '';

      const totalWouldBe = uploadedImages.length + pendingPreviews.length + files.length;
      if (totalWouldBe > maxImages) {
        setGlobalError(
          `You can only have ${maxImages} images per product. You have ${uploadedImages.length + pendingPreviews.length} already selected.`
        );
        return;
      }

      setGlobalError(null);
      const previews: LocalPreview[] = files.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        error: validateFile(file),
      }));
      setPendingPreviews((prev) => [...prev, ...previews]);
    },
    [uploadedImages.length, pendingPreviews.length, maxImages]
  );

  const removePending = useCallback((index: number) => {
    setPendingPreviews((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleUpload = async () => {
    const validPreviews = pendingPreviews.filter((p) => !p.error);
    if (validPreviews.length === 0) {
      setGlobalError('No valid images selected to upload.');
      return;
    }

    setIsUploading(true);
    setGlobalError(null);
    setUploadProgress(0);

    try {
      const result = await uploadProductImages(
        productId,
        validPreviews.map((p) => p.file),
        setUploadProgress
      );
      const newImages = [...uploadedImages, ...result.images];
      setUploadedImages(newImages);
      onImagesChange?.(newImages);

      // Clean up object URLs
      validPreviews.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPendingPreviews((prev) => prev.filter((p) => !!p.error)); // keep invalid ones visible
    } catch (err: any) {
      setGlobalError(
        err?.response?.data?.error?.message ?? 'Upload failed. Please try again.'
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (image: ProductImage) => {
    try {
      await deleteProductImage(productId, image._id);
      const updated = uploadedImages.filter((img) => img._id !== image._id);
      setUploadedImages(updated);
      onImagesChange?.(updated);
    } catch (err: any) {
      setGlobalError(
        err?.response?.data?.error?.message ?? 'Failed to delete image. Please try again.'
      );
    }
  };

  const hasInvalidPreviews = pendingPreviews.some((p) => !!p.error);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Product Images ({uploadedImages.length}/{maxImages})
        </h3>
        {remaining > 0 && (
          <span className="text-xs text-gray-500">
            {remaining} slot{remaining !== 1 ? 's' : ''} available
          </span>
        )}
      </div>

      {/* Global Error */}
      {globalError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {globalError}
        </div>
      )}

      {/* Uploaded Images Grid */}
      {uploadedImages.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {uploadedImages.map((img) => (
            <div key={img._id} className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-square">
              {img.url ? (
                <img
                  src={img.url}
                  alt={img.originalName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-xs text-gray-500 p-2 text-center">
                  {img.originalName}
                </div>
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                <button
                  onClick={() => handleDelete(img)}
                  className="hidden group-hover:flex items-center justify-center w-8 h-8 rounded-full bg-red-600 text-white text-xs font-bold shadow-md"
                  title="Delete image"
                >
                  ✕
                </button>
              </div>
              {/* Info tooltip */}
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                {(img.sizeBytes / 1024).toFixed(0)} KB
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending Previews */}
      {pendingPreviews.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Selected (not yet uploaded):</p>
          <div className="grid grid-cols-3 gap-3">
            {pendingPreviews.map((preview, i) => (
              <div
                key={i}
                className={`relative rounded-lg overflow-hidden border aspect-square ${
                  preview.error ? 'border-red-400' : 'border-blue-300'
                }`}
              >
                <img
                  src={preview.previewUrl}
                  alt={preview.file.name}
                  className={`w-full h-full object-cover ${preview.error ? 'opacity-40' : ''}`}
                />
                {/* Error badge */}
                {preview.error && (
                  <div className="absolute inset-0 flex items-end">
                    <div className="bg-red-600 text-white text-xs p-1 w-full text-center leading-tight">
                      {preview.error}
                    </div>
                  </div>
                )}
                {/* Remove button */}
                <button
                  onClick={() => removePending(i)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-gray-800 bg-opacity-70 text-white text-xs flex items-center justify-center"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-600">
            <span>Uploading…</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {remaining > 0 && (
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              📁 Choose Images
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              disabled={isUploading}
            />
          </label>
        )}

        {pendingPreviews.length > 0 && !isUploading && (
          <button
            onClick={handleUpload}
            disabled={hasInvalidPreviews && pendingPreviews.every((p) => !!p.error)}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ☁️ Upload {pendingPreviews.filter((p) => !p.error).length} Image(s)
          </button>
        )}

        {pendingPreviews.length > 0 && !isUploading && (
          <button
            onClick={() => {
              pendingPreviews.forEach((p) => URL.revokeObjectURL(p.previewUrl));
              setPendingPreviews([]);
            }}
            className="inline-flex items-center px-3 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Validation Info */}
      <p className="text-xs text-gray-400">
        Accepted: JPEG, PNG, WebP • Max size: {MAX_SIZE_MB} MB per image • Max {maxImages} images per product
      </p>
    </div>
  );
};

export default ProductImageUploader;

