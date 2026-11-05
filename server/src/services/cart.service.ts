import mongoose, { Types } from 'mongoose';
import { Cart, ICart } from '../models/cart.model';
import { Product } from '../models/product.model';
import { VendorProfile } from '../models/vendorProfile.model';
import { CartCacheService } from './cartCache.service';
import { AppError } from '../utils/apiError';
import { AddToCartInput } from '../validators/cart.validator';

export interface FormattedCartItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  brand?: string;
  images: Array<{
    id?: string;
    key: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  }>;
  unitPrice: number;
  quantity: number;
  itemTotal: number;
  stock: number;
  isAvailable: boolean;
  availabilityMessage?: string;
}

export interface CartResponse {
  id: string;
  userId: string;
  items: FormattedCartItem[];
  itemCount: number;
  uniqueItemCount: number;
  subtotal: number;
  total: number;
  createdAt: Date;
  updatedAt: Date;
}

export class CartService {
  /**
   * Helper to retrieve or lazily create a customer's cart.
   * Enforces 1-to-1 customer-to-cart isolation.
   */
  static async getOrCreateCart(userId: string): Promise<ICart & { _id: Types.ObjectId }> {
    if (!mongoose.isValidObjectId(userId)) {
      throw AppError.badRequest('Invalid user ID format');
    }

    let cart = await Cart.findOne({ userId: new Types.ObjectId(userId) });
    if (!cart) {
      try {
        cart = await Cart.create({
          userId: new Types.ObjectId(userId),
          items: [],
        });
      } catch (err: any) {
        // Handle race condition on duplicate key gracefully
        if (err.code === 11000) {
          cart = await Cart.findOne({ userId: new Types.ObjectId(userId) });
        } else {
          throw err;
        }
      }
    }

    return cart as ICart & { _id: Types.ObjectId };
  }

  /**
   * Formats cart items by querying current Product data directly from MongoDB.
   * Product prices are NEVER permanently stored in the cart model;
   * instead, they are dynamically computed from live Product prices.
   */
  static async formatCartResponse(cart: ICart & { _id: Types.ObjectId }): Promise<CartResponse> {
    const formattedItems: FormattedCartItem[] = [];
    let subtotal = 0;
    let itemCount = 0;
    let cartModified = false;

    // Filter out completely deleted products from cart
    const validItems: typeof cart.items = [];

    for (const item of cart.items) {
      const product = await Product.findById(item.productId);

      if (!product || product.isDeleted) {
        // Product no longer exists in DB or is soft-deleted -> remove from cart
        cartModified = true;
        continue;
      }

      validItems.push(item);

      // Verify vendor status
      const vendorProfile = await VendorProfile.findOne({
        userId: product.vendorId,
        status: 'approved',
      });

      const isVendorActive = !!vendorProfile;
      const isProductActive = product.status === 'active';
      const hasSufficientStock = product.stock >= item.quantity;
      const isAvailable = isProductActive && isVendorActive && hasSufficientStock;

      let availabilityMessage: string | undefined;
      if (!isProductActive) {
        availabilityMessage = 'Product is currently inactive';
      } else if (!isVendorActive) {
        availabilityMessage = 'Vendor store is currently undergoing review';
      } else if (product.stock === 0) {
        availabilityMessage = 'Product is out of stock';
      } else if (!hasSufficientStock) {
        availabilityMessage = `Requested ${item.quantity} units, but only ${product.stock} available`;
      }

      const unitPrice = product.price;
      const itemTotal = Math.round(unitPrice * item.quantity * 100) / 100;

      // Only add to cart subtotal if product is available
      if (isAvailable) {
        subtotal += itemTotal;
        itemCount += item.quantity;
      }

      formattedItems.push({
        id: item._id ? item._id.toString() : item.productId.toString(),
        productId: product._id.toString(),
        name: product.name,
        sku: product.sku,
        brand: product.brand || '',
        images: product.images.map((img) => ({
          id: img._id ? img._id.toString() : undefined,
          key: img.key,
          originalName: img.originalName,
          mimeType: img.mimeType,
          sizeBytes: img.sizeBytes,
        })),
        unitPrice,
        quantity: item.quantity,
        itemTotal,
        stock: product.stock,
        isAvailable,
        availabilityMessage,
      });
    }

    // If deleted items were purged, save cart update in background
    if (cartModified) {
      cart.items = validItems;
      await Cart.updateOne({ _id: cart._id }, { items: validItems });
    }

    const roundedSubtotal = Math.round(subtotal * 100) / 100;

    return {
      id: cart._id.toString(),
      userId: cart.userId.toString(),
      items: formattedItems,
      itemCount,
      uniqueItemCount: formattedItems.length,
      subtotal: roundedSubtotal,
      total: roundedSubtotal,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }

  /**
   * POST /api/cart/add
   * Add a product to the cart. If existing, increments quantity.
   * Validates product existence, active status, approved vendor, and stock.
   */
  static async addToCart(userId: string, input: AddToCartInput): Promise<CartResponse> {
    if (!mongoose.isValidObjectId(input.productId)) {
      throw AppError.badRequest('Invalid product ID format');
    }

    const quantityToAdd = input.quantity ?? 1;
    if (quantityToAdd < 1) {
      throw AppError.badRequest('Quantity must be at least 1');
    }

    // 1. Fetch product
    const product = await Product.findById(input.productId);
    if (!product || product.isDeleted) {
      throw AppError.notFound('Product not found or has been removed');
    }

    // 2. Validate product availability
    if (product.status !== 'active') {
      throw AppError.badRequest('Product is currently inactive and cannot be added to cart');
    }

    // 3. Validate vendor approval
    const vendorProfile = await VendorProfile.findOne({
      userId: product.vendorId,
      status: 'approved',
    });
    if (!vendorProfile) {
      throw AppError.badRequest('Product vendor is currently inactive or not approved');
    }

    // 4. Validate stock
    if (product.stock <= 0) {
      throw AppError.badRequest('Product is currently out of stock');
    }

    // 5. Load or create cart
    const cart = await this.getOrCreateCart(userId);

    // 6. Check existing item in cart
    const existingIndex = cart.items.findIndex(
      (item) => item.productId.toString() === input.productId
    );

    const currentQtyInCart = existingIndex > -1 ? cart.items[existingIndex].quantity : 0;
    const targetQty = currentQtyInCart + quantityToAdd;

    if (targetQty > product.stock) {
      throw AppError.badRequest(
        `Cannot add ${quantityToAdd} more unit(s). Total in cart (${targetQty}) exceeds available stock (${product.stock}).`
      );
    }

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity = targetQty;
    } else {
      cart.items.push({
        productId: new Types.ObjectId(input.productId),
        quantity: quantityToAdd,
      });
    }

    await Cart.updateOne({ _id: cart._id }, { items: cart.items });
    const formatted = await this.formatCartResponse(cart);
    await CartCacheService.set(userId, formatted);
    return formatted;
  }

