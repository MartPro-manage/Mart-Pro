import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  MoreVertical, 
  Package, 
  Barcode as BarcodeIcon, 
  Edit2, 
  Trash2, 
  Sparkles, 
  ChevronDown, 
  CheckCircle2, 
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Printer,
  Scale,
  X,
  Upload,
  RefreshCw,
  SlidersHorizontal,
  Check
} from 'lucide-react';
import { Product, Store, UserAccount } from '../types';
import { db, doc, setDoc, deleteDoc, cleanFirestoreData } from '../lib/firebase';
import { fetchProductImageUrl } from '../lib/imageFetcher';

interface ModernProductsViewProps {
  store: Store;
  currentUser: UserAccount;
  products: Product[];
  onOpenBarcodeGenerator?: (product?: Product) => void;
  onOpenAdvancedRegister?: () => void;
}

export const ModernProductsView: React.FC<ModernProductsViewProps> = ({
  store,
  currentUser,
  products,
  onOpenBarcodeGenerator,
  onOpenAdvancedRegister
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low_stock' | 'out_of_stock'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Form states matching Prototype Panel 6
  const [formName, setFormName] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formCategory, setFormCategory] = useState('Grocery');
  const [formUnit, setFormUnit] = useState('Piece');
  const [formBrand, setFormBrand] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCostPrice, setFormCostPrice] = useState('');
  const [formStock, setFormStock] = useState('');
  const [formMinStock, setFormMinStock] = useState('10');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formTrackStock, setFormTrackStock] = useState(true);

  const [isSearchingImage, setIsSearchingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>(['Grocery', 'Dairy', 'Bakery', 'Beverages', 'Snacks', 'Personal Care', 'Household', 'Sauces & Spreads']);
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  // Filtered and paginated products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = !searchTerm || 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.shortcutCode && p.shortcutCode.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCat = categoryFilter === 'all' || p.category === categoryFilter;

      const threshold = p.minStockLevel !== undefined ? p.minStockLevel : (store.lowStockAlertThreshold || 5);
      const isOut = p.stockQuantity <= 0;
      const isLow = p.stockQuantity > 0 && p.stockQuantity <= threshold;

      let matchesStatus = true;
      if (statusFilter === 'low_stock') {
        matchesStatus = isLow;
      } else if (statusFilter === 'out_of_stock') {
        matchesStatus = isOut;
      }

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [products, searchTerm, categoryFilter, statusFilter, store.lowStockAlertThreshold]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  const handleGenerateBarcode = () => {
    setFormBarcode('09' + Math.floor(1000000000 + Math.random() * 9000000000).toString());
  };

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    handleGenerateBarcode();
    setFormCategory('Grocery');
    setFormUnit('Piece');
    setFormBrand('');
    setFormDescription('');
    setFormPrice('');
    setFormCostPrice('');
    setFormStock('');
    setFormMinStock('10');
    setFormImageUrl('');
    setFormIsActive(true);
    setFormTrackStock(true);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormBarcode(p.barcode);
    setFormCategory(p.category || 'Grocery');
    setFormUnit(p.unitType === 'kg' ? 'kg' : 'Piece');
    setFormBrand('');
    setFormDescription(p.weight || '');
    setFormPrice(p.price.toString());
    setFormCostPrice(p.costPrice ? p.costPrice.toString() : '');
    setFormStock(p.stockQuantity.toString());
    setFormMinStock((p.minStockLevel || 10).toString());
    setFormImageUrl(p.imageUrl || '');
    setFormIsActive(true);
    setFormTrackStock(true);
    setIsAddModalOpen(true);
  };

  const handleAutoSearchImage = async () => {
    if (!formName.trim()) return;
    try {
      setIsSearchingImage(true);
      const url = await fetchProductImageUrl(formName.trim());
      if (url) {
        setFormImageUrl(url);
      }
    } catch (err) {
      console.warn('Auto search image error:', err);
    } finally {
      setIsSearchingImage(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPrice) return;

    setIsSaving(true);
    try {
      const prodId = editingProduct ? editingProduct.id : `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const numPrice = parseFloat(formPrice) || 0;
      const numCost = parseFloat(formCostPrice) || 0;
      const numStock = parseFloat(formStock) || 0;
      const numMinStock = parseFloat(formMinStock) || 5;

      const productPayload = {
        id: prodId,
        storeId: store.id,
        name: formName.trim(),
        barcode: formBarcode.trim() || Math.floor(10000000000 + Math.random() * 90000000000).toString(),
        category: formCategory.trim() || 'General',
        price: numPrice,
        costPrice: numCost,
        stockQuantity: numStock,
        minStockLevel: numMinStock,
        unitType: formUnit.toLowerCase().includes('kg') ? 'kg' : 'piece',
        sellBy: formUnit.toLowerCase().includes('kg') ? 'weight' : 'unit',
        weight: formDescription.trim() || undefined,
        imageUrl: formImageUrl.trim() || '',
        updatedAt: new Date().toISOString(),
        createdAt: editingProduct?.createdAt || new Date().toISOString()
      };

      await setDoc(doc(db, 'products', prodId), cleanFirestoreData(productPayload));
      setIsAddModalOpen(false);
    } catch (err) {
      console.error('Error saving product:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (p: Product) => {
    if (!window.confirm(`Are you sure you want to delete "${p.name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'products', p.id));
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-5 bg-slate-50 min-h-0 overflow-y-auto font-sans">
      {/* Top Header & Action Row matching Panel 5 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Products & Stock
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage store catalogue, prices, stock levels, and automated barcode scanning
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onOpenAdvancedRegister && (
            <button
              type="button"
              onClick={onOpenAdvancedRegister}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <BarcodeIcon className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Advanced Register</span>
            </button>
          )}

          {/* Primary Action Button: "+ Add Product" matching Panel 5 */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm shadow-orange-600/30 transition-transform active:scale-98 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Filter Chips Bar matching Panel 5: [All Products] [Low Stock] [Out of Stock] [Categories ▾] */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setCurrentPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              statusFilter === 'all'
                ? 'bg-orange-600 text-white border-orange-600 shadow-2xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            All Products
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter('low_stock');
              setCurrentPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              statusFilter === 'low_stock'
                ? 'bg-orange-600 text-white border-orange-600 shadow-2xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            Low Stock
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter('out_of_stock');
              setCurrentPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              statusFilter === 'out_of_stock'
                ? 'bg-orange-600 text-white border-orange-600 shadow-2xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            Out of Stock
          </button>

          <select
            value={categoryFilter}
            onChange={e => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-orange-500 cursor-pointer shadow-2xs"
          >
            <option value="all">Categories (All)</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search products..."
            className="w-full pl-9 pr-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 font-medium shadow-2xs"
          />
        </div>
      </div>

      {/* Products Table matching Panel 5 */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 w-14">Image</th>
                <th className="py-3 px-4 font-bold">Product Name</th>
                <th className="py-3 px-4 font-bold">Category</th>
                <th className="py-3 px-4 font-bold">Stock</th>
                <th className="py-3 px-4 font-bold">Price</th>
                <th className="py-3 px-4 font-bold">Status</th>
                <th className="py-3 px-4 font-bold text-right w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-500" />
                    <span>No products found matching your filters.</span>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map(prod => {
                  const threshold = prod.minStockLevel !== undefined ? prod.minStockLevel : (store.lowStockAlertThreshold || 5);
                  const isOut = prod.stockQuantity <= 0;
                  const isLow = !isOut && prod.stockQuantity <= threshold;

                  return (
                    <tr 
                      key={prod.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Image Thumbnail */}
                      <td className="py-2.5 px-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                          {prod.imageUrl ? (
                            <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-slate-300" />
                          )}
                        </div>
                      </td>

                      {/* Name & Barcode */}
                      <td className="py-2.5 px-4">
                        <div className="font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
                          {prod.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {prod.barcode}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-2.5 px-4 text-slate-600 font-medium">
                        {prod.category || 'General'}
                      </td>

                      {/* Stock Quantity */}
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-800">
                        {prod.stockQuantity}
                      </td>

                      {/* Price */}
                      <td className="py-2.5 px-4 font-bold text-slate-900">
                        {store.currencySymbol || 'Rs.'} {prod.price.toLocaleString()}
                      </td>

                      {/* Status matching Panel 5: "In Stock" (green), "Low Stock" (orange), "Out of Stock" (red) */}
                      <td className="py-2.5 px-4">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                            In Stock
                          </span>
                        )}
                      </td>

                      {/* Actions Menu */}
                      <td className="py-2.5 px-4 text-right relative">
                        <button
                          type="button"
                          onClick={() => setActiveMenuId(activeMenuId === prod.id ? null : prod.id)}
                          className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {activeMenuId === prod.id && (
                          <div className="absolute right-4 mt-1 w-36 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                handleOpenEditModal(prod);
                              }}
                              className="w-full px-3 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-orange-50 flex items-center gap-2 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                              <span>Edit Product</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                handleDeleteProduct(prod);
                              }}
                              className="w-full px-3 py-1.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
          <div>
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredProducts.length)} of {filteredProducts.length}
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

            {Array.from({ length: totalPages }).map((_, i) => {
              const page = i + 1;
              if (totalPages > 5 && Math.abs(page - currentPage) > 2) return null;
              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-7 h-7 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                    currentPage === page
                      ? 'bg-orange-600 text-white shadow-2xs'
                      : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {page}
                </button>
              );
            })}

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

      {/* Add / Edit Product Modal matching Panel 6 of Prototype Showcase */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs font-sans">
          <div 
            className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 2-Column Body matching Panel 6 */}
            <form onSubmit={handleSaveProduct} className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Column 1: Product Information */}
                <div className="space-y-4">
                  <h4 className="font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-1.5">
                    Product Information
                  </h4>

                  {/* Product Name */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Tomato Ketchup"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-orange-500 focus:bg-white"
                    />
                  </div>

                  {/* Barcode with Generate Button */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Barcode
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="0901234567890"
                        value={formBarcode}
                        onChange={e => setFormBarcode(e.target.value)}
                        className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-orange-500"
                      />
                      <button
                        type="button"
                        onClick={handleGenerateBarcode}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Generate</span>
                      </button>
                    </div>
                  </div>

                  {/* Category Dropdown */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Category
                    </label>
                    <select
                      value={formCategory}
                      onChange={e => setFormCategory(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-orange-500"
                    >
                      {categories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Unit Dropdown */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Unit
                    </label>
                    <select
                      value={formUnit}
                      onChange={e => setFormUnit(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-orange-500"
                    >
                      <option value="Piece">Piece</option>
                      <option value="kg">kg</option>
                      <option value="Pack">Pack</option>
                      <option value="Box">Box</option>
                      <option value="Bottle">Bottle</option>
                    </select>
                  </div>

                  {/* Brand */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Brand
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. National, Nestle, Olpers"
                      value={formBrand}
                      onChange={e => setFormBrand(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Description
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Rich & Tasty product details..."
                      value={formDescription}
                      onChange={e => setFormDescription(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* Column 2: Pricing & Stock */}
                <div className="space-y-4">
                  <h4 className="font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-1.5">
                    Pricing & Stock
                  </h4>

                  {/* Purchase Price & Selling Price Row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Purchase Price (Rs.)
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="120"
                        value={formCostPrice}
                        onChange={e => setFormCostPrice(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Selling Price (Rs.) *
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="180"
                        value={formPrice}
                        onChange={e => setFormPrice(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  {/* Stock Quantity & Reorder Level */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Stock Quantity
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="50"
                        value={formStock}
                        onChange={e => setFormStock(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Reorder Level
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="10"
                        value={formMinStock}
                        onChange={e => setFormMinStock(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  {/* Product Image Box matching Panel 6 */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        Product Image
                      </label>
                      <button
                        type="button"
                        onClick={handleAutoSearchImage}
                        disabled={isSearchingImage || !formName.trim()}
                        className="text-[11px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isSearchingImage ? 'Searching...' : 'Auto Image'}</span>
                      </button>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
                        {formImageUrl ? (
                          <img src={formImageUrl} alt="Product" className="w-full h-full object-contain p-1" />
                        ) : (
                          <Package className="w-6 h-6 text-slate-300" />
                        )}
                      </div>

                      <div className="flex-1 space-y-1.5">
                        <input
                          type="url"
                          placeholder="Image URL"
                          value={formImageUrl}
                          onChange={e => setFormImageUrl(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-orange-500"
                        />
                        <div className="text-[10px] text-slate-400 font-medium">
                          Auto-search finds image by product name
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Active & Track Stock Toggles */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsActive}
                        onChange={e => setFormIsActive(e.target.checked)}
                        className="w-4 h-4 rounded text-orange-600 border-slate-300 focus:ring-orange-500 cursor-pointer"
                      />
                      <span>Active</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formTrackStock}
                        onChange={e => setFormTrackStock(e.target.checked)}
                        className="w-4 h-4 rounded text-orange-600 border-slate-300 focus:ring-orange-500 cursor-pointer"
                      />
                      <span>Track Stock</span>
                    </label>
                  </div>
                </div>

              </div>

              {/* Action Buttons matching Panel 6 */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
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
                  className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md shadow-orange-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
