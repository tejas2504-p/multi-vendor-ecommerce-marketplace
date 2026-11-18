import React from 'react';
import { ShoppingBag, Store, ShieldCheck, LogIn, LogOut, ShoppingCart, MapPin, Package } from 'lucide-react';
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
          <div 
            onClick={() => onRoleChange('customer')}
            className="flex items-center space-x-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                NexusMarket
              </span>
            </div>
          </div>

          {/* Role Navigation: Marketplace / Merchant Portal / Admin Console */}
          <div className="hidden md:flex items-center bg-gray-100 p-1 rounded-xl text-xs sm:text-sm font-medium">
            <button
              onClick={() => onRoleChange('customer')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                activeRole === 'customer'
                  ? 'bg-white text-gray-900 shadow-xs font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
              <span>Marketplace</span>
            </button>
            <button
              onClick={() => onRoleChange('vendor')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                activeRole === 'vendor'
                  ? 'bg-white text-gray-900 shadow-xs font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Store className="w-4 h-4 text-emerald-600" />
              <span>Merchant Portal</span>
            </button>
            <button
              onClick={() => onRoleChange('admin')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                activeRole === 'admin'
                  ? 'bg-white text-gray-900 shadow-xs font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Admin Console</span>
            </button>
          </div>

          {/* Right Header: Cart, Orders, Addresses & Auth Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Shopping Cart Button with Dynamic Badge */}
            <button
              onClick={openCart}
              title="Shopping Cart"
              className="relative p-2 text-slate-700 hover:text-emerald-600 hover:bg-slate-100 rounded-xl transition"
            >
              <ShoppingCart className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-600 text-white rounded-full text-[10px] font-black flex items-center justify-center shadow-xs">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </button>

            {/* Saved Addresses & Orders (When Authenticated) */}
            {isAuthenticated && (
              <>
                <button
                  onClick={openOrdersModal}
                  title="My Orders & Shipments"
                  className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-emerald-600 hover:bg-slate-100 rounded-xl transition border border-slate-200"
                >
                  <Package className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Orders</span>
                </button>
                <button
                  onClick={openAddressModal}
                  title="Manage Addresses"
                  className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-emerald-600 hover:bg-slate-100 rounded-xl transition border border-slate-200"
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Addresses</span>
                </button>
              </>
            )}

            {/* User Session or Auth Buttons */}
            {isAuthenticated && user ? (
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-100 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
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
                  className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-emerald-600 hover:bg-slate-100 rounded-xl transition"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>

                <button
                  onClick={() => openAuthModal('register')}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  Register
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile View Role Switcher Bar */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-100 text-xs font-medium">
          <button
            onClick={() => onRoleChange('customer')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg ${
              activeRole === 'customer' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-600'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Marketplace</span>
          </button>
          <button
            onClick={() => onRoleChange('vendor')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg ${
              activeRole === 'vendor' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-600'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Merchant</span>
          </button>
          <button
            onClick={() => onRoleChange('admin')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg ${
              activeRole === 'admin' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-600'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Admin</span>
          </button>
        </div>
      </div>
    </header>
  );
};
