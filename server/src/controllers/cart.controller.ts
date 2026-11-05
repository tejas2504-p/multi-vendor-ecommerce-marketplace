import { Request, Response, NextFunction } from 'express';
import { CartService } from '../services/cart.service';
import { ApiResponse } from '../utils/apiResponse';

export class CartController {
  /**
   * POST /api/cart/add
   * Add a product to the cart or increment quantity if already present.
   */
  static add = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await CartService.addToCart(req.user!.id, req.body);
      ApiResponse.success(res, result, 'Product added to cart successfully', 200);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/cart
   * Retrieve the authenticated customer's cart with current prices & subtotal.
   */
  static get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await CartService.getCart(req.user!.id);
      ApiResponse.success(res, result, 'Cart retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/cart/update/:productId
   * Update the quantity of a specific cart item.
   */
  static update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await CartService.updateQuantity(
        req.user!.id,
        req.params.productId,
        req.body.quantity
      );
      ApiResponse.success(res, result, 'Cart updated successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/cart/remove/:productId
   * Remove a single product from the cart.
   */
  static remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await CartService.removeItem(req.user!.id, req.params.productId);
      ApiResponse.success(res, result, 'Product removed from cart successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/cart/clear
   * Clear all items from the customer's cart.
   */
  static clear = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await CartService.clearCart(req.user!.id);
      ApiResponse.success(res, result, 'Cart cleared successfully');
    } catch (error) {
      next(error);
    }
  };
}

