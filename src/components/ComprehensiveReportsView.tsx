import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileBarChart, 
  Calendar, 
  Printer, 
  Download, 
  Search, 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Package, 
  Receipt, 
  Scale, 
  Tag, 
  Layers, 
  CalendarDays, 
  CreditCard, 
  Banknote, 
  ChevronDown, 
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Building2,
  Percent,
  SlidersHorizontal,
  ArrowUpDown,
  FileText
} from 'lucide-react';
import { Store, Sale, Product, ProductReturn, Expense } from '../types';
import { printReceiptHtmlDirect } from '../utils/printThermalReceipt';

interface ComprehensiveReportsViewProps {
  store: Store;
  sales: Sale[];
  products: Product[];
  returns?: ProductReturn[];
  expenses?: Expense[];
}

type ReportPeriodMode = 'day' | 'month' | 'year' | 'range' | 'all';

interface AggregatedProductSales {
  productId: string;
  name: string;
  category: string;
  barcode: string;
  shortcutCode: string;
  serialNumber: string;
  sellBy: 'unit' | 'weight';
  unitType: string;
  totalQuantity: number;
  averageSellingPrice: number;
  totalSellingPrice: number; // Total Sales Revenue
  costPricePerUnit: number;
  totalCostPrice: number; // Total Purchase Cost
  grossProfit: number; // Total Selling - Total Cost
  marginPercent: number; // (Profit / Revenue) * 100
  receiptCount: number;
}

