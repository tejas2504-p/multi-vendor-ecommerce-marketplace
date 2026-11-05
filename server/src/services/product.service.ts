import mongoose, { Types } from 'mongoose';
import { Product, IProduct, ProductStatus } from '../models/product.model';
import { Category } from '../models/category.model';
import { ProductIndexingService } from './productIndexing.service';
import {
  CreateProductInput,
  UpdateProductInput,
  UpdateInventoryInput,
  ProductQueryInput,
} from '../validators/product.validator';
import { AppError } from '../utils/apiError';

const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface ProductListResult {
  products: IProduct[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ProductService {
  /**
   * Helper to generate a unique SKU if not supplied by the vendor.
   */
  private static generateUniqueSku(brand?: string): string {
    const prefix = (brand || 'PRD')
      .replace(/[^A-Za-z0-9]/g, '')
      .substring(0, 4)
      .toUpperCase() || 'SKU';
    const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Create a new product.
   * Only approved vendors can call this. vendorId is assigned from authenticated user.
   */
  static async createProduct(
    vendorUserId: string,
    input: CreateProductInput
  ): Promise<IProduct> {
    // 1. Verify category exists and is active
    const category = await Category.findById(input.categoryId);
    if (!category || !category.isActive) {
      throw AppError.badRequest('Selected category does not exist or is currently inactive');
    }

    // 2. Resolve SKU & verify uniqueness
    let sku = input.sku?.trim().toUpperCase();
    if (sku) {
      const existingSku = await Product.findOne({ sku });
      if (existingSku) {
        throw AppError.conflict(`A product with SKU '${sku}' already exists. Please choose a unique SKU.`);
      }
    } else {
      sku = this.generateUniqueSku(input.brand);
      // Ensure generated SKU does not collide
      let attempts = 0;
      while (await Product.findOne({ sku })) {
        sku = this.generateUniqueSku(input.brand);
        attempts++;
        if (attempts > 5) break;
      }
    }

    // 3. Create product document
    const product = await Product.create({
      name: input.name,
      description: input.description,
      price: input.price,
      categoryId: new Types.ObjectId(input.categoryId),
      vendorId: new Types.ObjectId(vendorUserId),
      stock: input.stock,
      images: [], // images are managed via POST /api/products/:id/images
      brand: input.brand || '',
      sku,
      status: input.status || 'active',
      isDeleted: false,
    });

    const populated = await Product.findById(product._id)
      .populate('categoryId', 'name slug')
      .populate('vendorId', 'name email');

    // Synchronize to Elasticsearch search engine
    await ProductIndexingService.syncProduct(populated);

    return populated!;
  }

  /**
   * Public catalog listing (Active, non-deleted products only).
   * Supports filtering by category, price range, keyword search, pagination, and sorting.
   */
  static async listPublicProducts(query: ProductQueryInput): Promise<ProductListResult> {
    const filter: Record<string, any> = {
      status: 'active',
      isDeleted: false,
    };

    if (query.categoryId) {
      if (mongoose.isValidObjectId(query.categoryId)) {
        filter.categoryId = new Types.ObjectId(query.categoryId);
      }
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      filter.price = {};
      if (query.minPrice !== undefined) filter.price.$gte = query.minPrice;
      if (query.maxPrice !== undefined) filter.price.$lte = query.maxPrice;
    }

    if (query.search) {
      const searchRegex = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ name: searchRegex }, { brand: searchRegex }, { description: searchRegex }];
    }

    const page = query.page || 1;
    const limit = query.limit || 12;
    const skip = (page - 1) * limit;
    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('categoryId', 'name slug')
        .populate('vendorId', 'name email')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    return {
      products,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieve single product by ID.
   * Public can view active products. Owner and admin can also view draft/inactive products.
   */
  static async getProductById(
    id: string,
    currentUserId?: string,
    currentUserRole?: string
  ): Promise<IProduct> {
    if (!mongoose.isValidObjectId(id)) {
      throw AppError.badRequest('Invalid product ID format');
    }

    const product = await Product.findOne({ _id: id, isDeleted: false })
      .populate('categoryId', 'name slug')
      .populate('vendorId', 'name email');

    if (!product) {
      throw AppError.notFound('Product not found');
    }

    // Non-active products restricted to owner and admin
    if (product.status !== 'active') {
      const isOwner = currentUserId && product.vendorId._id.toString() === currentUserId;
      const isAdmin = currentUserRole === 'admin';
      if (!isOwner && !isAdmin) {
        throw AppError.notFound('Product not found or is currently unavailable');
      }
    }

    return product;
  }

  /**
   * List products belonging to a specific authenticated vendor.
   */
  static async listVendorProducts(
    vendorUserId: string,
    query: ProductQueryInput
  ): Promise<ProductListResult> {
    const filter: Record<string, any> = {
      vendorId: new Types.ObjectId(vendorUserId),
      isDeleted: false,
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.categoryId && mongoose.isValidObjectId(query.categoryId)) {
      filter.categoryId = new Types.ObjectId(query.categoryId);
    }

    if (query.search) {
      const searchRegex = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ name: searchRegex }, { brand: searchRegex }, { sku: searchRegex }];
    }

    const page = query.page || 1;
    const limit = query.limit || 12;
    const skip = (page - 1) * limit;
    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('categoryId', 'name slug')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    return {
      products,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Update a product.
   * Only product owner or admin can update. vendorId cannot be changed.
   */
  static async updateProduct(
    id: string,
    currentUserId: string,
    currentUserRole: string,
    input: UpdateProductInput
  ): Promise<IProduct> {
    if (!mongoose.isValidObjectId(id)) {
      throw AppError.badRequest('Invalid product ID format');
    }

    const product = await Product.findOne({ _id: id, isDeleted: false });
    if (!product) {
      throw AppError.notFound('Product not found');
    }

    // Ownership check
    if (currentUserRole !== 'admin' && product.vendorId.toString() !== currentUserId) {
      throw AppError.forbidden('Access forbidden: You do not have permission to update this product');
    }

    // Verify category if updating
    if (input.categoryId) {
      const category = await Category.findById(input.categoryId);
      if (!category || !category.isActive) {
        throw AppError.badRequest('Selected category does not exist or is currently inactive');
      }
      product.categoryId = new Types.ObjectId(input.categoryId);
    }

    // Verify SKU uniqueness if changing SKU
    if (input.sku && input.sku.toUpperCase() !== product.sku) {
      const skuTaken = await Product.findOne({
        sku: input.sku.toUpperCase(),
        _id: { $ne: product._id },
      });
      if (skuTaken) {
        throw AppError.conflict(`Product SKU '${input.sku}' is already taken.`);
      }
      product.sku = input.sku.toUpperCase();
    }

    if (input.name !== undefined) product.name = input.name;
    if (input.description !== undefined) product.description = input.description;
    if (input.price !== undefined) product.price = input.price;
    if (input.stock !== undefined) product.stock = input.stock;
    // images are managed via dedicated image upload endpoints (Phase 4B)
    if (input.brand !== undefined) product.brand = input.brand;
    if (input.status !== undefined) product.status = input.status;

    await product.save();

    const populated = await Product.findById(product._id)
      .populate('categoryId', 'name slug')
      .populate('vendorId', 'name email');

    // Synchronize to Elasticsearch search engine
    await ProductIndexingService.syncProduct(populated);

    return populated!;
  }

  /**
   * Soft-delete a product.
   * Only product owner or admin can delete. Sets isDeleted: true and status: 'inactive'.
   */
  static async deleteProduct(
    id: string,
    currentUserId: string,
    currentUserRole: string
  ): Promise<void> {
    if (!mongoose.isValidObjectId(id)) {
      throw AppError.badRequest('Invalid product ID format');
    }

    const product = await Product.findOne({ _id: id, isDeleted: false });
    if (!product) {
      throw AppError.notFound('Product not found');
    }

    // Ownership check
    if (currentUserRole !== 'admin' && product.vendorId.toString() !== currentUserId) {
      throw AppError.forbidden('Access forbidden: You do not have permission to delete this product');
    }

    product.isDeleted = true;
    product.status = 'inactive';
    await product.save();

    // Synchronize to Elasticsearch search engine (removes deleted product)
    await ProductIndexingService.syncProduct(product);
  }

  /**
   * Atomic Inventory Stock Update.
   * Supports absolute 'set' or delta 'adjust' with zero race condition protection.
   * Only product owner or admin can update inventory.
   */
  static async updateInventory(
    id: string,
    currentUserId: string,
    currentUserRole: string,
    input: UpdateInventoryInput
  ): Promise<IProduct> {
    if (!mongoose.isValidObjectId(id)) {
      throw AppError.badRequest('Invalid product ID format');
    }

    const product = await Product.findOne({ _id: id, isDeleted: false });
    if (!product) {
      throw AppError.notFound('Product not found');
    }

    // Ownership check
    if (currentUserRole !== 'admin' && product.vendorId.toString() !== currentUserId) {
      throw AppError.forbidden('Access forbidden: Only the product owner or admin can update inventory');
    }

    const mode = input.mode || 'set';

    if (mode === 'set') {
      if (input.stock === undefined || input.stock < 0) {
        throw AppError.badRequest('Stock count must be a non-negative integer');
      }

      const updated = await Product.findOneAndUpdate(
        { _id: id, isDeleted: false },
        { $set: { stock: input.stock } },
        { new: true }
      ).populate('categoryId', 'name slug');

      await ProductIndexingService.syncProduct(updated);
      return updated!;
    } else {
      // mode: 'adjust'
      const delta = input.quantity ?? 0;

      if (delta < 0) {
        const decrementAbs = Math.abs(delta);
        // Atomic decrement with condition stock >= decrementAbs
        const updated = await Product.findOneAndUpdate(
          { _id: id, isDeleted: false, stock: { $gte: decrementAbs } },
          { $inc: { stock: delta } },
          { new: true }
        ).populate('categoryId', 'name slug');

        if (!updated) {
          throw AppError.badRequest('Insufficient inventory. Stock cannot become negative.');
        }

        await ProductIndexingService.syncProduct(updated);
        return updated;
      } else {
        // Atomic increment
        const updated = await Product.findOneAndUpdate(
          { _id: id, isDeleted: false },
          { $inc: { stock: delta } },
          { new: true }
        ).populate('categoryId', 'name slug');

        await ProductIndexingService.syncProduct(updated);
        return updated!;
      }
    }
  }

  /**
   * Admin: List all marketplace products across all merchants.
   */
  static async adminListProducts(query: ProductQueryInput): Promise<ProductListResult> {
    const filter: Record<string, any> = {
      isDeleted: false,
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.categoryId && mongoose.isValidObjectId(query.categoryId)) {
      filter.categoryId = new Types.ObjectId(query.categoryId);
    }

    if (query.search) {
      const searchRegex = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ name: searchRegex }, { brand: searchRegex }, { sku: searchRegex }];
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('categoryId', 'name slug')
        .populate('vendorId', 'name email')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    return {
      products,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Admin: Update product status (active, inactive, draft).
   */
  static async adminUpdateProductStatus(id: string, status: ProductStatus): Promise<IProduct> {
    if (!mongoose.isValidObjectId(id)) {
      throw AppError.badRequest('Invalid product ID format');
    }

    const product = await Product.findOne({ _id: id, isDeleted: false });
    if (!product) {
      throw AppError.notFound('Product not found');
    }

    product.status = status;
    await product.save();

    const populated = await Product.findById(product._id)
      .populate('categoryId', 'name slug')
      .populate('vendorId', 'name email');

    // Synchronize to Elasticsearch search engine
    await ProductIndexingService.syncProduct(populated);

    return populated!;
  }
}

