import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  TrendingUp,
  Percent,
  CheckCircle2,
  XCircle,
  Filter,
  RefreshCw,
  Loader2,
  AlertCircle,
  Building,
  Edit2,
  Save,
  PlusCircle,
} from 'lucide-react';
import {
  VendorPayoutRecord,
  AdminCommissionOverview,
} from '../../types';
import { payoutApi } from '../../services/payout.api';
import { useApp } from '../../context/AppContext';

export const AdminPayoutsManager: React.FC = () => {
  const { user, isAuthenticated } = useApp();
  const [payouts, setPayouts] = useState<VendorPayoutRecord[]>([]);
  const [overview, setOverview] = useState<AdminCommissionOverview | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Commission editing state
  const [isEditingDefaultRate, setIsEditingDefaultRate] = useState<boolean>(false);
  const [defaultRateInput, setDefaultRateInput] = useState<string>('10');
  const [isSavingRate, setIsSavingRate] = useState<boolean>(false);

  // Vendor override modal / input state
  const [vendorOverrideId, setVendorOverrideId] = useState<string>('');
  const [vendorOverrideRate, setVendorOverrideRate] = useState<string>('');
  const [isSavingVendorRate, setIsSavingVendorRate] = useState<boolean>(false);

  // Rejection modal
  const [rejectingPayoutId, setRejectingPayoutId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  // Status update modal (e.g. mark paid or processing)
  const [updatingPayout, setUpdatingPayout] = useState<VendorPayoutRecord | null>(null);
  const [targetStatus, setTargetStatus] = useState<string>('paid');
  const [providerRef, setProviderRef] = useState<string>('');
  const [failureReason, setFailureReason] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  const isAdmin = isAuthenticated && user?.role === 'admin';

  const loadData = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await payoutApi.getAdminPayouts({
        status: statusFilter ? statusFilter : undefined,
        limit: 50,
      });
      setPayouts(data.payouts || []);
      setOverview(data.overview);
      if (data.overview) {
        setDefaultRateInput(data.overview.defaultCommissionRate.toString());
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to load payout management records');
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdateDefaultCommission = async () => {
    const rateNum = parseFloat(defaultRateInput);
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      setError('Commission rate must be a percentage between 0 and 100');
      return;
    }
    try {
      setIsSavingRate(true);
      setError(null);
      await payoutApi.updatePlatformCommission(rateNum);
      setSuccessMsg(`Default platform commission updated to ${rateNum}%`);
      setIsEditingDefaultRate(false);
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to update platform commission');
    } finally {
      setIsSavingRate(false);
    }
  };

  const handleSetVendorOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    const rateNum = parseFloat(vendorOverrideRate);
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      setError('Custom vendor commission rate must be between 0 and 100');
      return;
    }
    try {
      setIsSavingVendorRate(true);
      setError(null);
      await payoutApi.updateVendorCommission(vendorOverrideId, rateNum);
      setSuccessMsg(`Vendor commission override updated successfully!`);
      setVendorOverrideId('');
      setVendorOverrideRate('');
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to set vendor commission override');
    } finally {
      setIsSavingVendorRate(false);
    }
  };

  const handleApprove = async (payoutId: string) => {
    try {
      setError(null);
      await payoutApi.approvePayout(payoutId);
      setSuccessMsg('Payout request approved!');
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to approve payout request');
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingPayoutId || !rejectionReason.trim()) {
      setError('Please provide a reason for rejecting the payout request');
      return;
    }
    try {
      setIsRejecting(true);
      setError(null);
      await payoutApi.rejectPayout(rejectingPayoutId, rejectionReason.trim());
      setSuccessMsg('Payout rejected. Vendor reserved balance has been safely restored.');
      setRejectingPayoutId(null);
      setRejectionReason('');
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to reject payout');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleConfirmStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingPayout) return;

    try {
      setIsUpdatingStatus(true);
      setError(null);
      await payoutApi.updatePayoutStatus(updatingPayout._id, {
        status: targetStatus,
        providerReference: providerRef.trim() || undefined,
        failureReason: failureReason.trim() || undefined,
      });
      setSuccessMsg(`Payout status updated to ${targetStatus}`);
      setUpdatingPayout(null);
      setProviderRef('');
      setFailureReason('');
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to update payout status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'approved':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'processing':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'rejected':
      case 'failed':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'requested':
      default:
        return 'bg-amber-100 text-amber-800 border-amber-300';
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden mb-8">
      {/* Header */}
      <div className="p-6 bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold">Admin Commission & Payout Treasury</h2>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Configure platform commission rules, monitor ledger balances, and approve merchant payouts
          </p>
        </div>
        <button
          onClick={() => loadData()}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-lg border border-slate-700 transition"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 mx-6 mt-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 mx-6 mt-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-700 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-6 border-b border-slate-200 bg-slate-50">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-semibold uppercase">Platform Gross Sales</div>
          <div className="text-xl font-bold text-slate-800 mt-1">
            ₹{overview?.stats.totalGrossSales.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border-2 border-indigo-500 shadow-sm">
          <div className="text-indigo-700 text-xs font-bold uppercase flex items-center justify-between">
            <span>Commission Retained</span>
            <Percent className="w-4 h-4" />
          </div>
          <div className="text-xl font-extrabold text-indigo-700 mt-1">
            ₹{overview?.stats.totalPlatformCommission.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-semibold uppercase">Merchant Available Balances</div>
          <div className="text-xl font-bold text-emerald-600 mt-1">
            ₹{overview?.stats.totalAvailableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-semibold uppercase">Pending Withdrawals</div>
          <div className="text-xl font-bold text-purple-600 mt-1">
            ₹{overview?.stats.totalPendingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-semibold uppercase">Disbursed Payouts</div>
          <div className="text-xl font-bold text-teal-700 mt-1">
            ₹{overview?.stats.totalPaidOutAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </div>
        </div>
      </div>

      {/* Commission Configuration Toolbar */}
      <div className="p-6 bg-slate-100/70 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          <div>
            <span className="text-sm font-semibold text-slate-800">
              Global Platform Commission Rate:
            </span>
            {isEditingDefaultRate ? (
              <div className="inline-flex items-center gap-2 ml-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={defaultRateInput}
                  onChange={(e) => setDefaultRateInput(e.target.value)}
                  className="w-20 px-2 py-1 text-sm border border-slate-300 rounded font-bold"
                />
                <span className="text-sm font-bold">%</span>
                <button
                  onClick={handleUpdateDefaultCommission}
                  disabled={isSavingRate}
                  className="flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save
                </button>
                <button
                  onClick={() => setIsEditingDefaultRate(false)}
                  className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <span className="ml-2 inline-flex items-center gap-2">
                <span className="text-lg font-bold text-indigo-700">
                  {overview?.defaultCommissionRate || 10}%
                </span>
                <button
                  onClick={() => setIsEditingDefaultRate(true)}
                  className="p-1 text-slate-500 hover:text-indigo-600 rounded"
                  title="Edit Default Rate"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Vendor Override Form */}
        <form onSubmit={handleSetVendorOverride} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Vendor User ID"
            value={vendorOverrideId}
            onChange={(e) => setVendorOverrideId(e.target.value)}
            className="w-48 px-2 py-1 text-xs border border-slate-300 rounded font-mono"
            required
          />
          <input
            type="number"
            placeholder="Rate %"
            min="0"
            max="100"
            step="0.1"
            value={vendorOverrideRate}
            onChange={(e) => setVendorOverrideRate(e.target.value)}
            className="w-20 px-2 py-1 text-xs border border-slate-300 rounded"
            required
          />
          <button
            type="submit"
            disabled={isSavingVendorRate}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded shadow-sm transition"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            {isSavingVendorRate ? 'Saving...' : 'Set Override'}
          </button>
        </form>
      </div>

      {/* Filter Tabs */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase">Status:</span>
          {['', 'requested', 'approved', 'processing', 'paid', 'rejected', 'failed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === '' ? 'All Requests' : st.charAt(0).toUpperCase() + st.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Payouts Table */}
      <div className="p-6">
        {isLoading && payouts.length === 0 ? (
          <div className="flex justify-center items-center py-12 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="ml-2 text-sm">Loading payout requests...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Payout #</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Destination</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {payouts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-sm">
                      No payout requests match the selected filter.
                    </td>
                  </tr>
                ) : (
                  payouts.map((p) => {
                    const vendor = typeof p.vendorId === 'object' ? p.vendorId : null;
                    return (
                      <tr key={p._id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-mono text-xs font-bold text-slate-800 whitespace-nowrap">
                          {p.payoutNumber}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800 text-xs">
                            {vendor?.fullName || 'Vendor Merchant'}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {vendor?.email || (typeof p.vendorId === 'string' ? p.vendorId : '')}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-500">
                          {new Date(p.requestedAt || p.createdAt).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-slate-700 max-w-xs truncate">
                          {p.destinationReference}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(
                              p.payoutStatus
                            )}`}
                          >
                            {p.payoutStatus.toUpperCase()}
                          </span>
                          {p.providerReference && (
                            <div className="text-[11px] font-mono text-slate-500 mt-1">
                              Ref: {p.providerReference}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                          ₹{p.requestedAmount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {p.payoutStatus === 'requested' && (
                              <>
                                <button
                                  onClick={() => handleApprove(p._id)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow-sm transition"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => {
                                    setRejectingPayoutId(p._id);
                                    setRejectionReason('');
                                  }}
                                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded shadow-sm transition"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {['approved', 'processing'].includes(p.payoutStatus) && (
                              <button
                                onClick={() => {
                                  setUpdatingPayout(p);
                                  setTargetStatus('paid');
                                  setProviderRef(`TRF-${Date.now()}`);
                                  setFailureReason('');
                                }}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded shadow-sm transition"
                              >
                                Process / Settle
                              </button>
                            )}
                            {['paid', 'rejected', 'failed'].includes(p.payoutStatus) && (
                              <span className="text-xs text-slate-400 font-medium">Finalized</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectingPayoutId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 bg-rose-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-300" />
                <h3 className="text-lg font-bold">Reject Payout Request</h3>
              </div>
              <button
                onClick={() => setRejectingPayoutId(null)}
                className="text-rose-200 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Rejecting this payout will automatically restore the reserved funds back to the merchant's
                available balance and create an immutable audit ledger entry.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Rejection Reason (Required)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Invalid bank account details or pending verification"
                  rows={3}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectingPayoutId(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRejecting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-400 text-white font-semibold text-sm rounded-lg shadow-sm transition"
                >
                  {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process / Settle Modal */}
      {updatingPayout && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold">Process Payout #{updatingPayout.payoutNumber}</h3>
              </div>
              <button
                onClick={() => setUpdatingPayout(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmStatusUpdate} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <div><strong>Amount:</strong> ₹{updatingPayout.requestedAmount.toFixed(2)}</div>
                <div className="mt-1"><strong>Destination:</strong> {updatingPayout.destinationReference}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Target Status
                </label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="paid">Mark Paid (Settled)</option>
                  <option value="processing">Mark Processing (In-Transit)</option>
                  <option value="failed">Mark Failed (Restore Balance)</option>
                </select>
              </div>

              {targetStatus === 'paid' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Provider Transaction Reference
                  </label>
                  <input
                    type="text"
                    value={providerRef}
                    onChange={(e) => setProviderRef(e.target.value)}
                    placeholder="e.g. UTR / IMPS Ref / Razorpay X transfer ID"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              )}

              {targetStatus === 'failed' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Failure Reason
                  </label>
                  <textarea
                    value={failureReason}
                    onChange={(e) => setFailureReason(e.target.value)}
                    placeholder="e.g. Beneficiary account frozen or rejected by destination bank"
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUpdatingPayout(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingStatus}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-semibold text-sm rounded-lg shadow-sm transition"
                >
                  {isUpdatingStatus ? 'Saving...' : 'Confirm Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
