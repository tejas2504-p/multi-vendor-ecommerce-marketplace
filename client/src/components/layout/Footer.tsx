import React from 'react';
import { ShoppingBag, ShieldCheck, Truck, Headphones, Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const Footer: React.FC = () => {
  const { setActiveRole } = useApp();

  return (
    <footer className="bg-slate-900 text-slate-400 mt-auto border-t border-slate-800">
      {/* Trust & Guarantee Banner */}
      <div className="border-b border-slate-800/80 bg-slate-900/60 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center sm:text-left">
            <div className="flex items-center space-x-3 justify-center sm:justify-start">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-white">100% Genuine Guarantee</div>
                <div className="text-[11px] text-slate-400">Direct from certified brands</div>
              </div>
            </div>

            <div className="flex items-center space-x-3 justify-center sm:justify-start">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-white">Express Tracked Delivery</div>
                <div className="text-[11px] text-slate-400">Real-time carrier updates</div>
              </div>
            </div>

            <div className="flex items-center space-x-3 justify-center sm:justify-start">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-white">Escrow Buyer Protection</div>
                <div className="text-[11px] text-slate-400">256-bit encrypted checkout</div>
              </div>
            </div>

            <div className="flex items-center space-x-3 justify-center sm:justify-start">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <Headphones className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-white">Dedicated Support</div>
                <div className="text-[11px] text-slate-400">24/7 resolution desk</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main 4-Column Navigation Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-white">
                NexusMarket
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              The premier curated multi-vendor marketplace connecting discerning technology buyers with independent electronics manufacturers, boutique audio studios, and computing brands.
            </p>
            <div className="pt-1 flex items-center space-x-2 text-[11px] text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>All payment methods verified • PCI DSS Compliant</span>
            </div>
          </div>

          {/* Catalog Categories */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Shop Categories</h4>
            <ul className="space-y-2 text-xs">
              <li><button onClick={() => setActiveRole('customer')} className="hover:text-emerald-400 transition text-left">Audio & Headphones</button></li>
              <li><button onClick={() => setActiveRole('customer')} className="hover:text-emerald-400 transition text-left">Laptops & Computers</button></li>
              <li><button onClick={() => setActiveRole('customer')} className="hover:text-emerald-400 transition text-left">Smartphones & Tablets</button></li>
              <li><button onClick={() => setActiveRole('customer')} className="hover:text-emerald-400 transition text-left">Smart Wearables</button></li>
              <li><button onClick={() => setActiveRole('customer')} className="hover:text-emerald-400 transition text-left">Gaming & Peripherals</button></li>
            </ul>
          </div>

          {/* Customer Care */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Customer Support</h4>
            <ul className="space-y-2 text-xs">
              <li><span className="hover:text-emerald-400 transition cursor-pointer">Order Tracking & History</span></li>
              <li><span className="hover:text-emerald-400 transition cursor-pointer">Shipping & Carrier Rates</span></li>
              <li><span className="hover:text-emerald-400 transition cursor-pointer">30-Day Return Guarantee</span></li>
              <li><span className="hover:text-emerald-400 transition cursor-pointer">Dispute Resolution Desk</span></li>
              <li><span className="hover:text-emerald-400 transition cursor-pointer">Buyer Protection Policy</span></li>
            </ul>
          </div>

          {/* Sell on NexusMarket */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Partner With Us</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => setActiveRole('vendor')}
                  className="text-emerald-400 font-semibold hover:text-emerald-300 transition text-left"
                >
                  Become a Verified Vendor →
                </button>
              </li>
              <li><button onClick={() => setActiveRole('vendor')} className="hover:text-emerald-400 transition text-left">Merchant Center & Store</button></li>
              <li><button onClick={() => setActiveRole('vendor')} className="hover:text-emerald-400 transition text-left">Vendor Payouts & Ledger</button></li>
              <li><button onClick={() => setActiveRole('admin')} className="hover:text-emerald-400 transition text-left">Admin Operations</button></li>
              <li><span className="hover:text-emerald-400 transition cursor-pointer">Seller Standards & Fees</span></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Copyright & Legal */}
      <div className="border-t border-slate-800 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <p>© 2026 NexusMarket Inc. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="hover:text-slate-300 cursor-pointer">Privacy Policy</span>
            <span>•</span>
            <span className="hover:text-slate-300 cursor-pointer">Terms of Service</span>
            <span>•</span>
            <span className="hover:text-slate-300 cursor-pointer">Security Safeguards</span>
            <span>•</span>
            <span className="hover:text-slate-300 cursor-pointer">Merchant Agreement</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
