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
  CreditCard,
  RotateCcw,
  Tag,
  Check,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { Address, Order, CouponValidationResponse } from '../../types';
import { addressApi } from '../../services/address.api';
import { checkoutApi } from '../../services/checkout.api';
import { paymentApi } from '../../services/payment.api';
import { couponApi } from '../../services/coupon.api';
import { loadRazorpayScript } from '../../utils/loadRazorpay';

export const CheckoutModal: React.FC = () => {
  const { cart, isCheckoutOpen, closeCheckout, refreshCart, openAddressModal } = useCart();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [isLoadingAddresses, setIsLoadingAddresses] = useState<boolean>(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  // Phase 9B: Coupon State
  const [couponInput, setCouponInput] = useState<string>('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState<boolean>(false);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResponse | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

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
      setPaymentError(null);
      setPaymentSuccess(false);
      setCouponInput('');
      setAppliedCoupon(null);
      setCouponError(null);
      loadAddresses();
    }
  }, [isCheckoutOpen, loadAddresses]);

  const handlePayNow = async () => {
    if (!placedOrder) return;

    try {
      setIsProcessingPayment(true);
      setPaymentError(null);

      // 1. Initiate Razorpay order on backend
      const rzpOrderData = await paymentApi.createOrder(placedOrder.id);

      // 2. Load Razorpay official checkout SDK
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error('Razorpay SDK failed to load. Please verify your internet connection.');
      }

      // 3. Configure Razorpay modal
      const options = {
        key: rzpOrderData.keyId,
        amount: rzpOrderData.amount,
        currency: rzpOrderData.currency,
        name: 'NexusMarket Multi-Vendor',
        description: `Payment for Order #${placedOrder.orderNumber}`,
        order_id: rzpOrderData.razorpayOrderId,
        prefill: {
          name: rzpOrderData.customer.name,
          contact: rzpOrderData.customer.phone,
        },
        theme: {
          color: '#4F46E5',
        },
        handler: async (response: any) => {
          try {
            setIsProcessingPayment(true);
            const verifyResult = await paymentApi.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            setPlacedOrder(verifyResult.order);
            setPaymentSuccess(true);
          } catch (err: any) {
            setPaymentError(err?.response?.data?.error?.message || 'Payment verification failed');
          } finally {
            setIsProcessingPayment(false);
          }
        },
        modal: {
          ondismiss: () => {
            setIsProcessingPayment(false);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (resp: any) => {
        setPaymentError(resp.error?.description || 'Payment was unsuccessful. You can retry anytime.');
        setIsProcessingPayment(false);
      });
      rzp.open();
    } catch (err: any) {
      setPaymentError(err?.response?.data?.error?.message || err.message || 'Payment initiation failed');
      setIsProcessingPayment(false);
    }
  };

  if (!isCheckoutOpen) return null;

  const subtotal = cart?.subtotal || 0;
  const shipping = subtotal >= 100 ? 0 : subtotal > 0 ? 10 : 0;
  const discount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const total = Math.max(0, Math.round((subtotal + shipping - discount) * 100) / 100);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    try {
      setIsValidatingCoupon(true);
      setCouponError(null);
      const res = await couponApi.validateCoupon(couponInput.trim().toUpperCase());
      setAppliedCoupon(res);
      setCouponInput('');
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponError(err?.response?.data?.error?.message || 'Invalid coupon code');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
    setCouponInput('');
  };

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
        couponCode: appliedCoupon ? appliedCoupon.coupon.code : undefined,
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
                    <p
                      className={`capitalize font-bold text-xs mt-0.5 px-2 py-0.5 rounded-full inline-block ${
                        placedOrder.paymentStatus === 'paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {placedOrder.paymentStatus === 'paid' ? 'Paid (Captured)' : placedOrder.paymentStatus}
                    </p>
                  </div>
                </div>

                {/* Payment Feedback */}
                {paymentError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-700">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{paymentError}</span>
                    </div>
                  </div>
                )}

                {paymentSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-xs text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Payment verified and captured successfully via Razorpay!</span>
                  </div>
                )}

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

              {/* Payment Actions */}
              <div className="space-y-3">
                {placedOrder.paymentStatus !== 'paid' && (
                  <button
                    onClick={handlePayNow}
                    disabled={isProcessingPayment}
                    className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-indigo-500/25 flex items-center justify-center space-x-2 transition disabled:opacity-50"
                  >
                    {isProcessingPayment ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Processing with Razorpay...</span>
                      </>
                    ) : paymentError ? (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        <span>Retry Payment (${placedOrder.totalAmount.toFixed(2)})</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        <span>Pay Now with Razorpay (${placedOrder.totalAmount.toFixed(2)})</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={closeCheckout}
                  className={`w-full py-3 rounded-2xl text-xs sm:text-sm font-bold transition ${
                    placedOrder.paymentStatus === 'paid'
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {placedOrder.paymentStatus === 'paid' ? 'Continue Shopping' : 'Pay Later & Continue Shopping'}
                </button>
              </div>
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

              {/* Step 3: Promo / Coupon Code Section */}
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <div className="flex items-center space-x-2">
                  <Tag className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    3. Coupon & Promotional Discount
                  </h3>
                </div>

                {appliedCoupon ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs animate-in fade-in duration-150">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        <Check className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-emerald-900 tracking-wider">
                            {appliedCoupon.coupon.code}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-200/80 text-emerald-800 rounded">
                            {appliedCoupon.coupon.discountType === 'percentage'
                              ? `${appliedCoupon.coupon.discountValue}% OFF`
                              : `$${appliedCoupon.coupon.discountValue} FLAT`}
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          {appliedCoupon.coupon.description || 'Coupon applied to eligible cart items'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-xs font-bold text-rose-600 hover:text-rose-800 px-2 py-1 rounded-lg hover:bg-rose-50 transition"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleApplyCoupon();
                            }
                          }}
                          placeholder="Enter coupon code (e.g. SAVE20)"
                          className="w-full text-xs font-mono font-semibold tracking-wider uppercase px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={isValidatingCoupon || !couponInput.trim()}
                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition disabled:opacity-40 flex items-center space-x-1.5 shrink-0"
                      >
                        {isValidatingCoupon ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Checking...</span>
                          </>
                        ) : (
                          <span>Apply</span>
                        )}
                      </button>
                    </div>

                    {couponError && (
                      <div className="text-[11px] text-rose-600 flex items-center space-x-1.5 px-1 pt-0.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{couponError}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 4: Price Breakdown & Place Order */}
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
                    <span className={`font-semibold ${discount > 0 ? 'text-emerald-600 font-bold' : 'text-slate-900'}`}>
                      {discount > 0 ? `-$${discount.toFixed(2)}` : '$0.00'}
                    </span>
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

