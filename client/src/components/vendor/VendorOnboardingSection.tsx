import React, { useState, useEffect, useCallback } from 'react';
import {
  Store,
  Clock,
  CheckCircle,
  Send,
  Loader2,
  RefreshCw,
  AlertCircle,
  Building2,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { authApi } from '../../services/auth.api';

export const VendorOnboardingSection: React.FC = () => {
  const { user, isAuthenticated, refreshUser, openAuthModal } = useApp();

  // Application form state
  const [storeName, setStoreName] = useState('');
  const [description, setDescription] = useState('');
  const [businessEmail, setBusinessEmail] = useState(user?.email || '');
  const [businessPhone, setBusinessPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('United States');

  // Application status state
  const [applicationStatus, setApplicationStatus] = useState<any>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setApplicationStatus(null);
      return;
    }
    setIsLoadingStatus(true);
    try {
      const res = await authApi.getVendorStatus();
      setApplicationStatus(res.data);
    } catch {
      setApplicationStatus(null);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStatus();
      if (user?.email && !businessEmail) {
        setBusinessEmail(user.email);
      }
    }
  }, [isAuthenticated, user, fetchStatus, businessEmail]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      openAuthModal('register');
      return;
    }

    setApplyLoading(true);
    setApplyError(null);
    setApplySuccess(null);

    try {
      await authApi.applyVendor({
        storeName: storeName.trim(),
        description: description.trim(),
        businessEmail: businessEmail.trim(),
        businessPhone: businessPhone.trim(),
        businessAddress: {
          street: street.trim(),
          city: city.trim(),
          state: state.trim(),
          postalCode: postalCode.trim(),
          country: country.trim(),
        },
      });

      setApplySuccess('Your merchant application has been submitted for verification. We review applications within 24 hours.');
      await fetchStatus();
      await refreshUser();
    } catch (err: any) {
      setApplyError(
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Failed to submit vendor application. Please check all required fields.'
      );
    } finally {
      setApplyLoading(false);
    }
  };

  // If already approved vendor
  if (user?.role === 'vendor' || applicationStatus?.status === 'approved') {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-900">
                  {applicationStatus?.storeName || 'Verified Merchant Store'}
                </h2>
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                  <CheckCircle className="w-3.5 h-3.5 mr-0.5" />
                  <span>Verified Seller</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Your store is active on NexusMarket. Manage orders, inventory, and payouts below.
              </p>
            </div>
          </div>

          <button
            onClick={fetchStatus}
            disabled={isLoadingStatus}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStatus ? 'animate-spin' : ''}`} />
            <span>Sync Store</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 space-y-1">
            <div className="text-slate-500 font-medium">Platform Commission</div>
            <div className="text-base font-bold text-slate-900">8.0% Standard</div>
            <div className="text-[11px] text-emerald-600 font-semibold">Tier 1 Verified Merchant</div>
          </div>
          <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 space-y-1">
            <div className="text-slate-500 font-medium">Payout Settlement</div>
            <div className="text-base font-bold text-slate-900">T+1 Automated</div>
            <div className="text-[11px] text-slate-500">Razorpay & Bank Transfer</div>
          </div>
          <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 space-y-1">
            <div className="text-slate-500 font-medium">Fulfillment SLA</div>
            <div className="text-base font-bold text-slate-900">48-Hour Dispatch</div>
            <div className="text-[11px] text-slate-500">Tracked shipping required</div>
          </div>
        </div>
      </div>
    );
  }

  // If application is pending
  if (applicationStatus?.status === 'pending') {
    return (
      <div className="bg-white rounded-3xl border border-amber-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          <div className="space-y-2 flex-1">
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-slate-900">Application Under Verification</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold uppercase">
                Pending Review
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
              Thank you for applying to sell on NexusMarket! Our merchant onboarding compliance team is reviewing your business documentation. Approvals typically complete within 24 business hours.
            </p>

            <div className="mt-4 p-4 rounded-2xl bg-amber-50/50 border border-amber-200/60 max-w-xl grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Registered Store:</span>
                <span className="font-semibold text-slate-900">{applicationStatus.storeName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Submitted On:</span>
                <span className="font-semibold text-slate-900">
                  {applicationStatus.createdAt ? new Date(applicationStatus.createdAt).toLocaleDateString() : 'Today'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={fetchStatus}
            disabled={isLoadingStatus}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStatus ? 'animate-spin' : ''}`} />
            <span>Check Status</span>
          </button>
        </div>
      </div>
    );
  }

  // Form to apply for merchant account
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Merchant Store Onboarding
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Launch your official brand storefront on NexusMarket and reach thousands of verified technology shoppers.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/60">
            8% Low Commission Rate
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Perks & Highlights */}
        <div className="lg:col-span-5 space-y-5">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Why Sell on NexusMarket?
          </h3>

          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-xs font-bold">
                1
              </div>
              <div className="text-xs">
                <div className="font-bold text-slate-900">Unified Multi-Vendor Cart</div>
                <div className="text-slate-600 leading-relaxed mt-0.5">
                  Shoppers purchase from multiple sellers in one transaction. Orders automatically split to your seller ledger.
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-xs font-bold">
                2
              </div>
              <div className="text-xs">
                <div className="font-bold text-slate-900">Escrow Payment Security</div>
                <div className="text-slate-600 leading-relaxed mt-0.5">
                  100% guaranteed settlement via Razorpay upon verified shipment delivery. Zero chargeback fraud risk.
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-xs font-bold">
                3
              </div>
              <div className="text-xs">
                <div className="font-bold text-slate-900">Elasticsearch Catalog Visibility</div>
                <div className="text-slate-600 leading-relaxed mt-0.5">
                  High-speed faceted discovery, brand filters, and instant keyword suggestions for maximum conversion.
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
            <div className="flex items-center space-x-2 text-slate-900 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Seller Verification Requirements</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Valid business registration or authorized reseller documentation, active phone number, and physical dispatch address.
            </p>
          </div>
        </div>

        {/* Right: Registration Form */}
        <div className="lg:col-span-7 bg-slate-50/70 p-6 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Store Information
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">All fields required</span>
          </div>

          {applySuccess && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{applySuccess}</span>
            </div>
          )}

          {applyError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{applyError}</span>
            </div>
          )}

          <form onSubmit={handleApply} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Store / Brand Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Digital Electronics"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Business Phone</label>
                <input
                  type="text"
                  required
                  placeholder="+1 (555) 019-2834"
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Business Contact Email</label>
              <input
                type="email"
                required
                placeholder="contact@brand.com"
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Store Description & Specialties</label>
              <textarea
                rows={2}
                placeholder="Describe your catalog (e.g. Premium audiophile headphones, custom mechanical keyboards, studio monitors)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Dispatch / Fulfillment Street Address</label>
              <input
                type="text"
                required
                placeholder="100 Silicon Way, Suite 400"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  required
                  placeholder="San Jose"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">State / Province</label>
                <input
                  type="text"
                  required
                  placeholder="California"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Postal Code</label>
                <input
                  type="text"
                  required
                  placeholder="95110"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Country</label>
                <input
                  type="text"
                  required
                  placeholder="United States"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={applyLoading}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-xs"
              >
                {applyLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Store Application for Verification</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
