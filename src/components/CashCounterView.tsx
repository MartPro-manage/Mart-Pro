import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  runTransaction,
  handleFirestoreError,
  OperationType
} from '../lib/firebase';
import { Product, Store, UserAccount, CartItem, Sale, SaleItem } from '../types';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { ReceiptModal } from './ReceiptModal';
import { HardwarePermissionsBar } from './HardwarePermissionsBar';
import { CashPaymentModal } from './CashPaymentModal';
import { speakMessage } from '../lib/speech';
import { 
  Calculator, 
  Barcode as BarcodeIcon, 
  Camera, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Banknote, 
  CheckCircle2, 
  AlertCircle, 
  ShoppingBag, 
  Search, 
  Sparkles,
  RefreshCw,
  Volume2
} from 'lucide-react';

interface CashCounterViewProps {
  store: Store;
  currentUser: UserAccount;
}

export const CashCounterView: React.FC<CashCounterViewProps> = ({ store, currentUser }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // POS State
  const [barcodeInput, setBarcodeInput] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');
  const [searchTerm, setSearchTerm] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);

  // Notifications & Modals
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement | null>(null);

  // Auto focus barcode input for fast hardware USB barcode scanner support
  useEffect(() => {
    if (!isScannerOpen && !isReceiptOpen && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [isScannerOpen, isReceiptOpen]);

  // Catch physical barcode scanner typing if focus was accidentally blurred
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputActive = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
      if (!isInputActive && !isScannerOpen && !isReceiptOpen && barcodeInputRef.current) {
        if (e.key.length === 1 || e.key === 'Enter') {
          barcodeInputRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isScannerOpen, isReceiptOpen]);

  // Subscribe to products in real-time for this store
  useEffect(() => {
    if (!store?.id) return;

    const q = query(
      collection(db, 'products'),
      where('storeId', '==', store.id)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: Product[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Product);
      });
      setProducts(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'products');
    });

    return () => unsub();
  }, [store?.id]);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 5000);
  };

  // Add Product to Cart by Barcode or Serial Number
  const handleAddByBarcode = (targetBarcodeOrSerial: string) => {
    const trimmed = targetBarcodeOrSerial.trim().toLowerCase();
    if (!trimmed) return;

    // Look up product by Barcode OR Serial Number OR Name OR ID
    const found = products.find(
      p => (p.barcode && p.barcode.trim().toLowerCase() === trimmed) || 
           (p.serialNumber && p.serialNumber.trim().toLowerCase() === trimmed) ||
           p.name.trim().toLowerCase() === trimmed ||
           p.id === targetBarcodeOrSerial
    );

    if (!found) {
      showNotification('error', `No product found matching Barcode/Serial Number "${targetBarcodeOrSerial}". Please check or register it first.`);
      setBarcodeInput('');
      return;
    }

    if (found.stockQuantity <= 0) {
      showNotification('error', `"${found.name}" is OUT OF STOCK! (0 units available).`);
      setBarcodeInput('');
      return;
    }

    // Add or increment in cart
    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex(item => item.product.id === found.id);
      if (existingIdx >= 0) {
        const updated = [...prevCart];
        const currentQty = updated[existingIdx].quantity;
        if (currentQty + 1 > found.stockQuantity) {
          showNotification('error', `Cannot add more. Only ${found.stockQuantity} units available in stock!`);
          return prevCart;
        }
        const newQty = currentQty + 1;
        updated[existingIdx] = {
          ...updated[existingIdx],
          product: found, // update latest stock/price ref
          quantity: newQty,
          totalPrice: newQty * found.price
        };
        return updated;
      } else {
        return [
          ...prevCart,
          {
            product: found,
            quantity: 1,
            totalPrice: found.price
          }
        ];
      }
    });

    setBarcodeInput('');
  };

  // Add product from click
  const handleAddProductClick = (product: Product) => {
    handleAddByBarcode(product.barcode || product.serialNumber || product.name || product.id);
  };

  // Quantity Change Handler (COMPULSORY QUANTITY SELECTION)
  const handleUpdateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(productId);
      return;
    }

    const itemInCart = cart.find(c => c.product.id === productId);
    if (!itemInCart) return;

    // Fetch latest live product stock
    const liveProd = products.find(p => p.id === productId) || itemInCart.product;

    if (newQty > liveProd.stockQuantity) {
      showNotification('error', `Cannot set quantity to ${newQty}. Only ${liveProd.stockQuantity} units available in stock!`);
      return;
    }

    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          return {
            ...item,
            quantity: newQty,
            totalPrice: newQty * item.product.price
          };
        }
        return item;
      })
    );
  };

  // Remove Item
  const handleRemoveItem = (productId: string) => {
    setCart((prev) => prev.filter(c => c.product.id !== productId));
  };

  // Calculate Subtotal & Total
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [cart]);

  // Handle Checkout Process
  const handleCheckout = () => {
    if (cart.length === 0) {
      showNotification('error', 'Cart is empty. Please add products before checkout.');
      return;
    }

    // Verify all stock quantities before starting transaction
    for (const item of cart) {
      const liveProd = products.find(p => p.id === item.product.id);
      if (!liveProd || liveProd.stockQuantity < item.quantity) {
        showNotification(
          'error',
          `Insufficient stock for "${item.product.name}". Available: ${liveProd?.stockQuantity || 0}, Requested: ${item.quantity}`
        );
        return;
      }
    }

    if (paymentMethod === 'cash') {
      setIsCashModalOpen(true);
    } else {
      executeCheckoutSale(cartTotal, 0);
    }
  };

  const executeCheckoutSale = async (cashReceived?: number, changeReturned?: number) => {
    setCheckoutLoading(true);

    try {
      // Execute Firestore Atomic Transaction to decrement stock and create sale record
      const receiptNum = `RCP-${Date.now().toString().slice(-6)}`;
      const nowIso = new Date().toISOString();

      const saleItems: SaleItem[] = cart.map((item) => ({
        productId: item.product.id || '',
        barcode: item.product.barcode || '',
        serialNumber: item.product.serialNumber || '',
        name: item.product.name || '',
        price: item.product.price || 0,
        quantity: item.quantity || 1,
        total: item.totalPrice || 0
      }));

      const newSaleDocRef = doc(collection(db, 'sales'));

      await runTransaction(db, async (transaction) => {
        // 1. Verify and Decrement Stock for every item
        for (const item of cart) {
          const prodRef = doc(db, 'products', item.product.id);
          const prodSnap = await transaction.get(prodRef);

          if (!prodSnap.exists()) {
            throw new Error(`Product "${item.product.name}" no longer exists in database.`);
          }

          const currentStock = prodSnap.data().stockQuantity || 0;
          if (currentStock < item.quantity) {
            throw new Error(`Stock for "${item.product.name}" was reduced. Only ${currentStock} remaining.`);
          }

          transaction.update(prodRef, {
            stockQuantity: currentStock - item.quantity,
            updatedAt: nowIso
          });
        }

        // 2. Create Sale Record
        const saleRecord: Sale = {
          id: newSaleDocRef.id,
          storeId: store.id || '',
          storeName: store.name || '',
          counterId: currentUser.id || '',
          counterName: currentUser.name || (currentUser.counterNumber ? `Counter #${currentUser.counterNumber}` : 'Counter #1'),
          cashierUsername: currentUser.username || '',
          items: saleItems,
          totalAmount: cartTotal || 0,
          paymentMethod: paymentMethod || 'cash',
          cashReceived: paymentMethod === 'cash' ? (cashReceived ?? cartTotal) : undefined,
          changeReturned: paymentMethod === 'cash' ? (changeReturned ?? 0) : undefined,
          receiptNumber: receiptNum,
          timestamp: nowIso
        };

        transaction.set(newSaleDocRef, saleRecord);
      });

      // Construct sale object for receipt modal
      const completedSaleData: Sale = {
        id: newSaleDocRef.id,
        storeId: store.id,
        storeName: store.name,
        counterId: currentUser.id,
        counterName: currentUser.name || `Counter #${currentUser.counterNumber || '1'}`,
        cashierUsername: currentUser.username,
        items: saleItems,
        totalAmount: cartTotal,
        paymentMethod: paymentMethod,
        cashReceived: paymentMethod === 'cash' ? (cashReceived ?? cartTotal) : undefined,
        changeReturned: paymentMethod === 'cash' ? (changeReturned ?? 0) : undefined,
        receiptNumber: receiptNum,
        timestamp: nowIso
      };

      setIsCashModalOpen(false);
      setCompletedSale(completedSaleData);
      setIsReceiptOpen(true);
      setCart([]);
      
      // Voice & Text Thank You greeting for purchase according to store name
      const storeName = store.name || 'our store';
      if (voiceEnabled) {
        speakMessage(`Thank you for shopping at ${storeName}!`);
      }
      showNotification('success', `🎉 Thank you for shopping at ${storeName}! Transaction #${receiptNum} completed.`);

    } catch (err: any) {
      console.error('Checkout error:', err);
      showNotification('error', 'Checkout failed: ' + (err?.message || 'Check connection.'));
    } finally {
      setCheckoutLoading(false);
    }
  };

  const filteredQuickProducts = products.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.barcode.toLowerCase().includes(term) ||
      (p.serialNumber && p.serialNumber.toLowerCase().includes(term))
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Counter Top Bar */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
          <div className="flex items-center gap-3 z-10">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold">
              <Calculator className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  CASH COUNTER {currentUser.counterNumber ? `#${currentUser.counterNumber}` : ''}
                </span>
                <span className="text-xs text-slate-500 font-medium">{store.name}</span>
              </div>
              <h1 className="text-xl font-black text-slate-900 mt-1">
                Point of Sale <span className="text-orange-600">Billing Counter</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 z-10">
            <button
              onClick={() => setIsScannerOpen(true)}
              className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Camera className="w-4 h-4" /> Scan Camera Barcode
            </button>
          </div>
        </div>

        {/* Hardware Permissions & Audio Controls Bar */}
        <HardwarePermissionsBar 
          voiceEnabled={voiceEnabled} 
          onToggleVoice={setVoiceEnabled} 
        />

        {/* Global Notifications */}
        {msg && (
          <div className={`p-4 rounded-2xl border flex items-center gap-3 text-sm font-medium shadow-sm transition-all ${
            msg.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />}
            <span>{msg.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* LEFT 7 COLS: BARCODE INPUT & QUICK PRODUCT SELECTOR */}
          <div className="lg:col-span-7 space-y-6">

            {/* Barcode Scanner Input */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-2">
                  <BarcodeIcon className="w-4 h-4 text-orange-600" /> Barcode Reader / Manual Input
                </span>
                <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> USB & Wireless Scanner Ready
                </span>
              </label>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddByBarcode(barcodeInput);
                  if (barcodeInputRef.current) {
                    barcodeInputRef.current.focus();
                  }
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    autoFocus
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="text"
                    placeholder="Scan product barcode with hardware scanner or type code..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="w-full pl-4 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-base font-mono focus:outline-none focus:border-orange-500 focus:bg-white transition-all shadow-inner"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl shadow-sm transition-all cursor-pointer text-sm shrink-0 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              </form>
              <p className="text-[11px] text-slate-500 font-medium">
                💡 <span className="font-semibold text-slate-700">Hardware Barcode Scanner Support:</span> Point your handheld USB or Wireless Bluetooth scanner at any item barcode. It automatically scans, adds to cart, and prepares for the next item.
              </p>
            </div>

            {/* Quick Select Catalog Grid */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-orange-600" /> Quick Product Touch Selection
                </h2>

                <div className="relative min-w-[180px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search product..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-orange-500 font-medium"
                  />
                </div>
              </div>

              {filteredQuickProducts.length === 0 ? (
                <p className="text-xs text-slate-500 p-6 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50">
                  No products found. Scan a registered barcode or add stock via Product Register.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pr-1">
                  {filteredQuickProducts.map((p) => {
                    const isOut = p.stockQuantity <= 0;
                    return (
                      <button
                        key={p.id}
                        disabled={isOut}
                        onClick={() => handleAddProductClick(p)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-24 ${
                          isOut
                            ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed'
                            : 'bg-slate-50 border-slate-200 hover:border-orange-500 hover:bg-orange-50/50'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-900 text-xs truncate">{p.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">
                            {p.serialNumber ? `S/N: ${p.serialNumber}` : `BC: ${p.barcode}`}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <span className="font-extrabold text-orange-600 text-xs">₹{p.price.toFixed(2)}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isOut ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isOut ? 'OUT' : `${p.stockQuantity} in stock`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT 5 COLS: CART LIST, COMPULSORY QUANTITY & CHECKOUT */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6 flex flex-col justify-between">
            
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-orange-600" /> Active Cart List ({cart.length})
                </h2>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-xs text-red-600 hover:text-red-700 font-bold cursor-pointer"
                  >
                    Clear Cart
                  </button>
                )}
              </div>

              {/* CART ITEMS LIST WITH COMPULSORY QUANTITY SELECTOR */}
              {cart.length === 0 ? (
                <div className="p-10 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
                  <ShoppingBag className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">Cart is currently empty</p>
                  <p className="text-[11px] text-slate-500 font-medium">Scan product barcode to populate customer bill</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div key={item.product.id} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                      
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 text-xs truncate">{item.product.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          ₹{item.product.price.toFixed(2)} each • <span className="text-emerald-700 font-semibold">Max stock: {item.product.stockQuantity}</span>
                        </div>
                      </div>

                      {/* COMPULSORY QUANTITY CONTROLS */}
                      <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-1">
                        <button
                          onClick={() => handleUpdateQuantity(item.product.id, item.quantity - 1)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer text-xs font-bold"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        
                        <input
                          type="number"
                          min="1"
                          max={item.product.stockQuantity}
                          value={item.quantity}
                          onChange={(e) => handleUpdateQuantity(item.product.id, parseInt(e.target.value, 10) || 1)}
                          className="w-10 text-center bg-transparent text-slate-900 font-extrabold text-xs focus:outline-none"
                        />

                        <button
                          onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer text-xs font-bold"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-extrabold text-orange-600 text-xs">₹{item.totalPrice.toFixed(2)}</div>
                        <button
                          onClick={() => handleRemoveItem(item.product.id)}
                          className="text-slate-400 hover:text-red-600 text-[10px] cursor-pointer mt-0.5 font-semibold"
                        >
                          Remove
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PAYMENT METHOD & TOTAL SUMMARY */}
            <div className="pt-4 border-t border-slate-200 space-y-4">
              
              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Payment Method *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-3 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      paymentMethod === 'cash'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Banknote className="w-4 h-4" /> CASH PAYMENT
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('online')}
                    className={`py-3 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      paymentMethod === 'online'
                        ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" /> ONLINE / DIGITAL
                  </button>
                </div>
              </div>

              {/* Total Calculation Display */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase">Grand Total Amount</span>
                <span className="text-2xl font-black text-orange-600">
                  ₹{cartTotal.toFixed(2)}
                </span>
              </div>

              {/* Checkout Trigger */}
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading || cart.length === 0}
                className="w-full py-4 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-extrabold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider"
              >
                {checkoutLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing Checkout...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" /> Complete Checkout & Issue Receipt
                  </>
                )}
              </button>

            </div>

          </div>

        </div>

        {/* Camera Scanner Modal */}
        <BarcodeScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScanSuccess={(scannedCode) => {
            handleAddByBarcode(scannedCode);
          }}
        />

        {/* Cash Payment Calculator Modal */}
        <CashPaymentModal
          isOpen={isCashModalOpen}
          onClose={() => setIsCashModalOpen(false)}
          totalAmount={cartTotal}
          onConfirmPayment={(cashReceived, changeReturned) => {
            executeCheckoutSale(cashReceived, changeReturned);
          }}
          loading={checkoutLoading}
        />

        {/* Checkout Completed Receipt Modal */}
        <ReceiptModal
          sale={completedSale}
          store={store}
          isOpen={isReceiptOpen}
          onClose={() => setIsReceiptOpen(false)}
          voiceEnabled={voiceEnabled}
        />

      </div>
    </div>
  );
};
