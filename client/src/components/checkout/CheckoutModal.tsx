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
  Banknote,
  Sparkles,
  QrCode,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { Address, Order, CouponValidationResponse, CreateAddressDto, PaymentMethodType } from '../../types';
import { addressApi } from '../../services/address.api';
import { checkoutApi } from '../../services/checkout.api';
import { paymentApi } from '../../services/payment.api';
import { couponApi } from '../../services/coupon.api';
import { loadRazorpayScript } from '../../utils/loadRazorpay';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { UpiQrPaymentModal } from './UpiQrPaymentModal';

export const CheckoutModal: React.FC = () => {
  const { cart, isCheckoutOpen, closeCheckout, refreshCart, openAddressModal, isAddressModalOpen } = useCart();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [isLoadingAddresses, setIsLoadingAddresses] = useState<boolean>(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  // Inline Address Form State
  const [showAddAddressForm, setShowAddAddressForm] = useState<boolean>(false);
  const [isSavingInlineAddress, setIsSavingInlineAddress] = useState<boolean>(false);
  const [inlineAddressError, setInlineAddressError] = useState<string | null>(null);
  const [inlineAddress, setInlineAddress] = useState<CreateAddressDto>({
    fullName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    isDefault: true,
  });

  // Payment Method Selection & Test Gateway Simulation State
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodType>('upi_qr');
  const [showSimulatorModal, setShowSimulatorModal] = useState<boolean>(false);
  const [showUpiQrModal, setShowUpiQrModal] = useState<boolean>(false);
  const [testOrderData, setTestOrderData] = useState<any>(null);

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
        setSelectedAddressId((prev) => (prev ? prev : defaultAddr.id));
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
      setShowAddAddressForm(false);
      setInlineAddressError(null);
      setSelectedPaymentMethod('upi');
      setShowSimulatorModal(false);
      setTestOrderData(null);
      loadAddresses();
    }
  }, [isCheckoutOpen, loadAddresses]);

  // When Address modal closes while Checkout is open, refresh addresses
  useEffect(() => {
    if (isCheckoutOpen && !isAddressModalOpen) {
      loadAddresses();
    }
  }, [isAddressModalOpen, isCheckoutOpen, loadAddresses]);

  const handleSaveInlineAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineAddress.fullName.trim()) {
      setInlineAddressError('Full name is required');
      return;
    }
    if (!inlineAddress.phone.trim()) {
      setInlineAddressError('Phone number is required');
      return;
    }
    if (!inlineAddress.addressLine1.trim()) {
      setInlineAddressError('Street address is required');
      return;
    }
    if (!inlineAddress.city.trim()) {
      setInlineAddressError('City is required');
      return;
    }
    if (!inlineAddress.state.trim()) {
      setInlineAddressError('State/Province is required');
      return;
    }
    if (!inlineAddress.postalCode.trim()) {
      setInlineAddressError('Postal/ZIP code is required');
      return;
    }

    try {
      setIsSavingInlineAddress(true);
      setInlineAddressError(null);
      const created = await addressApi.createAddress(inlineAddress);
      setAddresses((prev) => [created, ...prev]);
      setSelectedAddressId(created.id);
      setShowAddAddressForm(false);
      setInlineAddress({
        fullName: '',
        phone: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'United States',
        isDefault: true,
      });
    } catch (err: any) {
      setInlineAddressError(err?.response?.data?.error?.message || 'Failed to save address');
    } finally {
      setIsSavingInlineAddress(false);
    }
  };

  const handlePayNow = async (overrideMethod?: PaymentMethodType) => {
    if (!placedOrder) return;
    const methodToUse = overrideMethod || selectedPaymentMethod || 'upi_qr';

    if (methodToUse === 'upi_qr') {
      setShowUpiQrModal(true);
      return;
    }

    try {
      setIsProcessingPayment(true);
      setPaymentError(null);

      // 1. Initiate Razorpay order on backend
      const rzpOrderData = await paymentApi.createOrder(placedOrder.id, methodToUse);

      // Check if running in development/test environment with placeholder keys
      if (rzpOrderData.keyId.includes('placeholder')) {
        setTestOrderData(rzpOrderData);
        setShowSimulatorModal(true);
        setIsProcessingPayment(false);
        return;
      }

      // 2. Load Razorpay official checkout SDK
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error('Razorpay SDK failed to load. Please verify your internet connection.');
      }

      const razorpayMethodKey =
        methodToUse === 'card'
          ? 'card'
          : methodToUse === 'netbanking'
          ? 'netbanking'
          : methodToUse === 'wallet'
          ? 'wallet'
          : 'upi';

      // 3. Configure Razorpay modal
      const options = {
        key: rzpOrderData.keyId,
        amount: rzpOrderData.amount,
        currency: rzpOrderData.currency,
        name: 'NexusMarket Multi-Vendor',
        description: `Payment for Order #${placedOrder.orderNumber} via ${methodToUse.toUpperCase()}`,
        order_id: rzpOrderData.razorpayOrderId,
        prefill: {
          name: rzpOrderData.customer.name,
          contact: rzpOrderData.customer.phone,
          method: razorpayMethodKey,
        },
        theme: {
          color: '#10B981', // light green emerald
        },
        handler: async (response: any) => {
          try {
            setIsProcessingPayment(true);
            const verifyResult = await paymentApi.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              paymentMethod: methodToUse,
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
            setPaymentError('Payment window was closed. You can retry paying anytime using any payment method.');
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

  const handleSimulatePayment = async (status: 'success' | 'failed' | 'cancel') => {
    if (!testOrderData || !placedOrder) return;
    try {
      setIsProcessingPayment(true);
      setShowSimulatorModal(false);

      if (status === 'cancel') {
        setPaymentError('Payment window was closed. You can retry anytime with any payment method.');
        setIsProcessingPayment(false);
        return;
      }

      if (status === 'failed') {
        setPaymentError('Simulated payment failed: Card declined / UPI transaction failed at issuing bank.');
        setIsProcessingPayment(false);
        return;
      }

      // Success simulation: submit to backend verification
      const simPaymentId = `pay_sim_${Date.now()}`;
      const simSignature = `sim_sig_${Date.now()}`;

      const verifyResult = await paymentApi.verifyPayment({
        razorpay_order_id: testOrderData.razorpayOrderId,
        razorpay_payment_id: simPaymentId,
        razorpay_signature: simSignature,
        paymentMethod: selectedPaymentMethod,
      });

      setPlacedOrder(verifyResult.order);
      setPaymentSuccess(true);
    } catch (err: any) {
      setPaymentError(err?.response?.data?.error?.message || 'Payment verification failed');
    } finally {
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
        paymentMethod: selectedPaymentMethod,
      });

      setPlacedOrder(order);
      await refreshCart();

      if (selectedPaymentMethod === 'upi_qr') {
        setShowUpiQrModal(true);
      }
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
                  <span className="text-emerald-700 text-base">${placedOrder.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* COD Special Instructions */}
              {placedOrder.paymentMethod === 'cod' && (
                <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl flex items-start space-x-3 text-left">
                  <Banknote className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold text-teal-900 block mb-0.5">Cash on Delivery Order Confirmed</span>
                    <p className="text-teal-700">
                      Your order is verified and ready for fulfillment. Please have ${placedOrder.totalAmount.toFixed(2)} in cash or UPI ready when our courier agent delivers your package.
                    </p>
                  </div>
                </div>
              )}

              {/* Payment Actions for Online Orders */}
              {placedOrder.paymentMethod !== 'cod' && placedOrder.paymentStatus !== 'paid' && (
                <div className="space-y-3 pt-2">
                  <div className="text-left space-y-1.5">
                    <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                      <span>Select Preferred Payment Option:</span>
                    </label>
                    <PaymentMethodSelector
                      selectedMethod={selectedPaymentMethod}
                      onSelectMethod={setSelectedPaymentMethod}
                      allowCod={false}
                      compact={true}
                    />
                  </div>

                  <button
                    onClick={() => handlePayNow(selectedPaymentMethod)}
                    disabled={isProcessingPayment}
                    className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-500/25 flex items-center justify-center space-x-2 transition disabled:opacity-50"
                  >
                    {isProcessingPayment ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Connecting to Gateway...</span>
                      </>
                    ) : paymentError ? (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        <span>Retry Payment (${placedOrder.totalAmount.toFixed(2)})</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        <span>
                          Pay Now via {selectedPaymentMethod.toUpperCase()} with Razorpay ($
                          {placedOrder.totalAmount.toFixed(2)})
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}

              <div>
                <button
                  onClick={closeCheckout}
                  className={`w-full py-3 rounded-2xl text-xs sm:text-sm font-bold transition ${
                    placedOrder.paymentStatus === 'paid' || placedOrder.paymentMethod === 'cod'
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {placedOrder.paymentStatus === 'paid' || placedOrder.paymentMethod === 'cod'
                    ? 'Continue Shopping'
                    : 'Pay Later & Continue Shopping'}
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
                className="mt-2 px-5 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition shadow-sm"
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
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      1. Select Delivery Address
                    </h3>
                  </div>
                  <div className="flex items-center space-x-3">
                    {!showAddAddressForm && (
                      <button
                        type="button"
                        onClick={() => setShowAddAddressForm(true)}
                        className="flex items-center space-x-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add New Address</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={openAddressModal}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700 transition"
                    >
                      Manage
                    </button>
                  </div>
                </div>

                {isLoadingAddresses ? (
                  <div className="py-6 flex items-center justify-center text-slate-400 space-x-2">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                    <span className="text-xs">Loading addresses...</span>
                  </div>
                ) : showAddAddressForm ? (
                  /* Inline Delivery Address Form */
                  <form
                    onSubmit={handleSaveInlineAddress}
                    className="p-4 bg-slate-50/90 rounded-2xl border border-emerald-200/80 shadow-sm space-y-3 animate-in fade-in duration-150"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-bold text-slate-900">Enter Delivery Address</span>
                      </div>
                      {addresses.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddAddressForm(false);
                            setInlineAddressError(null);
                          }}
                          className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    {inlineAddressError && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-700 text-xs">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{inlineAddressError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={inlineAddress.fullName}
                          onChange={(e) =>
                            setInlineAddress({ ...inlineAddress, fullName: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                          placeholder="e.g. John Doe"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Phone Number *
                        </label>
                        <input
                          type="tel"
                          required
                          value={inlineAddress.phone}
                          onChange={(e) =>
                            setInlineAddress({ ...inlineAddress, phone: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                          placeholder="e.g. +1 555-123-4567"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Street Address *
                      </label>
                      <input
                        type="text"
                        required
                        value={inlineAddress.addressLine1}
                        onChange={(e) =>
                          setInlineAddress({ ...inlineAddress, addressLine1: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                        placeholder="Street address, P.O. box, building"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Apt, Suite, Unit (Optional)
                      </label>
                      <input
                        type="text"
                        value={inlineAddress.addressLine2 || ''}
                        onChange={(e) =>
                          setInlineAddress({ ...inlineAddress, addressLine2: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                        placeholder="Apartment, suite, unit, etc."
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          City *
                        </label>
                        <input
                          type="text"
                          required
                          value={inlineAddress.city}
                          onChange={(e) =>
                            setInlineAddress({ ...inlineAddress, city: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                          placeholder="City"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          State / Province *
                        </label>
                        <input
                          type="text"
                          required
                          value={inlineAddress.state}
                          onChange={(e) =>
                            setInlineAddress({ ...inlineAddress, state: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                          placeholder="State"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Postal / ZIP Code *
                        </label>
                        <input
                          type="text"
                          required
                          value={inlineAddress.postalCode}
                          onChange={(e) =>
                            setInlineAddress({ ...inlineAddress, postalCode: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                          placeholder="ZIP Code"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                      <label className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={inlineAddress.isDefault}
                          onChange={(e) =>
                            setInlineAddress({ ...inlineAddress, isDefault: e.target.checked })
                          }
                          className="rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                        />
                        <span>Save as default delivery address</span>
                      </label>

                      <div className="flex items-center space-x-2">
                        {addresses.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddAddressForm(false);
                              setInlineAddressError(null);
                            }}
                            className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl transition"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={isSavingInlineAddress}
                          className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center space-x-1.5 disabled:opacity-50"
                        >
                          {isSavingInlineAddress && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>Save & Deliver Here</span>
                        </button>
                      </div>
                    </div>
                  </form>
                ) : addresses.length === 0 ? (
                  <div className="p-5 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-3">
                    <p className="text-xs text-slate-600">No delivery addresses found on your account.</p>
                    <button
                      type="button"
                      onClick={() => setShowAddAddressForm(true)}
                      className="px-4 py-2 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 transition shadow-sm inline-flex items-center space-x-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Delivery Address</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {addresses.map((addr) => (
                        <label
                          key={addr.id}
                          className={`cursor-pointer rounded-2xl border p-3.5 transition flex items-start space-x-3 ${
                            selectedAddressId === addr.id
                              ? 'border-emerald-600 bg-emerald-50/30 shadow-sm'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <input
                            type="radio"
                            name="deliveryAddress"
                            checked={selectedAddressId === addr.id}
                            onChange={() => setSelectedAddressId(addr.id)}
                            className="mt-1 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="text-xs flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900">{addr.fullName}</span>
                              {addr.isDefault && (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-slate-600 mt-1 line-clamp-1">{addr.addressLine1}</p>
                            {addr.addressLine2 && (
                              <p className="text-slate-500 line-clamp-1">{addr.addressLine2}</p>
                            )}
                            <p className="text-slate-500">
                              {addr.city}, {addr.state} {addr.postalCode}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
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

              {/* Step 3: Payment Method Selection */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    3. Select Payment Method
                  </h3>
                </div>

                <PaymentMethodSelector
                  selectedMethod={selectedPaymentMethod}
                  onSelectMethod={setSelectedPaymentMethod}
                  allowCod={true}
                />
              </div>

              {/* Step 4: Promo / Coupon Code Section */}
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <div className="flex items-center space-x-2">
                  <Tag className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    4. Coupon & Promotional Discount
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

              {/* Step 5: Price Breakdown & Place Order */}
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
                    <span className="text-base text-emerald-700">${total.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={handlePlaceOrder}
                  disabled={isPlacingOrder || addresses.length === 0}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-500/25 flex items-center justify-center space-x-2 transition disabled:opacity-50"
                >
                  {isPlacingOrder ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Securing Order & Inventory...</span>
                    </>
                  ) : selectedPaymentMethod === 'cod' ? (
                    <>
                      <Banknote className="w-4 h-4" />
                      <span>Place Order with Cash on Delivery (${total.toFixed(2)})</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>
                        Place Order & Pay via {selectedPaymentMethod.toUpperCase()} (${total.toFixed(2)})
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Razorpay Test Mode Gateway Simulator Modal */}
      {showSimulatorModal && testOrderData && (
        <div className="fixed inset-0 z-[90] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-emerald-200" />
                <div>
                  <h3 className="text-sm font-bold">Razorpay Test Gateway Simulator</h3>
                  <p className="text-[11px] text-emerald-100">Sandbox Environment Mode</p>
                </div>
              </div>
              <button
                onClick={() => handleSimulatePayment('cancel')}
                className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Order Number:</span>
                  <span className="font-bold text-slate-800">{placedOrder?.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Method:</span>
                  <span className="font-bold text-emerald-700 uppercase">{selectedPaymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Razorpay Order ID:</span>
                  <span className="font-mono text-slate-600 text-[11px]">{testOrderData.razorpayOrderId}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-black text-slate-900">
                  <span>Payable Amount:</span>
                  <span className="text-emerald-700">₹{(testOrderData.amount / 100).toFixed(2)}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                This testing modal validates your HMAC payment signature verification, order status reconciliation, platform commissions, and automated tax invoices without real banking deductions.
              </p>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSimulatorModal(false);
                    setShowUpiQrModal(true);
                  }}
                  className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl font-bold text-xs transition flex items-center justify-center space-x-2"
                >
                  <QrCode className="w-4 h-4 text-emerald-600" />
                  <span>Pay using UPI QR Code Flow</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSimulatePayment('success')}
                  disabled={isProcessingPayment}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-md shadow-emerald-500/20 transition flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {isProcessingPayment ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Simulate Successful Payment</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleSimulatePayment('failed')}
                  disabled={isProcessingPayment}
                  className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-semibold transition"
                >
                  Simulate Bank Decline / Network Failure
                </button>

                <button
                  type="button"
                  onClick={() => handleSimulatePayment('cancel')}
                  disabled={isProcessingPayment}
                  className="w-full py-2 text-slate-400 hover:text-slate-600 font-medium text-[11px]"
                >
                  Dismiss / Cancel Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UPI QR Payment Modal */}
      {showUpiQrModal && placedOrder && (
        <UpiQrPaymentModal
          isOpen={showUpiQrModal}
          orderId={placedOrder.id}
          orderNumber={placedOrder.orderNumber}
          totalAmount={placedOrder.totalAmount}
          onClose={() => setShowUpiQrModal(false)}
          onPaymentSuccess={(updatedOrder) => {
            setShowUpiQrModal(false);
            setPlacedOrder((prev) => (prev ? { ...prev, ...updatedOrder, paymentStatus: 'paid' } : updatedOrder));
            setPaymentSuccess(true);
          }}
          onPaymentFailed={(errMsg) => {
            setPaymentError(errMsg);
          }}
        />
      )}
    </div>
  );
};

