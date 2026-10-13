import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Store, UserAccount, SupplierProfile } from '../types';
import { db, collection, query, where, onSnapshot, doc, setDoc, updateDoc, deleteDoc, cleanFirestoreData } from '../lib/firebase';
import { UniversalBackButton } from './UniversalBackButton';
import { 
  UserPlus, 
  User, 
  Phone, 
  MapPin, 
  Building, 
  Mail, 
  FileText, 
  Search, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ShieldCheck, 
  Grid, 
  List, 
  PhoneCall,
  Clock,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AddSupplierViewProps {
  store: Store;
  currentUser: UserAccount;
  onBack: () => void;
}

export const AddSupplierView: React.FC<AddSupplierViewProps> = ({
  store,
  currentUser,
  onBack
}) => {
  const [suppliers, setSuppliers] = useState<SupplierProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewLayout, setViewLayout] = useState<'cards' | 'table'>('cards');

  // Form state
  const [editingSupplier, setEditingSupplier] = useState<SupplierProfile | null>(null);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supBusiness, setSupBusiness] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supNotes, setSupNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete modal state
  const [deletingSupplier, setDeletingSupplier] = useState<SupplierProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast notification
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const formRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Real-time listener for suppliers
  useEffect(() => {
    if (!store?.id) return;

    const q = query(collection(db, 'suppliers'), where('storeId', '==', store.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: SupplierProfile[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as SupplierProfile);
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setSuppliers(list);
    }, (error) => {
      console.error('Error fetching suppliers:', error);
      showToast('error', 'Failed to load suppliers.');
    });

    return () => unsubscribe();
  }, [store?.id]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleResetForm = () => {
    setEditingSupplier(null);
    setSupName('');
    setSupPhone('');
    setSupAddress('');
    setSupBusiness('');
    setSupEmail('');
    setSupNotes('');
  };

  const handleEditClick = (sup: SupplierProfile) => {
    setEditingSupplier(sup);
    setSupName(sup.name);
    setSupPhone(sup.phone);
    setSupAddress(sup.address);
    setSupBusiness(sup.businessName || '');
    setSupEmail(sup.email || '');
    setSupNotes(sup.notes || '');

    // Scroll smoothly to form and focus name input
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supName.trim()) {
      showToast('error', 'Supplier name is required.');
      return;
    }
    if (!supPhone.trim()) {
      showToast('error', 'Phone number is required.');
      return;
    }
    if (!supAddress.trim()) {
      showToast('error', 'Address / location is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();

      if (editingSupplier) {
        const updateData: Partial<SupplierProfile> = {
          name: supName.trim(),
          phone: supPhone.trim(),
          address: supAddress.trim(),
          businessName: supBusiness.trim() || undefined,
          email: supEmail.trim() || undefined,
          notes: supNotes.trim() || undefined,
          updatedAt: now
        };

        await updateDoc(doc(db, 'suppliers', editingSupplier.id), cleanFirestoreData(updateData));
        showToast('success', `Supplier "${supName.trim()}" updated successfully.`);
      } else {
        const supId = `sup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const newSupplier: SupplierProfile = {
          id: supId,
          storeId: store.id,
          name: supName.trim(),
          phone: supPhone.trim(),
          address: supAddress.trim(),
          businessName: supBusiness.trim() || undefined,
          email: supEmail.trim() || undefined,
          notes: supNotes.trim() || undefined,
          status: 'active',
          createdAt: now,
          updatedAt: now
        };

        await setDoc(doc(db, 'suppliers', supId), cleanFirestoreData(newSupplier));
        showToast('success', `Supplier "${supName.trim()}" added successfully.`);
      }

      handleResetForm();
    } catch (err: any) {
      console.error('Error saving supplier:', err);
      showToast('error', 'Failed to save supplier: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingSupplier) return;

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'suppliers', deletingSupplier.id));
      showToast('success', `Supplier "${deletingSupplier.name}" removed successfully.`);
      if (editingSupplier?.id === deletingSupplier.id) {
        handleResetForm();
      }
      setDeletingSupplier(null);
    } catch (err: any) {
      console.error('Error deleting supplier:', err);
      showToast('error', 'Failed to delete supplier: ' + (err.message || 'Unknown error'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered suppliers based on search
  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return suppliers;
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(q) ||
      (s.businessName && s.businessName.toLowerCase().includes(q)) ||
      s.phone.toLowerCase().includes(q) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      s.address.toLowerCase().includes(q) ||
      (s.notes && s.notes.toLowerCase().includes(q))
    );
  }, [suppliers, searchQuery]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex flex-col select-none">
      {/* Top Header - ONLY Add Supplier title and back button, nothing else */}
      <div className="bg-white border-b border-slate-200 shadow-2xs sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <UniversalBackButton onBack={onBack} label="Back" />
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-xs">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-black text-slate-900 leading-tight">Add Supplier</h1>
                <p className="text-[11px] text-slate-500">Register new suppliers and view your supplier directory</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              <span>{suppliers.length} {suppliers.length === 1 ? 'Supplier' : 'Suppliers'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 ${
              notification.type === 'success' ? 'bg-emerald-600 text-white shadow-emerald-600/30' : 'bg-rose-600 text-white shadow-rose-600/30'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{notification.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-8 flex-1">
        
        {/* 1. ADD / EDIT SUPPLIER FORM */}
        <div 
          ref={formRef} 
          className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all"
        >
          <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900">
                  {editingSupplier ? `Edit Supplier: ${editingSupplier.name}` : 'Add New Supplier'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingSupplier 
                    ? 'Update the details for this supplier profile.' 
                    : 'Fill in supplier details below. Saved suppliers appear immediately in the list below.'}
                </p>
              </div>
            </div>

            {editingSupplier && (
              <button
                type="button"
                onClick={handleResetForm}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 transition-colors cursor-pointer self-start sm:self-auto flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel Editing</span>
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Full Name */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                  Supplier Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={nameInputRef}
                    type="text"
                    required
                    value={supName}
                    onChange={(e) => setSupName(e.target.value)}
                    placeholder="e.g. National Foods Distributors"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                  Phone Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    placeholder="e.g. +92 300 1234567"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>

              {/* Business Name */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                  Business / Company <span className="text-slate-400 text-[10px] font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={supBusiness}
                    onChange={(e) => setSupBusiness(e.target.value)}
                    placeholder="e.g. National Foods Ltd"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                  Email Address <span className="text-slate-400 text-[10px] font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={supEmail}
                    onChange={(e) => setSupEmail(e.target.value)}
                    placeholder="e.g. orders@nationalfoods.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                  Notes & Delivery Terms <span className="text-slate-400 text-[10px] font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={supNotes}
                    onChange={(e) => setSupNotes(e.target.value)}
                    placeholder="e.g. Delivers every Monday, payment terms 15 days"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                Complete Address / Location <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <textarea
                  required
                  rows={2}
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  placeholder="Enter physical address, city, warehouse or market stall number..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white resize-none"
                />
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Supplier is saved to store database immediately</span>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Clear Fields
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isSubmitting ? 'Saving...' : editingSupplier ? 'Update Supplier' : 'Save Supplier'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* 2. LIST OF SUPPLIERS */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900">List of Suppliers</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-xs">
                  {filteredSuppliers.length} {filteredSuppliers.length === 1 ? 'Supplier' : 'Suppliers'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                All registered suppliers for {store?.name || 'this store'}. Click Edit to modify or Delete to remove.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search suppliers..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-slate-50 focus:bg-white transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* View Layout Switcher */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewLayout('cards')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    viewLayout === 'cards' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Card view"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewLayout('table')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    viewLayout === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Table view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Suppliers Container */}
          {suppliers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <UserPlus className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-slate-900">No Suppliers Registered Yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Use the form above to add your first supplier. Once added, they will be listed here and available across the store.
              </p>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-2xs">
              <Search className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <h3 className="text-sm font-bold text-slate-800">No matching suppliers found</h3>
              <p className="text-xs text-slate-500 mt-1">
                No suppliers matched your search query "{searchQuery}".
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-3 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer inline-flex items-center gap-1"
              >
                Clear Search
              </button>
            </div>
          ) : viewLayout === 'cards' ? (
            /* Cards View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSuppliers.map((sup) => (
                <div
                  key={sup.id}
                  className={`bg-white rounded-2xl border transition-all p-5 flex flex-col justify-between shadow-2xs relative ${
                    editingSupplier?.id === sup.id
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div>
                    {/* Header: Initial + Name + Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black text-base shadow-xs shrink-0">
                          {sup.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-slate-900 text-sm truncate">
                            {sup.name}
                          </h3>
                          {sup.businessName ? (
                            <p className="text-xs font-semibold text-slate-500 truncate flex items-center gap-1 mt-0.5">
                              <Building className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{sup.businessName}</span>
                            </p>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-400">#{sup.id.slice(-6)}</span>
                          )}
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold shrink-0">
                        {sup.status || 'active'}
                      </span>
                    </div>

                    {/* Contact Details */}
                    <div className="mt-4 space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <a 
                          href={`tel:${sup.phone}`} 
                          className="font-bold font-mono text-slate-800 hover:text-emerald-600 transition-colors"
                        >
                          {sup.phone}
                        </a>
                      </div>

                      {sup.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <a 
                            href={`mailto:${sup.email}`}
                            className="font-medium text-slate-600 hover:text-emerald-600 truncate transition-colors"
                          >
                            {sup.email}
                          </a>
                        </div>
                      )}

                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="font-medium text-slate-600 leading-snug line-clamp-2">
                          {sup.address}
                        </span>
                      </div>

                      {sup.notes && (
                        <div className="flex items-start gap-2 pt-1">
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="text-[11px] text-slate-500 italic line-clamp-2">
                            {sup.notes}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer Actions: Edit and Delete */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <a
                      href={`tel:${sup.phone}`}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-200"
                    >
                      <PhoneCall className="w-3 h-3 text-emerald-600" />
                      <span>Call</span>
                    </a>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleEditClick(sup)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer border border-emerald-200"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingSupplier(sup)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete supplier"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Table View */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Supplier Name</th>
                      <th className="p-3.5">Business Name</th>
                      <th className="p-3.5">Phone Number</th>
                      <th className="p-3.5">Email</th>
                      <th className="p-3.5">Address</th>
                      <th className="p-3.5 text-center">Status</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSuppliers.map((sup) => (
                      <tr 
                        key={sup.id} 
                        className={`hover:bg-slate-50/80 transition-colors ${
                          editingSupplier?.id === sup.id ? 'bg-emerald-50/40' : ''
                        }`}
                      >
                        <td className="p-3.5 font-bold text-slate-900">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {sup.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate max-w-[180px]">{sup.name}</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-600 font-medium">
                          {sup.businessName || '-'}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-slate-800">
                          <a href={`tel:${sup.phone}`} className="hover:text-emerald-600">
                            {sup.phone}
                          </a>
                        </td>
                        <td className="p-3.5 text-slate-600">
                          {sup.email ? (
                            <a href={`mailto:${sup.email}`} className="hover:text-emerald-600 truncate block max-w-[180px]">
                              {sup.email}
                            </a>
                          ) : '-'}
                        </td>
                        <td className="p-3.5 text-slate-600 max-w-[220px] truncate" title={sup.address}>
                          {sup.address}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                            {sup.status || 'active'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEditClick(sup)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs cursor-pointer flex items-center gap-1 border border-emerald-200"
                              title="Edit Supplier"
                            >
                              <Edit2 className="w-3 h-3" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingSupplier(sup)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="Delete Supplier"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900 text-center">Delete Supplier?</h3>
              <p className="text-xs text-slate-500 text-center mt-1.5 leading-relaxed">
                Are you sure you want to remove <span className="font-bold text-slate-800">"{deletingSupplier.name}"</span> from your supplier list? This action cannot be undone.
              </p>

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeletingSupplier(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeleteConfirm}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition-colors cursor-pointer shadow-md shadow-rose-600/20 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
