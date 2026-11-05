import React, { useState } from 'react';
import {
  ShieldCheck,
  UserCheck,
  Store,
  KeyRound,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { authApi } from '../../services/auth.api';

export const AuthRoleTestingPanel: React.FC = () => {
  const { user, isAuthenticated, openAuthModal, logout } = useApp();
  const [testingEndpoint, setTestingEndpoint] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    endpoint: string;
    status: number;
    success: boolean;
    data: any;
  } | null>(null);

  const runAccessTest = async (targetRole: 'customer' | 'vendor' | 'admin') => {
    const endpoint = `/api/${targetRole}/dashboard`;
    setTestingEndpoint(endpoint);
    try {
      const data = await authApi.testRoleAccess(targetRole);
      setTestResult({
        endpoint,
        status: 200,
        success: true,
        data,
      });
    } catch (err: any) {
      setTestResult({
        endpoint,
        status: err.response?.status || 500,
        success: false,
        data: err.response?.data || { error: err.message },
      });
    } finally {
      setTestingEndpoint(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Phase 2: Authentication & Role-Based Security
            </h2>
            <p className="text-xs text-slate-500">
              Test user registration, JWT session cookies, and multi-tenant authorization guards.
            </p>
          </div>
        </div>

        {/* Auth CTA or User badge */}
        <div>
          {isAuthenticated && user ? (
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium text-slate-500">
                Logged in as: <strong className="text-slate-900">{user.email}</strong> (
                <span className="capitalize font-semibold text-indigo-600">{user.role}</span>)
              </span>
              <button
                onClick={logout}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => openAuthModal('login')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
              >
                Open Sign In / Register
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Checklist Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Test 1: Customer Auth */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-900">Customer Auth</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold">
              Role: Customer
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Create or log into a standard shopper account with automatic customer role assignment.
          </p>
          <div className="flex items-center space-x-2 pt-1">
            <button
              onClick={() => openAuthModal('register')}
              className="flex-1 py-1.5 bg-white hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-lg border border-slate-200 text-xs font-semibold transition"
            >
              Register
            </button>
            <button
              onClick={() => runAccessTest('customer')}
              disabled={Boolean(testingEndpoint)}
              className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center space-x-1"
            >
              {testingEndpoint === '/api/customer/dashboard' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <span>Test Guard</span>
              )}
            </button>
          </div>
        </div>

        {/* Test 2: Vendor Auth & Guard */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Store className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-900">Vendor Portal Guard</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">
              Role: Vendor
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Protected endpoint for verified vendors. Customers attempting access receive 403 Forbidden.
          </p>
          <div className="flex items-center space-x-2 pt-1">
            <button
              onClick={() => runAccessTest('vendor')}
              disabled={Boolean(testingEndpoint)}
              className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center space-x-1"
            >
              {testingEndpoint === '/api/vendor/dashboard' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <span>Test /api/vendor/dashboard</span>
              )}
            </button>
          </div>
        </div>

        {/* Test 3: Admin Console Guard */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-bold text-slate-900">Admin Console Guard</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">
              Role: Admin
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Restricted super-admin controls. Requires verified server-side admin role claims.
          </p>
          <div className="flex items-center space-x-2 pt-1">
            <button
              onClick={() => runAccessTest('admin')}
              disabled={Boolean(testingEndpoint)}
              className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center space-x-1"
            >
              {testingEndpoint === '/api/admin/dashboard' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <span>Test /api/admin/dashboard</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Live Probe Result */}
      {testResult && (
        <div
          className={`p-4 rounded-2xl border text-xs space-y-2 ${
            testResult.success
              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
              : 'bg-rose-50/60 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 font-bold">
              {testResult.success ? (
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>
                HTTP {testResult.status} — {testResult.endpoint}
              </span>
            </div>
            <span className="text-[11px] font-semibold opacity-75">
              {testResult.success ? 'Authorized' : 'Access Restricted by RBAC Guard'}
            </span>
          </div>
          <pre className="p-3 bg-white/80 rounded-xl overflow-x-auto text-[11px] font-mono border border-slate-200/60">
            {JSON.stringify(testResult.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

