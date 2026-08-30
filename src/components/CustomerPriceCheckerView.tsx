import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  handleFirestoreError,
  OperationType 
} from '../lib/firebase';
import { Product, Store, UserAccount } from '../types';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { speakMessage } from '../lib/speech';
import { playScanSuccessBeep, playScanErrorBeep } from '../lib/sound';
import { 
  ScanLine, 
  Barcode as BarcodeIcon, 
  Camera, 
  Sparkles, 
  ShoppingBag, 
  Tag, 
  Scale, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Volume2, 
  VolumeX, 
  HelpCircle,
  Package,
  Layers,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CustomerPriceCheckerViewProps {
  store: Store;
  currentUser: UserAccount;
}

export const CustomerPriceCheckerView: React.FC<CustomerPriceCheckerViewProps> = ({ store, currentUser }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [scanStatus, setScanStatus] = useState<'idle' | 'found' | 'not_found' | 'out_of_stock'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const scannerBufferRef = useRef<string>('');
  const lastKeyTimestampRef = useRef<number>(0);
  const autoResetTimerRef = useRef<any>(null);

  const isCameraScannerAllowed = store?.cameraScannerEnabled !== false;
  const isVoiceAllowed = store?.voiceAnnouncementEnabled !== false;
  const curr = store?.currencySymbol || 'Rs.';

  // Real-time subscribe to products for this store
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

  // Clean codes
  const cleanCode = (v: any) => String(v ?? '').replace(/[\r\n\t\s]/g, '').trim().toLowerCase();
  const cleanName = (v: any) => String(v ?? '').trim().toLowerCase();

  // Handle Barcode Look up
  const handleLookupBarcode = useCallback((targetBarcode: string) => {
    const rawCode = targetBarcode ? targetBarcode.replace(/[\r\n\t]/g, '').trim() : '';
    if (!rawCode) return;

    if (autoResetTimerRef.current) {
      clearTimeout(autoResetTimerRef.current);
    }

    const targetCode = cleanCode(rawCode);
    const targetName = cleanName(rawCode);

    // Exact Match
    let found = products.find(p => {
      const pBarcode = cleanCode(p.barcode);
      const pSerial = cleanCode(p.serialNumber);
      const pId = cleanCode(p.id);
      const pName = cleanName(p.name);

      if (pBarcode && pBarcode === targetCode) return true;
      if (pSerial && pSerial === targetCode) return true;
      if (pId && pId === targetCode) return true;
      if (pName && pName === targetName) return true;
      return false;
    });

    // Fallback for leading zeros
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

    if (!found) {
      playScanErrorBeep();
      setScannedProduct(null);
      setScanStatus('not_found');
      setStatusMessage(`Barcode "${rawCode}" is not registered in this store. Please ask a staff member for assistance.`);
      if (isVoiceAllowed && voiceEnabled) {
        speakMessage(`Item not found in store database.`);
      }
    } else {
      playScanSuccessBeep();
      setScannedProduct(found);
      const isWeight = found.sellBy === 'weight' || found.unitType === 'kg' || Boolean(found.pricePerKg);
      const priceVal = (found.price || found.pricePerKg || 0);
      const formattedPrice = priceVal % 1 === 0 ? priceVal.toFixed(0) : priceVal.toFixed(2);

      if (found.stockQuantity <= 0) {
        setScanStatus('out_of_stock');
        setStatusMessage(`Item is currently OUT OF STOCK.`);
        if (isVoiceAllowed && voiceEnabled) {
          speakMessage(`${found.name}. Price is ${formattedPrice} rupees, but it is currently out of stock.`);
        }
      } else {
        setScanStatus('found');
        setStatusMessage(`Price verified.`);
        if (isVoiceAllowed && voiceEnabled) {
          speakMessage(`${found.name}. Price is ${formattedPrice} rupees ${isWeight ? 'per kilogram' : ''}.`);
        }
      }
    }

    setBarcodeInput('');
    if (barcodeInputRef.current) {
      barcodeInputRef.current.value = '';
      barcodeInputRef.current.focus();
    }

    // Auto clear scanned display after 15 seconds to return to welcome screen
    autoResetTimerRef.current = setTimeout(() => {
      setScanStatus('idle');
      setScannedProduct(null);
      setStatusMessage('');
    }, 15000);
  }, [products, isVoiceAllowed, voiceEnabled]);

  // Keep input focused for instant barcode scanning
  useEffect(() => {
    if (!isScannerOpen && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [isScannerOpen, scanStatus]);

  // Global hardware scanner listener
  useEffect(() => {
    if (isScannerOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const tagName = activeEl?.tagName?.toUpperCase();
      const isInputActive = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';

      if (isInputActive && activeEl !== barcodeInputRef.current) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTimestampRef.current;
      lastKeyTimestampRef.current = now;

      if (e.key === 'Enter') {
        const isFocused = activeEl === barcodeInputRef.current;
        const scannedText = isFocused
          ? (barcodeInputRef.current?.value || barcodeInput || '').trim()
          : scannerBufferRef.current.trim();

        if (scannedText) {
          e.preventDefault();
          handleLookupBarcode(scannedText);
          scannerBufferRef.current = '';
          setBarcodeInput('');
          if (barcodeInputRef.current) {
            barcodeInputRef.current.value = '';
            barcodeInputRef.current.focus();
          }
        }
        return;
      }

      if (!isInputActive && e.key.length === 1) {
        if (timeDiff > 250) {
          scannerBufferRef.current = e.key;
        } else {
          scannerBufferRef.current += e.key;
        }

        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isScannerOpen, barcodeInput, handleLookupBarcode]);

  const filteredProducts = products.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.barcode.toLowerCase().includes(term) ||
      (p.category && p.category.toLowerCase().includes(term))
    );
  });

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between selection:bg-orange-500 selection:text-white relative overflow-hidden">
      {/* Background Ambience / Subtle Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#334155_1px,transparent_1px),linear-gradient(to_bottom,#334155_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

      {/* Top Store Header Bar */}
      <header className="relative z-10 p-4 sm:p-6 border-b border-slate-800 bg-slate-950/60 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-600/20 border border-orange-500/40 text-orange-400 flex items-center justify-center font-bold shadow-lg shadow-orange-600/10">
              <ScanLine className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Store Self-Service Kiosk
                </span>
                <span className="text-xs text-slate-400 font-medium">{store.name}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
                Customer <span className="text-orange-400">Price Checker</span> System
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Audio Voice Announcement Toggle */}
            {isVoiceAllowed && (
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  voiceEnabled
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
                title={voiceEnabled ? "Mute audio voice price announcement" : "Enable voice announcement"}
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span className="hidden sm:inline">{voiceEnabled ? 'Voice ON' : 'Voice Muted'}</span>
              </button>
            )}

            {/* Inbuilt Camera Scanner (if enabled for this store) */}
            {isCameraScannerAllowed && (
              <button
                onClick={() => setIsScannerOpen(true)}
                className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-black text-xs rounded-xl shadow-lg shadow-orange-600/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline">Camera Scanner</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Interactive Scanner Area */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
        
        {/* Hidden / Auto-focused Barcode Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const val = (barcodeInput || barcodeInputRef.current?.value || '').trim();
            if (val) {
              handleLookupBarcode(val);
            }
          }}
          className="mb-6"
        >
          <div className="relative max-w-xl mx-auto">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <BarcodeIcon className="w-6 h-6 text-orange-400" />
            </div>
            <input
              id="kiosk-barcode-input"
              ref={barcodeInputRef}
              type="text"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Hold barcode under laser scanner or type code..."
              className="w-full pl-13 pr-28 py-4 bg-slate-800/80 border-2 border-slate-700 focus:border-orange-500 focus:bg-slate-800 rounded-2xl text-white placeholder-slate-400 text-base sm:text-lg font-mono focus:outline-none transition-all shadow-xl backdrop-blur-sm"
            />
            <button
              type="submit"
              className="absolute right-2 top-2 bottom-2 px-5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Check</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        {/* Dynamic Display State */}
        <AnimatePresence mode="wait">
          
          {/* IDLE / WELCOME STATE */}
          {scanStatus === 'idle' && (
            <motion.div
              key="idle-state"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3 }}
              className="bg-slate-800/60 border border-slate-700/80 rounded-3xl p-8 sm:p-12 text-center max-w-2xl mx-auto w-full shadow-2xl backdrop-blur-md space-y-6"
            >
              <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-tr from-orange-600/20 to-amber-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 shadow-inner">
                <ScanLine className="w-12 h-12 animate-pulse" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Please Scan Product Barcode
                </h2>
                <p className="text-slate-400 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
                  Hold any item under the store scanner barcode reader to instantly see the official price, weight details, and stock availability.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-700/60 text-xs text-slate-300">
                <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center gap-2.5">
                  <Tag className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-medium text-left">Realtime Accurate Store Pricing</span>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center gap-2.5">
                  <Scale className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-medium text-left">Weight Rates & Unit Packs</span>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center gap-2.5">
                  <Volume2 className="w-4 h-4 text-orange-400 shrink-0" />
                  <span className="font-medium text-left">Audio Voice Confirmation</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* PRODUCT FOUND STATE */}
          {(scanStatus === 'found' || scanStatus === 'out_of_stock') && scannedProduct && (
            <motion.div
              key="found-state"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 sm:p-10 max-w-2xl mx-auto w-full shadow-2xl backdrop-blur-xl space-y-6 relative overflow-hidden"
            >
              {/* Top Accent bar */}
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-700/80 pb-6">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30 uppercase">
                      {scannedProduct.category || 'General Item'}
                    </span>
                    {scannedProduct.sellBy === 'weight' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <Scale className="w-3 h-3" /> Sold by Weight
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight pt-1">
                    {scannedProduct.name}
                  </h2>
                  <p className="text-xs text-slate-400 font-mono flex items-center gap-2 pt-0.5">
                    <span>Barcode: <strong className="text-slate-200">{scannedProduct.barcode}</strong></span>
                    {scannedProduct.serialNumber && (
                      <span>&bull; Serial: <strong className="text-slate-200">{scannedProduct.serialNumber}</strong></span>
                    )}
                  </p>
                </div>

                {/* Stock Badge */}
                <div className="shrink-0">
                  {scannedProduct.stockQuantity > 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> In Stock Available
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-black">
                      <AlertCircle className="w-4 h-4 text-rose-400" /> Out of Stock
                    </span>
                  )}
                </div>
              </div>

              {/* Price Callout Banner */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 sm:p-8 rounded-2xl border border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-inner text-center sm:text-left">
                <div>
                  <span className="text-xs font-black tracking-wider text-slate-400 uppercase block">
                    Official Retail Price
                  </span>
                  <div className="text-4xl sm:text-5xl font-black text-amber-400 tracking-tight mt-1">
                    {curr} {(scannedProduct.price || scannedProduct.pricePerKg || 0).toFixed(2)}
                    {scannedProduct.sellBy === 'weight' && (
                      <span className="text-lg font-bold text-slate-400 ml-1">/kg</span>
                    )}
                  </div>
                </div>

                {scannedProduct.weight && (
                  <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700 text-xs text-slate-300 text-center sm:text-right">
                    <span className="text-slate-400 block font-medium">Pack / Weight Info</span>
                    <span className="font-black text-white text-sm">{scannedProduct.weight}</span>
                  </div>
                )}
              </div>

              {/* Guidance & Voice Replay */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 pt-2">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" /> Scan another item at any time. Screen resets automatically.
                </span>

                {isVoiceAllowed && voiceEnabled && (
                  <button
                    type="button"
                    onClick={() => {
                      const isWeight = scannedProduct.sellBy === 'weight';
                      const p = (scannedProduct.price || scannedProduct.pricePerKg || 0);
                      speakMessage(`${scannedProduct.name}. Price is ${p.toFixed(0)} rupees ${isWeight ? 'per kilogram' : ''}.`);
                    }}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-amber-400" /> Replay Voice
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* ITEM NOT FOUND STATE */}
          {scanStatus === 'not_found' && (
            <motion.div
              key="not-found-state"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="bg-rose-950/40 border border-rose-800/80 rounded-3xl p-8 sm:p-10 text-center max-w-xl mx-auto w-full shadow-2xl backdrop-blur-md space-y-4"
            >
              <div className="w-20 h-20 mx-auto rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 animate-bounce" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">Item Not Found in Store Database</h3>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-md mx-auto">
                {statusMessage}
              </p>
              <button
                onClick={() => {
                  setScanStatus('idle');
                  setScannedProduct(null);
                  if (barcodeInputRef.current) barcodeInputRef.current.focus();
                }}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition-colors cursor-pointer"
              >
                Scan Another Item
              </button>
            </motion.div>
          )}

        </AnimatePresence>

      </main>

      {/* Footer Instructions Bar */}
      <footer className="relative z-10 p-4 border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-md text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Customer Self-Service Terminal &bull; {store.name}</span>
          <span className="text-slate-400 font-medium">Logged in as: <strong className="text-slate-200">{currentUser.name}</strong> ({currentUser.username})</span>
        </div>
      </footer>

      {/* Camera Barcode Scanner Modal */}
      {isCameraScannerAllowed && (
        <BarcodeScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScanSuccess={(code) => {
            handleLookupBarcode(code);
            setIsScannerOpen(false);
          }}
        />
      )}
    </div>
  );
};
