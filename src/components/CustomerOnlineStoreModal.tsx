import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  Search, 
  X, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle2, 
  Truck, 
  Store as StoreIcon, 
  Phone, 
  MapPin, 
  User, 
  CreditCard, 
  Banknote, 
  ShieldCheck, 
  ArrowRight,
  Package,
  Sparkles,
  ExternalLink,
  Clock
} from 'lucide-react';
import { Store, Product, OnlineOrder, OnlineOrderItem } from '../types';
import { db, collection, doc, setDoc } from '../lib/firebase';
import { getEffectiveProductPrice, getProductDiscountInfo } from '../utils/discountUtils';
import { playScanSuccessBeep } from '../lib/sound';

interface CustomerOnlineStoreModalProps {
  store: Store;
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

export const CustomerOnlineStoreModal: React.FC<CustomerOnlineStoreModalProps> = ({
  store,
  isOpen,
  onClose,
  products
}) => {
  const [cart, setCart] = useState<{ [productId: string]: { product: Product; quantity: number } }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<OnlineOrder | null>(null);

  // Checkout Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [city, setCity] = useState('');
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online' | 'card'>('cod');
  const [paymentProvider, setPaymentProvider] = useState('EasyPaisa');
  const [transactionId, setTransactionId] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return ['All', ...Array.from(set).sort()];
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    let list = products.filter(p => (p.stockQuantity || 0) > 0);
    if (selectedCategory !== 'All') {
      list = list.filter(p => p.category === selectedCategory);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q));
    }
    return list;
  }, [products, selectedCategory, searchTerm]);

  // Cart calculations
  const cartItemsArray = useMemo(() => {
    return Object.values(cart);
  }, [cart]);

  const totalCartUnits = useMemo(() => {
    return cartItemsArray.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItemsArray]);

  const subtotalAmount = useMemo(() => {
    return cartItemsArray.reduce((sum, item) => {
      const effectivePrice = getEffectiveProductPrice(item.product);
      return sum + (effectivePrice * item.quantity);
    }, 0);
  }, [cartItemsArray]);

  const deliveryFee = useMemo(() => {
    if (deliveryType === 'pickup') return 0;
    return subtotalAmount >= 2000 ? 0 : 150; // Free delivery over Rs. 2000
  }, [subtotalAmount, deliveryType]);

  const totalAmount = useMemo(() => {
    return subtotalAmount + deliveryFee;
  }, [subtotalAmount, deliveryFee]);

  const handleAddToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev[product.id];
      const currentQty = existing ? existing.quantity : 0;
      const maxStock = product.stockQuantity || 999;
      if (currentQty >= maxStock) return prev; // Cannot exceed stock

      return {
        ...prev,
        [product.id]: {
          product,
          quantity: currentQty + 1
        }
      };
    });
    playScanSuccessBeep();
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      const existing = prev[productId];
      if (!existing) return prev;
      const newQty = existing.quantity + delta;
      if (newQty <= 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      const maxStock = existing.product.stockQuantity || 999;
      if (newQty > maxStock) return prev;

      return {
        ...prev,
        [productId]: {
          ...existing,
          quantity: newQty
        }
      };
    });
  };

  const handleRemoveItem = (productId: string) => {
    setCart(prev => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim() || (deliveryType === 'delivery' && !deliveryAddress.trim())) {
      alert('Please fill in all required customer name, phone, and delivery address fields.');
      return;
    }

    if (cartItemsArray.length === 0) {
      alert('Your shopping cart is empty.');
      return;
    }

    setIsSubmitting(true);
    try {
      const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const orderNumber = `HAM-${Math.floor(100000 + Math.random() * 900000)}`;

      const orderItems: OnlineOrderItem[] = cartItemsArray.map(item => {
        const price = getEffectiveProductPrice(item.product);
        return {
          productId: item.product.id,
          name: item.product.name,
          barcode: item.product.barcode,
          price,
          quantity: item.quantity,
          total: price * item.quantity,
          imageUrl: item.product.imageUrl,
          unitType: item.product.unitType || 'piece'
        };
      });

      const newOrder: OnlineOrder = {
        id: orderId,
        storeId: store.id,
        orderNumber,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: deliveryAddress.trim() || 'Store Pickup',
        city: city.trim() || 'Main City',
        deliveryType,
        paymentMethod,
        paymentProvider: paymentMethod === 'online' ? paymentProvider : undefined,
        transactionId: transactionId.trim() || undefined,
        items: orderItems,
        subtotalAmount,
        deliveryFee,
        totalAmount,
        status: 'pending',
        notes: orderNotes.trim() || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save to Firestore 'online_orders'
      await setDoc(doc(db, 'online_orders', orderId), newOrder);

      setPlacedOrder(newOrder);
      setCart({});
      setIsCheckoutOpen(false);
      setIsCartOpen(false);
      playScanSuccessBeep();
    } catch (err) {
      console.error('Failed to place online order:', err);
      alert('Failed to place order. Please check your network connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex flex-col">
      {/* Top Store Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white px-4 lg:px-8 py-3.5 flex items-center justify-between shrink-0 sticky top-0 z-20 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-md">
            <StoreIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-tight">{store.name} — Online E-Shop</h1>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                Online Store Active
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {store.address || 'Order fresh groceries & household items online for doorstep delivery'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Cart Button */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Cart</span>
            {totalCartUnits > 0 && (
              <span className="absolute -top-2 -right-2 w-6 h-6 bg-amber-400 text-slate-950 rounded-full text-xs font-black flex items-center justify-center shadow-md animate-bounce">
                {totalCartUnits}
              </span>
            )}
          </button>

          {/* Close E-Shop */}
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Close E-Shop"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main E-Shop Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 flex flex-col gap-6 overflow-y-auto">

        {/* Success Order Confirmation Modal / View */}
        <AnimatePresence>
          {placedOrder && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 lg:p-8 text-white shadow-2xl space-y-6 max-w-2xl mx-auto w-full my-auto"
            >
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-white">Order Placed Successfully!</h2>
                <p className="text-sm text-slate-300">
                  Thank you for shopping with <span className="font-bold text-orange-400">{store.name}</span>. Your order has been sent to the store admin dashboard.
                </p>
                <div className="inline-block bg-slate-800 border border-slate-700 px-4 py-2 rounded-2xl">
                  <span className="text-xs text-slate-400 uppercase tracking-wider block">Order Tracking Number</span>
                  <span className="text-lg font-mono font-black text-emerald-400">{placedOrder.orderNumber}</span>
                </div>
              </div>

              <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800 space-y-3 text-xs">
                <div className="flex justify-between font-bold text-slate-300">
                  <span>Customer:</span>
                  <span className="text-white">{placedOrder.customerName} ({placedOrder.customerPhone})</span>
                </div>
                <div className="flex justify-between font-bold text-slate-300">
                  <span>Delivery Type:</span>
                  <span className="text-white capitalize">{placedOrder.deliveryType === 'delivery' ? 'Home Delivery' : 'Store Pickup'}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-300">
                  <span>Delivery Address:</span>
                  <span className="text-white text-right max-w-[240px] truncate">{placedOrder.deliveryAddress}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-300">
                  <span>Payment Method:</span>
                  <span className="text-white uppercase">{placedOrder.paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : `Online (${placedOrder.paymentProvider})`}</span>
                </div>
                <div className="border-t border-slate-800 pt-2 flex justify-between font-black text-sm text-orange-400">
                  <span>Total Payable:</span>
                  <span>{store.currencySymbol || 'Rs.'} {placedOrder.totalAmount.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setPlacedOrder(null)}
                  className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-colors cursor-pointer text-sm shadow-md"
                >
                  Continue Shopping
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition-colors cursor-pointer text-sm"
                >
                  Close Store
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!placedOrder && (
          <>
            {/* Search & Category Filter Bar */}
            <div className="flex flex-col md:flex-row items-center gap-4 justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm">
              {/* Search input */}
              <div className="relative w-full md:w-96">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="Search groceries, fruits, milk, snacks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Category horizontal scroll */}
              <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-orange-600 text-white shadow-md'
                        : 'bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Catalog Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map((p) => {
                const discountInfo = getProductDiscountInfo(p);
                const effectivePrice = discountInfo.effectivePrice;
                const inCart = cart[p.id];

                return (
                  <div
                    key={p.id}
                    className="bg-slate-900 border border-slate-800 hover:border-orange-500/50 rounded-2xl p-4 flex flex-col justify-between transition-all shadow-md group relative overflow-hidden"
                  >
                    {/* Discount badge */}
                    {discountInfo.hasDiscount && (
                      <div className="absolute top-3 left-3 bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-md z-10 animate-pulse">
                        {p.discountType === 'percentage' ? `${p.discountValue}% OFF` : `Rs. ${p.discountValue} OFF`}
                      </div>
                    )}

                    {/* Product Image / Icon */}
                    <div className="w-full h-32 bg-slate-950 rounded-xl mb-3 flex items-center justify-center relative overflow-hidden group-hover:scale-[1.02] transition-transform">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-10 h-10 text-slate-700" />
                      )}
                      <span className="absolute bottom-2 right-2 text-[10px] bg-slate-900/90 text-slate-300 px-2 py-0.5 rounded-lg font-mono">
                        Stock: {p.stockQuantity} {p.unitType || 'pcs'}
                      </span>
                    </div>

                    {/* Product Info */}
                    <div className="space-y-1 mb-3">
                      <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">{p.category}</span>
                      <h3 className="text-sm font-bold text-white line-clamp-2 leading-snug">{p.name}</h3>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-base font-black text-emerald-400">
                          {store.currencySymbol || 'Rs.'} {effectivePrice.toLocaleString()}
                        </span>
                        {discountInfo.hasDiscount && (
                          <span className="text-xs text-slate-500 line-through font-mono">
                            {store.currencySymbol || 'Rs.'} {p.price.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Add to Cart Button */}
                    {inCart ? (
                      <div className="flex items-center justify-between bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                        <button
                          onClick={() => handleUpdateQuantity(p.id, -1)}
                          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-black text-white font-mono px-2">{inCart.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(p.id, 1)}
                          className="w-8 h-8 rounded-lg bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center font-bold cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAddToCart(p)}
                        className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" /> Add to Cart
                      </button>
                    )}
                  </div>
                );
              })}

              {filteredProducts.length === 0 && (
                <div className="col-span-full py-16 text-center space-y-3">
                  <Package className="w-12 h-12 text-slate-700 mx-auto" />
                  <p className="text-sm font-bold text-slate-400">No products found in this category.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Slide-over Cart / Checkout Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs" onClick={() => setIsCartOpen(false)} />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute inset-y-0 right-0 max-w-md w-full bg-slate-900 border-l border-slate-800 text-white flex flex-col shadow-2xl z-10"
            >
              {/* Drawer Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-orange-500" />
                  <h2 className="text-base font-black">Your Shopping Cart ({totalCartUnits})</h2>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!isCheckoutOpen ? (
                /* Cart Items List & Summary */
                <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    {cartItemsArray.map((item) => {
                      const effPrice = getEffectiveProductPrice(item.product);
                      return (
                        <div key={item.product.id} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center shrink-0 overflow-hidden">
                              {item.product.imageUrl ? (
                                <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-6 h-6 text-slate-700" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-white truncate">{item.product.name}</h4>
                              <p className="text-xs text-orange-400 font-mono">
                                {store.currencySymbol || 'Rs.'} {effPrice.toLocaleString()} each
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center bg-slate-900 rounded-xl border border-slate-800">
                              <button
                                onClick={() => handleUpdateQuantity(item.product.id, -1)}
                                className="w-7 h-7 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-black font-mono px-2 text-white">{item.quantity}</span>
                              <button
                                onClick={() => handleUpdateQuantity(item.product.id, 1)}
                                className="w-7 h-7 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <button
                              onClick={() => handleRemoveItem(item.product.id)}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20 cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {cartItemsArray.length === 0 && (
                      <div className="py-20 text-center space-y-3">
                        <ShoppingBag className="w-12 h-12 text-slate-700 mx-auto" />
                        <p className="text-sm font-bold text-slate-400">Your cart is currently empty.</p>
                      </div>
                    )}
                  </div>

                  {cartItemsArray.length > 0 && (
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 shrink-0">
                      <div className="flex justify-between text-xs text-slate-300">
                        <span>Subtotal:</span>
                        <span className="font-mono text-white">{store.currencySymbol || 'Rs.'} {subtotalAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-300">
                        <span>Delivery Fee:</span>
                        <span className="font-mono text-emerald-400">
                          {deliveryFee === 0 ? 'FREE' : `${store.currencySymbol || 'Rs.'} ${deliveryFee}`}
                        </span>
                      </div>
                      <div className="border-t border-slate-800 pt-2 flex justify-between text-sm font-black text-orange-400">
                        <span>Total Payable:</span>
                        <span className="font-mono">{store.currencySymbol || 'Rs.'} {totalAmount.toLocaleString()}</span>
                      </div>

                      <button
                        onClick={() => setIsCheckoutOpen(true)}
                        className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer text-xs shadow-md"
                      >
                        Proceed to Checkout <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Checkout Form */
                <form onSubmit={handlePlaceOrder} className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400">Delivery & Payment Details</h3>
                      <button
                        type="button"
                        onClick={() => setIsCheckoutOpen(false)}
                        className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                      >
                        ← Back to Cart
                      </button>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block text-slate-400 font-bold mb-1">Customer Full Name *</label>
                        <div className="relative">
                          <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                          <input
                            type="text"
                            required
                            placeholder="e.g. Muhammad Ali"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-400 font-bold mb-1">Phone Number *</label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                          <input
                            type="tel"
                            required
                            placeholder="e.g. 0300 1234567"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-400 font-bold mb-1">Delivery Type</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setDeliveryType('delivery')}
                            className={`py-2 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer ${
                              deliveryType === 'delivery'
                                ? 'bg-orange-600 text-white shadow-md'
                                : 'bg-slate-950 text-slate-400 border border-slate-800'
                            }`}
                          >
                            <Truck className="w-3.5 h-3.5" /> Home Delivery
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeliveryType('pickup')}
                            className={`py-2 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer ${
                              deliveryType === 'pickup'
                                ? 'bg-orange-600 text-white shadow-md'
                                : 'bg-slate-950 text-slate-400 border border-slate-800'
                            }`}
                          >
                            <StoreIcon className="w-3.5 h-3.5" /> Store Pickup
                          </button>
                        </div>
                      </div>

                      {deliveryType === 'delivery' && (
                        <div>
                          <label className="block text-slate-400 font-bold mb-1">Delivery Address *</label>
                          <div className="relative">
                            <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                            <textarea
                              required
                              rows={2}
                              placeholder="House #, Street name, Area, City"
                              value={deliveryAddress}
                              onChange={(e) => setDeliveryAddress(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500 resize-none"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-slate-400 font-bold mb-1">Payment Method</label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('cod')}
                            className={`py-2 rounded-xl font-bold flex flex-col items-center justify-center gap-1 cursor-pointer ${
                              paymentMethod === 'cod'
                                ? 'bg-orange-600 text-white shadow-md'
                                : 'bg-slate-950 text-slate-400 border border-slate-800'
                            }`}
                          >
                            <Banknote className="w-4 h-4" /> COD
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('online')}
                            className={`py-2 rounded-xl font-bold flex flex-col items-center justify-center gap-1 cursor-pointer ${
                              paymentMethod === 'online'
                                ? 'bg-orange-600 text-white shadow-md'
                                : 'bg-slate-950 text-slate-400 border border-slate-800'
                            }`}
                          >
                            <CreditCard className="w-4 h-4" /> Online Transfer
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('card')}
                            className={`py-2 rounded-xl font-bold flex flex-col items-center justify-center gap-1 cursor-pointer ${
                              paymentMethod === 'card'
                                ? 'bg-orange-600 text-white shadow-md'
                                : 'bg-slate-950 text-slate-400 border border-slate-800'
                            }`}
                          >
                            <ShieldCheck className="w-4 h-4" /> Card
                          </button>
                        </div>
                      </div>

                      {paymentMethod === 'online' && (
                        <div className="space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                          <label className="block text-slate-400 font-bold">Select Online Provider</label>
                          <select
                            value={paymentProvider}
                            onChange={(e) => setPaymentProvider(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                          >
                            <option value="EasyPaisa">EasyPaisa Mobile Account</option>
                            <option value="JazzCash">JazzCash Mobile Wallet</option>
                            <option value="SadaPay">SadaPay</option>
                            <option value="NayaPay">NayaPay</option>
                            <option value="Bank Transfer">Direct Bank Transfer</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Transaction ID / Receipt Reference # (optional)"
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white placeholder:text-slate-600"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 shrink-0">
                    <div className="flex justify-between text-xs font-bold text-orange-400">
                      <span>Total Amount:</span>
                      <span className="text-sm font-mono">{store.currencySymbol || 'Rs.'} {totalAmount.toLocaleString()}</span>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer text-xs shadow-md disabled:opacity-50"
                    >
                      {isSubmitting ? 'Placing Order...' : `Confirm & Place Order (${store.currencySymbol || 'Rs.'} ${totalAmount.toLocaleString()})`}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
