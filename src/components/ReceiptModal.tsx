import React, { useState, useEffect } from 'react';
import { Sale, Store } from '../types';
import { 
  Printer, 
  Share2, 
  X, 
  Check, 
  Copy, 
  Download, 
  ShoppingBag, 
  Receipt as ReceiptIcon,
  CheckCircle2,
  Volume2,
  Sparkles,
  Heart
} from 'lucide-react';
import { speakMessage } from '../lib/speech';

interface ReceiptModalProps {
  sale: Sale | null;
  store: Store | null;
  isOpen: boolean;
  onClose: () => void;
  voiceEnabled?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  store,
  isOpen,
  onClose,
  voiceEnabled = true
}) => {
  const [copied, setCopied] = useState(false);
  const [printStatus, setPrintStatus] = useState<string | null>(null);

  // Trigger audio voice greeting when checkout completes and receipt opens
  useEffect(() => {
    if (isOpen && sale && voiceEnabled) {
      const storeName = store?.name || sale?.storeName || 'our store';
      speakMessage(`Thank you for shopping at ${storeName}!`);
    }
  }, [isOpen, sale, voiceEnabled, store?.name]);

  const handleReplayVoice = () => {
    const storeName = store?.name || sale?.storeName || 'our store';
    speakMessage(`Thank you for shopping at ${storeName}!`);
  };

  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    setPrintStatus('Preparing printer...');

    // 1. Construct dedicated Thermal Receipt HTML window for crystal clear printing
    const storeName = store?.name || 'SUPERMARKET';
    const dateStr = new Date(sale.timestamp).toLocaleString();

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt #${sale.receiptNumber}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 78mm;
              margin: 0 auto;
              padding: 12px;
              color: #000;
              background: #fff;
              font-size: 11px;
              line-height: 1.3;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .uppercase { text-transform: uppercase; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .double-divider { border-top: 2px solid #000; margin: 8px 0; }
            .store-title { font-size: 16px; font-weight: bold; letter-spacing: -0.5px; margin-bottom: 2px; }
            .sub-title { font-size: 10px; font-weight: bold; letter-spacing: 1px; color: #333; margin-bottom: 6px; }
            .flex-row { display: flex; justify-content: space-between; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin: 6px 0; }
            th { border-bottom: 1px solid #000; text-align: left; padding: 3px 0; font-size: 10px; text-transform: uppercase; }
            td { padding: 3px 0; font-size: 11px; vertical-align: top; }
            .total-box { font-size: 14px; font-weight: bold; margin-top: 6px; }
            .barcode-stub { margin-top: 10px; font-size: 18px; font-family: 'Libre Barcode 128', monospace; letter-spacing: 4px; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="store-title">${storeName}</div>
            <div class="sub-title">OFFICIAL SALES INVOICE</div>
            <div>Receipt No: <strong>#${sale.receiptNumber}</strong></div>
            <div>${dateStr}</div>
          </div>

          <div class="divider"></div>

          <div>
            <div class="flex-row"><span>Cash Counter:</span><strong>${sale.counterName}</strong></div>
            <div class="flex-row"><span>Cashier:</span><strong>${sale.cashierUsername}</strong></div>
            <div class="flex-row"><span>Payment Method:</span><strong class="uppercase">${sale.paymentMethod}</strong></div>
          </div>

          <div class="divider"></div>

          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th class="text-center">Qty</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Total Price</th>
              </tr>
            </thead>
            <tbody>
              ${sale.items.map(item => `
                <tr>
                  <td><strong>${item.name}</strong></td>
                  <td class="text-center">${item.quantity}</td>
                  <td class="text-right">Rs. ${item.price.toFixed(2)}</td>
                  <td class="text-right">Rs. ${item.total.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="double-divider"></div>

          ${sale.discountAmount && sale.discountAmount > 0 ? `
            <div class="flex-row" style="margin-top: 4px; font-size: 11px;">
              <span>Subtotal:</span>
              <span>Rs. ${(sale.subtotalAmount || (sale.totalAmount + sale.discountAmount)).toFixed(2)}</span>
            </div>
            <div class="flex-row font-bold" style="margin-top: 2px; font-size: 11px; color: #047857;">
              <span>Discount ${sale.discountType === 'percentage' && sale.discountValue ? `(${sale.discountValue}%)` : ''}:</span>
              <span>-Rs. ${sale.discountAmount.toFixed(2)}</span>
            </div>
          ` : ''}

          <div class="flex-row total-box">
            <span>GRAND TOTAL:</span>
            <span>Rs. ${sale.totalAmount.toFixed(2)}</span>
          </div>

          ${sale.paymentMethod === 'cash' && sale.cashReceived !== undefined ? `
            <div class="flex-row" style="margin-top: 4px; font-size: 11px;">
              <span>Cash Received:</span>
              <span>Rs. ${sale.cashReceived.toFixed(2)}</span>
            </div>
            <div class="flex-row font-bold" style="font-size: 11px; color: #047857;">
              <span>Change Returned:</span>
              <span>Rs. ${(sale.changeReturned || 0).toFixed(2)}</span>
            </div>
          ` : ''}

          <div class="divider"></div>

          <div class="text-center" style="margin-top: 12px;">
            <p class="font-bold" style="margin: 0;">THANK YOU FOR SHOPPING AT ${(store?.name || sale?.storeName || 'OUR STORE').toUpperCase()}!</p>
            <p style="margin: 4px 0 0 0; font-size: 10px;">Please retain this receipt for returns or exchanges.</p>
            <div style="font-size: 10px; font-weight: bold; margin-top: 6px;">Ref: ${sale.receiptNumber}</div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 200);
            };
          </script>
        </body>
      </html>
    `;

    try {
      const printWin = window.open('', '_blank', 'width=450,height=600');
      if (printWin) {
        printWin.document.open();
        printWin.document.write(receiptHtml);
        printWin.document.close();
        printWin.focus();
        setPrintStatus('Receipt sent to printer!');
        setTimeout(() => setPrintStatus(null), 3000);
        return;
      }
    } catch (e) {
      console.warn('Popup blocked, falling back to window.print():', e);
    }

    // 2. Fallback in-page window.print() if popup blocker is active
    window.print();
    setPrintStatus('Printing receipt...');
    setTimeout(() => setPrintStatus(null), 3000);
  };

  const getFormattedReceiptText = () => {
    const storeName = store?.name || sale?.storeName || 'SUPERMARKET';
    let text = `===================================\n`;
    text += `       ${storeName}       \n`;
    text += `   OFFICIAL SALES RECEIPT / INVOICE \n`;
    text += `===================================\n`;
    text += `Receipt No: #${sale.receiptNumber}\n`;
    text += `Date: ${new Date(sale.timestamp).toLocaleString()}\n`;
    text += `Cashier: ${sale.cashierUsername} (${sale.counterName})\n`;
    text += `Payment Method: ${sale.paymentMethod.toUpperCase()}\n`;
    text += `-----------------------------------\n`;
    text += `ITEMS:\n`;
    sale.items.forEach((item, index) => {
      text += `${index + 1}. ${item.name}\n`;
      text += `   ${item.quantity} x Rs. ${item.price.toFixed(2)} = Rs. ${item.total.toFixed(2)}\n`;
    });
    text += `-----------------------------------\n`;
    if (sale.discountAmount && sale.discountAmount > 0) {
      const sub = sale.subtotalAmount || (sale.totalAmount + sale.discountAmount);
      text += `SUBTOTAL:     Rs. ${sub.toFixed(2)}\n`;
      text += `DISCOUNT${sale.discountType === 'percentage' && sale.discountValue ? ` (${sale.discountValue}%)` : ''}: -Rs. ${sale.discountAmount.toFixed(2)}\n`;
      text += `-----------------------------------\n`;
    }
    text += `TOTAL AMOUNT: Rs. ${sale.totalAmount.toFixed(2)}\n`;
    text += `===================================\n`;
    text += `  Thank you for shopping with ${storeName}!  \n`;
    text += `===================================\n`;
    return text;
  };

  const handleCopyText = () => {
    const text = getFormattedReceiptText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownloadText = () => {
    const text = getFormattedReceiptText();
    const element = document.createElement('a');
    const file = new Blob([text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `Receipt-${sale.receiptNumber}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleShare = async () => {
    const text = getFormattedReceiptText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receipt #${sale.receiptNumber}`,
          text: text
        });
      } catch (err) {
        console.log('Share canceled or error:', err);
      }
    } else {
      handleCopyText();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      
      {/* Print-Only Stylesheet override for in-page browser print fallback */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-receipt, #printable-receipt * {
            visibility: visible !important;
          }
          #printable-receipt {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            padding: 10mm !important;
            margin: 0 auto !important;
            color: #000 !important;
            background: #fff !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative space-y-5 max-h-[92vh] flex flex-col my-auto overflow-y-auto overscroll-contain custom-scrollbar">
        
        {/* Header (Hidden during print) */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 no-print shrink-0 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-200 shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Checkout Completed</h3>
              <p className="text-xs text-slate-500 font-medium">Transaction Receipt #{sale.receiptNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* THANK YOU FOR YOUR PURCHASE VOICE & TEXT BANNER */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 rounded-2xl shadow-md no-print flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in border border-emerald-500 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold tracking-wide uppercase flex items-center gap-1.5 text-white">
                Thank You For Shopping at {store?.name || sale?.storeName || 'Our Store'}!
              </h4>
              <p className="text-[11px] text-emerald-100 font-medium">
                Official Receipt Generated & Voice Greeting Announced
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReplayVoice}
            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-white/30 shrink-0"
            title="Play voice thank you greeting again"
          >
            <Volume2 className="w-4 h-4 text-amber-300" /> Speak Voice 🔊
          </button>
        </div>

        {/* Print Status Feedback */}
        {printStatus && (
          <div className="px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2 no-print animate-fade-in shrink-0">
            <Printer className="w-4 h-4 text-emerald-600 animate-pulse" />
            <span>{printStatus}</span>
          </div>
        )}

        {/* PRINTABLE RECEIPT CARD */}
        <div 
          id="printable-receipt" 
          className="bg-slate-50 text-slate-900 p-5 sm:p-6 rounded-2xl shadow-inner font-mono text-xs space-y-4 overflow-y-auto overscroll-contain max-h-[46vh] border border-slate-200 custom-scrollbar"
        >
          {/* Receipt Header */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
            <div className="font-extrabold text-base tracking-tight text-slate-900 uppercase">
              {store?.name || 'SUPERMARKET'}
            </div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
              Sales Invoice / Customer Copy
            </div>
            <div className="text-[10px] text-slate-600 pt-1">
              Receipt #: <span className="font-bold text-slate-900">#{sale.receiptNumber}</span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              {new Date(sale.timestamp).toLocaleString()}
            </div>
          </div>

          {/* Transaction Metadata */}
          <div className="grid grid-cols-2 text-[10px] text-slate-600 pb-2 border-b border-dashed border-slate-300 gap-y-1">
            <div>Counter: <span className="font-bold text-slate-800">{sale.counterName}</span></div>
            <div className="text-right">Cashier: <span className="font-bold text-slate-800">{sale.cashierUsername}</span></div>
            <div>Payment Method:</div>
            <div className="text-right font-bold uppercase text-slate-900">{sale.paymentMethod}</div>
          </div>

          {/* Items Table */}
          <div className="space-y-2 py-1">
            <div className="grid grid-cols-12 font-bold text-[10px] text-slate-500 uppercase border-b pb-1">
              <span className="col-span-5">Product Name</span>
              <span className="col-span-2 text-center">Qty</span>
              <span className="col-span-2 text-right">Unit Price</span>
              <span className="col-span-3 text-right">Total Price</span>
            </div>

            {sale.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 text-slate-900 text-[11px] py-0.5 items-center">
                <span className="col-span-5 font-semibold truncate">{item.name}</span>
                <span className="col-span-2 text-center font-bold">{item.quantity}</span>
                <span className="col-span-2 text-right text-slate-600">Rs. {item.price.toFixed(2)}</span>
                <span className="col-span-3 text-right font-extrabold text-slate-900">Rs. {item.total.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="pt-3 border-t-2 border-slate-900 space-y-1">
            {sale.discountAmount && sale.discountAmount > 0 ? (
              <>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono font-semibold">Rs. {(sale.subtotalAmount || (sale.totalAmount + sale.discountAmount)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-emerald-700">
                  <span>Discount {sale.discountType === 'percentage' && sale.discountValue ? `(${sale.discountValue}%)` : ''}:</span>
                  <span className="font-mono">-Rs. {sale.discountAmount.toFixed(2)}</span>
                </div>
              </>
            ) : null}

            <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
              <span>GRAND TOTAL:</span>
              <span className="text-orange-700">Rs. {sale.totalAmount.toFixed(2)}</span>
            </div>

            {sale.paymentMethod === 'cash' && sale.cashReceived !== undefined && (
              <>
                <div className="flex justify-between text-xs font-semibold text-slate-600 pt-1">
                  <span>Cash Received:</span>
                  <span className="font-mono">Rs. {sale.cashReceived.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-black text-emerald-700">
                  <span>Change Returned:</span>
                  <span className="font-mono">Rs. {(sale.changeReturned || 0).toFixed(2)}</span>
                </div>
              </>
            )}
          </div>

          {/* Footer message */}
          <div className="text-center pt-4 border-t border-dashed border-slate-300 text-[10px] text-slate-500 space-y-1">
            <p className="font-bold text-slate-800 uppercase">THANK YOU FOR SHOPPING AT {store?.name || sale?.storeName || 'OUR STORE'}!</p>
            <p>Please retain this receipt for returns or exchanges.</p>
          </div>
        </div>

        {/* Action Controls (Hidden during print) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 no-print pt-2 border-t border-slate-200 shrink-0">
          <button
            onClick={handlePrint}
            className="py-3 px-4 bg-orange-600 hover:bg-orange-500 text-white font-extrabold rounded-xl shadow-sm transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Print Receipt
          </button>

          <button
            onClick={handleShare}
            className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-200 rounded-xl transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-orange-600" /> Share
          </button>

          <button
            onClick={handleDownloadText}
            className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-200 rounded-xl transition-all text-xs flex items-center justify-center gap-2 cursor-pointer col-span-2 sm:col-span-1"
          >
            <Download className="w-4 h-4 text-emerald-600" /> Save TXT
          </button>
        </div>

      </div>
    </div>
  );
};

