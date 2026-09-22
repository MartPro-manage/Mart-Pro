import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  setDoc,
  deleteDoc,
  runTransaction,
  handleFirestoreError,
  OperationType,
  cleanFirestoreData
} from '../lib/firebase';
import { Product, Store, UserAccount, CartItem, Sale, SaleItem, ProductReturn, HeldBill } from '../types';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { ReceiptModal } from './ReceiptModal';
import { ReturnProductModal } from './ReturnProductModal';
import { ReturnSlipModal } from './ReturnSlipModal';
import { HardwarePermissionsBar } from './HardwarePermissionsBar';
import { CashPaymentModal } from './CashPaymentModal';
import { WeightPromptModal } from './WeightPromptModal';
import { HeldBillsModal } from './HeldBillsModal';
import { ProductShortcutsModal } from './ProductShortcutsModal';
import { UniversalBackButton } from './UniversalBackButton';
import { findProductByShortcutOrBarcode } from '../utils/productShortcuts';
import { speakMessage } from '../lib/speech';
import { playScanSuccessBeep, playScanErrorBeep } from '../lib/sound';
import { cleanupExpiredReceipts, isSaleExpired, getReceiptRemainingDays } from '../lib/salesCleanup';
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
  ToggleRight,
  RotateCcw,
  Undo2,
  Receipt,
  Scale,
  Image as ImageIcon,
  Zap,
  Flame,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Package,
  PauseCircle,
  Hash,
  Keyboard
} from 'lucide-react';

interface CashCounterViewProps {
  store: Store;
  currentUser: UserAccount;
  onBack?: () => void;
}

