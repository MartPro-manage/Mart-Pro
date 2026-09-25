import React, { useState } from 'react';
import { ProductReturn, Store } from '../types';
import { 
  Printer, 
  Share2, 
  X, 
  Copy, 
  Download, 
  RotateCcw,
  CheckCircle2,
  Banknote,
  Calendar,
  Layers
} from 'lucide-react';

interface ReturnSlipModalProps {
  returnRecord: ProductReturn | null;
  store: Store | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReturnSlipModal: React.FC<ReturnSlipModalProps> = ({
  returnRecord,
  store,
  isOpen,
  onClose
}) => {
  const [copied, setCopied] = useState(false);
  const [printStatus, setPrintStatus] = useState<string | null>(null);

  if (!isOpen || !returnRecord) return null;

  const itemsList = returnRecord.items && returnRecord.items.length > 0
    ? returnRecord.items
    : [{
        productId: returnRecord.productId,
        productName: returnRecord.productName,
        barcode: returnRecord.barcode,
        price: returnRecord.price,
        quantity: returnRecord.quantity,
        refundAmount: returnRecord.refundAmount,
        reason: returnRecord.reason
      }];

  const totalUnits = itemsList.reduce((sum, item) => sum + (item.quantity || 0), 0);

  const handlePrint = () => {
    setPrintStatus('Preparing return slip printer...');

    const storeName = store?.name || returnRecord.storeName || 'SUPERMARKET';
    const dateStr = new Date(returnRecord.timestamp).toLocaleString();

    const slipHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Return Slip #${returnRecord.returnSlipNumber}</title>
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
            .sub-title { font-size: 11px; font-weight: bold; letter-spacing: 1px; color: #b91c1c; margin-bottom: 6px; }
            .flex-row { display: flex; justify-content: space-between; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin: 6px 0; }
            th { border-bottom: 1px solid #000; text-align: left; padding: 3px 0; font-size: 10px; text-transform: uppercase; }
            td { padding: 3px 0; font-size: 11px; vertical-align: top; }
            .total-box { font-size: 14px; font-weight: bold; margin-top: 6px; color: #b91c1c; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="store-title">${storeName}</div>
            <div class="sub-title">CUSTOMER RETURN & REFUND VOUCHER</div>
            <div>Slip No: <strong>#${returnRecord.returnSlipNumber}</strong></div>
            <div>${dateStr}</div>
          </div>

          <div class="divider"></div>

          <div>
            <div class="flex-row"><span>Counter:</span><strong>${returnRecord.counterName}</strong></div>
            <div class="flex-row"><span>Cashier:</span><strong>${returnRecord.cashierUsername}</strong></div>
            <div class="flex-row"><span>Refund Mode:</span><strong class="uppercase">${returnRecord.refundMethod} REFUND</strong></div>
            ${returnRecord.originalReceiptNumber ? `<div class="flex-row"><span>Orig. Invoice:</span><strong>#${returnRecord.originalReceiptNumber}</strong></div>` : ''}
          </div>

          <div class="divider"></div>

          <table>
            <thead>
              <tr>
                <th>Returned Item</th>
                <th class="text-center">Qty</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Refund Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList.map(item => `
                <tr>
                  <td>
                    <strong>${item.productName}</strong>
                    ${item.barcode ? `<div style="font-size: 9px; color: #555;">Code: ${item.barcode}</div>` : ''}
                  </td>
                  <td class="text-center font-bold">${item.quantity}</td>
                  <td class="text-right">Rs. ${(item.price || 0).toFixed(2)}</td>
                  <td class="text-right font-bold">Rs. ${(item.refundAmount || 0).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="double-divider"></div>

          <div class="flex-row total-box">
            <span>TOTAL REFUNDED:</span>
            <span>Rs. ${(returnRecord.refundAmount ?? 0).toFixed(2)}</span>
          </div>

          ${returnRecord.reason ? `
            <div style="margin-top: 6px; font-size: 10px;">
              <strong>Return Reason:</strong> ${returnRecord.reason}
            </div>
          ` : ''}

          <div style="margin-top: 6px; font-size: 10px; color: #047857;">
            ✔ Restock Status: <strong>${totalUnits} unit(s) returned to store inventory</strong>
          </div>

          <div class="divider"></div>

          <div class="text-center" style="margin-top: 12px;">
            <p class="font-bold" style="margin: 0;">REFUND PROCESSED BY ${(store?.name || returnRecord.storeName || 'OUR STORE').toUpperCase()}</p>
            <p style="margin: 4px 0 0 0; font-size: 10px;">Amount deducted from sales register & returned to inventory.</p>
            <div style="font-size: 10px; font-weight: bold; margin-top: 6px;">Ref: ${returnRecord.returnSlipNumber}</div>
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
        printWin.document.write(slipHtml);
        printWin.document.close();
        printWin.focus();
        setPrintStatus('Return slip sent to printer!');
        setTimeout(() => setPrintStatus(null), 3000);
        return;
      }
    } catch (e) {
      console.warn('Popup blocked, falling back to window.print():', e);
    }

    window.print();
    setPrintStatus('Printing return slip...');
    setTimeout(() => setPrintStatus(null), 3000);
  };

  const getFormattedSlipText = () => {
    const storeName = store?.name || returnRecord.storeName || 'SUPERMARKET';
    let text = `===================================\n`;
    text += `       ${storeName}       \n`;
    text += `  CUSTOMER RETURN & REFUND VOUCHER \n`;
    text += `===================================\n`;
    text += `Return Slip No: #${returnRecord.returnSlipNumber}\n`;
    text += `Date: ${new Date(returnRecord.timestamp).toLocaleString()}\n`;
    text += `Cashier: ${returnRecord.cashierUsername} (${returnRecord.counterName})\n`;
    text += `Refund Method: ${returnRecord.refundMethod.toUpperCase()}\n`;
    if (returnRecord.originalReceiptNumber) {
      text += `Original Invoice: #${returnRecord.originalReceiptNumber}\n`;
    }
    text += `-----------------------------------\n`;
    text += `RETURNED ITEM:\n`;
    text += `1. ${returnRecord.productName}\n`;
    text += `   ${returnRecord.quantity} x Rs. ${(returnRecord.price ?? (returnRecord as any).unitPrice ?? 0).toFixed(2)} = Rs. ${(returnRecord.refundAmount ?? 0).toFixed(2)}\n`;
    if (returnRecord.reason) {
      text += `Reason: ${returnRecord.reason}\n`;
    }
    text += `-----------------------------------\n`;
    text += `TOTAL REFUNDED: Rs. ${(returnRecord.refundAmount ?? 0).toFixed(2)}\n`;
    text += `RESTOCKED:      ${returnRecord.quantity} units replenished to inventory\n`;
    text += `===================================\n`;
    text += `  Refund processed successfully.   \n`;
    text += `===================================\n`;
    return text;
  };

  const handleCopyText = () => {
    const text = getFormattedSlipText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownloadText = () => {
    const text = getFormattedSlipText();
    const element = document.createElement('a');
    const file = new Blob([text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `ReturnSlip-${returnRecord.returnSlipNumber}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto overscroll-contain">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative space-y-5 max-h-[92vh] flex flex-col my-auto overflow-y-auto overscroll-contain custom-scrollbar">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 shrink-0 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-rose-50 text-rose-700 rounded-2xl border border-rose-200 shadow-sm">
              <RotateCcw className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Return & Refund Processed</h3>
              <p className="text-xs text-slate-500 font-medium">Slip #{returnRecord.returnSlipNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Restocked Banner */}
        <div className="bg-gradient-to-r from-rose-600 to-amber-600 text-white p-4 rounded-2xl shadow-md flex items-center justify-between gap-3 border border-rose-500 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm shrink-0">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold tracking-wide uppercase text-white">
                Item Returned to Stock
              </h4>
              <p className="text-[11px] text-rose-100 font-medium">
                +{returnRecord.quantity} units added back to inventory. Rs. {(returnRecord.refundAmount ?? 0).toFixed(2)} deducted from revenue.
              </p>
            </div>
          </div>
        </div>

        {/* Status */}
        {printStatus && (
          <div className="px-4 py-2 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0">
            <Printer className="w-4 h-4 text-rose-600 animate-pulse" />
            <span>{printStatus}</span>
          </div>
        )}

        {/* Printable Card */}
        <div className="bg-slate-50 text-slate-900 p-5 rounded-2xl shadow-inner font-mono text-xs space-y-4 border border-slate-200">
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
            <div className="font-extrabold text-base tracking-tight text-slate-900 uppercase">
              {store?.name || returnRecord.storeName || 'SUPERMARKET'}
            </div>
            <div className="text-[10px] text-rose-700 uppercase tracking-widest font-bold">
              Official Customer Return Voucher
            </div>
            <div className="text-[10px] text-slate-600 pt-1">
              Slip #: <span className="font-bold text-slate-900">#{returnRecord.returnSlipNumber}</span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              {new Date(returnRecord.timestamp).toLocaleString()}
            </div>
          </div>

          <div className="grid grid-cols-2 text-[10px] text-slate-600 pb-2 border-b border-dashed border-slate-300 gap-y-1">
            <div>Counter: <span className="font-bold text-slate-800">{returnRecord.counterName}</span></div>
            <div className="text-right">Cashier: <span className="font-bold text-slate-800">{returnRecord.cashierUsername}</span></div>
            <div>Refund Method:</div>
            <div className="text-right font-bold uppercase text-rose-700">{returnRecord.refundMethod} Refund</div>
            {returnRecord.originalReceiptNumber && (
              <>
                <div>Original Invoice:</div>
                <div className="text-right font-bold text-slate-900">#{returnRecord.originalReceiptNumber}</div>
              </>
            )}
          </div>

          <div className="space-y-2 py-1">
            <div className="grid grid-cols-12 font-bold text-[10px] text-slate-500 uppercase border-b pb-1">
              <span className="col-span-6">Returned Product</span>
              <span className="col-span-2 text-center">Qty</span>
              <span className="col-span-2 text-right">Price</span>
              <span className="col-span-2 text-right">Refund</span>
            </div>

            {itemsList.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 text-slate-900 text-[11px] py-0.5 items-center">
                <span className="col-span-6 font-semibold truncate">{item.productName}</span>
                <span className="col-span-2 text-center font-bold text-rose-600">+{item.quantity}</span>
                <span className="col-span-2 text-right text-slate-600">Rs. {(item.price || 0).toFixed(2)}</span>
                <span className="col-span-2 text-right font-extrabold text-rose-700">Rs. {(item.refundAmount || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t-2 border-slate-900 space-y-1">
            <div className="flex justify-between text-sm font-black text-slate-900 pt-1">
              <span>TOTAL REFUNDED:</span>
              <span className="text-rose-700">Rs. {(returnRecord.refundAmount ?? 0).toFixed(2)}</span>
            </div>
            {returnRecord.reason && (
              <div className="text-[10px] text-slate-600 pt-1">
                <strong>Reason:</strong> {returnRecord.reason}
              </div>
            )}
            <div className="text-[10px] text-emerald-700 font-bold pt-1">
              ✔ Stock status: {returnRecord.quantity} units successfully replenished to inventory.
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-200 shrink-0">
          <button
            onClick={handlePrint}
            className="py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-xl shadow-sm transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Print Slip
          </button>

          <button
            onClick={handleCopyText}
            className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-200 rounded-xl transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Copy className="w-4 h-4 text-slate-600" /> {copied ? 'Copied!' : 'Copy Text'}
          </button>

          <button
            onClick={handleDownloadText}
            className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-200 rounded-xl transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-600" /> Save TXT
          </button>
        </div>

      </div>
    </div>
  );
};
