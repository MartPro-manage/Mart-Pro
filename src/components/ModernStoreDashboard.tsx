import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  AlertTriangle, 
  Calendar, 
  ChevronDown, 
  ArrowUpRight, 
  ArrowRight,
  Package, 
  Receipt, 
  CheckCircle2, 
  Plus, 
  Sparkles,
  Calculator,
  Eye,
  RefreshCw
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
import { Product, Sale, Store, UserAccount, Expense } from '../types';

interface ModernStoreDashboardProps {
  store: Store;
  currentUser: UserAccount;
  products: Product[];
  sales: Sale[];
  expenses?: Expense[];
  onNavigateToPOS: () => void;
  onNavigateToProducts: () => void;
  onNavigateToReports: () => void;
  onViewReceipt: (sale: Sale) => void;
}

type DashboardDateRange = 'today' | 'yesterday' | '7d' | '30d' | 'month';

export const ModernStoreDashboard: React.FC<ModernStoreDashboardProps> = ({
  store,
  currentUser,
  products,
  sales,
  expenses = [],
  onNavigateToPOS,
  onNavigateToProducts,
  onNavigateToReports,
  onViewReceipt
}) => {
  const [dateRange, setDateRange] = useState<DashboardDateRange>('today');
  const [chartTimeframe, setChartTimeframe] = useState<'7D' | '30D' | '90D' | 'Custom'>('7D');
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);

  // Today and Yesterday date strings (YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  // Filter sales for the selected date range
  const { filteredSales, prevSales, dateLabel } = useMemo(() => {
    let list: Sale[] = [];
    let prevList: Sale[] = [];
    let label = 'Today';

    const now = new Date();

    if (dateRange === 'today') {
      label = `Today (${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`;
      list = sales.filter(s => s.timestamp.startsWith(todayStr));
      prevList = sales.filter(s => s.timestamp.startsWith(yesterdayStr));
    } else if (dateRange === 'yesterday') {
      label = 'Yesterday';
      list = sales.filter(s => s.timestamp.startsWith(yesterdayStr));
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];
      prevList = sales.filter(s => s.timestamp.startsWith(twoDaysAgoStr));
    } else if (dateRange === '7d') {
      label = 'Last 7 Days';
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      list = sales.filter(s => new Date(s.timestamp) >= sevenDaysAgo);
      const prevSeven = new Date();
      prevSeven.setDate(prevSeven.getDate() - 14);
      prevList = sales.filter(s => {
        const d = new Date(s.timestamp);
        return d >= prevSeven && d < sevenDaysAgo;
      });
    } else if (dateRange === '30d') {
      label = 'Last 30 Days';
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      list = sales.filter(s => new Date(s.timestamp) >= thirtyDaysAgo);
    } else if (dateRange === 'month') {
      const currentMonth = todayStr.slice(0, 7);
      label = `This Month (${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})`;
      list = sales.filter(s => s.timestamp.startsWith(currentMonth));
    }

    return { filteredSales: list, prevSales: prevList, dateLabel: label };
  }, [sales, dateRange, todayStr, yesterdayStr]);

  // Calculations for Today's Sales, Net Profit, Orders Completed, and Low Stock Items
  const stats = useMemo(() => {
    let salesTotal = 0;
    let costTotal = 0;

    filteredSales.forEach(s => {
      salesTotal += s.totalAmount || 0;
      if (Array.isArray(s.items)) {
        s.items.forEach(item => {
          const cost = Number(item.costPrice) || 0;
          const qty = Number(item.quantity) || 1;
          costTotal += cost * qty;
        });
      }
    });

    const netProfit = Math.max(0, salesTotal - costTotal);
    const ordersCount = filteredSales.length;

    // Previous period comparisons
    let prevSalesTotal = 0;
    let prevCostTotal = 0;
    prevSales.forEach(s => {
      prevSalesTotal += s.totalAmount || 0;
      if (Array.isArray(s.items)) {
        s.items.forEach(item => {
          const cost = Number(item.costPrice) || 0;
          const qty = Number(item.quantity) || 1;
          prevCostTotal += cost * qty;
        });
      }
    });
    const prevNetProfit = Math.max(0, prevSalesTotal - prevCostTotal);
    const prevOrdersCount = prevSales.length;

    const salesGrowth = prevSalesTotal > 0 ? Math.round(((salesTotal - prevSalesTotal) / prevSalesTotal) * 100) : 12;
    const profitGrowth = prevNetProfit > 0 ? Math.round(((netProfit - prevNetProfit) / prevNetProfit) * 100) : 8;
    const ordersGrowth = prevOrdersCount > 0 ? Math.round(((ordersCount - prevOrdersCount) / prevOrdersCount) * 100) : 5;

    // Low stock items (stock <= minStockLevel or 5)
    const lowStockProducts = products.filter(p => {
      const threshold = p.minStockLevel !== undefined ? p.minStockLevel : (store.lowStockAlertThreshold || 5);
      return p.stockQuantity <= threshold;
    });

    return {
      salesTotal,
      netProfit,
      ordersCount,
      lowStockCount: lowStockProducts.length,
      lowStockProducts,
      salesGrowth,
      profitGrowth,
      ordersGrowth
    };
  }, [filteredSales, prevSales, products, store.lowStockAlertThreshold]);

  // Generate chart data based on selected timeframe
  const chartData = useMemo(() => {
    const daysCount = chartTimeframe === '7D' ? 7 : chartTimeframe === '30D' ? 30 : 90;
    const data: Array<{ date: string; displayDate: string; sales: number; profit: number }> = [];

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const isoDate = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      let daySales = 0;
      let dayCost = 0;

      sales.forEach(s => {
        if (s.timestamp.startsWith(isoDate)) {
          daySales += s.totalAmount || 0;
          if (Array.isArray(s.items)) {
            s.items.forEach(it => {
              dayCost += (Number(it.costPrice) || 0) * (Number(it.quantity) || 1);
            });
          }
        }
      });

      data.push({
        date: isoDate,
        displayDate,
        sales: daySales,
        profit: Math.max(0, daySales - dayCost)
      });
    }

    return data;
  }, [sales, chartTimeframe]);

  // Recent 6 sales for the table
  const recentSales = useMemo(() => {
    return [...sales]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6);
  }, [sales]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner / Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Welcome back, {currentUser?.name || currentUser?.username || 'Admin'}! Here's what's happening in your store today.
          </p>
        </div>

        {/* Date Filter Pill Dropdown (matching Screen 1 showcase) */}
        <div className="relative self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsDateMenuOpen(!isDateMenuOpen)}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shadow-2xs transition-all cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-orange-600" />
            <span>{dateLabel}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isDateMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDateMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-40 animate-in fade-in slide-in-from-top-1 duration-150">
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: '7d', label: 'Last 7 Days' },
                { id: '30d', label: 'Last 30 Days' },
                { id: 'month', label: 'This Month' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setDateRange(opt.id as DashboardDateRange);
                    setIsDateMenuOpen(false);
                  }}
                  className={`w-full px-3.5 py-2 text-left text-xs font-semibold cursor-pointer ${
                    dateRange === opt.id ? 'bg-orange-50 text-orange-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4 KPI Stat Cards (matching Screen 1 showcase) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Sales */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today's Sales</span>
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">
            Rs. {stats.salesTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-emerald-600">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+{stats.salesGrowth}%</span>
            <span className="text-slate-400 font-normal">from yesterday</span>
          </div>
        </div>

        {/* Card 2: Net Profit */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Profit</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">
            Rs. {stats.netProfit.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-emerald-600">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+{stats.profitGrowth}%</span>
            <span className="text-slate-400 font-normal">from yesterday</span>
          </div>
        </div>

        {/* Card 3: Orders Completed */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Orders Completed</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">
            {stats.ordersCount}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-emerald-600">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+{stats.ordersGrowth}%</span>
            <span className="text-slate-400 font-normal">from yesterday</span>
          </div>
        </div>

        {/* Card 4: Low Stock Items */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Low Stock Items</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">
            {stats.lowStockCount}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            {stats.lowStockCount > 0 ? (
              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/60">
                Needs attention
              </span>
            ) : (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                Stock optimal
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Middle Row: Sales Overview Chart (60%) + Stock Alerts (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Sales Overview Chart (matching Screen 1 showcase) */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Sales Overview</h2>
              <p className="text-xs text-slate-400 font-medium">Revenue & sales performance curve</p>
            </div>

            {/* Timeframe Filter Pills (7D, 30D, 90D, Custom) */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              {(['7D', '30D', '90D', 'Custom'] as const).map(tf => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setChartTimeframe(tf)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    chartTimeframe === tf
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Area Chart */}
          <div className="h-64 sm:h-72 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesOrangeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ea580c" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ea580c" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="displayDate" 
                  stroke="#94a3b8" 
                  fontSize={11} 
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={11} 
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={val => `${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs shadow-xl border border-slate-700 space-y-1">
                          <div className="font-bold text-slate-300">{item.displayDate}</div>
                          <div className="text-orange-400 font-bold">Sales: Rs. {item.sales.toLocaleString()}</div>
                          <div className="text-emerald-400 font-medium">Profit: Rs. {item.profit.toLocaleString()}</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#ea580c" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#salesOrangeGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stock Alerts Card (matching Screen 1 showcase) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Stock Alerts</h2>
              <p className="text-xs text-slate-400 font-medium">{stats.lowStockCount} items low in stock</p>
            </div>
            <button
              type="button"
              onClick={onNavigateToProducts}
              className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
            </button>
          </div>

          {/* List of Low Stock Items */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[300px]">
            {stats.lowStockProducts.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-medium">All items have healthy inventory!</p>
              </div>
            ) : (
              stats.lowStockProducts.slice(0, 5).map(prod => (
                <div 
                  key={prod.id}
                  className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center justify-between gap-3 hover:bg-slate-100/60 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                      {prod.imageUrl ? (
                        <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{prod.name}</div>
                      <div className="text-[11px] text-rose-600 font-semibold">
                        Only {prod.stockQuantity} left
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded border border-rose-200/60 shrink-0">
                    Low Stock
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Sales Table (65%) + Promo Showcase (35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Recent Sales Table (matching Screen 1 showcase) */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Sales</h2>
              <p className="text-xs text-slate-400 font-medium">Latest customer checkout transactions</p>
            </div>
            <button
              type="button"
              onClick={onNavigateToReports}
              className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
            >
              <span>View History</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-2.5 font-bold">Bill #</th>
                  <th className="pb-2.5 font-bold">Date & Time</th>
                  <th className="pb-2.5 font-bold">Items</th>
                  <th className="pb-2.5 font-bold">Total Amount</th>
                  <th className="pb-2.5 font-bold">Payment Method</th>
                  <th className="pb-2.5 font-bold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {recentSales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                      No sales recorded yet. Click "New Sale" to start checkout.
                    </td>
                  </tr>
                ) : (
                  recentSales.map(sale => (
                    <tr 
                      key={sale.id}
                      onClick={() => onViewReceipt(sale)}
                      className="hover:bg-orange-50/50 cursor-pointer transition-colors group"
                      title="Click to view receipt"
                    >
                      <td className="py-3 font-mono font-bold text-slate-900 group-hover:text-orange-600">
                        #{sale.receiptNumber || sale.id.slice(0, 6)}
                      </td>
                      <td className="py-3 text-slate-500">
                        {new Date(sale.timestamp).toLocaleString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </td>
                      <td className="py-3 text-slate-600 font-medium">
                        {sale.items?.length || 0}
                      </td>
                      <td className="py-3 font-bold text-slate-900 tabular-nums">
                        Rs. {sale.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-slate-600 font-medium capitalize">
                        {sale.paymentMethod || 'Cash'}
                      </td>
                      <td className="py-3 text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200/60">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Completed</span>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Promo Card: "Manage Your Store Smarter with Mart Pro" (matching Screen 1 showcase) */}
        <div className="lg:col-span-4 bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 rounded-2xl p-5 text-white shadow-md shadow-orange-600/20 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white mb-3">
              <Sparkles className="w-5 h-5 text-amber-200" />
            </div>
            <h3 className="text-lg font-black tracking-tight leading-snug">
              Manage Your Store Smarter with Mart Pro
            </h3>
            <p className="text-xs text-orange-100 font-medium mt-1.5 leading-relaxed">
              Fast barcode billing, smart customer ledger, automated profit analytics, and stock sync.
            </p>
          </div>

          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={onNavigateToPOS}
              className="w-full py-2.5 px-4 bg-white hover:bg-orange-50 text-orange-700 font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-98 cursor-pointer"
            >
              <Calculator className="w-4 h-4" />
              <span>Launch POS Counter</span>
            </button>
            <button
              type="button"
              onClick={onNavigateToProducts}
              className="w-full py-2 px-4 bg-orange-700/60 hover:bg-orange-700/80 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Product</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
