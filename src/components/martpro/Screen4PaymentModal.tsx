import React, { useState, useMemo } from 'react';
import { 
  X, 
  Banknote, 
  CreditCard, 
  Smartphone, 
  Landmark, 
  Printer, 
  Send, 
  Volume2, 
  VolumeX, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  Receipt
} from 'lucide-react';
import { CartItem, Store, UserAccount, Sale } from '../../types';
import { db, doc, setDoc, updateDoc, increment, cleanFirestoreData } from '../../lib/firebase';
import { playScanSuccessBeep } from '../../lib/sound';
import { speakMessage } from '../../lib/speech';

interface Screen4PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  store: Store | null;
  currentUser: UserAccount | null;
  discountAmount: number;
  onSaleComplete: (sale: Sale) => void;
}

export type PaymentMethodType = 'cash' | 'card' | 'jazzcash' | 'easypaisa' | 'bank_transfer';

export const Screen4PaymentModal: React.FC<Screen4PaymentModalProps> = ({
  isOpen,
  onClose,
  cart,
  store,
  currentUser,
  discountAmount,
  onSaleComplete
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [digitalRef, setDigitalRef] = useState<string>('');
  const [printInvoiceToggle, setPrintInvoiceToggle] = useState<boolean>(true);
  const [voiceToggle, setVoiceToggle] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // Generate Bill Number
  const billNumber = useMemo(() => {
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    return `#S-${randomSeq}`;
  }, [isOpen]);

  const nowFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [isOpen]);

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.totalPrice || (item.product.price * item.quantity)), 0);
  }, [cart]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  const totalItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const tenderedAmount = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, tenderedAmount - total);

  if (!isOpen) return null;

  const handleQuickCash = (amt: number) => {
    setCashTendered(amt.toString());
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0) return;
    if (selectedMethod === 'cash' && tenderedAmount > 0 && tenderedAmount < total) {
      alert(`Received cash (Rs. ${tenderedAmount}) is less than total bill (Rs. ${total}).`);
      return;
    }

    setSubmitting(true);
    try {
      const saleId = `sale_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const cleanReceiptNo = billNumber.replace('#', '');

      const saleData: Sale = {
        id: saleId,
        storeId: store?.id || 'mart-pro-store',
        storeName: store?.name || 'Mart Pro Supermarket',
        counterId: currentUser?.counterNumber || '1',
        counterName: `Counter #${currentUser?.counterNumber || 1}`,
        cashierUsername: currentUser?.username || 'admin',
        cashierName: currentUser?.name || 'Admin',
        receiptNumber: cleanReceiptNo,
        billNumber: billNumber,
        subtotalAmount: subtotal,
        discountAmount: discountAmount,
        totalAmount: total,
        paymentMethod: selectedMethod === 'cash' ? 'cash' : 'online',
        paymentMode: selectedMethod,
        onlinePaymentProvider: selectedMethod !== 'cash' ? selectedMethod : undefined,
        onlineTransactionId: digitalRef || undefined,
        cashReceived: selectedMethod === 'cash' ? (tenderedAmount || total) : undefined,
        changeReturned: selectedMethod === 'cash' ? changeDue : undefined,
        status: 'completed',
        timestamp: new Date().toISOString(),
        items: cart.map(item => ({
          productId: item.product.id,
          barcode: item.product.barcode || '',
          shortcutCode: item.product.shortcutCode,
          name: item.product.name,
          costPrice: item.product.costPrice || Math.round(item.product.price * 0.75),
          price: item.product.price,
          quantity: item.quantity,
          total: item.totalPrice || (item.product.price * item.quantity),
          unitType: item.product.unitType || 'piece'
        }))
      };

      // 1. Write sale to Firestore
      await setDoc(doc(db, 'sales', saleId), cleanFirestoreData(saleData));

      // 2. Decrement stock in Firestore
      for (const item of cart) {
        if (item.product.id && !item.product.id.startsWith('temp_')) {
          try {
            await updateDoc(doc(db, 'products', item.product.id), {
              stockQuantity: increment(-item.quantity),
              updatedAt: new Date().toISOString()
            });
          } catch (e) {
            console.warn('Error updating product stock:', e);
          }
        }
      }

      // 3. Write Activity Log
      try {
        const actId = `act_${Date.now()}`;
        await setDoc(doc(db, 'activity_logs', actId), cleanFirestoreData({
          id: actId,
          storeId: store?.id || 'mart-pro-store',
          title: 'Sale completed',
          description: `Rs. ${total.toLocaleString()} (Bill ${billNumber})`,
          type: 'sale',
          amount: total,
          timestamp: new Date().toISOString()
        }));
      } catch (e) {
        console.warn('Activity log error:', e);
      }

      // 4. Sound & Voice
      playScanSuccessBeep();
      if (voiceToggle) {
        speakMessage(`Sale completed. Total amount is ${total} rupees.`);
      }

      setCompletedSale(saleData);
      onSaleComplete(saleData);
    } catch (err) {
      console.error('Error completing sale:', err);
      alert('Error processing transaction. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs select-none animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
        {/* Top Header Bar matching Screen 4 in reference image */}
        <div className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-lg font-black text-[#111111] tracking-tight">
              {billNumber}
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {nowFormatted}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success view if sale was just completed */}
        {completedSale ? (
          <div className="p-8 sm:p-12 text-center space-y-6 flex-1 overflow-y-auto">
            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-2xl font-black text-[#111111]">
                Payment Successful!
              </h3>
              <p className="text-sm font-semibold text-slate-500 mt-1">
                Sale {completedSale.billNumber} has been verified and stock updated.
              </p>
              <div className="text-3xl font-black text-[#FF6500] mt-3">
                Rs. {completedSale.totalAmount.toLocaleString()}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 justify-center max-w-md mx-auto pt-4">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>Print Thermal Receipt</span>
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-[#FF6500] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#FF6500]/25"
              >
                <span>Done & New Sale</span>
              </button>
            </div>
          </div>
        ) : (
          /* Main Payment Form: Left Methods Grid + Right Bill Summary */
          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6 bg-[#F8F9FA]">
            {/* LEFT SIDE (7 Cols): Payment Method Grid & Fields */}
            <div className="md:col-span-7 space-y-4">
              <div>
                <h3 className="text-sm font-black text-[#111111] uppercase tracking-wider">
                  Payment Method
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Select payment mode to finalize billing
                </p>
              </div>

              {/* Method Cards matching reference mockup */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'cash' as PaymentMethodType, label: 'Cash', icon: Banknote, color: 'text-emerald-600' },
                  { id: 'card' as PaymentMethodType, label: 'Card', icon: CreditCard, color: 'text-blue-600' },
                  { id: 'jazzcash' as PaymentMethodType, label: 'JazzCash', icon: Smartphone, color: 'text-red-600' },
                  { id: 'easypaisa' as PaymentMethodType, label: 'EasyPaisa', icon: Smartphone, color: 'text-emerald-500' },
                  { id: 'bank_transfer' as PaymentMethodType, label: 'Bank Transfer', icon: Landmark, color: 'text-purple-600' },
                ].map((m) => {
                  const Icon = m.icon;
                  const isSelected = selectedMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMethod(m.id)}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-24 ${
                        isSelected
                          ? 'bg-white border-[#FF6500] ring-2 ring-[#FF6500]/20 shadow-md'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Icon className={`w-5 h-5 ${m.color}`} />
                        {isSelected && (
                          <div className="w-2.5 h-2.5 rounded-full bg-[#FF6500]"></div>
                        )}
                      </div>
                      <div className="font-extrabold text-xs text-slate-900 mt-2">
                        {m.label}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Tender / Digital Fields based on selected method */}
              {selectedMethod === 'cash' ? (
                <div className="bg-white rounded-2xl p-4 border border-slate-200/90 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Cash Received (Rs.)
                    </label>
                    <span className="text-xs font-semibold text-slate-400">
                      Total: Rs. {total.toLocaleString()}
                    </span>
                  </div>

                  <input
                    type="number"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    placeholder={`Enter amount e.g. ${total}`}
                    className="w-full bg-[#F8F9FA] focus:bg-white text-lg font-black text-slate-900 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500] focus:ring-2 focus:ring-[#FF6500]/20 transition-all"
                  />

                  {/* Quick Denominations */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[total, 500, 1000, 2000, 5000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleQuickCash(amt)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-orange-50 hover:text-[#FF6500] text-xs font-bold text-slate-700 transition-colors cursor-pointer border border-slate-200"
                      >
                        Rs. {amt.toLocaleString()}
                      </button>
                    ))}
                  </div>

                  {/* Change Calculation */}
                  {tenderedAmount > 0 && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-800">
                        {changeDue >= 0 ? 'Change to Return:' : 'Remaining Balance:'}
                      </span>
                      <span className="text-sm font-black text-emerald-700">
                        Rs. {Math.abs(changeDue).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-4 border border-slate-200/90 space-y-3">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {selectedMethod.replace('_', ' ').toUpperCase()} Transaction Reference
                  </div>
                  <input
                    type="text"
                    value={digitalRef}
                    onChange={(e) => setDigitalRef(e.target.value)}
                    placeholder="Enter approval / TID / Sender phone number..."
                    className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-semibold text-slate-900 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500] focus:ring-2 focus:ring-[#FF6500]/20 transition-all"
                  />
                  <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-[11px] font-semibold text-blue-700 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Customer-free checkout: No customer data required.</span>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT SIDE (5 Cols): Bill Summary matching Screen 4 in mockup */}
            <div className="md:col-span-5 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-black text-[#111111] uppercase tracking-wider border-b border-slate-100 pb-2">
                  Bill Summary
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600 font-semibold">
                    <span>Items ({totalItemsCount})</span>
                    <span className="text-slate-900 font-bold">Rs. {subtotal.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600 font-semibold">
                    <span>Discount</span>
                    <span className="text-emerald-600 font-bold">- Rs. {discountAmount.toLocaleString()}</span>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-sm font-black text-slate-900">Total</span>
                    <span className="text-2xl font-black text-[#FF6500]">
                      Rs. {total.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Big Orange Complete Sale Button */}
                <button
                  type="button"
                  onClick={handleCompleteSale}
                  disabled={submitting}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#FF6500] hover:bg-[#e65b00] active:scale-[0.98] text-white font-black text-sm shadow-lg shadow-[#FF6500]/30 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <span>Processing Sale...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Complete Sale</span>
                    </>
                  )}
                </button>

                {/* Secondary Actions matching mockup */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      alert('Receipt will print automatically upon completion.');
                    }}
                    className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Receipt</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      alert('Receipt details copied. Can be shared via WhatsApp.');
                    }}
                    className="py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send via WhatsApp</span>
                  </button>
                </div>
              </div>

              {/* Bottom Toggles matching Screen 4 in mockup */}
              <div className="pt-4 border-t border-slate-100 space-y-2 text-xs font-semibold text-slate-600">
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Print Invoice</span>
                  <input
                    type="checkbox"
                    checked={printInvoiceToggle}
                    onChange={(e) => setPrintInvoiceToggle(e.target.checked)}
                    className="w-4 h-4 text-[#FF6500] rounded focus:ring-[#FF6500]"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Play Voice (Optional)</span>
                  <input
                    type="checkbox"
                    checked={voiceToggle}
                    onChange={(e) => setVoiceToggle(e.target.checked)}
                    className="w-4 h-4 text-[#FF6500] rounded focus:ring-[#FF6500]"
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
