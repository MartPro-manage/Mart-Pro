import React, { useState, useEffect, useRef } from 'react';
import { Sale, Store } from '../types';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import { getReceiptRemainingDays } from '../lib/salesCleanup';
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
  QrCode as QrCodeIcon, 
  Smartphone, 
  FileText, 
  ExternalLink,
  ShieldCheck,
  Image as ImageIcon,
  Link,
  Clock
} from 'lucide-react';
import { speakMessage } from '../lib/speech';

interface ReceiptModalProps {
  sale: Sale | null;
  store: Store | null;
  isOpen: boolean;
  onClose: () => void;
  voiceEnabled?: boolean;
  initialTab?: 'print' | 'ereceipt';
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  store,
  isOpen,
  onClose,
  voiceEnabled = true,
  initialTab = 'print'
}) => {
  const [activeReceiptMode, setActiveReceiptMode] = useState<'print' | 'ereceipt'>('print');
  const [copied, setCopied] = useState(false);
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const receiptCardRef = useRef<HTMLDivElement | null>(null);

  const curr = store?.currencySymbol || 'Rs.';
  const receiptSubHeader = store?.receiptHeader || 'OFFICIAL SALES INVOICE';
  const receiptFooterText = store?.receiptFooter || `THANK YOU FOR SHOPPING AT ${(store?.name || sale?.storeName || 'OUR STORE').toUpperCase()}! Please retain slip for return.`;
  const isVoiceAllowed = store?.voiceAnnouncementEnabled !== false;

  useEffect(() => {
    if (initialTab) {
      setActiveReceiptMode(initialTab);
    }
  }, [initialTab, isOpen]);

  // Trigger audio voice greeting with bill total when checkout completes and receipt opens
  useEffect(() => {
    if (isOpen && sale && voiceEnabled && isVoiceAllowed) {
      const storeName = store?.name || sale?.storeName || 'our store';
      const formattedTotal = sale.totalAmount % 1 === 0 ? sale.totalAmount.toFixed(0) : sale.totalAmount.toFixed(2);
      speakMessage(`Total bill is ${formattedTotal} rupees. Thank you for shopping at ${storeName}!`);
    }
  }, [isOpen, sale, voiceEnabled, isVoiceAllowed, store?.name]);

  const handleReplayVoice = () => {
    if (!sale || !isVoiceAllowed) return;
    const storeName = store?.name || sale?.storeName || 'our store';
    const formattedTotal = sale.totalAmount % 1 === 0 ? sale.totalAmount.toFixed(0) : sale.totalAmount.toFixed(2);
    speakMessage(`Total bill is ${formattedTotal} rupees. Thank you for shopping at ${storeName}!`);
  };

  const getFormattedReceiptText = () => {
    if (!sale) return '';
    const storeName = store?.name || sale?.storeName || 'SUPERMARKET';
    let text = `===================================\n`;
    text += `       ${storeName}       \n`;
    text += `   OFFICIAL SALES RECEIPT / INVOICE \n`;
    text += `===================================\n`;
    text += `Receipt No: #${sale.receiptNumber}\n`;
    text += `Date: ${new Date(sale.timestamp).toLocaleString()}\n`;
    text += `Counter: ${sale.counterName} (${sale.cashierUsername})\n`;
    text += `Payment Method: ${sale.paymentMethod.toUpperCase()}\n`;
    text += `-----------------------------------\n`;
    text += `ITEMS:\n`;
    sale.items.forEach((item, index) => {
      const isWeight = item.sellBy === 'weight' || item.unitType === 'kg' || item.quantity % 1 !== 0;
      const qtyText = isWeight ? `${item.quantity}kg` : `${item.quantity}`;
      text += `${index + 1}. ${item.name}\n`;
      text += `   ${qtyText} x ${curr} ${item.price.toFixed(2)} = ${curr} ${item.total.toFixed(2)}\n`;
    });
    text += `-----------------------------------\n`;
    if (sale.discountAmount && sale.discountAmount > 0) {
      const sub = sale.subtotalAmount || (sale.totalAmount + sale.discountAmount);
      text += `SUBTOTAL:     ${curr} ${sub.toFixed(2)}\n`;
      text += `DISCOUNT${sale.discountType === 'percentage' && sale.discountValue ? ` (${sale.discountValue}%)` : ''}: -${curr} ${sale.discountAmount.toFixed(2)}\n`;
      text += `-----------------------------------\n`;
    }
    text += `TOTAL AMOUNT: ${curr} ${sale.totalAmount.toFixed(2)}\n`;
    if (sale.paymentMethod === 'cash' && sale.cashReceived !== undefined) {
      text += `CASH RECEIVED:   ${curr} ${sale.cashReceived.toFixed(2)}\n`;
      text += `CHANGE RETURNED: ${curr} ${(sale.changeReturned || 0).toFixed(2)}\n`;
    }
    text += `===================================\n`;
    text += `  ${receiptFooterText}  \n`;
    text += `===================================\n`;
    return text;
  };

  const getReceiptHtmlContent = () => {
    if (!sale) return '';
    const storeName = store?.name || 'SUPERMARKET';
    const dateStr = new Date(sale.timestamp).toLocaleString();

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>E-Receipt #${sale.receiptNumber} - ${storeName}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              max-width: 440px;
              margin: 20px auto;
              padding: 20px;
              color: #1e293b;
              background: #f8fafc;
              font-size: 13px;
              line-height: 1.4;
            }
            .card {
              background: #fff;
              border: 1px solid #e2e8f0;
              border-radius: 16px;
              padding: 20px;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .uppercase { text-transform: uppercase; }
            .divider { border-top: 1px dashed #cbd5e1; margin: 12px 0; }
            .double-divider { border-top: 2px solid #0f172a; margin: 12px 0; }
            .store-title { font-size: 18px; font-weight: 900; color: #0f172a; margin-bottom: 2px; }
            .sub-title { font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.5px; }
            .meta-line { font-size: 11px; color: #475569; }
            .flex-row { display: flex; justify-content: space-between; font-size: 12px; margin: 3px 0; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th { border-bottom: 1px solid #0f172a; text-align: left; padding: 6px 0; font-size: 11px; text-transform: uppercase; color: #475569; }
            td { padding: 6px 0; font-size: 12px; vertical-align: top; border-bottom: 1px solid #f1f5f9; }
            .total-box { font-size: 16px; font-weight: 900; color: #c2410c; margin-top: 8px; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; background: #ecfdf5; color: #047857; font-size: 10px; font-weight: 800; }
            .download-btn { display: block; width: 100%; padding: 12px; background: #ea580c; color: #fff; text-align: center; font-weight: bold; text-decoration: none; border-radius: 12px; margin-top: 16px; font-size: 13px; border: none; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="text-center">
              <span class="badge">OFFICIAL VERIFIED E-RECEIPT</span>
              <div class="store-title" style="margin-top: 8px;">${storeName}</div>
              <div class="sub-title">${receiptSubHeader}</div>
              ${store?.address ? `<div class="meta-line">${store.address}</div>` : ''}
              ${store?.phone ? `<div class="meta-line">Tel: ${store.phone}</div>` : ''}
              ${store?.taxRegistrationNumber ? `<div class="meta-line font-bold">${store.taxRegistrationNumber}</div>` : ''}
              <div style="margin-top: 8px;">Receipt No: <strong>#${sale.receiptNumber}</strong></div>
              <div style="color: #64748b; font-size: 11px;">${dateStr}</div>
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
                  <th>Product</th>
                  <th class="text-center">Qty</th>
                  <th class="text-right">Price</th>
                  <th class="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${sale.items.map(item => {
                  const isWeight = item.sellBy === 'weight' || item.unitType === 'kg' || item.quantity % 1 !== 0;
                  const qtyText = isWeight ? `${item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(3)} kg` : item.quantity.toString();
                  return `
                    <tr>
                      <td><strong>${item.name}</strong>${item.weightInfo ? `<br/><small style="color:#64748b">${item.weightInfo}</small>` : ''}</td>
                      <td class="text-center font-bold">${qtyText}</td>
                      <td class="text-right">${curr} ${item.price.toFixed(2)}${isWeight ? '/kg' : ''}</td>
                      <td class="text-right font-bold">${curr} ${item.total.toFixed(2)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>

            <div class="double-divider"></div>

            ${sale.discountAmount && sale.discountAmount > 0 ? `
              <div class="flex-row" style="color: #64748b;">
                <span>Subtotal:</span>
                <span>${curr} ${(sale.subtotalAmount || (sale.totalAmount + sale.discountAmount)).toFixed(2)}</span>
              </div>
              <div class="flex-row font-bold" style="color: #047857;">
                <span>Discount ${sale.discountType === 'percentage' && sale.discountValue ? `(${sale.discountValue}%)` : ''}:</span>
                <span>-${curr} ${sale.discountAmount.toFixed(2)}</span>
              </div>
            ` : ''}

            <div class="flex-row total-box">
              <span>GRAND TOTAL:</span>
              <span>${curr} ${sale.totalAmount.toFixed(2)}</span>
            </div>

            ${sale.paymentMethod === 'cash' && sale.cashReceived !== undefined ? `
              <div class="flex-row" style="margin-top: 4px;">
                <span>Cash Received:</span>
                <span>${curr} ${sale.cashReceived.toFixed(2)}</span>
              </div>
              <div class="flex-row font-bold" style="color: #047857;">
                <span>Change Returned:</span>
                <span>${curr} ${(sale.changeReturned || 0).toFixed(2)}</span>
              </div>
            ` : ''}

            <div class="divider"></div>

            <div class="text-center" style="margin-top: 12px;">
              <p class="font-bold" style="margin: 0; font-size: 11px;">${receiptFooterText}</p>
              <div style="font-size: 10px; color: #94a3b8; margin-top: 6px;">Ref: ${sale.receiptNumber}</div>
            </div>

            <button onclick="window.print()" class="download-btn">🖨️ Save / Print Receipt</button>
          </div>
        </body>
      </html>
    `;
  };

  // Detect base public URL for QR code (always uses public preview endpoint so mobile devices never hit 403 Forbidden)
  const getPublicAppBaseUrl = () => {
    if (typeof window === 'undefined') return 'https://ais-pre-tmjddyvpgndkt25xrveelm-532990536644.asia-southeast1.run.app';
    let currentOrigin = window.location.origin;

    // Replace internal dev environment subdomain with public preview subdomain
    if (currentOrigin.includes('ais-dev-')) {
      currentOrigin = currentOrigin.replace('ais-dev-', 'ais-pre-');
    }

    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !currentOrigin.startsWith('http')) {
      return 'https://ais-pre-tmjddyvpgndkt25xrveelm-532990536644.asia-southeast1.run.app';
    }
    return currentOrigin;
  };

  // Helper to build direct, fast, self-contained E-Receipt URL
  const getReceiptDirectUrl = (): string => {
    if (!sale) return '';
    const baseUrl = getPublicAppBaseUrl();
    return `${baseUrl}?receiptId=${encodeURIComponent(sale.id || sale.receiptNumber)}&no=${encodeURIComponent(sale.receiptNumber)}`;
  };

  const receiptUrl = sale ? getReceiptDirectUrl() : '';

  // Generate QR Code for E-Receipt (encodes live receipt URL for instant mobile viewing & downloading)
  useEffect(() => {
    if (!sale) return;

    let isMounted = true;
    const generateQr = async () => {
      try {
        const targetUrl = receiptUrl || `${getPublicAppBaseUrl()}?receiptId=${sale.id}&no=${sale.receiptNumber}`;
        
        const dataUrl = await QRCode.toDataURL(targetUrl, {
          width: 360,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#0f172a',
            light: '#ffffff'
          }
        });
        if (isMounted) {
          setQrCodeDataUrl(dataUrl);
        }
      } catch (err) {
        console.error('Failed to generate QR Code for E-Receipt:', err);
        try {
          const fallbackUrl = `${getPublicAppBaseUrl()}?receiptId=${sale.id}`;
          const dataUrl = await QRCode.toDataURL(fallbackUrl, { width: 360, margin: 2 });
          if (isMounted) {
            setQrCodeDataUrl(dataUrl);
          }
        } catch (e2) {
          console.error('Fallback QR code also failed:', e2);
        }
      }
    };

    generateQr();
    return () => {
      isMounted = false;
    };
  }, [sale, store, receiptUrl]);

  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    setPrintStatus('Preparing printer...');
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
            .sub-title { font-size: 10px; font-weight: bold; letter-spacing: 1px; color: #333; margin-bottom: 4px; }
            .meta-line { font-size: 10px; color: #444; }
            .flex-row { display: flex; justify-content: space-between; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin: 6px 0; }
            th { border-bottom: 1px solid #000; text-align: left; padding: 3px 0; font-size: 10px; text-transform: uppercase; }
            td { padding: 3px 0; font-size: 11px; vertical-align: top; }
            .total-box { font-size: 14px; font-weight: bold; margin-top: 6px; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="store-title">${storeName}</div>
            <div class="sub-title">${receiptSubHeader}</div>
            ${store?.address ? `<div class="meta-line">${store.address}</div>` : ''}
            ${store?.phone ? `<div class="meta-line">Tel: ${store.phone}</div>` : ''}
            ${store?.taxRegistrationNumber ? `<div class="meta-line font-bold">${store.taxRegistrationNumber}</div>` : ''}
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
                <th class="text-right">Price</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${sale.items.map(item => {
                const isWeight = item.sellBy === 'weight' || item.unitType === 'kg' || item.quantity % 1 !== 0;
                const qtyText = isWeight ? `${item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(3)} kg` : item.quantity.toString();
                return `
                  <tr>
                    <td><strong>${item.name}</strong>${item.weightInfo ? `<br/><small style="color:#666">${item.weightInfo}</small>` : ''}</td>
                    <td class="text-center">${qtyText}</td>
                    <td class="text-right">${curr} ${item.price.toFixed(2)}${isWeight ? '/kg' : ''}</td>
                    <td class="text-right">${curr} ${item.total.toFixed(2)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="double-divider"></div>

          ${sale.discountAmount && sale.discountAmount > 0 ? `
            <div class="flex-row" style="margin-top: 4px; font-size: 11px;">
              <span>Subtotal:</span>
              <span>${curr} ${(sale.subtotalAmount || (sale.totalAmount + sale.discountAmount)).toFixed(2)}</span>
            </div>
            <div class="flex-row font-bold" style="margin-top: 2px; font-size: 11px; color: #047857;">
              <span>Discount ${sale.discountType === 'percentage' && sale.discountValue ? `(${sale.discountValue}%)` : ''}:</span>
              <span>-${curr} ${sale.discountAmount.toFixed(2)}</span>
            </div>
          ` : ''}

          <div class="flex-row total-box">
            <span>GRAND TOTAL:</span>
            <span>${curr} ${sale.totalAmount.toFixed(2)}</span>
          </div>

          ${sale.paymentMethod === 'cash' && sale.cashReceived !== undefined ? `
            <div class="flex-row" style="margin-top: 4px; font-size: 11px;">
              <span>Cash Received:</span>
              <span>${curr} ${sale.cashReceived.toFixed(2)}</span>
            </div>
            <div class="flex-row font-bold" style="font-size: 11px; color: #047857;">
              <span>Change Returned:</span>
              <span>${curr} ${(sale.changeReturned || 0).toFixed(2)}</span>
            </div>
          ` : ''}

          <div class="divider"></div>

          <div class="text-center" style="margin-top: 12px;">
            <p class="font-bold" style="margin: 0;">${receiptFooterText}</p>
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

    window.print();
    setPrintStatus('Printing receipt...');
    setTimeout(() => setPrintStatus(null), 3000);
  };

  const handleCopyText = () => {
    const text = getFormattedReceiptText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleCopyLink = () => {
    if (!receiptUrl) return;
    navigator.clipboard.writeText(receiptUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 3000);
  };

  const handleDownloadImage = async () => {
    const element = receiptCardRef.current || document.getElementById('thermal-receipt-preview');
    if (!element) return;

    setIsExportingImage(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `Receipt-${sale?.receiptNumber || 'bill'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to generate image:', err);
    } finally {
      setIsExportingImage(false);
    }
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

  const handleDownloadHtml = () => {
    const html = getReceiptHtmlContent();
    const element = document.createElement('a');
    const file = new Blob([html], { type: 'text/html' });
    element.href = URL.createObjectURL(file);
    element.download = `E-Receipt-${sale.receiptNumber}.html`;
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

        {/* THANK YOU VOICE BANNER */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-3.5 rounded-2xl shadow-md no-print flex items-center justify-between gap-3 border border-emerald-500 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm shrink-0">
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold tracking-wide uppercase text-white">
                Thank You For Shopping at {store?.name || sale?.storeName || 'Our Store'}!
              </h4>
              <p className="text-[10px] text-emerald-100 font-medium">
                Total: <strong className="text-white font-bold">{curr} {sale.totalAmount.toFixed(2)}</strong> &bull; #{sale.receiptNumber}
              </p>
            </div>
          </div>

          {isVoiceAllowed && (
            <button
              type="button"
              onClick={handleReplayVoice}
              className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 transition-all cursor-pointer border border-white/30 shrink-0"
              title="Play voice thank you greeting again"
            >
              <Volume2 className="w-3.5 h-3.5 text-amber-300" /> Speak 🔊
            </button>
          )}
        </div>

        {/* Print Status Feedback */}
        {printStatus && (
          <div className="px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2 no-print animate-fade-in shrink-0">
            <Printer className="w-4 h-4 text-emerald-600 animate-pulse" />
            <span>{printStatus}</span>
          </div>
        )}

        {/* STANDARD PRINTABLE RECEIPT CARD */}
            <div 
              id="printable-receipt" 
              className="bg-slate-50 text-slate-900 p-5 sm:p-6 rounded-2xl shadow-inner font-mono text-xs space-y-4 overflow-y-auto overscroll-contain max-h-[44vh] border border-slate-200 custom-scrollbar"
            >
              {/* Receipt Header */}
              <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
                <div className="font-extrabold text-base tracking-tight text-slate-900 uppercase">
                  {store?.name || 'SUPERMARKET'}
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
                  {receiptSubHeader}
                </div>
                {store?.address && (
                  <div className="text-[10px] text-slate-500 font-medium">{store.address}</div>
                )}
                {store?.phone && (
                  <div className="text-[10px] text-slate-500 font-medium">Tel: {store.phone}</div>
                )}
                {store?.taxRegistrationNumber && (
                  <div className="text-[10px] text-slate-700 font-bold">{store.taxRegistrationNumber}</div>
                )}
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
                  <span className="col-span-2 text-right">Price</span>
                  <span className="col-span-3 text-right">Total</span>
                </div>

                {sale.items.map((item, idx) => {
                  const isWeight = item.sellBy === 'weight' || item.unitType === 'kg' || item.quantity % 1 !== 0;
                  const qtyDisplay = isWeight ? `${item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(3)}kg` : item.quantity.toString();

                  return (
                    <div key={idx} className="grid grid-cols-12 text-slate-900 text-[11px] py-0.5 items-center">
                      <div className="col-span-5 font-semibold truncate">
                        <span>{item.name}</span>
                        {item.weightInfo && (
                          <span className="block text-[9px] text-slate-500 font-normal">{item.weightInfo}</span>
                        )}
                      </div>
                      <span className="col-span-2 text-center font-bold font-mono">{qtyDisplay}</span>
                      <span className="col-span-2 text-right text-slate-600 font-mono">{curr} {item.price.toFixed(2)}</span>
                      <span className="col-span-3 text-right font-extrabold text-slate-900 font-mono">{curr} {item.total.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div className="pt-3 border-t-2 border-slate-900 space-y-1">
                {sale.discountAmount && sale.discountAmount > 0 ? (
                  <>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-mono font-semibold">{curr} {(sale.subtotalAmount || (sale.totalAmount + sale.discountAmount)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-emerald-700">
                      <span>Discount {sale.discountType === 'percentage' && sale.discountValue ? `(${sale.discountValue}%)` : ''}:</span>
                      <span className="font-mono">-{curr} {sale.discountAmount.toFixed(2)}</span>
                    </div>
                  </>
                ) : null}

                <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
                  <span>GRAND TOTAL:</span>
                  <span className="text-orange-700">{curr} {sale.totalAmount.toFixed(2)}</span>
                </div>

                {sale.paymentMethod === 'cash' && sale.cashReceived !== undefined && (
                  <>
                    <div className="flex justify-between text-xs font-semibold text-slate-600 pt-1">
                      <span>Cash Received:</span>
                      <span className="font-mono">{curr} {sale.cashReceived.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-black text-emerald-700">
                      <span>Change Returned:</span>
                      <span className="font-mono">{curr} {(sale.changeReturned || 0).toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Footer message */}
              <div className="text-center pt-4 border-t border-dashed border-slate-300 text-[10px] text-slate-500 space-y-1">
                <p className="font-bold text-slate-800">{receiptFooterText}</p>
              </div>
            </div>

            {/* Action Controls for Printing & Downloading */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 no-print pt-2 border-t border-slate-200 shrink-0">
              <button
                onClick={handlePrint}
                className="py-3 px-4 bg-orange-600 hover:bg-orange-500 text-white font-extrabold rounded-xl shadow-sm transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Print Thermal Slip
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
