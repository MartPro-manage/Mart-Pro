import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  PlusCircle,
  Package
} from 'lucide-react';
import { Product, Store, UserAccount } from '../../types';
import { Screen6AddEditProductModal } from './Screen6AddEditProductModal';
import { db, doc, deleteDoc, updateDoc } from '../../lib/firebase';

interface Screen5ProductsStockProps {
  store: Store | null;
  currentUser: UserAccount | null;
  products: Product[];
  onProductUpdated: (prod: Product) => void;
  onOpenAddModal?: () => void;
}

export const Screen5ProductsStock: React.FC<Screen5ProductsStockProps> = ({
  store,
  currentUser,
  products,
  onProductUpdated,
  onOpenAddModal
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'low_stock' | 'out_of_stock' | 'categories'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Add/Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Search
      const matchSearch = !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchQuery.toLowerCase());

      // Filter tabs
      const qty = p.stockQuantity || 0;
      const threshold = p.reorderLevel || p.minStockLevel || 5;

      if (activeFilter === 'low_stock') {
        return matchSearch && qty > 0 && qty <= threshold;
      }
      if (activeFilter === 'out_of_stock') {
        return matchSearch && qty <= 0;
      }
      return matchSearch;
    });
  }, [products, searchQuery, activeFilter]);

  // Pagination calculation
  const totalItems = filteredProducts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setIsModalOpen(true);
  };

  const handleDelete = async (productId: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}" from inventory?`)) {
      try {
        await deleteDoc(doc(db, 'products', productId));
      } catch (e) {
        console.error('Delete error:', e);
      }
    }
  };

  const handleAdjustStock = async (product: Product, delta: number) => {
    const newQty = Math.max(0, (product.stockQuantity || 0) + delta);
    try {
      await updateDoc(doc(db, 'products', product.id), {
        stockQuantity: newQty,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Stock update error:', e);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-5 bg-[#F8F9FA] custom-scrollbar select-none">
      {/* Top Header & Action Controls matching Screen 5 in mockup */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#111111] tracking-tight">
            Products & Stock
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Manage your store inventory, retail pricing, and real-time stock levels
          </p>
        </div>

        {/* Orange + Add Product Button matching mockup */}
        <button
          onClick={handleOpenAdd}
          className="px-5 py-2.5 rounded-xl bg-[#FF6500] hover:bg-[#e65b00] active:scale-[0.98] text-white text-xs font-black shadow-md shadow-[#FF6500]/25 transition-all cursor-pointer flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Product</span>
        </button>
      </div>

      {/* Filter Bar matching Screen 5 in mockup */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none [scrollbar-width:none]">
          {[
            { id: 'all', label: 'All Products' },
            { id: 'low_stock', label: 'Low Stock' },
            { id: 'out_of_stock', label: 'Out of Stock' },
            { id: 'categories', label: 'Categories' },
          ].map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveFilter(tab.id as any);
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#FF6500] text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search product..."
            className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-semibold text-slate-900 pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500] transition-all"
          />
        </div>
      </div>

      {/* Main Products Table matching Screen 5 in reference mockup */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Image</th>
                <th className="py-3.5 px-4">Product Name</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Stock</th>
                <th className="py-3.5 px-4">Price</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                    No products matching your search criteria.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => {
                  const qty = p.stockQuantity || 0;
                  const threshold = p.reorderLevel || p.minStockLevel || 5;
                  const isOutOfStock = qty <= 0;
                  const isLow = qty > 0 && qty <= threshold;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Image Thumbnail */}
                      <td className="py-3 px-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain p-1" />
                          ) : (
                            <Package className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </td>

                      {/* Name & Barcode */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{p.barcode || '—'}</div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 font-semibold text-slate-600">
                        {p.category || 'Grocery'}
                      </td>

                      {/* Stock Quantity with Quick adjust */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleAdjustStock(p, -1)}
                            className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs flex items-center justify-center cursor-pointer"
                          >
                            -
                          </button>
                          <span className={`font-bold min-w-8 text-center ${
                            isOutOfStock ? 'text-red-600 font-black' : isLow ? 'text-[#FF6500] font-black' : 'text-slate-900'
                          }`}>
                            {qty}
                          </span>
                          <button
                            onClick={() => handleAdjustStock(p, 1)}
                            className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs flex items-center justify-center cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4 font-black text-slate-900">
                        Rs. {(p.price || 0).toLocaleString()}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-50 text-red-700 border border-red-200">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-50 text-[#FF6500] border border-orange-200">
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            In Stock
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-orange-50 hover:text-[#FF6500] text-slate-600 transition-colors cursor-pointer"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 transition-colors cursor-pointer"
                            title="Delete Product"
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

        {/* Pagination Footer matching Screen 5 in reference mockup */}
        <div className="px-5 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-semibold">
          <div>
            Showing {totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{' '}
            {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }).map((_, i) => {
              const pNum = i + 1;
              const isActive = currentPage === pNum;
              return (
                <button
                  key={pNum}
                  onClick={() => setCurrentPage(pNum)}
                  className={`w-7 h-7 rounded-lg font-bold text-xs cursor-pointer ${
                    isActive
                      ? 'bg-[#FF6500] text-white shadow-xs'
                      : 'border border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {pNum}
                </button>
              );
            })}

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

      {/* Screen 6: Add / Edit Product Modal */}
      <Screen6AddEditProductModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProduct(null);
        }}
        productToEdit={editingProduct}
        store={store}
        currentUser={currentUser}
        onProductSaved={(prod) => {
          onProductUpdated(prod);
        }}
      />
    </div>
  );
};
