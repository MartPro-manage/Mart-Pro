import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  DollarSign, 
  WalletCards, 
  Building2, 
  Calendar, 
  TrendingDown, 
  ArrowUpRight,
  CheckCircle2,
  X,
  CreditCard,
  Banknote
} from 'lucide-react';
import { Expense, Store, UserAccount } from '../../types';
import { db, doc, setDoc, deleteDoc, cleanFirestoreData } from '../../lib/firebase';

interface Screen10ExpensesAccountsProps {
  store: Store | null;
  currentUser: UserAccount | null;
  expenses: Expense[];
  onExpenseSaved: (exp: Expense) => void;
}

export const Screen10ExpensesAccounts: React.FC<Screen10ExpensesAccountsProps> = ({
  store,
  currentUser,
  expenses,
  onExpenseSaved
}) => {
  const [activeTab, setActiveTab] = useState<'expenses' | 'accounts' | 'transactions'>('expenses');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Utilities');
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('online');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const match = !searchQuery.trim() ||
        (e.name && e.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.category && e.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.notes && e.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      return match;
    });
  }, [expenses, searchQuery]);

  const totalExpenseSum = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses]);

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(amount) || 0;
    if (amtNum <= 0 || !name.trim()) {
      alert('Please enter expense description and valid amount.');
      return;
    }

    setSubmitting(true);
    try {
      const expId = `exp_${Date.now()}`;
      const payload: Expense = {
        id: expId,
        storeId: store?.id || 'mart-pro-store',
        name: name.trim(),
        category,
        notes: notes.trim(),
        amount: amtNum,
        paymentMethod,
        date,
        timestamp: new Date().toISOString(),
        recordedBy: currentUser?.name || 'Admin'
      };

      await setDoc(doc(db, 'expenses', expId), cleanFirestoreData(payload));
      onExpenseSaved(payload);
      setIsAddModalOpen(false);
      setName('');
      setAmount('');
      setNotes('');
    } catch (err) {
      console.error('Error adding expense:', err);
      alert('Failed to save expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string, expName: string) => {
    if (confirm(`Delete expense "${expName}"?`)) {
      try {
        await deleteDoc(doc(db, 'expenses', id));
      } catch (err) {
        console.error('Delete expense error:', err);
      }
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 bg-[#F8F9FA] custom-scrollbar select-none">
      {/* Top Header matching Screen 10 in mockup */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#111111] tracking-tight">
            Expenses & Accounts
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Operational overhead, store utilities, staff salaries, and cash accounts
          </p>
        </div>

        {/* Orange + Add Expense Button matching mockup */}
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-[#FF6500] hover:bg-[#e65b00] active:scale-[0.98] text-white text-xs font-black shadow-md shadow-[#FF6500]/25 transition-all cursor-pointer flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Expense</span>
        </button>
      </div>

      {/* Tabs matching Screen 10 in mockup: Expenses, Accounts, Transactions */}
      <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-slate-200/90 shadow-2xs w-fit">
        {[
          { id: 'expenses', label: 'Expenses' },
          { id: 'accounts', label: 'Accounts' },
          { id: 'transactions', label: 'Transactions' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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

      {/* TAB 1: EXPENSES TABLE */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search expenses by category or description..."
                className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-semibold text-slate-900 pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500] transition-all"
              />
            </div>
            <div className="text-xs font-black text-slate-900">
              Total Expenses: <span className="text-[#FF6500]">Rs. {totalExpenseSum.toLocaleString()}</span>
            </div>
          </div>

          {/* Table matching Screen 10 in reference image */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Description</th>
                    <th className="py-3.5 px-4">Amount</th>
                    <th className="py-3.5 px-4">Payment Method</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                        No expenses logged. Click "+ Add Expense" to record one.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Date */}
                        <td className="py-3.5 px-4 font-semibold text-slate-600">
                          {exp.date}
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-50 text-[#FF6500] border border-orange-200">
                            {exp.category || 'Utilities'}
                          </span>
                        </td>

                        {/* Description */}
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {exp.name} {exp.notes ? <span className="text-slate-400 font-normal">({exp.notes})</span> : ''}
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4 font-black text-slate-900">
                          Rs. {(exp.amount || 0).toLocaleString()}
                        </td>

                        {/* Payment Method */}
                        <td className="py-3.5 px-4 font-semibold text-slate-600 capitalize">
                          {exp.paymentMethod === 'online' ? 'Bank Transfer' : 'Cash'}
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleDeleteExpense(exp.id, exp.name)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 transition-colors cursor-pointer"
                            title="Delete Expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACCOUNTS */}
      {activeTab === 'accounts' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Cash in Hand
            </div>
            <div className="text-2xl font-black text-slate-900">
              Rs. 45,200
            </div>
            <div className="text-xs font-semibold text-emerald-600">
              Physical cash counter float & daily collections
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Bank Account (Meezan Bank)
            </div>
            <div className="text-2xl font-black text-slate-900">
              Rs. 248,500
            </div>
            <div className="text-xs font-semibold text-blue-600">
              IBAN: PK36MEZN0001012345678001
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Expenses (This Period)
            </div>
            <div className="text-2xl font-black text-red-600">
              Rs. {totalExpenseSum.toLocaleString()}
            </div>
            <div className="text-xs font-semibold text-slate-500">
              5 Categories recorded
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TRANSACTIONS */}
      {activeTab === 'transactions' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-3">
          <h3 className="text-base font-black text-slate-900">Account Transactions History</h3>
          <p className="text-xs text-slate-500">
            Combined cash disbursements, digital payments, and expense settlements.
          </p>
          <div className="divide-y divide-slate-100 text-xs">
            {expenses.map((e, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">{e.name}</div>
                  <div className="text-slate-400 text-[11px]">{e.date} &bull; {e.category}</div>
                </div>
                <div className="font-black text-red-600">
                  - Rs. {e.amount.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADD EXPENSE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">
                Record New Expense
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description / Title *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Electricity Bill, Cleaning Material"
                  className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-semibold text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-semibold text-slate-900 px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                  >
                    <option value="Utilities">Utilities</option>
                    <option value="Rent">Rent</option>
                    <option value="Supplies">Supplies</option>
                    <option value="Transport">Transport</option>
                    <option value="Staff Salary">Staff Salary</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Amount (Rs.) *
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="2500"
                    className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-bold text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e: any) => setPaymentMethod(e.target.value)}
                    className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-semibold text-slate-900 px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                  >
                    <option value="online">Bank Transfer</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-semibold text-slate-900 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Additional Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Monthly bill paid via online banking..."
                  className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-medium text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#FF6500] hover:bg-[#e65b00] text-white text-xs font-black shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
