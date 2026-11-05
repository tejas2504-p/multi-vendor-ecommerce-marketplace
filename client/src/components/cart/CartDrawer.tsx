import React from 'react';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useApp } from '../../context/AppContext';

export const CartDrawer: React.FC = () => {
  const { cart, isCartOpen, closeCart, isLoading, updateQuantity, removeItem, clearCart, openCheckout } = useCart();
  const { isAuthenticated, openAuthModal } = useApp();

  if (!isCartOpen) return null;

  const handleCheckoutClick = () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    openCheckout();
  };

  const subtotal = cart?.subtotal || 0;
  const shipping = subtotal >= 100 ? 0 : subtotal > 0 ? 10 : 0;
  const total = subtotal + shipping;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Your Shopping Cart</h2>
              <p className="text-xs text-slate-500">
                {cart?.itemCount || 0} {cart?.itemCount === 1 ? 'item' : 'items'}
              </p>
            </div>
          </div>
          <button
            onClick={closeCart}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading && (!cart || cart.items.length === 0) ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <span className="text-xs">Updating cart...</span>
            </div>
          ) : !cart || cart.items.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Your cart is empty</h3>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Explore our verified marketplace products and add items to your cart.
                </p>
              </div>
              <button
                onClick={closeCart}
                className="mt-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
              >
                Start Shopping
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs pb-1">
                <span className="font-semibold text-slate-500">Cart Items</span>
                <button
                  onClick={clearCart}
                  className="text-rose-600 hover:text-rose-700 font-medium hover:underline text-[11px]"
                >
                  Clear All
                </button>
              </div>

              {cart.items.map((item) => (
                <div
                  key={item.id || item.productId}
                  className="rounded-2xl border border-slate-200 p-3.5 flex items-start space-x-3 bg-white hover:border-slate-300 transition"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-100 flex items-center justify-center shrink-0 overflow-hidden text-slate-400">
                    <ShoppingBag className="w-7 h-7" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {item.brand ? `${item.brand} • ` : ''}SKU: {item.sku}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-black text-slate-900">
                        ${item.unitPrice.toFixed(2)}
                      </span>

                      {/* Quantity controls */}
                      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                        <button
                          onClick={() => {
                            if (item.quantity > 1) {
                              updateQuantity(item.productId, item.quantity - 1);
                            } else {
                              removeItem(item.productId);
                            }
                          }}
                          className="p-1 hover:bg-slate-200 text-slate-600 transition"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 text-xs font-bold text-slate-800">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          disabled={item.quantity >= item.stock}
                          className="p-1 hover:bg-slate-200 text-slate-600 transition disabled:opacity-30"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(item.productId)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drawer Footer with Cost Breakdown & Checkout */}
        {cart && cart.items.length > 0 && (
          <div className="border-t border-slate-100 p-6 bg-slate-50/50 space-y-4">
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Shipping</span>
                <span className="font-semibold text-slate-900">
                  {shipping === 0 ? (
                    <span className="text-emerald-600 font-bold">FREE</span>
                  ) : (
                    `$${shipping.toFixed(2)}`
                  )}
                </span>
              </div>
              {subtotal < 100 && (
                <div className="text-[11px] text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                  Add ${(100 - subtotal).toFixed(2)} more for <strong>FREE Shipping</strong>
                </div>
              )}
              <div className="flex items-center justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                <span>Estimated Total</span>
                <span className="text-base text-indigo-600">${total.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleCheckoutClick}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-indigo-500/25 flex items-center justify-center space-x-2 transition"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="flex items-center justify-center space-x-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Safe & Secure Multi-Vendor Checkout</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

