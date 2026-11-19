import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Smartphone,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { paymentApi } from '../../services/payment.api';
import { UpiQrPaymentData, Order } from '../../types';

interface UpiQrPaymentModalProps {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (order: Order) => void;
  onPaymentFailed?: (errorMsg: string) => void;
}

export const UpiQrPaymentModal: React.FC<UpiQrPaymentModalProps> = ({
  orderId,
  orderNumber,
  totalAmount,
  isOpen,
  onClose,
  onPaymentSuccess,
  onPaymentFailed,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [qrData, setQrData] = useState<UpiQrPaymentData | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'waiting' | 'paid' | 'failed' | 'expired'>('waiting');
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(15 * 60);
  const [copiedVpa, setCopiedVpa] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize QR Session on mount/open
  const initiateQrPayment = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setPaymentStatus('waiting');
      setFailureReason(null);

      const data = await paymentApi.createUpiQr(orderId);
      setQrData(data);

      // Compute initial remaining seconds
      const expiryTime = new Date(data.expiresAt).getTime();
      const initialRemaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      setTimeLeftSeconds(initialRemaining);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Failed to initialize UPI QR payment session';
      setError(msg);
      if (onPaymentFailed) onPaymentFailed(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && orderId) {
      initiateQrPayment();
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isOpen, orderId]);

  // Countdown timer effect
  useEffect(() => {
    if (paymentStatus !== 'waiting' || !qrData) return;

    timerIntervalRef.current = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current!);
          setPaymentStatus('expired');
          setFailureReason('This UPI QR code has expired. Please generate a new QR code.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [paymentStatus, qrData]);

  // Real-time backend status polling effect
  useEffect(() => {
    if (paymentStatus !== 'waiting' || !qrData) return;

    const pollStatus = async () => {
      try {
        const res = await paymentApi.getUpiQrStatus(orderId);
        if (res.status === 'paid') {
          setPaymentStatus('paid');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

          // Retrieve updated order or build success order
          setTimeout(async () => {
            try {
              const paymentRec = await paymentApi.getPaymentByOrder(orderId);
              if (paymentRec) {
                // Trigger parent callback
                onPaymentSuccess({
                  id: orderId,
                  orderNumber,
                  totalAmount,
                  paymentStatus: 'paid',
                } as unknown as Order);
              }
            } catch {
              onPaymentSuccess({
                id: orderId,
                orderNumber,
                totalAmount,
                paymentStatus: 'paid',
              } as unknown as Order);
            }
          }, 1200);
        } else if (res.status === 'failed') {
          setPaymentStatus('failed');
          setFailureReason(res.failureReason || 'Payment was declined by issuing bank');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        } else if (res.status === 'expired') {
          setPaymentStatus('expired');
          setFailureReason(res.failureReason || 'QR code expired');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        }
      } catch (err: any) {
        // Tolerant to transient network blips during polling
        console.warn('UPI QR polling retry:', err?.message);
      }
    };

    pollIntervalRef.current = setInterval(pollStatus, 3000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [paymentStatus, qrData, orderId, orderNumber, totalAmount, onPaymentSuccess]);

  const handleCopyVpa = () => {
    if (!qrData?.merchantVpa) return;
    navigator.clipboard.writeText(qrData.merchantVpa);
    setCopiedVpa(true);
    setTimeout(() => setCopiedVpa(false), 2000);
  };

  const handleCancelSession = async () => {
    try {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      await paymentApi.cancelUpiQr(orderId);
    } catch {
      // Ignored
    } finally {
      onClose();
    }
  };

  const handleSimulate = async (outcome: 'success' | 'failed' | 'expired') => {
    try {
      setIsSimulating(true);
      setError(null);
      const res = await paymentApi.simulateUpiQr(orderId, outcome);

      if (outcome === 'success') {
        setPaymentStatus('paid');
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        setTimeout(() => {
          if (res.order) {
            onPaymentSuccess(res.order);
          } else {
            onPaymentSuccess({
              id: orderId,
              orderNumber,
              totalAmount,
              paymentStatus: 'paid',
            } as unknown as Order);
          }
        }, 1200);
      } else if (outcome === 'failed') {
        setPaymentStatus('failed');
        setFailureReason('Simulated payment failure / UPI decline');
      } else if (outcome === 'expired') {
        setPaymentStatus('expired');
        setFailureReason('Simulated session expiration');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Simulation request failed');
    } finally {
      setIsSimulating(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-emerald-100" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold tracking-tight">Pay using UPI QR</h3>
                {qrData?.isTestMode && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-400/25 text-emerald-100 border border-emerald-300/30">
                    Test Mode
                  </span>
                )}
              </div>
              <p className="text-[11px] text-emerald-100/90">Scan & pay with any UPI application</p>
            </div>
          </div>
          <button
            onClick={handleCancelSession}
            className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-xs">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mx-auto" />
              <div className="font-bold text-slate-800 text-sm">Generating Genuine UPI QR Code...</div>
              <p className="text-[11px] text-slate-500">Connecting to payment gateway architecture</p>
            </div>
          ) : error && !qrData ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">QR Generation Failed</h4>
                <p className="text-xs text-rose-600 mt-1 max-w-xs mx-auto">{error}</p>
              </div>
              <div className="flex space-x-2 justify-center">
                <button
                  onClick={initiateQrPayment}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition"
                >
                  Retry Generation
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Order Amount Card */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Order Number:</span>
                  <span className="font-bold text-slate-900">#{orderNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Merchant:</span>
                  <span className="font-bold text-slate-800">NexusMarket Marketplace</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Merchant UPI VPA:</span>
                  <div className="flex items-center space-x-1.5 font-mono text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    <span>{qrData?.merchantVpa}</span>
                    <button
                      type="button"
                      onClick={handleCopyVpa}
                      className="hover:text-emerald-950 transition"
                      title="Copy VPA"
                    >
                      {copiedVpa ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-sm font-black">
                  <span className="text-slate-900">Total Payable:</span>
                  <span className="text-emerald-700 text-base font-extrabold">₹{totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Status Banner */}
              {paymentStatus === 'waiting' && (
                <div className="py-2 px-3 bg-amber-50 border border-amber-200/80 rounded-xl flex items-center justify-between text-amber-800 text-[11px] font-semibold animate-pulse">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                    <span>Waiting for your payment...</span>
                  </div>
                  <div className="flex items-center space-x-1 text-slate-600 font-mono">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Expires in {formatTimer(timeLeftSeconds)}</span>
                  </div>
                </div>
              )}

              {paymentStatus === 'paid' && (
                <div className="py-3 px-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-center space-y-1 animate-in zoom-in-95">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="font-bold text-emerald-900 text-xs">Payment Verified & Captured!</div>
                  <p className="text-[11px] text-emerald-700">Updating order and creating tax invoice...</p>
                </div>
              )}

              {paymentStatus === 'failed' && (
                <div className="py-3 px-4 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-2">
                  <AlertCircle className="w-7 h-7 text-rose-600 mx-auto" />
                  <div className="font-bold text-rose-900 text-xs">Payment Failed / Declined</div>
                  <p className="text-[11px] text-rose-600">{failureReason || 'Transaction was declined by bank.'}</p>
                  <button
                    onClick={initiateQrPayment}
                    className="mt-1 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 mx-auto"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Generate New QR</span>
                  </button>
                </div>
              )}

              {paymentStatus === 'expired' && (
                <div className="py-3 px-4 bg-slate-100 border border-slate-200 rounded-2xl text-center space-y-2">
                  <Clock className="w-7 h-7 text-amber-600 mx-auto" />
                  <div className="font-bold text-slate-800 text-xs">QR Code Session Expired</div>
                  <p className="text-[11px] text-slate-500">
                    This dynamic QR code has expired to protect against double billing.
                  </p>
                  <button
                    onClick={initiateQrPayment}
                    className="mt-1 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 mx-auto"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Generate Fresh QR</span>
                  </button>
                </div>
              )}

              {/* QR Code Container */}
              {qrData?.qrImageUrl && paymentStatus === 'waiting' && (
                <div className="relative py-2 flex flex-col items-center justify-center">
                  <div className="p-3 bg-white rounded-2xl border-2 border-slate-100 shadow-xl shadow-slate-200/50 inline-block relative">
                    <img
                      src={qrData.qrImageUrl}
                      alt={`UPI Payment QR for Order #${orderNumber}`}
                      className="w-52 h-52 sm:w-56 sm:h-56 object-contain rounded-xl"
                    />
                  </div>

                  {/* Supported UPI Apps Row */}
                  <div className="mt-3 flex items-center justify-center space-x-2 text-[10px] text-slate-500 font-medium">
                    <span className="px-2 py-0.5 bg-slate-100 rounded-md">Google Pay</span>
                    <span className="px-2 py-0.5 bg-slate-100 rounded-md">PhonePe</span>
                    <span className="px-2 py-0.5 bg-slate-100 rounded-md">Paytm</span>
                    <span className="px-2 py-0.5 bg-slate-100 rounded-md">BHIM</span>
                    <span className="px-2 py-0.5 bg-slate-100 rounded-md">CRED</span>
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="bg-emerald-50/60 p-3 rounded-2xl border border-emerald-100 space-y-1.5 text-left text-slate-700">
                <div className="text-[11px] font-bold text-emerald-950 flex items-center space-x-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                  <span>How to pay using your smartphone:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 pl-0.5">
                  <li>
                    Open <strong>Google Pay</strong>, <strong>PhonePe</strong>, or <strong>Paytm</strong> on your phone.
                  </li>
                  <li>Tap the <strong>Scan QR</strong> option.</li>
                  <li>Scan the QR code shown above and authorize the payment.</li>
                  <li>Keep this page open; your payment verifies automatically.</li>
                </ol>
              </div>

              {/* Test Mode Simulator Controls */}
              {qrData?.isTestMode && paymentStatus === 'waiting' && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-emerald-700 font-bold text-[11px]">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Developer Sandbox Simulator</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Local Testing</span>
                  </div>

                  <p className="text-[10px] text-slate-500 leading-tight">
                    Simulate real-time bank capture without transferring real currency:
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isSimulating}
                      onClick={() => handleSimulate('success')}
                      className="py-2 px-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-[11px] shadow-sm flex items-center justify-center space-x-1 transition disabled:opacity-50"
                    >
                      {isSimulating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Simulate Paid</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={isSimulating}
                      onClick={() => handleSimulate('failed')}
                      className="py-2 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-semibold text-[11px] transition disabled:opacity-50"
                    >
                      Simulate Decline
                    </button>
                  </div>
                </div>
              )}

              {/* Security & Dismiss Action */}
              <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center space-x-1 text-emerald-700">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>256-Bit Encrypted Gateway</span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelSession}
                  className="text-slate-500 hover:text-slate-700 underline font-medium"
                >
                  Cancel & Change Method
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
