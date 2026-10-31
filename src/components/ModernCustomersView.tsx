import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  MoreVertical, 
  FileText, 
  DollarSign, 
  Phone, 
  Mail, 
  X, 
  Edit2, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  Download,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Customer, CustomerLedgerEntry, Store, UserAccount } from '../types';
import { db, collection, doc, setDoc, deleteDoc, onSnapshot, query, where, cleanFirestoreData } from '../lib/firebase';

interface ModernCustomersViewProps {
  store: Store;
  currentUser: UserAccount;
}

export const ModernCustomersView: React.FC<ModernCustomersViewProps> = ({
  store,
  currentUser
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedLedgerCustomer, setSelectedLedgerCustomer] = useState<Customer | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<CustomerLedgerEntry[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Add / Edit form
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formInitialDue, setFormInitialDue] = useState('0');
  const [isSaving, setIsSaving] = useState(false);

  // Payment Recording modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentRef, setPaymentRef] = useState('');

  // Real-time Firestore sync for customers
  useEffect(() => {
    if (!store?.id) return;

    const q = query(
      collection(db, 'customers'),
      where('storeId', '==', store.id)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: Customer[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Customer);
      });

      // If empty, auto-seed with standard customers from showcase image
      if (list.length === 0) {
        seedInitialCustomers(store.id);
      } else {
        setCustomers(list);
      }
    }, (err) => {
      console.warn('Customers listener error:', err);
    });

    return () => unsub();
  }, [store?.id]);

  // Seed sample customers matching Screen 5 from showcase
  const seedInitialCustomers = async (storeId: string) => {
    const defaultList: Array<Omit<Customer, 'id'>> = [
      { storeId, name: 'Ali Raza', phone: '0300-1234567', email: 'ali@example.com', totalDue: 2450, status: 'Due', createdAt: new Date().toISOString() },
      { storeId, name: 'Fatima Khan', phone: '0321-7654321', email: 'fatima@example.com', totalDue: 1280, status: 'Due', createdAt: new Date().toISOString() },
      { storeId, name: 'Ahmed Shah', phone: '0333-9876543', email: 'ahmed@example.com', totalDue: 0, status: 'Good', createdAt: new Date().toISOString() },
      { storeId, name: 'Sara Ahmed', phone: '0345-1112222', email: 'sara@example.com', totalDue: 860, status: 'Due', createdAt: new Date().toISOString() },
      { storeId, name: 'Usman Tariq', phone: '0312-5556677', email: 'usman@example.com', totalDue: 0, status: 'Good', createdAt: new Date().toISOString() },
      { storeId, name: 'Ayesha Malik', phone: '0309-4445566', email: 'ayesha@example.com', totalDue: 320, status: 'Due', createdAt: new Date().toISOString() },
      { storeId, name: 'Hassan Ali', phone: '0322-7778899', email: 'hassan@example.com', totalDue: 0, status: 'Good', createdAt: new Date().toISOString() }
    ];

    for (const c of defaultList) {
      const cRef = doc(collection(db, 'customers'));
      await setDoc(cRef, cleanFirestoreData({ id: cRef.id, ...c }));
    }
  };

  // Sync ledger entries when ledger modal opens
  useEffect(() => {
    if (!selectedLedgerCustomer?.id) return;

    const q = query(
      collection(db, 'customer_ledgers'),
      where('customerId', '==', selectedLedgerCustomer.id)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: CustomerLedgerEntry[] = [];
      snapshot.forEach(d => {
        list.push({ id: d.id, ...d.data() } as CustomerLedgerEntry);
      });
      // Sort by date
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setLedgerEntries(list);
    }, (err) => console.warn('Ledger error:', err));

    return () => unsub();
  }, [selectedLedgerCustomer?.id]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return customers.filter(c => {
      return !q || 
        c.name.toLowerCase().includes(q) || 
        c.phone.toLowerCase().includes(q) || 
        (c.email && c.email.toLowerCase().includes(q));
    });
  }, [customers, searchQuery]);

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage) || 1;
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCustomers.slice(start, start + itemsPerPage);
  }, [filteredCustomers, currentPage]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormInitialDue('0');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormName(c.name);
    setFormPhone(c.phone);
    setFormEmail(c.email || '');
    setFormAddress(c.address || '');
    setFormInitialDue((c.totalDue || 0).toString());
    setIsAddModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) return;

    try {
      setIsSaving(true);
      const id = editingCustomer ? editingCustomer.id : `cust_${Date.now()}`;
      const due = parseFloat(formInitialDue) || 0;

      await setDoc(doc(db, 'customers', id), cleanFirestoreData({
        id,
        storeId: store.id,
        name: formName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim() || undefined,
        address: formAddress.trim() || undefined,
        totalDue: due,
        status: due > 0 ? 'Due' : 'Good',
        updatedAt: new Date().toISOString(),
        createdAt: editingCustomer?.createdAt || new Date().toISOString()
      }), { merge: true });

      setIsAddModalOpen(false);
    } catch (err) {
      console.error('Save customer error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!window.confirm('Delete this customer account?')) return;
    try {
      await deleteDoc(doc(db, 'customers', id));
    } catch (err) {
      console.error('Delete customer error:', err);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentCustomer || !paymentAmount) return;

    try {
      const amount = parseFloat(paymentAmount) || 0;
      const newDue = Math.max(0, (paymentCustomer.totalDue || 0) - amount);

      // Update customer balance
      await setDoc(doc(db, 'customers', paymentCustomer.id), {
        totalDue: newDue,
        status: newDue > 0 ? 'Due' : 'Good',
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Add ledger entry
      const lRef = doc(collection(db, 'customer_ledgers'));
      await setDoc(lRef, cleanFirestoreData({
        id: lRef.id,
        storeId: store.id,
        customerId: paymentCustomer.id,
        customerName: paymentCustomer.name,
        date: new Date().toISOString().split('T')[0],
        reference: paymentRef || `REC-${Date.now().toString().slice(-4)}`,
        description: 'Payment Received',
        debit: 0,
        credit: amount,
        balance: newDue,
        createdAt: new Date().toISOString()
      }));

      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentRef('');
    } catch (err) {
      console.error('Payment error:', err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header (matching Screen 5 showcase) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Customers
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Customer directory, purchase ledgers, outstanding balances, and credit tracking.
          </p>
        </div>

        {/* Primary Action Button: "+ Add Customer" */}
        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm shadow-orange-600/30 transition-transform active:scale-98 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Customer</span>
        </button>
      </div>

      {/* Search Input Bar (matching Screen 5 showcase) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search customers by name, phone or email..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 font-medium"
          />
        </div>
      </div>

      {/* Customers Table (matching Screen 5 showcase) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 font-bold">Name</th>
                <th className="py-3 px-4 font-bold">Phone</th>
                <th className="py-3 px-4 font-bold">Email</th>
                <th className="py-3 px-4 font-bold">Total Due</th>
                <th className="py-3 px-4 font-bold">Status</th>
                <th className="py-3 px-4 font-bold text-right w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-500" />
                    <span>No customer records found.</span>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map(cust => (
                  <tr key={cust.id} className="hover:bg-slate-50/80 transition-colors group">
                    {/* Name */}
                    <td className="py-3 px-4 font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
                      {cust.name}
                    </td>

                    {/* Phone */}
                    <td className="py-3 px-4 text-slate-600 font-mono">
                      {cust.phone}
                    </td>

                    {/* Email */}
                    <td className="py-3 px-4 text-slate-500">
                      {cust.email || '—'}
                    </td>

                    {/* Total Due */}
                    <td className="py-3 px-4 font-bold tabular-nums">
                      {cust.totalDue > 0 ? (
                        <span className="text-rose-600">Rs. {cust.totalDue.toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-700">Rs. 0</span>
                      )}
                    </td>

                    {/* Status Badge (Due in red / Good in green) */}
                    <td className="py-3 px-4">
                      {cust.totalDue > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-md border border-rose-200/60">
                          <span>Due</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200/60">
                          <span>Good</span>
                        </span>
                      )}
                    </td>

                    {/* Actions Menu */}
                    <td className="py-3 px-4 text-right relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenuId(activeMenuId === cust.id ? null : cust.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeMenuId === cust.id && (
                        <div 
                          className="absolute right-4 mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95 duration-100 text-left"
                          onMouseLeave={() => setActiveMenuId(null)}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLedgerCustomer(cust);
                              setActiveMenuId(null);
                            }}
                            className="w-full px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            <span>View Ledger</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setPaymentCustomer(cust);
                              setIsPaymentModalOpen(true);
                              setActiveMenuId(null);
                            }}
                            className="w-full px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                          >
                            <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                            <span>Record Payment</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handleOpenEdit(cust);
                              setActiveMenuId(null);
                            }}
                            className="w-full px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>Edit Customer</span>
                          </button>

                          <div className="border-t border-slate-100 my-1" />

                          <button
                            type="button"
                            onClick={() => {
                              handleDeleteCustomer(cust.id);
                              setActiveMenuId(null);
                            }}
                            className="w-full px-3.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
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
            Showing <strong className="text-slate-800">{paginatedCustomers.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> to{' '}
            <strong className="text-slate-800">{Math.min(currentPage * itemsPerPage, filteredCustomers.length)}</strong> of{' '}
            <strong className="text-slate-800">{filteredCustomers.length}</strong> customers
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

      {/* Add / Edit Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                </h3>
                <p className="text-xs text-slate-400">Save customer details and track balance due</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ali Raza, Fatima Khan"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="0300-1234567"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="customer@example.com"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Opening Balance Due (Rs.)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={formInitialDue}
                  onChange={e => setFormInitialDue(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-orange-500"
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
                  {isSaving ? 'Saving...' : editingCustomer ? 'Save Changes' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Ledger Modal (matching Screen 9 showcase) */}
      {selectedLedgerCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>Customer Ledger:</span>
                  <span className="text-orange-600">{selectedLedgerCustomer.name}</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Phone: {selectedLedgerCustomer.phone} · Current Balance Due: Rs. {selectedLedgerCustomer.totalDue.toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLedgerCustomer(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 font-bold text-right">Debit (Rs.)</th>
                    <th className="py-2.5 px-3 font-bold text-right">Credit (Rs.)</th>
                    <th className="py-2.5 px-3 font-bold text-right">Balance (Rs.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                        No previous ledger records found. Opening balance: Rs. {selectedLedgerCustomer.totalDue.toLocaleString()}
                      </td>
                    </tr>
                  ) : (
                    ledgerEntries.map(entry => (
                      <tr key={entry.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 text-slate-500">{entry.date}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{entry.reference}</td>
                        <td className="py-2.5 px-3 text-slate-700">{entry.description}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-rose-600 tabular-nums">
                          {entry.debit > 0 ? entry.debit.toLocaleString() : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600 tabular-nums">
                          {entry.credit > 0 ? entry.credit.toLocaleString() : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                          Rs. {entry.balance.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="text-xs font-bold text-slate-700">
                Total Due: <span className="text-rose-600 font-extrabold">Rs. {selectedLedgerCustomer.totalDue.toLocaleString()}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPaymentCustomer(selectedLedgerCustomer);
                  setIsPaymentModalOpen(true);
                }}
                className="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPaymentModalOpen && paymentCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">
                Record Payment for {paymentCustomer.name}
              </h3>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-5 space-y-4">
              <div className="p-3 bg-orange-50 rounded-xl border border-orange-200/60 text-xs">
                <span className="text-orange-950 font-medium">Current Balance Due: </span>
                <strong className="text-orange-700 font-bold">Rs. {paymentCustomer.totalDue.toLocaleString()}</strong>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Amount Received (Rs.) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 1000"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Reference / Slip Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. REC-1028 or Cash"
                  value={paymentRef}
                  onChange={e => setPaymentRef(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-sm shadow-orange-600/30 cursor-pointer"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
