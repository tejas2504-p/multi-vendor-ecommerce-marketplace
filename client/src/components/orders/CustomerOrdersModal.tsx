import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Package,
  Truck,
  AlertCircle,
  ChevronRight,
  Loader2,
  Store,
  Layers,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';
import { Order, VendorOrder } from '../../types';
import { orderApi } from '../../services/order.api';
import { paymentApi } from '../../services/payment.api';
import { loadRazorpayScript } from '../../utils/loadRazorpay';

interface CustomerOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerOrdersModal: React.FC<CustomerOrdersModalProps> = ({ isOpen, onClose }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [vendorOrders, setVendorOrders] = useState<VendorOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await orderApi.getCustomerOrders();
      setOrders(data);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadOrders();
      setSelectedOrder(null);
      setVendorOrders([]);
    }
  }, [isOpen, loadOrders]);

  const handleSelectOrder = async (order: Order) => {
    setSelectedOrder(order);
    setPaymentError(null);
    setPaymentSuccess(false);
    try {
      setIsLoadingDetails(true);
      const vo = await orderApi.getCustomerVendorOrders(order.id);
      setVendorOrders(vo);
    } catch (err: any) {
      console.error('Failed to load child vendor orders', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handlePayOrder = async (order: Order) => {
    try {
      setIsProcessingPayment(true);
      setPaymentError(null);

      const rzpOrderData = await paymentApi.createOrder(order.id);
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error('Razorpay SDK failed to load. Please verify your connection.');
      }

      const options = {
        key: rzpOrderData.keyId,
        amount: rzpOrderData.amount,
        currency: rzpOrderData.currency,
        name: 'NexusMarket Multi-Vendor',
        description: `Payment for Order #${order.orderNumber}`,
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

            setSelectedOrder(verifyResult.order);
            setPaymentSuccess(true);
            loadOrders();
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
        setPaymentError(resp.error?.description || 'Payment was unsuccessful');
        setIsProcessingPayment(false);
      });
      rzp.open();
    } catch (err: any) {
      setPaymentError(err?.response?.data?.error?.message || err.message || 'Payment initiation failed');
      setIsProcessingPayment(false);
    }
  };

  if (!isOpen) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'shipped':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'partially_delivered':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'partially_shipped':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'processing':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'confirmed':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {selectedOrder ? `Order #${selectedOrder.orderNumber}` : 'Your Order History'}
              </h2>
              <p className="text-xs text-slate-500">
                {selectedOrder ? 'Multi-Vendor shipment tracking' : 'Track and manage your marketplace purchases'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
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

        {/* Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {selectedOrder ? (
            /* Detailed Order View with Vendor Splitting */
            <div className="space-y-6">
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center space-x-1"
              >
                <span>← Back to all orders</span>
              </button>

              {/* Order Meta & Status */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Order Reference
                    </span>
                    <span className="text-base font-black text-slate-900">
                      {selectedOrder.orderNumber}
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Placed on {new Date(selectedOrder.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-2.5 py-1 text-xs font-bold rounded-lg border capitalize ${getStatusBadge(
                        selectedOrder.orderStatus
                      )}`}
                    >
                      {selectedOrder.orderStatus.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 text-xs grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="font-bold text-slate-700 block mb-0.5">Delivery Destination:</span>
                    <p className="text-slate-600">{selectedOrder.deliveryAddress.fullName}</p>
                    <p className="text-slate-600">{selectedOrder.deliveryAddress.addressLine1}</p>
                    <p className="text-slate-600">
                      {selectedOrder.deliveryAddress.city}, {selectedOrder.deliveryAddress.state}{' '}
                      {selectedOrder.deliveryAddress.postalCode}
                    </p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-700 block mb-0.5">Payment Summary:</span>
                    <p className="text-slate-600">Subtotal: ${selectedOrder.subtotal.toFixed(2)}</p>
                    <p className="text-slate-600">
                      Shipping: {selectedOrder.shippingAmount === 0 ? 'FREE' : `$${selectedOrder.shippingAmount.toFixed(2)}`}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-sm font-black text-slate-900">
                        Total: ${selectedOrder.totalAmount.toFixed(2)}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                          selectedOrder.paymentStatus === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {selectedOrder.paymentStatus === 'paid' ? 'Paid (Captured)' : selectedOrder.paymentStatus}
                      </span>
                    </div>

                    {selectedOrder.paymentStatus !== 'paid' && selectedOrder.orderStatus !== 'cancelled' && (
                      <button
                        onClick={() => handlePayOrder(selectedOrder)}
                        disabled={isProcessingPayment}
                        className="mt-2.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center space-x-1.5 transition disabled:opacity-50"
                      >
                        {isProcessingPayment ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Processing...</span>
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pay with Razorpay</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {paymentError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{paymentError}</span>
                  </div>
                )}

                {paymentSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Payment verified and captured successfully via Razorpay!</span>
                  </div>
                )}
              </div>

              {/* Vendor Shipments Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Vendor Shipments ({vendorOrders.length})
                  </h3>
                </div>

                {isLoadingDetails ? (
                  <div className="py-8 flex items-center justify-center text-slate-400 space-x-2">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                    <span className="text-xs">Loading shipment packages...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {vendorOrders.map((vo) => (
                      <div
                        key={vo.id}
                        className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-white hover:border-slate-300 transition shadow-sm"
                      >
                        {/* Package Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Store className="w-4 h-4 text-slate-500" />
                            <span className="text-xs font-bold text-slate-900">
                              Package #{vo.vendorOrderNumber}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-md border capitalize ${getStatusBadge(
                              vo.orderStatus
                            )}`}
                          >
                            {vo.orderStatus}
                          </span>
                        </div>

                        {/* Tracking details */}
                        {vo.shipmentTracking?.trackingNumber && (
                          <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2">
                              <Truck className="w-4 h-4 text-blue-600" />
                              <span className="text-slate-700">
                                <strong>Carrier:</strong> {vo.shipmentTracking.carrier || 'Standard'}
                              </span>
                            </div>
                            <span className="font-mono text-blue-700 font-bold">
                              {vo.shipmentTracking.trackingNumber}
                            </span>
                          </div>
                        )}

                        {/* Items */}
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                          {vo.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between text-xs text-slate-700">
                              <span>
                                {it.productName} × {it.quantity}
                              </span>
                              <span className="font-semibold">${it.itemSubtotal.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs text-slate-600">
                          <span>Vendor Package Subtotal:</span>
                          <span className="font-bold text-slate-900">${vo.vendorSubtotal.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Orders Listing */
            <div className="space-y-3">
              {isLoading ? (
                <div className="py-16 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
                  <span className="text-xs">Loading orders...</span>
                </div>
              ) : orders.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <Package className="w-12 h-12 text-slate-300 mx-auto" />
                  <h3 className="text-sm font-bold text-slate-900">No orders placed yet</h3>
                  <p className="text-xs text-slate-500">
                    Explore products in the catalog and check out to view your orders here.
                  </p>
                </div>
              ) : (
                orders.map((ord) => (
                  <div
                    key={ord.id}
                    onClick={() => handleSelectOrder(ord)}
                    className="cursor-pointer rounded-2xl border border-slate-200 p-4 hover:border-indigo-400 hover:shadow-md transition bg-white flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-slate-900">#{ord.orderNumber}</span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md border capitalize ${getStatusBadge(
                            ord.orderStatus
                          )}`}
                        >
                          {ord.orderStatus.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {new Date(ord.createdAt).toLocaleDateString()} • {ord.items.length}{' '}
                        {ord.items.length === 1 ? 'item' : 'items'}
                      </p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-black text-slate-900">${ord.totalAmount.toFixed(2)}</span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
