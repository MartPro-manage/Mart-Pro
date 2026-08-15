import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  runTransaction,
  handleFirestoreError,
  OperationType,
  cleanFirestoreData
} from '../lib/firebase';
import { Product, Store, UserAccount, CartItem, Sale, SaleItem } from '../types';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { ReceiptModal } from './ReceiptModal';
import { HardwarePermissionsBar } from './HardwarePermissionsBar';
import { CashPaymentModal } from './CashPaymentModal';
import { speakMessage } from '../lib/speech';
import { playScanSuccessBeep, playScanErrorBeep } from '../lib/sound';
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
  Volume2,
  Percent,
  Tag,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

interface CashCounterViewProps {
  store: Store;
  currentUser: UserAccount;
}

export const CashCounterView: React.FC<CashCounterViewProps> = ({ store, currentUser }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Inbuilt Camera Scanner is controlled exclusively by Super Admin per store
  const isCameraScannerAllowed = store?.cameraScannerEnabled !== false;

  // POS State
  const [barcodeInput, setBarcodeInput] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');
  const [searchTerm, setSearchTerm] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);

  // Discount State
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number | ''>(0);

  // Notifications & Modals
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const scannerBufferRef = useRef<string>('');
  const lastKeyTimestampRef = useRef<number>(0);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 5000);
  };

  // Add Product to Cart by Barcode, Serial Number, Name or ID (Hands-free automatic support)
  const handleAddByBarcode = useCallback((targetBarcodeOrSerial: string, isExternalScanner: boolean = false) => {
    const trimmed = targetBarcodeOrSerial.trim().toLowerCase();
    if (!trimmed) return;

    // Look up product by:
    // 1. Exact Barcode OR Serial Number OR ID
    // 2. Exact Name (case-insensitive)
    // 3. Substring/prefix match on name or barcode
    let found = products.find(
      p => (p.barcode && p.barcode.trim().toLowerCase() === trimmed) || 
           (p.serialNumber && p.serialNumber.trim().toLowerCase() === trimmed) ||
           p.id === targetBarcodeOrSerial ||
           p.name.trim().toLowerCase() === trimmed
    );

    if (!found) {
      // Try partial match if no exact match
      found = products.find(
        p => p.name.trim().toLowerCase().includes(trimmed) ||
             (p.barcode && p.barcode.trim().toLowerCase().includes(trimmed)) ||
             (p.serialNumber && p.serialNumber.trim().toLowerCase().includes(trimmed))
      );
    }

    if (!found) {
      playScanErrorBeep();
      showNotification('error', `No product found matching "${targetBarcodeOrSerial}". Please check code or register it.`);
      setBarcodeInput('');
      return;
    }

    if (found.stockQuantity <= 0) {
      playScanErrorBeep();
      showNotification('error', `"${found.name}" is OUT OF STOCK! (0 units available).`);
      setBarcodeInput('');
      return;
    }

    // Success sound feedback
    playScanSuccessBeep();

    // Add or increment in cart
    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex(item => item.product.id === found!.id);
      if (existingIdx >= 0) {
        const updated = [...prevCart];
        const currentQty = updated[existingIdx].quantity;
        if (currentQty + 1 > found!.stockQuantity) {
          playScanErrorBeep();
          showNotification('error', `Cannot add more. Only ${found!.stockQuantity} units available in stock!`);
          return prevCart;
        }
        const newQty = currentQty + 1;
        updated[existingIdx] = {
          ...updated[existingIdx],
          product: found!, // update latest stock/price ref
          quantity: newQty,
          totalPrice: newQty * found!.price
        };
        showNotification('success', `Incremented "${found!.name}" (Qty: ${newQty})`);
        return updated;
      } else {
        showNotification('success', `Added "${found!.name}" to cart (Rs. ${found!.price.toFixed(2)})`);
        return [
          ...prevCart,
          {
            product: found!,
            quantity: 1,
            totalPrice: found!.price
          }
        ];
      }
    });

    setBarcodeInput('');
  }, [products]);

  // Auto focus barcode input for fast hardware USB barcode scanner support
  useEffect(() => {
    if (!isScannerOpen && !isReceiptOpen && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [isScannerOpen, isReceiptOpen, cart.length]);

  // External Hardware Barcode Scanner Listener (Hands-free continuous scanning without clicking any button)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isSearchActive = activeEl && activeEl.getAttribute('id') === 'product-search-input';
      const isDiscountInput = activeEl && activeEl.getAttribute('id') === 'discount-input-value';
      
      // If user is actively typing in the search box, discount input, or modals, skip auto-scanner buffer
      if (isSearchActive || isDiscountInput || isCashModalOpen || isReceiptOpen) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTimestampRef.current;
      lastKeyTimestampRef.current = now;

      // When Enter is received from external scanner or keyboard
      if (e.key === 'Enter') {
        const scannedText = scannerBufferRef.current.trim() || (activeEl === barcodeInputRef.current ? barcodeInput.trim() : '');
        if (scannedText) {
          e.preventDefault();
          handleAddByBarcode(scannedText, true);
          scannerBufferRef.current = '';
          setBarcodeInput('');
          if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
          }
        }
        return;
      }

      // If key is printable character
      if (e.key.length === 1) {
        if (timeDiff > 250) {
          scannerBufferRef.current = e.key;
        } else {
          scannerBufferRef.current += e.key;
        }

        // Always keep focus inside barcode input if not inside another form field
        if (activeEl !== barcodeInputRef.current && barcodeInputRef.current) {
          barcodeInputRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isCashModalOpen, isReceiptOpen, barcodeInput, handleAddByBarcode]);

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

  // Calculate Subtotal, Discount & Final Payable Grand Total
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    const rawVal = typeof discountValue === 'number' ? discountValue : parseFloat(discountValue) || 0;
    if (rawVal <= 0 || cartSubtotal <= 0) return 0;

    if (discountType === 'percentage') {
      const clampedPct = Math.min(100, Math.max(0, rawVal));
      return (cartSubtotal * clampedPct) / 100;
    } else {
      return Math.min(cartSubtotal, Math.max(0, rawVal));
    }
  }, [cartSubtotal, discountType, discountValue]);

  const cartTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - discountAmount);
  }, [cartSubtotal, discountAmount]);

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

      const numDiscountVal = typeof discountValue === 'number' ? discountValue : parseFloat(discountValue) || 0;

      const newSaleDocRef = doc(collection(db, 'sales'));

      await runTransaction(db, async (transaction) => {
        // PHASE 1: ALL READS FIRST (Strict Firestore rule: All reads must happen before any writes)
        // Aggregate quantities by product ID
        const productQuantities = new Map<string, { product: Product; quantity: number }>();
        for (const item of cart) {
          const existing = productQuantities.get(item.product.id);
          if (existing) {
            existing.quantity += item.quantity;
          } else {
            productQuantities.set(item.product.id, { product: item.product, quantity: item.quantity });
          }
        }

        const readSnapshots: { prodRef: any; currentStock: number; newStock: number; name: string }[] = [];

        for (const [prodId, entry] of productQuantities.entries()) {
          const prodRef = doc(db, 'products', prodId);
          const prodSnap = await transaction.get(prodRef); // READ

          if (!prodSnap.exists()) {
            throw new Error(`Product "${entry.product.name}" no longer exists in database.`);
          }

          const currentStock = Number(prodSnap.data().stockQuantity) || 0;
          if (currentStock < entry.quantity) {
            throw new Error(`Insufficient stock for "${entry.product.name}". Available: ${currentStock}, In Cart: ${entry.quantity}`);
          }

          readSnapshots.push({
            prodRef,
            currentStock,
            newStock: Math.max(0, currentStock - entry.quantity),
            name: entry.product.name
          });
        }

        // PHASE 2: ALL WRITES AFTER ALL READS HAVE COMPLETED
        for (const { prodRef, newStock } of readSnapshots) {
          transaction.update(prodRef, {
            stockQuantity: newStock,
            updatedAt: nowIso
          });
        }

        // 2. Create Sale Record with Discount Fields (cleanly populated without undefined fields)
        const saleRecordData: Record<string, any> = {
          id: newSaleDocRef.id,
          storeId: store.id || '',
          storeName: store.name || '',
          counterId: currentUser.id || '',
          counterName: currentUser.name || (currentUser.counterNumber ? `Counter #${currentUser.counterNumber}` : 'Counter #1'),
          cashierUsername: currentUser.username || '',
          items: saleItems,
          subtotalAmount: cartSubtotal,
          totalAmount: cartTotal || 0,
          paymentMethod: paymentMethod || 'cash',
          receiptNumber: receiptNum,
          timestamp: nowIso
        };

        if (discountAmount > 0) {
          saleRecordData.discountType = discountType;
          saleRecordData.discountValue = numDiscountVal;
          saleRecordData.discountAmount = discountAmount;
        }

        if (paymentMethod === 'cash') {
          saleRecordData.cashReceived = cashReceived ?? cartTotal;
          saleRecordData.changeReturned = changeReturned ?? 0;
        }

        transaction.set(newSaleDocRef, cleanFirestoreData(saleRecordData));
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
        subtotalAmount: cartSubtotal,
        discountType: discountAmount > 0 ? discountType : undefined,
        discountValue: discountAmount > 0 ? numDiscountVal : undefined,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
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
      setDiscountValue(0);
      
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

          {/* Top Bar Actions & Camera Scanner Visibility Check */}
          <div className="flex flex-wrap items-center gap-2.5 z-10">
            {isCameraScannerAllowed ? (
              <button
                id="btn-scan-camera-barcode"
                onClick={() => setIsScannerOpen(true)}
                className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                title="Open built-in camera barcode scanner"
              >
                <Camera className="w-4 h-4" /> Scan Camera Barcode
              </button>
            ) : (
              <span className="px-3 py-2 bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl flex items-center gap-1.5" title="Camera scanner disabled by Super Admin for this store">
                <Camera className="w-3.5 h-3.5 text-slate-400" />
                <span>Camera Scanner Disabled by Super Admin</span>
              </span>
            )}
          </div>
        </div>

        {/* Hardware Permissions, Scanner Status & Audio Controls Bar */}
        <HardwarePermissionsBar 
          voiceEnabled={voiceEnabled} 
          onToggleVoice={setVoiceEnabled}
          cameraScannerEnabled={isCameraScannerAllowed}
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
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> External Scanner: Scan Without Clicking Any Button
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
                    id="barcode-hardware-input"
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
                  id="btn-add-barcode-item"
                  type="submit"
                  className="px-5 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl shadow-sm transition-all cursor-pointer text-sm shrink-0 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              </form>
              <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>
                  <strong>Continuous External Scanning:</strong> Use any USB/Bluetooth barcode scanner freely. Each scan automatically adds the item to the list with audio beep.
                </span>
              </p>
            </div>

            {/* Quick Product Grid Selector */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-orange-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Quick Product Selector</h3>
                </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="product-search-input"
                      type="text"
                      placeholder="Search & Press Enter to Add..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const term = searchTerm.trim();
                          if (!term) return;

                          // If there's an exact or filtered match
                          if (filteredQuickProducts.length > 0) {
                            const targetProduct = filteredQuickProducts[0];
                            if (targetProduct.stockQuantity <= 0) {
                              playScanErrorBeep();
                              showNotification('error', `"${targetProduct.name}" is OUT OF STOCK!`);
                            } else {
                              handleAddProductClick(targetProduct);
                              setSearchTerm('');
                              if (barcodeInputRef.current) {
                                barcodeInputRef.current.focus();
                              }
                            }
                          } else {
                            handleAddByBarcode(term);
                            setSearchTerm('');
                          }
                        }
                      }}
                      className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-orange-500 font-medium"
                    />
                  </div>
              </div>

              {products.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs">
                  No products registered in this store yet.
                </div>
              ) : filteredQuickProducts.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs">
                  No products matching "{searchTerm}".
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[460px] overflow-y-auto overscroll-contain pr-1.5 custom-scrollbar touch-pan-y">
                  {filteredQuickProducts.map((p) => {
                    const isOut = p.stockQuantity <= 0;
                    return (
                      <button
                        key={p.id}
                        disabled={isOut}
                        onClick={() => handleAddProductClick(p)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isOut 
                            ? 'opacity-40 bg-slate-100 border-slate-200 cursor-not-allowed' 
                            : 'bg-slate-50 hover:bg-orange-50/50 hover:border-orange-300 border-slate-200 cursor-pointer shadow-xs active:scale-[0.98]'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-900 text-xs line-clamp-2">{p.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                            {p.barcode || p.serialNumber || 'No Barcode'}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <span className="font-extrabold text-orange-600 text-xs">Rs. {p.price.toFixed(2)}</span>
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
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6 flex flex-col justify-between max-h-[calc(100vh-140px)] lg:sticky lg:top-6 overflow-y-auto overscroll-contain custom-scrollbar">
            
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-orange-600" /> Active Cart List ({cart.length})
                </h2>
                {cart.length > 0 && (
                  <button
                    id="btn-clear-cart"
                    onClick={() => {
                      setCart([]);
                      setDiscountValue(0);
                    }}
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
                  <p className="text-[11px] text-slate-500 font-medium">Scan product barcode to populate customer bill automatically</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[340px] sm:max-h-[380px] overflow-y-auto overscroll-contain pr-1.5 custom-scrollbar touch-pan-y">
                  {cart.map((item) => (
                    <div key={item.product.id} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                      
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 text-xs truncate">{item.product.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Rs. {item.product.price.toFixed(2)} each • <span className="text-emerald-700 font-semibold">Stock: {item.product.stockQuantity}</span>
                        </div>
                      </div>

                      {/* COMPULSORY QUANTITY CONTROLS */}
                      <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl p-1 shadow-xs">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.product.id, item.quantity - 1)}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-orange-100 hover:text-orange-700 text-slate-700 flex items-center justify-center cursor-pointer text-xs font-bold transition-colors"
                          title="Reduce quantity (-1)"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        
                        <input
                          type="number"
                          min="1"
                          max={item.product.stockQuantity}
                          value={item.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val)) {
                              handleUpdateQuantity(item.product.id, val);
                            }
                          }}
                          className="w-11 text-center bg-transparent text-slate-900 font-black text-xs focus:outline-none"
                          title="Type quantity directly"
                        />

                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-orange-100 hover:text-orange-700 text-slate-700 flex items-center justify-center cursor-pointer text-xs font-bold transition-colors"
                          title="Add quantity (+1)"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Line Total and Instant Delete / Remove Button */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="font-extrabold text-orange-600 text-xs">Rs. {item.totalPrice.toFixed(2)}</div>
                          <div className="text-[10px] text-slate-400 font-mono">Rs. {item.product.price.toFixed(2)} ea</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.product.id)}
                          className="p-2 rounded-xl bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 hover:border-red-600 transition-all cursor-pointer shadow-xs group"
                          title={`Delete "${item.product.name}" from cart`}
                        >
                          <Trash2 className="w-4 h-4 transition-transform group-hover:scale-110" />
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* DISCOUNT OPTION IN CHECKOUT */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-orange-600" /> Apply Bill Discount
                </label>
                
                {/* Discount Unit Selector: Percentage vs Fixed Cash */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setDiscountType('percentage')}
                    className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      discountType === 'percentage'
                        ? 'bg-white text-orange-700 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    % Percent
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('fixed')}
                    className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      discountType === 'fixed'
                        ? 'bg-white text-orange-700 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Rs. Flat Off
                  </button>
                </div>
              </div>

              {/* Quick Discount Preset Chips */}
              <div className="flex flex-wrap gap-1.5">
                {[0, 5, 10, 15, 20, 25].map((preset) => {
                  const isSelected = discountType === 'percentage' && Number(discountValue) === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setDiscountType('percentage');
                        setDiscountValue(preset);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {preset === 0 ? 'No Discount' : `${preset}%`}
                    </button>
                  );
                })}
              </div>

              {/* Custom Discount Input Field */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                    {discountType === 'percentage' ? '%' : 'Rs.'}
                  </span>
                  <input
                    id="discount-input-value"
                    type="number"
                    min="0"
                    max={discountType === 'percentage' ? 100 : cartSubtotal}
                    step="any"
                    placeholder={discountType === 'percentage' ? 'Custom percentage (e.g. 10)' : 'Custom flat discount in Rs.'}
                    value={discountValue === 0 ? '' : discountValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setDiscountValue(0);
                      } else {
                        const num = parseFloat(val);
                        setDiscountValue(isNaN(num) ? 0 : num);
                      }
                    }}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
                  />
                </div>
                {discountAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => setDiscountValue(0)}
                    className="px-2.5 py-2 text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-xl font-bold transition-all cursor-pointer shrink-0"
                  >
                    Reset
                  </button>
                )}
              </div>
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
                    id="btn-payment-cash"
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
                    id="btn-payment-online"
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

              {/* Total Calculation Display Breakdown */}
              <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 space-y-2 shadow-inner">
                {discountAmount > 0 && (
                  <div className="space-y-1 pb-2 border-b border-slate-800 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Subtotal:</span>
                      <span className="font-mono">Rs. {cartSubtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-emerald-400 font-bold">
                      <span>Discount ({discountType === 'percentage' ? `${discountValue}%` : 'Flat Rs.'}):</span>
                      <span className="font-mono">-Rs. {discountAmount.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Payable Total</span>
                    {discountAmount > 0 && (
                      <span className="text-[10px] text-emerald-400 font-bold">Discount Applied</span>
                    )}
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight">
                    Rs. {cartTotal.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Checkout Trigger */}
              <button
                id="btn-complete-checkout"
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

        {/* Camera Scanner Modal (Only when camera scanner is active/allowed by Super Admin) */}
        {isCameraScannerAllowed && (
          <BarcodeScannerModal
            isOpen={isScannerOpen}
            onClose={() => setIsScannerOpen(false)}
            onScanSuccess={(scannedCode) => {
              handleAddByBarcode(scannedCode);
            }}
          />
        )}

        {/* Cash Payment Calculator Modal */}
        <CashPaymentModal
          isOpen={isCashModalOpen}
          onClose={() => setIsCashModalOpen(false)}
          subtotalAmount={cartSubtotal}
          discountAmount={discountAmount}
          discountType={discountType}
          discountValue={typeof discountValue === 'number' ? discountValue : parseFloat(discountValue) || 0}
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
