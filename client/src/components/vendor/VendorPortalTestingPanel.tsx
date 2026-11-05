import React, { useState, useEffect, useCallback } from 'react';
import {
  Store,
  Clock,
  CheckCircle,
  XCircle,
  ShieldCheck,
  Send,
  Loader2,
  RefreshCw,
  LayoutDashboard,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { authApi } from '../../services/auth.api';

export const VendorPortalTestingPanel: React.FC = () => {
  const { user, isAuthenticated, refreshUser } = useApp();

  // Application form state
  const [storeName, setStoreName] = useState('Apex Digital Electronics');
  const [description, setDescription] = useState('Premier seller of audio and computer accessories');
  const [businessEmail, setBusinessEmail] = useState(user?.email || 'vendor@example.com');
  const [businessPhone, setBusinessPhone] = useState('+1-555-0199');
  const [street, setStreet] = useState('100 Silicon Way');
  const [city, setCity] = useState('San Jose');
  const [state, setState] = useState('California');
  const [postalCode, setPostalCode] = useState('95110');
  const [country, setCountry] = useState('United States');

  // Application status state
  const [applicationStatus, setApplicationStatus] = useState<any>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  // Admin approval simulation state
  const [adminApplications, setAdminApplications] = useState<any[]>([]);
  const [loadingAdminApps, setLoadingAdminApps] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('Incomplete tax registration documentation');

  // Dashboard state
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

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

  const fetchAdminApplications = useCallback(async () => {
    setLoadingAdminApps(true);
    try {
      const res = await authApi.listAdminVendorApplications('pending');
      setAdminApplications(res.data?.applications || []);
    } catch {
      setAdminApplications([]);
    } finally {
      setLoadingAdminApps(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStatus();
      fetchAdminApplications();
    }
  }, [isAuthenticated, fetchStatus, fetchAdminApplications]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
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

      setApplySuccess('Vendor application submitted successfully! Status is now PENDING review.');
      await fetchStatus();
      await fetchAdminApplications();
      await refreshUser();
    } catch (err: any) {
      setApplyError(
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Failed to submit vendor application. Please check the inputs.'
      );
    } finally {
      setApplyLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await authApi.approveVendorApplication(id);
      await fetchStatus();
      await fetchAdminApplications();
      await refreshUser();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Approval failed (Requires Admin session)');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await authApi.rejectVendorApplication(id, rejectionReason);
      await fetchStatus();
      await fetchAdminApplications();
      await refreshUser();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Rejection failed (Requires Admin session)');
    }
  };

  const handleLoadDashboard = async () => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const res = await authApi.getVendorDashboard();
      setDashboardData(res.data);
    } catch (err: any) {
      setDashboardError(
        err.response?.data?.error?.message ||
        `HTTP ${err.response?.status || 403}: Requires approved vendor account`
      );
      setDashboardData(null);
    } finally {
      setDashboardLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Phase 3: Vendor Onboarding & Store Governance
            </h2>
            <p className="text-xs text-slate-500">
              Test vendor store application, pending status lifecycle, admin approval/rejection, and seller dashboard.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            fetchStatus();
            fetchAdminApplications();
          }}
          disabled={isLoadingStatus}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStatus ? 'animate-spin' : ''}`} />
          <span>Refresh State</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Submit Application */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Send className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                1. Submit Vendor Application
              </h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">
              POST /api/vendors/apply
            </span>
          </div>

          {applySuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{applySuccess}</span>
            </div>
          )}

          {applyError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{applyError}</span>
            </div>
          )}

          <form onSubmit={handleApply} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Store Name</label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Business Phone</label>
                <input
                  type="text"
                  required
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-0.5">Business Email</label>
              <input
                type="email"
                required
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-0.5">Store Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-0.5">Street Address</label>
              <input
                type="text"
                required
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Postal Code</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={applyLoading}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition flex items-center justify-center space-x-2"
            >
              {applyLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span>Submit Application (as Customer)</span>
              )}
            </button>
          </form>
        </div>

        {/* Section 2: Application Status & Dashboard */}
        <div className="space-y-4">
          {/* Status Badge Box */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  2. Current Application Status
                </h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono">
                GET /api/vendors/status
              </span>
            </div>

            {applicationStatus ? (
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Status:</span>
                  <span
                    className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                      applicationStatus.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : applicationStatus.status === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {applicationStatus.status === 'approved' && <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                    {applicationStatus.status === 'pending' && <Clock className="w-3.5 h-3.5 mr-1" />}
                    {applicationStatus.status === 'rejected' && <XCircle className="w-3.5 h-3.5 mr-1" />}
                    <span>{applicationStatus.status}</span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Store Name:</span>
                  <span className="font-medium text-slate-900">{applicationStatus.storeName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Submitted:</span>
                  <span className="font-medium text-slate-900">
                    {applicationStatus.createdAt ? new Date(applicationStatus.createdAt).toLocaleDateString() : '—'}
                  </span>
                </div>
                {applicationStatus.rejectionReason && (
                  <div className="p-2 bg-rose-50 rounded-lg text-rose-700 text-[11px]">
                    <strong>Rejection Reason:</strong> {applicationStatus.rejectionReason}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-white rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
                No vendor application found for this account. Submit the form on the left to apply!
              </div>
            )}
          </div>

          {/* Section 4: Vendor Dashboard Access */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <LayoutDashboard className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  4. Vendor Dashboard Access
                </h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono">
                GET /api/vendor/dashboard
              </span>
            </div>

            <p className="text-xs text-slate-600">
              Only accessible after application approval. Customers and pending applicants will receive HTTP 403 Forbidden.
            </p>

            <button
              onClick={handleLoadDashboard}
              disabled={dashboardLoading}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2"
            >
              {dashboardLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span>Test Vendor Dashboard Access</span>
              )}
            </button>

            {dashboardError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                ❌ {dashboardError}
              </div>
            )}

            {dashboardData && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2">
                <div className="font-bold text-emerald-900 flex items-center space-x-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Welcome to your Vendor Dashboard!</span>
                </div>
                <pre className="p-2 bg-white/80 rounded-lg text-[11px] font-mono border border-emerald-200/60 overflow-x-auto">
                  {JSON.stringify(dashboardData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 3: Admin Approval Simulation Console */}
      <div className="p-5 rounded-2xl border border-purple-200 bg-purple-50/40 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-purple-600" />
            <h3 className="text-xs font-bold text-purple-900 uppercase tracking-wider">
              3. Admin Approval & Rejection Console
            </h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-mono">
            PATCH /api/admin/vendors/:id/approve
          </span>
        </div>

        <p className="text-xs text-slate-600">
          Simulate an admin reviewing pending vendor stores. (Log in as Admin to perform real approvals).
        </p>

        <div className="flex flex-col sm:flex-row gap-2 items-center text-xs">
          <label className="text-slate-600 font-medium whitespace-nowrap">Rejection Reason:</label>
          <input
            type="text"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="w-full sm:flex-1 px-3 py-1.5 border border-purple-200 rounded-lg text-xs bg-white text-slate-800"
            placeholder="Reason for rejecting an application"
          />
        </div>

        {loadingAdminApps ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
          </div>
        ) : adminApplications.length > 0 ? (
          <div className="space-y-2">
            {adminApplications.map((app) => (
              <div
                key={app._id}
                className="p-3 bg-white rounded-xl border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900">{app.storeName}</div>
                  <div className="text-[11px] text-slate-500">
                    Email: {app.businessEmail} • Phone: {app.businessPhone}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleApprove(app._id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition"
                  >
                    Approve Store
                  </button>
                  <button
                    onClick={() => handleReject(app._id)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold transition"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 bg-white rounded-xl border border-dashed border-purple-200 text-center text-xs text-slate-500">
            No pending applications in queue right now.
          </div>
        )}
      </div>
    </div>
  );
};