  /**
   * GET /api/cart
   * Retrieves the authenticated customer's cart with live calculated totals.
   * Checks Redis cache first; falls back to MongoDB on cache miss or cache failure.
   */
  static async getCart(userId: string): Promise<CartResponse> {
    const cached = await CartCacheService.get(userId);
    if (cached) {
      return cached;
    }

    const cart = await this.getOrCreateCart(userId);
    const formatted = await this.formatCartResponse(cart);
    await CartCacheService.set(userId, formatted);
    return formatted;
  }

  /**
   * PATCH /api/cart/update/:productId
   * Updates an existing cart item's quantity. Rejects quantities < 1 or exceeding stock.
   */
  static async updateQuantity(
    userId: string,
    productId: string,
    quantity: number
  ): Promise<CartResponse> {
    if (!mongoose.isValidObjectId(productId)) {
      throw AppError.badRequest('Invalid product ID format');
    }

    if (typeof quantity !== 'number' || quantity < 1 || !Number.isInteger(quantity)) {
      throw AppError.badRequest('Quantity must be an integer of at least 1');
    }

    const cart = await this.getOrCreateCart(userId);
    const itemIndex = cart.items.findIndex((item) => item.productId.toString() === productId);

    if (itemIndex === -1) {
      throw AppError.notFound('Product not found in your cart');
    }

    // Validate product stock and status
    const product = await Product.findById(productId);
    if (!product || product.isDeleted) {
      throw AppError.notFound('Product not found or has been removed');
    }

    if (product.status !== 'active') {
      throw AppError.badRequest('Product is currently inactive and cannot be purchased');
    }

    if (quantity > product.stock) {
      throw AppError.badRequest(
        `Requested quantity (${quantity}) exceeds available stock (${product.stock}).`
      );
    }

    cart.items[itemIndex].quantity = quantity;
    await Cart.updateOne({ _id: cart._id }, { items: cart.items });

    const formatted = await this.formatCartResponse(cart);
    await CartCacheService.set(userId, formatted);
    return formatted;
  }

  /**
   * DELETE /api/cart/remove/:productId
   * Removes a product item from the authenticated customer's cart.
   */
  static async removeItem(userId: string, productId: string): Promise<CartResponse> {
    if (!mongoose.isValidObjectId(productId)) {
      throw AppError.badRequest('Invalid product ID format');
    }

    const cart = await this.getOrCreateCart(userId);
    const itemIndex = cart.items.findIndex((item) => item.productId.toString() === productId);

    if (itemIndex === -1) {
      throw AppError.notFound('Product not found in your cart');
    }

    cart.items.splice(itemIndex, 1);
    await Cart.updateOne({ _id: cart._id }, { items: cart.items });

    const formatted = await this.formatCartResponse(cart);
    await CartCacheService.set(userId, formatted);
    return formatted;
  }

  /**
   * DELETE /api/cart/clear
   * Empties all items from the customer's cart.
   */
  static async clearCart(userId: string): Promise<CartResponse> {
    const cart = await this.getOrCreateCart(userId);
    cart.items = [];
    await Cart.updateOne({ _id: cart._id }, { items: [] });

    await CartCacheService.delete(userId);
    return this.formatCartResponse(cart);
  }
}

