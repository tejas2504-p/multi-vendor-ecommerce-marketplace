import React, { useState, useEffect, useCallback } from 'react';
import {
  Tag,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  Loader2,
  Edit2,
  Trash2,
  X,
  RefreshCw,
  Power,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { couponApi } from '../../services/coupon.api';
import { Coupon, CreateCouponPayload, UpdateCouponPayload } from '../../types';

export const AdminCouponsManager: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form states
  const [code, setCode] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(10);
  const [maximumDiscountAmount, setMaximumDiscountAmount] = useState<number | ''>('');
  const [minimumOrderAmount, setMinimumOrderAmount] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState<string>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [totalUsageLimit, setTotalUsageLimit] = useState<number | ''>('');
  const [perUserUsageLimit, setPerUserUsageLimit] = useState<number>(1);
  const [isActive, setIsActive] = useState<boolean>(true);

  const fetchCoupons = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await couponApi.adminGetCoupons({
        page,
        limit: 10,
        search: search.trim() || undefined,
        status: statusFilter,
      });
      setCoupons(res.coupons);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to load marketplace coupons');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const handleOpenCreateModal = () => {
    setCode('');
    setDescription('');
    setDiscountType('percentage');
    setDiscountValue(10);
    setMaximumDiscountAmount('');
    setMinimumOrderAmount(0);
    setStartDate(new Date().toISOString().split('T')[0]);
    setExpiryDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setTotalUsageLimit('');
    setPerUserUsageLimit(1);
    setIsActive(true);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setCode(coupon.code);
    setDescription(coupon.description);
    setDiscountType(coupon.discountType);
    setDiscountValue(coupon.discountValue);
    setMaximumDiscountAmount(coupon.maximumDiscountAmount ?? '');
    setMinimumOrderAmount(coupon.minimumOrderAmount);
    setStartDate(new Date(coupon.startDate).toISOString().split('T')[0]);
    setExpiryDate(new Date(coupon.expiryDate).toISOString().split('T')[0]);
    setTotalUsageLimit(coupon.totalUsageLimit ?? '');
    setPerUserUsageLimit(coupon.perUserUsageLimit);
    setIsActive(coupon.isActive);
    setIsEditModalOpen(true);
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);
      const payload: CreateCouponPayload = {
        code: code.trim().toUpperCase(),
        description: description.trim(),
        discountType,
        discountValue: Number(discountValue),
        maximumDiscountAmount: maximumDiscountAmount !== '' ? Number(maximumDiscountAmount) : undefined,
        minimumOrderAmount: Number(minimumOrderAmount) || 0,
        startDate: new Date(startDate).toISOString(),
        expiryDate: new Date(expiryDate).toISOString(),
        totalUsageLimit: totalUsageLimit !== '' ? Number(totalUsageLimit) : undefined,
        perUserUsageLimit: Number(perUserUsageLimit) || 1,
        isActive,
      };

      await couponApi.adminCreateCoupon(payload);
      setSuccessMessage(`Coupon "${payload.code}" created successfully!`);
      setTimeout(() => setSuccessMessage(null), 4000);
      setIsCreateModalOpen(false);
      fetchCoupons();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to create coupon');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoupon) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const payload: UpdateCouponPayload = {
        code: code.trim().toUpperCase(),
        description: description.trim(),
        discountType,
        discountValue: Number(discountValue),
        maximumDiscountAmount: maximumDiscountAmount !== '' ? Number(maximumDiscountAmount) : undefined,
        minimumOrderAmount: Number(minimumOrderAmount) || 0,
        startDate: new Date(startDate).toISOString(),
        expiryDate: new Date(expiryDate).toISOString(),
        totalUsageLimit: totalUsageLimit !== '' ? Number(totalUsageLimit) : undefined,
        perUserUsageLimit: Number(perUserUsageLimit) || 1,
        isActive,
      };

      await couponApi.adminUpdateCoupon(editingCoupon.id || (editingCoupon as any)._id, payload);
      setSuccessMessage(`Coupon "${payload.code}" updated successfully!`);
      setTimeout(() => setSuccessMessage(null), 4000);
      setIsEditModalOpen(false);
      fetchCoupons();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to update coupon');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (coupon: Coupon) => {
    try {
      setError(null);
      await couponApi.adminUpdateCoupon(coupon.id || (coupon as any)._id, {
        isActive: !coupon.isActive,
      });
      setSuccessMessage(
        `Coupon "${coupon.code}" ${coupon.isActive ? 'deactivated' : 'activated'} successfully!`
      );
      setTimeout(() => setSuccessMessage(null), 3000);
      fetchCoupons();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to update coupon status');
    }
  };

  const handleDeleteCoupon = async (coupon: Coupon) => {
    if (!window.confirm(`Are you sure you want to delete or deactivate coupon "${coupon.code}"?`)) {
      return;
    }

    try {
      setError(null);
      const res = await couponApi.adminDeleteCoupon(coupon.id || (coupon as any)._id);
      setSuccessMessage(res.message);
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchCoupons();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to delete coupon');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Marketplace Coupons & Promotion Engine
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure discount rules, set customer usage caps, and manage marketing promotional codes.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={fetchCoupons}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            title="Refresh coupons"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 flex items-center space-x-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Coupon</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2.5 text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-2.5 text-emerald-700 text-xs">
          <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by code or description..."
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
          />
        </div>

        <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'active', 'inactive', 'expired'] as const).map((status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition ${
                statusFilter === status
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Coupons Table */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400 space-y-2">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-xs">Loading coupons...</span>
        </div>
      ) : coupons.length === 0 ? (
        <div className="py-12 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-3">
          <Tag className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs text-slate-500">No coupons match your filter criteria.</p>
          <button
            onClick={handleOpenCreateModal}
            className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition"
          >
            Create first coupon
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Code & Description</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Limits & Minimum</th>
                <th className="px-4 py-3">Redemptions</th>
                <th className="px-4 py-3">Validity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {coupons.map((coupon) => {
                const now = new Date();
                const isExpired = new Date(coupon.expiryDate) < now;
                const isUpcoming = new Date(coupon.startDate) > now;

                return (
                  <tr key={coupon.id || (coupon as any)._id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                          {coupon.code}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                        {coupon.description}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-extrabold text-slate-900">
                          {coupon.discountType === 'percentage'
                            ? `${coupon.discountValue}% OFF`
                            : `$${coupon.discountValue.toFixed(2)} OFF`}
                        </span>
                      </div>
                      {coupon.maximumDiscountAmount && (
                        <p className="text-[10px] text-slate-500">
                          Max cap: ${coupon.maximumDiscountAmount.toFixed(2)}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3 text-[11px] text-slate-600 space-y-0.5">
                      <div>
                        Min Order:{' '}
                        <span className="font-bold text-slate-900">
                          ${coupon.minimumOrderAmount.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        Per User:{' '}
                        <span className="font-bold text-slate-900">
                          {coupon.perUserUsageLimit}x
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-1 font-bold text-slate-900">
                        <span>{coupon.usageCount}</span>
                        <span className="text-slate-400 font-normal">
                          / {coupon.totalUsageLimit ? coupon.totalUsageLimit : '∞'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">total uses</p>
                    </td>

                    <td className="px-4 py-3 text-[11px] text-slate-500">
                      <div>
                        Start: {new Date(coupon.startDate).toLocaleDateString()}
                      </div>
                      <div>
                        Exp: {new Date(coupon.expiryDate).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {isExpired ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Expired
                        </span>
                      ) : isUpcoming ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                          Scheduled
                        </span>
                      ) : coupon.isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          Inactive
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => handleToggleActive(coupon)}
                          className={`p-1.5 rounded-lg transition ${
                            coupon.isActive
                              ? 'text-amber-600 hover:bg-amber-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={coupon.isActive ? 'Deactivate coupon' : 'Activate coupon'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(coupon)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Edit coupon"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCoupon(coupon)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete coupon"
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
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500">
            Showing Page <span className="font-bold text-slate-900">{page}</span> of{' '}
            <span className="font-bold text-slate-900">{totalPages}</span> ({total} total coupons)
          </p>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {(isCreateModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2">
                <Tag className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  {isCreateModalOpen ? 'Create New Coupon' : 'Edit Coupon'}
                </h4>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={isCreateModalOpen ? handleCreateCoupon : handleUpdateCoupon}
              className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Coupon Code *</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. FLASH30"
                    className="w-full font-mono uppercase font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Discount Type *</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-semibold"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ($)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description *</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. 20% off all catalog items this weekend"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Discount Value {discountType === 'percentage' ? '(%) *' : '($) *'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={discountType === 'percentage' ? '100' : undefined}
                    required
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Max Discount Cap ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={maximumDiscountAmount}
                    onChange={(e) =>
                      setMaximumDiscountAmount(e.target.value ? Number(e.target.value) : '')
                    }
                    placeholder="Optional cap (e.g. 50)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Minimum Order Subtotal ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={minimumOrderAmount}
                    onChange={(e) => setMinimumOrderAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Per-User Usage Limit *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={perUserUsageLimit}
                    onChange={(e) => setPerUserUsageLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Expiry Date *</label>
                  <input
                    type="date"
                    required
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Global Total Usage Limit
                </label>
                <input
                  type="number"
                  min="1"
                  value={totalUsageLimit}
                  onChange={(e) =>
                    setTotalUsageLimit(e.target.value ? Number(e.target.value) : '')
                  }
                  placeholder="Leave empty for unlimited redemptions"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveCoupon"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <label htmlFor="isActiveCoupon" className="font-bold text-slate-700 cursor-pointer">
                  Coupon is active and redeemable immediately
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-500/20 flex items-center space-x-1.5 transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{isCreateModalOpen ? 'Create Coupon' : 'Save Changes'}</span>
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
