import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  db, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  setDoc, 
  updateDoc, 
  increment, 
  onSnapshot 
} from '../lib/firebase';
import { Store, Product, OnlineOrder, OnlineOrderItem } from '../types';
import { computeDiscountInfo } from '../utils/discountUtils';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  X, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Phone, 
  Truck, 
  Tag, 
  Sparkles, 
  Percent, 
  ArrowRight, 
  Store as StoreIcon, 
  AlertCircle, 
  ChevronRight, 
  Share2, 
  MessageCircle, 
  CreditCard, 
  Banknote, 
  ShieldCheck, 
  Check, 
  ArrowLeft,
  PackageCheck
} from 'lucide-react';

interface OnlineStorefrontProps {
  storeIdOrSlug?: string;
  onExit?: () => void;
}

interface CartEntry {
  product: Product;
  quantity: number;
}

export const OnlineStorefrontView: React.FC<OnlineStorefrontProps> = ({ 
  storeIdOrSlug = 'ha-mart', 
  onExit 
}) => {
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cart state
  const [cart, setCart] = useState<CartEntry[]>(() => {
    try {
      const saved = localStorage.getItem(`martpro_online_cart_${storeIdOrSlug}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // UI state
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Checkout form fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online_transfer' | 'easypaisa' | 'jazzcash'>('cod');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Placed Order Tracking state
  const [placedOrder, setPlacedOrder] = useState<OnlineOrder | null>(null);
  const [isTrackingLive, setIsTrackingLive] = useState(false);

  // Save cart to local storage
  useEffect(() => {
    try {
      localStorage.setItem(`martpro_online_cart_${storeIdOrSlug}`, JSON.stringify(cart));
    } catch (e) {
      console.warn(e);
    }
  }, [cart, storeIdOrSlug]);

  // Load store and products
  useEffect(() => {
    let unsubProducts: (() => void) | null = null;
    let unsubStore: (() => void) | null = null;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        const cleanSlug = (storeIdOrSlug || 'ha-mart').trim().toLowerCase();
        
        // 1. Find store by onlineStoreId or ID or Name
        let resolvedStore: Store | null = null;

        const q1 = query(collection(db, 'stores'), where('onlineStoreId', '==', cleanSlug));
        const s1 = await getDocs(q1);
        if (!s1.empty) {
          resolvedStore = { id: s1.docs[0].id, ...s1.docs[0].data() } as Store;
        } else {
          // Try by doc id
          const sRef = doc(db, 'stores', storeIdOrSlug.trim());
          const sSnap = await getDoc(sRef);
          if (sSnap.exists()) {
            resolvedStore = { id: sSnap.id, ...sSnap.data() } as Store;
          } else {
            // Try by name
            const allSnap = await getDocs(collection(db, 'stores'));
            for (const d of allSnap.docs) {
              const data = d.data();
              if ((data.name || '').toLowerCase() === cleanSlug || (data.name || '').toLowerCase().includes(cleanSlug)) {
                resolvedStore = { id: d.id, ...data } as Store;
                break;
              }
            }
          }
        }

        if (!resolvedStore) {
          setError(`Store "${storeIdOrSlug}" was not found. Please verify the store link.`);
          setLoading(false);
          return;
        }

        setStore(resolvedStore);

        // Listen for live store updates
        unsubStore = onSnapshot(doc(db, 'stores', resolvedStore.id), (docSnap) => {
          if (docSnap.exists()) {
            setStore({ id: docSnap.id, ...docSnap.data() } as Store);
          }
        });

        // Listen for live products catalog
        const pq = query(collection(db, 'products'), where('storeId', '==', resolvedStore.id));
        unsubProducts = onSnapshot(pq, (snapshot) => {
          const list: Product[] = [];
          snapshot.forEach(d => {
            list.push({ id: d.id, ...d.data() } as Product);
          });
          setProducts(list);
          setLoading(false);
        }, (err) => {
          console.error(err);
          setError('Failed to fetch store inventory.');
          setLoading(false);
        });

      } catch (err: any) {
        console.error(err);
        setError(err?.message || 'Error loading online store.');
        setLoading(false);
      }
    }

    init();

    return () => {
      if (unsubProducts) unsubProducts();
      if (unsubStore) unsubStore();
    };
  }, [storeIdOrSlug]);

  // Subscribe to live status of placed order
  useEffect(() => {
    if (!placedOrder?.id) return;
    const unsub = onSnapshot(doc(db, 'online_orders', placedOrder.id), (docSnap) => {
      if (docSnap.exists()) {
        setPlacedOrder({ id: docSnap.id, ...docSnap.data() } as OnlineOrder);
      }
    });
    return () => unsub();
  }, [placedOrder?.id]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return ['All', ...Array.from(set)];
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        p.name.toLowerCase().includes(q) || 
        (p.category && p.category.toLowerCase().includes(q)) || 
        (p.barcode && p.barcode.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Helper to compute effective unit price
  const getProductPricing = (p: Product) => {
    const regularPrice = Number(p.price) || 0;
    if (!p.discountActive || !p.discountValue || p.discountValue <= 0) {
      return {
        effectivePrice: regularPrice,
        regularPrice,
        hasDiscount: false,
        savings: 0,
        discountLabel: ''
      };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (p.discountStartDate && todayStr < p.discountStartDate) {
      return { effectivePrice: regularPrice, regularPrice, hasDiscount: false, savings: 0, discountLabel: '' };
    }
    if (p.discountEndDate && todayStr > p.discountEndDate) {
      return { effectivePrice: regularPrice, regularPrice, hasDiscount: false, savings: 0, discountLabel: '' };
    }

    let discountAmt = 0;
    let label = '';
    if (p.discountType === 'percentage') {
      discountAmt = (regularPrice * Number(p.discountValue)) / 100;
      label = `${p.discountValue}% OFF`;
    } else {
      discountAmt = Number(p.discountValue);
      label = `Rs. ${p.discountValue} OFF`;
    }

    const effective = Math.max(0, regularPrice - discountAmt);
    return {
      effectivePrice: effective,
      regularPrice,
      hasDiscount: true,
      savings: discountAmt,
      discountLabel: label
    };
  };

  // Cart operations
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.product.id === product.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        const maxStock = product.stockQuantity || 999;
        if (updated[existingIndex].quantity < maxStock) {
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + 1
          };
        }
        return updated;
      } else {
        return [...prev, { product, quantity: 1 }];
      }
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const maxStock = item.product.stockQuantity || 999;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          return {
            ...item,
            quantity: Math.min(nextQty, maxStock)
          };
        }
        return item;
      }).filter(Boolean) as CartEntry[];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Cart totals
  const { subtotal, originalSubtotal, totalDiscount, totalItemsCount } = useMemo(() => {
    let sub = 0;
    let orig = 0;
    let count = 0;

    cart.forEach(item => {
      const pricing = getProductPricing(item.product);
      sub += pricing.effectivePrice * item.quantity;
      orig += pricing.regularPrice * item.quantity;
      count += item.quantity;
    });

    return {
      subtotal: sub,
      originalSubtotal: orig,
      totalDiscount: Math.max(0, orig - sub),
      totalItemsCount: count
    };
  }, [cart]);

  const deliveryFee = store?.onlineStoreDeliveryFee ?? 150;
  const minOrder = store?.onlineStoreMinOrder ?? 500;
  const isMinOrderMet = subtotal >= minOrder;
  const grandTotal = subtotal + deliveryFee;

  // Submit Order to Mart Pro
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;
    if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim()) {
      alert('Please fill in your Name, Phone Number, and Delivery Address.');
      return;
    }
    if (!isMinOrderMet) {
      alert(`Minimum order requirement is Rs. ${minOrder}. Please add more items.`);
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `ORD-${randomSuffix}`;
      const orderId = `order_${Date.now()}_${randomSuffix}`;

      let totalCostOfGoods = 0;
      const orderItems: OnlineOrderItem[] = cart.map(entry => {
        const p = entry.product;
        const pricing = getProductPricing(p);
        const itemCost = Number(p.costPrice) || (pricing.effectivePrice * 0.8);
        totalCostOfGoods += itemCost * entry.quantity;

        return {
          productId: p.id,
          barcode: p.barcode || '',
          shortcutCode: p.shortcutCode || '',
          name: p.name,
          price: pricing.effectivePrice,
          originalPrice: pricing.regularPrice,
          costPrice: itemCost,
          quantity: entry.quantity,
          sellBy: p.sellBy || 'unit',
          unitType: p.unitType || 'piece',
          total: pricing.effectivePrice * entry.quantity,
          imageUrl: p.imageUrl || ''
        };
      });

      const netProfit = Math.round((subtotal - totalCostOfGoods) * 100) / 100;

      const orderPayload: OnlineOrder = {
        id: orderId,
        orderNumber,
        storeId: store.id,
        onlineStoreId: store.onlineStoreId || store.id,
        storeName: store.name,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        customerNotes: customerNotes.trim(),
        items: orderItems,
        subtotal,
        discountAmount: totalDiscount,
        deliveryFee,
        totalAmount: grandTotal,
        totalCost: Math.round(totalCostOfGoods * 100) / 100,
        netProfit,
        paymentMethod,
        paymentStatus: 'unpaid',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      // 1. Save order to Firestore
      await setDoc(doc(db, 'online_orders', orderId), orderPayload);

      // 2. Decrement product stock in inventory
      for (const entry of cart) {
        try {
          await updateDoc(doc(db, 'products', entry.product.id), {
            stockQuantity: increment(-entry.quantity)
          });
        } catch (stockErr) {
          console.warn('Could not decrement stock:', stockErr);
        }
      }

      // Success
      setPlacedOrder(orderPayload);
      setIsTrackingLive(true);
      setIsCheckoutOpen(false);
      setIsCartOpen(false);
      clearCart();

    } catch (err: any) {
      console.error(err);
      alert('Failed to place order: ' + err.message);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // WhatsApp share link generator
  const getWhatsAppShareUrl = () => {
    if (!placedOrder) return '#';
    const storePhone = store?.onlineStorePhone || store?.phone || '';
    const cleanPhone = storePhone.replace(/[^0-9]/g, '');

    const itemsText = placedOrder.items
      .map(i => `• ${i.name} (x${i.quantity}) - Rs. ${i.total}`)
      .join('\n');

    const message = `*NEW ONLINE ORDER - ${placedOrder.orderNumber}*\nStore: ${placedOrder.storeName}\n\n*Customer:* ${placedOrder.customerName}\n*Phone:* ${placedOrder.customerPhone}\n*Address:* ${placedOrder.customerAddress}\n\n*Items Ordered:*\n${itemsText}\n\n*Subtotal:* Rs. ${placedOrder.subtotal}\n*Delivery:* Rs. ${placedOrder.deliveryFee}\n*Total Payable:* Rs. ${placedOrder.totalAmount}\n*Payment Method:* ${placedOrder.paymentMethod.toUpperCase()}\n\nPlease confirm and prepare my delivery. Thank you!`;

    const encoded = encodeURIComponent(message);
    return cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  };

  if (loading) {
    return (
      <div className="h-screen w-full bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Connecting to {storeIdOrSlug}...</h2>
        <p className="text-sm text-slate-500 mt-1">Loading real-time catalog, live stock & active discount offers</p>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="h-screen w-full bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Store Not Found</h2>
        <p className="text-sm text-slate-600 max-w-md mb-6">{error || 'This store does not exist or has not enabled online shopping.'}</p>
        {onExit && (
          <button
            onClick={onExit}
            className="px-6 py-2.5 bg-orange-600 text-white font-bold rounded-xl shadow-md hover:bg-orange-500 cursor-pointer"
          >
            ← Return to Mart Pro
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Banner Notice */}
      {store.onlineStoreNotice && (
        <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 text-white px-4 py-2 text-center text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs">
          <Sparkles className="w-4 h-4 text-amber-200 shrink-0" />
          <span>{store.onlineStoreNotice}</span>
          {store.onlineStoreDeliveryFee !== undefined && (
            <span className="hidden sm:inline bg-black/20 px-2 py-0.5 rounded-full text-[11px]">
              Delivery: Rs. {store.onlineStoreDeliveryFee}
            </span>
          )}
        </div>
      )}

      {/* Main Header / Navigation */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
          {/* Brand Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-orange-500/20">
              {store.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-none">
                  {store.name}
                </h1>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Online Mart
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 truncate max-w-[200px] sm:max-w-md">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{store.address || 'Quality Supermarket Groceries'}</span>
              </p>
            </div>
          </div>

          {/* Right Header: Exit, Phone, Floating Cart Trigger */}
          <div className="flex items-center gap-2 sm:gap-3">
            {onExit && (
              <button
                onClick={onExit}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer hidden md:flex items-center gap-1.5"
                title="Return to Mart Pro Admin & POS"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Mart Pro
              </button>
            )}

            {store.phone && (
              <a
                href={`tel:${store.phone}`}
                className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
                title="Call store"
              >
                <Phone className="w-4 h-4 text-orange-600" />
                <span className="hidden sm:inline">{store.phone}</span>
              </a>
            )}

            {/* Shopping Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-sm flex items-center gap-2 shadow-lg shadow-orange-600/25 transition-all cursor-pointer hover:scale-105 active:scale-95"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">My Basket</span>
              <span className="font-mono bg-white text-orange-700 px-2 py-0.5 rounded-full text-xs font-black shadow-xs">
                {totalItemsCount}
              </span>
              {subtotal > 0 && (
                <span className="hidden md:inline font-mono font-bold text-xs bg-orange-700/60 px-2 py-0.5 rounded-lg">
                  Rs. {subtotal}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search & Category Pills Filter Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search in ${products.length} products (e.g. Milk, Rice, Oil, Tea)...`}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Horizontal Scroll Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none [scrollbar-width:none]">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                  selectedCategory === cat
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 w-full space-y-6">
        {/* Active Promotional Deals Banner */}
        {products.some(p => p.discountActive && (p.discountValue || 0) > 0) && (
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-2xl sm:rounded-3xl p-5 sm:p-7 text-white shadow-md relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1 relative z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-black uppercase tracking-wider">
                <Tag className="w-3.5 h-3.5 text-amber-200" /> Hot Store Offers Active
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Save Big with Daily Discounts & Promotional Prices!
              </h2>
              <p className="text-xs sm:text-sm text-white/90 font-medium max-w-xl">
                All promotional discounts are automatically applied at checkout. Look for the discount tags on selected supermarket products.
              </p>
            </div>
            <div className="flex items-center gap-3 relative z-10 shrink-0">
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 text-center">
                <span className="block text-[10px] font-bold uppercase text-white/80">Min Order</span>
                <span className="font-mono font-black text-sm sm:text-base">Rs. {minOrder}</span>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 text-center">
                <span className="block text-[10px] font-bold uppercase text-white/80">Delivery</span>
                <span className="font-mono font-black text-sm sm:text-base">Rs. {deliveryFee}</span>
              </div>
            </div>
          </div>
        )}

        {/* Products Grid Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <span>{selectedCategory === 'All' ? 'All Supermarket Products' : selectedCategory}</span>
              <span className="text-xs font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full">
                {filteredProducts.length}
              </span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Fresh stock direct from {store.name} warehouse
            </p>
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Search className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-slate-800">No products found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
              We couldn't find any items matching "{searchQuery}". Try searching for another item or choose a different category.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-800"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
            {filteredProducts.map((product) => {
              const pricing = getProductPricing(product);
              const inStock = (product.stockQuantity || 0) > 0;
              const cartItem = cart.find(c => c.product.id === product.id);
              const cartQty = cartItem?.quantity || 0;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 hover:border-orange-300 shadow-2xs hover:shadow-md transition-all flex flex-col overflow-hidden group"
                >
                  {/* Product Image & Badges */}
                  <div className="relative aspect-square bg-slate-100 overflow-hidden flex items-center justify-center">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-4 bg-gradient-to-br from-slate-50 to-slate-100">
                        <ShoppingBag className="w-10 h-10 opacity-30 mb-1" />
                        <span className="text-[10px] font-bold text-slate-400 text-center line-clamp-2">
                          {product.category || 'Grocery'}
                        </span>
                      </div>
                    )}

                    {/* Discount Badge */}
                    {pricing.hasDiscount && (
                      <div className="absolute top-2 left-2 bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-sm flex items-center gap-1">
                        <Percent className="w-3 h-3" />
                        <span>{pricing.discountLabel}</span>
                      </div>
                    )}

                    {/* Stock Alert Badge */}
                    <div className="absolute top-2 right-2">
                      {!inStock ? (
                        <span className="bg-red-600/90 backdrop-blur-xs text-white text-[9px] font-black px-2 py-0.5 rounded-md">
                          Out of Stock
                        </span>
                      ) : (product.stockQuantity || 0) <= 5 ? (
                        <span className="bg-amber-600/90 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                          {product.stockQuantity} left
                        </span>
                      ) : null}
                    </div>

                    {/* Weight / Unit badge */}
                    {product.unitType && (
                      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                        {product.sellBy === 'weight' ? 'Per kg' : product.unitType}
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between space-y-2 text-left">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                        {product.category}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 mt-0.5 leading-snug">
                        {product.name}
                      </h4>
                    </div>

                    {/* Pricing */}
                    <div className="pt-1">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-base sm:text-lg font-black text-slate-950 font-mono">
                          Rs. {pricing.effectivePrice}
                        </span>
                        {pricing.hasDiscount && (
                          <span className="text-xs text-slate-400 line-through font-mono">
                            Rs. {pricing.regularPrice}
                          </span>
                        )}
                      </div>
                      {pricing.hasDiscount && (
                        <p className="text-[10px] font-bold text-emerald-600">
                          Save Rs. {pricing.savings}
                        </p>
                      )}
                    </div>

                    {/* Quantity or Add to Cart Controls */}
                    <div className="pt-2">
                      {!inStock ? (
                        <button
                          disabled
                          className="w-full py-2 bg-slate-100 text-slate-400 font-bold rounded-xl text-xs cursor-not-allowed"
                        >
                          Out of Stock
                        </button>
                      ) : cartQty > 0 ? (
                        <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl p-1">
                          <button
                            onClick={() => updateCartQty(product.id, -1)}
                            className="w-7 h-7 rounded-lg bg-white text-orange-700 flex items-center justify-center font-bold hover:bg-orange-600 hover:text-white transition-colors cursor-pointer shadow-2xs"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono font-black text-xs sm:text-sm text-orange-950">
                            {cartQty}
                          </span>
                          <button
                            onClick={() => updateCartQty(product.id, 1)}
                            disabled={cartQty >= (product.stockQuantity || 999)}
                            className="w-7 h-7 rounded-lg bg-orange-600 text-white flex items-center justify-center font-bold hover:bg-orange-500 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(product)}
                          className="w-full py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-orange-600/20 cursor-pointer transition-all active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add to Basket
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar for Mobile */}
      {cart.length > 0 && !isCartOpen && (
        <div className="fixed bottom-4 left-4 right-4 sm:hidden z-30">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-slate-900 text-white rounded-2xl p-4 shadow-xl flex items-center justify-between cursor-pointer active:scale-98 transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center font-mono font-black text-xs text-white">
                {totalItemsCount}
              </div>
              <div className="text-left">
                <span className="block text-[11px] font-bold text-slate-400">Total Basket</span>
                <span className="block font-mono font-black text-sm text-white">
                  Rs. {subtotal}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-orange-400">
              <span>View Cart & Checkout</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* CART DRAWER / SIDEBAR */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute inset-y-0 right-0 max-w-full w-full sm:max-w-md bg-white shadow-2xl flex flex-col"
            >
              {/* Cart Drawer Header */}
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Your Shopping Basket</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'} from {store.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3 divide-y divide-slate-100">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <ShoppingBag className="w-8 h-8" />
                    </div>
                    <h4 className="text-base font-bold text-slate-800">Your basket is empty</h4>
                    <p className="text-xs text-slate-500 max-w-xs font-medium">
                      Explore our supermarket aisles and add fresh groceries, beverages, or household items.
                    </p>
                    <button
                      onClick={() => setIsCartOpen(false)}
                      className="px-5 py-2.5 bg-orange-600 text-white font-bold rounded-xl text-xs hover:bg-orange-500 cursor-pointer shadow-md"
                    >
                      Start Shopping
                    </button>
                  </div>
                ) : (
                  cart.map(({ product, quantity }) => {
                    const pricing = getProductPricing(product);
                    const lineTotal = pricing.effectivePrice * quantity;

                    return (
                      <div key={product.id} className="pt-3 first:pt-0 flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <ShoppingBag className="w-5 h-5" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h5 className="text-xs font-bold text-slate-900 truncate">{product.name}</h5>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-xs font-bold text-slate-800">
                              Rs. {pricing.effectivePrice}
                            </span>
                            {pricing.hasDiscount && (
                              <span className="font-mono text-[10px] text-slate-400 line-through">
                                Rs. {pricing.regularPrice}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quantity controls */}
                        <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1 shrink-0">
                          <button
                            onClick={() => updateCartQty(product.id, -1)}
                            className="w-6 h-6 rounded-lg bg-white text-slate-700 flex items-center justify-center font-bold hover:bg-slate-200 cursor-pointer shadow-2xs"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-mono font-bold text-xs px-1 text-slate-800">{quantity}</span>
                          <button
                            onClick={() => updateCartQty(product.id, 1)}
                            disabled={quantity >= (product.stockQuantity || 999)}
                            className="w-6 h-6 rounded-lg bg-orange-600 text-white flex items-center justify-center font-bold hover:bg-orange-500 cursor-pointer shadow-2xs disabled:opacity-50"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono font-black text-xs text-slate-950 block">
                            Rs. {lineTotal}
                          </span>
                          <button
                            onClick={() => removeFromCart(product.id)}
                            className="text-slate-400 hover:text-red-600 text-[10px] font-bold cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Cart Drawer Footer with Price Summary & Checkout Action */}
              {cart.length > 0 && (
                <div className="p-5 border-t border-slate-200 bg-slate-50 space-y-3">
                  {/* Min order check banner */}
                  {!isMinOrderMet && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Add <strong>Rs. {minOrder - subtotal}</strong> more to meet the minimum order of Rs. {minOrder}.
                      </span>
                    </div>
                  )}

                  {/* Price Breakdown */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Items Subtotal:</span>
                      <span className="font-mono font-bold">Rs. {subtotal}</span>
                    </div>

                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Promotional Savings:</span>
                        <span className="font-mono">-Rs. {totalDiscount}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-slate-600">
                      <span>Standard Delivery Fee:</span>
                      <span className="font-mono font-bold">Rs. {deliveryFee}</span>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex justify-between text-sm sm:text-base font-black text-slate-900">
                      <span>Total Amount:</span>
                      <span className="font-mono text-orange-700">Rs. {grandTotal}</span>
                    </div>
                  </div>

                  <button
                    disabled={!isMinOrderMet}
                    onClick={() => {
                      setIsCartOpen(false);
                      setIsCheckoutOpen(true);
                    }}
                    className="w-full py-3.5 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-300 text-white font-black rounded-2xl shadow-lg shadow-orange-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed text-sm"
                  >
                    <span>Proceed to Delivery & Checkout</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CHECKOUT MODAL */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 my-8"
            >
              {/* Checkout Header */}
              <div className="p-5 sm:p-6 bg-gradient-to-r from-orange-500 to-amber-600 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black tracking-tight">Complete Your Online Order</h3>
                  <p className="text-xs text-orange-100 font-medium">
                    Delivered directly from {store.name}
                  </p>
                </div>
                <button
                  onClick={() => setIsCheckoutOpen(false)}
                  className="p-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Checkout Form */}
              <form onSubmit={handlePlaceOrder} className="p-5 sm:p-6 space-y-4 text-left">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Muhammad Ali"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  />
                </div>

                {/* Phone / WhatsApp */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Phone / WhatsApp Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="e.g. 0300 1234567"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  />
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Store rider will contact you on this number for delivery coordinates.
                  </p>
                </div>

                {/* Delivery Address */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Complete Delivery Address *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="House / Flat #, Street, Block, Area landmark..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  />
                </div>

                {/* Special Instructions */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Delivery Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="e.g. Leave with security, call upon arrival"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  />
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Select Payment Method *
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      paymentMethod === 'cod' 
                        ? 'bg-orange-50 border-orange-500 text-orange-950 font-bold' 
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}>
                      <input
                        type="radio"
                        name="payment"
                        value="cod"
                        checked={paymentMethod === 'cod'}
                        onChange={() => setPaymentMethod('cod')}
                        className="accent-orange-600"
                      />
                      <Banknote className="w-4 h-4 text-emerald-600" />
                      <span>Cash on Delivery</span>
                    </label>

                    <label className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      paymentMethod === 'online_transfer' 
                        ? 'bg-orange-50 border-orange-500 text-orange-950 font-bold' 
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}>
                      <input
                        type="radio"
                        name="payment"
                        value="online_transfer"
                        checked={paymentMethod === 'online_transfer'}
                        onChange={() => setPaymentMethod('online_transfer')}
                        className="accent-orange-600"
                      />
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      <span>Bank / Online</span>
                    </label>

                    <label className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      paymentMethod === 'easypaisa' 
                        ? 'bg-orange-50 border-orange-500 text-orange-950 font-bold' 
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}>
                      <input
                        type="radio"
                        name="payment"
                        value="easypaisa"
                        checked={paymentMethod === 'easypaisa'}
                        onChange={() => setPaymentMethod('easypaisa')}
                        className="accent-orange-600"
                      />
                      <span>EasyPaisa</span>
                    </label>

                    <label className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      paymentMethod === 'jazzcash' 
                        ? 'bg-orange-50 border-orange-500 text-orange-950 font-bold' 
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}>
                      <input
                        type="radio"
                        name="payment"
                        value="jazzcash"
                        checked={paymentMethod === 'jazzcash'}
                        onChange={() => setPaymentMethod('jazzcash')}
                        className="accent-orange-600"
                      />
                      <span>JazzCash</span>
                    </label>
                  </div>
                </div>

                {/* Total Summary */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Items Total:</span>
                    <span className="font-mono font-bold">Rs. {subtotal}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Delivery Charge:</span>
                    <span className="font-mono font-bold">Rs. {deliveryFee}</span>
                  </div>
                  <div className="flex justify-between font-black text-slate-900 text-sm pt-1 border-t border-slate-200">
                    <span>Payable Total:</span>
                    <span className="font-mono text-orange-700">Rs. {grandTotal}</span>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmittingOrder}
                  className="w-full py-3.5 bg-orange-600 hover:bg-orange-500 text-white font-black rounded-2xl shadow-lg shadow-orange-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 text-sm"
                >
                  {isSubmittingOrder ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm & Place Order</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ORDER CONFIRMATION & LIVE TRACKING MODAL */}
      <AnimatePresence>
        {placedOrder && isTrackingLive && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 text-left my-8"
            >
              {/* Success Header */}
              <div className="p-6 bg-gradient-to-br from-emerald-600 to-teal-700 text-white text-center space-y-2">
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto text-white shadow-inner">
                  <Check className="w-8 h-8 stroke-[3]" />
                </div>
                <h3 className="text-xl font-black tracking-tight">Order Received at Mart Pro!</h3>
                <p className="text-xs text-emerald-100 font-medium">
                  Order <strong>#{placedOrder.orderNumber}</strong> has been transmitted directly into {placedOrder.storeName}'s system.
                </p>
              </div>

              {/* Order Status Stepper */}
              <div className="p-6 space-y-6">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Live Dispatch Status
                  </h4>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { key: 'pending', label: 'Received' },
                      { key: 'packing', label: 'Packing' },
                      { key: 'out_for_delivery', label: 'On Way' },
                      { key: 'delivered', label: 'Delivered' }
                    ].map((step, idx) => {
                      const statusHierarchy = ['pending', 'accepted', 'packing', 'out_for_delivery', 'delivered'];
                      const currentIdx = statusHierarchy.indexOf(placedOrder.status);
                      const stepIdx = statusHierarchy.indexOf(step.key);
                      const isComplete = currentIdx >= stepIdx;
                      const isCurrent = placedOrder.status === step.key || (placedOrder.status === 'accepted' && step.key === 'pending');

                      return (
                        <div key={step.key} className="space-y-1">
                          <div className={`h-2 rounded-full transition-all ${
                            isComplete ? 'bg-emerald-500' : 'bg-slate-200'
                          }`} />
                          <span className={`text-[10px] font-bold block ${
                            isCurrent ? 'text-emerald-700 font-black' : isComplete ? 'text-slate-800' : 'text-slate-400'
                          }`}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Order Details Card */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Order Number:</span>
                    <span className="font-mono font-black text-slate-900">{placedOrder.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Customer:</span>
                    <span className="font-bold text-slate-900">{placedOrder.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Delivery Address:</span>
                    <span className="font-medium text-slate-800 truncate max-w-[200px]">{placedOrder.customerAddress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Items:</span>
                    <span className="font-bold text-slate-800">{placedOrder.items.length} items</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200 text-sm">
                    <span>Total Amount (COD):</span>
                    <span className="font-mono text-orange-700">Rs. {placedOrder.totalAmount}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2.5">
                  <a
                    href={getWhatsAppShareUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Send Order to Store on WhatsApp</span>
                  </a>

                  <button
                    onClick={() => {
                      setIsTrackingLive(false);
                      setPlacedOrder(null);
                    }}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-colors"
                  >
                    Close & Continue Browsing
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <p className="font-medium">
          Powered by <strong className="text-slate-800">Mart Pro</strong> Online Store Engine • {store.name} Online Mart
        </p>
      </footer>
    </div>
  );
};
