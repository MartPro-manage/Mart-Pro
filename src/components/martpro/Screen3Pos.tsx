import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  Camera, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  Tag, 
  ArrowRight, 
  RotateCcw, 
  Sparkles,
  Barcode as BarcodeIcon,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Product, Store, UserAccount, CartItem, Sale } from '../../types';
import { Screen4PaymentModal } from './Screen4PaymentModal';
import { playScanSuccessBeep } from '../../lib/sound';

interface Screen3PosProps {
  store: Store | null;
  currentUser: UserAccount | null;
  products: Product[];
  onSaleComplete: (sale: Sale) => void;
  onOpenScanner?: () => void;
}

export const Screen3Pos: React.FC<Screen3PosProps> = ({
  store,
  currentUser,
  products,
  onSaleComplete,
  onOpenScanner
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentQty, setCurrentQty] = useState<number>(1);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [barcodeScanInput, setBarcodeScanInput] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener (F1, F2, F4, F9)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (onOpenScanner) onOpenScanner();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setCurrentQty(prev => (prev < 10 ? prev + 1 : 1));
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0) setIsPaymentOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, onOpenScanner]);

  // Categories list directly matching mockup
  const categories = useMemo(() => {
    const defaultCats = ['All', 'Groceries', 'Beverages', 'Snacks', 'Household', 'Personal Care', 'Dairy', 'Bakery'];
    return defaultCats;
  }, []);

  // Filter products by search & category
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = selectedCategory === 'All' || 
        (p.category && p.category.toLowerCase().includes(selectedCategory.toLowerCase())) ||
        (selectedCategory === 'Groceries' && (p.category?.toLowerCase().includes('grocery') || p.category?.toLowerCase().includes('sauce')));

      const matchSearch = !searchQuery.trim() || 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.shortcutCode?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Add product to cart with the currently selected quantity
  const handleAddToCart = (product: Product, qtyToAdd = currentQty) => {
    playScanSuccessBeep();
    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.product.id === product.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const newQty = updated[existingIdx].quantity + qtyToAdd;
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: newQty,
          totalPrice: newQty * product.price
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            product,
            quantity: qtyToAdd,
            totalPrice: qtyToAdd * product.price
          }
        ];
      }
    });
    // Reset quantity to 1 after adding
    setCurrentQty(1);
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart(prev => {
      return prev
        .map(item => {
          if (item.product.id === productId) {
            const nextQty = Math.max(0, item.quantity + delta);
            return {
              ...item,
              quantity: nextQty,
              totalPrice: nextQty * item.product.price
            };
          }
          return item;
        })
        .filter(item => item.quantity > 0);
    });
  };

  const removeCartItem = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (confirm('Are you sure you want to clear the entire cart?')) {
      setCart([]);
      setDiscountAmount(0);
    }
  };

  // Cart Subtotal & Total
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.totalPrice || (item.product.price * item.quantity)), 0);
  }, [cart]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  const totalItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Barcode enter support
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeScanInput.trim();
    if (!code) return;

    const matched = products.find(p => p.barcode === code || p.shortcutCode === code);
    if (matched) {
      handleAddToCart(matched, 1);
      setBarcodeScanInput('');
    } else {
      alert(`Product with barcode ${code} not found in inventory.`);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-[#F8F9FA] select-none">
      {/* LEFT/CENTER PRODUCT CATALOG SECTION */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200 overflow-hidden">
        {/* Top Header matching Screen 3 in mockup */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-200/90 flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-black text-[#111111] tracking-tight flex items-center gap-2">
              <span>New Sale</span>
              <span className="px-2 py-0.5 rounded-full bg-orange-100 text-[#FF6500] text-[10px] font-extrabold uppercase">
                Customer-Free
              </span>
            </h1>

            {/* Keyboard Shortcuts Chips matching mockup */}
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
              <span className="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200">
                F1 - Search
              </span>
              <span className="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200">
                F2 - Scan
              </span>
              <span className="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200">
                F4 - Quantity
              </span>
              <span className="px-2 py-1 rounded-lg bg-orange-100 text-[#FF6500] border border-orange-200">
                F9 - Checkout
              </span>
            </div>
          </div>

          {/* Search bar & Barcode quick trigger */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name or barcode (F1)..."
                className="w-full bg-[#F8F9FA] focus:bg-white text-xs sm:text-sm font-semibold text-slate-900 pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500] focus:ring-2 focus:ring-[#FF6500]/15 transition-all"
              />
            </div>

            {/* Camera Barcode Scanner Trigger */}
            <button
              onClick={onOpenScanner}
              title="Scan Barcode via Camera (F2)"
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-orange-50 hover:text-[#FF6500] text-slate-700 border border-slate-200 font-bold transition-colors cursor-pointer shrink-0"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* Category Filter Pills matching mockup */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none [scrollbar-width:none]">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[#FF6500] text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Grid matching Screen 3 in reference mockup */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
          {filteredProducts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <Search className="w-10 h-10 mb-2 opacity-40" />
              <p className="font-bold text-sm text-slate-600">No products found</p>
              <p className="text-xs text-slate-400 mt-1">Try another search keyword or category.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-6 gap-3.5">
              {filteredProducts.map((p) => {
                const inCart = cart.find(c => c.product.id === p.id);
                const isLow = (p.stockQuantity || 0) <= (p.reorderLevel || 5);
                return (
                  <div
                    key={p.id}
                    onClick={() => handleAddToCart(p)}
                    className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-[#FF6500]/50 transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                  >
                    {/* In-cart badge */}
                    {inCart && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#FF6500] text-white font-extrabold text-[11px] flex items-center justify-center shadow-xs z-10">
                        {inCart.quantity}
                      </div>
                    )}

                    {/* Image / Thumbnail Container */}
                    <div className="w-full aspect-square rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden mb-2 relative group-hover:scale-[1.02] transition-transform">
                      {p.imageUrl ? (
                        <img 
                          src={p.imageUrl} 
                          alt={p.name} 
                          className="w-full h-full object-contain p-2" 
                          loading="lazy"
                        />
                      ) : (
                        <div className="text-3xl">🛒</div>
                      )}
                    </div>

                    {/* Product Name & Details */}
                    <div>
                      <div className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-[#FF6500] transition-colors">
                        {p.name}
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-sm font-black text-slate-900">
                          Rs. {p.price.toLocaleString()}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          isLow ? 'bg-orange-100 text-[#FF6500]' : 'text-slate-400'
                        }`}>
                          {p.stockQuantity || 0} in stock
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* BOTTOM ACTION BAR matching Screen 3 in reference mockup */}
        <div className="h-16 bg-white border-t border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              QTY:
            </span>
            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setCurrentQty(prev => Math.max(1, prev - 1))}
                className="w-7 h-7 rounded-lg bg-white text-slate-700 hover:text-black font-extrabold text-sm flex items-center justify-center shadow-2xs cursor-pointer"
              >
                -
              </button>
              <span className="w-9 text-center font-black text-sm text-slate-900">
                {currentQty}
              </span>
              <button
                type="button"
                onClick={() => setCurrentQty(prev => prev + 1)}
                className="w-7 h-7 rounded-lg bg-white text-slate-700 hover:text-black font-extrabold text-sm flex items-center justify-center shadow-2xs cursor-pointer"
              >
                +
              </button>
            </div>

            {/* Quick Multiplier Buttons */}
            <div className="hidden sm:flex items-center gap-1 pl-2">
              {[1, 2, 3, 5, 10].map(n => (
                <button
                  key={n}
                  onClick={() => setCurrentQty(n)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    currentQty === n 
                      ? 'bg-[#FF6500] text-white' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClearCart}
              disabled={cart.length === 0}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
            >
              Clear
            </button>

            <button
              onClick={() => {
                if (cart.length > 0) setIsPaymentOpen(true);
              }}
              disabled={cart.length === 0}
              className="px-5 py-2.5 rounded-xl bg-[#FF6500] hover:bg-[#e65b00] text-white text-xs font-black shadow-md shadow-[#FF6500]/25 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-40"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Checkout ({totalItemsCount}) &rarr;</span>
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE CART PANEL */}
      <div className="w-full lg:w-96 bg-white flex flex-col shrink-0 border-t lg:border-t-0 border-slate-200 h-80 lg:h-full">
        {/* Cart Header */}
        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-[#FF6500]" />
            <h2 className="text-sm font-black text-[#111111] uppercase tracking-wider">
              Current Cart
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-extrabold">
              {totalItemsCount}
            </span>
          </div>
          <span className="text-xs font-bold text-slate-400">
            Bill #S-1025
          </span>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <ShoppingCart className="w-12 h-12 mb-2 stroke-1 opacity-40 text-slate-400" />
              <p className="text-xs font-bold text-slate-600">Cart is empty</p>
              <p className="text-[11px] text-slate-400 mt-1">Click any product from the catalog to start sale.</p>
            </div>
          ) : (
            cart.map((item) => (
              <div 
                key={item.product.id}
                className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 truncate">
                    {item.product.name}
                  </div>
                  <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                    Rs. {item.product.price} &times; {item.quantity} = <span className="text-slate-900 font-black">Rs. {(item.totalPrice || item.product.price * item.quantity).toLocaleString()}</span>
                  </div>
                </div>

                {/* Qty increment/decrement */}
                <div className="flex items-center bg-white rounded-xl p-1 border border-slate-200 shrink-0">
                  <button
                    onClick={() => updateCartQty(item.product.id, -1)}
                    className="w-5 h-5 rounded-md hover:bg-slate-100 flex items-center justify-center font-bold text-slate-600 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-7 text-center font-black text-xs text-slate-900">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateCartQty(item.product.id, 1)}
                    className="w-5 h-5 rounded-md hover:bg-slate-100 flex items-center justify-center font-bold text-slate-600 cursor-pointer"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => removeCartItem(item.product.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Cart Footer Summary & Checkout */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 space-y-3">
          <div className="space-y-1.5 text-xs font-semibold text-slate-600">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span className="text-slate-900 font-bold">Rs. {subtotal.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Discount</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={discountAmount || ''}
                  onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0"
                  className="w-16 bg-white px-2 py-0.5 text-right font-bold rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-[#FF6500]"
                />
              </div>
            </div>
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm">
              <span className="font-black text-slate-900">Total</span>
              <span className="text-xl font-black text-[#FF6500]">
                Rs. {total.toLocaleString()}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPaymentOpen(true)}
            disabled={cart.length === 0}
            className="w-full py-3.5 px-4 rounded-xl bg-[#FF6500] hover:bg-[#e65b00] active:scale-[0.98] text-white font-black text-sm shadow-lg shadow-[#FF6500]/25 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <span>Proceed to Payment (F9)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Screen 4: Payment Modal */}
      <Screen4PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        cart={cart}
        store={store}
        currentUser={currentUser}
        discountAmount={discountAmount}
        onSaleComplete={(sale) => {
          onSaleComplete(sale);
          setCart([]);
          setDiscountAmount(0);
          setIsPaymentOpen(false);
        }}
      />
    </div>
  );
};
