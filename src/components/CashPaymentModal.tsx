import React, { useState, useEffect, useRef } from 'react';
import { Banknote, Calculator, CheckCircle2, X, ArrowRight, Coins, AlertCircle, Printer, QrCode as QrCodeIcon } from 'lucide-react';

interface CashPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotalAmount?: number;
  discountAmount?: number;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  totalAmount: number;
  onConfirmPayment: (cashReceived: number, changeReturned: number, receiptType: 'print' | 'ereceipt') => void;
  loading: boolean;
}

export const CashPaymentModal: React.FC<CashPaymentModalProps> = ({
  isOpen,
  onClose,
  subtotalAmount,
  discountAmount = 0,
  discountType,
  discountValue,
  totalAmount,
  onConfirmPayment,
  loading
}) => {
  const [receivedInput, setReceivedInput] = useState<string>('');
  const [receiptType, setReceiptType] = useState<'print' | 'ereceipt'>('print');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReceivedInput(totalAmount.toString());
      setReceiptType('print');
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
    { label: 'Rs. 100', value: 100 },
    { label: 'Rs. 500', value: 500 },
    { label: 'Rs. 1000', value: 1000 },
    { label: 'Rs. 2000', value: 2000 },
    { label: 'Rs. 5000', value: 5000 },
  ];

  const handleQuickAdd = (val: number) => {
    if (val === totalAmount) {
      setReceivedInput(totalAmount.toString());
    } else {
      setReceivedInput(val.toString());
    }
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSufficient && !loading) {
      onConfirmPayment(numReceived, Math.max(0, changeToReturn), receiptType);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5 relative border border-slate-200 animate-fade-in my-auto max-h-[92vh] overflow-y-auto overscroll-contain custom-scrollbar">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-200">
              <Banknote className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Cash Payment & Receipt Options
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Calculate change & choose customer receipt delivery mode
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

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Section 1: Total Customer Bill */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-inner space-y-1.5">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Total Bill of Customer</span>
              <span className="text-[10px] bg-slate-800 text-amber-400 px-2 py-0.5 rounded-full font-mono font-bold">POS SALE</span>
            </div>

            {discountAmount > 0 ? (
              <div className="space-y-1 pt-1 border-t border-slate-800">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Cart Subtotal:</span>
                  <span className="font-mono font-semibold">Rs. {(subtotalAmount ?? (totalAmount + discountAmount)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-emerald-400 font-bold">
                  <span>Discount {discountType === 'percentage' && discountValue ? `(${discountValue}%)` : ''}:</span>
                  <span className="font-mono">-Rs. {discountAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-baseline pt-1 border-t border-slate-800">
                  <span className="text-xs text-amber-300 font-bold uppercase">Payable Total:</span>
                  <div className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight">
                    Rs. {totalAmount.toFixed(2)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-3xl font-black text-amber-400 tracking-tight">
                Rs. {totalAmount.toFixed(2)}
              </div>
            )}
          </div>

          {/* Section 2: Cash Received Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Money Received From Customer (Rs.) *</span>
              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Cashier Input
              </span>
            </label>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-black text-slate-500">
                Rs.
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
                className="w-full pl-14 pr-4 py-3 bg-slate-50 border-2 border-slate-300 focus:border-emerald-500 focus:bg-white rounded-2xl text-slate-900 text-xl font-black focus:outline-none transition-all shadow-inner font-mono"
              />
            </div>

            {/* Quick Currency Note Buttons */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {quickNotes.map((note) => (
                <button
                  key={note.label}
                  type="button"
                  onClick={() => handleQuickAdd(note.value)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-all cursor-pointer"
                >
                  {note.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Money Return (Change Calculation) */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Money Return (Change to Return to Customer)
            </label>

            {isSufficient ? (
              <div className="p-3 bg-emerald-50 border-2 border-emerald-500 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500 text-white rounded-xl shrink-0">
                    <Coins className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                      Return Change
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
                      Rs. {changeToReturn.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="text-right text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                  ✓ Cash Ready
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border-2 border-amber-400 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                      Short Cash Received
                    </div>
                    <div className="text-lg font-bold text-amber-800 font-mono">
                      Need Rs. {(totalAmount - numReceived).toFixed(2)} more
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
              className="px-4 py-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!isSufficient || loading}
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Complete Sale & Print Slip
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
