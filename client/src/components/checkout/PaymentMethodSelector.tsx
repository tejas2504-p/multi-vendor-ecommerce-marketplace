import React from 'react';
import {
  Smartphone,
  QrCode,
  CreditCard,
  Building2,
  Wallet,
  Banknote,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { PaymentMethodType } from '../../types';

export interface PaymentMethodOption {
  id: PaymentMethodType;
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  note: string;
}

export const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: 'upi_qr',
    title: 'Pay using UPI QR',
    subtitle: 'Scan with Google Pay, PhonePe, Paytm, BHIM or any UPI App',
    badge: 'Fast & Seamless',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: QrCode,
    accentColor: 'text-emerald-600 bg-emerald-50',
    note: 'Generates a genuine dynamic UPI QR code. Scan directly using Google Pay, PhonePe, Paytm, BHIM, or any UPI app with live status tracking.',
  },
  {
    id: 'upi',
    title: 'UPI (Instant / App Intent)',
    subtitle: 'Google Pay, PhonePe, Paytm, BHIM or direct UPI ID',
    badge: 'Popular',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    icon: Smartphone,
    accentColor: 'text-teal-600 bg-teal-50',
    note: 'Fast zero-fee checkout via UPI ID or direct app authorization through Razorpay gateway.',
  },
  {
    id: 'card',
    title: 'Credit / Debit Cards',
    subtitle: 'Visa, MasterCard, RuPay, Maestro & American Express',
    badge: 'Zero Extra Fee',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: CreditCard,
    accentColor: 'text-blue-600 bg-blue-50',
    note: 'Pay safely with 256-bit SSL encryption. NexusMarket never stores raw card credentials or CVV numbers.',
  },
  {
    id: 'netbanking',
    title: 'Net Banking',
    subtitle: 'HDFC, ICICI, SBI, Axis, Kotak & 50+ Indian Banks',
    badge: 'All Major Banks',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: Building2,
    accentColor: 'text-indigo-600 bg-indigo-50',
    note: 'Direct internet banking transfer securely routed through your bank’s authenticated portal.',
  },
  {
    id: 'wallet',
    title: 'Digital Wallets',
    subtitle: 'Paytm Wallet, PhonePe, Mobikwik & Amazon Pay',
    badge: '1-Click Pay',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Wallet,
    accentColor: 'text-amber-600 bg-amber-50',
    note: 'Fast 1-click checkout using your existing digital wallet balance.',
  },
  {
    id: 'cod',
    title: 'Cash on Delivery (COD)',
    subtitle: 'Pay with cash or UPI at your doorstep upon package arrival',
    badge: 'Pay on Arrival',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: Banknote,
    accentColor: 'text-teal-600 bg-teal-50',
    note: 'No advance online payment required. Pay our delivery agent in cash or UPI when your order is delivered.',
  },
];

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethodType;
  onSelectMethod: (method: PaymentMethodType) => void;
  allowCod?: boolean;
  compact?: boolean;
}

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  selectedMethod,
  onSelectMethod,
  allowCod = true,
  compact = false,
}) => {
  const methods = allowCod ? PAYMENT_METHODS : PAYMENT_METHODS.filter((m) => m.id !== 'cod');
  const selectedConfig = PAYMENT_METHODS.find((m) => m.id === selectedMethod) || PAYMENT_METHODS[0];

  return (
    <div className="space-y-3">
      <div className={`grid gap-2.5 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {methods.map((method) => {
          const isSelected = selectedMethod === method.id;
          const IconComponent = method.icon;

          return (
            <label
              key={method.id}
              onClick={() => onSelectMethod(method.id)}
              className={`relative cursor-pointer rounded-2xl border p-3.5 transition flex items-start space-x-3 text-left ${
                isSelected
                  ? 'border-emerald-600 bg-emerald-50/30 shadow-sm ring-1 ring-emerald-500'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <input
                type="radio"
                name="paymentMethodOption"
                checked={isSelected}
                onChange={() => onSelectMethod(method.id)}
                className="mt-1 text-emerald-600 focus:ring-emerald-500"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1.5 mb-1">
                  <div className="flex items-center space-x-2">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${method.accentColor}`}>
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {method.title}
                    </span>
                  </div>
                  {method.badge && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${method.badgeColor}`}
                    >
                      {method.badge}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 line-clamp-1 pl-8">
                  {method.subtitle}
                </p>
              </div>

              {isSelected && (
                <div className="absolute top-2 right-2 text-emerald-600 sm:hidden">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </label>
          );
        })}
      </div>

      {/* Selected Method Dynamic Notice */}
      <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start space-x-2.5">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-800">
            {selectedConfig.title}:{' '}
          </span>
          <span>{selectedConfig.note}</span>
        </div>
      </div>
    </div>
  );
};
