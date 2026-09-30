import { Sale, Store } from '../types';

export function getThermalReceiptHtml(sale: Sale, store?: Store | null, qrCodeDataUrl?: string | null): string {
  const storeName = store?.name || sale?.storeName || 'SUPERMARKET';
  const curr = store?.currencySymbol || 'Rs.';
  const receiptSubHeader = store?.receiptHeader || 'OFFICIAL SALES INVOICE';
  const receiptFooterText = store?.receiptFooter || `THANK YOU FOR SHOPPING AT ${storeName.toUpperCase()}! Please retain slip for return.`;
  const isQrEnabled = Boolean(store?.receiptQrCodeEnabled);
  const qrTitle = store?.receiptQrTitle || 'Scan to Verify Receipt';
  const dateStr = new Date(sale.timestamp).toLocaleString();

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt #${sale.receiptNumber} - ${storeName}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: 'Courier New', Courier, monospace, -apple-system, sans-serif;
            width: 78mm;
            max-width: 100%;
            margin: 0 auto;
            padding: 10px 8px;
            color: #000;
            background: #fff;
            font-size: 11px;
            line-height: 1.3;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .uppercase { text-transform: uppercase; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .double-divider { border-top: 2px solid #000; margin: 6px 0; }
          .store-title { font-size: 16px; font-weight: 900; letter-spacing: -0.5px; margin-bottom: 2px; }
          .sub-title { font-size: 10px; font-weight: bold; letter-spacing: 1px; color: #333; margin-bottom: 4px; }
          .meta-line { font-size: 10px; color: #444; }
          .flex-row { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; }
          table { width: 100%; border-collapse: collapse; margin: 6px 0; }
          th { border-bottom: 1px solid #000; text-align: left; padding: 3px 0; font-size: 10px; text-transform: uppercase; }
          td { padding: 3px 0; font-size: 11px; vertical-align: top; }
          .total-box { font-size: 15px; font-weight: 900; margin-top: 6px; padding: 4px 0; border-top: 1px solid #000; border-bottom: 1px solid #000; }
          @media print {
            body {
              width: 78mm;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="store-title">${storeName}</div>
          <div class="sub-title">${receiptSubHeader}</div>
          ${store?.address ? `<div class="meta-line">${store.address}</div>` : ''}
          ${store?.phone ? `<div class="meta-line">Tel: ${store.phone}</div>` : ''}
          ${store?.taxRegistrationNumber ? `<div class="meta-line font-bold">${store.taxRegistrationNumber}</div>` : ''}
          <div style="margin-top: 4px;">Receipt: <strong>#${sale.receiptNumber}</strong></div>
          <div style="color: #444; font-size: 10px;">${dateStr}</div>
        </div>

        <div class="divider"></div>

        <div>
          <div class="flex-row"><span>Counter:</span><strong>${sale.counterName}</strong></div>
          <div class="flex-row"><span>Cashier:</span><strong>${sale.cashierUsername}</strong></div>
          <div class="flex-row"><span>Payment:</span><strong class="uppercase">${sale.paymentMethod === 'online' ? `ONLINE (${sale.onlinePaymentProvider || 'DIGITAL'})` : 'CASH'}</strong></div>
          ${sale.onlineTransactionId ? `<div class="flex-row"><span>Trans Ref:</span><strong>${sale.onlineTransactionId}</strong></div>` : ''}
        </div>

        <div class="divider"></div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="text-center">Qty</th>
              <th class="text-right">Rate</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${(sale.items || []).map((item) => {
              const isWeight = item.sellBy === 'weight' || item.unitType === 'kg' || (item.quantity || 0) % 1 !== 0;
              const qtyText = isWeight 
                ? `${(item.quantity || 0) % 1 === 0 ? item.quantity : Number(item.quantity).toFixed(3)}kg` 
                : item.quantity.toString();
              return `
                <tr>
                  <td>
                    <strong>${item.name}</strong>
                    ${item.weightInfo ? `<br/><small style="color:#555">${item.weightInfo}</small>` : ''}
                  </td>
                  <td class="text-center font-bold">${qtyText}</td>
                  <td class="text-right">${curr} ${(item.price || 0).toFixed(2)}${isWeight ? '/kg' : ''}</td>
                  <td class="text-right font-bold">${curr} ${(item.total || 0).toFixed(2)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="double-divider"></div>

        ${sale.discountAmount && sale.discountAmount > 0 ? `
          <div class="flex-row" style="color: #444;">
            <span>Subtotal:</span>
            <span>${curr} ${(sale.subtotalAmount || ((sale.totalAmount || 0) + (sale.discountAmount || 0))).toFixed(2)}</span>
          </div>
          <div class="flex-row font-bold" style="color: #047857;">
            <span>Discount:</span>
            <span>-${curr} ${(sale.discountAmount || 0).toFixed(2)}</span>
          </div>
        ` : ''}

        <div class="flex-row total-box">
          <span>NET PAYABLE:</span>
          <span>${curr} ${(sale.totalAmount || 0).toFixed(2)}</span>
        </div>

        ${sale.paymentMethod === 'cash' && sale.cashReceived !== undefined ? `
          <div class="flex-row" style="margin-top: 4px; font-size: 11px;">
            <span>Cash Tendered:</span>
            <span>${curr} ${(sale.cashReceived || 0).toFixed(2)}</span>
          </div>
          <div class="flex-row font-bold" style="font-size: 11px; color: #047857;">
            <span>Change Returned:</span>
            <span>${curr} ${(sale.changeReturned || 0).toFixed(2)}</span>
          </div>
        ` : ''}

        <div class="divider"></div>

        <div class="text-center" style="margin-top: 8px;">
          <p class="font-bold" style="margin: 0; font-size: 10px;">${receiptFooterText}</p>
          <div style="font-size: 9px; color: #666; margin-top: 4px;">Txn: ${sale.receiptNumber}</div>
        </div>

        ${isQrEnabled && qrCodeDataUrl ? `
          <div class="divider"></div>
          <div class="text-center" style="margin-top: 6px;">
            <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; margin-bottom: 3px;">${qrTitle}</div>
            <img src="${qrCodeDataUrl}" alt="${qrTitle}" style="width: 85px; height: 85px; margin: 0 auto; display: block;" />
          </div>
        ` : ''}
      </body>
    </html>
  `;
}

export function printThermalReceiptDirect(sale: Sale, store?: Store | null, qrCodeDataUrl?: string | null): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const receiptHtml = getThermalReceiptHtml(sale, store, qrCodeDataUrl);

      // 1. Prepare printable overlay in main DOM for reliable fallback
      let directPrintContainer = document.getElementById('thermal-direct-print-container');
      if (!directPrintContainer) {
        directPrintContainer = document.createElement('div');
        directPrintContainer.id = 'thermal-direct-print-container';
        document.body.appendChild(directPrintContainer);
      }
      directPrintContainer.innerHTML = `
        <style>
          @media print {
            body > *:not(#thermal-direct-print-container) {
              display: none !important;
            }
            #thermal-direct-print-container {
              display: block !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 78mm !important;
              margin: 0 auto !important;
              padding: 0 !important;
              background: #fff !important;
              color: #000 !important;
            }
          }
          @media screen {
            #thermal-direct-print-container {
              display: none !important;
            }
          }
        </style>
        <div>${receiptHtml}</div>
      `;

      // 2. Offscreen iframe with real layout dimensions so modern browsers render layout before print
      let printFrame = document.getElementById('thermal-print-hidden-frame') as HTMLIFrameElement | null;
      if (!printFrame) {
        printFrame = document.createElement('iframe');
        printFrame.id = 'thermal-print-hidden-frame';
        printFrame.style.position = 'fixed';
        printFrame.style.left = '-9999px';
        printFrame.style.top = '0';
        printFrame.style.width = '350px';
        printFrame.style.height = '600px';
        printFrame.style.border = 'none';
        printFrame.style.zIndex = '-9999';
        document.body.appendChild(printFrame);
      }

      const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
      if (!frameDoc) {
        window.print();
        resolve(true);
        return;
      }

      frameDoc.open();
      frameDoc.write(receiptHtml);
      frameDoc.close();

      setTimeout(() => {
        try {
          if (printFrame?.contentWindow) {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
            resolve(true);
          } else {
            window.print();
            resolve(true);
          }
        } catch (printErr) {
          console.warn('Iframe print failed or blocked, falling back to window.print():', printErr);
          window.print();
          resolve(true);
        }
      }, 300);
    } catch (err) {
      console.error('printThermalReceiptDirect error:', err);
      try {
        window.print();
      } catch (e) {
        console.error('window.print() error:', e);
      }
      resolve(false);
    }
  });
}
