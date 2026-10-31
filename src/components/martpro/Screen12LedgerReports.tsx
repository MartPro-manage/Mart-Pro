import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  Search, 
  Calendar, 
  Download, 
  Building2, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { Supplier, Store, UserAccount, Sale, Expense } from '../../types';

interface Screen12LedgerReportsProps {
  store: Store | null;
  currentUser: UserAccount | null;
  suppliers: Supplier[];
  sales: Sale[];
  expenses: Expense[];
}

export const Screen12LedgerReports: React.FC<Screen12LedgerReportsProps> = ({
  store,
  currentUser,
  suppliers,
  sales,
  expenses
}) => {
  // Strictly Customer-Free: Only Suppliers Ledger & General Ledger matching reference image!
  const [activeLedgerTab, setActiveLedgerTab] = useState<'suppliers_ledger' | 'general_ledger'>('suppliers_ledger');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');

  const currentSupplier = useMemo(() => {
    return suppliers.find(s => s.id === selectedSupplierId) || suppliers[0];
  }, [suppliers, selectedSupplierId]);

  // General Ledger entries matching Screen 12 in mockup
  const generalLedgerRows = useMemo(() => {
    return [
      { date: 'Nov 1, 2026', particulars: 'Sales – Cash Counter #1', debit: 18750, credit: 0, balance: 18750 },
      { date: 'Nov 1, 2026', particulars: 'Utilities (Electricity Bill)', debit: 2500, credit: 0, balance: 16250 },
      { date: 'Nov 1, 2026', particulars: 'Purchase (Fresh Foods Ltd.)', debit: 0, credit: 8250, balance: 8000 },
      { date: 'Nov 1, 2026', particulars: 'Expenses (Cleaning & Misc)', debit: 0, credit: 1200, balance: 6800 },
    ];
  }, []);

  // Supplier Ledger entries
  const supplierLedgerRows = useMemo(() => {
    const sName = currentSupplier?.name || 'ABC Trading Co.';
    return [
      { date: 'Nov 1, 2026', particulars: `Purchase Order Goods Received (${sName})`, debit: 0, credit: 12450, balance: 12450 },
      { date: 'Oct 28, 2026', particulars: 'Advance Bank Transfer Settlement', debit: 5000, credit: 0, balance: 7450 },
      { date: 'Oct 20, 2026', particulars: 'Inbound Stock Verification #PO-102', debit: 0, credit: 6200, balance: 13650 },
    ];
  }, [currentSupplier]);

  const activeRows = activeLedgerTab === 'general_ledger' ? generalLedgerRows : supplierLedgerRows;

  const handleExport = () => {
    const csvContent = 'data:text/csv;charset=utf-8,' + [
      ['Date', 'Particulars', 'Debit', 'Credit', 'Balance'].join(','),
      ...activeRows.map(r => [r.date, `"${r.particulars}"`, r.debit, r.credit, r.balance].join(','))
    ].join('\n');

    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `mart_pro_ledger_${activeLedgerTab}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 bg-[#F8F9FA] custom-scrollbar select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#111111] tracking-tight">
            Ledger Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Double-entry audit trail, supplier credits/debits, and general store books
          </p>
        </div>

        {/* Tab Pills matching reference mockup Screen 12 (Customer Ledger is crossed out / removed!) */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-slate-200/90 shadow-2xs">
          <button
            onClick={() => setActiveLedgerTab('suppliers_ledger')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeLedgerTab === 'suppliers_ledger'
                ? 'bg-[#FF6500] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Suppliers Ledger
          </button>
          <button
            onClick={() => setActiveLedgerTab('general_ledger')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeLedgerTab === 'general_ledger'
                ? 'bg-[#FF6500] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            General Ledger
          </button>
        </div>
      </div>

      {/* Filter and Supplier Selector Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {activeLedgerTab === 'suppliers_ledger' ? (
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600">Supplier Account:</label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="bg-[#F8F9FA] text-xs font-bold text-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
            >
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} (Due: Rs. {(s.totalDue || 0).toLocaleString()})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#FF6500]" />
            <span>General Store Accounts & Double Entry Register</span>
          </div>
        )}

        {/* Opening Balance Badge matching Screen 12 in mockup */}
        <div className="px-3.5 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-xs font-bold text-slate-800">
          Opening Balance: <span className="font-black text-[#FF6500]">Rs. 5,000.00</span>
        </div>
      </div>

      {/* Main Ledger Table matching Screen 12 in reference mockup */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Particulars</th>
                <th className="py-3.5 px-4 text-right">Debit</th>
                <th className="py-3.5 px-4 text-right">Credit</th>
                <th className="py-3.5 px-4 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {activeRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-600">
                    {row.date}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {row.particulars}
                  </td>
                  <td className="py-3.5 px-4 text-right font-black text-emerald-600">
                    {row.debit > 0 ? `Rs. ${row.debit.toLocaleString()}.00` : '0.00'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-black text-red-600">
                    {row.credit > 0 ? `Rs. ${row.credit.toLocaleString()}.00` : '0.00'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-black text-slate-900">
                    Rs. {row.balance.toLocaleString()}.00
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom Bar with Export Button matching Screen 12 in reference mockup */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs font-bold text-slate-500">
            Account Status: <span className="text-emerald-600 font-black">Audited & Reconciled</span>
          </div>

          <button
            onClick={handleExport}
            className="px-5 py-2.5 rounded-xl bg-[#FF6500] hover:bg-[#e65b00] active:scale-[0.98] text-white text-xs font-black shadow-md shadow-[#FF6500]/25 transition-all cursor-pointer flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>
        </div>
      </div>
    </div>
  );
};
