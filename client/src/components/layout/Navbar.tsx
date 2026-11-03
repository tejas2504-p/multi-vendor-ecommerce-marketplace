import React from 'react';
import { ShoppingBag, Store, ShieldCheck, Activity } from 'lucide-react';

interface NavbarProps {
  activeRole: 'customer' | 'vendor' | 'admin';
  onRoleChange: (role: 'customer' | 'vendor' | 'admin') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeRole, onRoleChange }) => {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                NexusMarket
              </span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-xs font-semibold bg-brand-50 text-brand-700 rounded-full border border-brand-200">
                Phase 1 Foundation
              </span>
            </div>
          </div>

          {/* Role Mode Selector */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs sm:text-sm font-medium">
            <button
              onClick={() => onRoleChange('customer')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeRole === 'customer'
                  ? 'bg-white text-gray-900 shadow-sm font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ShoppingBag className="w-4 h-4 text-brand-600" />
              <span>Customer</span>
            </button>
            <button
              onClick={() => onRoleChange('vendor')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeRole === 'vendor'
                  ? 'bg-white text-gray-900 shadow-sm font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Store className="w-4 h-4 text-emerald-600" />
              <span>Vendor</span>
            </button>
            <button
              onClick={() => onRoleChange('admin')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeRole === 'admin'
                  ? 'bg-white text-gray-900 shadow-sm font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span>Admin</span>
            </button>
          </div>

          {/* Backend Status indicator */}
          <div className="hidden md:flex items-center space-x-2 text-xs font-medium text-gray-500">
            <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span>Core API Active</span>
          </div>
        </div>
      </div>
    </header>
  );
};

