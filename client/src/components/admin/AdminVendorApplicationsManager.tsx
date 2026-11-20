import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  CheckCircle,
  Building2,
  Phone,
  Mail,
  MapPin,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { authApi } from '../../services/auth.api';

export const AdminVendorApplicationsManager: React.FC = () => {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setFeedbackMessage(null);
    try {
      const res = await authApi.listAdminVendorApplications('pending');
      const list = Array.isArray(res.data) ? res.data : (res.data?.applications || []);
      setApplications(list);
    } catch {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      await authApi.approveVendorApplication(id);
      setFeedbackMessage({ text: 'Merchant store verified and approved successfully.', type: 'success' });
      await fetchApplications();
    } catch (err: any) {
      setFeedbackMessage({
        text: err.response?.data?.error?.message || 'Approval failed (Requires Admin privileges).',
        type: 'error',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = rejectionReasons[id] || 'Incomplete business registration documentation';
    setProcessingId(id);
    try {
      await authApi.rejectVendorApplication(id, reason);
      setFeedbackMessage({ text: 'Application rejected with feedback notice sent to merchant.', type: 'success' });
      await fetchApplications();
    } catch (err: any) {
      setFeedbackMessage({
        text: err.response?.data?.error?.message || 'Rejection failed (Requires Admin privileges).',
        type: 'error',
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-slate-900">
                Merchant Verification & KYC Desk
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                {applications.length} Pending
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and audit applicant business credentials before granting merchant storefront access.
            </p>
          </div>
        </div>

        <button
          onClick={fetchApplications}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center space-x-2 border ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Applications List */}
      {applications.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500 space-y-1">
          <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="font-semibold text-slate-700">No pending merchant applications</p>
          <p className="text-slate-400">All merchant store registrations have been audited and resolved.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {applications.map((app) => {
            const appId = app.id || app._id;
            return (
              <div
                key={appId}
                className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/80">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-slate-900 text-sm">{app.storeName}</h3>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase">
                        Pending Audit
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{app.description || 'No description provided'}</p>
                  </div>

                  <span className="text-[11px] text-slate-400">
                    Applied {new Date(app.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
                  <div className="flex items-center space-x-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{app.businessEmail}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{app.businessPhone}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {app.businessAddress?.city}, {app.businessAddress?.state}, {app.businessAddress?.country}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200/80">
                  <input
                    type="text"
                    placeholder="Rejection reason if declining..."
                    value={rejectionReasons[appId] || ''}
                    onChange={(e) =>
                      setRejectionReasons({ ...rejectionReasons, [appId]: e.target.value })
                    }
                    className="w-full sm:w-80 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl"
                  />

                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <button
                      onClick={() => handleReject(appId)}
                      disabled={processingId === appId}
                      className="flex-1 sm:flex-none px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold border border-rose-200 transition"
                    >
                      Reject
                    </button>

                    <button
                      onClick={() => handleApprove(appId)}
                      disabled={processingId === appId}
                      className="flex-1 sm:flex-none px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-xs"
                    >
                      {processingId === appId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Approve Merchant</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
