import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Star,
  CheckCircle2,
  XCircle,
  EyeOff,
  Trash2,
  Filter,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { AdminReviewItem, ReviewModerationStatus } from '../../types';
import { reviewApi } from '../../services/review.api';
import { useApp } from '../../context/AppContext';

export const AdminReviewsModerator: React.FC = () => {
  const { user, isAuthenticated } = useApp();
  const [reviews, setReviews] = useState<AdminReviewItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReviewModerationStatus | ''>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Reject / Reason Modal
  const [rejectingReview, setRejectingReview] = useState<AdminReviewItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  const isAdmin = isAuthenticated && user?.role === 'admin';

  const loadReviews = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await reviewApi.adminListReviews({
        status: statusFilter ? statusFilter : undefined,
        page: currentPage,
        limit: 15,
      });
      setReviews(data.reviews || []);
      setTotalPages(data.pagination.pages || 1);
      setTotalCount(data.pagination.total || 0);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to load reviews for moderation');
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, statusFilter, currentPage]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const handleUpdateStatus = async (
    reviewId: string,
    status: ReviewModerationStatus,
    reason?: string
  ) => {
    try {
      setError(null);
      await reviewApi.adminUpdateStatus(reviewId, status, reason);
      setSuccessMsg(`Review marked as '${status}'`);
      await loadReviews();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to update review status');
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingReview) return;
    try {
      setIsRejecting(true);
      setError(null);
      await reviewApi.adminUpdateStatus(
        rejectingReview.id || rejectingReview._id,
        'rejected',
        rejectionReason.trim() || undefined
      );
      setSuccessMsg('Review rejected successfully');
      setRejectingReview(null);
      setRejectionReason('');
      await loadReviews();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to reject review');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this review?')) return;
    try {
      setError(null);
      await reviewApi.adminDeleteReview(reviewId);
      setSuccessMsg('Review permanently deleted');
      await loadReviews();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to delete review');
    }
  };

  const getStatusBadge = (status: ReviewModerationStatus) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'hidden':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'rejected':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'pending':
      default:
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
      {/* Header */}
      <div className="p-6 bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold">Product Review Moderation Console</h2>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Review customer feedback, approve verified ratings, and hide or remove policy-violating comments
          </p>
        </div>
        <button
          onClick={() => loadReviews()}
          disabled={isLoading}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 mx-6 mt-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 mx-6 mt-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-emerald-800 text-xs">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase">Status:</span>
          {(['', 'pending', 'approved', 'hidden', 'rejected'] as const).map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {st === '' ? 'All Reviews' : st.charAt(0).toUpperCase() + st.slice(1)}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">
          Showing <strong>{reviews.length}</strong> of <strong>{totalCount}</strong> reviews
        </span>
      </div>

      {/* Reviews Table */}
      <div className="p-6">
        {isLoading && reviews.length === 0 ? (
          <div className="flex justify-center items-center py-12 text-slate-400 space-x-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-xs">Loading reviews...</span>
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            No customer reviews found matching the current moderation filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 uppercase font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Reviewer</th>
                  <th className="py-3 px-4">Rating</th>
                  <th className="py-3 px-4">Content</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Helpful</th>
                  <th className="py-3 px-4 text-center">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {reviews.map((rev) => {
                  const revId = rev.id || rev._id;
                  return (
                    <tr key={revId} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 max-w-[180px]">
                        <div className="font-bold text-slate-900 truncate">
                          {rev.product?.name || `Product: ${rev.productId}`}
                        </div>
                        {rev.product?.price && (
                          <div className="text-slate-400 text-[11px]">
                            ${Number(rev.product.price).toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">
                          {rev.user?.name || rev.author?.name || 'Verified Customer'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {rev.user?.email || rev.userId}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3 h-3 ${
                                rev.rating >= s
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-200'
                              }`}
                            />
                          ))}
                          <span className="font-bold text-slate-700 ml-1">
                            {rev.rating}/5
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold text-slate-800 truncate">{rev.title}</div>
                        <div
                          className="text-[11px] text-slate-500 line-clamp-2 mt-0.5"
                          title={rev.comment}
                        >
                          {rev.comment}
                        </div>
                        {rev.moderationReason && (
                          <div className="text-[10px] text-rose-600 mt-1 italic">
                            Mod Note: {rev.moderationReason}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getStatusBadge(
                            rev.moderationStatus
                          )}`}
                        >
                          {rev.moderationStatus.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-semibold">
                        {rev.helpfulCount}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          {rev.moderationStatus !== 'approved' && (
                            <button
                              onClick={() => handleUpdateStatus(revId, 'approved')}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition"
                              title="Approve review for public display"
                            >
                              Approve
                            </button>
                          )}
                          {rev.moderationStatus !== 'hidden' && (
                            <button
                              onClick={() => handleUpdateStatus(revId, 'hidden')}
                              className="p-1 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded transition"
                              title="Hide from public page"
                            >
                              <EyeOff className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {rev.moderationStatus !== 'rejected' && (
                            <button
                              onClick={() => {
                                setRejectingReview(rev);
                                setRejectionReason('');
                              }}
                              className="p-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                              title="Reject review"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteReview(revId)}
                            className="p-1 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded transition"
                            title="Delete permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 text-xs">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="px-3 py-1 rounded-lg border border-slate-200 text-slate-700 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-slate-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="px-3 py-1 rounded-lg border border-slate-200 text-slate-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectingReview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-rose-900 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <XCircle className="w-5 h-5 text-rose-300" />
                <h3 className="text-base font-bold">Reject Review</h3>
              </div>
              <button
                onClick={() => setRejectingReview(null)}
                className="text-rose-200 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Rejecting this review will remove it from public ratings and exclude it from average
                score calculations.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Reason for Rejection
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Inappropriate language, spam, or promotional content"
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectingReview(null)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRejecting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-400 text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
