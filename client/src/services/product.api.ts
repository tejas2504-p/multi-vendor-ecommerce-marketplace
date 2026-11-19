import { apiClient } from './api';
import { ApiResponse } from '../types';

export interface ProductItem {
  id: string;
  name: string;
  slug?: string;
  description: string;
  price: number;
  stock: number;
  categoryId: string | { id: string; name: string };
  categoryName?: string;
  images: string[];
  brand?: string;
  sku?: string;
  status: 'draft' | 'active' | 'inactive';
  vendorId?: string;
  ratingAverage?: number;
  ratingCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface CreateProductDto {
  name: string;
  description: string;
  price: number;
  categoryId: string;
  stock: number;
  images?: string[];
  brand?: string;
  sku?: string;
  status?: 'draft' | 'active' | 'inactive';
}

export interface UpdateProductDto {
  name?: string;
  description?: string;
  price?: number;
  categoryId?: string;
  stock?: number;
  images?: string[];
  brand?: string;
  sku?: string;
  status?: 'draft' | 'active' | 'inactive';
}

export const productApi = {
  /**
   * Get products belonging to authenticated vendor
   */
  async getVendorProducts(params?: Record<string, any>): Promise<{ products: ProductItem[]; meta?: any }> {
    const res = await apiClient.get<ApiResponse<ProductItem[]>>('/api/vendor/products', { params });
    return {
      products: res.data.data || [],
      meta: (res.data as any).meta,
    };
  },

  /**
   * Create a new product (Approved Vendor only)
   */
  async createProduct(dto: CreateProductDto): Promise<ProductItem> {
    const res = await apiClient.post<ApiResponse<ProductItem>>('/api/products', dto);
    return res.data.data;
  },

  /**
   * Update an existing product
   */
  async updateProduct(id: string, dto: UpdateProductDto): Promise<ProductItem> {
    const res = await apiClient.patch<ApiResponse<ProductItem>>(`/api/products/${id}`, dto);
    return res.data.data;
  },

  /**
   * Delete / Soft-delete a product
   */
  async deleteProduct(id: string): Promise<void> {
    await apiClient.delete(`/api/products/${id}`);
  },

  /**
   * Update product inventory stock directly
   */
  async updateInventory(id: string, stock: number): Promise<ProductItem> {
    const res = await apiClient.patch<ApiResponse<ProductItem>>(`/api/products/${id}/inventory`, { stock });
    return res.data.data;
  },

  /**
   * List all categories for dropdown selection
   */
  async getCategories(): Promise<CategoryItem[]> {
    const res = await apiClient.get<ApiResponse<CategoryItem[]>>('/api/categories');
    return res.data.data || [];
  },
};
