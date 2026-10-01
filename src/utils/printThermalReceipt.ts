import { Sale, Store, ProductReturn } from '../types';

export function getThermalReceiptInnerHtml(sale: Sale, store?: Store | null, qrCodeDataUrl?: string | null): string {
  const storeName = store?.name || sale?.storeName || 'SUPERMARKET';
  const curr = store?.currencySymbol || 'Rs.';
  const receiptSubHeader = store?.receiptHeader || 'OFFICIAL SALES INVOICE';
  const receiptGreetingMessage = store?.receiptGreeting || 'Welcome & Thank You for Shopping With Us!';
  const receiptFooterText = store?.receiptFooter || `THANK YOU FOR SHOPPING AT ${storeName.toUpperCase()}! Please retain slip for return.`;
  const isQrEnabled = Boolean(store?.receiptQrCodeEnabled);
  const qrTitle = store?.receiptQrTitle || 'Scan to Verify Receipt';
  const dateStr = new Date(sale.timestamp).toLocaleString();

  const itemDiscounts = (sale.items || []).reduce((sum, item) => {
    if (item.originalPrice && item.originalPrice > item.price) {
      return sum + ((item.originalPrice - item.price) * (item.quantity || 1));
    }
    if (item.discountAmount && item.discountAmount > 0) {
      return sum + item.discountAmount;
    }
    return sum;
  }, 0);

  const billDiscount = Number(sale.discountAmount || 0);
  const totalDiscount = billDiscount > 0 ? billDiscount : itemDiscounts;
  const subtotal = sale.subtotalAmount || ((sale.totalAmount || 0) + totalDiscount);

  return `
    <div style="font-family: 'Courier New', Courier, monospace, -apple-system, sans-serif; width: 78mm; max-width: 100%; margin: 0 auto; padding: 4px; color: #000; background: #fff; font-size: 11px; line-height: 1.35; box-sizing: border-box;">
      <div style="text-align: center; margin-bottom: 6px;">
        ${store?.logoUrl ? `<img src="${store.logoUrl}" alt="Logo" style="max-height: 48px; max-width: 180px; margin: 0 auto 4px auto; display: block; filter: grayscale(100%) contrast(200%);" />` : ''}
        <div style="font-size: 16px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase;">${storeName}</div>
        <div style="font-size: 10px; font-weight: bold; letter-spacing: 0.5px; color: #333; text-transform: uppercase;">${receiptSubHeader}</div>
        ${receiptGreetingMessage ? `<div style="font-size: 9px; font-style: italic; color: #444; margin-top: 2px;">"${receiptGreetingMessage}"</div>` : ''}
        ${store?.address ? `<div style="font-size: 10px; color: #333; margin-top: 2px;">${store.address}</div>` : ''}
        ${store?.phone ? `<div style="font-size: 10px; color: #333;">Tel: ${store.phone}</div>` : ''}
        ${store?.taxRegistrationNumber ? `<div style="font-size: 10px; font-weight: bold;">${store.taxRegistrationNumber}</div>` : ''}
        <div style="margin-top: 4px; font-size: 11px;">Receipt: <strong>#${sale.receiptNumber}</strong></div>
        <div style="font-size: 10px; color: #333;">${dateStr}</div>
      </div>

      <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

      <div style="font-size: 11px;">
        <div style="display: flex; justify-content: space-between; margin: 2px 0;"><span>Counter:</span><strong>${sale.counterName}</strong></div>
        <div style="display: flex; justify-content: space-between; margin: 2px 0;"><span>Cashier:</span><strong>${sale.cashierUsername}</strong></div>
        <div style="display: flex; justify-content: space-between; margin: 2px 0;"><span>Payment:</span><strong style="text-transform: uppercase;">${sale.paymentMethod === 'online' ? `ONLINE (${sale.onlinePaymentProvider || 'DIGITAL'})` : 'CASH'}</strong></div>
        ${sale.onlineTransactionId ? `<div style="display: flex; justify-content: space-between; margin: 2px 0;"><span>Ref:</span><strong>${sale.onlineTransactionId}</strong></div>` : ''}
      </div>

      <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

      <table style="width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 11px;">
        <thead>
          <tr style="border-bottom: 1px solid #000; text-transform: uppercase; font-size: 10px;">
            <th style="text-align: left; padding: 3px 0;">Item</th>
            <th style="text-align: center; padding: 3px 0;">Qty</th>
            <th style="text-align: right; padding: 3px 0;">Rate</th>
            <th style="text-align: right; padding: 3px 0;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${(sale.items || []).map((item) => {
            const isWeight = item.sellBy === 'weight' || item.unitType === 'kg' || (item.quantity || 0) % 1 !== 0;
            const qtyText = isWeight 
              ? `${(item.quantity || 0) % 1 === 0 ? item.quantity : Number(item.quantity).toFixed(3)}kg` 
              : item.quantity.toString();
            const hasDiscount = item.originalPrice && item.originalPrice > item.price;
            return `
              <tr>
                <td style="padding: 3px 0; vertical-align: top;">
                  <strong>${item.name}</strong>
                  ${hasDiscount ? `<br/><span style="font-size: 9px; color: #047857;">Reg: ${curr} ${item.originalPrice?.toFixed(2)} (Disc Applied)</span>` : ''}
                  ${item.weightInfo ? `<br/><span style="font-size: 9px; color: #444;">${item.weightInfo}</span>` : ''}
                </td>
                <td style="text-align: center; padding: 3px 0; font-weight: bold; vertical-align: top;">${qtyText}</td>
                <td style="text-align: right; padding: 3px 0; vertical-align: top;">${curr} ${(item.price || 0).toFixed(2)}${isWeight ? '/kg' : ''}</td>
                <td style="text-align: right; padding: 3px 0; font-weight: bold; vertical-align: top;">${curr} ${(item.total || 0).toFixed(2)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div style="border-top: 2px solid #000; margin: 6px 0;"></div>

      <div style="display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0;">
        <span>Subtotal:</span>
        <span>${curr} ${(subtotal || 0).toFixed(2)}</span>
      </div>

      <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; margin: 6px 0; padding: 4px 0; border-top: 1px solid #000; border-bottom: 1px solid #000;">
        <span>NET TOTAL:</span>
        <span>${curr} ${(sale.totalAmount || 0).toFixed(2)}</span>
      </div>

      ${sale.paymentMethod === 'cash' && sale.cashReceived !== undefined ? `
        <div style="display: flex; justify-content: space-between; font-size: 11px; margin: 3px 0;">
          <span>Cash Tendered:</span>
          <span>${curr} ${(sale.cashReceived || 0).toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin: 3px 0;">
          <span>Change Returned:</span>
          <span>${curr} ${(sale.changeReturned || 0).toFixed(2)}</span>
        </div>
      ` : ''}

      <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

      <div style="text-align: center; margin-top: 8px;">
        <p style="font-weight: bold; margin: 0; font-size: 10px;">${receiptFooterText}</p>
        <div style="font-size: 9px; color: #555; margin-top: 4px;">Txn ID: ${sale.receiptNumber}</div>
      </div>

      ${isQrEnabled && qrCodeDataUrl ? `
        <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
        <div style="text-align: center; margin-top: 6px;">
          <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; margin-bottom: 3px;">${qrTitle}</div>
          <img src="${qrCodeDataUrl}" alt="${qrTitle}" style="width: 80px; height: 80px; margin: 0 auto; display: block;" />
        </div>
      ` : ''}
    </div>
  `;
}

export function getThermalReceiptHtml(sale: Sale, store?: Store | null, qrCodeDataUrl?: string | null): string {
  const storeName = store?.name || sale?.storeName || 'SUPERMARKET';
  const inner = getThermalReceiptInnerHtml(sale, store, qrCodeDataUrl);

  return `<!DOCTYPE html>
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
        width: 78mm;
        max-width: 100%;
        margin: 0 auto;
        padding: 4px;
        color: #000;
        background: #fff;
        font-family: 'Courier New', Courier, monospace, -apple-system, sans-serif;
      }
      @media print {
        body {
          width: 78mm;
          padding: 0;
          margin: 0 auto;
        }
      }
    </style>
  </head>
  <body>
    ${inner}
  </body>
</html>`;
}

/**
 * Universal, isolated thermal printing via hidden iframe with automatic fallback
 */
export function printReceiptHtmlDirect(htmlContent: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // 1. Also update direct print container in parent DOM for fallback
      let directPrintContainer = document.getElementById('thermal-direct-print-container');
      if (!directPrintContainer) {
        directPrintContainer = document.createElement('div');
        directPrintContainer.id = 'thermal-direct-print-container';
        document.body.appendChild(directPrintContainer);
      }
      directPrintContainer.innerHTML = htmlContent;

      // 2. Remove any previous print iframe
      const oldIframe = document.getElementById('pos-print-hidden-iframe');
      if (oldIframe) {
        try {
          oldIframe.remove();
        } catch (_) {}
      }

      // 3. Create isolated invisible iframe
      const iframe = document.createElement('iframe');
      iframe.id = 'pos-print-hidden-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';
      iframe.setAttribute('aria-hidden', 'true');
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!iframeDoc || !iframe.contentWindow) {
        throw new Error('Iframe document not accessible');
      }

      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      const triggerPrint = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve(true);
        } catch (e) {
          console.warn('Iframe print failed, falling back to window.print():', e);
          try {
            window.print();
            resolve(true);
          } catch (e2) {
            console.error('Fallback window.print failed:', e2);
            resolve(false);
          }
        } finally {
          setTimeout(() => {
            try {
              if (iframe && iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
              }
            } catch (_) {}
          }, 5000);
        }
      };

      // Check if there are images that need to load
      const images = iframeDoc.images;
      if (images && images.length > 0) {
        let loadedCount = 0;
        const totalImages = images.length;
        let triggered = false;

        const onImageComplete = () => {
          loadedCount++;
          if (loadedCount >= totalImages && !triggered) {
            triggered = true;
            setTimeout(triggerPrint, 80);
          }
        };

        for (let i = 0; i < totalImages; i++) {
          const img = images[i];
          if (img.complete) {
            loadedCount++;
          } else {
            img.onload = onImageComplete;
            img.onerror = onImageComplete;
          }
        }

        if (loadedCount >= totalImages && !triggered) {
          triggered = true;
          setTimeout(triggerPrint, 80);
        } else {
          // Timeout fallback to ensure print dialog always triggers
          setTimeout(() => {
            if (!triggered) {
              triggered = true;
              triggerPrint();
            }
          }, 400);
        }
      } else {
        setTimeout(triggerPrint, 80);
      }
    } catch (err) {
      console.warn('Error during iframe printing, executing direct window.print:', err);
      try {
        window.print();
        resolve(true);
      } catch (fallbackErr) {
        console.error('Direct window.print failed:', fallbackErr);
        resolve(false);
      }
    }
  });
}

export function printThermalReceiptDirect(sale: Sale, store?: Store | null, qrCodeDataUrl?: string | null): Promise<boolean> {
  const fullHtml = getThermalReceiptHtml(sale, store, qrCodeDataUrl);
  return printReceiptHtmlDirect(fullHtml);
}

export function printReturnSlipDirect(returnRecord: ProductReturn, store?: Store | null): Promise<boolean> {
  const storeName = store?.name || returnRecord.storeName || 'SUPERMARKET';
  const dateStr = new Date(returnRecord.timestamp).toLocaleString();
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
  const curr = store?.currencySymbol || 'Rs.';

  const slipHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Return Slip #${returnRecord.returnSlipNumber} - ${storeName}</title>
    <style>
      @page {
        size: 80mm auto;
        margin: 0;
      }
      * {
        box-sizing: border-box;
      }
      body {
        font-family: 'Courier New', Courier, monospace;
        width: 78mm;
        margin: 0 auto;
        padding: 8px;
        color: #000;
        background: #fff;
        font-size: 11px;
        line-height: 1.35;
      }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .font-bold { font-weight: bold; }
      .uppercase { text-transform: uppercase; }
      .divider { border-top: 1px dashed #000; margin: 6px 0; }
      .double-divider { border-top: 2px solid #000; margin: 6px 0; }
      .store-title { font-size: 16px; font-weight: 900; letter-spacing: -0.5px; margin-bottom: 2px; text-transform: uppercase; }
      .sub-title { font-size: 11px; font-weight: bold; letter-spacing: 0.5px; color: #b91c1c; margin-bottom: 4px; text-transform: uppercase; }
      .flex-row { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; }
      table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 11px; }
      th { border-bottom: 1px solid #000; text-align: left; padding: 3px 0; font-size: 10px; text-transform: uppercase; }
      td { padding: 3px 0; font-size: 11px; vertical-align: top; }
      .total-box { font-size: 14px; font-weight: 900; margin-top: 6px; color: #b91c1c; }
    </style>
  </head>
  <body>
    <div class="text-center">
      <div class="store-title">${storeName}</div>
      <div class="sub-title">CUSTOMER RETURN & REFUND VOUCHER</div>
      <div>Slip No: <strong>#${returnRecord.returnSlipNumber}</strong></div>
      <div style="font-size: 10px; color: #444;">${dateStr}</div>
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
            <td class="text-right">${curr} ${(item.price || 0).toFixed(2)}</td>
            <td class="text-right font-bold">${curr} ${(item.refundAmount || 0).toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="double-divider"></div>

    <div class="flex-row total-box">
      <span>TOTAL REFUNDED:</span>
      <span>${curr} ${(returnRecord.refundAmount ?? 0).toFixed(2)}</span>
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

    <div class="text-center" style="margin-top: 10px;">
      <p class="font-bold" style="margin: 0; font-size: 10px;">REFUND PROCESSED BY ${storeName.toUpperCase()}</p>
      <p style="margin: 2px 0 0 0; font-size: 9px; color: #555;">Amount deducted from sales register & returned to inventory.</p>
      <div style="font-size: 9px; font-weight: bold; margin-top: 4px;">Ref: ${returnRecord.returnSlipNumber}</div>
    </div>
  </body>
</html>`;

  return printReceiptHtmlDirect(slipHtml);
}
