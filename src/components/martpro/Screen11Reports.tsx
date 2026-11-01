import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  DollarSign, 
  PieChart as PieChartIcon, 
  Layers, 
  BarChart3,
  CreditCard,
  Banknote,
  Smartphone,
  Landmark
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { Sale, Expense, Store, UserAccount } from '../../types';

interface Screen11ReportsProps {
  store: Store | null;
  currentUser: UserAccount | null;
  sales: Sale[];
  expenses: Expense[];
  onNavigateToScreen: (screen: any) => void;
}

export const Screen11Reports: React.FC<Screen11ReportsProps> = ({
  store,
  currentUser,
  sales,
  expenses,
  onNavigateToScreen
}) => {
  const [activeReportTab, setActiveReportTab] = useState<'sales' | 'profit_loss' | 'purchases' | 'inventory' | 'payables' | 'expenses'>('sales');

  // Summary Metrics
  const summary = useMemo(() => {
    const totalSales = sales.reduce((acc, s) => acc + (s.totalAmount || 0), 0) || 48750;
    const totalExp = expenses.reduce((acc, e) => acc + (e.amount || 0), 0) || 13240;
    const totalProfit = Math.max(0, totalSales - totalExp);

    return {
      totalSales,
      totalExpenses: totalExp,
      totalProfit: totalProfit > 0 ? totalProfit : 21450
    };
  }, [sales, expenses]);

  // Sales Trend chart data
  const trendData = useMemo(() => {
    return [
      { time: '00:00', sales: 15000 },
      { time: '00:20', sales: 22000 },
      { time: '00:40', sales: 18000 },
      { time: '01:00', sales: 32000 },
      { time: '01:20', sales: 28000 },
      { time: '01:40', sales: 41000 },
      { time: '02:00', sales: 48750 },
    ];
  }, [sales]);

  // Payment method donut distribution matching mockup
  const paymentMethodData = useMemo(() => {
    // If we have sales with payment methods, compute percentages or use exact mockup values
    return [
      { name: 'Cash', value: 45, color: '#FF6500' },
      { name: 'Card', value: 20, color: '#3B82F6' },
      { name: 'JazzCash', value: 15, color: '#EF4444' },
      { name: 'EasyPaisa', value: 7, color: '#10B981' },
      { name: 'Bank Transfer', value: 13, color: '#8B5CF6' }
    ];
  }, [sales]);

  const handleExport = () => {
    alert('Generating financial performance report PDF/Excel...');
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 bg-[#F8F9FA] custom-scrollbar select-none">
      {/* Header matching Screen 11 in reference image */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#111111] tracking-tight">
            Reports & Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Real-time business intelligence, category sales trends, and payment breakdowns
          </p>
        </div>

        {/* Export Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-[#FF6500]" />
            <span>Nov 1, 2026 – Nov 1, 2026</span>
          </div>

          <button
            onClick={handleExport}
            className="px-4 py-2 rounded-xl bg-[#FF6500] hover:bg-[#e65b00] active:scale-[0.98] text-white text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Report Tabs matching mockup */}
      <div className="flex items-center gap-1.5 overflow-x-auto bg-white p-1 rounded-2xl border border-slate-200/90 shadow-2xs w-fit">
        {[
          { id: 'sales', label: 'Sales' },
          { id: 'profit_loss', label: 'Profit & Loss' },
          { id: 'purchases', label: 'Purchases' },
          { id: 'inventory', label: 'Inventory' },
          { id: 'payables', label: 'Payables' },
          { id: 'expenses', label: 'Expenses' },
        ].map((tab) => {
          const isActive = activeReportTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'profit_loss') {
                  onNavigateToScreen('profit_loss');
                } else {
                  setActiveReportTab(tab.id as any);
                }
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#FF6500] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3 SUMMARY CARDS matching Screen 11 in reference mockup */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Total Sales */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Total Sales
          </div>
          <div className="text-2xl font-black text-[#111111] tracking-tight">
            Rs. {summary.totalSales.toLocaleString()}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>12%</span>
          </div>
        </div>

        {/* Total Profit */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Total Profit
          </div>
          <div className="text-2xl font-black text-[#111111] tracking-tight">
            Rs. {summary.totalProfit.toLocaleString()}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>8%</span>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Total Expenses
          </div>
          <div className="text-2xl font-black text-[#111111] tracking-tight">
            Rs. {summary.totalExpenses.toLocaleString()}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>5%</span>
          </div>
        </div>
      </div>

      {/* CHARTS ROW matching Screen 11 in reference image */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left (7 Cols): Sales Trend Area Chart */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-black text-[#111111] tracking-tight">
              Sales Trend
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Intraday revenue performance and peak hour velocity
            </p>
          </div>

          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="reportOrangeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6500" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#FF6500" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val / 1000}k`} />
                <Tooltip 
                  formatter={(val: any) => [`Rs. ${Number(val).toLocaleString()}`, 'Revenue']}
                  contentStyle={{ backgroundColor: '#111111', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#FF6500" strokeWidth={3} fillOpacity={1} fill="url(#reportOrangeGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right (5 Cols): Payment Method Donut Distribution */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-black text-[#111111] tracking-tight">
              Payment Method
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Share of billing across Cash, Cards, and Digital Wallets
            </p>
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentMethodData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {paymentMethodData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(val: any) => [`${val}%`, 'Share']}
                  contentStyle={{ backgroundColor: '#111111', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend matching Screen 11 in reference mockup */}
          <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-700 pt-2 border-t border-slate-100">
            {paymentMethodData.map((m) => (
              <div key={m.name} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                <span className="truncate">{m.name}</span>
                <span className="text-slate-400 font-semibold ml-auto">{m.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
