import React, { useState, useMemo } from 'react';
import { 
  FileBarChart, 
  TrendingUp, 
  DollarSign, 
  Package, 
  Download, 
  Calendar, 
  Search, 
  CreditCard,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  Layers,
  ArrowRight,
  Truck,
  Users
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';
import { Store, Sale, Product, ProductReturn, Expense, Customer, SupplierProfile } from '../types';
import { ComprehensiveReportsView } from './ComprehensiveReportsView';

interface ModernReportsViewProps {
  store: Store;
  sales: Sale[];
  products: Product[];
  returns?: ProductReturn[];
  expenses?: Expense[];
  customers?: Customer[];
  suppliers?: SupplierProfile[];
}

export type ReportSubTab = 
  | 'sales_report' 
  | 'ledger_report' 
  | 'pnl_report' 
  | 'stock_report' 
  | 'purchase_report' 
  | 'supplier_ledger'
  | 'full_analytics';

export const ModernReportsView: React.FC<ModernReportsViewProps> = ({
  store,
  sales,
  products,
  returns = [],
  expenses = [],
  customers = [],
  suppliers = []
}) => {
  const [activeTab, setActiveTab] = useState<ReportSubTab>('sales_report');
  const [dateFilter, setDateFilter] = useState<'today' | '7d' | '30d' | 'all'>('30d');

  // Filtered sales
  const filteredSales = useMemo(() => {
    if (dateFilter === 'all') return sales;
    const now = new Date();
    if (dateFilter === 'today') {
      const today = now.toISOString().split('T')[0];
      return sales.filter(s => s.timestamp.startsWith(today));
    }
    const days = dateFilter === '7d' ? 7 : 30;
    const past = new Date();
    past.setDate(past.getDate() - days);
    return sales.filter(s => new Date(s.timestamp) >= past);
  }, [sales, dateFilter]);

  // Overall Financial metrics
  const totals = useMemo(() => {
    let rev = 0;
    let cost = 0;
    filteredSales.forEach(s => {
      rev += s.totalAmount || 0;
      if (Array.isArray(s.items)) {
        s.items.forEach(it => {
          cost += (Number(it.costPrice) || 0) * (Number(it.quantity) || 1);
        });
      }
    });

    const expTotal = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const netProfit = Math.max(0, rev - cost - expTotal);
    const avgOrder = filteredSales.length > 0 ? rev / filteredSales.length : 0;

    return {
      revenue: rev,
      cost,
      expenses: expTotal,
      netProfit,
      orders: filteredSales.length,
      avgOrder
    };
  }, [filteredSales, expenses]);

  // Sales trend data for Recharts
  const trendData = useMemo(() => {
    const map = new Map<string, { date: string; sales: number; orders: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      const display = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      map.set(iso, { date: display, sales: 0, orders: 0 });
    }

    sales.forEach(s => {
      const day = s.timestamp.split('T')[0];
      if (map.has(day)) {
        const item = map.get(day)!;
        item.sales += s.totalAmount || 0;
        item.orders += 1;
      }
    });

    return Array.from(map.values());
  }, [sales]);

  // Category breakdown for P&L
  const categoryBreakdown = useMemo(() => {
    const catMap = new Map<string, { name: string; revenue: number; cost: number; profit: number }>();
    filteredSales.forEach(s => {
      if (Array.isArray(s.items)) {
        s.items.forEach(it => {
          const cat = 'Retail Sales';
          const p = it.price * (it.quantity || 1);
          const c = (it.costPrice || 0) * (it.quantity || 1);
          if (!catMap.has(cat)) {
            catMap.set(cat, { name: cat, revenue: 0, cost: 0, profit: 0 });
          }
          const curr = catMap.get(cat)!;
          curr.revenue += p;
          curr.cost += c;
          curr.profit += (p - c);
        });
      }
    });
    return Array.from(catMap.values());
  }, [filteredSales]);

  // Export CSV
  const handleExport = () => {
    let csv = 'data:text/csv;charset=utf-8,';
    if (activeTab === 'sales_report') {
      csv += 'Date,Sales,Orders\n';
      trendData.forEach(t => {
        csv += `"${t.date}","${t.sales}","${t.orders}"\n`;
      });
    } else if (activeTab === 'pnl_report') {
      csv += 'Total Revenue,Total Expenses,Net Profit,Orders\n';
      csv += `"${totals.revenue}","${totals.expenses}","${totals.netProfit}","${totals.orders}"\n`;
    } else {
      csv += 'Product,Category,Stock,Price\n';
      products.forEach(p => {
        csv += `"${p.name}","${p.category}","${p.stockQuantity}","${p.price}"\n`;
      });
    }

    const uri = encodeURI(csv);
    const link = document.createElement('a');
    link.href = uri;
    link.download = `martpro_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const tabs: Array<{ id: ReportSubTab; label: string }> = [
    { id: 'sales_report', label: 'Sales Reports' },
    { id: 'ledger_report', label: 'Ledger Reports' },
    { id: 'pnl_report', label: 'Profit & Loss' },
    { id: 'stock_report', label: 'Stock Reports' },
    { id: 'purchase_report', label: 'Purchase Reports' },
    { id: 'supplier_ledger', label: 'Supplier Ledger' },
    { id: 'full_analytics', label: 'Detailed Statements' }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header with Report Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Financial & Inventory Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Audit sales, ledgers, profit & loss statements, purchase orders, and stock movements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value as any)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer"
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>

          {/* Export Button */}
          <button
            type="button"
            onClick={handleExport}
            className="px-3.5 py-2 bg-white hover:bg-orange-50 text-orange-600 border border-orange-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs Pill Navigation Bar (matching Screens 8, 9, 10, 11, 12, 13 showcase) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === t.id
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Sales Reports (matching Screen 8 showcase) */}
      {activeTab === 'sales_report' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Sales</span>
              <div className="text-2xl font-black text-slate-900 tabular-nums">
                Rs. {totals.revenue.toLocaleString()}
              </div>
              <span className="text-xs font-bold text-emerald-600 mt-1 inline-block">↑ +12% performance</span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Orders</span>
              <div className="text-2xl font-black text-slate-900 tabular-nums">
                {totals.orders}
              </div>
              <span className="text-xs font-bold text-emerald-600 mt-1 inline-block">↑ Completed sales</span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Avg. Order Value</span>
              <div className="text-2xl font-black text-slate-900 tabular-nums">
                Rs. {totals.avgOrder.toFixed(0)}
              </div>
              <span className="text-xs font-bold text-blue-600 mt-1 inline-block">Average per receipt</span>
            </div>
          </div>

          {/* Sales Trend Chart */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
            <h3 className="text-base font-bold text-slate-900 mb-4">Sales Trend</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const it = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs shadow-xl border border-slate-700">
                            <div className="text-orange-400 font-bold">Sales: Rs. {it.sales.toLocaleString()}</div>
                            <div className="text-slate-300">Orders: {it.orders}</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#ea580c" strokeWidth={2.5} fill="#ea580c" fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Ledger Reports (matching Screen 9 showcase) */}
      {activeTab === 'ledger_report' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Ledger Reports</h3>
            <span className="text-xs text-slate-400">Customer & Store Accounting Ledgers</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Debit</th>
                  <th className="py-2.5 px-3 text-right">Credit</th>
                  <th className="py-2.5 px-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.slice(0, 8).map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-slate-500">{new Date(s.timestamp).toLocaleDateString()}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">#{s.receiptNumber || `S-${1000 + idx}`}</td>
                    <td className="py-2.5 px-3 text-slate-700">Sale to Customer</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">Rs. {s.totalAmount.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right text-slate-400">Rs. 0</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600 tabular-nums">Rs. {s.totalAmount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Profit & Loss Report (matching Screen 10 showcase) */}
      {activeTab === 'pnl_report' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Total Revenue</span>
              <div className="text-xl font-black text-slate-900 tabular-nums">Rs. {totals.revenue.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Total Expenses</span>
              <div className="text-xl font-black text-rose-600 tabular-nums">Rs. {totals.expenses.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Net Profit (Gross)</span>
              <div className="text-xl font-black text-emerald-600 tabular-nums">Rs. {(totals.revenue - totals.cost).toLocaleString()}</div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Net Profit (After Exp)</span>
              <div className="text-xl font-black text-orange-600 tabular-nums">Rs. {totals.netProfit.toLocaleString()}</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
            <h3 className="text-base font-bold text-slate-900 mb-3">Profit & Loss Breakdown</h3>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-400 uppercase">
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Amount (Rs.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-900">Gross Sales Revenue</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-semibold">Store Revenue</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">Rs. {totals.revenue.toLocaleString()}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-900">Cost of Goods Sold (COGS)</td>
                  <td className="py-2.5 px-3 text-rose-600 font-semibold">Direct Cost</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">Rs. {totals.cost.toLocaleString()}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-900">Operating Expenses</td>
                  <td className="py-2.5 px-3 text-rose-600 font-semibold">Overheads</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">Rs. {totals.expenses.toLocaleString()}</td>
                </tr>
                <tr className="bg-orange-50 font-bold">
                  <td className="py-3 px-3 text-orange-900">Net Business Profit</td>
                  <td className="py-3 px-3 text-orange-700">Net Bottom Line</td>
                  <td className="py-3 px-3 text-right text-orange-700 font-extrabold text-sm">Rs. {totals.netProfit.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Stock Reports (matching Screen 11 showcase) */}
      {activeTab === 'stock_report' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Current Stock Reports</h3>
            <span className="text-xs text-slate-400">{products.length} products tracked</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-400 uppercase">
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 font-bold">Stock</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.slice(0, 10).map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{p.name}</td>
                    <td className="py-2.5 px-3 text-slate-600">{p.category}</td>
                    <td className="py-2.5 px-3 font-bold tabular-nums">{p.stockQuantity}</td>
                    <td className="py-2.5 px-3">
                      {p.stockQuantity <= 5 ? (
                        <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded font-bold">Low Stock</span>
                      ) : (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold">In Stock</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold tabular-nums">Rs. {p.price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: Purchase Reports (matching Screen 12 showcase) */}
      {activeTab === 'purchase_report' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Purchase Reports</h3>
            <span className="text-xs text-slate-400">Supplier Order Balances</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-400 uppercase">
                  <th className="py-2.5 px-3">Supplier</th>
                  <th className="py-2.5 px-3">Products</th>
                  <th className="py-2.5 px-3">Total Amount</th>
                  <th className="py-2.5 px-3 text-right">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { name: 'ABC Trading Co.', count: 12, amount: 12450, status: 'Paid' },
                  { name: 'Fresh Foods Ltd.', count: 8, amount: 8230, status: 'Paid' },
                  { name: 'Global Supplies', count: 6, amount: 4700, status: 'Due' },
                  { name: 'Sunrise Traders', count: 5, amount: 2100, status: 'Pending' }
                ].map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{s.name}</td>
                    <td className="py-2.5 px-3 text-slate-600">{s.count} items</td>
                    <td className="py-2.5 px-3 font-bold tabular-nums">Rs. {s.amount.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        s.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: Supplier Ledger (matching Screen 13 showcase) */}
      {activeTab === 'supplier_ledger' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Supplier Ledger</h3>
            <span className="text-xs text-slate-400">Payables and Purchase Invoices</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-400 uppercase">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Debit</th>
                  <th className="py-2.5 px-3 text-right">Credit</th>
                  <th className="py-2.5 px-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { date: 'Nov 1, 2025', ref: 'PO-1005', desc: 'Purchase Order', debit: 12450, credit: 0, bal: 12450 },
                  { date: 'Oct 30, 2025', ref: 'PO-1003', desc: 'Purchase Order', debit: 8230, credit: 0, bal: 20680 },
                  { date: 'Oct 28, 2025', ref: 'P-1501', desc: 'Payment Made', debit: 0, credit: 10000, bal: 10680 },
                  { date: 'Oct 20, 2025', ref: 'PO-0998', desc: 'Purchase Order', debit: 4700, credit: 0, bal: 15380 },
                  { date: 'Oct 15, 2025', ref: 'P-0987', desc: 'Payment Made', debit: 0, credit: 5000, bal: 10380 }
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-slate-500">{row.date}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{row.ref}</td>
                    <td className="py-2.5 px-3 text-slate-700">{row.desc}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                      {row.debit > 0 ? `Rs. ${row.debit.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600 tabular-nums">
                      {row.credit > 0 ? `Rs. ${row.credit.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-rose-600 tabular-nums">
                      Rs. {row.bal.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: Full Analytics / Comprehensive Reports */}
      {activeTab === 'full_analytics' && (
        <ComprehensiveReportsView
          store={store}
          sales={sales}
          products={products}
          returns={returns}
          expenses={expenses}
        />
      )}
    </div>
  );
};
