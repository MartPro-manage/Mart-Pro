import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Layers, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  ChevronRight, 
  Building2, 
  Package, 
  Check, 
  X, 
  Sparkles, 
  ArrowLeft,
  FolderTree,
  Tag,
  Scale,
  RefreshCw,
  ShoppingBag,
  ExternalLink,
  AlertTriangle
} from 'lucide-react';
import { Store, ManagedCategory, CompanyBrand } from '../types';
import { 
  fetchStoreManagedCategories, 
  saveManagedCategory, 
  deleteManagedCategory, 
  addCompanyToCategory, 
  updateCompanySizes, 
  deleteCompanyFromCategory,
  deleteAllCompaniesFromCategory,
  deleteAllSizesFromCompany,
  deleteAllSizesFromCategoryCompanies,
  seedDefaultCategoriesForStore
} from '../lib/categories';
import { db, collection, onSnapshot, query, where } from '../lib/firebase';

interface ManageCategoriesViewProps {
  store: Store;
  onNavigateToRegister?: () => void;
}

export const ManageCategoriesView: React.FC<ManageCategoriesViewProps> = ({
  store,
  onNavigateToRegister
}) => {
  const [categories, setCategories] = useState<ManagedCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Navigation / Selection State
  // Selected Category ID
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  // Selected Company ID
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // In-App Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText: string;
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'Delete',
    onConfirm: () => {}
  });

  // New Category Form
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  // New Company Form
  const [newCompanyName, setNewCompanyName] = useState('');
  const [isAddingCompany, setIsAddingCompany] = useState(false);

  // New Size Input
  const [newSizeInput, setNewSizeInput] = useState('');

  // Editing Category or Company
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editCompanyName, setEditCompanyName] = useState('');

  // Notification Toast
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Real-time Firestore Subscription to Categories
  useEffect(() => {
    if (!store.id) return;
    setLoading(true);

    const q = query(collection(db, 'categories'), where('storeId', '==', store.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: ManagedCategory[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as ManagedCategory);
      });

      if (list.length === 0) {
        // First-time seed
        fetchStoreManagedCategories(store.id).then((seeded) => {
          setCategories(seeded);
          setLoading(false);
        });
      } else {
        setCategories(list.sort((a, b) => a.name.localeCompare(b.name)));
        setLoading(false);
      }
    }, (err) => {
      console.warn('Categories subscription error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [store.id]);

  // Active Category Object
  const selectedCategory = useMemo(() => {
    return categories.find(c => c.id === selectedCategoryId) || null;
  }, [categories, selectedCategoryId]);

  // Active Company Object
  const selectedCompany = useMemo(() => {
    if (!selectedCategory) return null;
    return (selectedCategory.companies || []).find(comp => comp.id === selectedCompanyId) || null;
  }, [selectedCategory, selectedCompanyId]);

  // Filtered categories based on search
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;
    const term = searchTerm.toLowerCase();
    return categories.filter(c => 
      c.name.toLowerCase().includes(term) ||
      (c.description && c.description.toLowerCase().includes(term)) ||
      c.companies?.some(comp => comp.name.toLowerCase().includes(term) || comp.sizes?.some(s => s.toLowerCase().includes(term)))
    );
  }, [categories, searchTerm]);

  // --- Handlers: Category Management ---
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) {
      showToast('error', 'Please enter a category name.');
      return;
    }

    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      showToast('error', `Category "${name}" already exists.`);
      return;
    }

    try {
      const newCat: ManagedCategory = {
        id: `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        storeId: store.id,
        name,
        description: newCatDesc.trim() || undefined,
        companies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveManagedCategory(newCat);
      setNewCatName('');
      setNewCatDesc('');
      setIsAddingCategory(false);
      setSelectedCategoryId(newCat.id);
      setSelectedCompanyId(null);
      showToast('success', `Category "${name}" added successfully!`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to create category.');
    }
  };

  const handleUpdateCategoryName = async (cat: ManagedCategory) => {
    const updatedName = editCategoryName.trim();
    if (!updatedName) return;
    try {
      await saveManagedCategory({
        ...cat,
        name: updatedName
      });
      setEditingCategoryId(null);
      setEditCategoryName('');
      showToast('success', 'Category updated successfully.');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update category.');
    }
  };

  const handleDeleteCategory = (cat: ManagedCategory) => {
    setConfirmModal({
      isOpen: true,
      title: `Delete Category "${cat.name}"?`,
      description: `Are you sure you want to delete category "${cat.name}" and all its ${(cat.companies || []).length} registered companies and sizes? This action cannot be undone.`,
      confirmText: 'Delete Category',
      onConfirm: async () => {
        try {
          await deleteManagedCategory(cat.id);
          if (selectedCategoryId === cat.id) {
            setSelectedCategoryId(null);
            setSelectedCompanyId(null);
          }
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          showToast('success', `Category "${cat.name}" deleted.`);
        } catch (err: any) {
          showToast('error', err?.message || 'Failed to delete category.');
        }
      }
    });
  };

  // --- Handlers: Company Management ---
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) return;
    const name = newCompanyName.trim();
    if (!name) {
      showToast('error', 'Please enter a company name.');
      return;
    }

    if ((selectedCategory.companies || []).some(comp => comp.name.toLowerCase() === name.toLowerCase())) {
      showToast('error', `Company "${name}" already exists in this category.`);
      return;
    }

    try {
      const updatedCat = addCompanyToCategory(selectedCategory, name);
      await saveManagedCategory(updatedCat);
      setNewCompanyName('');
      setIsAddingCompany(false);
      // Automatically select the newly created company to enter sizes
      const newlyCreated = (updatedCat.companies || []).find(c => c.name.toLowerCase() === name.toLowerCase());
      if (newlyCreated) {
        setSelectedCompanyId(newlyCreated.id);
      }
      showToast('success', `Company "${name}" added! Now add sizes / quantities.`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to add company.');
    }
  };

  const handleUpdateCompanyName = async (comp: CompanyBrand) => {
    if (!selectedCategory) return;
    const updatedName = editCompanyName.trim();
    if (!updatedName) return;

    try {
      const updatedCompanies = (selectedCategory.companies || []).map(c => 
        c.id === comp.id ? { ...c, name: updatedName } : c
      );
      await saveManagedCategory({
        ...selectedCategory,
        companies: updatedCompanies
      });
      setEditingCompanyId(null);
      setEditCompanyName('');
      showToast('success', 'Company name updated.');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update company name.');
    }
  };

  const handleDeleteCompany = (comp: CompanyBrand) => {
    if (!selectedCategory) return;
    setConfirmModal({
      isOpen: true,
      title: `Delete Company "${comp.name}"?`,
      description: `Are you sure you want to delete company "${comp.name}" and all its ${(comp.sizes || []).length} configured sizes from "${selectedCategory.name}"?`,
      confirmText: 'Delete Company',
      onConfirm: async () => {
        try {
          const updatedCat = deleteCompanyFromCategory(selectedCategory, comp.id);
          await saveManagedCategory(updatedCat);
          if (selectedCompanyId === comp.id) {
            setSelectedCompanyId(null);
          }
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          showToast('success', `Company "${comp.name}" removed.`);
        } catch (err: any) {
          showToast('error', err?.message || 'Failed to remove company.');
        }
      }
    });
  };

  // Delete ALL Companies and their sizes from the currently selected category
  const handleDeleteAllCompaniesFromCategory = () => {
    if (!selectedCategory) return;
    const count = (selectedCategory.companies || []).length;
    if (count === 0) return;

    setConfirmModal({
      isOpen: true,
      title: `Delete All Companies from "${selectedCategory.name}"?`,
      description: `Are you sure you want to delete all ${count} companies/brands and all their sizes from "${selectedCategory.name}"? This action will clear the company and size options for this category.`,
      confirmText: `Delete All ${count} Companies`,
      onConfirm: async () => {
        try {
          const updatedCat = deleteAllCompaniesFromCategory(selectedCategory);
          await saveManagedCategory(updatedCat);
          setSelectedCompanyId(null);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          showToast('success', `All companies and sizes deleted from "${selectedCategory.name}".`);
        } catch (err: any) {
          showToast('error', err?.message || 'Failed to delete companies.');
        }
      }
    });
  };

  // Delete ALL Sizes from the currently selected company
  const handleDeleteAllSizesFromCompany = () => {
    if (!selectedCategory || !selectedCompany) return;
    const count = (selectedCompany.sizes || []).length;
    if (count === 0) return;

    setConfirmModal({
      isOpen: true,
      title: `Delete All Sizes for "${selectedCompany.name}"?`,
      description: `Are you sure you want to delete all ${count} configured sizes and packaging quantities from "${selectedCompany.name}"?`,
      confirmText: `Delete All ${count} Sizes`,
      onConfirm: async () => {
        try {
          const updatedCat = deleteAllSizesFromCompany(selectedCategory, selectedCompany.id);
          await saveManagedCategory(updatedCat);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          showToast('success', `All sizes removed from "${selectedCompany.name}".`);
        } catch (err: any) {
          showToast('error', err?.message || 'Failed to delete sizes.');
        }
      }
    });
  };

  // Delete ALL sizes across all companies in the current category
  const handleDeleteAllSizesFromCategory = () => {
    if (!selectedCategory) return;
    const totalSizes = (selectedCategory.companies || []).reduce((sum, c) => sum + (c.sizes || []).length, 0);
    if (totalSizes === 0) return;

    setConfirmModal({
      isOpen: true,
      title: `Delete All Sizes in "${selectedCategory.name}"?`,
      description: `This will remove all ${totalSizes} sizes across all ${(selectedCategory.companies || []).length} companies under "${selectedCategory.name}". Company names will remain.`,
      confirmText: `Delete All ${totalSizes} Sizes`,
      onConfirm: async () => {
        try {
          const updatedCat = deleteAllSizesFromCategoryCompanies(selectedCategory);
          await saveManagedCategory(updatedCat);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          showToast('success', `All sizes cleared for companies in "${selectedCategory.name}".`);
        } catch (err: any) {
          showToast('error', err?.message || 'Failed to delete sizes.');
        }
      }
    });
  };

  // Store-wide Delete All Companies (across all categories)
  const handleDeleteAllCompaniesAcrossStore = () => {
    const totalCompanies = categories.reduce((sum, c) => sum + (c.companies || []).length, 0);
    if (totalCompanies === 0) {
      showToast('error', 'No companies currently exist in any category.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Delete All Companies Across All Categories?',
      description: `This will clear all ${totalCompanies} companies and their sizes across all ${categories.length} categories in your store. Category names will be preserved.`,
      confirmText: `Delete All ${totalCompanies} Companies`,
      onConfirm: async () => {
        try {
          for (const cat of categories) {
            if (cat.companies && cat.companies.length > 0) {
              const updated = deleteAllCompaniesFromCategory(cat);
              await saveManagedCategory(updated);
            }
          }
          setSelectedCompanyId(null);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          showToast('success', 'All companies and sizes cleared across all categories.');
        } catch (err: any) {
          showToast('error', err?.message || 'Failed to delete all companies.');
        }
      }
    });
  };

  // Restore Default Categories & Taxonomy
  const handleRestoreDefaultTaxonomy = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Restore Default Taxonomy?',
      description: 'This will seed or restore default supermarket categories (Beverages, Dairy, Snacks, Ghee, Spices, Bakery, Personal Care, Laundry, etc.) with pre-configured companies and packaging sizes.',
      confirmText: 'Restore Defaults',
      onConfirm: async () => {
        try {
          await seedDefaultCategoriesForStore(store.id);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          showToast('success', 'Default categories, companies, and sizes restored!');
        } catch (err: any) {
          showToast('error', err?.message || 'Failed to restore default taxonomy.');
        }
      }
    });
  };

  // --- Handlers: Multiple Sizes / Quantities Management ---
  const handleAddSizeToCompany = async (sizeToAdd: string) => {
    if (!selectedCategory || !selectedCompany) return;
    const trimmed = sizeToAdd.trim();
    if (!trimmed) return;

    const currentSizes = selectedCompany.sizes || [];
    if (currentSizes.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      showToast('error', `Size "${trimmed}" already added.`);
      return;
    }

    const updatedSizes = [...currentSizes, trimmed];
    try {
      const updatedCat = updateCompanySizes(selectedCategory, selectedCompany.id, updatedSizes);
      await saveManagedCategory(updatedCat);
      setNewSizeInput('');
      showToast('success', `Size "${trimmed}" added.`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update sizes.');
    }
  };

  const handleRemoveSizeFromCompany = async (sizeToRemove: string) => {
    if (!selectedCategory || !selectedCompany) return;
    const currentSizes = selectedCompany.sizes || [];
    const updatedSizes = currentSizes.filter(s => s !== sizeToRemove);

    try {
      const updatedCat = updateCompanySizes(selectedCategory, selectedCompany.id, updatedSizes);
      await saveManagedCategory(updatedCat);
      showToast('success', `Size "${sizeToRemove}" removed.`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to remove size.');
    }
  };

  // Common Size / Quantity Presets for 1-Click Addition
  const volumePresets = ['250ml', '300ml Can', '500ml', '1 Liter', '1.5 Liter', '2.25 Liter', '5 Liter Can'];
  const weightPresets = ['50g', '100g', '200g', '250g', '500g', '1 kg', '2 kg', '5 kg Bag', '10 kg Bag'];
  const packagePresets = ['Single Piece', 'Half Roll', 'Family Pack', 'Pack of 6', 'Pack of 12', '1 Dozen', 'Carton'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-[9999] px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold ${
              toastMsg.type === 'success' 
                ? 'bg-emerald-600 text-white shadow-emerald-600/30' 
                : 'bg-rose-600 text-white shadow-rose-600/30'
            }`}
          >
            {toastMsg.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            <span>{toastMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-orange-400">
            <FolderTree className="w-4 h-4" />
            <span>Product Taxonomy Hierarchy</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">
            Category, Company & Size Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-2xl mt-1.5 leading-relaxed">
            Organize products in 3 intuitive steps: <strong>1. Select / Add Category</strong> &rarr; <strong>2. Add Company / Brand</strong> &rarr; <strong>3. Enter Multiple Sizes & Quantities</strong>. All options instantly sync to the Product Register.
          </p>
        </div>

        {onNavigateToRegister && (
          <button
            type="button"
            onClick={onNavigateToRegister}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-lg shadow-orange-500/25 transition-all self-start md:self-auto shrink-0"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Go to Product Register</span>
          </button>
        )}
      </div>

      {/* Breadcrumb Navigation Bar */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs flex items-center gap-2 text-xs font-bold overflow-x-auto custom-scrollbar">
        <button
          type="button"
          onClick={() => {
            setSelectedCategoryId(null);
            setSelectedCompanyId(null);
          }}
          className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
            !selectedCategoryId 
              ? 'bg-slate-900 text-white shadow-xs font-black' 
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All Categories ({categories.length})</span>
        </button>

        {selectedCategory && (
          <>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            <button
              type="button"
              onClick={() => setSelectedCompanyId(null)}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCategory && !selectedCompanyId 
                  ? 'bg-orange-600 text-white shadow-xs font-black' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>{selectedCategory.name} ({(selectedCategory.companies || []).length} Companies)</span>
            </button>
          </>
        )}

        {selectedCompany && (
          <>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="px-3 py-1.5 rounded-xl bg-blue-600 text-white shadow-xs font-black flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" />
              <span>{selectedCompany.name} ({(selectedCompany.sizes || []).length} Sizes / Quantities)</span>
            </div>
          </>
        )}

        {/* Store-wide Bulk Action Buttons */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRestoreDefaultTaxonomy}
            className="px-2.5 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5 text-xs font-bold border border-slate-200 cursor-pointer shadow-2xs"
            title="Restore default supermarket categories, brands & sizes"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Reset Defaults</span>
          </button>
          {categories.some(c => (c.companies || []).length > 0) && (
            <button
              type="button"
              onClick={handleDeleteAllCompaniesAcrossStore}
              className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors flex items-center gap-1.5 text-xs font-extrabold border border-rose-200 cursor-pointer shadow-2xs"
              title="Delete all companies and sizes across all categories in store"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Delete All Companies (All Categories)</span>
            </button>
          )}
        </div>
      </div>

      {/* 3-Panel Hierarchical Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* ======================================================== */}
        {/* PANEL 1: CATEGORIES LIST                                 */}
        {/* ======================================================== */}
        <div className={`bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4 ${
          selectedCategoryId ? 'hidden lg:block lg:opacity-90' : 'block'
        }`}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-orange-600" />
                <span>1. Categories</span>
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Click any category to view & add companies
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddingCategory(true)}
              className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-colors border border-orange-200 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>

          {/* Search Categories */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search categories & brands..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-orange-500 focus:bg-white shadow-2xs"
            />
          </div>

          {/* Add Category Drawer / Inline Card */}
          {isAddingCategory && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleCreateCategory}
              className="p-3.5 bg-orange-50/70 border border-orange-200 rounded-2xl space-y-2.5 animate-fade-in"
            >
              <div className="flex items-center justify-between text-xs font-extrabold text-orange-950">
                <span>Add New Category</span>
                <button
                  type="button"
                  onClick={() => setIsAddingCategory(false)}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Category name (e.g. Beverages, Spices, Dairy)..."
                autoFocus
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
              />

              <input
                type="text"
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                placeholder="Optional short description..."
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-orange-500"
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingCategory(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-extrabold cursor-pointer shadow-xs"
                >
                  Save Category
                </button>
              </div>
            </motion.form>
          )}

          {/* Categories List Items */}
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-orange-500" />
              <span>Loading categories...</span>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="p-6 text-center border border-dashed border-slate-200 rounded-2xl text-xs text-slate-500">
              No categories found. Click <strong>+ Add</strong> above to create one.
            </div>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredCategories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                const companyCount = (cat.companies || []).length;
                const isEditing = editingCategoryId === cat.id;

                return (
                  <div
                    key={cat.id}
                    onClick={() => {
                      if (!isEditing) {
                        setSelectedCategoryId(cat.id);
                        setSelectedCompanyId(null);
                      }
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-orange-50/90 border-orange-400 shadow-sm'
                        : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editCategoryName}
                            onChange={(e) => setEditCategoryName(e.target.value)}
                            className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 w-full"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateCategoryName(cat)}
                            className="p-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCategoryId(null)}
                            className="p-1 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <h3 className={`text-xs font-black truncate ${isSelected ? 'text-orange-950 font-black' : 'text-slate-900'}`}>
                              {cat.name}
                            </h3>
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-white border border-slate-200 text-slate-600 shrink-0">
                              {companyCount} {companyCount === 1 ? 'brand' : 'brands'}
                            </span>
                          </div>
                          {cat.description && (
                            <p className="text-[10px] text-slate-500 truncate mt-0.5">
                              {cat.description}
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategoryId(cat.id);
                            setEditCategoryName(cat.name);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg cursor-pointer transition-colors"
                          title="Edit Category Name"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg cursor-pointer transition-colors"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className={`w-4 h-4 ml-1 ${isSelected ? 'text-orange-600' : 'text-slate-300'}`} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* PANEL 2: COMPANIES / BRANDS FOR SELECTED CATEGORY        */}
        {/* ======================================================== */}
        <div className={`bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4 ${
          !selectedCategoryId ? 'hidden lg:block lg:opacity-50 pointer-events-none' : 'block'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategoryId(null)}
                className="lg:hidden p-1 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                title="Back to Categories"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <span>2. Companies & Brands</span>
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">
                  {selectedCategory ? `Under "${selectedCategory.name}"` : 'Select a category to view brands'}
                </p>
              </div>
            </div>

            {selectedCategory && (
              <div className="flex items-center gap-2">
                {(selectedCategory.companies || []).length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteAllCompaniesFromCategory}
                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-colors border border-rose-200 shadow-2xs"
                    title={`Delete all companies in ${selectedCategory.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Delete All Companies</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsAddingCompany(true)}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-colors border border-indigo-200 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Company</span>
                </button>
              </div>
            )}
          </div>

          {!selectedCategory ? (
            <div className="p-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
              <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <span>Select a category on the left to view and add companies.</span>
            </div>
          ) : (
            <>
              {/* Add Company Form */}
              {isAddingCompany && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleCreateCompany}
                  className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-2.5 animate-fade-in"
                >
                  <div className="flex items-center justify-between text-xs font-extrabold text-indigo-950">
                    <span>Add Company / Brand to "{selectedCategory.name}"</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingCompany(false)}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="e.g. Coca-Cola, PepsiCo, Nestle, Dalda, National Foods..."
                    autoFocus
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                  />

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingCompany(false)}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-extrabold cursor-pointer shadow-xs"
                    >
                      Add Company
                    </button>
                  </div>
                </motion.form>
              )}

              {/* Company Items */}
              {(selectedCategory.companies || []).length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl text-xs text-slate-500 space-y-2">
                  <Building2 className="w-7 h-7 text-slate-300 mx-auto" />
                  <p>No companies / brands added for <strong>{selectedCategory.name}</strong> yet.</p>
                  <button
                    type="button"
                    onClick={() => setIsAddingCompany(true)}
                    className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 cursor-pointer"
                  >
                    + Add First Company
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
                  {(selectedCategory.companies || []).map((comp) => {
                    const isSelected = selectedCompanyId === comp.id;
                    const sizeCount = (comp.sizes || []).length;
                    const isEditing = editingCompanyId === comp.id;

                    return (
                      <div
                        key={comp.id}
                        onClick={() => {
                          if (!isEditing) {
                            setSelectedCompanyId(comp.id);
                          }
                        }}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-indigo-50/90 border-indigo-400 shadow-sm'
                            : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={editCompanyName}
                                onChange={(e) => setEditCompanyName(e.target.value)}
                                className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 w-full"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateCompanyName(comp)}
                                className="p-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCompanyId(null)}
                                className="p-1 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <h3 className={`text-xs font-black truncate ${isSelected ? 'text-indigo-950 font-black' : 'text-slate-900'}`}>
                                  {comp.name}
                                </h3>
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 ${
                                  sizeCount > 0 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}>
                                  {sizeCount} {sizeCount === 1 ? 'size' : 'sizes'}
                                </span>
                              </div>
                              {sizeCount > 0 && (
                                <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                  {comp.sizes.slice(0, 3).join(', ')}{comp.sizes.length > 3 ? ` +${comp.sizes.length - 3} more` : ''}
                                </p>
                              )}
                            </>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCompanyId(comp.id);
                                setEditCompanyName(comp.name);
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg cursor-pointer transition-colors"
                              title="Edit Company Name"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCompany(comp)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg cursor-pointer transition-colors"
                              title="Delete Company"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <ChevronRight className={`w-4 h-4 ml-1 ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* ======================================================== */}
        {/* PANEL 3: MULTIPLE SIZES / QUANTITIES FOR COMPANY        */}
        {/* ======================================================== */}
        <div className={`bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4 ${
          !selectedCompanyId ? 'hidden lg:block lg:opacity-50 pointer-events-none' : 'block'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedCompanyId(null)}
                className="lg:hidden p-1 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                title="Back to Companies"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600" />
                  <span>3. Multiple Sizes / Quantity</span>
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">
                  {selectedCompany ? `For "${selectedCompany.name}"` : 'Select a company to enter sizes'}
                </p>
              </div>
            </div>

            {selectedCompany && (
              <div className="flex items-center gap-2">
                {(selectedCompany.sizes || []).length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteAllSizesFromCompany}
                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-colors border border-rose-200 shadow-2xs"
                    title={`Delete all sizes for ${selectedCompany.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Delete All Sizes</span>
                  </button>
                )}
                <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                  {(selectedCompany.sizes || []).length} active
                </span>
              </div>
            )}
          </div>

          {!selectedCompany ? (
            <div className="p-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
              <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <span>Select a company in the middle panel to configure its sizes and packaging quantities.</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Add Custom Size Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddSizeToCompany(newSizeInput);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={newSizeInput}
                  onChange={(e) => setNewSizeInput(e.target.value)}
                  placeholder="Enter size or quantity (e.g. 500ml, 1.5 Liter, 1 kg)..."
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white shadow-2xs"
                />
                <button
                  type="submit"
                  disabled={!newSizeInput.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-extrabold cursor-pointer shadow-xs transition-colors shrink-0"
                >
                  + Add Size
                </button>
              </form>

              {/* 1-Click Fast Presets */}
              <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Quick 1-Click Addition Presets:</span>
                </span>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[9px] font-bold text-slate-500 uppercase mr-1">Liquid:</span>
                    {volumePresets.map(preset => {
                      const alreadyHas = (selectedCompany.sizes || []).includes(preset);
                      return (
                        <button
                          key={preset}
                          type="button"
                          disabled={alreadyHas}
                          onClick={() => handleAddSizeToCompany(preset)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
                            alreadyHas
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 opacity-60'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'
                          }`}
                        >
                          {alreadyHas ? `✓ ${preset}` : `+ ${preset}`}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[9px] font-bold text-slate-500 uppercase mr-1">Weight:</span>
                    {weightPresets.map(preset => {
                      const alreadyHas = (selectedCompany.sizes || []).includes(preset);
                      return (
                        <button
                          key={preset}
                          type="button"
                          disabled={alreadyHas}
                          onClick={() => handleAddSizeToCompany(preset)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
                            alreadyHas
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 opacity-60'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'
                          }`}
                        >
                          {alreadyHas ? `✓ ${preset}` : `+ ${preset}`}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[9px] font-bold text-slate-500 uppercase mr-1">Packs:</span>
                    {packagePresets.map(preset => {
                      const alreadyHas = (selectedCompany.sizes || []).includes(preset);
                      return (
                        <button
                          key={preset}
                          type="button"
                          disabled={alreadyHas}
                          onClick={() => handleAddSizeToCompany(preset)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
                            alreadyHas
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 opacity-60'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'
                          }`}
                        >
                          {alreadyHas ? `✓ ${preset}` : `+ ${preset}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Configured Sizes List Chips */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-black text-slate-700">
                  <span>Configured Sizes / Quantities ({(selectedCompany.sizes || []).length})</span>
                  {(selectedCompany.sizes || []).length > 0 && (
                    <button
                      type="button"
                      onClick={handleDeleteAllSizesFromCompany}
                      className="text-[11px] text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 font-bold cursor-pointer transition-colors"
                      title="Clear all configured sizes for this company"
                    >
                      <Trash2 className="w-3 h-3 text-rose-500" />
                      <span>Clear all sizes</span>
                    </button>
                  )}
                </div>

                {(selectedCompany.sizes || []).length === 0 ? (
                  <p className="p-6 text-center border border-dashed border-slate-200 rounded-2xl text-xs text-slate-500">
                    No sizes or quantities configured yet. Use the presets above or enter a custom size.
                  </p>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                    {selectedCompany.sizes.map((size) => (
                      <div
                        key={size}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-2xs group hover:border-emerald-400 transition-colors"
                      >
                        <Tag className="w-3 h-3 text-emerald-600" />
                        <span>{size}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSizeFromCompany(size)}
                          className="text-emerald-700 hover:text-rose-600 p-0.5 rounded cursor-pointer transition-colors"
                          title="Remove size"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ready Status Banner */}
              <div className="p-3 bg-blue-50/80 rounded-2xl border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
                <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">
                  <strong>Ready for Product Register!</strong> When cashiers or inventory staff register products, selecting <strong>"{selectedCategory.name}"</strong> &rarr; <strong>"{selectedCompany.name}"</strong> will display these exact size options for 1-click product cataloging.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Confirmation Modal for Safe Deletion */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-start gap-3.5">
                <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <h3 className="text-base font-black text-slate-900">
                    {confirmModal.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    {confirmModal.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmModal.onConfirm}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl cursor-pointer shadow-md shadow-rose-600/20 transition-all flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{confirmModal.confirmText}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
