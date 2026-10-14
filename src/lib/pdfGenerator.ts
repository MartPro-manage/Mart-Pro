import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Store, SupplierOrder, SupplierProfile, SupplierPayment, Product } from '../types';

const formatNum = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '0.00';
  const n = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(n) ? '0.00' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * 1. Generate & Download Purchase Order Product List as PDF
 * Triggered automatically just after user creates list of products to order,
 * or on demand via Download PDF button.
 */
export function generateOrderProductListPdf(
  order: SupplierOrder,
  store: Store,
  supplier?: SupplierProfile
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 14;

  // Header Bar (Brand / Store)
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text((store?.name || 'SUPERMARKET STORE').toUpperCase(), 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // slate-300
  const storeDetails = [
    store?.address || '',
    store?.phone ? `Phone: ${store.phone}` : '',
    (store as any)?.email ? `Email: ${(store as any).email}` : ''
  ].filter(Boolean).join(' | ');
  doc.text(storeDetails || 'Point of Sale & Inventory Management System', 14, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(249, 115, 22); // orange-500
  doc.text('PURCHASE ORDER & PRODUCT LIST', pageWidth - 14, 14, { align: 'right' });
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`PO #: ${order.orderNumber}`, pageWidth - 14, 20, { align: 'right' });

  currentY = 36;

  // Supplier & Order Information Box
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(14, currentY, pageWidth - 28, 26, 2, 2, 'FD');

  doc.setTextColor(71, 85, 105); // slate-600
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('SUPPLIER DETAILS:', 18, currentY + 6);
  doc.text('ORDER INFORMATION:', pageWidth / 2 + 6, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42); // slate-900

  const supName = order.supplierName || supplier?.name || 'Supplier';
  const supBusiness = supplier?.businessName ? ` (${supplier.businessName})` : '';
  const supPhone = order.contactNumber || supplier?.phone || '-';

  doc.text(`Name: ${supName}${supBusiness}`, 18, currentY + 12);
  doc.text(`Contact: ${supPhone}`, 18, currentY + 17);
  if (supplier?.address) {
    doc.text(`Address: ${supplier.address.slice(0, 42)}`, 18, currentY + 22);
  }

  const orderDateStr = order.orderDate || new Date().toISOString().split('T')[0];
  const createdTime = order.createdAt ? new Date(order.createdAt).toLocaleString() : new Date().toLocaleString();

  doc.text(`Order Date: ${orderDateStr}`, pageWidth / 2 + 6, currentY + 12);
  doc.text(`Generated: ${createdTime}`, pageWidth / 2 + 6, currentY + 17);
  doc.text(`Delivery Status: ${(order.deliveryStatus || 'pending').replace('_', ' ').toUpperCase()}`, pageWidth / 2 + 6, currentY + 22);

  currentY += 32;

  // Items Table
  const tableHead = [['#', 'Product Name', 'Barcode / SKU', 'Category', 'Unit', 'Qty', 'Cost Price', 'Total Cost']];
  const tableRows = (order.items || []).map((item, index) => {
    const qty = item.orderQuantity || 0;
    const cost = item.costPrice || 0;
    const total = qty * cost;
    return [
      String(index + 1),
      item.name || 'Unnamed Product',
      item.barcode || item.sku || '-',
      item.category || 'General',
      item.unitType || 'pcs',
      String(qty),
      `Rs. ${formatNum(cost)}`,
      `Rs. ${formatNum(total)}`
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: tableHead,
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [234, 88, 12], // orange-600
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 55 },
      2: { cellWidth: 30, font: 'courier' },
      3: { cellWidth: 24 },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 14, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 24, halign: 'right' },
      7: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 14, right: 14 }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || currentY + 50;

  // Summary Totals Box
  const summaryBoxWidth = 85;
  const summaryBoxX = pageWidth - 14 - summaryBoxWidth;
  const summaryY = finalY + 6;

  const totalQty = (order.items || []).reduce((s, i) => s + (i.orderQuantity || 0), 0);
  const totalAmount = order.totalOrderAmount || (order.items || []).reduce((s, i) => s + (i.orderQuantity * (i.costPrice || 0)), 0);
  const advancePaid = order.advancePaidAmount || 0;
  const remainingDue = Math.max(0, totalAmount - (order.totalPaidAmount || advancePaid));

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(summaryBoxX, summaryY, summaryBoxWidth, 34, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Total Items:', summaryBoxX + 4, summaryY + 6);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(`${order.items?.length || 0} (${totalQty} units)`, summaryBoxX + summaryBoxWidth - 4, summaryY + 6, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Total Order Value:', summaryBoxX + 4, summaryY + 13);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(`Rs. ${formatNum(totalAmount)}`, summaryBoxX + summaryBoxWidth - 4, summaryY + 13, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  const advMethodText = order.advancePaymentMethod ? ` (${order.advancePaymentMethod})` : '';
  doc.text(`Advance Paid${advMethodText}:`, summaryBoxX + 4, summaryY + 20);
  doc.setTextColor(16, 185, 129); // emerald-600
  doc.setFont('helvetica', 'bold');
  doc.text(`Rs. ${formatNum(advancePaid)}`, summaryBoxX + summaryBoxWidth - 4, summaryY + 20, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.line(summaryBoxX + 4, summaryY + 24, summaryBoxX + summaryBoxWidth - 4, summaryY + 24);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(225, 29, 72); // rose-600
  doc.text('Balance Due:', summaryBoxX + 4, summaryY + 30);
  doc.text(`Rs. ${formatNum(remainingDue)}`, summaryBoxX + summaryBoxWidth - 4, summaryY + 30, { align: 'right' });

  // Notes & Signatures on bottom left
  if (order.notes) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Notes: ${order.notes}`, 14, summaryY + 8);
  }

  const signY = summaryY + 38;
  if (signY + 20 < doc.internal.pageSize.getHeight()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);

    doc.line(14, signY + 12, 65, signY + 12);
    doc.text('Prepared By / Store Manager', 14, signY + 16);

    doc.line(pageWidth - 65, signY + 12, pageWidth - 14, signY + 12);
    doc.text('Supplier Signature / Stamp', pageWidth - 65, signY + 16);
  }

  // Footer page note
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated on ${new Date().toLocaleString()} | ${store.name || 'Store'} Inventory Management`, 14, pageHeight - 6);

  // Save PDF
  const filename = `${order.orderNumber || 'Order'}_Product_List.pdf`;
  doc.save(filename);
}

/**
 * 2. Generate & Download Complete Supplier Product Catalog as PDF
 */
export function generateSupplierProductsCatalogPdf(
  supplier: SupplierProfile,
  items: Array<{
    name: string;
    barcode?: string;
    category?: string;
    costPrice?: number;
    sellingPrice?: number;
    stockQuantity?: number;
    unitType?: string;
    status?: string;
  }>,
  store: Store
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Bar
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text((store?.name || 'SUPERMARKET').toUpperCase(), 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text('Supplier Product Catalog & Price Matrix', 14, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(16, 185, 129); // emerald-500
  doc.text('PRODUCT LIST (PDF)', pageWidth - 14, 14, { align: 'right' });
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`Supplier: ${supplier.name}`, pageWidth - 14, 20, { align: 'right' });

  // Supplier Details Card
  let currentY = 34;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, pageWidth - 28, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Supplier: ${supplier.name} ${supplier.businessName ? `(${supplier.businessName})` : ''}`, 18, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Phone: ${supplier.phone || '-'} | Email: ${supplier.email || '-'}`, 18, currentY + 11);
  doc.text(`Address: ${supplier.address || '-'}`, 18, currentY + 16);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Total Products: ${items.length}`, pageWidth - 18, currentY + 11, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Exported: ${new Date().toLocaleDateString()}`, pageWidth - 18, currentY + 16, { align: 'right' });

  currentY += 28;

  // Table
  const tableHead = [['#', 'Product Name', 'Barcode / SKU', 'Category', 'Cost (Rs.)', 'Stock', 'Unit', 'Status']];
  const tableRows = items.map((item, idx) => {
    const cost = item.costPrice || 0;
    return [
      String(idx + 1),
      item.name,
      item.barcode || '-',
      item.category || 'General',
      formatNum(cost),
      String(item.stockQuantity ?? 0),
      item.unitType || 'pcs',
      item.status || 'Active'
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: tableHead,
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [16, 185, 129], // emerald-600
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 55 },
      2: { cellWidth: 30, font: 'courier' },
      3: { cellWidth: 25 },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 15, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 15, halign: 'center' },
      7: { cellWidth: 20, halign: 'center' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 14, right: 14 }
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Catalog exported on ${new Date().toLocaleString()} for ${supplier.name}`, 14, pageHeight - 6);

  const cleanName = supplier.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${cleanName}_Product_Catalog.pdf`);
}

/**
 * 3. Generate & Download Supplier Financial Ledger as PDF
 * Shows exact date & time, payment methods (Cash, HBL, Jazz Cash, Easy Paisa, Other),
 * debits, credits, running balance, and method breakdown.
 */
export function generateSupplierLedgerPdf(
  supplier: SupplierProfile,
  orders: SupplierOrder[],
  payments: SupplierPayment[],
  store: Store,
  financials?: { totalPurchases: number; totalPaid: number; outstanding: number },
  generationTime?: Date
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Banner
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text((store?.name || 'SUPERMARKET').toUpperCase(), 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  const storeInfo = [
    store?.address || '',
    store?.phone ? `Tel: ${store.phone}` : ''
  ].filter(Boolean).join(' | ');
  doc.text(storeInfo || 'Inventory & Supplier Ledger Accounts', 14, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(59, 130, 246); // blue-500
  doc.text('SUPPLIER FINANCIAL LEDGER', pageWidth - 14, 14, { align: 'right' });
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`Audit Statement (PDF)`, pageWidth - 14, 20, { align: 'right' });

  let currentY = 34;

  // Supplier Profile Details Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, pageWidth - 28, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Supplier: ${supplier.name} ${supplier.businessName ? `(${supplier.businessName})` : ''}`, 18, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Phone: ${supplier.phone || '-'} | Email: ${supplier.email || '-'}`, 18, currentY + 11);
  doc.text(`Address: ${supplier.address || '-'}`, 18, currentY + 16);
  doc.text(`Statement Date & Time: ${(generationTime || new Date()).toLocaleString()}`, 18, currentY + 21);

  // Financial Cards Strip
  const totalPurchases = financials?.totalPurchases ?? orders.reduce((s, o) => s + (o.totalOrderAmount || 0), 0);
  const totalPaid = financials?.totalPaid ?? (
    orders.reduce((s, o) => s + (o.advancePaidAmount || 0), 0) +
    payments.reduce((s, p) => s + (p.amount || 0), 0)
  );
  const outstanding = financials?.outstanding ?? Math.max(0, totalPurchases - totalPaid);

  currentY += 28;

  const cardWidth = (pageWidth - 28 - 6) / 3;

  // Card 1: Purchases
  doc.setFillColor(239, 246, 255); // blue-50
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(14, currentY, cardWidth, 16, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('TOTAL PURCHASES', 17, currentY + 5);
  doc.setFontSize(10.5);
  doc.text(`Rs. ${formatNum(totalPurchases)}`, 17, currentY + 12);

  // Card 2: Total Paid
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(14 + cardWidth + 3, currentY, cardWidth, 16, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setTextColor(6, 95, 70);
  doc.text('TOTAL PAYMENTS MADE', 17 + cardWidth + 3, currentY + 5);
  doc.setFontSize(10.5);
  doc.text(`Rs. ${formatNum(totalPaid)}`, 17 + cardWidth + 3, currentY + 12);

  // Card 3: Outstanding Balance
  doc.setFillColor(255, 241, 242); // rose-50
  doc.setDrawColor(254, 205, 211);
  doc.roundedRect(14 + (cardWidth + 3) * 2, currentY, cardWidth, 16, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setTextColor(159, 18, 57);
  doc.text('OUTSTANDING BALANCE DUE', 17 + (cardWidth + 3) * 2, currentY + 5);
  doc.setFontSize(10.5);
  doc.text(`Rs. ${formatNum(outstanding)}`, 17 + (cardWidth + 3) * 2, currentY + 12);

  currentY += 22;

  // Build Chronological Ledger Entries
  type LedgerEntry = {
    timestamp: number;
    exactDateTime: string;
    type: string;
    reference: string;
    paymentMethod: string;
    debit: number;
    credit: number;
    notes: string;
  };

  const entries: LedgerEntry[] = [];

  // 1. Purchase Orders
  orders.forEach(o => {
    const timeNum = o.createdAt ? new Date(o.createdAt).getTime() : new Date(`${o.orderDate}T10:00:00`).getTime();
    const exactTime = o.createdAt ? new Date(o.createdAt).toLocaleString() : `${o.orderDate} 10:00 AM`;

    entries.push({
      timestamp: timeNum,
      exactDateTime: exactTime,
      type: 'Purchase Order',
      reference: o.orderNumber || '-',
      paymentMethod: '-',
      debit: o.totalOrderAmount || 0,
      credit: 0,
      notes: `Order placed (${o.items?.length || 0} items) - ${o.deliveryStatus || 'pending'}`
    });

    if ((o.advancePaidAmount || 0) > 0) {
      entries.push({
        timestamp: timeNum + 50,
        exactDateTime: exactTime,
        type: 'Advance Payment',
        reference: o.orderNumber || '-',
        paymentMethod: o.advancePaymentMethod || 'Cash',
        debit: 0,
        credit: o.advancePaidAmount || 0,
        notes: o.advanceNotes || 'Advance payment at order placement'
      });
    }
  });

  // 2. Subsequent Payments
  payments.forEach(p => {
    const timeNum = p.createdAt ? new Date(p.createdAt).getTime() : new Date(`${p.paymentDate}T12:00:00`).getTime();
    const exactTime = p.createdAt ? new Date(p.createdAt).toLocaleString() : `${p.paymentDate} 12:00 PM`;

    entries.push({
      timestamp: timeNum + 100,
      exactDateTime: exactTime,
      type: 'Order Payment',
      reference: p.orderNumber || '-',
      paymentMethod: p.paymentMethod || 'Cash',
      debit: 0,
      credit: p.amount || 0,
      notes: p.reference || p.notes || 'Settlement payment'
    });
  });

  // Sort Chronologically
  entries.sort((a, b) => a.timestamp - b.timestamp);

  let runningBalance = 0;
  const ledgerTableRows = entries.map(e => {
    runningBalance += (e.debit - e.credit);
    return [
      e.exactDateTime,
      e.type,
      e.reference,
      e.paymentMethod,
      e.debit > 0 ? formatNum(e.debit) : '-',
      e.credit > 0 ? formatNum(e.credit) : '-',
      formatNum(runningBalance),
      e.notes
    ];
  });

  // Table
  autoTable(doc, {
    startY: currentY,
    head: [['Date & Time', 'Transaction Type', 'Ref / PO #', 'Method', 'Debit (Orders)', 'Credit (Paid)', 'Balance (Rs.)', 'Remarks']],
    body: ledgerTableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 26 },
      2: { cellWidth: 22, font: 'courier' },
      3: { cellWidth: 20, fontStyle: 'bold' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 20, halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] },
      6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 24 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 14, right: 14 }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || currentY + 50;

  // Payment Methods Breakdown Box (5 Payment Methods: Cash, HBL, Jazz Cash, Easy Paisa, Other)
  const methodTotals: Record<string, number> = {
    'Cash': 0,
    'HBL': 0,
    'Jazz Cash': 0,
    'Easy Paisa': 0,
    'Other': 0
  };

  orders.forEach(o => {
    if ((o.advancePaidAmount || 0) > 0) {
      const m = o.advancePaymentMethod || 'Cash';
      methodTotals[m] = (methodTotals[m] || 0) + o.advancePaidAmount;
    }
  });

  payments.forEach(p => {
    const m = p.paymentMethod || 'Cash';
    methodTotals[m] = (methodTotals[m] || 0) + (p.amount || 0);
  });

  const methodSummaryY = finalY + 6;
  if (methodSummaryY + 28 < doc.internal.pageSize.getHeight()) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, methodSummaryY, pageWidth - 28, 20, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text('PAYMENT METHOD BREAKDOWN (5 METHODS AUDIT):', 18, methodSummaryY + 5);

    const methodsList = ['Cash', 'HBL', 'Jazz Cash', 'Easy Paisa', 'Other'];
    const itemW = (pageWidth - 36) / 5;

    methodsList.forEach((meth, idx) => {
      const x = 18 + idx * itemW;
      const amt = methodTotals[meth] || 0;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(meth, x, methodSummaryY + 11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Rs. ${formatNum(amt)}`, x, methodSummaryY + 16);
    });
  }

  // Footer Note
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Supplier Ledger Statement | Generated on ${(generationTime || new Date()).toLocaleString()} for ${supplier.name}`, 14, pageHeight - 6);

  const cleanName = supplier.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${cleanName}_Financial_Ledger_${(generationTime || new Date()).toISOString().replace(/[:.]/g, '-').slice(0, 19)}.pdf`);
}

/**
 * 4. Generate & Download 4-Digit Product Short Codes Directory as PDF
 * Formatted for A4 printing, cashier counter reference sheets, and shelf organization.
 */
export function generateProductShortcodesPdf(
  products: Product[],
  store?: Store | { name?: string; address?: string; phone?: string; email?: string },
  options?: {
    filterCategory?: string;
    searchTerm?: string;
    title?: string;
  }
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Sort alphabetically by product name for easy reference
  const sorted = [...products].sort((a, b) => {
    return (a.name || '').localeCompare(b.name || '');
  });

  // Top Header Banner
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageWidth, 26, 'F');

  // Orange brand accent line
  doc.setFillColor(234, 88, 12); // orange-600
  doc.rect(0, 26, pageWidth, 2.5, 'F');

  // Store Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text((store?.name || 'SUPERMARKET STORE POS').toUpperCase(), 14, 11);

  // Store metadata
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // slate-300
  const storeMeta = [
    store?.address || '',
    store?.phone ? `Phone: ${store.phone}` : '',
    (store as any)?.email ? `Email: ${(store as any).email}` : ''
  ].filter(Boolean).join(' | ');
  doc.text(storeMeta || 'Point of Sale & Inventory Management System', 14, 17);

  // Right Header Label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(251, 146, 60); // orange-400
  doc.text('PRODUCT SHORT CODES DIRECTORY', pageWidth - 14, 11, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('POS 4-Digit Quick Reference Sheet', pageWidth - 14, 17, { align: 'right' });

  let currentY = 33;

  // Overview Information Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, pageWidth - 28, 16, 2, 2, 'FD');

  const now = new Date();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Total Products Listed: ${sorted.length}`, 18, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Generated: ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 18, currentY + 11.5);

  // Cashier Quick Tip on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(194, 65, 12); // orange-700
  doc.text('Quick Checkout: Type 4-digit code in cashier scanner & press ENTER', pageWidth - 18, currentY + 6, { align: 'right' });

  if (options?.filterCategory && options.filterCategory !== 'all') {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Category: ${options.filterCategory}${options.searchTerm ? ` • Search: "${options.searchTerm}"` : ''}`, pageWidth - 18, currentY + 11.5, { align: 'right' });
  } else if (options?.searchTerm) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Search Query: "${options.searchTerm}"`, pageWidth - 18, currentY + 11.5, { align: 'right' });
  }

  currentY += 20;

  // Table Data
  const tableHead = [['Short Code', 'Product Name', 'Category', 'Price (Rs.)', 'Barcode', 'Stock Status']];
  const tableRows = sorted.map((p) => {
    const code = p.shortcutCode ? `#${p.shortcutCode}` : (p.serialNumber ? `#${p.serialNumber}` : '----');
    const priceStr = formatNum(p.price || 0);
    const stockStr = `${p.stockQuantity ?? 0}${p.unitType ? ` ${p.unitType}` : ''}`;
    return [
      code,
      p.name || 'Unnamed Item',
      p.category || 'General',
      priceStr,
      p.barcode || '-',
      stockStr
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: tableHead,
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [234, 88, 12], // orange-600
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 26, font: 'courier', fontStyle: 'bold', halign: 'center', textColor: [194, 65, 12] },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { cellWidth: 32, textColor: [71, 85, 105] },
      3: { cellWidth: 26, halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] },
      4: { cellWidth: 34, font: 'courier', halign: 'center', fontSize: 7.5 },
      5: { cellWidth: 22, halign: 'center' }
    },
    alternateRowStyles: {
      fillColor: [255, 247, 237] // warm orange tint
    },
    margin: { left: 14, right: 14, bottom: 16 },
    didDrawPage: () => {
      const totalPages = (doc as any).internal.getNumberOfPages();
      const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;
      
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        `${store?.name || 'Store'} • 4-Digit Product Short Codes Directory • Page ${currentPage} of ${totalPages}`,
        14,
        pageHeight - 6
      );
      doc.text(
        `Generated: ${now.toLocaleDateString()}`,
        pageWidth - 14,
        pageHeight - 6,
        { align: 'right' }
      );
    }
  });

  const cleanStoreName = (store?.name || 'Store').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = now.toISOString().split('T')[0];
  doc.save(`${cleanStoreName}_Product_Short_Codes_${dateStr}.pdf`);
}

