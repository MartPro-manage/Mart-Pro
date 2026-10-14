import React, { useState, useMemo, useEffect } from 'react';
import { Product, Store } from '../types';
import * as XLSX from 'xlsx';
import { 
  X, 
  Search, 
  Download, 
  FileSpreadsheet,
  FileText,
  Hash, 
  Sparkles, 
  Plus, 
  Check, 
  Layers, 
  Barcode as BarcodeIcon,
  Keyboard,
  RefreshCw,
  Wand2,
  CheckCircle2,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { syncMissingShortcutCodesInFirestore } from '../utils/productShortcuts';
import { playScanSuccessBeep } from '../lib/sound';
import { generateProductShortcodesPdf } from '../lib/pdfGenerator';

interface ProductShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSelectProduct?: (product: Product) => void;
  store?: Store | { name?: string; address?: string; phone?: string; email?: string };
  storeName?: string;
}

export const ProductShortcutsModal: React.FC<ProductShortcutsModalProps> = ({
  isOpen,
  onClose,
  products,
  onSelectProduct,
  store,
  storeName
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Check how many products are missing a 4-digit shortcut code
  const missingCount = useMemo(() => {
    return products.filter(p => !p.shortcutCode || !/^\d{4}$/.test(p.shortcutCode)).length;
  }, [products]);

  // Auto-sync missing codes on opening if any products are missing
  useEffect(() => {
    if (isOpen && missingCount > 0 && !isSyncing) {
      handleSyncAllCodes(true);
    }
  }, [isOpen]);

  const handleSyncAllCodes = async (isAuto = false) => {
    setIsSyncing(true);
    try {
      const updated = await syncMissingShortcutCodesInFirestore(products);
      if (updated > 0) {
        playScanSuccessBeep();
        setSyncStatusMsg(`✨ Successfully assigned unique 4-digit shortcut keys to ${updated} product${updated > 1 ? 's' : ''}!`);
        setTimeout(() => setSyncStatusMsg(null), 4000);
      } else if (!isAuto) {
        setSyncStatusMsg('All products already have unique 4-digit shortcut codes.');
        setTimeout(() => setSyncStatusMsg(null), 3000);
      }
    } catch (e) {
      console.warn('Failed to sync shortcuts:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  // Filter products by search term and category
  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return products.filter(p => {
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!term) return true;
      const codeMatch = p.shortcutCode?.toLowerCase().includes(term);
      const nameMatch = p.name?.toLowerCase().includes(term);
      const barcodeMatch = p.barcode?.toLowerCase().includes(term);
      const catMatch = p.category?.toLowerCase().includes(term);
      return codeMatch || nameMatch || barcodeMatch || catMatch;
    });
  }, [products, searchTerm, selectedCategory]);

  // Export shortcuts list as PDF file
  const handleDownloadPdf = () => {
    const listToExport = filteredProducts.length > 0 ? filteredProducts : products;
    generateProductShortcodesPdf(
      listToExport, 
      store || (storeName ? { name: storeName } : undefined), 
      {
        filterCategory: selectedCategory !== 'all' ? selectedCategory : undefined,
        searchTerm: searchTerm.trim() || undefined
      }
    );
  };

  // Export shortcuts list as .xlsx spreadsheet (Product Name & Short Code only)
  const handleDownloadXlsx = () => {
    const listToExport = filteredProducts.length > 0 ? filteredProducts : products;
    const sorted = [...listToExport].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const data = sorted.map(p => ({
      'Product Name': p.name || '',
      'Short Code': p.shortcutCode || p.serialNumber || '----'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Product Shortcuts');

    // Auto-fit column widths for crisp reading
    worksheet['!cols'] = [
      { wch: 45 }, // Product Name
      { wch: 18 }  // Short Code
    ];

    const cleanStore = (store?.name || storeName || 'Store').replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(workbook, `${cleanStore}_Product_Shortcuts_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto overscroll-contain">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-y-auto overscroll-contain custom-scrollbar border border-slate-200 my-auto"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-orange-50/40 sticky top-0 bg-white z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-600/30">
              <Hash className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900">Product Shortcuts Directory</h2>
                <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 text-[11px] font-mono font-bold border border-orange-200">
                  S + K
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Type the 4-digit code anywhere at cashier checkout to instantly add item to cart
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleSyncAllCodes(false)}
              disabled={isSyncing}
              id="sync-shortcuts-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              title="Assign 4-digit shortcut codes to all products missing one"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-700" />
                  <span>Syncing...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-3.5 h-3.5 text-amber-700" />
                  <span>{missingCount > 0 ? `Assign (${missingCount} missing)` : 'Sync 4-Digit Codes'}</span>
                </>
              )}
            </button>

            {/* Download PDF Button */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              id="download-shortcuts-pdf-btn"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs transition-all cursor-pointer shadow-sm hover:shadow-md border border-red-500 active:scale-95"
              title="Download complete 4-digit product shortcuts directory as a printable PDF file"
            >
              <FileText className="w-4 h-4 text-white" />
              <span>Download PDF</span>
            </button>

            {/* Download Excel Button */}
            <button
              type="button"
              onClick={handleDownloadXlsx}
              id="download-shortcuts-xlsx-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-all cursor-pointer shadow-sm hover:shadow-md border border-emerald-500 active:scale-95"
              title="Download shortcuts list as .xlsx spreadsheet"
            >
              <FileSpreadsheet className="w-4 h-4 text-white" />
              <span className="hidden sm:inline">Download Excel</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sync Status Banner */}
        {syncStatusMsg && (
          <div className="bg-amber-100 border-b border-amber-200 px-4 py-2 text-xs font-bold text-amber-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{syncStatusMsg}</span>
          </div>
        )}

        {/* BIG PROMINENT SEARCH BAR & FILTERS SECTION */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-b from-orange-50/80 via-amber-50/20 to-white space-y-3.5">
          {/* Main Large Search Input */}
          <div className="relative flex items-center bg-white rounded-2xl border-2 border-orange-400/90 focus-within:border-orange-600 focus-within:ring-4 focus-within:ring-orange-500/25 shadow-md transition-all">
            <div className="pl-4 sm:pl-5 pr-2 flex items-center justify-center shrink-0">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-xs">
                <Search className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by 4-digit code (e.g. 1001), item name, or barcode..."
              className="w-full py-4 sm:py-4.5 pl-2 pr-28 sm:pr-40 text-base sm:text-xl font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none bg-transparent"
              autoFocus
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              )}
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-100 border border-orange-300 text-orange-800 text-xs font-black font-mono">
                <Hash className="w-3.5 h-3.5 text-orange-600" /> 4-Digit Code
              </span>
            </div>
          </div>

          {/* Quick Filter Categories & Results Counter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar text-xs">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap cursor-pointer transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                All Products ({products.length})
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                    selectedCategory === cat
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 shrink-0">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                Found <strong className="text-orange-600 font-black">{filteredProducts.length}</strong> {filteredProducts.length === 1 ? 'item' : 'items'}
              </span>
              {(searchTerm || selectedCategory !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategory('all');
                  }}
                  className="text-orange-600 hover:underline cursor-pointer text-xs"
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Shortcuts Grid / Table */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Search className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="font-bold text-slate-600 text-sm">No products found matching your search</p>
              <p className="text-xs text-slate-400 mt-1">Try a different 4-digit code or name</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {filteredProducts.map((product) => {
                const code = product.shortcutCode || '----';
                return (
                  <div
                    key={product.id}
                    className="p-3 rounded-xl border border-slate-200 hover:border-orange-300 hover:shadow-xs transition-all bg-white flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyCode(code)}
                          title="Click to copy shortcut code"
                          className="px-2.5 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 font-mono font-black text-xs sm:text-sm tracking-wider cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                        >
                          <Hash className="w-3 h-3 text-orange-600" />
                          <span>{code}</span>
                        </button>
                        <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[120px]">{product.category || 'General'}</span>
                      </div>
                      <p className="font-bold text-slate-800 text-xs sm:text-sm truncate mt-1" title={product.name}>
                        {product.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                        <span className="font-bold text-emerald-700">Rs. {Number(product.price || 0).toFixed(2)}</span>
                        <span>•</span>
                        <span className={product.stockQuantity <= 5 ? 'text-amber-600 font-bold' : ''}>
                          Stock: {product.stockQuantity || 0}
                        </span>
                      </div>
                    </div>

                    {onSelectProduct ? (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectProduct(product);
                          onClose();
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs cursor-pointer flex items-center gap-1 shadow-2xs shrink-0"
                        title="Add to active cart"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCopyCode(code)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer shrink-0"
                        title="Copy code"
                      >
                        {copiedCode === code ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">Copy</span>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-orange-600" />
            <span>Shortkeys: <strong>H+D</strong> Hold Bill • <strong>A+S</strong> Held Receipts • <strong>S+K</strong> Shortcuts</span>
          </div>
          <span className="font-bold text-slate-700">Showing {filteredProducts.length} items</span>
        </div>
      </motion.div>
    </div>
  );
};
