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
  updateDoc,
  increment,
  runTransaction,
  handleFirestoreError,
  OperationType,
  cleanFirestoreData
} from '../lib/firebase';
import { Product, Store, UserAccount, CartItem, Sale, SaleItem, ProductReturn, HeldBill, DigitalPaymentMethodConfig, StoreBankAccount } from '../types';
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
import { getProductDiscountInfo, getEffectiveProductPrice } from '../utils/discountUtils';
import { speakMessage } from '../lib/speech';
import { playScanSuccessBeep, playScanErrorBeep } from '../lib/sound';
import { cleanupExpiredReceipts, isSaleExpired, getReceiptRemainingDays } from '../lib/salesCleanup';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { DownloadAppModal } from './DownloadAppModal';
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
  Keyboard, 
  Smartphone, 
  Check, 
  QrCode, 
  X,
  Download,
  Building2,
  Copy,
  Info,
  Landmark,
  CheckCheck,
  Star,
  Edit2,
  ShieldCheck
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
  const [recoveredBillPrompt, setRecoveredBillPrompt] = useState<HeldBill | null>(null);

  // Storage key for keeping an auto-saved draft during billing
  const draftStorageKey = useMemo(() => {
    return `martpro_active_cart_draft_${store?.id || 'default'}_${currentUser?.id || currentUser?.username || 'default'}`;
  }, [store?.id, currentUser?.id, currentUser?.username]);

  // Inbuilt Camera Scanner and Voice Announcements are controlled by Super Admin per store
  const isCameraScannerAllowed = store?.cameraScannerEnabled !== false;
  const isVoiceAllowed = store?.voiceAnnouncementEnabled !== false;

  // POS State
  const [barcodeInput, setBarcodeInput] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');
  const [selectedDigitalProvider, setSelectedDigitalProvider] = useState<string>('');
  const [digitalTransactionRef, setDigitalTransactionRef] = useState<string>('');
  const [viewingDigitalQr, setViewingDigitalQr] = useState<DigitalPaymentMethodConfig | null>(null);
  const [viewingBankQr, setViewingBankQr] = useState<StoreBankAccount | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const { isInstallable, isInstalled, install } = usePWAInstall();

  const handleDownloadClick = async () => {
    if (isInstallable) {
      try {
        const res = await install();
        if (res !== 'accepted') {
          setIsDownloadModalOpen(true);
        }
      } catch {
        setIsDownloadModalOpen(true);
      }
    } else {
      setIsDownloadModalOpen(true);
    }
  };

  // Active digital payment platforms configured by Admin (or defaults)
  const configuredDigitalMethods: DigitalPaymentMethodConfig[] = useMemo(() => {
    if (store?.digitalPaymentMethods && store.digitalPaymentMethods.length > 0) {
      const active = store.digitalPaymentMethods.filter(m => m.isActive !== false);
      if (active.length > 0) return active;
    }
    return [
      { id: 'method-card', name: 'Card', isActive: true, instructions: 'Debit / Credit Card POS swipe or tap' },
      { id: 'method-easypaisa', name: 'EasyPaisa', isActive: true, instructions: 'EasyPaisa mobile account transfer' },
      { id: 'method-jazzcash', name: 'JazzCash', isActive: true, instructions: 'JazzCash mobile account' },
      { id: 'method-sadapay', name: 'SadaPay', isActive: true, instructions: 'SadaPay mobile wallet' },
      { id: 'method-nayapay', name: 'NayaPay', isActive: true, instructions: 'NayaPay mobile wallet' },
      { id: 'method-bank', name: 'Raast / Bank Transfer', isActive: true, instructions: 'Direct Bank or Raast interbank' }
    ];
  }, [store?.digitalPaymentMethods]);

  // Custom / Manual Digital Payment method state
  const [isCustomDigitalSelected, setIsCustomDigitalSelected] = useState<boolean>(false);
  const [customDigitalProviderInput, setCustomDigitalProviderInput] = useState<string>('');

  // Active store bank accounts configured by Admin in Payment Method option
  const storeBankAccounts: StoreBankAccount[] = useMemo(() => {
    if (store?.bankAccounts && store.bankAccounts.length > 0) {
      const active = store.bankAccounts.filter(b => b.isActive !== false);
      if (active.length > 0) return active;
    }
    if (store?.bankAccount && store.bankAccount.isActive !== false) {
      return [store.bankAccount];
    }
    return [];
  }, [store?.bankAccounts, store?.bankAccount]);

  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [copiedBankKey, setCopiedBankKey] = useState<string | null>(null);

  useEffect(() => {
    if (storeBankAccounts.length > 0) {
      const primary = storeBankAccounts.find(b => b.isPrimary) || storeBankAccounts[0];
      setSelectedBankAccountId(primary.id);
    }
  }, [storeBankAccounts]);

  const activeBankAccount = useMemo(() => {
    return storeBankAccounts.find(b => b.id === selectedBankAccountId) || storeBankAccounts[0] || null;
  }, [storeBankAccounts, selectedBankAccountId]);

  const handleCopyBankAccountField = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedBankKey(key);
    setTimeout(() => setCopiedBankKey(null), 2500);
    showNotification('success', `Copied "${text}" to clipboard!`);
  };

  // Auto-select first active platform if none selected
  useEffect(() => {
    if (!selectedDigitalProvider && configuredDigitalMethods.length > 0) {
      setSelectedDigitalProvider(configuredDigitalMethods[0].name);
    }
  }, [configuredDigitalMethods, selectedDigitalProvider]);

  // Helper to format styling and icons for each payment method
  const getPaymentMethodMeta = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('cash') && !n.includes('jazz')) {
      return {
        icon: Banknote,
        color: 'emerald',
        bgClass: 'bg-emerald-50/90 text-emerald-900 border-emerald-200 hover:border-emerald-400',
        activeClass: 'bg-emerald-600 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-400/40 font-bold'
      };
    }
    if (n.includes('card') || n.includes('pos') || n.includes('visa') || n.includes('master')) {
      return {
        icon: CreditCard,
        color: 'indigo',
        bgClass: 'bg-indigo-50/90 text-indigo-950 border-indigo-200 hover:border-indigo-400',
        activeClass: 'bg-indigo-600 text-white border-indigo-700 shadow-sm ring-2 ring-indigo-400/40 font-bold'
      };
    }
    if (n.includes('easy') || n.includes('paisa')) {
      return {
        icon: Smartphone,
        color: 'emerald',
        bgClass: 'bg-emerald-50/90 text-emerald-950 border-emerald-200 hover:border-emerald-400',
        activeClass: 'bg-emerald-600 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-400/40 font-bold'
      };
    }
    if (n.includes('jazz')) {
      return {
        icon: Smartphone,
        color: 'amber',
        bgClass: 'bg-amber-50/90 text-amber-950 border-amber-200 hover:border-amber-400',
        activeClass: 'bg-amber-600 text-white border-amber-700 shadow-sm ring-2 ring-amber-400/40 font-bold'
      };
    }
    if (n.includes('sada')) {
      return {
        icon: Smartphone,
        color: 'teal',
        bgClass: 'bg-teal-50/90 text-teal-950 border-teal-200 hover:border-teal-400',
        activeClass: 'bg-teal-600 text-white border-teal-700 shadow-sm ring-2 ring-teal-400/40 font-bold'
      };
    }
    if (n.includes('naya')) {
      return {
        icon: Smartphone,
        color: 'orange',
        bgClass: 'bg-orange-50/90 text-orange-950 border-orange-200 hover:border-orange-400',
        activeClass: 'bg-orange-600 text-white border-orange-700 shadow-sm ring-2 ring-orange-400/40 font-bold'
      };
    }
    if (n.includes('bank') || n.includes('raast') || n.includes('hbl') || n.includes('meezan') || n.includes('mcb')) {
      return {
        icon: Landmark,
        color: 'violet',
        bgClass: 'bg-violet-50/90 text-violet-950 border-violet-200 hover:border-violet-400',
        activeClass: 'bg-violet-600 text-white border-violet-700 shadow-sm ring-2 ring-violet-400/40 font-bold'
      };
    }
    return {
      icon: CreditCard,
      color: 'blue',
      bgClass: 'bg-blue-50/90 text-blue-950 border-blue-200 hover:border-blue-400',
      activeClass: 'bg-blue-600 text-white border-blue-700 shadow-sm ring-2 ring-blue-400/40 font-bold'
    };
  };

  // Selected Digital Payment Method configuration (instructions, QR)
  const selectedMethodConfig = useMemo(() => {
    return configuredDigitalMethods.find(m => m.name.toLowerCase().trim() === selectedDigitalProvider.toLowerCase().trim()) || null;
  }, [configuredDigitalMethods, selectedDigitalProvider]);

  // Weight Entry Modal State
  const [weightPromptProduct, setWeightPromptProduct] = useState<Product | null>(null);
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);

  // Manual Quantity Modal State
  const [manualQtyItem, setManualQtyItem] = useState<CartItem | null>(null);
  const [manualQtyInput, setManualQtyInput] = useState<string>('');
  const [isManualQtyModalOpen, setIsManualQtyModalOpen] = useState(false);

  const openManualQtyModal = (item: CartItem) => {
    setManualQtyItem(item);
    setManualQtyInput(String(item.quantity));
    setIsManualQtyModalOpen(true);
  };

  const handleSaveManualQty = () => {
    if (!manualQtyItem) return;
    const val = parseFloat(manualQtyInput);
    if (!isNaN(val) && val >= 0) {
      handleUpdateQuantity(manualQtyItem.product.id, val);
      setIsManualQtyModalOpen(false);
      setManualQtyItem(null);
    } else {
      showNotification('error', 'Please enter a valid quantity.');
    }
  };

  // Return Product State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isReturnSlipOpen, setIsReturnSlipOpen] = useState(false);
  const [completedReturn, setCompletedReturn] = useState<ProductReturn | null>(null);

  // Notifications & Modals
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [selectedReceiptType, setSelectedReceiptType] = useState<'print' | 'ereceipt'>('print');
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Full Screen Cart State
  const [isCartFullScreen, setIsCartFullScreen] = useState(false);
  const [fullScreenScanInput, setFullScreenScanInput] = useState('');
  const [showFullScreenShortcuts, setShowFullScreenShortcuts] = useState(false);
  const [fullScreenShortcutSearch, setFullScreenShortcutSearch] = useState('');
  const [fullScreenCategory, setFullScreenCategory] = useState<string>('all');
  const [scannerLastScannedStatus, setScannerLastScannedStatus] = useState<string | null>(null);
  const isProcessingScanRef = useRef<boolean>(false);
  const fullScreenScanInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus input when entering full screen or cart updates
  useEffect(() => {
    if (isCartFullScreen) {
      const timer = setTimeout(() => {
        fullScreenScanInputRef.current?.focus();
      }, 100);
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

        const effectiveRate = getEffectiveProductPrice(product) || product.price || product.pricePerKg || 0;
        updated[existingIdx] = {
          ...updated[existingIdx],
          product: product,
          quantity: newQty,
          totalPrice: Math.round(newQty * effectiveRate * 100) / 100
        };
        showNotification('success', `Updated "${product.name}" in bill (${newQty.toFixed(3)} kg total)`);
        return updated;
      } else {
        const effectiveRate = getEffectiveProductPrice(product) || product.price || product.pricePerKg || 0;
        const finalCalculatedPrice = Math.round(quantityInKg * effectiveRate * 100) / 100;
        showNotification('success', `Added "${product.name}" (${qtyDisplay} kg) for Rs. ${finalCalculatedPrice.toFixed(2)}`);
        return [
          ...prevCart,
          {
            product: product,
            quantity: quantityInKg,
            totalPrice: finalCalculatedPrice
          }
        ];
      }
    });

    setBarcodeInput('');
  }, [isVoiceAllowed, voiceEnabled]);

  // Reliable autofocus helper that works in both standard mode and full-screen station
  const focusActiveScanner = useCallback(() => {
    const doFocus = () => {
      if (isCartFullScreen) {
        if (fullScreenScanInputRef.current) {
          fullScreenScanInputRef.current.focus();
        }
      } else {
        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus();
        }
      }
    };

    doFocus();
    requestAnimationFrame(doFocus);
    setTimeout(doFocus, 25);
    setTimeout(doFocus, 80);
    setTimeout(doFocus, 180);
  }, [isCartFullScreen]);

  const ensureBarcodeFocus = useCallback(() => {
    focusActiveScanner();
  }, [focusActiveScanner]);

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
      setFullScreenScanInput('');
      if (barcodeInputRef.current) barcodeInputRef.current.value = '';
      if (fullScreenScanInputRef.current) fullScreenScanInputRef.current.value = '';
      ensureBarcodeFocus();
      return;
    }

    if (found.stockQuantity <= 0) {
      playScanErrorBeep();
      showNotification('error', `"${found.name}" is OUT OF STOCK! (0 units available).`);
      if (isVoiceAllowed && voiceEnabled) {
        speakMessage(`${found.name} is out of stock`);
      }
      setBarcodeInput('');
      setFullScreenScanInput('');
      if (barcodeInputRef.current) barcodeInputRef.current.value = '';
      if (fullScreenScanInputRef.current) fullScreenScanInputRef.current.value = '';
      ensureBarcodeFocus();
      return;
    }

    // CHECK IF PRODUCT IS SOLD BY WEIGHT
    const isWeightProduct = found.sellBy === 'weight' || found.unitType === 'kg' || Boolean(found.pricePerKg);
    if (isWeightProduct) {
      // Open weight prompt modal for cashier to enter exact scale weight or pack count
      setWeightPromptProduct(found);
      setIsWeightModalOpen(true);
      setBarcodeInput('');
      setFullScreenScanInput('');
      if (barcodeInputRef.current) barcodeInputRef.current.value = '';
      if (fullScreenScanInputRef.current) fullScreenScanInputRef.current.value = '';
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
      const effectiveRate = getEffectiveProductPrice(found!) || found!.price || 0;
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
          totalPrice: Math.round(newQty * effectiveRate * 100) / 100
        };
        showNotification('success', `Incremented "${found!.name}" in list (Qty: ${newQty})`);
        return updated;
      } else {
        showNotification('success', `Matched & added "${found!.name}" to list (Rs. ${effectiveRate.toFixed(2)})`);
        return [
          ...prevCart,
          {
            product: found!,
            quantity: 1,
            totalPrice: effectiveRate
          }
        ];
      }
    });

    setBarcodeInput('');
    setFullScreenScanInput('');
    if (barcodeInputRef.current) barcodeInputRef.current.value = '';
    if (fullScreenScanInputRef.current) fullScreenScanInputRef.current.value = '';
    ensureBarcodeFocus();
  }, [products, isVoiceAllowed, voiceEnabled, ensureBarcodeFocus]);

  // Dedicated seamless scanner processor for Full Screen Mode:
  // After scanning 1st product, immediately cleans & readies area for second product
  // so cashier never needs to move cursor or click on that area.
  const handleProcessFullScreenScan = useCallback((forcedCode?: string) => {
    if (isProcessingScanRef.current) return;
    
    const inputVal = forcedCode !== undefined 
      ? forcedCode 
      : (fullScreenScanInputRef.current?.value || fullScreenScanInput || '');
    const cleanVal = inputVal.replace(/[\r\n\t]/g, '').trim();

    if (!cleanVal) {
      if (fullScreenScanInputRef.current) {
        fullScreenScanInputRef.current.value = '';
        fullScreenScanInputRef.current.focus();
      }
      setFullScreenScanInput('');
      return;
    }

    isProcessingScanRef.current = true;

    // Immediately clear DOM value and state before processing so any follow-up keystrokes start on fresh input
    if (fullScreenScanInputRef.current) {
      fullScreenScanInputRef.current.value = '';
    }
    setFullScreenScanInput('');

    // Process product add
    handleAddByBarcode(cleanVal, true);

    // Provide instant visual confirmation that scanner is armed & ready for next item
    setScannerLastScannedStatus(`Scanned "${cleanVal}" • Ready for next product`);
    setTimeout(() => {
      setScannerLastScannedStatus(null);
    }, 2000);

    // Multi-phase focus retention and suffix clearing (catches asynchronous scanner \r\n suffixes)
    const refocusAndWipe = () => {
      if (fullScreenScanInputRef.current) {
        fullScreenScanInputRef.current.value = '';
        fullScreenScanInputRef.current.focus();
      }
      setFullScreenScanInput('');
    };

    refocusAndWipe();
    requestAnimationFrame(refocusAndWipe);
    setTimeout(refocusAndWipe, 30);
    setTimeout(refocusAndWipe, 80);
    setTimeout(refocusAndWipe, 160);
    setTimeout(() => {
      refocusAndWipe();
      isProcessingScanRef.current = false;
    }, 250);
  }, [fullScreenScanInput, handleAddByBarcode]);

  // Auto focus active barcode input for fast hardware USB barcode scanner support
  useEffect(() => {
    const isAnyModalOpen = isScannerOpen || isReceiptOpen || isReturnModalOpen || isReturnSlipOpen || isCashModalOpen || isWeightModalOpen || isHeldBillsModalOpen || isShortcutsModalOpen || Boolean(viewingDigitalQr) || Boolean(viewingBankQr);
    if (!isAnyModalOpen) {
      focusActiveScanner();
    }
  }, [isScannerOpen, isReceiptOpen, isReturnModalOpen, isReturnSlipOpen, isCashModalOpen, isWeightModalOpen, isHeldBillsModalOpen, isShortcutsModalOpen, viewingDigitalQr, viewingBankQr, isCartFullScreen, cart.length, focusActiveScanner]);

  // Keep scanning area in full-screen mode continuously ready after adding items
  useEffect(() => {
    if (isCartFullScreen) {
      focusActiveScanner();
      const timer = setTimeout(focusActiveScanner, 60);
      return () => clearTimeout(timer);
    }
  }, [cart, isCartFullScreen, focusActiveScanner]);

  // Continuous click-retention in full screen so cashier never has to move cursor or click
  useEffect(() => {
    if (!isCartFullScreen) return;

    const handleWindowClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const isAnyModalOpen = isScannerOpen || isReceiptOpen || isReturnModalOpen || isReturnSlipOpen || isCashModalOpen || isWeightModalOpen || isHeldBillsModalOpen || isShortcutsModalOpen || Boolean(viewingDigitalQr) || Boolean(viewingBankQr);
      if (isAnyModalOpen) return;

      const isInteractive = target.closest('button, input, select, textarea, a, [role="button"]');
      if (isInteractive) return;

      focusActiveScanner();
    };

    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, [isCartFullScreen, isScannerOpen, isReceiptOpen, isReturnModalOpen, isReturnSlipOpen, isCashModalOpen, isWeightModalOpen, isHeldBillsModalOpen, isShortcutsModalOpen, viewingDigitalQr, viewingBankQr, focusActiveScanner]);

  // External Hardware Barcode Scanner Listener (Hands-free continuous scanning without clicking any button)
  useEffect(() => {
    const isAnyModalOpen = isScannerOpen || isReceiptOpen || isReturnModalOpen || isReturnSlipOpen || isCashModalOpen || isWeightModalOpen || isHeldBillsModalOpen || isShortcutsModalOpen || Boolean(viewingDigitalQr) || Boolean(viewingBankQr);
    if (isAnyModalOpen) {
      return;
    }

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const tagName = activeEl?.tagName?.toUpperCase();
      const isInputActive = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
      const isScannerInput = activeEl === barcodeInputRef.current || activeEl === fullScreenScanInputRef.current;
      
      // If user is actively typing in ANY OTHER input field (e.g. search, modal), skip auto-scanner buffer
      if (isInputActive && !isScannerInput) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTimestampRef.current;
      lastKeyTimestampRef.current = now;

      // When Enter is received from external scanner or keyboard
      if (e.key === 'Enter') {
        if (isCartFullScreen && activeEl === fullScreenScanInputRef.current) {
          // Handled directly by input onKeyDown/onSubmit, do not process twice
          return;
        }

        const scannedText = isScannerInput
          ? ((activeEl as HTMLInputElement)?.value || (isCartFullScreen ? fullScreenScanInput : barcodeInput) || '').trim()
          : scannerBufferRef.current.trim();

        if (scannedText) {
          e.preventDefault();
          if (isCartFullScreen) {
            handleProcessFullScreenScan(scannedText);
          } else {
            handleAddByBarcode(scannedText, true);
          }
          scannerBufferRef.current = '';
          setBarcodeInput('');
          setFullScreenScanInput('');
          if (barcodeInputRef.current) barcodeInputRef.current.value = '';
          if (fullScreenScanInputRef.current) {
            fullScreenScanInputRef.current.value = '';
            fullScreenScanInputRef.current.focus();
          }
          focusActiveScanner();
        }
        return;
      }

      // If key is printable character and user is NOT typing in an active input field
      if (!isInputActive && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (timeDiff > 250) {
          scannerBufferRef.current = e.key;
        } else {
          scannerBufferRef.current += e.key;
        }

        // Always keep focus inside active scanner input
        if (isCartFullScreen) {
          if (fullScreenScanInputRef.current) {
            fullScreenScanInputRef.current.focus();
          }
        } else {
          if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isCashModalOpen, isReceiptOpen, isReturnModalOpen, isReturnSlipOpen, isScannerOpen, barcodeInput, fullScreenScanInput, isCartFullScreen, handleAddByBarcode, handleProcessFullScreenScan, focusActiveScanner]);

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
    const effectivePrice = getEffectiveProductPrice(liveProd) || liveProd.price || liveProd.pricePerKg || itemInCart.product.price;

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

  // Calculate Subtotal & Payable Grand Total
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [cart]);

  const cartTotal = useMemo(() => {
    return cartSubtotal;
  }, [cartSubtotal]);

  const cartRef = useRef(cart);
  cartRef.current = cart;
  const cartSubtotalRef = useRef(cartSubtotal);
  cartSubtotalRef.current = cartSubtotal;
  const cartTotalRef = useRef(cartTotal);
  cartTotalRef.current = cartTotal;

  // Real-time synchronization of billing cart to localStorage to safeguard against sudden power loss, shutdown, or accidental logout
  useEffect(() => {
    try {
      if (cart.length > 0) {
        localStorage.setItem(draftStorageKey, JSON.stringify({
          items: cart,
          subtotal: cartSubtotal,
          total: cartTotal,
          timestamp: new Date().toISOString(),
          counterNumber: currentUser.counterNumber,
          cashierUsername: currentUser.username,
          storeId: store.id
        }));
      } else {
        localStorage.removeItem(draftStorageKey);
      }
    } catch (err) {
      console.warn('Error saving billing draft to localStorage:', err);
    }
  }, [cart, cartSubtotal, cartTotal, draftStorageKey, currentUser, store.id]);

  // Window beforeunload & pagehide event protection for shutdown / tab close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (cartRef.current && cartRef.current.length > 0) {
        try {
          localStorage.setItem(draftStorageKey, JSON.stringify({
            items: cartRef.current,
            subtotal: cartSubtotalRef.current,
            total: cartTotalRef.current,
            timestamp: new Date().toISOString(),
            counterNumber: currentUser.counterNumber,
            cashierUsername: currentUser.username,
            storeId: store.id,
            isAutoHeld: true
          }));
        } catch (err) {
          console.warn(err);
        }
        e.preventDefault();
        e.returnValue = 'You have an active receipt in progress. It will be automatically held.';
        return e.returnValue;
      }
    };

    const handlePageHide = () => {
      if (cartRef.current && cartRef.current.length > 0) {
        try {
          localStorage.setItem(draftStorageKey, JSON.stringify({
            items: cartRef.current,
            subtotal: cartSubtotalRef.current,
            total: cartTotalRef.current,
            timestamp: new Date().toISOString(),
            counterNumber: currentUser.counterNumber,
            cashierUsername: currentUser.username,
            storeId: store.id,
            isAutoHeld: true
          }));
        } catch (err) {
          console.warn(err);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [draftStorageKey, currentUser, store.id]);

  // Check for recovered draft from shutdown / unexpected close upon initial component mount
  useEffect(() => {
    const checkAndRecoverUnfinishedBill = async () => {
      try {
        const rawDraft = localStorage.getItem(draftStorageKey);
        if (!rawDraft) return;
        const draft = JSON.parse(rawDraft);
        if (draft.items && draft.items.length > 0) {
          const heldId = `autoheld_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const payload: HeldBill = {
            id: heldId,
            storeId: store.id,
            counterId: currentUser.counterNumber?.toString() || '1',
            counterName: `Counter #${currentUser.counterNumber || 1}`,
            cashierUsername: currentUser.username,
            items: draft.items,
            subtotal: draft.subtotal || 0,
            total: draft.total || 0,
            heldAt: draft.timestamp || new Date().toISOString(),
            isAutoHeld: true,
            notes: 'Auto-held after computer shutdown / session exit'
          };

          // Save to Firestore held_bills
          await setDoc(doc(db, 'held_bills', heldId), payload);
          // Clear local draft now that it's safely in Firestore
          localStorage.removeItem(draftStorageKey);

          setRecoveredBillPrompt(payload);
          showNotification('success', `Unfinished receipt with ${draft.items.length} items was automatically held for safety!`);
        }
      } catch (err) {
        console.warn('Error recovering unfinished bill:', err);
      }
    };

    checkAndRecoverUnfinishedBill();
  }, [draftStorageKey, store.id, currentUser]);

  // Handle back button with auto-hold
  const handleBackWithAutoHold = async () => {
    if (cart.length > 0) {
      try {
        const heldId = `autoheld_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const payload: HeldBill = {
          id: heldId,
          storeId: store.id,
          counterId: currentUser.counterNumber?.toString() || '1',
          counterName: `Counter #${currentUser.counterNumber || 1}`,
          cashierUsername: currentUser.username,
          items: [...cart],
          subtotal: cartSubtotal,
          total: cartTotal,
          heldAt: new Date().toISOString(),
          isAutoHeld: true,
          notes: 'Auto-held when exiting counter'
        };
        await setDoc(doc(db, 'held_bills', heldId), payload);
        localStorage.removeItem(draftStorageKey);
      } catch (err) {
        console.warn('Auto-holding bill on exit error:', err);
      }
    }
    if (onBack) onBack();
  };

  // Extract unique categories for shortcuts directory & full screen tray
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  // Filter products for full screen 4-digit shortcuts quick-access tray
  const fullScreenFilteredProducts = useMemo(() => {
    const term = fullScreenShortcutSearch.trim().toLowerCase();
    return products.filter(p => {
      const matchesCategory = fullScreenCategory === 'all' || p.category === fullScreenCategory;
      if (!matchesCategory) return false;
      if (!term) return true;
      return (
        p.shortcutCode?.toLowerCase().includes(term) ||
        p.name?.toLowerCase().includes(term) ||
        p.barcode?.toLowerCase().includes(term) ||
        p.category?.toLowerCase().includes(term)
      );
    });
  }, [products, fullScreenShortcutSearch, fullScreenCategory]);

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
        total: cartTotal,
        heldAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'held_bills', heldId), payload);
      setCart([]);
      localStorage.removeItem(draftStorageKey);
      playScanSuccessBeep();
      showNotification('success', `Bill held successfully (${payload.items.length} items)! Press A+S to resume.`);
      if (isVoiceAllowed && voiceEnabled) {
        speakMessage('Bill held');
      }
    } catch (err: any) {
      console.error('Error holding bill:', err);
      showNotification('error', 'Failed to hold bill: ' + err.message);
    }
  }, [cart, cartSubtotal, cartTotal, store.id, currentUser, isVoiceAllowed, voiceEnabled, draftStorageKey]);

  // Restore Parked Bill to Active Cart
  const handleRestoreBill = useCallback(async (bill: HeldBill) => {
    try {
      setCart(bill.items);
      setRecoveredBillPrompt(null);

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

  // Resume the auto-recovered bill prompt
  const handleResumeRecoveredBill = async () => {
    if (!recoveredBillPrompt) return;
    await handleRestoreBill(recoveredBillPrompt);
    setRecoveredBillPrompt(null);
  };

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
      if (pressedKeys.has('R') && pressedKeys.has('N')) {
        e.preventDefault();
        pressedKeys.clear();
        setIsReturnModalOpen(true);
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
        if (combo === 'RN') {
          e.preventDefault();
          setIsReturnModalOpen(true);
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
      const activeProvider = isCustomDigitalSelected
        ? (customDigitalProviderInput.trim() || 'Other Digital')
        : (selectedDigitalProvider || (configuredDigitalMethods[0]?.name || 'Card'));

      if (!activeProvider) {
        showNotification('error', 'Please select or enter a digital payment platform (e.g. Card, EasyPaisa, JazzCash).');
        return;
      }
      setSelectedDigitalProvider(activeProvider);
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
        costPrice: item.product.costPrice !== undefined ? item.product.costPrice : 0,
        price: item.product.price || item.product.pricePerKg || 0,
        quantity: item.quantity || 1,
        total: Math.round(item.totalPrice * 100) / 100,
        sellBy: item.product.sellBy || (item.product.unitType === 'kg' ? 'weight' : 'unit'),
        unitType: item.product.unitType || (item.product.sellBy === 'weight' ? 'kg' : 'piece'),
        weightInfo: item.product.weight || (item.product.sellBy === 'weight' ? `${item.quantity} kg` : undefined)
      }));

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

        // 2. Create Sale Record
        const finalDigitalProvider = isCustomDigitalSelected
          ? (customDigitalProviderInput.trim() || 'Other Digital')
          : (selectedDigitalProvider || (configuredDigitalMethods[0]?.name || 'Card'));

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

        if (paymentMethod === 'cash') {
          saleRecordData.cashReceived = cashReceived ?? cartTotal;
          saleRecordData.changeReturned = changeReturned ?? 0;
        } else {
          saleRecordData.onlinePaymentProvider = finalDigitalProvider;
          if (digitalTransactionRef.trim()) {
            saleRecordData.onlineTransactionId = digitalTransactionRef.trim();
          }
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
        totalAmount: cartTotal,
        paymentMethod: paymentMethod,
        onlinePaymentProvider: paymentMethod === 'online' ? (selectedDigitalProvider || 'Online / Digital') : undefined,
        onlineTransactionId: paymentMethod === 'online' && digitalTransactionRef.trim() ? digitalTransactionRef.trim() : undefined,
        cashReceived: paymentMethod === 'cash' ? (cashReceived ?? cartTotal) : undefined,
        changeReturned: paymentMethod === 'cash' ? (changeReturned ?? 0) : undefined,
        receiptNumber: receiptNum,
        timestamp: nowIso
      };

      // Increment live staff session statistics for current active session
      const activeSessionId = localStorage.getItem('martpro_current_session_id');
      if (activeSessionId) {
        try {
          const sessRef = doc(db, 'staff_sessions', activeSessionId);
          await updateDoc(sessRef, {
            totalSalesCount: increment(1),
            totalSalesAmount: increment(cartTotal || 0),
            lastActive: nowIso
          });
        } catch (sessErr) {
          console.warn('Could not increment staff session sales:', sessErr);
        }
      }

      setIsCashModalOpen(false);
      setCompletedSale(completedSaleData);
      setIsReceiptOpen(true);
      setCart([]);
      
      // Voice & Text Thank You greeting with Total Bill Amount & Change Return for purchase according to store name
      const storeName = store.name || 'our store';
      const formattedTotal = cartTotal % 1 === 0 ? cartTotal.toFixed(0) : cartTotal.toFixed(2);
      const hasChange = paymentMethod === 'cash' && (changeReturned ?? 0) > 0;
      const formattedChange = ((changeReturned || 0) % 1 === 0) ? (changeReturned || 0).toFixed(0) : (changeReturned || 0).toFixed(2);

      let successMsg = `🎉 Sale Completed! Total: Rs. ${formattedTotal}.`;
      if (hasChange) {
        successMsg += ` Pay Back Change: Rs. ${formattedChange} to customer.`;
      }
      successMsg += ` Transaction #${receiptNum}.`;

      showNotification('success', successMsg);

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
    <div className="min-h-screen h-full bg-slate-50 text-slate-900 p-3 sm:p-5 lg:p-6 overflow-y-auto overscroll-contain custom-scrollbar touch-pan-y">
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
              <UniversalBackButton onBack={handleBackWithAutoHold} label="Back to Dashboard" />
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
              title="Process product return, restock item to inventory, and issue customer refund (Shortcut: R + N)"
            >
              <RotateCcw className="w-4 h-4 text-rose-600" />
              <span>Return / Refund Item</span>
              <span className="px-1.5 py-0.2 rounded-md bg-rose-200 text-rose-900 text-[10px] font-mono font-black">
                R+N
              </span>
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

        {/* Auto-Held Receipt Recovery Banner (when recovering from computer shutdown, power loss, or logout) */}
        {recoveredBillPrompt && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 border-2 border-amber-400/80 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 font-black text-[10px] uppercase tracking-wide">
                    Auto-Protected Receipt
                  </span>
                  <span className="text-xs text-amber-900 font-bold">
                    Safely Held on Computer Shutdown / Logout
                  </span>
                </div>
                <p className="text-xs text-slate-700 mt-0.5">
                  An unfinished receipt with <strong>{recoveredBillPrompt.items.length} items</strong> (Total: <strong>Rs. {Number(recoveredBillPrompt.total || 0).toFixed(2)}</strong>) was safely preserved in your Held Receipts queue.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleResumeRecoveredBill}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Resume This Bill</span>
              </button>

              <button
                type="button"
                onClick={() => setRecoveredBillPrompt(null)}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition-colors cursor-pointer"
              >
                Keep in Queue
              </button>
            </div>
          </motion.div>
        )}

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
                  ensureBarcodeFocus();
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1 group">
                  <input
                    id="barcode-hardware-input"
                    ref={barcodeInputRef}
                    type="text"
                    autoFocus={!isCartFullScreen}
                    tabIndex={isCartFullScreen ? -1 : 1}
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
                {isCameraScannerAllowed && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="px-3.5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-sm transition-all cursor-pointer text-sm shrink-0 flex items-center gap-1.5 border border-slate-800"
                    title="Open Camera Barcode Scanner"
                  >
                    <Camera className="w-4 h-4 text-orange-400" />
                    <span className="hidden sm:inline">Camera</span>
                  </motion.button>
                )}
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
                            <div className="flex items-center gap-1.5 flex-wrap">
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
                              {(() => {
                                const discInfo = getProductDiscountInfo(item.product);
                                if (discInfo.hasDiscount) {
                                  return (
                                    <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 font-extrabold text-[9px] uppercase tracking-wide border border-rose-200">
                                      {discInfo.discountLabel}
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                              <span className="font-bold text-slate-900 text-xs truncate">{item.product.name}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                              {(() => {
                                const discInfo = getProductDiscountInfo(item.product);
                                if (discInfo.hasDiscount) {
                                  return (
                                    <>
                                      <span className="line-through text-slate-400">Rs. {discInfo.basePrice.toFixed(2)}</span>
                                      <span className="text-rose-600 font-black">Rs. {discInfo.effectivePrice.toFixed(2)}{isWeight ? '/kg' : ' each'}</span>
                                    </>
                                  );
                                }
                                return (
                                  <span>Rs. {item.product.price.toFixed(2)}{isWeight ? '/kg' : ' each'}</span>
                                );
                              })()}
                              <span>•</span>
                              <span className="text-emerald-700 font-semibold">Stock: {item.product.stockQuantity}{isWeight ? 'kg' : ''}</span>
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
                              className="w-12 text-center bg-transparent text-slate-900 font-black text-xs focus:outline-none font-mono"
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

                            <button
                              type="button"
                              onClick={() => openManualQtyModal(item)}
                              className="px-2 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 font-black text-[10px] transition-colors cursor-pointer flex items-center gap-0.5 shadow-2xs"
                              title="Enter exact manual quantity"
                            >
                              <Calculator className="w-3 h-3" />
                              <span>Qty</span>
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

            {/* PAYMENT METHOD & TOTAL SUMMARY */}
            <div className="pt-4 border-t border-slate-200 space-y-4">
              
              {/* Payment Method Selector (All Admin-Selected & Configured Methods) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Payment Method
                  </label>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                    {configuredDigitalMethods.length + 1} Admin Configured
                  </span>
                </div>

                {/* Direct Grid of All Payment Methods (Cash + All Admin-Configured Digital Platforms + Other) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {/* 1. CASH PAYMENT */}
                  <button
                    id="btn-payment-cash"
                    type="button"
                    onClick={() => {
                      setPaymentMethod('cash');
                      setIsCustomDigitalSelected(false);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                      paymentMethod === 'cash'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400/40 font-bold'
                        : 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-400 text-emerald-950'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <Banknote className={`w-4 h-4 ${paymentMethod === 'cash' ? 'text-white' : 'text-emerald-600'}`} />
                      {paymentMethod === 'cash' && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className="font-extrabold text-xs truncate">Cash</div>
                    <div className={`text-[10px] truncate ${paymentMethod === 'cash' ? 'text-emerald-100' : 'text-slate-400'}`}>
                      Physical Cash
                    </div>
                  </button>

                  {/* 2. ALL ADMIN-CONFIGURED DIGITAL METHODS (Card, EasyPaisa, JazzCash, SadaPay, etc.) */}
                  {configuredDigitalMethods.map((method) => {
                    const isSelected = paymentMethod === 'online' && !isCustomDigitalSelected && selectedDigitalProvider.toLowerCase().trim() === method.name.toLowerCase().trim();
                    const meta = getPaymentMethodMeta(method.name);
                    const IconComponent = meta.icon;

                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => {
                          setPaymentMethod('online');
                          setIsCustomDigitalSelected(false);
                          setSelectedDigitalProvider(method.name);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                          isSelected
                            ? meta.activeClass
                            : `${meta.bgClass}`
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <IconComponent className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-600'}`} />
                          <div className="flex items-center gap-1">
                            {method.qrCodeUrl && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingDigitalQr(method);
                                }}
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0 ${
                                  isSelected
                                    ? 'bg-white/20 text-white hover:bg-white/30'
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                }`}
                                title="View QR Code"
                              >
                                <QrCode className="w-3 h-3" /> QR
                              </button>
                            )}
                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                          </div>
                        </div>
                        <div className="font-extrabold text-xs truncate">{method.name}</div>
                        <div className={`text-[10px] truncate ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                          {method.instructions || 'Digital Payment'}
                        </div>
                      </button>
                    );
                  })}

                  {/* 3. OTHER / CUSTOM MANUAL METHOD */}
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('online');
                      setIsCustomDigitalSelected(true);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                      paymentMethod === 'online' && isCustomDigitalSelected
                        ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-400/40 font-bold'
                        : 'bg-slate-50 border-dashed border-slate-300 hover:border-blue-400 text-slate-700 hover:bg-blue-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <Edit2 className={`w-4 h-4 ${paymentMethod === 'online' && isCustomDigitalSelected ? 'text-white' : 'text-slate-500'}`} />
                      {paymentMethod === 'online' && isCustomDigitalSelected && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className="font-extrabold text-xs truncate">Other / Manual</div>
                    <div className={`text-[10px] truncate ${paymentMethod === 'online' && isCustomDigitalSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                      Custom Method
                    </div>
                  </button>
                </div>

                {/* ACTIVE DIGITAL METHOD DETAILS (INSTRUCTIONS, QR PREVIEW & TRX ID) */}
                {paymentMethod === 'online' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl space-y-3"
                  >
                    {/* Manual name entry if "Other" is chosen */}
                    {isCustomDigitalSelected ? (
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black uppercase text-blue-900">
                          Custom Payment Method Name *
                        </label>
                        <input
                          type="text"
                          autoFocus
                          placeholder="e.g. Voucher, Gift Card, Cheque, Custom POS..."
                          value={customDigitalProviderInput}
                          onChange={(e) => setCustomDigitalProviderInput(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ) : (
                      selectedMethodConfig && (
                        <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-blue-200">
                          <div>
                            <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                              <span>{selectedMethodConfig.name}</span>
                              <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-bold">
                                Active Method
                              </span>
                            </div>
                            {selectedMethodConfig.instructions && (
                              <div className="text-[11px] text-slate-600 mt-0.5">
                                {selectedMethodConfig.instructions}
                              </div>
                            )}
                          </div>
                          {selectedMethodConfig.qrCodeUrl && (
                            <button
                              type="button"
                              onClick={() => setViewingDigitalQr(selectedMethodConfig)}
                              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <QrCode className="w-3.5 h-3.5" /> View QR
                            </button>
                          )}
                        </div>
                      )
                    )}

                    {/* Optional Reference / Transaction ID Input */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">
                        Transaction Ref / TRX ID (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. TRX-982183 or Sender Phone"
                        value={digitalTransactionRef}
                        onChange={(e) => setDigitalTransactionRef(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Total Calculation Display Breakdown */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-2 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Payable Grand Total</span>
                    <span className="text-[10px] text-slate-400 font-medium">({cart.length} {cart.length === 1 ? 'item' : 'items'} in bill)</span>
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

        {/* Digital Payment Provider QR & Account Details Modal */}
        {viewingDigitalQr && (
          <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-4 animate-scale-up my-auto max-h-[92vh] overflow-y-auto overscroll-contain custom-scrollbar">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-black text-slate-900">{viewingDigitalQr.name} Payment</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingDigitalQr(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {viewingDigitalQr.qrCodeUrl ? (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 inline-block">
                  <img
                    src={viewingDigitalQr.qrCodeUrl}
                    alt={`${viewingDigitalQr.name} QR`}
                    className="w-56 h-56 object-contain mx-auto rounded-xl shadow-xs"
                  />
                </div>
              ) : (
                <div className="py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400 text-xs">
                  <QrCode className="w-12 h-12 mx-auto mb-2 opacity-50 text-slate-400" />
                  No QR picture uploaded for {viewingDigitalQr.name}.
                </div>
              )}

              {viewingDigitalQr.instructions && (
                <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200 text-left text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Instructions:</span>
                  <div className="text-slate-700">
                    {viewingDigitalQr.instructions}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setViewingDigitalQr(null)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer shadow-sm transition-colors"
              >
                Close QR Code
              </button>
            </div>
          </div>
        )}

        {/* Store Bank Account QR & Full Transfer Details Modal */}
        {viewingBankQr && (
          <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-4 animate-scale-up my-auto max-h-[92vh] overflow-y-auto overscroll-contain custom-scrollbar">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-black text-slate-900">{viewingBankQr.bankName}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingBankQr(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {viewingBankQr.qrCodeUrl ? (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 inline-block">
                  <img
                    src={viewingBankQr.qrCodeUrl}
                    alt={`${viewingBankQr.bankName} QR`}
                    className="w-56 h-56 object-contain mx-auto rounded-xl shadow-xs"
                  />
                </div>
              ) : (
                <div className="py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400 text-xs">
                  <QrCode className="w-12 h-12 mx-auto mb-2 opacity-50 text-slate-400" />
                  No QR picture uploaded for {viewingBankQr.bankName}.
                </div>
              )}

              <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200 text-left space-y-2 text-xs">
                <div>
                  <span className="text-slate-500 font-medium block text-[10px] uppercase">Account Title:</span>
                  <strong className="text-slate-900 text-sm">{viewingBankQr.accountTitle}</strong>
                </div>

                <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-blue-100">
                  <div className="min-w-0">
                    <span className="text-slate-500 font-medium block text-[10px] uppercase">Account Number:</span>
                    <strong className="text-blue-700 font-mono text-sm block truncate select-all">{viewingBankQr.accountNumber}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyBankAccountField(viewingBankQr.accountNumber, `modal-acc-${viewingBankQr.id}`)}
                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-xs cursor-pointer shrink-0 transition-colors"
                  >
                    Copy
                  </button>
                </div>

                {viewingBankQr.iban && (
                  <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-blue-100">
                    <div className="min-w-0">
                      <span className="text-slate-500 font-medium block text-[10px] uppercase">IBAN:</span>
                      <strong className="text-slate-800 font-mono text-xs block truncate select-all">{viewingBankQr.iban}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyBankAccountField(viewingBankQr.iban!, `modal-iban-${viewingBankQr.id}`)}
                      className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-xs cursor-pointer shrink-0 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                )}

                {viewingBankQr.raastId && (
                  <div className="flex items-center justify-between gap-2 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    <div className="min-w-0">
                      <span className="text-emerald-700 font-bold block text-[10px] uppercase">Raast ID:</span>
                      <strong className="text-emerald-950 font-mono text-xs block truncate select-all">{viewingBankQr.raastId}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyBankAccountField(viewingBankQr.raastId!, `modal-raast-${viewingBankQr.id}`)}
                      className="px-2 py-1 bg-white hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs cursor-pointer shrink-0 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                )}

                {viewingBankQr.instructions && (
                  <div className="text-[11px] text-slate-600 pt-1 border-t border-blue-100">
                    {viewingBankQr.instructions}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setViewingBankQr(null)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer shadow-sm transition-colors"
              >
                Close QR Code
              </button>
            </div>
          </div>
        )}

        {/* Cash Payment Calculator Modal */}
        <CashPaymentModal
          isOpen={isCashModalOpen}
          onClose={() => setIsCashModalOpen(false)}
          subtotalAmount={cartSubtotal}
          totalAmount={cartTotal}
          isFullScreen={isCartFullScreen}
          storeName={store.name}
          counterName={`Counter #${currentUser.counterNumber || 1}`}
          cashierName={currentUser.username}
          itemCount={cart.length}
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

        {/* Download Web App Modal (Desktop & Mobile) */}
        <DownloadAppModal
          isOpen={isDownloadModalOpen}
          onClose={() => setIsDownloadModalOpen(false)}
        />

        {/* FULL SCREEN CART OVERLAY */}
        {isCartFullScreen && (
          <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col overflow-y-auto overscroll-contain custom-scrollbar animate-fade-in">
            {/* Top Navigation & Header Bar */}
            <div className="bg-slate-900 text-white px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between shadow-md border-b border-slate-800 shrink-0 gap-2 sticky top-0 z-20">
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <button
                  id="btn-close-cart-fullscreen"
                  type="button"
                  onClick={() => setIsCartFullScreen(false)}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-xs transition-all cursor-pointer shadow-sm group"
                  title="Return to regular view (Press Esc)"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                  <span className="hidden xs:inline">Back to Counter</span>
                  <span className="text-[10px] bg-black/25 px-1.5 py-0.5 rounded font-mono font-normal">ESC</span>
                </button>
                <div className="hidden md:block border-l border-slate-700 pl-3">
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

              {/* Center Quick Action Buttons in Full-Screen Header */}
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto custom-scrollbar py-0.5">
                {/* Hold Bill (H+D) */}
                <button
                  type="button"
                  onClick={handleHoldBill}
                  disabled={cart.length === 0}
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                  title="Hold active bill to attend another customer (Shortcut: H + D)"
                >
                  <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Hold Bill</span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-200 text-[10px] font-mono font-black">
                    H+D
                  </span>
                </button>

                {/* Access Held Bills (A+S) */}
                <button
                  type="button"
                  onClick={() => setIsHeldBillsModalOpen(true)}
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition-all cursor-pointer shadow-xs"
                  title="Access and resume held receipts (Shortcut: A + S)"
                >
                  <Receipt className="w-3.5 h-3.5 text-purple-400" />
                  <span className="hidden sm:inline">Access Bills</span>
                  {heldBills.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-purple-500 text-white text-[10px] font-mono font-black animate-pulse">
                      {heldBills.length}
                    </span>
                  )}
                  <span className="px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-200 text-[10px] font-mono font-black">
                    A+S
                  </span>
                </button>

                {/* 4-Digit Product Shortcuts Modal (S+K) */}
                <button
                  type="button"
                  onClick={() => setIsShortcutsModalOpen(true)}
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 text-xs font-bold transition-all cursor-pointer shadow-xs"
                  title="Open full 4-digit shortcuts directory (Shortcut: S + K)"
                >
                  <Hash className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">4-Digit Shortcuts</span>
                  <span className="px-1.5 py-0.2 rounded bg-blue-500/30 text-blue-200 text-[10px] font-mono font-black">
                    S+K
                  </span>
                </button>

                {/* Toggle Quick Shortcuts Tray */}
                <button
                  type="button"
                  onClick={() => setShowFullScreenShortcuts(prev => !prev)}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                    showFullScreenShortcuts 
                      ? 'bg-orange-500 text-slate-950 font-black' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                  }`}
                  title="Toggle Quick Shortcuts Bar in full screen"
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Quick Tray</span>
                </button>
              </div>

              {/* Right Side Header Utilities */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Download App Trigger in Fullscreen POS */}
                <button
                  type="button"
                  onClick={handleDownloadClick}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                  title="Download & Install Mart Pro Web App on Mobile or Desktop"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download App</span>
                </button>

                <div className="bg-slate-800/90 border border-slate-700 px-2.5 sm:px-3 py-1 rounded-xl text-right">
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Cart</div>
                  <div className="text-xs font-black font-mono text-orange-400">
                    {cart.length}
                  </div>
                </div>

                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/60 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Clear
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsCartFullScreen(false)}
                  className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Exit Full Screen"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Pinned Laser Barcode & 4-Digit Shortcut Scanner Bar */}
            <div className="bg-white px-4 sm:px-6 py-2.5 border-b border-slate-200 shadow-xs shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleProcessFullScreenScan();
                }}
                className="flex items-center gap-2 max-w-5xl mx-auto"
              >
                <div className="relative flex-1">
                  <BarcodeIcon className="w-5 h-5 text-orange-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={fullScreenScanInputRef}
                    id="fullscreen-barcode-input"
                    type="text"
                    autoFocus={isCartFullScreen}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="Scan barcode with laser reader or type 4-digit shortcut code (e.g. 1001) / SKU..."
                    value={fullScreenScanInput}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[\r\n]/g, '');
                      setFullScreenScanInput(cleaned);
                    }}
                    onFocus={(e) => {
                      e.target.select();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        handleProcessFullScreenScan();
                      }
                    }}
                    onBlur={(e) => {
                      const related = e.relatedTarget as HTMLElement | null;
                      const isInteractive = related?.tagName === 'BUTTON' || related?.tagName === 'INPUT' || related?.tagName === 'SELECT' || related?.tagName === 'TEXTAREA' || related?.tagName === 'A';
                      const isAnyModalOpen = isScannerOpen || isReceiptOpen || isReturnModalOpen || isReturnSlipOpen || isCashModalOpen || isWeightModalOpen || isHeldBillsModalOpen || isShortcutsModalOpen || Boolean(viewingDigitalQr) || Boolean(viewingBankQr);
                      if (!isInteractive && !isAnyModalOpen && isCartFullScreen) {
                        setTimeout(focusActiveScanner, 20);
                      }
                    }}
                    className="w-full pl-11 pr-24 py-2.5 bg-slate-50 border-2 border-orange-300 focus:border-orange-600 focus:bg-white rounded-xl text-slate-900 font-mono text-xs sm:text-sm font-bold shadow-inner focus:outline-none transition-all"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                    {scannerLastScannedStatus ? (
                      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full animate-pulse">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {scannerLastScannedStatus}
                      </span>
                    ) : (
                      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" /> Ready for scan
                      </span>
                    )}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold">↵ ENTER</span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-4 sm:px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" /> <span>Add</span>
                </button>

                {isCameraScannerAllowed && (
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="px-3 sm:px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs sm:text-sm rounded-xl border border-slate-700 shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                    title="Open camera barcode scanner"
                  >
                    <Camera className="w-4 h-4 text-orange-400" />
                    <span className="hidden sm:inline">Camera</span>
                  </button>
                )}
              </form>

              {/* Fast Shortcut Actions Ribbon */}
              <div className="flex items-center justify-between gap-2 max-w-5xl mx-auto mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-700 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-orange-600" /> 4-Digit Shortcuts Active:
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsShortcutsModalOpen(true)}
                    className="text-blue-700 hover:underline font-extrabold flex items-center gap-1 cursor-pointer"
                  >
                    Browse Directory (S+K)
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setIsHeldBillsModalOpen(true)}
                    className="text-purple-700 hover:underline font-extrabold flex items-center gap-1 cursor-pointer"
                  >
                    Access Parked Bills ({heldBills.length}) (A+S)
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={handleHoldBill}
                    disabled={cart.length === 0}
                    className="text-amber-800 hover:underline font-extrabold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    Hold Active Bill (H+D)
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowFullScreenShortcuts(prev => !prev)}
                  className="font-bold text-orange-700 hover:text-orange-800 flex items-center gap-1 cursor-pointer ml-auto"
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  <span>{showFullScreenShortcuts ? 'Hide Quick Shortcuts Tray' : 'Show 4-Digit Quick Shortcuts Tray'}</span>
                </button>
              </div>
            </div>

            {/* Quick 4-Digit Shortcuts Tray (Collapsible) */}
            <AnimatePresence>
              {showFullScreenShortcuts && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-slate-900 text-white border-b border-slate-800 p-3.5 sm:px-6 shrink-0 overflow-hidden"
                >
                  <div className="max-w-7xl mx-auto space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-orange-600 rounded-lg text-white">
                          <Hash className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <span>4-Digit Product Shortcuts Quick-Tap</span>
                            <span className="text-[10px] bg-orange-500/30 text-orange-300 font-mono px-2 py-0.5 rounded-full border border-orange-500/40 font-bold">
                              {fullScreenFilteredProducts.length} Products
                            </span>
                          </h4>
                        </div>
                      </div>

                      {/* Search in Quick Shortcuts */}
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Filter by code or name..."
                            value={fullScreenShortcutSearch}
                            onChange={(e) => setFullScreenShortcutSearch(e.target.value)}
                            className="pl-8 pr-3 py-1 bg-slate-800 border border-slate-700 focus:border-orange-500 rounded-lg text-xs font-medium text-white placeholder-slate-500 focus:outline-none w-48 sm:w-64"
                          />
                          {fullScreenShortcutSearch && (
                            <button
                              type="button"
                              onClick={() => setFullScreenShortcutSearch('')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsShortcutsModalOpen(true)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                        >
                          Full Directory (S+K)
                        </button>
                      </div>
                    </div>

                    {/* Category Filter Chips */}
                    <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setFullScreenCategory('all')}
                        className={`px-2.5 py-1 rounded-lg font-bold text-xs whitespace-nowrap cursor-pointer transition-all ${
                          fullScreenCategory === 'all'
                            ? 'bg-orange-600 text-white shadow-xs'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        All Categories
                      </button>
                      {uniqueCategories.map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setFullScreenCategory(cat)}
                          className={`px-2.5 py-1 rounded-lg font-bold text-xs whitespace-nowrap cursor-pointer transition-all ${
                            fullScreenCategory === cat
                              ? 'bg-orange-600 text-white shadow-xs'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    {/* Shortcuts Grid Horizontal / Quick Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                      {fullScreenFilteredProducts.map((prod) => {
                        const isWeight = prod.sellBy === 'weight' || prod.unitType === 'kg' || Boolean(prod.pricePerKg);
                        const discInfo = getProductDiscountInfo(prod);
                        const isOutOfStock = prod.stockQuantity <= 0;

                        return (
                          <button
                            key={prod.id}
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => handleAddProductClick(prod)}
                            className="bg-slate-800/90 hover:bg-orange-950/40 hover:border-orange-500 border border-slate-700/80 rounded-xl p-2.5 text-left transition-all cursor-pointer flex flex-col justify-between group relative disabled:opacity-40 disabled:cursor-not-allowed"
                            title={`Click to add ${prod.name} (Code: ${prod.shortcutCode || prod.barcode || 'N/A'})`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                {prod.shortcutCode ? (
                                  <span className="px-1.5 py-0.5 rounded-md bg-orange-500 text-slate-950 font-mono font-black text-xs shadow-xs">
                                    #{prod.shortcutCode}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {prod.barcode?.slice(-4) || 'SKU'}
                                  </span>
                                )}
                                {isWeight && (
                                  <span className="text-[9px] bg-amber-400/20 text-amber-300 font-bold px-1 rounded">
                                    KG
                                  </span>
                                )}
                              </div>
                              <div className="font-bold text-xs text-white truncate group-hover:text-orange-300 transition-colors">
                                {prod.name}
                              </div>
                            </div>

                            <div className="mt-2 pt-1 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                              <span className="font-mono font-black text-emerald-400">
                                Rs. {discInfo.effectivePrice.toFixed(0)}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Stock: {prod.stockQuantity}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Full-Screen Layout */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 p-3 sm:p-6 overflow-y-auto overscroll-contain custom-scrollbar min-h-0 max-w-7xl mx-auto w-full">
              {/* LEFT 8 COLS: Large Cart Items Table / List */}
              <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-[360px] lg:min-h-0">
                <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-orange-600" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Full-Screen Active Cart ({cart.length} {cart.length === 1 ? 'item' : 'items'})
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                      Shortcut codes & items shown below
                    </span>
                    {cart.length > 0 && (
                      <button
                        type="button"
                        onClick={handleHoldBill}
                        className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
                        title="Hold current bill (H + D)"
                      >
                        <PauseCircle className="w-3.5 h-3.5" /> Hold Bill (H+D)
                      </button>
                    )}
                  </div>
                </div>

                {cart.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/40">
                    <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mb-3 shadow-xs">
                      <BarcodeIcon className="w-8 h-8" />
                    </div>
                    <h4 className="text-base font-bold text-slate-800">Cart is Empty in Full Screen</h4>
                    <p className="text-xs text-slate-500 max-w-md mt-1">
                      Scan product barcode with laser reader, type 4-digit code (e.g. <strong>1001</strong>), or use the Quick Shortcuts Tray to start adding items.
                    </p>

                    <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
                      <button
                        type="button"
                        onClick={() => setIsShortcutsModalOpen(true)}
                        className="px-3 py-1.5 bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors"
                      >
                        <Hash className="w-3.5 h-3.5 text-blue-600" /> View 4-Digit Product Shortcuts (S+K)
                      </button>

                      {heldBills.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setIsHeldBillsModalOpen(true)}
                          className="px-3 py-1.5 bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors"
                        >
                          <Receipt className="w-3.5 h-3.5 text-purple-600" /> Access {heldBills.length} Held Bill(s) (A+S)
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                    {cart.map((item, idx) => {
                      const isWeight = item.product.sellBy === 'weight' || item.product.unitType === 'kg' || Boolean(item.product.pricePerKg);
                      const qtyStep = isWeight ? 0.25 : 1;
                      const discInfo = getProductDiscountInfo(item.product);

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

                                {/* 4-DIGIT SHORTCUT CODE BADGE (PROMINENTLY SHOWN IN FULL SCREEN) */}
                                {item.product.shortcutCode && (
                                  <span className="px-2 py-0.5 rounded-lg bg-orange-100 text-orange-900 border border-orange-200 font-mono font-black text-xs flex items-center gap-1 shadow-2xs">
                                    <Hash className="w-3 h-3 text-orange-600" />
                                    <span>#{item.product.shortcutCode}</span>
                                  </span>
                                )}

                                {isWeight && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setWeightPromptProduct(item.product);
                                      setIsWeightModalOpen(true);
                                    }}
                                    className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px] flex items-center gap-0.5 hover:bg-amber-200 cursor-pointer transition-colors"
                                    title="Click to adjust weight in scale calculator"
                                  >
                                    <Scale className="w-3 h-3 text-amber-700" /> KG
                                  </button>
                                )}

                                {discInfo.hasDiscount && (
                                  <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-black text-[9px] uppercase border border-rose-200">
                                    {discInfo.discountLabel}
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                                <span>Code: {item.product.barcode || item.product.serialNumber || 'N/A'}</span>
                                <span>•</span>
                                {discInfo.hasDiscount ? (
                                  <>
                                    <span className="line-through text-slate-400">Rs. {discInfo.basePrice.toFixed(2)}</span>
                                    <span className="text-rose-600 font-black">Rs. {discInfo.effectivePrice.toFixed(2)}{isWeight ? '/kg' : ''}</span>
                                  </>
                                ) : (
                                  <span>Rate: Rs. {item.product.price.toFixed(2)}{isWeight ? '/kg' : ''}</span>
                                )}
                                <span>•</span>
                                <span className="text-emerald-700 font-semibold">Stock: {item.product.stockQuantity}{isWeight ? 'kg' : ''}</span>
                              </div>
                            </div>
                          </div>

                          {/* Quantity Controls */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.product.id, Math.max(0, item.quantity - qtyStep))}
                              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-black flex items-center justify-center cursor-pointer transition-colors"
                              title="Reduce quantity"
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
                              title="Increase quantity"
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
                              {item.quantity} × Rs. {discInfo.effectivePrice.toFixed(2)}
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
              <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col justify-between overflow-y-auto custom-scrollbar space-y-4">
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-orange-600" />
                      <span>Payment Summary</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-bold">
                      Counter #{currentUser.counterNumber || 1}
                    </span>
                  </h3>

                  {/* Payment Method Selector in Full Screen (All Admin Selected & Configured Methods) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Payment Method
                      </label>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {paymentMethod === 'cash' ? 'Cash' : (isCustomDigitalSelected ? (customDigitalProviderInput.trim() || 'Custom') : selectedDigitalProvider)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {/* Cash */}
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod('cash');
                          setIsCustomDigitalSelected(false);
                        }}
                        className={`p-2 rounded-xl border text-left transition-all cursor-pointer text-xs ${
                          paymentMethod === 'cash'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs font-bold'
                            : 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-400 text-emerald-950'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold flex items-center gap-1 truncate">
                            <Banknote className="w-3.5 h-3.5 shrink-0" />
                            Cash
                          </span>
                          {paymentMethod === 'cash' && <Check className="w-3 h-3 text-white shrink-0" />}
                        </div>
                      </button>

                      {/* Admin Configured Digital Methods */}
                      {configuredDigitalMethods.map((method) => {
                        const isSelected = paymentMethod === 'online' && !isCustomDigitalSelected && selectedDigitalProvider.toLowerCase().trim() === method.name.toLowerCase().trim();
                        const meta = getPaymentMethodMeta(method.name);
                        const IconComponent = meta.icon;

                        return (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => {
                              setPaymentMethod('online');
                              setIsCustomDigitalSelected(false);
                              setSelectedDigitalProvider(method.name);
                            }}
                            className={`p-2 rounded-xl border text-left transition-all cursor-pointer text-xs ${
                              isSelected
                                ? `${meta.activeClass} text-white`
                                : `${meta.bgClass}`
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold flex items-center gap-1 truncate">
                                <IconComponent className="w-3.5 h-3.5 shrink-0" />
                                {method.name}
                              </span>
                              <div className="flex items-center gap-1">
                                {method.qrCodeUrl && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewingDigitalQr(method);
                                    }}
                                    className={`text-[9px] font-bold px-1 rounded flex items-center gap-0.5 shrink-0 ${
                                      isSelected ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                                    }`}
                                  >
                                    <QrCode className="w-2.5 h-2.5" /> QR
                                  </button>
                                )}
                                {isSelected && <Check className="w-3 h-3 text-white shrink-0" />}
                              </div>
                            </div>
                          </button>
                        );
                      })}

                      {/* Other / Custom Manual */}
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod('online');
                          setIsCustomDigitalSelected(true);
                        }}
                        className={`p-2 rounded-xl border text-left transition-all cursor-pointer text-xs ${
                          paymentMethod === 'online' && isCustomDigitalSelected
                            ? 'bg-blue-600 text-white border-blue-700 shadow-xs font-bold'
                            : 'bg-slate-50 border-dashed border-slate-300 hover:border-blue-400 text-slate-700 hover:bg-blue-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold flex items-center gap-1 truncate">
                            <Edit2 className="w-3.5 h-3.5 shrink-0" />
                            Other / Manual
                          </span>
                          {paymentMethod === 'online' && isCustomDigitalSelected && <Check className="w-3 h-3 text-white shrink-0" />}
                        </div>
                      </button>
                    </div>

                    {/* Custom Input Field in Full Screen */}
                    {paymentMethod === 'online' && isCustomDigitalSelected && (
                      <div className="pt-1.5">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Type payment platform (e.g. Voucher, POS, Bank)..."
                          value={customDigitalProviderInput}
                          onChange={(e) => setCustomDigitalProviderInput(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}

                    {/* Optional Transaction Ref ID */}
                    {paymentMethod === 'online' && (
                      <div className="pt-1.5">
                        <input
                          type="text"
                          placeholder="Optional TRX ID or Sender..."
                          value={digitalTransactionRef}
                          onChange={(e) => setDigitalTransactionRef(e.target.value)}
                          className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Pricing Breakdown */}
                  <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal ({cart.length} {cart.length === 1 ? 'item' : 'items'})</span>
                      <span className="font-mono font-bold text-slate-900">Rs. {cartSubtotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Net Payable Grand Total */}
                  <div className="bg-orange-50 border-2 border-orange-200 p-4 rounded-2xl text-center space-y-1 shadow-xs">
                    <span className="text-xs font-black uppercase tracking-wider text-orange-900">
                      Net Total Payable
                    </span>
                    <div className="text-3xl font-black font-mono text-orange-600">
                      Rs. {cartTotal.toFixed(2)}
                    </div>
                  </div>

                  {/* Fast Secondary Actions inside summary: Hold Bill & Access Bills */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleHoldBill}
                      disabled={cart.length === 0}
                      className="py-2 px-2 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed border border-amber-300 text-amber-900 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                      title="Hold active bill (H + D)"
                    >
                      <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Hold Bill (H+D)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsHeldBillsModalOpen(true)}
                      className="py-2 px-2 bg-purple-50 hover:bg-purple-100 border border-purple-300 text-purple-900 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                      title="Access parked bills (A + S)"
                    >
                      <Receipt className="w-3.5 h-3.5 text-purple-600" />
                      <span>Access Bills ({heldBills.length})</span>
                    </button>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="space-y-2.5 pt-3">
                  <button
                    type="button"
                    disabled={cart.length === 0 || checkoutLoading}
                    onClick={() => {
                      if (paymentMethod === 'cash') {
                        setIsCashModalOpen(true);
                      } else {
                        executeCheckoutSale(cartTotal, 0);
                      }
                    }}
                    className="w-full py-3.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" /> 
                    {paymentMethod === 'cash' ? 'Collect Cash & Issue Receipt' : 'Complete Digital Sale'}
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

        {/* MANUAL QUANTITY MODAL */}
        {isManualQtyModalOpen && manualQtyItem && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-5 bg-gradient-to-r from-orange-600 to-amber-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center font-bold">
                    <Calculator className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-base">Enter Manual Quantity</h3>
                    <p className="text-xs text-orange-100 truncate max-w-[220px]">{manualQtyItem.product.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsManualQtyModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Exact Quantity / Weight ({manualQtyItem.product.unitType || 'units'})
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step={manualQtyItem.product.sellBy === 'weight' ? '0.001' : '1'}
                      min="0.001"
                      max={manualQtyItem.product.stockQuantity}
                      value={manualQtyInput}
                      onChange={(e) => setManualQtyInput(e.target.value)}
                      autoFocus
                      className="w-full px-4 py-3.5 bg-slate-50 border-2 border-orange-500 rounded-2xl font-black text-2xl text-slate-900 font-mono text-center focus:outline-none focus:bg-white transition-colors"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span>Available Stock: <strong className="text-slate-800">{manualQtyItem.product.stockQuantity}</strong></span>
                    <span>Unit Price: <strong className="text-orange-600">Rs. {manualQtyItem.product.price.toFixed(2)}</strong></span>
                  </div>
                </div>

                {/* Quick Preset Buttons */}
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 5, 10, 20, 50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setManualQtyInput(String(preset))}
                      className="py-2.5 rounded-xl bg-slate-100 hover:bg-orange-100 hover:text-orange-700 font-black text-xs text-slate-700 transition-colors cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsManualQtyModalOpen(false)}
                    className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveManualQty}
                    className="flex-1 py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Update Quantity
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CAMERA BARCODE SCANNER MODAL */}
        {isCameraScannerAllowed && (
          <BarcodeScannerModal
            isOpen={isScannerOpen}
            onClose={() => setIsScannerOpen(false)}
            onScanSuccess={(scannedCode) => {
              handleAddByBarcode(scannedCode, true);
              setIsScannerOpen(false);
            }}
            title="POS Live Barcode Scanner"
            subtitle="Point camera at product barcode or type code and press Send"
          />
        )}

      </div>
    </div>
  );
};
