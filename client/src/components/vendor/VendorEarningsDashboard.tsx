import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  TrendingUp,
  Percent,
  Wallet,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Building,
} from 'lucide-react';
import { VendorEarningsSummary, VendorLedgerEntry, VendorPayoutRecord } from '../../types';
import { payoutApi } from '../../services/payout.api';
import { useApp } from '../../context/AppContext';

export const VendorEarningsDashboard: React.FC = () => {
  const { user, isAuthenticated } = useApp();
  const [earnings, setEarnings] = useState<VendorEarningsSummary | null>(null);
  const [transactions, setTransactions] = useState<VendorLedgerEntry[]>([]);
  const [payouts, setPayouts] = useState<VendorPayoutRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'ledger' | 'payouts'>('ledger');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Payout request modal / form state
  const [showPayoutModal, setShowPayoutModal] = useState<boolean>(false);
  const [payoutAmount, setPayoutAmount] = useState<string>('');
  const [destinationRef, setDestinationRef] = useState<string>('');
  const [isSubmittingPayout, setIsSubmittingPayout] = useState<boolean>(false);

  const isVendor = isAuthenticated && (user?.role === 'vendor' || user?.role === 'admin');

  const loadData = useCallback(async () => {
    if (!isVendor) return;
    try {
      setIsLoading(true);
      setError(null);
      const [earningsData, transData, payoutsData] = await Promise.all([
        payoutApi.getVendorEarnings(),
        payoutApi.getVendorTransactions(1, 30),
        payoutApi.getVendorPayouts(1, 30),
      ]);
      setEarnings(earningsData);
      setTransactions(transData.transactions || []);
      setPayouts(payoutsData.payouts || []);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to load earnings information');
    } finally {
      setIsLoading(false);
    }
  }, [isVendor]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(payoutAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid payout amount');
      return;
    }
    if (!destinationRef.trim()) {
      setError('Please enter a valid destination bank account or UPI ID');
      return;
    }

    try {
      setIsSubmittingPayout(true);
      setError(null);
      await payoutApi.requestPayout({
        amount: amountNum,
        destinationReference: destinationRef.trim(),
      });
      setSuccessMsg(`Payout request for ₹${amountNum.toFixed(2)} submitted successfully!`);
      setShowPayoutModal(false);
      setPayoutAmount('');
      setDestinationRef('');
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to submit payout request');
    } finally {
      setIsSubmittingPayout(false);
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

  if (!isVendor) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden mb-8">
      {/* Header */}
      <div className="p-6 bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold">Vendor Earnings & Payout Console</h2>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Real-time balance, automated platform fee reconciliation & payout ledger
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              setError(null);
              setSuccessMsg(null);
              setShowPayoutModal(true);
            }}
            disabled={!earnings || earnings.availableBalance <= 0}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <ArrowUpRight className="w-4 h-4" />
            Request Payout
          </button>
        </div>
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

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 p-6 border-b border-slate-200 bg-slate-50">
        {/* Gross Sales */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Gross Sales</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-800">
            ₹{earnings ? earnings.totalGrossSales.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="text-xs text-slate-400 mt-1">Total revenue processed</div>
        </div>

        {/* Platform Commission */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Commission</span>
            <Percent className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600">
            ₹{earnings ? earnings.totalCommission.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Rate: {earnings ? `${earnings.effectiveCommissionRate}%` : '10%'}
          </div>
        </div>

        {/* Net Sales */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Net Earnings</span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-indigo-600">
            ₹{earnings ? earnings.netEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="text-xs text-slate-400 mt-1">Gross − Platform Fees</div>
        </div>

        {/* Available Balance */}
        <div className="bg-white p-4 rounded-xl border-2 border-emerald-500 shadow-sm">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Available</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold text-emerald-700">
            ₹{earnings ? earnings.availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="text-xs text-emerald-600 font-medium mt-1">Ready for withdrawal</div>
        </div>

        {/* Pending Payouts */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Locked / Pending</span>
            <Clock className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold text-purple-600">
            ₹{earnings ? earnings.pendingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {earnings?.pendingPayoutsCount || 0} active request(s)
          </div>
        </div>

        {/* Paid Out */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Disbursed</span>
            <CheckCircle2 className="w-4 h-4 text-teal-500" />
          </div>
          <div className="text-xl font-bold text-teal-700">
            ₹{earnings ? earnings.paidOutAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="text-xs text-slate-400 mt-1">Settled to bank/UPI</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 px-6 pt-4 bg-white">
        <button
          onClick={() => setActiveTab('ledger')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition ${
            activeTab === 'ledger'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Transaction Ledger ({transactions.length})
        </button>
        <button
          onClick={() => setActiveTab('payouts')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition ${
            activeTab === 'payouts'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Payout History ({payouts.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {isLoading && transactions.length === 0 ? (
          <div className="flex justify-center items-center py-12 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="ml-2 text-sm">Loading ledger history...</span>
          </div>
        ) : activeTab === 'ledger' ? (
          /* Ledger Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">
                      No financial transactions recorded yet. Completed orders will appear here automatically.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx._id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-500">
                        {new Date(tx.createdAt).toLocaleString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            tx.direction === 'credit'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {tx.direction === 'credit' ? (
                            <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3 text-rose-600" />
                          )}
                          {tx.transactionType.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-800">
                        {tx.reference || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs max-w-xs truncate" title={tx.description}>
                        {tx.description}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-semibold whitespace-nowrap ${
                          tx.direction === 'credit' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {tx.direction === 'credit' ? '+' : '-'}₹{tx.amount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-700 whitespace-nowrap">
                        ₹{tx.balanceAfter.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Payouts Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Payout #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Destination</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Provider Ref</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {payouts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">
                      No payout requests filed yet. Click "Request Payout" above when you have available funds.
                    </td>
                  </tr>
                ) : (
                  payouts.map((p) => (
                    <tr key={p._id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono text-xs font-bold text-slate-800 whitespace-nowrap">
                        {p.payoutNumber}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-500">
                        {new Date(p.requestedAt || p.createdAt).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-700">
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
                        {p.rejectionReason && (
                          <div className="text-[11px] text-rose-600 mt-1">
                            Reason: {p.rejectionReason}
                          </div>
                        )}
                        {p.failureReason && (
                          <div className="text-[11px] text-rose-600 mt-1">
                            Failure: {p.failureReason}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500">
                        {p.providerReference || 'Pending Assignment'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                        ₹{p.requestedAmount.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payout Request Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold">Request Balance Withdrawal</h3>
              </div>
              <button
                onClick={() => setShowPayoutModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRequestPayout} className="p-6 space-y-4">
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-800">
                <strong>Available to withdraw:</strong> ₹
                {earnings?.availableBalance.toFixed(2) || '0.00'} (Min withdrawal: ₹
                {earnings?.minPayoutAmount || 100})
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Withdrawal Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min={earnings?.minPayoutAmount || 1}
                    max={earnings?.availableBalance || 0}
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    placeholder="Enter amount"
                    required
                    className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Destination (Bank Account or UPI ID)
                </label>
                <input
                  type="text"
                  value={destinationRef}
                  onChange={(e) => setDestinationRef(e.target.value)}
                  placeholder="e.g. 9876543210@paytm or AC: 1234567890 IFSC: HDFC0001234"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Funds will be reserved from your available balance immediately upon submission.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayout}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-semibold text-sm rounded-lg shadow-sm transition"
                >
                  {isSubmittingPayout ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Confirm Withdrawal'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

