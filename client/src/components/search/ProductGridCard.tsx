import React, { useState } from 'react';
import { Package, CheckCircle2, XCircle, ShoppingCart, Loader2 } from 'lucide-react';
import { IndexedProduct } from '../../types';
import { useCart } from '../../context/CartContext';
import { useApp } from '../../context/AppContext';

interface ProductGridCardProps {
  product: IndexedProduct;
  onSelect?: (product: IndexedProduct) => void;
}

export const ProductGridCard: React.FC<ProductGridCardProps> = ({ product, onSelect }) => {
  const { addToCart } = useCart();
  const { isAuthenticated, openAuthModal } = useApp();
  const [isAdding, setIsAdding] = useState(false);

  const isOutOfStock = product.stock <= 0;
  const imageUrl = product.images?.[0];

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    try {
      setIsAdding(true);
      await addToCart(product.productId, 1);
    } catch (err) {
      console.error('Failed to add product to cart', err);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div
      onClick={() => onSelect?.(product)}
      className="group bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col cursor-pointer"
    >
      {/* Product Image / Placeholder */}
      <div className="relative aspect-square w-full bg-slate-100 flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              // Fallback to placeholder if image fails to load
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
            <Package className="w-12 h-12 stroke-[1.5] mb-1.5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
            <span className="text-[11px] font-medium text-slate-400">No Image</span>
          </div>
        )}

        {/* Stock Badge Overlay */}
        <div className="absolute top-2.5 right-2.5">
          {isOutOfStock ? (
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm backdrop-blur">
              <XCircle className="w-3 h-3 text-rose-500" />
              <span>Out of Stock</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm backdrop-blur">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span>In Stock</span>
            </span>
          )}
        </div>
      </div>

      {/* Product Details */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          {/* Brand & Category row */}
          <div className="flex items-center space-x-2 text-[11px] font-medium">
            {product.brand && (
              <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md font-semibold">
                {product.brand}
              </span>
            )}
            {product.categoryName && (
              <span className="text-slate-500 truncate">
                {product.categoryName}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-bold text-slate-900 text-sm line-clamp-2 group-hover:text-indigo-600 transition-colors">
            {product.name}
          </h3>

          {/* Description snippet */}
          {product.description && (
            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}
        </div>

        {/* Price and Action Footer */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block leading-tight">Price</span>
            <span className="text-base font-extrabold text-slate-900">
              ${Number(product.price).toFixed(2)}
            </span>
          </div>

          <button
            type="button"
            disabled={isOutOfStock || isAdding}
            onClick={handleAddToCart}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-40 disabled:hover:bg-indigo-600"
          >
            {isAdding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShoppingCart className="w-3.5 h-3.5" />
            )}
            <span>Add</span>
          </button>
        </div>
      </div>
    </div>
  );
};

