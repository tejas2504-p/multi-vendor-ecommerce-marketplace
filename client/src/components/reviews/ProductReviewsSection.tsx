import React, { useState, useEffect, useCallback } from 'react';
import {
  Star,
  ThumbsUp,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Edit2,
  Trash2,
  MessageSquare,
  Plus,
  X,
  Filter,
} from 'lucide-react';
import {
  ReviewItem,
  ProductReviewSummary,
  ReviewEligibility,
} from '../../types';
import { reviewApi } from '../../services/review.api';
import { useApp } from '../../context/AppContext';

interface ProductReviewsSectionProps {
  productId: string;
  productName?: string;
}

export const ProductReviewsSection: React.FC<ProductReviewsSectionProps> = ({
  productId,
  productName,
}) => {
  const { user, isAuthenticated, openAuthModal } = useApp();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<ProductReviewSummary>({
    averageRating: 0,
    reviewCount: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);

  // Filter & Pagination state
  const [selectedRating, setSelectedRating] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<string>('newest');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Review Form modal state
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingReview, setEditingReview] = useState<ReviewItem | null>(null);
  const [formRating, setFormRating] = useState<number>(5);
  const [formHoverRating, setFormHoverRating] = useState<number>(0);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formComment, setFormComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Voting loading tracker
  const [votingReviewId, setVotingReviewId] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await reviewApi.getProductReviews(productId, {
        rating: selectedRating,
        sort: sortBy,
        page: currentPage,
        limit: 8,
      });

      setReviews(data.reviews || []);
      setSummary(data.summary);
      setTotalPages(data.pagination.pages || 1);
      if (data.userEligibility !== undefined) {
        setEligibility(data.userEligibility);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to load reviews');
    } finally {
      setIsLoading(false);
    }
  }, [productId, selectedRating, sortBy, currentPage]);

  const checkEligibility = useCallback(async () => {
    if (!isAuthenticated) {
      setEligibility(null);
      return;
    }
    try {
      const data = await reviewApi.checkEligibility(productId);
      setEligibility(data);
    } catch {
      setEligibility(null);
    }
  }, [productId, isAuthenticated]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    checkEligibility();
  }, [checkEligibility]);

  const handleOpenCreateForm = () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    setEditingReview(null);
    setFormRating(5);
    setFormTitle('');
    setFormComment('');
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (review: ReviewItem) => {
    setEditingReview(review);
    setFormRating(review.rating);
    setFormTitle(review.title);
    setFormComment(review.comment);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formRating < 1 || formRating > 5) {
      setFormError('Please select a rating between 1 and 5 stars');
      return;
    }
    if (!formTitle.trim()) {
      setFormError('Please enter a review title');
      return;
    }
    if (formComment.trim().length < 5) {
      setFormError('Comment must be at least 5 characters long');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      if (editingReview) {
        await reviewApi.updateReview(editingReview.id || editingReview._id, {
          rating: formRating,
          title: formTitle.trim(),
          comment: formComment.trim(),
        });
        setSuccessMessage('Your review was updated successfully!');
      } else {
        await reviewApi.createReview(productId, {
          rating: formRating,
          title: formTitle.trim(),
          comment: formComment.trim(),
        });
        setSuccessMessage('Thank you! Your verified review has been published.');
      }

      setIsFormOpen(false);
      await loadReviews();
      await checkEligibility();
    } catch (err: any) {
      setFormError(err?.response?.data?.error?.message || 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm('Are you sure you want to delete this review?')) return;
    try {
      await reviewApi.deleteReview(reviewId);
      setSuccessMessage('Review deleted successfully');
      await loadReviews();
      await checkEligibility();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to delete review');
    }
  };

  const handleVoteHelpful = async (reviewId: string) => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    try {
      setVotingReviewId(reviewId);
      const res = await reviewApi.voteHelpful(reviewId);
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId || r._id === reviewId
            ? { ...r, helpfulCount: res.helpfulCount, hasVotedHelpful: res.voted }
            : r
        )
      );
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Unable to register helpful vote');
    } finally {
      setVotingReviewId(null);
    }
  };

  // Helper to render star rating icons
  const renderStars = (rating: number, interactive = false) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = interactive
            ? (formHoverRating || formRating) >= star
            : rating >= star;
          return (
            <Star
              key={star}
              className={`w-4 h-4 ${
                filled
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-slate-300'
              } ${
                interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''
              }`}
              onClick={interactive ? () => setFormRating(star) : undefined}
              onMouseEnter={interactive ? () => setFormHoverRating(star) : undefined}
              onMouseLeave={interactive ? () => setFormHoverRating(0) : undefined}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 pt-6 border-t border-slate-200">
      {/* Header & Write Review Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-900">Customer Reviews & Ratings</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified feedback from customers who purchased {productName || 'this product'}
          </p>
        </div>

        <div>
          {eligibility?.alreadyReviewed ? (
            <div className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>You have reviewed this product</span>
            </div>
          ) : eligibility?.eligible ? (
            <button
              onClick={handleOpenCreateForm}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Write a Review</span>
            </button>
          ) : (
            <div
              className="text-xs text-slate-400 italic bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/60"
              title={eligibility?.reason || 'Verified purchase required'}
            >
              {eligibility?.reason || 'Verified delivery required to review'}
            </div>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Rating Summary Breakdown Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Average Score */}
        <div className="text-center md:border-r md:border-slate-200 md:pr-6 space-y-2">
          <div className="text-4xl font-extrabold text-slate-900 tracking-tight">
            {summary.averageRating > 0 ? summary.averageRating.toFixed(1) : '0.0'}
          </div>
          <div className="flex justify-center">
            {renderStars(Math.round(summary.averageRating))}
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Based on {summary.reviewCount} {summary.reviewCount === 1 ? 'review' : 'reviews'}
          </div>
        </div>

        {/* Rating Distribution Bars */}
        <div className="md:col-span-2 space-y-1.5">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = summary.ratingDistribution[stars as keyof typeof summary.ratingDistribution] || 0;
            const percentage = summary.reviewCount > 0 ? (count / summary.reviewCount) * 100 : 0;
            const isFilterActive = selectedRating === stars;

            return (
              <div
                key={stars}
                onClick={() => {
                  setSelectedRating(isFilterActive ? undefined : stars);
                  setCurrentPage(1);
                }}
                className={`flex items-center space-x-3 text-xs cursor-pointer p-1 rounded-lg transition ${
                  isFilterActive ? 'bg-indigo-50 font-bold' : 'hover:bg-slate-100'
                }`}
              >
                <div className="w-12 text-slate-600 font-medium flex items-center space-x-1">
                  <span>{stars}</span>
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                </div>
                <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="w-12 text-right text-slate-500 text-[11px]">
                  {count} ({Math.round(percentage)}%)
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter and Sorting Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white py-2">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase">Filter:</span>
          <button
            onClick={() => {
              setSelectedRating(undefined);
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              selectedRating === undefined
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Ratings
          </button>
          {[5, 4, 3, 2, 1].map((st) => (
            <button
              key={st}
              onClick={() => {
                setSelectedRating(st);
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center space-x-1 transition ${
                selectedRating === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{st}</span>
              <Star className="w-3 h-3 fill-current" />
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-500 uppercase">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setCurrentPage(1);
            }}
            className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-xl bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="highest_rated">Highest Rating</option>
            <option value="lowest_rated">Lowest Rating</option>
            <option value="most_helpful">Most Helpful</option>
          </select>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center items-center py-12 text-slate-400 space-x-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-xs">Loading customer reviews...</span>
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
            <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="font-bold text-sm text-slate-700">No reviews yet</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {selectedRating
                ? `No ${selectedRating}-star reviews match the selected filter.`
                : 'Be the first verified customer to share your experience with this item.'}
            </p>
          </div>
        ) : (
          reviews.map((rev) => (
            <div
              key={rev.id || rev._id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 hover:border-slate-300 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {rev.author?.name || 'Verified Customer'}
                    </span>
                    {rev.isVerifiedPurchase && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>Verified Purchase</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {renderStars(rev.rating)}
                    <span className="text-[11px] text-slate-400">
                      {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {/* Edit / Delete Controls for Author or Admin */}
                {(rev.isAuthor || user?.role === 'admin') && (
                  <div className="flex items-center space-x-1">
                    {rev.isAuthor && (
                      <button
                        onClick={() => handleOpenEditForm(rev)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition"
                        title="Edit Review"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteReview(rev.id || rev._id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition"
                      title="Delete Review"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Title & Comment */}
              <div className="space-y-1">
                <h4 className="font-bold text-slate-800 text-sm">{rev.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                  {rev.comment}
                </p>
              </div>

              {/* Helpful Voting Button */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <button
                  onClick={() => handleVoteHelpful(rev.id || rev._id)}
                  disabled={votingReviewId === (rev.id || rev._id) || rev.isAuthor}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg border text-xs font-semibold transition ${
                    rev.hasVotedHelpful
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  } disabled:opacity-50`}
                >
                  <ThumbsUp
                    className={`w-3.5 h-3.5 ${
                      rev.hasVotedHelpful ? 'text-indigo-600 fill-indigo-600' : 'text-slate-400'
                    }`}
                  />
                  <span>Helpful ({rev.helpfulCount})</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200 text-xs">
          <button
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-slate-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* Write / Edit Review Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <h3 className="text-base font-bold">
                  {editingReview ? 'Edit Your Review' : 'Write a Verified Review'}
                </h3>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReview} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Star Rating Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Overall Rating
                </label>
                <div className="flex items-center space-x-3">
                  {renderStars(formRating, true)}
                  <span className="text-xs font-bold text-slate-700">
                    {formHoverRating || formRating} of 5 Stars
                  </span>
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Review Headline
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Excellent build quality and fast performance"
                  required
                  maxLength={120}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Comment Textarea */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Review Details
                </label>
                <textarea
                  value={formComment}
                  onChange={(e) => setFormComment(e.target.value)}
                  placeholder="What did you like or dislike about this product? How was the delivery?"
                  rows={4}
                  required
                  minLength={5}
                  maxLength={2000}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <div className="text-[11px] text-slate-400 text-right mt-1">
                  {formComment.length} / 2000 characters
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center space-x-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>{editingReview ? 'Save Changes' : 'Submit Review'}</span>
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

