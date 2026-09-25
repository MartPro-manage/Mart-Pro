import React, { useState, useRef, useEffect } from 'react';
import { 
  db, 
  doc, 
  runTransaction 
} from '../lib/firebase';
import { Product, Store, UserAccount, ProductReturn, Sale } from '../types';
import { playScanSuccessBeep, playScanErrorBeep } from '../lib/sound';
import { speakMessage } from '../lib/speech';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { 
  RotateCcw, 
  X, 
  Barcode as BarcodeIcon, 
  AlertCircle, 
  Package, 
  Receipt, 
  Plus, 
  Minus, 
  Banknote, 
  CreditCard,
  Camera,
  TrendingDown,
  Sparkles,
  ArrowRight,
  Search
} from 'lucide-react';

interface ReturnProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  store: Store;
  currentUser: UserAccount;
  recentSales?: Sale[];
  voiceEnabled?: boolean;
  isCameraScannerAllowed?: boolean;
  onReturnProcessed: (returnRecord: ProductReturn) => void;
}

const COMMON_REASONS = [
  'Customer changed mind',
  'Defective / Damaged item',
  'Wrong product purchased',
  'Quality issue / Expired',
  'Customer requested exchange / refund',
  'Billing error / Duplicate charge'
];

const DEFAULT_RECENT_SALES: Sale[] = [];