export const ComprehensiveReportsView: React.FC<ComprehensiveReportsViewProps> = ({
  store,
  sales = [],
  products = [],
  returns = [],
  expenses = []
}) => {
  const getTodayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getCurrentMonthISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const getCurrentYear = () => {
    return String(new Date().getFullYear());
  };

  // Filter State
  const [periodMode, setPeriodMode] = useState<ReportPeriodMode>('day');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayISO());
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthISO());
  const [selectedYear, setSelectedYear] = useState<string>(getCurrentYear());
  const [startDate, setStartDate] = useState<string>(getTodayISO());
  const [endDate, setEndDate] = useState<string>(getTodayISO());

  // Search & Sorting inside Table
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'profit' | 'revenue' | 'quantity' | 'cost' | 'name' | 'margin'>('profit');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Printing & Preview State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Quick Preset Handlers
  const applyPreset = (preset: 'today' | 'yesterday' | '7days' | 'this_month' | 'last_month' | 'this_year' | 'all') => {
    const today = new Date();
    const todayStr = getTodayISO();

    if (preset === 'today') {
      setPeriodMode('day');
      setSelectedDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
      setPeriodMode('day');
      setSelectedDate(yStr);
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(past.getDate() - 6);
      const pastStr = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
      setPeriodMode('range');
      setStartDate(pastStr);
      setEndDate(todayStr);
    } else if (preset === 'this_month') {
      setPeriodMode('month');
      setSelectedMonth(getCurrentMonthISO());
    } else if (preset === 'last_month') {
      const lm = new Date();
      lm.setMonth(lm.getMonth() - 1);
      const lmStr = `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, '0')}`;
      setPeriodMode('month');
      setSelectedMonth(lmStr);
    } else if (preset === 'this_year') {
      setPeriodMode('year');
      setSelectedYear(getCurrentYear());
    } else if (preset === 'all') {
      setPeriodMode('all');
    }
  };

  // Get period human-readable title
  const periodLabel = useMemo(() => {
    if (periodMode === 'day') {
      try {
        const d = new Date(selectedDate + 'T00:00:00');
        return d.toLocaleDateString('default', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      } catch {
        return selectedDate;
      }
    }
    if (periodMode === 'month') {
      try {
        const [y, m] = selectedMonth.split('-');
        const d = new Date(parseInt(y), parseInt(m) - 1, 1);
        return d.toLocaleDateString('default', { month: 'long', year: 'numeric' });
      } catch {
        return selectedMonth;
      }
    }
    if (periodMode === 'year') {
      return `Year ${selectedYear}`;
    }
    if (periodMode === 'range') {
      return `${startDate} to ${endDate}`;
    }
    return 'Lifetime (All Time)';
  }, [periodMode, selectedDate, selectedMonth, selectedYear, startDate, endDate]);

  // Filter sales based on selected period
  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      if (!sale.timestamp) return false;
      const saleDate = sale.timestamp.split('T')[0];

      if (periodMode === 'day') {
        return saleDate === selectedDate;
      }
      if (periodMode === 'month') {
        return saleDate.startsWith(selectedMonth);
      }
      if (periodMode === 'year') {
        return saleDate.startsWith(selectedYear);
      }
      if (periodMode === 'range') {
        return saleDate >= startDate && saleDate <= endDate;
      }
      return true; // 'all'
    });
  }, [sales, periodMode, selectedDate, selectedMonth, selectedYear, startDate, endDate]);

  // Filter returns in period
  const filteredReturns = useMemo(() => {
    return returns.filter(ret => {
      if (!ret.timestamp) return false;
      const retDate = ret.timestamp.split('T')[0];

      if (periodMode === 'day') return retDate === selectedDate;
      if (periodMode === 'month') return retDate.startsWith(selectedMonth);
      if (periodMode === 'year') return retDate.startsWith(selectedYear);
      if (periodMode === 'range') return retDate >= startDate && retDate <= endDate;
      return true;
    });
  }, [returns, periodMode, selectedDate, selectedMonth, selectedYear, startDate, endDate]);

  // Map of products for fast lookup of cost prices and categories
  const productCatalogMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => {
      map.set(p.id, p);
      if (p.barcode) map.set(p.barcode.toLowerCase().trim(), p);
      if (p.shortcutCode) map.set(p.shortcutCode.toLowerCase().trim(), p);
    });
    return map;
  }, [products]);

  // Aggregate item-by-item sales, quantities, cost prices, and selling prices
  const productSalesMap = useMemo(() => {
    const map = new Map<string, AggregatedProductSales>();

    filteredSales.forEach(sale => {
      (sale.items || []).forEach(item => {
        const prodId = item.productId || item.barcode || item.name;
        const catalogProd = productCatalogMap.get(item.productId) || 
                            productCatalogMap.get(item.barcode?.toLowerCase().trim()) || 
                            null;

        const costPerUnit = typeof item.costPrice === 'number' && item.costPrice >= 0 
          ? item.costPrice 
          : (typeof catalogProd?.costPrice === 'number' ? catalogProd.costPrice : 0);

        const sellingPrice = item.price || 0;
        const itemTotalSelling = typeof item.total === 'number' ? item.total : (sellingPrice * item.quantity);
        const itemTotalCost = costPerUnit * item.quantity;
        const itemGrossProfit = itemTotalSelling - itemTotalCost;

        if (map.has(prodId)) {
          const existing = map.get(prodId)!;
          const newQty = Math.round((existing.totalQuantity + item.quantity) * 1000) / 1000;
          const newTotalSelling = Math.round((existing.totalSellingPrice + itemTotalSelling) * 100) / 100;
          const newTotalCost = Math.round((existing.totalCostPrice + itemTotalCost) * 100) / 100;
          const newGrossProfit = Math.round((newTotalSelling - newTotalCost) * 100) / 100;
          const avgSellPrice = newQty > 0 ? Math.round((newTotalSelling / newQty) * 100) / 100 : sellingPrice;
          const margin = newTotalSelling > 0 ? Math.round(((newTotalSelling - newTotalCost) / newTotalSelling) * 1000) / 10 : 0;

          map.set(prodId, {
            ...existing,
            totalQuantity: newQty,
            totalSellingPrice: newTotalSelling,
            totalCostPrice: newTotalCost,
            grossProfit: newGrossProfit,
            averageSellingPrice: avgSellPrice,
            marginPercent: margin,
            receiptCount: existing.receiptCount + 1
          });
        } else {
          const margin = itemTotalSelling > 0 ? Math.round(((itemTotalSelling - itemTotalCost) / itemTotalSelling) * 1000) / 10 : 0;

          map.set(prodId, {
            productId: item.productId || prodId,
            name: item.name || catalogProd?.name || 'Unnamed Product',
            category: catalogProd?.category || 'General',
            barcode: item.barcode || catalogProd?.barcode || '',
            shortcutCode: item.shortcutCode || catalogProd?.shortcutCode || '',
            serialNumber: item.serialNumber || catalogProd?.serialNumber || '',
            sellBy: (item.sellBy || catalogProd?.sellBy || 'unit') as any,
            unitType: item.unitType || catalogProd?.unitType || 'piece',
            totalQuantity: item.quantity,
            averageSellingPrice: sellingPrice,
            totalSellingPrice: Math.round(itemTotalSelling * 100) / 100,
            costPricePerUnit: costPerUnit,
            totalCostPrice: Math.round(itemTotalCost * 100) / 100,
            grossProfit: Math.round(itemGrossProfit * 100) / 100,
            marginPercent: margin,
            receiptCount: 1
          });
        }
      });
    });

    return Array.from(map.values());
  }, [filteredSales, productCatalogMap]);

  // Overall Financial Performance Metrics
  const summaryMetrics = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;
    let totalUnitsSold = 0;
    let cashSalesTotal = 0;
    let onlineSalesTotal = 0;
    let totalDiscountAmount = 0;

    filteredSales.forEach(sale => {
      totalRevenue += (sale.totalAmount || 0);
      totalDiscountAmount += (sale.discountAmount || 0);
      if (sale.paymentMethod === 'cash') {
        cashSalesTotal += (sale.totalAmount || 0);
      } else {
        onlineSalesTotal += (sale.totalAmount || 0);
      }
    });

    productSalesMap.forEach(item => {
      totalCost += item.totalCostPrice;
      totalUnitsSold += item.totalQuantity;
    });

    const totalRefunds = filteredReturns.reduce((sum, r) => sum + (r.refundAmount || 0), 0);
    const netRevenue = Math.max(0, totalRevenue - totalRefunds);
    const grossProfit = Math.round((totalRevenue - totalCost) * 100) / 100;
    const overallMargin = totalRevenue > 0 ? Math.round(((totalRevenue - totalCost) / totalRevenue) * 1000) / 10 : 0;

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      grossProfit,
      overallMargin,
      totalRefunds: Math.round(totalRefunds * 100) / 100,
      netRevenue: Math.round(netRevenue * 100) / 100,
      receiptsCount: filteredSales.length,
      totalUnitsSold: Math.round(totalUnitsSold * 100) / 100,
      cashSalesTotal: Math.round(cashSalesTotal * 100) / 100,
      onlineSalesTotal: Math.round(onlineSalesTotal * 100) / 100,
      totalDiscountAmount: Math.round(totalDiscountAmount * 100) / 100,
      cashPercent: totalRevenue > 0 ? Math.round((cashSalesTotal / totalRevenue) * 100) : 0,
      onlinePercent: totalRevenue > 0 ? Math.round((onlineSalesTotal / totalRevenue) * 100) : 0
    };
  }, [filteredSales, filteredReturns, productSalesMap]);

  // Categories list for dropdown
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    productSalesMap.forEach(p => {
      if (p.category) set.add(p.category.trim());
    });
    return Array.from(set).sort();
  }, [productSalesMap]);

  // Filtered and sorted product breakdown
  const processedProducts = useMemo(() => {
    let result = [...productSalesMap];

    // Filter Category
    if (categoryFilter !== 'all') {
      result = result.filter(p => p.category.toLowerCase() === categoryFilter.toLowerCase());
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.shortcutCode.toLowerCase().includes(q) ||
        p.serialNumber.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }

      let valA = 0;
      let valB = 0;

      if (sortBy === 'profit') {
        valA = a.grossProfit;
        valB = b.grossProfit;
      } else if (sortBy === 'revenue') {
        valA = a.totalSellingPrice;
        valB = b.totalSellingPrice;
      } else if (sortBy === 'quantity') {
        valA = a.totalQuantity;
        valB = b.totalQuantity;
      } else if (sortBy === 'cost') {
        valA = a.totalCostPrice;
        valB = b.totalCostPrice;
      } else if (sortBy === 'margin') {
        valA = a.marginPercent;
        valB = b.marginPercent;
      }

      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return result;
  }, [productSalesMap, categoryFilter, searchQuery, sortBy, sortOrder]);

  // Generate isolated A4 print document HTML
  const generateReportPrintHtml = () => {
    const storeName = store.name || 'SUPERMARKET';
    const curr = store.currencySymbol || 'Rs.';
    const generatedAt = new Date().toLocaleString();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Sales & Profit Statement - ${storeName} - ${periodLabel}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 8mm 8mm 10mm 8mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 14px;
      color: #0f172a;
      background: #fff;
      font-size: 11px;
      line-height: 1.35;
    }
    .report-header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .store-brand {
      font-size: 22px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.5px;
      color: #0f172a;
    }
    .report-title {
      font-size: 13px;
      font-weight: 800;
      color: #4338ca;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .store-meta {
      font-size: 9.5px;
      color: #64748b;
      margin-top: 3px;
    }
    .period-badge {
      display: inline-block;
      padding: 4px 12px;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      border-radius: 6px;
      font-weight: 800;
      font-size: 11px;
      color: #312e81;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .kpi-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 10px;
      background: #f8fafc;
    }
    .kpi-card.highlight {
      background: #f0fdf4;
      border-color: #86efac;
    }
    .kpi-label {
      font-size: 8.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
    }
    .kpi-value {
      font-size: 14px;
      font-weight: 900;
      font-family: 'SF Mono', Monaco, monospace;
      color: #0f172a;
      margin-top: 2px;
    }
    .kpi-value.green {
      color: #166534;
    }
    .kpi-sub {
      font-size: 8.5px;
      color: #64748b;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
      margin-bottom: 12px;
    }
    th {
      background: #0f172a;
      color: #fff;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 6px;
      border: 1px solid #0f172a;
      font-size: 9px;
    }
    td {
      padding: 4px 6px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-mono { font-family: 'SF Mono', Monaco, monospace; }
    .font-bold { font-weight: 700; }
    .font-black { font-weight: 900; }
    .profit-positive { color: #166534; font-weight: 800; }
    .profit-negative { color: #dc2626; font-weight: 800; }
    tfoot td {
      background: #f1f5f9 !important;
      font-weight: 900;
      border-top: 2px solid #0f172a;
      border-bottom: 2px solid #0f172a;
      font-size: 10px;
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px dashed #cbd5e1;
      font-size: 9.5px;
      color: #475569;
    }
    .signature-box {
      width: 220px;
      text-align: center;
      border-top: 1px solid #0f172a;
      padding-top: 4px;
      margin-top: 30px;
    }
  </style>
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        try {
          window.focus();
          window.print();
        } catch(e) {
          console.warn(e);
        }
      }, 250);
    });
  </script>
