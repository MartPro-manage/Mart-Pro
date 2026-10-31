import React, { useState, useEffect } from 'react';
import { 
  X, 
  CreditCard, 
  Banknote, 
  Smartphone, 
  QrCode, 
  Landmark, 
  Printer, 
  Send, 
  Check, 
  Volume2, 
  FileText,
  Wallet
} from 'lucide-react';
import { CartItem, DigitalPaymentMethodConfig } from '../types';

interface PaymentSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  cartSubtotal: number;
  cartTotal: number;
  paymentMethod: 'cash' | 'online';
  setPaymentMethod: (method: 'cash' | 'online') => void;
  configuredDigitalMethods: DigitalPaymentMethodConfig[];
  selectedDigitalProvider: string;
  setSelectedDigitalProvider: (provider: string) => void;
  onProceedToCashCheckout: (cashReceived?: number, changeReturned?: number) => void;
  onCompleteDigitalCheckout: () => void;
  checkoutLoading: boolean;
  storeName?: string;
  counterName?: string;
}

export const PaymentSummaryModal: React.FC<PaymentSummaryModalProps> = ({
  isOpen,
  onClose,
  cart,
  cartSubtotal,
  cartTotal,
  paymentMethod,
  setPaymentMethod,
  configuredDigitalMethods,
  selectedDigitalProvider,
  setSelectedDigitalProvider,
  onProceedToCashCheckout,
  onCompleteDigitalCheckout,
  checkoutLoading,
  storeName,
  counterName
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'card' | 'jazzcash' | 'easypaisa' | 'qr' | 'bank'>('cash');
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [printInvoice, setPrintInvoice] = useState<boolean>(true);
  const [playVoice, setPlayVoice] = useState<boolean>(true);

  // Bill number and date for display matching Screen 4
  const billNumber = `S-${Math.floor(1000 + (cartTotal % 9000))}`;
  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }) + ' ' + new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  useEffect(() => {
    if (isOpen) {
      setAmountReceived(cartTotal > 0 ? (Math.ceil(cartTotal / 100) * 100).toString() : '0');
    }
  }, [isOpen, cartTotal]);

  if (!isOpen) return null;

  const numReceived = parseFloat(amountReceived) || 0;
  const changeDue = Math.max(0, numReceived - cartTotal);
  const totalItemsCount = cart.reduce((acc, item) => acc + (item.product.sellBy === 'weight' ? 1 : item.quantity), 0);
  const totalDiscount = Math.max(0, cartSubtotal - cartTotal);

  const handleQuickAddCash = (noteVal: number) => {
    setAmountReceived(noteVal.toString());
  };

  const handleCompleteSale = () => {
    if (selectedMethod === 'cash') {
      onProceedToCashCheckout(numReceived, changeDue);
    } else {
      setSelectedDigitalProvider(
        selectedMethod === 'card' ? 'Card' :
        selectedMethod === 'jazzcash' ? 'JazzCash' :
        selectedMethod === 'easypaisa' ? 'EasyPaisa' :
        selectedMethod === 'qr' ? 'Online / QR' : 'Bank Transfer'
      );
      onCompleteDigitalCheckout();
    }
  };

  const methodsList: Array<{
    id: 'cash' | 'card' | 'jazzcash' | 'easypaisa' | 'qr' | 'bank';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'cash', label: 'Cash', icon: Banknote },
    { id: 'card', label: 'Card', icon: CreditCard },
    { id: 'jazzcash', label: 'JazzCash', icon: Smartphone },
    { id: 'easypaisa', label: 'EasyPaisa', icon: Wallet },
    { id: 'qr', label: 'Online / QR', icon: QrCode },
    { id: 'bank', label: 'Bank Transfer', icon: Landmark },
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto font-sans">
      <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[95vh]">
        
        {/* Top Header Bar matching Panel 4: Left X button, right Bill # and Date */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              title="Close payment window"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              Payment
            </h2>
          </div>

          <div className="text-xs font-bold text-slate-500 font-mono">
            <span className="text-slate-900 font-extrabold">Bill #{billNumber}</span>
            <span className="mx-2 text-slate-300">|</span>
            <span>{currentDateFormatted}</span>
          </div>
        </div>

        {/* 3 Columns Canvas: Responsive across every device (stacked on mobile, 3-column on md/lg) */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 overflow-y-auto">
          
          {/* Column 1: Payment Method (Vertical selector with orange highlight) */}
          <div className="md:col-span-3 space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Payment Method
            </label>
            <div className="space-y-1.5">
              {methodsList.map(m => {
                const IconComp = m.icon;
                const isActive = selectedMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedMethod(m.id);
                      setPaymentMethod(m.id === 'cash' ? 'cash' : 'online');
                    }}
                    className={`w-full p-3 rounded-2xl flex items-center gap-3 text-xs font-bold transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-2xs'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <IconComp className="w-4 h-4" />
                    </div>
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Column 2: Payment Details (Cash Payment or Digital with quick chips & change due) */}
          <div className="md:col-span-5 bg-slate-50/70 rounded-2xl p-5 border border-slate-200/80 space-y-4">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">
                {selectedMethod === 'cash' ? 'Cash Payment' : `${methodsList.find(m => m.id === selectedMethod)?.label} Payment`}
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {selectedMethod === 'cash' ? 'Enter physical currency received from customer' : 'Verify transaction confirmation on terminal'}
              </p>
            </div>

            {selectedMethod === 'cash' ? (
              <>
                {/* Amount Received Input */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                    Amount Received
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                      Rs.
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={amountReceived}
                      onChange={e => setAmountReceived(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl font-mono font-black text-lg text-slate-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                </div>

                {/* Quick Currency Chips (500, 1000, 2000, 5000) matching Panel 4 */}
                <div className="flex items-center gap-2 flex-wrap">
                  {[500, 1000, 2000, 5000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleQuickAddCash(val)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                        numReceived === val
                          ? 'bg-orange-600 text-white border-orange-600'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleQuickAddCash(cartTotal)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer"
                  >
                    Exact
                  </button>
                </div>

                {/* Change Due Green Display matching Panel 4 */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                      Change Due
                    </div>
                    <div className="text-2xl font-black text-emerald-600 font-mono mt-0.5">
                      Rs. {changeDue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                    {numReceived >= cartTotal ? 'Ready' : 'Pending'}
                  </span>
                </div>
              </>
            ) : (
              <div className="py-6 text-center space-y-3 bg-white rounded-2xl border border-slate-200 p-6">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto">
                  {selectedMethod === 'card' && <CreditCard className="w-6 h-6" />}
                  {selectedMethod === 'jazzcash' && <Smartphone className="w-6 h-6" />}
                  {selectedMethod === 'easypaisa' && <Wallet className="w-6 h-6" />}
                  {selectedMethod === 'qr' && <QrCode className="w-6 h-6" />}
                  {selectedMethod === 'bank' && <Landmark className="w-6 h-6" />}
                </div>
                <div className="font-extrabold text-sm text-slate-800">
                  Total Payable: Rs. {cartTotal.toLocaleString()}
                </div>
                <p className="text-xs text-slate-400">
                  Instruct customer to tap card or transfer via {methodsList.find(m => m.id === selectedMethod)?.label}.
                </p>
              </div>
            )}

            {/* Bottom Toggles: Print Invoice & Play Voice matching Panel 4 */}
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <label className="flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Print Invoice</span>
                </span>
                <input
                  type="checkbox"
                  checked={printInvoice}
                  onChange={e => setPrintInvoice(e.target.checked)}
                  className="w-4 h-4 rounded text-orange-600 border-slate-300 focus:ring-orange-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Play Voice (Optional)</span>
                </span>
                <input
                  type="checkbox"
                  checked={playVoice}
                  onChange={e => setPlayVoice(e.target.checked)}
                  className="w-4 h-4 rounded text-orange-600 border-slate-300 focus:ring-orange-500 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Column 3: Bill Summary matching Panel 4 */}
          <div className="md:col-span-4 bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <h3 className="font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-2">
                Bill Summary
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Items ({totalItemsCount})</span>
                  <span className="font-mono font-bold text-slate-800">
                    Rs. {cartSubtotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Discount</span>
                  <span className="font-mono font-bold text-emerald-600">
                    Rs. {totalDiscount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="font-black text-sm text-slate-900">Total</span>
                  <span className="font-mono font-black text-xl text-slate-900">
                    Rs. {cartTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons matching Panel 4 */}
            <div className="space-y-2 pt-2">
              {/* Primary: Complete Sale (Orange Button) */}
              <button
                type="button"
                onClick={handleCompleteSale}
                disabled={checkoutLoading || (selectedMethod === 'cash' && numReceived < cartTotal)}
                className="w-full py-3.5 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-orange-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {checkoutLoading ? 'Processing...' : 'Complete Sale'}
              </button>

              {/* Secondary: Print Receipt */}
              <button
                type="button"
                onClick={handleCompleteSale}
                className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Print Receipt</span>
              </button>

              {/* Tertiary: Send via WhatsApp */}
              <button
                type="button"
                onClick={handleCompleteSale}
                className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-emerald-600" />
                <span>Send via WhatsApp</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
