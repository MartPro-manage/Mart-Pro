import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  X, 
  Package, 
  Receipt, 
  Users, 
  Truck, 
  ArrowRight,
  Calculator,
  Command
} from 'lucide-react';
import { Product, Sale, Customer, SupplierProfile } from '../types';

interface UniversalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  sales: Sale[];
  customers: Customer[];
  suppliers: SupplierProfile[];
  onSelectProduct?: (product: Product) => void;
  onSelectSale?: (sale: Sale) => void;
  onSelectCustomer?: (customer: Customer) => void;
  onSelectSupplier?: (supplier: SupplierProfile) => void;
}

export const UniversalSearchModal: React.FC<UniversalSearchModalProps> = ({
  isOpen,
  onClose,
  products,
  sales,
  customers,
  suppliers,
  onSelectProduct,
  onSelectSale,
  onSelectCustomer,
  onSelectSupplier
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const trimmed = query.trim().toLowerCase();

  const matchingProducts = trimmed
    ? products.filter(p => 
        p.name.toLowerCase().includes(trimmed) || 
        p.barcode.toLowerCase().includes(trimmed) || 
        (p.shortcutCode && p.shortcutCode.toLowerCase().includes(trimmed)) ||
        p.category.toLowerCase().includes(trimmed)
      ).slice(0, 5)
    : [];

  const matchingSales = trimmed
    ? sales.filter(s => 
        (s.receiptNumber && s.receiptNumber.toLowerCase().includes(trimmed)) ||
        (s.id && s.id.toLowerCase().includes(trimmed)) ||
        s.items.some(item => item.name.toLowerCase().includes(trimmed))
      ).slice(0, 4)
    : [];

  const matchingCustomers = trimmed
    ? customers.filter(c => 
        c.name.toLowerCase().includes(trimmed) || 
        c.phone.toLowerCase().includes(trimmed) ||
        (c.email && c.email.toLowerCase().includes(trimmed))
      ).slice(0, 4)
    : [];

  const matchingSuppliers = trimmed
    ? suppliers.filter(s => 
        s.name.toLowerCase().includes(trimmed) || 
        s.phone.toLowerCase().includes(trimmed) ||
        (s.businessName && s.businessName.toLowerCase().includes(trimmed))
      ).slice(0, 4)
    : [];

  const hasResults = matchingProducts.length > 0 || matchingSales.length > 0 || matchingCustomers.length > 0 || matchingSuppliers.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
          <Search className="w-5 h-5 text-orange-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search products, barcodes, bills, customers, or suppliers..."
            className="w-full bg-transparent text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none font-medium"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-mono text-slate-400 bg-white border border-slate-200 rounded-md shadow-3xs">
            ESC
          </kbd>
        </div>

        {/* Search Results Container */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 max-h-[60vh]">
          {!trimmed && (
            <div className="py-12 text-center text-slate-400">
              <Command className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-500" />
              <p className="text-xs font-medium">Type a product title, barcode, receipt number, customer or supplier</p>
            </div>
          )}

          {trimmed && !hasResults && (
            <div className="py-12 text-center text-slate-400">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-500" />
              <p className="text-xs font-medium">No results found for "{query}"</p>
            </div>
          )}

          {/* Products Results */}
          {matchingProducts.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" /> Products ({matchingProducts.length})
              </div>
              <div className="space-y-1 mt-1">
                {matchingProducts.map(p => (
                  <div
                    key={p.id}
                    onClick={() => {
                      onSelectProduct?.(p);
                      onClose();
                    }}
                    className="p-2.5 rounded-xl hover:bg-orange-50 border border-transparent hover:border-orange-200/60 flex items-center justify-between gap-3 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 group-hover:text-orange-600 truncate">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          <span>BC: {p.barcode}</span>
                          <span className="mx-1">·</span>
                          <span>Stock: {p.stockQuantity}</span>
                          <span className="mx-1">·</span>
                          <span>{p.category}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-slate-900">Rs. {p.price.toFixed(2)}</div>
                      <span className="text-[10px] text-orange-600 font-semibold flex items-center gap-0.5 justify-end group-hover:translate-x-0.5 transition-transform">
                        View <ArrowRight className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sales Receipts Results */}
          {matchingSales.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5" /> Recent Sales ({matchingSales.length})
              </div>
              <div className="space-y-1 mt-1">
                {matchingSales.map(s => (
                  <div
                    key={s.id}
                    onClick={() => {
                      onSelectSale?.(s);
                      onClose();
                    }}
                    className="p-2.5 rounded-xl hover:bg-orange-50 border border-transparent hover:border-orange-200/60 flex items-center justify-between gap-3 cursor-pointer transition-all group"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 group-hover:text-orange-600 truncate">
                        Receipt #{s.receiptNumber || s.id.slice(0, 8)}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        <span>{s.items?.length || 0} items</span>
                        <span className="mx-1">·</span>
                        <span>{new Date(s.timestamp).toLocaleDateString()}</span>
                        <span className="mx-1">·</span>
                        <span className="capitalize">{s.paymentMethod}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-slate-900">Rs. {s.totalAmount.toFixed(2)}</div>
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        Paid
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customers Results */}
          {matchingCustomers.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Customers ({matchingCustomers.length})
              </div>
              <div className="space-y-1 mt-1">
                {matchingCustomers.map(c => (
                  <div
                    key={c.id}
                    onClick={() => {
                      onSelectCustomer?.(c);
                      onClose();
                    }}
                    className="p-2.5 rounded-xl hover:bg-orange-50 border border-transparent hover:border-orange-200/60 flex items-center justify-between gap-3 cursor-pointer transition-all group"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 group-hover:text-orange-600 truncate">
                        {c.name}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        <span>{c.phone}</span>
                        {c.email && <><span> · </span><span>{c.email}</span></>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-xs font-bold ${c.totalDue > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                        Due: Rs. {c.totalDue.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Mart Pro Universal Navigation</span>
          <span className="flex items-center gap-2">
            <span>Press <kbd className="px-1 bg-white border border-slate-200 rounded font-mono">ESC</kbd> to exit</span>
          </span>
        </div>
      </div>
    </div>
  );
};
