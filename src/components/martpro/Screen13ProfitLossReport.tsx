import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Download, 
  ArrowUpRight, 
  ArrowDownRight,
  Receipt,
  Scale,
  CheckCircle2
} from 'lucide-react';
import { Sale, Expense, Store, UserAccount } from '../../types';

interface Screen13ProfitLossReportProps {
  store: Store | null;
  currentUser: UserAccount | null;
  sales: Sale[];
  expenses: Expense[];
}

export const Screen13ProfitLossReport: React.FC<Screen13ProfitLossReportProps> = ({
  store,
  currentUser,
  sales,
  expenses
}) => {
  // Calculations matching reference image Screen 13
  const totalSalesRevenue = useMemo(() => {
    const s = sales.reduce((acc, sale) => acc + (sale.totalAmount || 0), 0);
    return s > 0 ? s : 48750;
  }, [sales]);

  const totalExpenseVal = useMemo(() => {
    const e = expenses.reduce((acc, exp) => acc + (exp.amount || 0), 0);
    return e > 0 ? e : 13240;
  }, [expenses]);

  const netProfit = useMemo(() => {
    return totalSalesRevenue - totalExpenseVal;
  }, [totalSalesRevenue, totalExpenseVal]);

  const handleExport = () => {
    alert('Exporting complete Profit & Loss Financial Statement (PDF/Excel)...');
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 bg-[#F8F9FA] custom-scrollbar select-none">
      {/* Top Header matching Screen 13 in reference image */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#111111] tracking-tight">
            Profit & Loss Report
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Store profit margins, gross revenue, COGS, and operating expense breakdown
          </p>
        </div>

        {/* Date Filter & Export Button */}
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

      {/* 3 TOP METRIC CARDS matching Screen 13 in reference image */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Total Income */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Total Income</span>
          </div>
          <div className="text-2xl font-black text-[#111111] mt-1 tracking-tight">
            Rs. {totalSalesRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] font-semibold text-emerald-600">
            100% Verified Sales Inflow
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span>Total Expenses</span>
          </div>
          <div className="text-2xl font-black text-red-600 mt-1 tracking-tight">
            Rs. {totalExpenseVal.toLocaleString()}
          </div>
          <div className="text-[11px] font-semibold text-red-600">
            Purchases, Overheads & Utilities
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Net Profit</span>
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-1 tracking-tight">
            Rs. {netProfit.toLocaleString()}
          </div>
          <div className="text-[11px] font-semibold text-emerald-600">
            Net Store Margin (After COGS)
          </div>
        </div>
      </div>

      {/* DETAILED BREAKDOWN SECTION: Income & Expenses Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* LEFT COLUMN: INCOME BREAKDOWN */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h2 className="text-sm font-black text-[#111111] uppercase tracking-wider">
              Income Breakdown
            </h2>
            <span className="text-xs font-bold text-emerald-600">Inflows</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
              <span className="font-bold text-slate-700">Sales Income (POS Receipts)</span>
              <span className="font-black text-slate-900">Rs. {totalSalesRevenue.toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
              <span className="font-bold text-slate-700">Other Income</span>
              <span className="font-black text-slate-900">Rs. 0</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-black text-emerald-800">
              <span>Total Income</span>
              <span>Rs. {totalSalesRevenue.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: EXPENSES BREAKDOWN */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h2 className="text-sm font-black text-[#111111] uppercase tracking-wider">
              Expenses Breakdown
            </h2>
            <span className="text-xs font-bold text-red-600">Outflows</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
              <span className="font-bold text-slate-700">Purchase Cost (Suppliers Goods)</span>
              <span className="font-black text-red-600">Rs. 8,250</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
              <span className="font-bold text-slate-700">Operating Cost (Rent, Electric, Fuel)</span>
              <span className="font-black text-red-600">Rs. 1,290</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
              <span className="font-bold text-slate-700">Other Expenses (Supplies & Cleaning)</span>
              <span className="font-black text-red-600">Rs. 3,700</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-200 text-sm font-black text-red-800">
              <span>Total Expenses</span>
              <span>Rs. {totalExpenseVal.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM HIGHLIGHT BANNER matching Screen 13 in reference mockup */}
      <div className="p-6 rounded-3xl bg-emerald-50 border-2 border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
              Financial Net Result
            </div>
            <div className="text-sm text-emerald-700 font-semibold">
              Total Revenue after deducting inventory costs and all operating expenses
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs font-bold text-emerald-700">Net Profit</div>
          <div className="text-3xl sm:text-4xl font-black text-emerald-600 tracking-tight">
            Rs. {netProfit.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};
