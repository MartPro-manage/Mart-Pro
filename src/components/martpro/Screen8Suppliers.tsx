import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  Building2, 
  Trash2, 
  Edit2, 
  DollarSign, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  ShoppingBag
} from 'lucide-react';
import { Supplier, Store, UserAccount } from '../../types';
import { db, doc, setDoc, deleteDoc, cleanFirestoreData } from '../../lib/firebase';

interface Screen8SuppliersProps {
  store: Store | null;
  currentUser: UserAccount | null;
  suppliers: Supplier[];
  onSupplierSaved: (supplier: Supplier) => void;
  onNavigateToManagement: (supplier?: Supplier) => void;
}

export const Screen8Suppliers: React.FC<Screen8SuppliersProps> = ({
  store,
  currentUser,
  suppliers,
  onSupplierSaved,
  onNavigateToManagement
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Add/Edit Supplier modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [totalDue, setTotalDue] = useState('0');
  const [saving, setSaving] = useState(false);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const match = !searchQuery.trim() ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase()));
      return match;
    });
  }, [suppliers, searchQuery]);

  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage) || 1;
  const paginatedSuppliers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSuppliers.slice(start, start + itemsPerPage);
  }, [filteredSuppliers, currentPage]);

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setTotalDue('0');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setName(s.name || '');
    setPhone(s.phone || '');
    setEmail(s.email || '');
    setAddress(s.address || '');
    setTotalDue((s.totalDue || 0).toString());
    setIsModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      alert('Supplier name and phone are required.');
      return;
    }

    setSaving(true);
    try {
      const suppId = editingSupplier?.id || `supp_${Date.now()}`;
      const dueNum = parseFloat(totalDue) || 0;

      const payload: Supplier = {
        id: suppId,
        storeId: store?.id || 'mart-pro-store',
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        address: address.trim() || 'Wholesale Market',
        totalDue: dueNum,
        status: 'active',
        createdAt: editingSupplier?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'suppliers', suppId), cleanFirestoreData(payload));
      onSupplierSaved(payload);
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving supplier:', err);
      alert('Failed to save supplier.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSupplier = async (suppId: string, suppName: string) => {
    if (confirm(`Are you sure you want to remove supplier "${suppName}"?`)) {
      try {
        await deleteDoc(doc(db, 'suppliers', suppId));
      } catch (e) {
        console.error('Delete supplier error:', e);
      }
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-5 bg-[#F8F9FA] custom-scrollbar select-none">
      {/* Top Header matching Screen 8 in reference mockup */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#111111] tracking-tight">
            Suppliers
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Wholesale distributor contacts, credit terms, and payable balances
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateToManagement()}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#FF6500]" />
            <span>Manage Orders & Deliveries</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-5 py-2.5 rounded-xl bg-[#FF6500] hover:bg-[#e65b00] active:scale-[0.98] text-white text-xs font-black shadow-md shadow-[#FF6500]/25 transition-all cursor-pointer flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Supplier</span>
          </button>
        </div>
      </div>

      {/* Search Input Bar matching Screen 8 in mockup */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search suppliers by name, phone, or email..."
            className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-semibold text-slate-900 pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500] transition-all"
          />
        </div>

        <span className="text-xs font-bold text-slate-500">
          Total: {suppliers.length} Suppliers
        </span>
      </div>

      {/* Main Table matching Screen 8 in reference image */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Name</th>
                <th className="py-3.5 px-4">Phone</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Total Due</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {paginatedSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                    No suppliers found matching your query.
                  </td>
                </tr>
              ) : (
                paginatedSuppliers.map((s) => {
                  const due = s.totalDue || 0;
                  const isDue = due > 0;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>{s.name}</span>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 text-slate-600 font-semibold">
                        {s.phone}
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 text-slate-500 font-medium">
                        {s.email || '—'}
                      </td>

                      {/* Total Due */}
                      <td className="py-3.5 px-4 font-black text-slate-900">
                        Rs. {due.toLocaleString()}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isDue ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-50 text-red-700 border border-red-200">
                            Due
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Paid
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => onNavigateToManagement(s)}
                            className="px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-[#FF6500] text-[11px] font-bold border border-orange-200 transition-colors cursor-pointer"
                          >
                            Orders & Due
                          </button>
                          <button
                            onClick={() => handleOpenEdit(s)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSupplier(s.id, s.name)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-5 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-semibold">
          <div>
            Showing 1-{paginatedSuppliers.length} of {filteredSuppliers.length} suppliers
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-bold text-slate-800">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Supplier / Company Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. ABC Trading Co."
                  className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-semibold text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Phone Number *
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0300-1112222"
                  className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-semibold text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="abc@trading.com"
                  className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-semibold text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Warehouse / Office Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Sector B, Commercial Wholesale Area"
                  className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-semibold text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Opening Balance / Total Due (Rs.)
                </label>
                <input
                  type="number"
                  value={totalDue}
                  onChange={(e) => setTotalDue(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-bold text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[#FF6500] hover:bg-[#e65b00] text-white text-xs font-black shadow-md shadow-[#FF6500]/25 cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
