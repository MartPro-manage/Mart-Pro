import React, { useState, useMemo } from 'react';
import { 
  DollarSign, 
  Search, 
  Plus, 
  Calendar, 
  Filter, 
  Trash2, 
  CreditCard, 
  ChevronLeft, 
  ChevronRight,
  Receipt,
  Download,
  X
} from 'lucide-react';
import { Expense, Store, UserAccount } from '../types';
import { db, doc, setDoc, deleteDoc, cleanFirestoreData } from '../lib/firebase';

interface ModernExpensesViewProps {
  store: Store;
  currentUser: UserAccount;
  expenses: Expense[];
}

export const ModernExpensesView: React.FC<ModernExpensesViewProps> = ({
  store,
  currentUser,
  expenses
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Add Expense Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('Utilities');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formPaymentMethod, setFormPaymentMethod] = useState<'cash' | 'online'>('cash');
  const [formNotes, setFormNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const categories = useMemo(() => {
    const defaultCats = ['Utilities', 'Rent', 'Supplies', 'Transport', 'Staff Salaries', 'Packaging', 'Maintenance', 'General'];
    const customCats = new Set(defaultCats);
    expenses.forEach(e => {
      if (e.category) customCats.add(e.category);
    });
    return Array.from(customCats).sort();
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        e.name.toLowerCase().includes(q) || 
        (e.notes && e.notes.toLowerCase().includes(q)) ||
        e.category.toLowerCase().includes(q);

      const matchesCat = selectedCategory === 'all' || e.category === selectedCategory;

      let matchesDate = true;
      if (dateFilter === 'today') {
        const today = new Date().toISOString().split('T')[0];
        matchesDate = e.date === today;
      } else if (dateFilter === '7d') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        matchesDate = new Date(e.date) >= d;
      } else if (dateFilter === '30d') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        matchesDate = new Date(e.date) >= d;
      }

      return matchesSearch && matchesCat && matchesDate;
    });
  }, [expenses, searchQuery, selectedCategory, dateFilter]);

  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage) || 1;
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredExpenses.slice(start, start + itemsPerPage);
  }, [filteredExpenses, currentPage]);

  const totalExpenseSum = useMemo(() => {
    return filteredExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  }, [filteredExpenses]);

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formAmount) return;

    try {
      setIsSaving(true);
      const id = `exp_${Date.now()}`;
      await setDoc(doc(db, 'expenses', id), cleanFirestoreData({
        id,
        storeId: store.id,
        name: formName.trim(),
        amount: parseFloat(formAmount) || 0,
        category: formCategory,
        date: formDate,
        paymentMethod: formPaymentMethod,
        notes: formNotes.trim() || undefined,
        recordedBy: currentUser.name || currentUser.username,
        timestamp: new Date().toISOString()
      }));

      setIsAddModalOpen(false);
      setFormName('');
      setFormAmount('');
      setFormNotes('');
    } catch (err) {
      console.error('Failed to save expense:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm('Delete this expense record?')) return;
    try {
      await deleteDoc(doc(db, 'expenses', id));
    } catch (err) {
      console.error('Delete expense error:', err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header (matching Screen 7 showcase) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Expenses & Accounts
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Track store overheads, operational utility bills, rent, packaging, and staff payouts.
          </p>
        </div>

        {/* Primary Action: "+ Add Expense" */}
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm shadow-orange-600/30 transition-transform active:scale-98 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Expense</span>
        </button>
      </div>

      {/* Filter Bar (matching Screen 7 showcase) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by expense title or description..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 font-medium"
          />
        </div>

        {/* Filters Group */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={e => {
              setDateFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={e => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="all">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Total Expense Pill */}
          <div className="px-3.5 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-xs font-bold text-orange-700 tabular-nums">
            Total: Rs. {totalExpenseSum.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Expenses Table (matching Screen 7 showcase) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 font-bold">Date</th>
                <th className="py-3 px-4 font-bold">Category</th>
                <th className="py-3 px-4 font-bold">Description</th>
                <th className="py-3 px-4 font-bold">Amount</th>
                <th className="py-3 px-4 font-bold">Payment Method</th>
                <th className="py-3 px-4 font-bold text-right w-16">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-500" />
                    <span>No expense records logged.</span>
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-3 px-4 text-slate-500 font-mono">
                      {exp.date}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {exp.category}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      <div>{exp.name}</div>
                      {exp.notes && (
                        <div className="text-[11px] text-slate-400">{exp.notes}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">
                      Rs. {exp.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium capitalize">
                      {exp.paymentMethod || 'Cash'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
          <div>
            Showing <strong className="text-slate-800">{paginatedExpenses.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> to{' '}
            <strong className="text-slate-800">{Math.min(currentPage * itemsPerPage, filteredExpenses.length)}</strong> of{' '}
            <strong className="text-slate-800">{filteredExpenses.length}</strong> records
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 bg-orange-600 text-white rounded-lg font-bold text-xs shadow-xs">
              {currentPage}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">Add New Expense</h3>
                <p className="text-xs text-slate-400">Record overhead costs, rent, bills or salaries</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Expense Description / Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electricity Bill, Store Rent, Cleaning Material..."
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Amount (Rs.) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 3500"
                    value={formAmount}
                    onChange={e => setFormAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-orange-500"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Payment Method
                  </label>
                  <select
                    value={formPaymentMethod}
                    onChange={e => setFormPaymentMethod(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-orange-500"
                  >
                    <option value="cash">Cash</option>
                    <option value="online">Bank Transfer / Card / Online</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Optional Notes / Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid to vendor XYZ / Bill #12345"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-sm shadow-orange-600/30 transition-transform active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