export const CashCounterView: React.FC<CashCounterViewProps> = ({ store, currentUser, onBack }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [recentReturns, setRecentReturns] = useState<ProductReturn[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Held Bills State
  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);
  const [isHeldBillsModalOpen, setIsHeldBillsModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  // Inbuilt Camera Scanner and Voice Announcements are controlled by Super Admin per store
  const isCameraScannerAllowed = store?.cameraScannerEnabled !== false;
  const isVoiceAllowed = store?.voiceAnnouncementEnabled !== false;

  // POS State
  const [barcodeInput, setBarcodeInput] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');
  const [searchTerm, setSearchTerm] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);

  // Weight Entry Modal State
  const [weightPromptProduct, setWeightPromptProduct] = useState<Product | null>(null);
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);

  // Return Product State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isReturnSlipOpen, setIsReturnSlipOpen] = useState(false);
  const [completedReturn, setCompletedReturn] = useState<ProductReturn | null>(null);

  // Discount State
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number | ''>(0);

  // Notifications & Modals
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [selectedReceiptType, setSelectedReceiptType] = useState<'print' | 'ereceipt'>('print');
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Full Screen Cart State
  const [isCartFullScreen, setIsCartFullScreen] = useState(false);
  const [fullScreenScanInput, setFullScreenScanInput] = useState('');
  const fullScreenScanInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus input when entering full screen or cart updates
  useEffect(() => {
    if (isCartFullScreen) {
      const timer = setTimeout(() => {
        fullScreenScanInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isCartFullScreen]);

  // Handle ESC key to exit full screen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCartFullScreen) {
        setIsCartFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCartFullScreen]);

  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const scannerBufferRef = useRef<string>('');
  const lastKeyTimestampRef = useRef<number>(0);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 5000);
  };

  // Normalization helper for accurate barcode and code matching
  const cleanCode = (v: any) => String(v ?? '').replace(/[\r\n\t\s]/g, '').trim().toLowerCase();
  const cleanName = (v: any) => String(v ?? '').trim().toLowerCase();

  // Confirm Weight for a Weight-Based Product
  const handleConfirmWeight = useCallback((product: Product, quantityInKg: number, totalPrice: number) => {
    playScanSuccessBeep();
    const qtyDisplay = quantityInKg % 1 === 0 ? quantityInKg.toString() : quantityInKg.toFixed(3);

    if (isVoiceAllowed && voiceEnabled) {
      speakMessage(`Added ${qtyDisplay} kg ${product.name}`);
    }

    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex(item => item.product.id === product.id);
      if (existingIdx >= 0) {
        const updated = [...prevCart];
        const newQty = Math.round((updated[existingIdx].quantity + quantityInKg) * 1000) / 1000;
        
        if (newQty > product.stockQuantity) {
          playScanErrorBeep();
          showNotification('error', `Cannot add ${quantityInKg} kg. Only ${product.stockQuantity} kg available in stock!`);
          return prevCart;
        }

        const effectiveRate = product.price || product.pricePerKg || 0;
        updated[existingIdx] = {
          ...updated[existingIdx],
          product: product,
          quantity: newQty,
          totalPrice: Math.round(newQty * effectiveRate * 100) / 100
        };
        showNotification('success', `Updated "${product.name}" in bill (${newQty.toFixed(3)} kg total)`);
        return updated;
      } else {
        showNotification('success', `Added "${product.name}" (${qtyDisplay} kg) for Rs. ${totalPrice.toFixed(2)}`);
        return [
          ...prevCart,
          {
            product: product,
            quantity: quantityInKg,
            totalPrice: Math.round(totalPrice * 100) / 100
          }
        ];
      }
    });

    setBarcodeInput('');
  }, [isVoiceAllowed, voiceEnabled]);

  // Add Product to Cart by Full Barcode, Serial Number, or 4-digit Shortcut Code (Hands-free automatic support)
  const handleAddByBarcode = useCallback((targetBarcodeOrSerial: string, isExternalScanner: boolean = false) => {
    const rawCode = targetBarcodeOrSerial ? targetBarcodeOrSerial.replace(/[\r\n\t]/g, '').trim() : '';
    if (!rawCode) return;

    // 0. Check 4-digit shortcut code or exact barcode / serial match first
    let found = findProductByShortcutOrBarcode(rawCode, products);

    if (!found) {
      const targetCode = cleanCode(rawCode);
      const targetName = cleanName(rawCode);

      // 1. Direct exact full match on barcode, serial number, ID, or full name
      found = products.find(p => {
        const pBarcode = cleanCode(p.barcode);
        const pSerial = cleanCode(p.serialNumber);
        const pId = cleanCode(p.id);
        const pName = cleanName(p.name);
        const pShortcut = cleanCode(p.shortcutCode);

        if (pShortcut && pShortcut === targetCode) return true;
        if (pBarcode && pBarcode === targetCode) return true;
        if (pSerial && pSerial === targetCode) return true;
        if (pId && pId === targetCode) return true;
        if (pName && pName === targetName) return true;
        return false;
      });

      // 2. Fallback for leading-zero variations in standard barcode formats (e.g. UPC/EAN)
      if (!found) {
        const targetDigitsNoZero = targetCode.replace(/^0+/, '');
        if (targetDigitsNoZero.length >= 3) {
          found = products.find(p => {
            const pBarcodeDigits = cleanCode(p.barcode).replace(/^0+/, '');
            const pSerialDigits = cleanCode(p.serialNumber).replace(/^0+/, '');
            return (pBarcodeDigits && pBarcodeDigits === targetDigitsNoZero) ||
                   (pSerialDigits && pSerialDigits === targetDigitsNoZero);
          });
        }
      }
    }

    if (!found) {
      playScanErrorBeep();
      showNotification('error', `No product matches "${rawCode}". Check barcode or 4-digit shortcut code.`);
      setBarcodeInput('');
      return;
    }

    if (found.stockQuantity <= 0) {
      playScanErrorBeep();
      showNotification('error', `"${found.name}" is OUT OF STOCK! (0 units available).`);
      if (isVoiceAllowed && voiceEnabled) {
        speakMessage(`${found.name} is out of stock`);
      }
      setBarcodeInput('');
      return;
    }

    // CHECK IF PRODUCT IS SOLD BY WEIGHT
    const isWeightProduct = found.sellBy === 'weight' || found.unitType === 'kg' || Boolean(found.pricePerKg);
    if (isWeightProduct) {
      // Open weight prompt modal for cashier to enter exact scale weight or pack count
      setWeightPromptProduct(found);
      setIsWeightModalOpen(true);
      setBarcodeInput('');
      return;
    }

    // Standard piece-based product handling
    playScanSuccessBeep();
    if (isVoiceAllowed && voiceEnabled) {
      speakMessage(`Added ${found.name}`);
    }

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
          totalPrice: Math.round(newQty * found!.price * 100) / 100
        };
        showNotification('success', `Incremented "${found!.name}" in list (Qty: ${newQty})`);
        return updated;
      } else {
        showNotification('success', `Matched & added "${found!.name}" to list (Rs. ${found!.price.toFixed(2)})`);
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
  }, [products, isVoiceAllowed, voiceEnabled]);

  // Auto focus barcode input for fast hardware USB barcode scanner support
  useEffect(() => {
    const isAnyModalOpen = isScannerOpen || isReceiptOpen || isReturnModalOpen || isReturnSlipOpen || isCashModalOpen;
    if (!isAnyModalOpen && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [isScannerOpen, isReceiptOpen, isReturnModalOpen, isReturnSlipOpen, isCashModalOpen, cart.length]);

  // External Hardware Barcode Scanner Listener (Hands-free continuous scanning without clicking any button)
  useEffect(() => {
    const isAnyModalOpen = isScannerOpen || isReceiptOpen || isReturnModalOpen || isReturnSlipOpen || isCashModalOpen;
    if (isAnyModalOpen) {
      return;
    }

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const tagName = activeEl?.tagName?.toUpperCase();
      const isInputActive = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
      
      // If user is actively typing in ANY input field or modal, skip auto-scanner buffer
      if (isInputActive && activeEl !== barcodeInputRef.current) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTimestampRef.current;
      lastKeyTimestampRef.current = now;

      // When Enter is received from external scanner or keyboard
      if (e.key === 'Enter') {
        const isFocusedOnBarcodeInput = activeEl === barcodeInputRef.current;
        const scannedText = isFocusedOnBarcodeInput
          ? (barcodeInputRef.current?.value || barcodeInput || '').trim()
          : scannerBufferRef.current.trim();

        if (scannedText) {
          e.preventDefault();
          handleAddByBarcode(scannedText, true);
          scannerBufferRef.current = '';
          setBarcodeInput('');
          if (barcodeInputRef.current) {
            barcodeInputRef.current.value = '';
            barcodeInputRef.current.focus();
          }
        }
        return;
      }

      // If key is printable character and user is NOT typing in an active input field
      if (!isInputActive && e.key.length === 1) {
        if (timeDiff > 250) {
          scannerBufferRef.current = e.key;
        } else {
          scannerBufferRef.current += e.key;
        }

        // Always keep focus inside barcode input
        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isCashModalOpen, isReceiptOpen, isReturnModalOpen, isReturnSlipOpen, isScannerOpen, barcodeInput, handleAddByBarcode]);

  // Subscribe to products, sales, and returns in real-time for this store
  useEffect(() => {
    if (!store?.id) return;

    // 1. Products
    const qProducts = query(
      collection(db, 'products'),
      where('storeId', '==', store.id)
    );

    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      const list: Product[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Product);
      });
      setProducts(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'products');
    });

    // 2. Sales (Run 7-day auto-purge and filter out expired receipts)
    cleanupExpiredReceipts(store.id);

    const qSales = query(
      collection(db, 'sales'),
      where('storeId', '==', store.id)
    );

    const unsubSales = onSnapshot(qSales, (snapshot) => {
      const list: Sale[] = [];
      snapshot.forEach((docSnap) => {
        const saleData = { id: docSnap.id, ...docSnap.data() } as Sale;
        list.push(saleData);
      });
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentSales(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'sales');
    });

    // 3. Returns
    const qReturns = query(
      collection(db, 'returns'),
      where('storeId', '==', store.id)
    );

    const unsubReturns = onSnapshot(qReturns, (snapshot) => {
      const list: ProductReturn[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as ProductReturn);
      });
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentReturns(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'returns');
    });

    // 4. Held Bills (Real-time parked bills queue)
    const qHeld = query(
      collection(db, 'held_bills'),
      where('storeId', '==', store.id)
    );

    const unsubHeld = onSnapshot(qHeld, (snapshot) => {
      const list: HeldBill[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as HeldBill);
      });
      list.sort((a, b) => new Date(b.heldAt).getTime() - new Date(a.heldAt).getTime());
      setHeldBills(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'held_bills');
    });

    return () => {
      unsubProducts();
      unsubSales();
      unsubReturns();
      unsubHeld();
    };
  }, [store?.id]);

  // Add product from click
  const handleAddProductClick = (product: Product) => {
    handleAddByBarcode(product.shortcutCode || product.barcode || product.serialNumber || product.name || product.id);
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
      const unitLabel = (liveProd.sellBy === 'weight' || liveProd.unitType === 'kg') ? 'kg' : 'units';
      showNotification('error', `Cannot set quantity to ${newQty}. Only ${liveProd.stockQuantity} ${unitLabel} available in stock!`);
      return;
    }

    const roundedQty = Math.round(newQty * 1000) / 1000;
    const effectivePrice = liveProd.price || liveProd.pricePerKg || itemInCart.product.price;

    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          return {
            ...item,
            quantity: roundedQty,
            totalPrice: Math.round(roundedQty * effectivePrice * 100) / 100
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

  // Hold Active Bill (H + D)
  const handleHoldBill = useCallback(async () => {
    if (cart.length === 0) {
      showNotification('error', 'Cart is empty. Add products before holding bill.');
      return;
    }

    try {
      const heldId = `held_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const payload: HeldBill = {
        id: heldId,
        storeId: store.id,
        counterId: currentUser.counterNumber?.toString() || '1',
        counterName: `Counter #${currentUser.counterNumber || 1}`,
        cashierUsername: currentUser.username,
        items: [...cart],
        subtotal: cartSubtotal,
        discountType: discountType,
        discountValue: typeof discountValue === 'number' ? discountValue : 0,
        discountAmount: discountAmount,
        total: cartTotal,
        heldAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'held_bills', heldId), payload);
      setCart([]);
      setDiscountValue(0);
      playScanSuccessBeep();
      showNotification('success', `Bill held successfully (${payload.items.length} items)! Press A+S to resume.`);
      if (isVoiceAllowed && voiceEnabled) {
        speakMessage('Bill held');
      }
    } catch (err: any) {
      console.error('Error holding bill:', err);
      showNotification('error', 'Failed to hold bill: ' + err.message);
    }
  }, [cart, cartSubtotal, discountType, discountValue, discountAmount, cartTotal, store.id, currentUser, isVoiceAllowed, voiceEnabled]);

  // Restore Parked Bill to Active Cart
  const handleRestoreBill = useCallback(async (bill: HeldBill) => {
    try {
      setCart(bill.items);
      if (bill.discountType) setDiscountType(bill.discountType);
      if (typeof bill.discountValue === 'number') setDiscountValue(bill.discountValue);

      await deleteDoc(doc(db, 'held_bills', bill.id));
      playScanSuccessBeep();
      showNotification('success', `Restored held bill with ${bill.items.length} items!`);
      if (isVoiceAllowed && voiceEnabled) {
        speakMessage('Bill restored');
      }
    } catch (err: any) {
      console.error('Error restoring held bill:', err);
      showNotification('error', 'Failed to resume held bill: ' + err.message);
    }
  }, [isVoiceAllowed, voiceEnabled]);

  // Discard / Delete Held Bill
  const handleDeleteHeldBill = useCallback(async (billId: string) => {
    try {
      await deleteDoc(doc(db, 'held_bills', billId));
      showNotification('success', 'Held bill discarded.');
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Failed to delete held bill: ' + err.message);
    }
  }, []);

  // Keyboard Shortcuts: H+D (Hold Bill), A+S (Held Receipts), S+K (Product Shortcuts)
  useEffect(() => {
    const pressedKeys = new Set<string>();
    let lastKey = '';
    let lastKeyTime = 0;

    const handleKeyDownCombo = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const tagName = activeEl?.tagName?.toUpperCase();
      const isInputActive = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';

      // If typing in another input (other than barcode input), skip key shortcuts
      if (isInputActive && activeEl !== barcodeInputRef.current && activeEl !== fullScreenScanInputRef.current) {
        return;
      }

      const keyUpper = e.key.toUpperCase();
      pressedKeys.add(keyUpper);

      // Check simultaneous key presses:
      if (pressedKeys.has('H') && pressedKeys.has('D')) {
        e.preventDefault();
        pressedKeys.clear();
        handleHoldBill();
        return;
      }
      if (pressedKeys.has('A') && pressedKeys.has('S')) {
        e.preventDefault();
        pressedKeys.clear();
        setIsHeldBillsModalOpen(true);
        return;
      }
      if (pressedKeys.has('S') && pressedKeys.has('K')) {
        e.preventDefault();
        pressedKeys.clear();
        setIsShortcutsModalOpen(true);
        return;
      }

      // Check rapid sequential key presses (within 700ms)
      const now = Date.now();
      if (now - lastKeyTime < 700) {
        const combo = lastKey + keyUpper;
        if (combo === 'HD') {
          e.preventDefault();
          handleHoldBill();
          lastKey = '';
          return;
        }
        if (combo === 'AS') {
          e.preventDefault();
          setIsHeldBillsModalOpen(true);
          lastKey = '';
          return;
        }
        if (combo === 'SK') {
          e.preventDefault();
          setIsShortcutsModalOpen(true);
          lastKey = '';
          return;
        }
      }

      lastKey = keyUpper;
      lastKeyTime = now;
    };

    const handleKeyUpCombo = (e: KeyboardEvent) => {
      pressedKeys.delete(e.key.toUpperCase());
    };

    window.addEventListener('keydown', handleKeyDownCombo);
    window.addEventListener('keyup', handleKeyUpCombo);
    return () => {
      window.removeEventListener('keydown', handleKeyDownCombo);
      window.removeEventListener('keyup', handleKeyUpCombo);
    };
  }, [handleHoldBill]);

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

  const executeCheckoutSale = async (cashReceived?: number, changeReturned?: number, receiptType: 'print' | 'ereceipt' = 'print') => {
    setCheckoutLoading(true);
    setSelectedReceiptType(receiptType);

    try {
      // Execute Firestore Atomic Transaction to decrement stock and create sale record
      const receiptNum = `RCP-${Date.now().toString().slice(-6)}`;
      const nowIso = new Date().toISOString();

      const saleItems: SaleItem[] = cart.map((item) => ({
        productId: item.product.id || '',
        barcode: item.product.barcode || '',
        serialNumber: item.product.serialNumber || '',
        name: item.product.name || '',
        costPrice: item.product.costPrice !== undefined ? item.product.costPrice : 0,
        price: item.product.price || item.product.pricePerKg || 0,
        quantity: item.quantity || 1,
        total: Math.round(item.totalPrice * 100) / 100,
        sellBy: item.product.sellBy || (item.product.unitType === 'kg' ? 'weight' : 'unit'),
        unitType: item.product.unitType || (item.product.sellBy === 'weight' ? 'kg' : 'piece'),
        weightInfo: item.product.weight || (item.product.sellBy === 'weight' ? `${item.quantity} kg` : undefined)
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
            newStock: Math.max(0, Math.round((currentStock - entry.quantity) * 1000) / 1000),
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

        const expiresAtIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

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
          timestamp: nowIso,
          expiresAt: expiresAtIso
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
      
      // Voice & Text Thank You greeting with Total Bill Amount for purchase according to store name
      const storeName = store.name || 'our store';
      const formattedTotal = cartTotal % 1 === 0 ? cartTotal.toFixed(0) : cartTotal.toFixed(2);
      if (isVoiceAllowed && voiceEnabled) {
        speakMessage(`Total bill is ${formattedTotal} rupees. Thank you for shopping at ${storeName}!`);
      }
      showNotification('success', `🎉 Thank you for shopping at ${storeName}! Total: Rs. ${formattedTotal}. Transaction #${receiptNum} completed.`);

    } catch (err: any) {
      console.error('Checkout error:', err);
      showNotification('error', 'Checkout failed: ' + (err?.message || 'Check connection.'));
    } finally {
      setCheckoutLoading(false);
    }
  };

  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');

  const categories = useMemo(() => {
    const set = new Set<string>();
    (products || []).forEach((p) => {
      if (p.category) set.add(p.category.trim());
    });
    return Array.from(set).filter(Boolean);
  }, [products]);

  const filteredQuickProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = !searchTerm.trim() || (
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.serialNumber && p.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()))
      );

      if (!matchesSearch) return false;

      if (activeCategoryFilter === 'all') return true;
      if (activeCategoryFilter === 'weight') return p.sellBy === 'weight' || p.unitType === 'kg' || Boolean(p.pricePerKg);
      if (activeCategoryFilter === 'unit') return p.sellBy === 'unit' && !p.pricePerKg && p.unitType !== 'kg';
      return p.category === activeCategoryFilter;
    });
  }, [products, searchTerm, activeCategoryFilter]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Counter Top Bar */}
        <motion.div 
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden"
        >
          {/* Subtle ambient gradient */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-orange-100/40 via-amber-50/20 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

          <div className="flex items-center gap-3 z-10">
            {onBack && (
              <UniversalBackButton onBack={onBack} label="Back to Dashboard" />
            )}
            <motion.div 
              whileHover={{ rotate: 5, scale: 1.05 }}
              className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold shadow-xs"
            >
              <Calculator className="w-6 h-6 text-emerald-600" />
            </motion.div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
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
            {/* RETURN / REFUND PRODUCT BUTTON */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              id="btn-return-product-modal"
              onClick={() => setIsReturnModalOpen(true)}
              className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs rounded-xl border border-rose-200 shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              title="Process product return, restock item to inventory, and issue customer refund"
            >
              <RotateCcw className="w-4 h-4 text-rose-600" /> Return / Refund Item
            </motion.button>

            {isCameraScannerAllowed && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                id="btn-scan-camera-barcode"
                onClick={() => setIsScannerOpen(true)}
                className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                title="Open built-in camera barcode scanner"
              >
                <Camera className="w-4 h-4" /> Scan Camera Barcode
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* Recent Returns Shift Banner (if returns processed today) */}
        {recentReturns.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-rose-50/90 border border-rose-200 rounded-2xl p-3 sm:px-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs"
          >
            <div className="flex items-center gap-2.5 text-rose-900 font-medium">
              <div className="p-1.5 bg-rose-600 text-white rounded-lg shadow-xs">
                <RotateCcw className="w-3.5 h-3.5" />
              </div>
              <span>
                <strong>{recentReturns.length} Return(s) Processed</strong> &bull; Total Refunded:{' '}
                <strong className="text-rose-700 font-bold">
                  Rs. {recentReturns.reduce((sum, r) => sum + (r.refundAmount || 0), 0).toFixed(2)}
                </strong>{' '}
                &bull; Restocked to Inventory:{' '}
                <strong className="text-emerald-700 font-bold">
                  +{recentReturns.reduce((sum, r) => sum + (r.quantity || 0), 0)} units
                </strong>
              </span>
            </div>
            <button
              onClick={() => {
                if (recentReturns.length > 0) {
                  setCompletedReturn(recentReturns[0]);
                  setIsReturnSlipOpen(true);
                }
              }}
              className="px-3 py-1 bg-white hover:bg-rose-100/60 text-rose-700 font-bold rounded-lg border border-rose-200 text-[11px] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Receipt className="w-3 h-3 text-rose-600" /> View Latest Return Slip
            </button>
          </motion.div>
        )}

        {/* Hardware Permissions, Scanner Status & Audio Controls Bar */}
        <HardwarePermissionsBar 
          voiceEnabled={voiceEnabled} 
          onToggleVoice={setVoiceEnabled}
          voiceAllowed={isVoiceAllowed}
          cameraScannerEnabled={isCameraScannerAllowed}
        />

        {/* Rapid POS Actions & Keyboard Shortcut Triggers Bar */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {onBack && (
              <UniversalBackButton onBack={onBack} label="Back to Dashboard" />
            )}

            {/* Hold Current Bill (H + D) */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleHoldBill}
              id="btn-trigger-hold-bill"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-900 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              title="Temporarily hold current bill to attend next customer (Shortcut: H + D)"
            >
              <PauseCircle className="w-3.5 h-3.5 text-orange-600" />
              <span>Hold Bill</span>
              <span className="px-1.5 py-0.2 rounded-md bg-orange-200 text-orange-900 text-[10px] font-mono font-black">
                H+D
              </span>
            </motion.button>

            {/* View Held Receipts (A + S) */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsHeldBillsModalOpen(true)}
              id="btn-trigger-held-receipts"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              title="View and resume parked receipts (Shortcut: A + S)"
            >
              <Receipt className="w-3.5 h-3.5 text-purple-600" />
              <span>Held Receipts</span>
              {heldBills.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-purple-600 text-white text-[10px] font-mono font-bold">
                  {heldBills.length}
                </span>
              )}
              <span className="px-1.5 py-0.2 rounded-md bg-purple-200 text-purple-900 text-[10px] font-mono font-black">
                A+S
              </span>
            </motion.button>

            {/* Product Shortcuts Overview (S + K) */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsShortcutsModalOpen(true)}
              id="btn-trigger-shortcuts-dir"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              title="View all 4-digit product shortcut codes (Shortcut: S + K)"
            >
              <Hash className="w-3.5 h-3.5 text-blue-600" />
              <span>4-Digit Shortcuts</span>
              <span className="px-1.5 py-0.2 rounded-md bg-blue-200 text-blue-900 text-[10px] font-mono font-black">
                S+K
              </span>
            </motion.button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="hidden sm:inline">Type 4-digit code (e.g. <strong>1001</strong>) + Enter to add</span>
          </div>
        </div>

        {/* Global Notifications */}
        <AnimatePresence>
          {msg && (
            <motion.div 
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className={`p-4 rounded-2xl border flex items-center gap-3 text-sm font-medium shadow-sm transition-all ${
                msg.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />}
              <span>{msg.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* LEFT 7 COLS: BARCODE INPUT & QUICK PRODUCT SELECTOR */}
          <div className="lg:col-span-7 space-y-6">

            {/* Barcode Scanner Input */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 relative overflow-hidden"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <BarcodeIcon className="w-4 h-4 text-orange-600" /> Barcode Reader / Rapid Scanner
                </label>
                <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-bold flex items-center gap-1.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-live-pulse" /> Live Scanner Ready
                </span>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const val = (barcodeInput || barcodeInputRef.current?.value || '').trim();
                  if (val) {
                    handleAddByBarcode(val);
                  }
                  setBarcodeInput('');
                  if (barcodeInputRef.current) {
                    barcodeInputRef.current.value = '';
                    barcodeInputRef.current.focus();
                  }
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1 group">
                  <input
                    id="barcode-hardware-input"
                    ref={barcodeInputRef}
                    type="text"
                    autoFocus
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="text"
                    placeholder="Scan barcode with laser or type code..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-base font-mono focus:outline-none focus:border-orange-500 focus:bg-white focus:ring-3 focus:ring-orange-500/10 transition-all shadow-inner"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-bold">↵ ENTER</span>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  id="btn-add-barcode-item"
                  type="submit"
                  className="px-5 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl shadow-sm transition-all cursor-pointer text-sm shrink-0 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Item
                </motion.button>
              </form>
              <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>
                  <strong>Continuous Scanning Enabled:</strong> Hardware scanners automatically append item to active cart with audio beep.
                </span>
              </p>
            </motion.div>

            {/* Quick Product Grid Selector */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-orange-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Quick Product Catalog</h3>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="product-search-input"
                    type="text"
                    placeholder="Search name, barcode..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const term = searchTerm.trim();
                        if (!term) return;

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
                    className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-orange-500 font-medium w-48 sm:w-56"
                  />
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveCategoryFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    activeCategoryFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  All Items ({products.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategoryFilter('weight')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    activeCategoryFilter === 'weight'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/60'
                  }`}
                >
                  <Scale className="w-3 h-3" /> By Weight (Kg)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategoryFilter('unit')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    activeCategoryFilter === 'unit'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200/60'
                  }`}
                >
                  Packaged Units
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      activeCategoryFilter === cat
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {products.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs">
                  No products registered in this store yet.
                </div>
              ) : filteredQuickProducts.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs">
                  No products matching your search filter.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[460px] overflow-y-auto overscroll-contain pr-1.5 custom-scrollbar touch-pan-y">
                  {filteredQuickProducts.map((p) => {
                    const isOut = p.stockQuantity <= 0;
                    const isWeightItem = p.sellBy === 'weight' || p.unitType === 'kg' || Boolean(p.pricePerKg);
                    return (
                      <motion.button
                        key={p.id}
                        whileHover={!isOut ? { scale: 1.02, y: -2 } : {}}
                        whileTap={!isOut ? { scale: 0.97 } : {}}
                        disabled={isOut}
                        onClick={() => handleAddProductClick(p)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between relative overflow-hidden ${
                          isOut 
                            ? 'opacity-40 bg-slate-100 border-slate-200 cursor-not-allowed' 
                            : 'bg-white hover:bg-orange-50/40 hover:border-orange-300 border-slate-200/90 cursor-pointer shadow-xs'
                        }`}
                      >
                        {/* Image Thumbnail if present */}
                        {p.imageUrl && (
                          <div className="w-full h-24 mb-2 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200/60">
                            <img 
                              src={p.imageUrl} 
                              alt={p.name} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-1">
                            {isWeightItem && (
                              <span className="p-0.5 px-1 bg-amber-100 text-amber-800 rounded font-bold text-[9px] flex items-center gap-0.5 shrink-0" title="Sold by Weight">
                                <Scale className="w-2.5 h-2.5" /> KG
                              </span>
                            )}
                            <span className="font-bold text-slate-900 text-xs line-clamp-2">{p.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                            {p.barcode || p.serialNumber || 'No Barcode'}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                          <span className="font-extrabold text-orange-600 text-xs font-mono">
                            Rs. {p.price.toFixed(2)}{isWeightItem ? '/kg' : ''}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isOut ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isOut 
                              ? 'OUT' 
                              : isWeightItem 
                                ? `${p.stockQuantity % 1 === 0 ? p.stockQuantity : p.stockQuantity.toFixed(2)} kg` 
                                : `${p.stockQuantity} in stock`}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </motion.div>

          </div>

          {/* RIGHT 5 COLS: CART LIST, COMPULSORY QUANTITY & CHECKOUT */}
          <motion.div 
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-6 flex flex-col justify-between max-h-[calc(100vh-140px)] lg:sticky lg:top-6 overflow-y-auto overscroll-contain custom-scrollbar"
          >
            
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-2">
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-orange-600" /> Active Cart ({cart.length})
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    id="btn-cart-fullscreen"
                    type="button"
                    onClick={() => setIsCartFullScreen(true)}
                    className="flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-600 text-orange-700 hover:text-white border border-orange-200 transition-all cursor-pointer shadow-2xs group"
                    title="Open Cart in Full Screen Mode to scan and manage items"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-orange-600 group-hover:text-white transition-colors" />
                    <span>Full Screen</span>
                  </button>
                  {cart.length > 0 && (
                    <button
                      id="btn-clear-cart"
                      onClick={() => {
                        setCart([]);
                        setDiscountValue(0);
                      }}
                      className="text-xs text-red-600 hover:text-red-700 font-bold cursor-pointer px-2 py-1"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* CART ITEMS LIST WITH COMPULSORY QUANTITY SELECTOR */}
              {cart.length === 0 ? (
                <div className="p-10 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
                  <ShoppingBag className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">Cart is currently empty</p>
                  <p className="text-[11px] text-slate-500 font-medium">Scan barcode or pick item to start billing</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[340px] sm:max-h-[380px] overflow-y-auto overscroll-contain pr-1.5 custom-scrollbar touch-pan-y">
                  <AnimatePresence initial={false}>
                    {cart.map((item) => {
                      const isWeight = item.product.sellBy === 'weight' || item.product.unitType === 'kg' || Boolean(item.product.pricePerKg);
                      const qtyStep = isWeight ? 0.25 : 1;

                      return (
                        <motion.div 
                          key={item.product.id}
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, x: -20, scale: 0.9 }}
                          transition={{ duration: 0.2 }}
                          className="bg-slate-50/90 hover:bg-slate-100/80 p-3.5 rounded-2xl border border-slate-200/90 flex items-center justify-between gap-3 transition-colors shadow-2xs"
                        >
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {isWeight && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setWeightPromptProduct(item.product);
                                    setIsWeightModalOpen(true);
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                                  title="Click to adjust weight in scale calculator"
                                >
                                  <Scale className="w-3 h-3 text-amber-700" />
                                  <span>{item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(3)} kg</span>
                                </button>
                              )}
                              <span className="font-bold text-slate-900 text-xs truncate">{item.product.name}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              Rs. {item.product.price.toFixed(2)}{isWeight ? '/kg' : ' each'} • <span className="text-emerald-700 font-semibold">Stock: {item.product.stockQuantity}{isWeight ? 'kg' : ''}</span>
                            </div>
                          </div>

                          {/* COMPULSORY QUANTITY CONTROLS */}
                          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl p-1 shadow-xs">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.product.id, Math.max(0, item.quantity - qtyStep))}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-orange-100 hover:text-orange-700 text-slate-700 flex items-center justify-center cursor-pointer text-xs font-bold transition-colors"
                              title={`Reduce quantity (-${qtyStep})`}
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            
                            <input
                              type="number"
                              step={isWeight ? "0.001" : "1"}
                              min="0.001"
                              max={item.product.stockQuantity}
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val)) {
                                  handleUpdateQuantity(item.product.id, val);
                                }
                              }}
                              className="w-14 text-center bg-transparent text-slate-900 font-black text-xs focus:outline-none font-mono"
                              title="Type exact weight or quantity directly"
                            />

                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.product.id, item.quantity + qtyStep)}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-orange-100 hover:text-orange-700 text-slate-700 flex items-center justify-center cursor-pointer text-xs font-bold transition-colors"
                              title={`Add quantity (+${qtyStep})`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Line Total and Instant Delete / Remove Button */}
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <div className="font-extrabold text-orange-600 text-xs font-mono">Rs. {item.totalPrice.toFixed(2)}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {isWeight ? `${item.quantity.toFixed(3)}kg` : `x${item.quantity}`}
                              </div>
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

                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
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
              <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-2 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

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
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Payable Grand Total</span>
                    {discountAmount > 0 && (
                      <span className="text-[10px] text-emerald-400 font-bold">Discount Applied</span>
                    )}
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight font-mono">
                    Rs. {cartTotal.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Checkout Trigger */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                id="btn-complete-checkout"
                onClick={handleCheckout}
                disabled={checkoutLoading || cart.length === 0}
                className="w-full py-4 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-extrabold text-sm rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider"
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
              </motion.button>

            </div>

          </motion.div>

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
          onConfirmPayment={(cashReceived, changeReturned, receiptType) => {
            executeCheckoutSale(cashReceived, changeReturned, receiptType);
          }}
          loading={checkoutLoading}
        />

        {/* Checkout Completed Receipt Modal */}
        <ReceiptModal
          sale={completedSale}
          store={store}
          isOpen={isReceiptOpen}
          onClose={() => setIsReceiptOpen(false)}
          voiceEnabled={isVoiceAllowed && voiceEnabled}
          initialTab={selectedReceiptType}
        />

        {/* Process Product Return & Restock Modal */}
        <ReturnProductModal
          isOpen={isReturnModalOpen}
          onClose={() => setIsReturnModalOpen(false)}
          products={products}
          store={store}
          currentUser={currentUser}
          recentSales={recentSales}
          voiceEnabled={isVoiceAllowed && voiceEnabled}
          isCameraScannerAllowed={isCameraScannerAllowed}
          onReturnProcessed={(returnRec) => {
            setCompletedReturn(returnRec);
            setIsReturnSlipOpen(true);
            showNotification('success', `Returned "${returnRec.productName}". Restocked +${returnRec.quantity} units to inventory.`);
          }}
        />

        {/* Official Return & Refund Voucher Slip Modal */}
        <ReturnSlipModal
          returnRecord={completedReturn}
          store={store}
          isOpen={isReturnSlipOpen}
          onClose={() => setIsReturnSlipOpen(false)}
        />

        {/* Sell by Weight Scale Calculator Modal */}
        <WeightPromptModal
          isOpen={isWeightModalOpen}
          onClose={() => {
            setIsWeightModalOpen(false);
            setWeightPromptProduct(null);
          }}
          product={weightPromptProduct}
          onConfirm={handleConfirmWeight}
        />

        {/* Held Receipts & Parked Bills Modal (A + S) */}
        <HeldBillsModal
          isOpen={isHeldBillsModalOpen}
          onClose={() => setIsHeldBillsModalOpen(false)}
          heldBills={heldBills}
          onRestoreBill={handleRestoreBill}
          onDeleteBill={handleDeleteHeldBill}
        />

        {/* 4-Digit Product Shortcuts Modal (S + K) */}
        <ProductShortcutsModal
          isOpen={isShortcutsModalOpen}
          onClose={() => setIsShortcutsModalOpen(false)}
          products={products}
          onSelectProduct={handleAddProductClick}
        />

        {/* FULL SCREEN CART OVERLAY */}
        {isCartFullScreen && (
          <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col overflow-hidden animate-fade-in">
            {/* Top Navigation & Header Bar */}
            <div className="bg-slate-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between shadow-md border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  id="btn-close-cart-fullscreen"
                  type="button"
                  onClick={() => setIsCartFullScreen(false)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-xs transition-all cursor-pointer shadow-sm group"
                  title="Return to regular view (Press Esc)"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                  <span>Back to Counter</span>
                  <span className="text-[10px] bg-black/25 px-1.5 py-0.5 rounded font-mono font-normal">ESC</span>
                </button>
                <div className="hidden sm:block border-l border-slate-700 pl-3">
                  <div className="text-xs font-black text-white flex items-center gap-2">
                    <span>{store.name}</span>
                    <span className="text-orange-400 font-normal">•</span>
                    <span className="text-orange-400">Full-Screen Billing Station</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    Cashier: <strong className="text-slate-200">{currentUser.username}</strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-xl text-right">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cart Items</div>
                  <div className="text-xs font-black font-mono text-orange-400">
                    {cart.length} {cart.length === 1 ? 'item' : 'items'}
                  </div>
                </div>

                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCart([]);
                      setDiscountValue(0);
                    }}
                    className="px-3 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/60 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Clear Cart
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsCartFullScreen(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Exit Full Screen"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Pinned Laser Barcode Scanner Bar */}
            <div className="bg-white px-4 sm:px-6 py-3 border-b border-slate-200 shadow-xs shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const val = (fullScreenScanInput || fullScreenScanInputRef.current?.value || '').trim();
                  if (val) {
                    handleAddByBarcode(val);
                  }
                  setFullScreenScanInput('');
                  if (fullScreenScanInputRef.current) {
                    fullScreenScanInputRef.current.value = '';
                    fullScreenScanInputRef.current.focus();
                  }
                }}
                className="flex items-center gap-2 max-w-5xl mx-auto"
              >
                <div className="relative flex-1">
                  <BarcodeIcon className="w-5 h-5 text-orange-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={fullScreenScanInputRef}
                    id="fullscreen-barcode-input"
                    type="text"
                    autoFocus
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="Scan barcode with laser or type product code/serial number here..."
                    value={fullScreenScanInput}
                    onChange={(e) => setFullScreenScanInput(e.target.value)}
                    className="w-full pl-11 pr-24 py-2.5 bg-slate-50 border-2 border-orange-300 focus:border-orange-600 focus:bg-white rounded-xl text-slate-900 font-mono text-sm sm:text-base font-bold shadow-inner focus:outline-none transition-all"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold">↵ ENTER</span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" /> Add to Cart
                </button>

                {isCameraScannerAllowed && (
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs sm:text-sm rounded-xl border border-slate-700 shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                    title="Open camera barcode scanner"
                  >
                    <Camera className="w-4 h-4 text-orange-400" />
                    <span className="hidden sm:inline">Camera</span>
                  </button>
                )}
              </form>
            </div>

            {/* Main Full-Screen Layout */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 p-4 sm:p-6 overflow-hidden min-h-0 max-w-7xl mx-auto w-full">
              {/* LEFT 8 COLS: Large Cart Items Table / List */}
              <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-orange-600" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Full-Screen Cart Items ({cart.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Adjust quantity or remove items before proceeding to checkout
                  </span>
                </div>

                {cart.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/40">
                    <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mb-3">
                      <BarcodeIcon className="w-8 h-8" />
                    </div>
                    <h4 className="text-base font-bold text-slate-800">Cart is Empty in Full Screen</h4>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                      Scan product barcode with the laser reader or type the code in the scanner bar above to start adding items.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                    {cart.map((item, idx) => {
                      const isWeight = item.product.sellBy === 'weight' || item.product.unitType === 'kg' || Boolean(item.product.pricePerKg);
                      const qtyStep = isWeight ? 0.25 : 1;

                      return (
                        <div
                          key={item.product.id}
                          className="p-4 flex items-center justify-between gap-4 hover:bg-orange-50/30 transition-colors"
                        >
                          {/* Item Index & Picture */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-xs font-mono font-bold text-slate-400 w-5 text-right">
                              {idx + 1}.
                            </span>

                            {item.product.imageUrl ? (
                              <img
                                src={item.product.imageUrl}
                                alt={item.product.name}
                                className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                                <Package className="w-5 h-5" />
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-slate-900 text-sm truncate">
                                  {item.product.name}
                                </span>
                                {isWeight && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px] flex items-center gap-0.5">
                                    <Scale className="w-3 h-3" /> KG
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-2">
                                <span>Code: {item.product.barcode || item.product.serialNumber || 'N/A'}</span>
                                <span>•</span>
                                <span>Rate: Rs. {item.product.price.toFixed(2)}{isWeight ? '/kg' : ''}</span>
                              </div>
                            </div>
                          </div>

                          {/* Quantity Controls */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.product.id, Math.max(0, item.quantity - qtyStep))}
                              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-black flex items-center justify-center cursor-pointer transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>

                            <input
                              type="number"
                              step={isWeight ? "0.01" : "1"}
                              min="0"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val)) {
                                  handleUpdateQuantity(item.product.id, val);
                                }
                              }}
                              className="w-16 py-1 text-center font-mono font-black text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-orange-500"
                            />

                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.product.id, item.quantity + qtyStep)}
                              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-black flex items-center justify-center cursor-pointer transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Item Total Price */}
                          <div className="text-right min-w-[90px] shrink-0">
                            <div className="font-mono font-black text-sm text-orange-600">
                              Rs. {item.totalPrice.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {item.quantity} × Rs. {item.product.price.toFixed(2)}
                            </div>
                          </div>

                          {/* Delete Item */}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.product.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors shrink-0"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* RIGHT 4 COLS: Payment & Total Station */}
              <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-3 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-orange-600" />
                    Payment Summary
                  </h3>

                  {/* Pricing Breakdown */}
                  <div className="space-y-2.5 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal ({cart.length} {cart.length === 1 ? 'item' : 'items'})</span>
                      <span className="font-mono font-bold text-slate-900">Rs. {cartSubtotal.toFixed(2)}</span>
                    </div>

                    {/* Discount Configuration */}
                    <div className="pt-2 border-t border-slate-200/80">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-slate-700">Special Discount:</span>
                        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                          <button
                            type="button"
                            onClick={() => setDiscountType('percentage')}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${discountType === 'percentage' ? 'bg-orange-600 text-white' : 'text-slate-600'}`}
                          >
                            %
                          </button>
                          <button
                            type="button"
                            onClick={() => setDiscountType('fixed')}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${discountType === 'fixed' ? 'bg-orange-600 text-white' : 'text-slate-600'}`}
                          >
                            Rs.
                          </button>
                        </div>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Discount amount..."
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                      />
                    </div>

                    {discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold pt-1">
                        <span>Discount Saved</span>
                        <span className="font-mono">-Rs. {discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* Net Payable Grand Total */}
                  <div className="bg-orange-50 border-2 border-orange-200 p-4 rounded-2xl text-center space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-orange-900">
                      Net Total Payable
                    </span>
                    <div className="text-3xl font-black font-mono text-orange-600">
                      Rs. {cartTotal.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 pt-4">
                  <button
                    type="button"
                    disabled={cart.length === 0 || checkoutLoading}
                    onClick={() => setIsCashModalOpen(true)}
                    className="w-full py-3.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" /> Collect Cash & Checkout
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsCartFullScreen(false)}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="w-4 h-4" /> Exit Full Screen (Come Back)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
