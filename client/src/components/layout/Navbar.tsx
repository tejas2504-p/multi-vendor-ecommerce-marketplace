import React from 'react';
import { ShoppingBag, Store, ShieldCheck, Activity, LogIn, LogOut, ShoppingCart, MapPin, Package } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useCart } from '../../context/CartContext';

interface NavbarProps {
  activeRole: 'customer' | 'vendor' | 'admin';
  onRoleChange: (role: 'customer' | 'vendor' | 'admin') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeRole, onRoleChange }) => {
  const { user, isAuthenticated, logout, openAuthModal } = useApp();
  const { itemCount, openCart, openAddressModal, openOrdersModal } = useCart();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                NexusMarket
              </span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-xs font-semibold bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                Phase 7B
              </span>
            </div>
          </div>

          {/* Role Mode Selector */}
          <div className="hidden md:flex items-center bg-gray-100 p-1 rounded-xl text-xs sm:text-sm font-medium">
            <button
              onClick={() => onRoleChange('customer')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeRole === 'customer'
                  ? 'bg-white text-gray-900 shadow-sm font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ShoppingBag className="w-4 h-4 text-indigo-600" />
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

          {/* Right Header: Auth Actions & Health */}
          <div className="flex items-center space-x-2.5">
            {/* Backend Status indicator */}
            <div className="hidden lg:flex items-center space-x-1.5 text-xs font-medium text-slate-500 pr-2 border-r border-slate-200">
              <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              <span>API Active</span>
            </div>

            {/* Shopping Cart Button with Dynamic Badge */}
            <button
              onClick={openCart}
              title="Shopping Cart"
              className="relative p-2 text-slate-700 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition"
            >
              <ShoppingCart className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 text-white rounded-full text-[10px] font-black flex items-center justify-center shadow-sm">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </button>

            {/* Saved Addresses Button (When Authenticated) */}
            {isAuthenticated && (
              <>
                <button
                  onClick={openOrdersModal}
                  title="My Orders & Shipments"
                  className="hidden sm:flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition border border-slate-200"
                >
                  <Package className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Orders</span>
                </button>
                <button
                  onClick={openAddressModal}
                  title="Manage Addresses"
                  className="hidden sm:flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition border border-slate-200"
                >
                  <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Addresses</span>
                </button>
              </>
            )}

            {/* User Session or Auth Buttons */}
            {isAuthenticated && user ? (
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-100 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                    {user.name ? user.name[0].toUpperCase() : 'U'}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-xs font-bold text-slate-900 leading-none">{user.name}</div>
                    <div className="text-[10px] text-slate-500 capitalize font-medium">{user.role}</div>
                  </div>
                </div>

                <button
                  onClick={logout}
                  title="Sign Out"
                  className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => openAuthModal('login')}
                  className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>

                <button
                  onClick={() => openAuthModal('register')}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
                >
                  Register
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