</head>
<body>
  <div class="report-header">
    <div>
      <div class="store-brand">${storeName}</div>
      <div class="report-title">Official Financial & Product Sales Statement</div>
      <div class="store-meta">
        ${store.address ? `<span>${store.address}</span> &bull; ` : ''}
        ${store.phone ? `<span>Tel: ${store.phone}</span> &bull; ` : ''}
        <span>Generated on: ${generatedAt}</span>
      </div>
    </div>
    <div style="text-align: right;">
      <div class="period-badge">Report Period: ${periodLabel}</div>
      <div style="font-size: 9px; color: #64748b; margin-top: 4px;">Transactions: <strong>${summaryMetrics.receiptsCount} receipts</strong></div>
    </div>
  </div>

  <!-- KPI SUMMARY -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Gross Sales Revenue</div>
      <div class="kpi-value">${curr} ${summaryMetrics.totalRevenue.toFixed(2)}</div>
      <div class="kpi-sub">Cash: ${summaryMetrics.cashPercent}% | Digital: ${summaryMetrics.onlinePercent}%</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total Wholesale Cost (COGS)</div>
      <div class="kpi-value">${curr} ${summaryMetrics.totalCost.toFixed(2)}</div>
      <div class="kpi-sub">Wholesale purchase basis</div>
    </div>
    <div class="kpi-card highlight">
      <div class="kpi-label">Net Gross Profit</div>
      <div class="kpi-value green">${curr} ${summaryMetrics.grossProfit.toFixed(2)}</div>
      <div class="kpi-sub">Realized Profit Margin: <strong>${summaryMetrics.overallMargin}%</strong></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Units Sold & Returns</div>
      <div class="kpi-value">${summaryMetrics.totalUnitsSold} Units</div>
      <div class="kpi-sub">Refunds Deducted: ${curr} ${summaryMetrics.totalRefunds.toFixed(2)}</div>
    </div>
  </div>

  <!-- PRODUCT BREAKDOWN TABLE -->
  <table>
    <thead>
      <tr>
        <th class="text-center" style="width: 25px;">#</th>
        <th style="text-align: left;">Product Name & Category</th>
        <th class="text-center" style="width: 70px;">Code / Key</th>
        <th class="text-center" style="width: 65px;">Qty Sold</th>
        <th class="text-right" style="width: 85px;">Unit Cost</th>
        <th class="text-right" style="width: 95px;">Total Cost</th>
        <th class="text-right" style="width: 85px;">Avg Selling</th>
        <th class="text-right" style="width: 100px;">Total Revenue</th>
        <th class="text-right" style="width: 95px;">Gross Profit</th>
        <th class="text-center" style="width: 60px;">Margin %</th>
      </tr>
    </thead>
    <tbody>
      ${processedProducts.map((p, idx) => {
        const isPos = p.grossProfit >= 0;
        const code = p.shortcutCode ? `#${p.shortcutCode}` : (p.barcode ? p.barcode.slice(-8) : '-');
        return `
          <tr>
            <td class="text-center font-mono" style="color: #64748b;">${idx + 1}</td>
            <td>
              <strong>${p.name}</strong>
              <span style="font-size: 8.5px; color: #64748b; margin-left: 4px;">[${p.category}]</span>
            </td>
            <td class="text-center font-mono" style="font-size: 9px;">${code}</td>
            <td class="text-center font-mono font-bold">${p.totalQuantity} ${p.sellBy === 'weight' ? 'kg' : 'pcs'}</td>
            <td class="text-right font-mono">${curr} ${p.costPricePerUnit.toFixed(2)}</td>
            <td class="text-right font-mono font-bold" style="color: #854d0e;">${curr} ${p.totalCostPrice.toFixed(2)}</td>
            <td class="text-right font-mono">${curr} ${p.averageSellingPrice.toFixed(2)}</td>
            <td class="text-right font-mono font-bold" style="color: #1e3a8a;">${curr} ${p.totalSellingPrice.toFixed(2)}</td>
            <td class="text-right font-mono ${isPos ? 'profit-positive' : 'profit-negative'}">
              ${isPos ? '+' : ''}${curr} ${p.grossProfit.toFixed(2)}
            </td>
            <td class="text-center font-mono font-bold">${p.marginPercent > 0 ? '+' : ''}${p.marginPercent.toFixed(1)}%</td>
          </tr>
        `;
      }).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="text-align: right; text-transform: uppercase;">Grand Totals:</td>
        <td class="text-center font-mono font-black">${summaryMetrics.totalUnitsSold}</td>
        <td class="text-right">-</td>
        <td class="text-right font-mono font-black" style="color: #854d0e;">${curr} ${summaryMetrics.totalCost.toFixed(2)}</td>
        <td class="text-right">-</td>
        <td class="text-right font-mono font-black" style="color: #1e3a8a;">${curr} ${summaryMetrics.totalRevenue.toFixed(2)}</td>
        <td class="text-right font-mono font-black ${summaryMetrics.grossProfit >= 0 ? 'profit-positive' : 'profit-negative'}">
          ${curr} ${summaryMetrics.grossProfit.toFixed(2)}
        </td>
        <td class="text-center font-mono font-black">${summaryMetrics.overallMargin}%</td>
      </tr>
    </tfoot>
  </table>

  <!-- SIGNATURES -->
  <div class="signatures">
    <div>
      <div class="signature-box">Prepared By (Store Accountant)</div>
    </div>
    <div>
      <div class="signature-box">Approved By (Store Owner / Manager)</div>
    </div>
  </div>
</body>
</html>`;
  };

  // Handle direct print
  const handlePrint = async () => {
    setIsPrinting(true);
    setIsPrintModalOpen(true);
    try {
      const html = generateReportPrintHtml();
      await printReceiptHtmlDirect(html);
    } catch (err) {
      console.warn('Direct print error:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  // Handle Standalone HTML Report Download
  const handleDownloadHtml = () => {
    const html = generateReportPrintHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ReportStatement-${store.name?.replace(/\s+/g, '_') || 'Store'}-${periodMode}-${selectedDate || selectedMonth || selectedYear}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle CSV Download
  const handleDownloadCSV = () => {
    const currency = 'PKR (Rs.)';
    const storeName = store.name || 'Supermarket';
    
    let csv = `SUPERMARKET FINANCIAL & SALES REPORT\n`;
    csv += `Store Name,${storeName}\n`;
    csv += `Report Period,${periodLabel}\n`;
    csv += `Generated Date,${new Date().toLocaleString()}\n`;
    csv += `Currency,${currency}\n\n`;

    csv += `EXECUTIVE FINANCIAL SUMMARY\n`;
    csv += `Total Sales Revenue,Rs. ${summaryMetrics.totalRevenue.toFixed(2)}\n`;
    csv += `Total Cost of Goods Sold (COGS),Rs. ${summaryMetrics.totalCost.toFixed(2)}\n`;
    csv += `Net Gross Profit,Rs. ${summaryMetrics.grossProfit.toFixed(2)}\n`;
    csv += `Overall Profit Margin,${summaryMetrics.overallMargin.toFixed(1)}%\n`;
    csv += `Total Transactions / Receipts,${summaryMetrics.receiptsCount}\n`;
    csv += `Total Items / Units Sold,${summaryMetrics.totalUnitsSold}\n`;
    csv += `Cash Revenue,Rs. ${summaryMetrics.cashSalesTotal.toFixed(2)} (${summaryMetrics.cashPercent}%)\n`;
    csv += `Online / Card Revenue,Rs. ${summaryMetrics.onlineSalesTotal.toFixed(2)} (${summaryMetrics.onlinePercent}%)\n`;
    csv += `Total Refunds Deducted,Rs. ${summaryMetrics.totalRefunds.toFixed(2)}\n`;
    csv += `Net Settlement,Rs. ${summaryMetrics.netRevenue.toFixed(2)}\n\n`;

    csv += `DETAILED PRODUCT-BY-PRODUCT BREAKDOWN\n`;
    csv += `# ,Product Name,Category,Barcode / Short Key,Qty Sold,Unit Cost Price,Total Cost Price,Avg Selling Price,Total Sales Revenue,Gross Profit,Margin %\n`;

    processedProducts.forEach((p, idx) => {
      const cleanName = `"${p.name.replace(/"/g, '""')}"`;
      const code = p.shortcutCode ? `#${p.shortcutCode}` : (p.barcode || p.serialNumber || '-');
      csv += `${idx + 1},${cleanName},${p.category},${code},${p.totalQuantity},${p.costPricePerUnit.toFixed(2)},${p.totalCostPrice.toFixed(2)},${p.averageSellingPrice.toFixed(2)},${p.totalSellingPrice.toFixed(2)},${p.grossProfit.toFixed(2)},${p.marginPercent.toFixed(1)}%\n`;
    });

    csv += `\nTOTALS,,,${summaryMetrics.totalUnitsSold},,Rs. ${summaryMetrics.totalCost.toFixed(2)},,Rs. ${summaryMetrics.totalRevenue.toFixed(2)},Rs. ${summaryMetrics.grossProfit.toFixed(2)},${summaryMetrics.overallMargin.toFixed(1)}%\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SalesReport-${store.name?.replace(/\s+/g, '_') || 'Store'}-${periodMode}-${selectedDate || selectedMonth || selectedYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div id="printable-comprehensive-report" className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* 1. Header Banner & Action Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-indigo-400">
            <FileBarChart className="w-4 h-4" />
            <span>Comprehensive Business Reporting</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1 text-white">
            Reports, Profit & Sales Statements
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-2xl mt-1.5 leading-relaxed">
            Filter by <strong>Single Date</strong>, <strong>Month</strong>, or <strong>Year</strong> to evaluate revenue, wholesale cost prices, selling rates, and net profit per product. Print thermal/A4 statements or download Excel/CSV sheets.
          </p>
        </div>

        {/* Print & Download Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto shrink-0">
          <button
            type="button"
            onClick={handleDownloadCSV}
            className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/25 transition-all"
            title="Export full report to CSV / Excel spreadsheet"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Download Excel / CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/25 transition-all"
            title="Print professional formatted statement"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Date / Period Filter Controller */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 overflow-x-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => setPeriodMode('day')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                periodMode === 'day' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Specific Date</span>
            </button>

            <button
              type="button"
              onClick={() => setPeriodMode('month')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                periodMode === 'month' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>By Month & Year</span>
            </button>

            <button
              type="button"
              onClick={() => setPeriodMode('year')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                periodMode === 'year' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Full Year</span>
            </button>

            <button
              type="button"
              onClick={() => setPeriodMode('range')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                periodMode === 'range' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Custom Range</span>
            </button>

            <button
              type="button"
              onClick={() => setPeriodMode('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                periodMode === 'all' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Time</span>
            </button>
          </div>

          {/* Quick Preset Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mr-1">Quick:</span>
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7days', label: 'Last 7 Days' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'this_year', label: 'This Year' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id as any)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer shadow-2xs"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Input Row based on Mode */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {periodMode === 'day' && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-extrabold text-slate-700">Select Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
              />
            </div>
          )}

          {periodMode === 'month' && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-extrabold text-slate-700">Select Month & Year:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
              />
            </div>
          )}

          {periodMode === 'year' && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-extrabold text-slate-700">Select Year:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
              >
                {[2024, 2025, 2026, 2027, 2028].map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>
          )}

          {periodMode === 'range' && (
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-extrabold text-slate-700">From:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-extrabold text-slate-700">To:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2 text-xs font-bold text-slate-500">
            <span>Period:</span>
            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-900 rounded-lg border border-indigo-200 font-extrabold">
              {periodLabel}
            </span>
            <span className="text-slate-400">&bull;</span>
            <span>{summaryMetrics.receiptsCount} Receipts Found</span>
          </div>
        </div>
      </div>

      {/* 3. Executive KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Sales Revenue */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Gross Sales Revenue</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
            Rs. {summaryMetrics.totalRevenue.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
            <span>{summaryMetrics.receiptsCount} total receipts</span>
            <span>&bull;</span>
            <span className="text-emerald-600 font-bold">{summaryMetrics.cashPercent}% Cash</span>
          </div>
        </div>

        {/* Card 2: Total Cost of Goods (COGS) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Wholesale Cost</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
            Rs. {summaryMetrics.totalCost.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Calculated across {summaryMetrics.totalUnitsSold} units sold
          </div>
        </div>

        {/* Card 3: Net Gross Profit */}
        <div className="bg-gradient-to-br from-emerald-900 via-slate-900 to-emerald-950 text-white p-5 rounded-3xl shadow-md border border-emerald-800 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-emerald-300">
            <span className="text-xs font-extrabold uppercase tracking-wider">Net Gross Profit</span>
            <div className="p-2 bg-emerald-800/60 rounded-xl text-emerald-200">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-300 font-mono tracking-tight">
            Rs. {summaryMetrics.grossProfit.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-emerald-200 font-bold">
            <span className="bg-emerald-800 px-2 py-0.5 rounded-md font-mono">
              Margin: {summaryMetrics.overallMargin}%
            </span>
            <span>Profit on Sales</span>
          </div>
        </div>

        {/* Card 4: Units Sold & Payment Distribution */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Products Sold</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
            {summaryMetrics.totalUnitsSold} <span className="text-xs text-slate-500 font-normal">Units/Kg</span>
          </div>
          <div className="text-[11px] text-slate-600 font-medium flex items-center justify-between">
            <span>Online/Card: Rs. {summaryMetrics.onlineSalesTotal.toFixed(0)}</span>
            <span className="text-indigo-600 font-bold">({summaryMetrics.onlinePercent}%)</span>
          </div>
        </div>
      </div>

      {/* 4. Detailed Product Breakdown Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4 print:hidden">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              <span>Product Sales, Cost Prices & Profit Breakdown</span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                {processedProducts.length} Items
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Showing which products sold, exact quantities, total wholesale cost price, selling price, and profit earned during {periodLabel}.
            </p>
          </div>

          {/* Filters & Sorting */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search product, barcode..."
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white shadow-2xs"
              />
            </div>

            {/* Category Dropdown */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
            >
              <option value="all">All Categories ({allCategories.length})</option>
              {allCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent border-0 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-2"
              >
                <option value="profit">Sort by Profit</option>
                <option value="revenue">Sort by Revenue</option>
                <option value="quantity">Sort by Quantity Sold</option>
                <option value="cost">Sort by Cost Price</option>
                <option value="margin">Sort by Margin %</option>
                <option value="name">Sort by Name</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors cursor-pointer"
                title={`Order: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Printable Supermarket Header (Visible ONLY when printing) */}
        <div className="hidden print:block text-center space-y-1 mb-6 border-b-2 border-slate-900 pb-4">
          <div className="text-xl font-black uppercase text-slate-900">{store.name || 'SUPERMARKET MART'}</div>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-700">Official Sales, Cost & Profit Report</div>
          <div className="text-xs text-slate-600 font-mono">Period: {periodLabel} &bull; Generated: {new Date().toLocaleString()}</div>
          {store.address && <div className="text-[10px] text-slate-500">{store.address}</div>}
          
          <div className="grid grid-cols-4 gap-2 pt-3 text-left border-t border-slate-300 mt-2 text-xs font-mono">
            <div className="p-1.5 bg-slate-100 border">Gross Sales: <strong>Rs. {summaryMetrics.totalRevenue.toFixed(2)}</strong></div>
            <div className="p-1.5 bg-slate-100 border">Cost of Goods: <strong>Rs. {summaryMetrics.totalCost.toFixed(2)}</strong></div>
            <div className="p-1.5 bg-slate-100 border">Net Profit: <strong>Rs. {summaryMetrics.grossProfit.toFixed(2)}</strong></div>
            <div className="p-1.5 bg-slate-100 border">Profit Margin: <strong>{summaryMetrics.overallMargin}%</strong></div>
          </div>
        </div>

        {/* Table Container */}
        {processedProducts.length === 0 ? (
          <div className="py-12 text-center text-slate-500 space-y-2">
            <Package className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-extrabold text-slate-700 text-sm">No products sold in this period</p>
            <p className="text-xs text-slate-400">Try selecting a different date, month, or year using the filter above.</p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-white font-extrabold border-b border-slate-800 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3">Product Name & Category</th>
                  <th className="py-3 px-3 text-center w-24">Qty Sold</th>
                  <th className="py-3 px-3 text-right w-28">Cost Price / Unit</th>
                  <th className="py-3 px-3 text-right w-32">Total Cost</th>
                  <th className="py-3 px-3 text-right w-28">Avg Sell Price</th>
                  <th className="py-3 px-3 text-right w-32">Sales Revenue</th>
                  <th className="py-3 px-3 text-right w-32">Gross Profit</th>
                  <th className="py-3 px-3 text-center w-20">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {processedProducts.map((p, index) => {
                  const isPositive = p.grossProfit >= 0;
                  return (
                    <tr key={p.productId || index} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px]">
                        {index + 1}
                      </td>

                      {/* Product Name & Identifiers */}
                      <td className="py-2.5 px-3">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span>{p.name}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-semibold border border-slate-200">
                              {p.category}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                            {p.shortcutCode && <span>#{p.shortcutCode}</span>}
                            {p.barcode && <span>Bar: {p.barcode}</span>}
                            <span>{p.receiptCount} bills</span>
                          </div>
                        </div>
                      </td>

                      {/* Quantity Sold */}
                      <td className="py-2.5 px-3 text-center font-mono font-black text-slate-900 text-xs">
                        {p.totalQuantity} <span className="text-[10px] font-normal text-slate-500">{p.sellBy === 'weight' ? 'kg' : 'pcs'}</span>
                      </td>

                      {/* Cost Price per Unit */}
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 text-xs">
                        Rs. {p.costPricePerUnit.toFixed(2)}
                      </td>

                      {/* Total Cost Price */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800 text-xs">
                        Rs. {p.totalCostPrice.toFixed(2)}
                      </td>

                      {/* Average Selling Price */}
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 text-xs">
                        Rs. {p.averageSellingPrice.toFixed(2)}
                      </td>

                      {/* Total Sales Revenue */}
                      <td className="py-2.5 px-3 text-right font-mono font-black text-blue-900 text-xs">
                        Rs. {p.totalSellingPrice.toFixed(2)}
                      </td>

                      {/* Gross Profit */}
                      <td className={`py-2.5 px-3 text-right font-mono font-black text-xs ${
                        isPositive ? 'text-emerald-700' : 'text-rose-600'
                      }`}>
                        {isPositive ? '+' : ''}Rs. {p.grossProfit.toFixed(2)}
                      </td>

                      {/* Margin % */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black font-mono inline-block ${
                          p.marginPercent >= 20 
                            ? 'bg-emerald-100 text-emerald-900' 
                            : p.marginPercent > 0 
                            ? 'bg-blue-100 text-blue-900' 
                            : 'bg-rose-100 text-rose-900'
                        }`}>
                          {p.marginPercent > 0 ? '+' : ''}{p.marginPercent.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Table Footer Totals */}
              <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300 text-xs font-mono">
                <tr>
                  <td colSpan={2} className="py-3 px-3 text-right uppercase tracking-wider font-sans font-black">
                    Grand Period Totals:
                  </td>
                  <td className="py-3 px-3 text-center font-black">
                    {summaryMetrics.totalUnitsSold}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-500 font-normal">-</td>
                  <td className="py-3 px-3 text-right text-amber-900 font-black">
                    Rs. {summaryMetrics.totalCost.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-500 font-normal">-</td>
                  <td className="py-3 px-3 text-right text-blue-950 font-black">
                    Rs. {summaryMetrics.totalRevenue.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-800 font-black">
                    Rs. {summaryMetrics.grossProfit.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-center font-black">
                    <span className="px-2 py-0.5 rounded bg-emerald-200 text-emerald-950">
                      {summaryMetrics.overallMargin}%
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Printable Footer Stamp */}
        <div className="hidden print:flex justify-between items-center pt-8 border-t border-slate-300 text-xs text-slate-600 font-mono">
          <div>
            <div>Prepared By: ___________________</div>
            <div className="text-[10px] text-slate-400">Store Administrator / Accountant</div>
          </div>
          <div>
            <div>Approved By: ___________________</div>
            <div className="text-[10px] text-slate-400">Authorized Management Stamp</div>
          </div>
        </div>
      </div>

      {/* PRINT CONFIRMATION & DIRECT PREVIEW MODAL */}
      <AnimatePresence>
        {isPrintModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md">
                    <Printer className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Print Statement & Reports</h3>
                    <p className="text-xs text-indigo-300 font-medium">
                      {periodLabel} &bull; {processedProducts.length} items &bull; Gross Sales: Rs. {summaryMetrics.totalRevenue.toFixed(2)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body & Options */}
              <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 text-slate-800">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <div className="font-extrabold text-emerald-950 text-sm">
                      Print Command Dispatched
                    </div>
                    <div className="text-emerald-800 font-medium leading-relaxed">
                      Your system print dialog was triggered in high-resolution A4 landscape mode with full tabular data, wholesale cost prices, and revenue breakdown.
                    </div>
                  </div>
                </div>

                {/* Quick Summary Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-2 bg-white rounded-xl border border-slate-200">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Gross Sales</div>
                    <div className="font-mono font-black text-xs text-slate-900 mt-0.5">Rs. {summaryMetrics.totalRevenue.toFixed(0)}</div>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-slate-200">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Wholesale Cost</div>
                    <div className="font-mono font-black text-xs text-amber-800 mt-0.5">Rs. {summaryMetrics.totalCost.toFixed(0)}</div>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-emerald-200 bg-emerald-50/50">
                    <div className="text-[10px] uppercase font-bold text-emerald-700">Net Profit</div>
                    <div className="font-mono font-black text-xs text-emerald-700 mt-0.5">Rs. {summaryMetrics.grossProfit.toFixed(0)}</div>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-slate-200">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Units Sold</div>
                    <div className="font-mono font-black text-xs text-slate-900 mt-0.5">{summaryMetrics.totalUnitsSold}</div>
                  </div>
                </div>

                {/* Action Buttons for Fallback Printing and Offline Saving */}
                <div className="space-y-2.5">
                  <div className="text-xs font-black uppercase text-slate-500 tracking-wider">
                    Print / Export Options:
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Re-trigger Print */}
                    <button
                      type="button"
                      disabled={isPrinting}
                      onClick={async () => {
                        setIsPrinting(true);
                        try {
                          const html = generateReportPrintHtml();
                          await printReceiptHtmlDirect(html);
                        } finally {
                          setIsPrinting(false);
                        }
                      }}
                      className="p-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex flex-col items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer text-center"
                    >
                      <Printer className="w-5 h-5" />
                      <span>{isPrinting ? 'Sending to Printer...' : 'Print Again'}</span>
                      <span className="text-[10px] opacity-80 font-normal">Direct Print Dialog</span>
                    </button>

                    {/* Download Standalone HTML Statement (Print to PDF offline) */}
                    <button
                      type="button"
                      onClick={handleDownloadHtml}
                      className="p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex flex-col items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer text-center"
                    >
                      <Download className="w-5 h-5 text-amber-400" />
                      <span>Save HTML Statement</span>
                      <span className="text-[10px] text-slate-300 font-normal">Offline / PDF View</span>
                    </button>

                    {/* Download Excel / CSV Spreadsheet */}
                    <button
                      type="button"
                      onClick={handleDownloadCSV}
                      className="p-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex flex-col items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer text-center"
                    >
                      <FileSpreadsheet className="w-5 h-5" />
                      <span>Download Excel CSV</span>
                      <span className="text-[10px] opacity-80 font-normal">Full Spreadsheet</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">
                  Tip: In the print dialog, select <strong>"Save as PDF"</strong> to save a digital copy.
                </span>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer transition-colors"
                >
                  Done / Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
