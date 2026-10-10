import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Store, Product } from '../types';
import { 
  X, 
  ShoppingBag, 
  Plus, 
  Minus, 
  Trash2, 
  Tag, 
  Truck, 
  Clock, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  Search, 
  ExternalLink,
  Code,
  Sparkles,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { getProductDiscountInfo } from '../utils/discountUtils';

interface OnlineStoreSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: Store;
  onOrderPlaced?: (orderId: string, orderNumber: string) => void;
}

interface CartEntry {
  product: any;
  quantity: number;
}

export const OnlineStoreSimulatorModal: React.FC<OnlineStoreSimulatorModalProps> = ({
  isOpen,
  onClose,
  store,
  onOrderPlaced
}) => {
  const [catalog, setCatalog] = useState<{
    store: any;
    products: any[];
    offers: any[];
    categories: string[];
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showOffersOnly, setShowOffersOnly] = useState<boolean>(false);

  // Cart State
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Checkout State
  const [customerName, setCustomerName] = useState('Ahmed Khan');
  const [customerPhone, setCustomerPhone] = useState('0300-1234567');
  const [customerEmail, setCustomerEmail] = useState('customer@example.com');
  const [deliveryAddress, setDeliveryAddress] = useState('House #14, Street 3, Sector G-9/2, Islamabad');
  const [deliveryNotes, setDeliveryNotes] = useState('Please call when arriving at the gate.');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online' | 'bank_transfer'>('cod');

  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderConfirmation, setOrderConfirmation] = useState<{
    orderNumber: string;
    totalAmount: number;
    message: string;
    orderId: string;
  } | null>(null);

  const onlineStoreId = store.onlineStoreId || store.specialStoreId || store.id;

  // Fetch live catalog when opened
  useEffect(() => {
    if (!isOpen) {
      setOrderConfirmation(null);
      return;
    }

    const fetchCatalog = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/online-stores/${encodeURIComponent(onlineStoreId)}/catalog`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load store catalog');
        }
        setCatalog(data);
      } catch (err: any) {
        console.error('Failed to load store catalog in simulator:', err);
        setError(err.message || 'Unable to connect to Online Store API');
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, [isOpen, onlineStoreId]);

  if (!isOpen) return null;

  // Add to Cart
  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  // Update Cart Qty
  const updateCartQty = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean) as CartEntry[];
    });
  };

  // Remove from Cart
  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  // Filter products
  const filteredProducts = (catalog?.products || []).filter(p => {
    if (selectedCategory !== 'All' && p.category?.toLowerCase() !== selectedCategory.toLowerCase()) {
      return false;
    }
    if (showOffersOnly && !p.hasDiscount) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.toLowerCase().includes(q));
    }
    return true;
  });

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + ((item.product.regularPrice || item.product.salePrice) * item.quantity), 0);
  const netProductsTotal = cart.reduce((sum, item) => sum + (item.product.salePrice * item.quantity), 0);
  const totalDiscount = Math.max(0, subtotal - netProductsTotal);
  const deliveryFee = store.onlineDeliveryFee ?? 100;
  const grandTotal = netProductsTotal + (cart.length > 0 ? deliveryFee : 0);
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Handle Order Submit via POST /api/online-stores/:onlineStoreId/orders
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setPlacingOrder(true);
    setError(null);

    try {
      const payload = {
        customerName,
        customerPhone,
        customerEmail,
        deliveryAddress,
        deliveryNotes,
        paymentMethod,
        items: cart.map(item => ({
          productId: item.product.id,
          barcode: item.product.barcode,
          name: item.product.name,
          quantity: item.quantity
        }))
      };

      const res = await fetch(`/api/online-stores/${encodeURIComponent(onlineStoreId)}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to place order.');
      }

      setOrderConfirmation({
        orderNumber: data.order?.orderNumber || data.orderNumber || 'ORD-SUCCESS',
        totalAmount: data.order?.totalAmount || grandTotal,
        message: data.message || 'Order placed successfully into Mart Pro!',
        orderId: data.order?.id || data.orderId || ''
      });

      setCart([]);
      setIsCartOpen(false);

      if (onOrderPlaced) {
        onOrderPlaced(data.order?.id || data.orderId || '', data.order?.orderNumber || data.orderNumber || '');
      }
    } catch (err: any) {
      console.error('Failed to submit order:', err);
      setError(err.message || 'Failed to submit online order.');
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-50 rounded-3xl w-full max-w-5xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Browser / Device Bar */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
            <span className="text-xs font-mono font-medium text-slate-400 ml-2 hidden sm:inline">
              Customer Webshop Simulator • <span className="text-emerald-400 font-bold">Live API Preview</span>
            </span>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-full border border-slate-700/60 max-w-xs sm:max-w-md truncate">
            <span className="text-[10px] font-mono font-bold text-slate-400">GET</span>
            <span className="text-xs font-mono text-emerald-300 truncate">
              /api/online-stores/{onlineStoreId}/catalog
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-16 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-700">Connecting to Online Store Catalog API...</p>
              <p className="text-xs text-slate-400">Loading products, stock quantities, and active offers for {store.name}</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center max-w-md mx-auto space-y-4">
              <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Online Store Unavailable</h3>
              <p className="text-xs text-slate-600 bg-rose-50 border border-rose-200 p-3 rounded-xl font-medium">
                {error}
              </p>
              <p className="text-xs text-slate-500">
                Ensure this store has an <strong>Online Store ID</strong> assigned and <strong>Online Shopping Enabled</strong> by Super Admin.
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                Close Simulator
              </button>
            </div>
          ) : orderConfirmation ? (
            /* Order Placed Success Confirmation */
            <div className="p-8 sm:p-12 text-center max-w-lg mx-auto space-y-6">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner animate-bounce">
                <CheckCircle2 className="w-12 h-12" />
              </div>

              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                  ORDER RECEIVED IN MART PRO!
                </span>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  Order #{orderConfirmation.orderNumber}
                </h3>
                <p className="text-xs text-slate-600">
                  {orderConfirmation.message}
                </p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 text-left space-y-3 shadow-xs font-mono text-xs">
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Store:</span>
                  <span className="font-bold text-slate-900">{store.name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-bold text-slate-900">{customerName} ({customerPhone})</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Delivery Address:</span>
                  <span className="font-bold text-slate-900 truncate max-w-[240px]">{deliveryAddress}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Payment:</span>
                  <span className="font-bold text-slate-900 uppercase">{paymentMethod}</span>
                </div>
                <div className="flex justify-between text-sm font-black pt-1">
                  <span className="text-slate-700">Total Net Amount:</span>
                  <span className="text-emerald-700">Rs. {orderConfirmation.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 font-medium text-left">
                💡 <strong>Mart Pro Real-Time Integration Verified:</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] text-indigo-700">
                  <li>Store inventory stock was automatically deducted.</li>
                  <li>Order was registered into Store Online Orders dispatch queue.</li>
                  <li>Sale was added to Total Revenue & Net Profit with separate channel tagging!</li>
                </ul>
              </div>

              <div className="flex items-center gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setOrderConfirmation(null);
                    setCart([]);
                  }}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Place Another Test Order
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Done & Close
                </button>
              </div>
            </div>
          ) : (
            /* Live Storefront Interface */
            <div className="space-y-6 pb-24">
              {/* Storefront Hero Header */}
              <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 text-white p-6 sm:p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-wider text-emerald-100 border border-white/20">
                        OFFICIAL ONLINE WEBSHOP
                      </span>
                      <span className="text-xs text-white/80 font-mono">
                        ID: {onlineStoreId}
                      </span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                      {store.name}
                    </h1>

                    <div className="flex items-center gap-4 text-xs text-emerald-100 flex-wrap">
                      {store.address && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{store.address}</span>
                        </div>
                      )}
                      {store.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />
                          <span>{store.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5" />
                        <span>Delivery Fee: Rs. {deliveryFee}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{store.onlineEstimatedDeliveryTime || '30-45 mins'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Cart Floating / Summary Button */}
                  <button
                    onClick={() => setIsCartOpen(!isCartOpen)}
                    className="self-start sm:self-center px-5 py-3 bg-white text-slate-900 rounded-2xl font-black text-sm shadow-xl hover:bg-emerald-50 transition-all flex items-center gap-3 cursor-pointer shrink-0 border border-white/50"
                  >
                    <div className="relative">
                      <ShoppingBag className="w-5 h-5 text-emerald-600" />
                      {totalItemsCount > 0 && (
                        <span className="absolute -top-2 -right-2 w-5 h-5 bg-rose-600 text-white rounded-full text-[10px] font-black flex items-center justify-center animate-pulse">
                          {totalItemsCount}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="text-left text-xs font-bold text-slate-500">Shopping Cart</div>
                      <div className="text-emerald-700 font-mono font-black text-sm">
                        Rs. {netProductsTotal.toFixed(2)}
                      </div>
                    </div>
                  </button>
                </div>

                {/* Announcement Bar */}
                {store.onlineStoreAnnouncement && (
                  <div className="mt-4 p-2.5 bg-black/20 backdrop-blur-md rounded-xl text-xs text-emerald-100 font-medium border border-white/10 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                    <span>{store.onlineStoreAnnouncement}</span>
                  </div>
                )}
              </div>

              {/* Active Promotional Offers Banner */}
              {catalog?.offers && catalog.offers.length > 0 && (
                <div className="px-4 sm:px-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
                        <Tag className="w-4 h-4" />
                      </div>
                      <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                        Today's Hot Deals & Offers ({catalog.offers.length})
                      </h2>
                    </div>
                    <button
                      onClick={() => setShowOffersOnly(!showOffersOnly)}
                      className={`text-xs font-bold px-3 py-1 rounded-lg border transition-colors cursor-pointer ${
                        showOffersOnly 
                          ? 'bg-rose-600 text-white border-rose-600' 
                          : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                      }`}
                    >
                      {showOffersOnly ? 'Showing Offers Only' : 'View All Offers'}
                    </button>
                  </div>

                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                    {catalog.offers.slice(0, 6).map((item) => (
                      <div
                        key={`offer-${item.id}`}
                        className="min-w-[220px] max-w-[240px] bg-white rounded-2xl border border-rose-200/80 p-3 shadow-xs hover:shadow-md transition-shadow shrink-0 flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="relative">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-full h-28 object-cover rounded-xl bg-slate-50"
                              />
                            ) : (
                              <div className="w-full h-28 bg-rose-50 rounded-xl flex items-center justify-center text-rose-400 font-bold text-lg">
                                {item.name.charAt(0)}
                              </div>
                            )}
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-sm">
                              {item.discountLabel || `SAVE Rs. ${item.discountAmount}`}
                            </span>
                          </div>

                          <div>
                            <div className="text-xs font-bold text-slate-900 truncate" title={item.name}>
                              {item.name}
                            </div>
                            <div className="flex items-baseline gap-2 mt-0.5">
                              <span className="text-sm font-black text-rose-600 font-mono">
                                Rs. {item.salePrice}
                              </span>
                              <span className="text-[11px] text-slate-400 line-through font-mono">
                                Rs. {item.regularPrice}
                              </span>
                            </div>
                            {item.offerExpiresOn && (
                              <div className="text-[10px] text-amber-700 font-medium mt-0.5">
                                Expires {item.offerExpiresOn}
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => addToCart(item)}
                          className="mt-3 w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Deal to Cart
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Catalog Search & Category Filters */}
              <div className="px-4 sm:px-6 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Search Box */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search online products, snacks, dairy, beverages..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="text-xs font-bold text-slate-500">
                    Showing <span className="text-slate-900 font-black">{filteredProducts.length}</span> items available online
                  </div>
                </div>

                {/* Categories Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  <button
                    onClick={() => setSelectedCategory('All')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                      selectedCategory === 'All'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    All Products
                  </button>
                  {(catalog?.categories || []).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Products Grid */}
              <div className="px-4 sm:px-6">
                {filteredProducts.length === 0 ? (
                  <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-500">
                    <ShoppingBag className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-800">No products found matching your filter.</p>
                    <p className="text-xs text-slate-500 mt-1">Try searching for other groceries or clearing your search filter.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                    {filteredProducts.map((p) => {
                      const inCart = cart.find(c => c.product.id === p.id);
                      return (
                        <div
                          key={p.id}
                          className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 flex flex-col justify-between shadow-2xs hover:shadow-md transition-shadow group"
                        >
                          <div className="space-y-2">
                            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-50 border border-slate-100">
                              {p.imageUrl ? (
                                <img
                                  src={p.imageUrl}
                                  alt={p.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-300 font-black text-3xl">
                                  {p.name.charAt(0)}
                                </div>
                              )}

                              {p.hasDiscount && (
                                <span className="absolute top-2 left-2 px-2 py-0.5 bg-rose-600 text-white font-black text-[10px] rounded-full shadow-xs">
                                  {p.discountLabel || 'OFFER'}
                                </span>
                              )}

                              <span className={`absolute bottom-2 right-2 px-2 py-0.5 rounded text-[9px] font-bold ${
                                p.stockQuantity > 0 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                {p.stockQuantity > 0 ? `${p.stockQuantity} in stock` : 'Out of Stock'}
                              </span>
                            </div>

                            <div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                {p.category || 'General'}
                              </div>
                              <h3 className="text-xs font-black text-slate-900 line-clamp-2 mt-0.5" title={p.name}>
                                {p.name}
                              </h3>
                              <div className="flex items-baseline gap-1.5 mt-1 font-mono">
                                <span className={`text-sm font-black ${p.hasDiscount ? 'text-rose-600' : 'text-slate-900'}`}>
                                  Rs. {p.salePrice}
                                </span>
                                {p.hasDiscount && (
                                  <span className="text-[10px] text-slate-400 line-through">
                                    Rs. {p.regularPrice}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 pt-2 border-t border-slate-100">
                            {inCart ? (
                              <div className="flex items-center justify-between bg-slate-100 rounded-xl p-1">
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(p.id, -1)}
                                  className="w-7 h-7 bg-white hover:bg-slate-200 text-slate-800 rounded-lg flex items-center justify-center shadow-2xs font-bold cursor-pointer"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="font-mono font-black text-xs text-slate-900 px-2">
                                  {inCart.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(p.id, 1)}
                                  className="w-7 h-7 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center shadow-2xs font-bold cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => addToCart(p)}
                                disabled={p.stockQuantity <= 0}
                                className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                  p.stockQuantity > 0 
                                    ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                }`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                                {p.stockQuantity > 0 ? 'Add to Cart' : 'Sold Out'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Slide-out / Bottom Cart & Checkout Drawer */}
        {isCartOpen && !orderConfirmation && (
          <div className="border-t border-slate-200 bg-white p-4 sm:p-6 shadow-2xl space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-black text-slate-900">
                  Customer Shopping Cart ({totalItemsCount} items)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {cart.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">Your cart is currently empty. Add products from the catalog above.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Items in Cart */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs font-medium"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-500 shrink-0">
                          {item.product.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate max-w-[180px]">{item.product.name}</div>
                          <div className="text-[11px] text-emerald-700 font-mono">
                            Rs. {item.product.salePrice} × {item.quantity} = Rs. {(item.product.salePrice * item.quantity).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.product.id, -1)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-600 font-bold"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-mono font-bold px-1">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.product.id, 1)}
                            className="p-1 hover:bg-slate-100 rounded text-emerald-600 font-bold"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.product.id)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Checkout Information Form */}
                <form onSubmit={handlePlaceOrder} className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>Customer Delivery Details</span>
                    <span className="text-[10px] font-normal text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                      Receives in Mart Pro
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Full Name</label>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Phone Number</label>
                      <input
                        type="text"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Delivery Address</label>
                    <input
                      type="text"
                      required
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Payment Method</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                      >
                        <option value="cod">Cash on Delivery (COD)</option>
                        <option value="online">Online Digital Payment</option>
                        <option value="bank_transfer">Direct Bank / Raast</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Delivery Notes</label>
                      <input
                        type="text"
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900"
                      />
                    </div>
                  </div>

                  {/* Financial Total Line */}
                  <div className="pt-2 border-t border-slate-200 space-y-1 font-mono">
                    <div className="flex justify-between text-slate-500">
                      <span>Items Subtotal:</span>
                      <span>Rs. {subtotal.toFixed(2)}</span>
                    </div>
                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-rose-600 font-bold">
                        <span>Offers Discount Saved:</span>
                        <span>-Rs. {totalDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-500">
                      <span>Delivery Fee:</span>
                      <span>Rs. {deliveryFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
                      <span>Grand Total:</span>
                      <span className="text-emerald-700">Rs. {grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={placingOrder}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {placingOrder ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Transmitting Order to Mart Pro API...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span>Place Online Order (Rs. {grandTotal.toFixed(2)})</span>
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Footer info bar */}
        <div className="bg-slate-100 border-t border-slate-200 px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <Code className="w-3.5 h-3.5 text-indigo-600" />
            <span>Developers can invoke this via: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-mono text-slate-800">POST /api/online-stores/{onlineStoreId}/orders</code></span>
          </div>

          {!isCartOpen && cart.length > 0 && (
            <button
              onClick={() => setIsCartOpen(true)}
              className="text-xs font-black text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
            >
              Checkout {totalItemsCount} items (Rs. {grandTotal.toFixed(2)}) →
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
