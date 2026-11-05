import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Truck,
  CheckCircle2,
  Loader2,
  AlertCircle,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { VendorOrder } from '../../types';
import { orderApi } from '../../services/order.api';
import { useApp } from '../../context/AppContext';

export const VendorOrdersManager: React.FC = () => {
  const { user, isAuthenticated } = useApp();
  const [vendorOrders, setVendorOrders] = useState<VendorOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Updating form state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [targetStatus, setTargetStatus] = useState<string>('processing');
  const [carrier, setCarrier] = useState<string>('FedEx Express');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [statusNote, setStatusNote] = useState<string>('');
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const isVendor = isAuthenticated && (user?.role === 'vendor' || user?.role === 'admin');

  const loadVendorOrders = useCallback(async () => {
    if (!isVendor) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await orderApi.getVendorOrders();
      setVendorOrders(data);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to load merchant orders');
    } finally {
      setIsLoading(false);
    }
  }, [isVendor]);

  useEffect(() => {
    loadVendorOrders();
  }, [loadVendorOrders]);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) return;

    try {
      setIsUpdating(true);
      setError(null);
      setSuccessMsg(null);

      await orderApi.updateVendorOrderStatus(selectedOrderId, {
        status: targetStatus,
        carrier: targetStatus === 'shipped' ? carrier : undefined,
        trackingNumber: targetStatus === 'shipped' ? trackingNumber : undefined,
        note: statusNote || undefined,
        cancellationReason: targetStatus === 'cancelled' ? cancellationReason : undefined,
      });

      setSuccessMsg(`Vendor order updated to "${targetStatus}" successfully`);
      setSelectedOrderId(null);
      await loadVendorOrders();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to update order status');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isVendor) {
    return (
      <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500">
        Sign in with an approved Vendor or Admin account to manage merchant order fulfillment.
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'shipped':
        return 'bg-blue-50 text-blue-700 border-blue-200';
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
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Merchant Fulfillment Orders</h2>
            <p className="text-xs text-slate-500">
              Manage your assigned vendor orders, mark tracking numbers, and fulfill shipments
            </p>
          </div>
        </div>

        <button
          onClick={loadVendorOrders}
          disabled={isLoading}
          className="flex items-center space-x-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-2 text-emerald-700 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Orders List */}
      {isLoading && vendorOrders.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
          <span className="text-xs">Loading assigned orders...</span>
        </div>
      ) : vendorOrders.length === 0 ? (
        <div className="py-12 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-2">
          <Package className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs text-slate-600 font-semibold">No assigned orders found yet</p>
          <p className="text-[11px] text-slate-400">
            When customers checkout with your store items, your fulfillment packages will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {vendorOrders.map((vo) => (
            <div
              key={vo.id}
              className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-slate-50/40 hover:border-slate-300 transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-slate-900">#{vo.vendorOrderNumber}</span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md border capitalize ${getStatusBadge(
                        vo.orderStatus
                      )}`}
                    >
                      {vo.orderStatus}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Received on {new Date(vo.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs font-black text-slate-900">${vo.vendorSubtotal.toFixed(2)}</span>
                  {vo.orderStatus !== 'delivered' && vo.orderStatus !== 'cancelled' && (
                    <button
                      onClick={() => {
                        setSelectedOrderId(vo.id);
                        if (vo.orderStatus === 'confirmed') setTargetStatus('processing');
                        else if (vo.orderStatus === 'processing') setTargetStatus('shipped');
                        else if (vo.orderStatus === 'shipped') setTargetStatus('delivered');
                      }}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                    >
                      Update Status
                    </button>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-3 space-y-1.5 text-xs">
                {vo.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-slate-700">
                    <span>
                      {it.productName} × {it.quantity}
                    </span>
                    <span className="font-semibold">${it.itemSubtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Tracking display */}
              {vo.shipmentTracking?.trackingNumber && (
                <div className="flex items-center space-x-2 text-xs text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                  <Truck className="w-3.5 h-3.5" />
                  <span>
                    <strong>{vo.shipmentTracking.carrier || 'Shipped'}:</strong>{' '}
                    <span className="font-mono">{vo.shipmentTracking.trackingNumber}</span>
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal for updating vendor order status */}
      {selectedOrderId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Update Fulfillment Status</h3>
              <button
                onClick={() => setSelectedOrderId(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">New Status *</label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-800"
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing (Packaging)</option>
                  <option value="shipped">Shipped (Requires Tracking)</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled (Restores Inventory)</option>
                </select>
              </div>

              {targetStatus === 'shipped' && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Shipping Carrier *</label>
                    <input
                      type="text"
                      required
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      placeholder="e.g. FedEx Express, DHL, UPS"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tracking Number *</label>
                    <input
                      type="text"
                      required
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="e.g. FDX-9988776655"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                </>
              )}

              {targetStatus === 'cancelled' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cancellation Reason *</label>
                  <input
                    type="text"
                    required
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    placeholder="e.g. Item defective, customer requested"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Internal Fulfillment Note</label>
                <input
                  type="text"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Optional note for status log"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedOrderId(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex items-center space-x-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition disabled:opacity-50"
                >
                  {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Status</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
