import React, { useState } from 'react';
import {
  X,
  Package,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  Loader2,
  Store,
} from 'lucide-react';
import { IndexedProduct } from '../../types';
import { useCart } from '../../context/CartContext';
import { useApp } from '../../context/AppContext';
import { ProductReviewsSection } from './ProductReviewsSection';

interface ProductDetailModalProps {
  product: IndexedProduct | null;
  onClose: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
}) => {
  const { addToCart } = useCart();
  const { isAuthenticated, openAuthModal } = useApp();
  const [isAdding, setIsAdding] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  if (!product) return null;

  const isOutOfStock = product.stock <= 0;
  const images = product.images && product.images.length > 0 ? product.images : [];
  const currentImage = images[selectedImageIndex];

  const handleAddToCart = async () => {
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto">
        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Product Overview
            </span>
            {product.brand && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                {product.brand}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-8 flex-1">
          {/* Top Product Presentation Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Gallery Section */}
            <div className="space-y-3">
              <div className="relative aspect-square w-full rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                {currentImage ? (
                  <img
                    src={currentImage}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <Package className="w-16 h-16 stroke-[1.5] text-slate-300" />
                    <span className="text-xs font-medium mt-1">No Image Available</span>
                  </div>
                )}

                <div className="absolute top-3 right-3">
                  {isOutOfStock ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm backdrop-blur">
                      <XCircle className="w-3.5 h-3.5 text-rose-500" />
                      <span>Out of Stock</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm backdrop-blur">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{product.stock} in Stock</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Thumbnails if multiple images exist */}
              {images.length > 1 && (
                <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`w-14 h-14 rounded-xl border-2 overflow-hidden flex-shrink-0 transition ${
                        selectedImageIndex === idx
                          ? 'border-indigo-600 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <img src={img} alt="thumb" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Metadata & Add to Cart */}
            <div className="flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-xs text-slate-500">
                  <span className="font-semibold text-indigo-600">
                    {product.categoryName || 'General'}
                  </span>
                  <span>•</span>
                  <span className="flex items-center space-x-1">
                    <Store className="w-3.5 h-3.5 text-slate-400" />
                    <span>Vendor ID: {product.vendorId.slice(-6)}</span>
                  </span>
                </div>

                <h2 className="text-xl font-extrabold text-slate-900 leading-snug">
                  {product.name}
                </h2>

                <div className="text-2xl font-black text-slate-900">
                  ${Number(product.price).toFixed(2)}
                </div>

                {product.description && (
                  <p className="text-sm text-slate-600 leading-relaxed pt-2 border-t border-slate-100 whitespace-pre-line">
                    {product.description}
                  </p>
                )}
              </div>

              {/* Action Bar */}
              <div className="pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isOutOfStock || isAdding}
                  onClick={handleAddToCart}
                  className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition disabled:opacity-40"
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Adding to Cart...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      <span>Add to Shopping Cart</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Integrated Product Reviews Section */}
          <ProductReviewsSection
            productId={product.productId}
            productName={product.name}
          />
        </div>
      </div>
    </div>
  );
};

