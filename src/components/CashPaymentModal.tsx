import React, { useState, useEffect, useRef } from 'react';
import { Banknote, Calculator, CheckCircle2, X, ArrowRight, Coins, AlertCircle } from 'lucide-react';

interface CashPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  onConfirmPayment: (cashReceived: number, changeReturned: number) => void;
  loading: boolean;
}

export const CashPaymentModal: React.FC<CashPaymentModalProps> = ({
  isOpen,
  onClose,
  totalAmount,
  onConfirmPayment,
  loading
}) => {
  const [receivedInput, setReceivedInput] = useState<string>('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReceivedInput(totalAmount.toString());
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 100);
    }
  }, [isOpen, totalAmount]);

  if (!isOpen) return null;

  const numReceived = parseFloat(receivedInput) || 0;
  const changeToReturn = numReceived - totalAmount;
  const isSufficient = numReceived >= totalAmount && numReceived > 0;

  const quickNotes = [
    { label: 'Exact', value: totalAmount },
    { label: '₹100', value: 100 },
    { label: '₹200', value: 200 },
    { label: '₹500', value: 500 },
    { label: '₹1000', value: 1000 },
    { label: '₹2000', value: 2000 },
  ];

  const handleQuickAdd = (val: number) => {
    if (val === totalAmount) {
      setReceivedInput(totalAmount.toString());
    } else {
      // If val is less than total, add to current or set to val if current is 0
      setReceivedInput(val.toString());
    }
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSufficient && !loading) {
      onConfirmPayment(numReceived, Math.max(0, changeToReturn));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 relative border border-slate-200 animate-fade-in">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-200">
              <Banknote className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Cash Payment Calculator
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Enter customer cash received & calculate change return
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Section 1: Total Customer Bill */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-inner space-y-1">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Total Bill of Customer</span>
              <span className="text-[10px] bg-slate-800 text-amber-400 px-2 py-0.5 rounded-full font-mono font-bold">POS SALE</span>
            </div>
            <div className="text-3xl sm:text-4xl font-black text-amber-400 tracking-tight">
              ₹{totalAmount.toFixed(2)}
            </div>
          </div>

          {/* Section 2: Cash Received Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Money Received From Customer (₹) *</span>
              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Cashier Input
              </span>
            </label>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">
                ₹
              </span>
              <input
                ref={inputRef}
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                value={receivedInput}
                onChange={(e) => setReceivedInput(e.target.value)}
                className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border-2 border-slate-300 focus:border-emerald-500 focus:bg-white rounded-2xl text-slate-900 text-2xl font-black focus:outline-none transition-all shadow-inner font-mono"
              />
            </div>

            {/* Quick Currency Note Buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              {quickNotes.map((note) => (
                <button
                  key={note.label}
                  type="button"
                  onClick={() => handleQuickAdd(note.value)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-700 transition-all cursor-pointer"
                >
                  {note.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Money Return (Change Calculation) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Money Return (Change to Return to Customer)
            </label>

            {isSufficient ? (
              <div className="p-4 bg-emerald-50 border-2 border-emerald-500 rounded-2xl flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500 text-white rounded-xl shrink-0">
                    <Coins className="w-6 h-6 animate-bounce" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                      Return Change
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">
                      ₹{changeToReturn.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="text-right text-[11px] font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-xl">
                  ✓ Cash Received Ready
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500 text-white rounded-xl shrink-0">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                      Short Cash Received
                    </div>
                    <div className="text-xl font-bold text-amber-800 font-mono">
                      Need ₹{(totalAmount - numReceived).toFixed(2)} more
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!isSufficient || loading}
              className="px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Confirm Cash Sale & Issue Receipt
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