export const ReturnProductModal: React.FC<ReturnProductModalProps> = ({
  isOpen,
  onClose,
  products,
  store,
  currentUser,
  recentSales = DEFAULT_RECENT_SALES,
  voiceEnabled = true,
  isCameraScannerAllowed = false,
  onReturnProcessed
}) => {
  const [scanMode, setScanMode] = useState<'barcode' | 'receipt'>('barcode');
  
  // Barcode / Scanner input states
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [receiptNumberInput, setReceiptNumberInput] = useState('');
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  
  // Selection states
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedSaleItemIndex, setSelectedSaleItemIndex] = useState<number | null>(null);
  
  // Form inputs
  const [returnQuantity, setReturnQuantity] = useState<number>(1);
  const [refundMethod, setRefundMethod] = useState<'cash' | 'online'>('cash');
  const [reason, setReason] = useState<string>('Customer changed mind');
  const [customReason, setCustomReason] = useState<string>('');
  
  // Loading & Error states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  // Auto focus input on modal open or when clearing selection
  useEffect(() => {
    if (isOpen && !selectedProduct) {
      const timer = setTimeout(() => {
        if (scanMode === 'barcode' && barcodeInputRef.current) {
          barcodeInputRef.current.focus();
        } else if (scanMode === 'receipt' && receiptInputRef.current) {
          receiptInputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, selectedProduct, scanMode]);

  if (!isOpen) return null;

  // Selected unit price and total refund
  const unitPrice = selectedProduct?.price || selectedProduct?.pricePerKg || 0;
  const isWeightProduct = selectedProduct?.sellBy === 'weight' || selectedProduct?.unitType === 'kg' || Boolean(selectedProduct?.pricePerKg);
  const refundTotal = Math.round(unitPrice * returnQuantity * 100) / 100;
  const finalReason = reason === 'Other' ? (customReason.trim() || 'Other return') : reason;

  // Normalization helper for accurate barcode and code matching
  const cleanCode = (v: any) => String(v ?? '').replace(/[\r\n\t\s]/g, '').trim().toLowerCase();
  const cleanName = (v: any) => String(v ?? '').trim().toLowerCase();

  // Handle barcode lookup
  const handleBarcodeSubmit = (rawBarcode: string) => {
    const code = rawBarcode ? rawBarcode.replace(/[\r\n\t]/g, '').trim() : '';
    if (!code) return;

    setErrorMsg(null);
    const targetCode = cleanCode(code);
    const targetName = cleanName(code);

    // 1. Search in store products by FULL EXACT barcode / serial / id / name
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

    // Fallback for leading-zero variations in standard barcode formats (e.g. UPC/EAN)
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

    if (found) {
      playScanSuccessBeep();
      if (voiceEnabled && store?.voiceAnnouncementEnabled !== false) {
        speakMessage(`Item scanned: ${found.name}`);
      }
      setSelectedProduct(found);
      setSelectedSale(null);
      setSelectedSaleItemIndex(null);
      setReturnQuantity(1);
      setScannedBarcode('');
      return;
    }

    const returnPolicyDays = store.returnPolicyDays && store.returnPolicyDays > 0 ? store.returnPolicyDays : 7;

    // 2. Search in recent sales items by exact full barcode or serial number
    for (const sale of recentSales) {
      const itemIndex = sale.items.findIndex(i => {
        const iBarcode = cleanCode(i.barcode);
        const iSerial = cleanCode(i.serialNumber);
        const iName = cleanName(i.name);
        return (iBarcode && iBarcode === targetCode) ||
               (iSerial && iSerial === targetCode) ||
               (iName && iName === targetName);
      });
      if (itemIndex !== -1) {
        const saleAgeDays = Math.floor((Date.now() - new Date(sale.timestamp).getTime()) / (1000 * 60 * 60 * 24));
        if (saleAgeDays > returnPolicyDays) {
          playScanErrorBeep();
          setErrorMsg(`Slip Expired / Disqualified! Item found in Receipt #${sale.receiptNumber}, but purchase was made ${saleAgeDays} days ago. Admin policy allows restock & refund only within ${returnPolicyDays} days of purchase.`);
          if (voiceEnabled && store?.voiceAnnouncementEnabled !== false) {
            speakMessage(`Slip expired. Return window of ${returnPolicyDays} days has passed.`);
          }
          return;
        }

        const item = sale.items[itemIndex];
        const constructedProduct: Product = {
          id: item.productId,
          storeId: store.id,
          barcode: item.barcode,
          serialNumber: item.serialNumber,
          name: item.name,
          category: 'General',
          price: item.price,
          stockQuantity: 0,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };
        playScanSuccessBeep();
        if (voiceEnabled && store?.voiceAnnouncementEnabled !== false) {
          speakMessage(`Item scanned from receipt: ${item.name}`);
        }
        setSelectedProduct(constructedProduct);
        setSelectedSale(sale);
        setSelectedSaleItemIndex(itemIndex);
        setReturnQuantity(1);
        setRefundMethod(sale.paymentMethod || 'cash');
        setScannedBarcode('');
        return;
      }
    }

    // Not found
    playScanErrorBeep();
    setErrorMsg(`No product found with barcode "${code}". Please scan or enter the complete exact barcode.`);
  };

  // Handle receipt number search
  const handleReceiptSubmit = (rawReceiptNo: string) => {
    const receiptQuery = rawReceiptNo.trim().replace(/^#/, '').toLowerCase();
    if (!receiptQuery) return;

    setErrorMsg(null);
    const returnPolicyDays = store.returnPolicyDays && store.returnPolicyDays > 0 ? store.returnPolicyDays : 7;
    const foundSale = recentSales.find(s => 
      s.receiptNumber.toLowerCase().includes(receiptQuery) ||
      s.id.toLowerCase().includes(receiptQuery)
    );

    if (foundSale) {
      const saleAgeDays = Math.floor((Date.now() - new Date(foundSale.timestamp).getTime()) / (1000 * 60 * 60 * 24));
      if (saleAgeDays > returnPolicyDays) {
        playScanErrorBeep();
        setErrorMsg(`Slip Expired / Disqualified! Slip #${foundSale.receiptNumber} is ${saleAgeDays} days old. Admin policy allows restock & refund only within ${returnPolicyDays} days from purchase.`);
        if (voiceEnabled && store?.voiceAnnouncementEnabled !== false) {
          speakMessage(`Slip expired. Return allowed only within ${returnPolicyDays} days.`);
        }
        return;
      }
      setSelectedSale(foundSale);
      playScanSuccessBeep();
    } else {
      playScanErrorBeep();
      setErrorMsg(`Invoice/Receipt #${rawReceiptNo} not found in recent sales records.`);
    }
  };

  // Select an item from a found receipt
  const handleSelectSaleItem = (sale: Sale, itemIndex: number) => {
    const saleItem = sale.items[itemIndex];
    if (!saleItem) return;

    const matchingProduct = products.find(p => p.id === saleItem.productId) || {
      id: saleItem.productId,
      storeId: store.id,
      barcode: saleItem.barcode,
      serialNumber: saleItem.serialNumber,
      name: saleItem.name,
      category: 'General',
      price: saleItem.price,
      stockQuantity: 0,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    } as Product;

    setSelectedProduct(matchingProduct);
    setSelectedSale(sale);
    setSelectedSaleItemIndex(itemIndex);
    setReturnQuantity(1);
    setRefundMethod(sale.paymentMethod || 'cash');
    setErrorMsg(null);
    playScanSuccessBeep();
  };

  // Reset current selection to scan again
  const handleClearSelection = () => {
    setSelectedProduct(null);
    setSelectedSale(null);
    setSelectedSaleItemIndex(null);
    setReturnQuantity(1);
    setErrorMsg(null);
    setScannedBarcode('');
  };

  // Submit return & refund
  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      setErrorMsg('Please scan a product barcode to return.');
      return;
    }

    if (returnQuantity <= 0) {
      setErrorMsg(isWeightProduct ? 'Return weight must be greater than 0 kg.' : 'Return quantity must be at least 1.');
      return;
    }

    if (selectedSale && selectedSaleItemIndex !== null) {
      const maxAllowed = selectedSale.items[selectedSaleItemIndex]?.quantity || 1;
      if (returnQuantity > maxAllowed) {
        const unitLbl = isWeightProduct ? 'kg' : 'units';
        setErrorMsg(`Cannot return more than the ${maxAllowed} ${unitLbl} purchased in Receipt #${selectedSale.receiptNumber}.`);
        return;
      }
    }

    setLoading(true);
    setErrorMsg(null);

    const returnSlipNumber = `RET-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
    const returnRecordId = `return_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();

    const returnDocData: ProductReturn = {
      id: returnRecordId,
      storeId: store.id,
      storeName: store.name,
      counterId: currentUser.id,
      counterName: currentUser.name || currentUser.counterNumber || 'Counter',
      cashierUsername: currentUser.username,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      barcode: selectedProduct.barcode || '',
      serialNumber: selectedProduct.serialNumber || '',
      price: unitPrice,
      quantity: returnQuantity,
      refundAmount: refundTotal,
      refundMethod: refundMethod,
      reason: finalReason,
      originalReceiptNumber: selectedSale?.receiptNumber || undefined,
      returnSlipNumber: returnSlipNumber,
      timestamp: timestamp
    };

    try {
      // Execute Firestore atomic transaction:
      // 1. Fetch current product stock
      // 2. Atomically increment stockQuantity by returnQuantity (Restock)
      // 3. Insert return document into returns collection
      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, 'products', selectedProduct.id);
        const productSnap = await transaction.get(productRef);

        let newStock = returnQuantity;
        if (productSnap.exists()) {
          const currentStock = Number(productSnap.data().stockQuantity) || 0;
          newStock = Math.round((currentStock + returnQuantity) * 1000) / 1000;
          transaction.update(productRef, {
            stockQuantity: newStock,
            updatedAt: timestamp
          });
        } else {
          // If product doc not found (e.g. legacy sale), create with replenished quantity
          transaction.set(productRef, {
            ...selectedProduct,
            stockQuantity: newStock,
            updatedAt: timestamp
          });
        }

        const returnRef = doc(db, 'returns', returnRecordId);
        transaction.set(returnRef, returnDocData);
      });

      playScanSuccessBeep();
      if (voiceEnabled && store?.voiceAnnouncementEnabled !== false) {
        speakMessage(`Product returned. Refund of rupees ${refundTotal.toFixed(0)} processed. Stock restocked.`);
      }

      onReturnProcessed(returnDocData);
      handleClearSelection();
      onClose();
    } catch (err: any) {
      console.error('Error processing return transaction:', err);
      playScanErrorBeep();
      setErrorMsg(err.message || 'Failed to process return. Please check connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto overscroll-contain">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl relative space-y-5 max-h-[92vh] flex flex-col my-auto overflow-y-auto overscroll-contain custom-scrollbar">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 shrink-0 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-100 text-rose-700 rounded-2xl border border-rose-200 shadow-sm">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                Scan Product Barcode to Return
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Scan barcode &bull; Restocks item to inventory &bull; Issues customer refund
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step 1: Scan Mode Selection & Barcode Reader Input */}
        {!selectedProduct ? (
          <div className="space-y-4">
            
            {/* Mode Switch Tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setScanMode('barcode');
                  setErrorMsg(null);
                }}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  scanMode === 'barcode'
                    ? 'bg-white text-rose-700 shadow-sm font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarcodeIcon className="w-4 h-4" />
                Scan Product Barcode
              </button>
              <button
                type="button"
                onClick={() => {
                  setScanMode('receipt');
                  setErrorMsg(null);
                }}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  scanMode === 'receipt'
                    ? 'bg-white text-rose-700 shadow-sm font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Receipt className="w-4 h-4" />
                Scan Receipt / Invoice #
              </button>
            </div>

            {scanMode === 'barcode' ? (
              <div className="space-y-4">
                
                {/* Barcode Scanner Box */}
                <div className="bg-rose-50/60 border-2 border-dashed border-rose-300 rounded-3xl p-6 text-center space-y-4">
                  <div className="w-14 h-14 bg-rose-600 text-white rounded-2xl mx-auto flex items-center justify-center shadow-md animate-pulse">
                    <BarcodeIcon className="w-7 h-7" />
                  </div>

                  <div>
                    <h4 className="font-extrabold text-base text-slate-900">
                      Scan Product Barcode Now
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 font-medium">
                      Point physical barcode scanner at item or type barcode below and press Enter to return.
                    </p>
                  </div>

                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleBarcodeSubmit(scannedBarcode);
                    }}
                    className="flex gap-2 max-w-md mx-auto"
                  >
                    <div className="relative flex-1">
                      <input
                        id="return-barcode-input"
                        ref={barcodeInputRef}
                        type="text"
                        autoFocus
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        value={scannedBarcode}
                        onChange={(e) => setScannedBarcode(e.target.value)}
                        placeholder="Scan barcode or enter product code / name..."
                        className="w-full pl-4 pr-4 py-3 bg-white border-2 border-rose-300 rounded-2xl text-slate-900 font-mono text-sm font-bold focus:outline-none focus:border-rose-600 shadow-inner"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-2xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <ArrowRight className="w-4 h-4" /> Submit
                    </button>
                  </form>

                  {/* Camera Scanner Trigger if Allowed */}
                  {isCameraScannerAllowed && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setIsCameraScannerOpen(true)}
                        className="px-4 py-2 bg-white hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 shadow-xs transition-all inline-flex items-center gap-2 cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-rose-600" />
                        Open Camera Barcode Scanner
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-[11px] text-slate-600 font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    <strong>Instant Barcode Return:</strong> Compatible with all standard USB & Bluetooth barcode scanners. Scanning immediately fetches product details for quick restock.
                  </span>
                </div>

              </div>
            ) : (
              <div className="space-y-4">
                
                {/* Receipt Lookup Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-3">
                  <label className="block text-xs font-bold text-slate-700">
                    Enter or Scan Original Receipt # / Invoice Number:
                  </label>
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleReceiptSubmit(receiptNumberInput);
                    }}
                    className="flex gap-2"
                  >
                    <div className="relative flex-1">
                      <Receipt className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="return-receipt-input"
                        ref={receiptInputRef}
                        type="text"
                        autoFocus
                        value={receiptNumberInput}
                        onChange={(e) => setReceiptNumberInput(e.target.value)}
                        placeholder="e.g. 1723812903 or scan receipt barcode..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-2xl text-slate-900 text-xs font-mono font-bold focus:outline-none focus:border-rose-500 shadow-inner"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-2xl transition-all cursor-pointer shrink-0 flex items-center gap-1"
                    >
                      <Search className="w-3.5 h-3.5" /> Find Receipt
                    </button>
                  </form>
                </div>

                {/* If a receipt was found, display items to choose for return */}
                {selectedSale && (
                  <div className="p-4 bg-white border border-rose-200 rounded-2xl space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-rose-600" />
                        <span className="font-extrabold text-xs text-slate-900">
                          Receipt #{selectedSale.receiptNumber}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          ({new Date(selectedSale.timestamp).toLocaleString()})
                        </span>
                      </div>
                      <span className="font-black text-xs text-slate-900">
                        Total: Rs. {selectedSale.totalAmount.toFixed(2)}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-600">
                        Select which item from this receipt is being returned:
                      </div>
                      {selectedSale.items.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectSaleItem(selectedSale, idx)}
                          className="w-full p-2.5 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 rounded-xl text-left transition-all flex items-center justify-between text-xs cursor-pointer group"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <RotateCcw className="w-3.5 h-3.5 text-rose-500 group-hover:rotate-180 transition-transform" />
                            <span className="font-bold text-slate-900 group-hover:text-rose-700 truncate">
                              {item.name}
                            </span>
                            <span className="text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded font-mono border border-slate-200">
                              x{item.quantity} purchased
                            </span>
                          </div>
                          <div className="font-black text-rose-600 text-xs shrink-0">
                            Rs. {item.price.toFixed(2)} ea
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>
        ) : (
          /* Step 2: Return Configuration Form for Scanned Product */
          <form onSubmit={handleProcessReturn} className="space-y-4 overflow-y-auto custom-scrollbar pr-1">
            
            {/* Scanned Product Card */}
            <div className="p-4 bg-rose-50/80 border border-rose-200 rounded-2xl space-y-2 relative">
              <button
                type="button"
                onClick={handleClearSelection}
                className="absolute top-3 right-3 text-xs font-bold text-rose-700 hover:text-rose-900 bg-white px-2.5 py-1 rounded-lg border border-rose-200 cursor-pointer shadow-xs flex items-center gap-1"
              >
                <BarcodeIcon className="w-3.5 h-3.5 text-rose-600" />
                Scan Another Barcode
              </button>

              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-rose-600 text-white rounded-2xl shadow-xs">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    {selectedProduct.name}
                  </h4>
                  <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3 pt-0.5">
                    <span>Barcode: <strong className="font-mono text-slate-900">{selectedProduct.barcode || 'N/A'}</strong></span>
                    <span>Unit Price: <strong className="text-rose-700">Rs. {selectedProduct.price.toFixed(2)}</strong></span>
                    <span>In Stock: <strong className="text-slate-900">{selectedProduct.stockQuantity} units</strong></span>
                  </div>
                  {selectedSale && (
                    <div className="text-[11px] text-slate-500 font-medium pt-1">
                      Linked to Receipt: <span className="font-bold text-slate-800">#{selectedSale.receiptNumber}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                {isWeightProduct ? 'Weight to Return & Restock (in KG):' : 'Quantity to Return & Restock:'}
              </label>
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-slate-200 rounded-2xl bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      const step = isWeightProduct ? 0.25 : 1;
                      const minVal = isWeightProduct ? 0.05 : 1;
                      setReturnQuantity(Math.max(minVal, Math.round((returnQuantity - step) * 1000) / 1000));
                    }}
                    disabled={returnQuantity <= (isWeightProduct ? 0.05 : 1)}
                    className="p-2 hover:bg-white text-slate-700 disabled:text-slate-300 rounded-xl transition-colors cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    step={isWeightProduct ? "0.001" : "1"}
                    min={isWeightProduct ? "0.001" : "1"}
                    value={returnQuantity}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        setReturnQuantity(Math.max(isWeightProduct ? 0.001 : 1, val));
                      }
                    }}
                    className="w-20 text-center font-black text-sm bg-transparent focus:outline-none text-slate-900 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const step = isWeightProduct ? 0.25 : 1;
                      setReturnQuantity(Math.round((returnQuantity + step) * 1000) / 1000);
                    }}
                    className="p-2 hover:bg-white text-slate-700 rounded-xl transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-xs text-slate-600 font-medium">
                  Inventory Restock: <strong className="text-emerald-700 font-black">
                    {selectedProduct.stockQuantity}{isWeightProduct ? ' kg' : ''} ➔ {Math.round((selectedProduct.stockQuantity + returnQuantity) * 1000) / 1000}{isWeightProduct ? ' kg' : ' units'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Return Reason */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">
                Reason for Return:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {COMMON_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`p-2 text-left rounded-xl border text-[11px] font-semibold transition-all cursor-pointer truncate ${
                      reason === r
                        ? 'bg-rose-50 border-rose-400 text-rose-800 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {r}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setReason('Other')}
                  className={`p-2 text-left rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${
                    reason === 'Other'
                      ? 'bg-rose-50 border-rose-400 text-rose-800 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Other Reason...
                </button>
              </div>

              {reason === 'Other' && (
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Specify reason..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
                  required
                />
              )}
            </div>

            {/* Refund Method */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Customer Refund Method:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRefundMethod('cash')}
                  className={`p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    refundMethod === 'cash'
                      ? 'bg-rose-50 border-rose-400 text-rose-800 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  Cash Refund (Cash Drawer)
                </button>
                <button
                  type="button"
                  onClick={() => setRefundMethod('online')}
                  className={`p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    refundMethod === 'online'
                      ? 'bg-rose-50 border-rose-400 text-rose-800 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  Online / Store Credit
                </button>
              </div>
            </div>

            {/* Refund & Stock Summary Box */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2 shadow-inner">
              <div className="flex justify-between items-center text-xs text-slate-300">
                <span>Calculation:</span>
                <span>{returnQuantity} unit(s) × Rs. {unitPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-black border-t border-slate-700 pt-2">
                <span className="flex items-center gap-1.5 text-rose-400">
                  <TrendingDown className="w-4 h-4" /> TOTAL REFUND AMOUNT:
                </span>
                <span className="text-lg font-black text-rose-400">
                  Rs. {refundTotal.toFixed(2)}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
                <span>Stock Restock:</span>
                <span className="text-emerald-400 font-bold">+{returnQuantity} {selectedProduct.name}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClearSelection}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Scan Another Item
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>Processing Return...</>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" /> Complete Return & Restock Product
                  </>
                )}
              </button>
            </div>

          </form>
        )}

        {/* Camera Scanner Modal within Return flow */}
        {isCameraScannerOpen && (
          <BarcodeScannerModal
            isOpen={isCameraScannerOpen}
            onClose={() => setIsCameraScannerOpen(false)}
            onScanSuccess={(code) => {
              setIsCameraScannerOpen(false);
              handleBarcodeSubmit(code);
            }}
          />
        )}

      </div>
    </div>
  );
};

