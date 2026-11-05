import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  MapPin,
  Plus,
  ShoppingBag,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  PackageCheck,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { Address, Order } from '../../types';
import { addressApi } from '../../services/address.api';
import { checkoutApi } from '../../services/checkout.api';

export const CheckoutModal: React.FC = () => {
  const { cart, isCheckoutOpen, closeCheckout, refreshCart, openAddressModal } = useCart();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [isLoadingAddresses, setIsLoadingAddresses] = useState<boolean>(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  const loadAddresses = useCallback(async () => {
    try {
      setIsLoadingAddresses(true);
      setError(null);
      const data = await addressApi.getAddresses();
      setAddresses(data);
      if (data.length > 0) {
        const defaultAddr = data.find((a) => a.isDefault) || data[0];
        setSelectedAddressId(defaultAddr.id);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to load delivery addresses');
    } finally {
      setIsLoadingAddresses(false);
    }
  }, []);

  useEffect(() => {
    if (isCheckoutOpen) {
      setPlacedOrder(null);
      setError(null);
      loadAddresses();
    }
  }, [isCheckoutOpen, loadAddresses]);

  if (!isCheckoutOpen) return null;

  const subtotal = cart?.subtotal || 0;
  const shipping = subtotal >= 100 ? 0 : subtotal > 0 ? 10 : 0;
  const total = subtotal + shipping;

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      setError('Please select or add a delivery address to complete your checkout.');
      return;
    }

    try {
      setIsPlacingOrder(true);
      setError(null);

      // Generate random idempotency key
      const idempotencyKey = `chk-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const order = await checkoutApi.processCheckout({
        addressId: selectedAddressId,
        idempotencyKey,
      });

      setPlacedOrder(order);
      await refreshCart();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Checkout failed. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              {placedOrder ? <PackageCheck className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {placedOrder ? 'Order Confirmed!' : 'Secure Checkout'}
              </h2>
              <p className="text-xs text-slate-500">
                {placedOrder ? 'Thank you for your purchase' : 'Review your order & delivery address'}
              </p>
            </div>
          </div>
          <button
            onClick={closeCheckout}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-2.5 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {placedOrder ? (
            /* Order Success Screen */
            <div className="py-6 text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold uppercase tracking-wider">
                  Order Placed Successfully
                </span>
                <h3 className="text-2xl font-black text-slate-900 mt-2">
                  #{placedOrder.orderNumber}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  A confirmation email has been dispatched with delivery tracking details.
                </p>
              </div>

              {/* Order Snapshot Summary */}
              <div className="bg-slate-50 rounded-2xl p-4 text-left border border-slate-200/80 space-y-3">
                <div className="flex items-start justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800">Delivering To:</span>
                    <p className="text-slate-600 mt-0.5">{placedOrder.deliveryAddress.fullName}</p>
                    <p className="text-slate-600">{placedOrder.deliveryAddress.addressLine1}</p>
                    <p className="text-slate-600">
                      {placedOrder.deliveryAddress.city}, {placedOrder.deliveryAddress.state}{' '}
                      {placedOrder.deliveryAddress.postalCode}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-800">Payment Status:</span>
                    <p className="capitalize text-amber-600 font-semibold mt-0.5">
                      {placedOrder.paymentStatus}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <span className="text-xs font-bold text-slate-800 block mb-2">
                    Items ({placedOrder.items.length}):
                  </span>
                  <div className="space-y-1.5">
                    {placedOrder.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-slate-700">
                        <span>
                          {it.productName} × {it.quantity}
                        </span>
                        <span className="font-semibold">${it.itemSubtotal.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-sm font-black text-slate-900">
                  <span>Total Paid / Due:</span>
                  <span className="text-indigo-600 text-base">${placedOrder.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={closeCheckout}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-indigo-500/25 transition"
              >
                Continue Shopping
              </button>
            </div>
          ) : !cart || cart.items.length === 0 ? (
            /* Empty Cart View */
            <div className="py-16 text-center space-y-3">
              <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900">Your cart is empty</h3>
              <p className="text-xs text-slate-500">
                You cannot proceed to checkout without items in your cart.
              </p>
              <button
                onClick={closeCheckout}
                className="mt-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
              >
                Back to Marketplace
              </button>
            </div>
          ) : (
            /* Main Checkout View */
            <div className="space-y-6">
              {/* Step 1: Delivery Address Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      1. Select Delivery Address
                    </h3>
                  </div>
                  <button
                    onClick={openAddressModal}
                    className="flex items-center space-x-1 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Manage / Add</span>
                  </button>
                </div>

                {isLoadingAddresses ? (
                  <div className="py-6 flex items-center justify-center text-slate-400 space-x-2">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                    <span className="text-xs">Loading addresses...</span>
                  </div>
                ) : addresses.length === 0 ? (
                  <div className="p-4 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-2">
                    <p className="text-xs text-slate-600">No delivery addresses found on your account.</p>
                    <button
                      onClick={openAddressModal}
                      className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition"
                    >
                      + Add Delivery Address
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {addresses.map((addr) => (
                      <label
                        key={addr.id}
                        className={`cursor-pointer rounded-2xl border p-3.5 transition flex items-start space-x-3 ${
                          selectedAddressId === addr.id
                            ? 'border-indigo-600 bg-indigo-50/20 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="deliveryAddress"
                          checked={selectedAddressId === addr.id}
                          onChange={() => setSelectedAddressId(addr.id)}
                          className="mt-1 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="text-xs flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">{addr.fullName}</span>
                            {addr.isDefault && (
                              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-slate-600 mt-1 line-clamp-1">{addr.addressLine1}</p>
                          <p className="text-slate-500">
                            {addr.city}, {addr.state} {addr.postalCode}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Step 2: Order Items Summary */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center space-x-2">
                  <ShoppingBag className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    2. Order Items ({cart.items.length})
                  </h3>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {cart.items.map((item) => (
                    <div
                      key={item.id || item.productId}
                      className="flex items-center justify-between text-xs p-3 bg-slate-50/60 rounded-xl border border-slate-100"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                          <ShoppingBag className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <span className="font-bold text-slate-900 block truncate">{item.name}</span>
                          <span className="text-[11px] text-slate-500">
                            Qty: {item.quantity} × ${item.unitPrice.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <span className="font-bold text-slate-900 shrink-0 ml-3">
                        ${item.itemTotal.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 3: Price Breakdown & Place Order */}
              <div className="pt-4 border-t border-slate-100 space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Items Subtotal</span>
                    <span className="font-semibold text-slate-900">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Standard Shipping</span>
                    <span className="font-semibold text-slate-900">
                      {shipping === 0 ? (
                        <span className="text-emerald-600 font-bold">FREE</span>
                      ) : (
                        `$${shipping.toFixed(2)}`
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Discounts</span>
                    <span className="font-semibold text-slate-900">$0.00</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                    <span>Final Total</span>
                    <span className="text-base text-indigo-600">${total.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={handlePlaceOrder}
                  disabled={isPlacingOrder || addresses.length === 0}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-indigo-500/25 flex items-center justify-center space-x-2 transition disabled:opacity-50"
                >
                  {isPlacingOrder ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Securing Order & Inventory...</span>
                    </>
                  ) : (
                    <>
                      <span>Place Order</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

