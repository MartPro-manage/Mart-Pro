import React, { useState, useEffect, useRef } from 'react';
import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  setDoc, 
  updateDoc,
  deleteDoc,
  handleFirestoreError,
  OperationType,
  cleanFirestoreData
} from '../lib/firebase';
import { Product, Store, UserAccount } from '../types';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { BarcodeGeneratorModal } from './BarcodeGeneratorModal';
import { HardwarePermissionsBar } from './HardwarePermissionsBar';
import { downloadBarcodeForProduct } from '../lib/barcodeDownload';
import { 
  PackagePlus, 
  Barcode as BarcodeIcon, 
  Camera, 
  Search, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Tag, 
  Layers, 
  PlusCircle, 
  Edit3,
  Trash2,
  Printer,
  Scale,
  Sparkles,
  Info,
  Download
} from 'lucide-react';

interface ProductRegisterViewProps {
  store: Store;
  currentUser: UserAccount;
}

export const ProductRegisterView: React.FC<ProductRegisterViewProps> = ({ store, currentUser }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [productForGenerator, setProductForGenerator] = useState<Partial<Product> | null>(null);

  // Form states
  const [sellBy, setSellBy] = useState<'unit' | 'weight'>('unit');
  const [unitType, setUnitType] = useState<'piece' | 'kg' | 'g' | 'liter' | 'dozen'>('piece');
  const [barcode, setBarcode] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [weightPerUnit, setWeightPerUnit] = useState<number | ''>('');
  const [category, setCategory] = useState('General');
  const [price, setPrice] = useState<number | ''>('');
  const [stockQuantityToAdd, setStockQuantityToAdd] = useState<number | ''>('');
  const [minStockLevel, setMinStockLevel] = useState<number>(5);

  const [existingProduct, setExistingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'weight' | 'unit'>('all');

  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const serialNumberInputRef = useRef<HTMLInputElement | null>(null);
  const quantityInputRef = useRef<HTMLInputElement | null>(null);

  // Auto focus barcode input for fast hardware USB barcode scanner support
  useEffect(() => {
    if (!isScannerOpen && !isGeneratorOpen && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [isScannerOpen, isGeneratorOpen]);

  // Catch physical barcode scanner typing if focus was accidentally blurred
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputActive = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
      if (!isInputActive && !isScannerOpen && !isGeneratorOpen && barcodeInputRef.current) {
        if (e.key.length === 1 || e.key === 'Enter') {
          barcodeInputRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isScannerOpen, isGeneratorOpen]);

  // Subscribe to Products for this store
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

  // Whenever barcode or serial number changes, check if existing product
  useEffect(() => {
    const trimmedBarcode = barcode.trim().toLowerCase();
    const trimmedSerial = serialNumber.trim().toLowerCase();

    if (!trimmedBarcode && !trimmedSerial) {
      setExistingProduct(null);
      return;
    }

    const found = products.find(p => 
      (trimmedBarcode && p.barcode && p.barcode.trim().toLowerCase() === trimmedBarcode) ||
      (trimmedSerial && p.serialNumber && p.serialNumber.trim().toLowerCase() === trimmedSerial)
    );

    if (found) {
      setExistingProduct(found);
      if (!barcode && found.barcode) setBarcode(found.barcode);
      if (!serialNumber && found.serialNumber) setSerialNumber(found.serialNumber || '');
      setName(found.name);
      setWeight(found.weight || '');
      setCategory(found.category || 'General');
      setPrice(found.price);
      setMinStockLevel(found.minStockLevel || 5);
      setSellBy(found.sellBy || (found.unitType === 'kg' ? 'weight' : 'unit'));
      setUnitType((found.unitType as any) || (found.sellBy === 'weight' ? 'kg' : 'piece'));
      setWeightPerUnit(found.weightPerUnit !== undefined ? found.weightPerUnit : '');
    } else {
      setExistingProduct(null);
    }
  }, [barcode, serialNumber, products]);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 5000);
  };

  const handleSelectProductToEdit = (p: Product) => {
    setBarcode(p.barcode || '');
    setSerialNumber(p.serialNumber || '');
    setExistingProduct(p);
    setName(p.name);
    setWeight(p.weight || '');
    setCategory(p.category || 'General');
    setPrice(p.price);
    setMinStockLevel(p.minStockLevel || 5);
    setSellBy(p.sellBy || (p.unitType === 'kg' ? 'weight' : 'unit'));
    setUnitType((p.unitType as any) || (p.sellBy === 'weight' ? 'kg' : 'piece'));
    setWeightPerUnit(p.weightPerUnit !== undefined ? p.weightPerUnit : '');
    setStockQuantityToAdd('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenGeneratorForProduct = (p?: Product) => {
    if (p) {
      setProductForGenerator(p);
    } else {
      setProductForGenerator({
        name: name || '',
        barcode: barcode || '',
        serialNumber: serialNumber || '',
        weight: weight || (sellBy === 'weight' ? '1 kg' : '500g'),
        price: typeof price === 'number' ? price : 0,
        category: category || 'General',
        stockQuantity: typeof stockQuantityToAdd === 'number' ? stockQuantityToAdd : 50,
        sellBy: sellBy,
        unitType: unitType,
        pricePerKg: sellBy === 'weight' && typeof price === 'number' ? price : undefined,
        weightPerUnit: typeof weightPerUnit === 'number' ? weightPerUnit : undefined
      });
    }
    setIsGeneratorOpen(true);
  };

  const handleDirectDownloadBarcode = async (p: Product) => {
    try {
      showNotification('success', `Preparing barcode download for "${p.name}"...`);
      await downloadBarcodeForProduct(p, store?.name || 'SUPERMARKET');
      showNotification('success', `Downloaded Barcode Sticker for "${p.name}"!`);
    } catch (err: any) {
      showNotification('error', `Failed to download barcode: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleAutoGenerateBarcodeNumber = () => {
    const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
    const newCode = `890${randomDigits}`;
    setBarcode(newCode);
    showNotification('success', `Generated new Unique Barcode: ${newCode}`);
  };

  const handleSubmitProductStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    let trimmedBarcode = barcode.trim();
    const trimmedSerial = serialNumber.trim();
    const trimmedName = name.trim();
    const trimmedWeight = weight.trim();
    const numericPrice = typeof price === 'number' ? price : parseFloat(price as any);
    const addedQuantity = typeof stockQuantityToAdd === 'number' ? stockQuantityToAdd : parseFloat(stockQuantityToAdd as string);
    const numericWeightPerUnit = typeof weightPerUnit === 'number' ? weightPerUnit : (weightPerUnit ? parseFloat(weightPerUnit as string) : undefined);

    if (!trimmedName) {
      showNotification('error', 'Product Name is required.');
      return;
    }

    if (isNaN(numericPrice) || numericPrice < 0) {
      showNotification('error', sellBy === 'weight' ? 'Please enter a valid price per kg in Pakistani Rupees (Rs.).' : 'Please enter a valid price in Pakistani Rupees (Rs.).');
      return;
    }

    if (isNaN(addedQuantity) || addedQuantity <= 0) {
      showNotification('error', sellBy === 'weight' ? 'Total weight is compulsory! Please enter stock weight in kg to add.' : 'Quantity is compulsory! Please enter stock quantity to add.');
      return;
    }

    // Constraint: It is not compulsory to add both serial number and barcode.
    // If neither was entered, auto-generate a barcode so POS can scan it.
    if (!trimmedBarcode && !trimmedSerial) {
      const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
      trimmedBarcode = `890${randomDigits}`;
      setBarcode(trimmedBarcode);
    }

    // Check for Barcode and Name Mismatch
    if (trimmedBarcode) {
      const existingBarcodeProduct = products.find(
        p => p.barcode && p.barcode.trim().toLowerCase() === trimmedBarcode.toLowerCase()
      );

      if (existingBarcodeProduct && existingBarcodeProduct.name.trim().toLowerCase() !== trimmedName.toLowerCase()) {
        showNotification(
          'error',
          `Cannot proceed! Barcode "${trimmedBarcode}" is already registered under product name "${existingBarcodeProduct.name}".`
        );
        return;
      }
    }

    // Check for Serial Number and Name Mismatch
    if (trimmedSerial) {
      const existingSerialProduct = products.find(
        p => p.serialNumber && p.serialNumber.trim().toLowerCase() === trimmedSerial.toLowerCase()
      );

      if (existingSerialProduct && existingSerialProduct.name.trim().toLowerCase() !== trimmedName.toLowerCase()) {
        showNotification(
          'error',
          `Cannot proceed! Serial Number "${trimmedSerial}" is already registered under product name "${existingSerialProduct.name}".`
        );
        return;
      }
    }

    setLoading(true);

    try {
      const existingBarcodeMatch = trimmedBarcode 
        ? products.find(p => p.barcode && p.barcode.trim().toLowerCase() === trimmedBarcode.toLowerCase())
        : undefined;
      const existingSerialMatch = trimmedSerial
        ? products.find(p => p.serialNumber && p.serialNumber.trim().toLowerCase() === trimmedSerial.toLowerCase())
        : undefined;

      const targetProduct = existingProduct || existingBarcodeMatch || existingSerialMatch;

      const codeInfo = [
        trimmedSerial ? `S/N: ${trimmedSerial}` : null,
        trimmedBarcode ? `BC: ${trimmedBarcode}` : null,
        trimmedWeight ? `Wt: ${trimmedWeight}` : null,
        sellBy === 'weight' ? 'Sell By Weight (kg)' : null
      ].filter(Boolean).join(', ');

      const roundedAddedQty = Math.round(addedQuantity * 1000) / 1000;

      if (targetProduct) {
        // UPDATE EXISTING PRODUCT
        const newTotalStock = Math.round((targetProduct.stockQuantity + roundedAddedQty) * 1000) / 1000;
        const productDocRef = doc(db, 'products', targetProduct.id);

        await updateDoc(productDocRef, cleanFirestoreData({
          barcode: trimmedBarcode || '',
          serialNumber: trimmedSerial || '',
          name: trimmedName,
          weight: trimmedWeight || (sellBy === 'weight' ? `${newTotalStock} kg` : ''),
          category: category.trim() || 'General',
          price: numericPrice,
          pricePerKg: sellBy === 'weight' ? numericPrice : undefined,
          sellBy: sellBy,
          unitType: sellBy === 'weight' ? (unitType || 'kg') : (unitType || 'piece'),
          weightPerUnit: numericWeightPerUnit || undefined,
          stockQuantity: newTotalStock,
          minStockLevel: minStockLevel || 5,
          updatedAt: new Date().toISOString()
        }));

        const unitLabel = sellBy === 'weight' ? 'kg' : 'units';
        showNotification(
          'success',
          `Updated "${trimmedName}"${codeInfo ? ` (${codeInfo})` : ''}! Added +${roundedAddedQty} ${unitLabel} (Total Stock: ${newTotalStock} ${unitLabel}). Price: Rs. ${numericPrice.toFixed(2)}${sellBy === 'weight' ? '/kg' : ''}`
        );
      } else {
        // REGISTER NEW PRODUCT
        const productDocRef = doc(collection(db, 'products'));
        const newProduct: Product = {
          id: productDocRef.id,
          storeId: store.id,
          barcode: trimmedBarcode || '',
          serialNumber: trimmedSerial || '',
          name: trimmedName,
          weight: trimmedWeight || (sellBy === 'weight' ? `${roundedAddedQty} kg` : ''),
          category: category.trim() || 'General',
          price: numericPrice,
          pricePerKg: sellBy === 'weight' ? numericPrice : undefined,
          sellBy: sellBy,
          unitType: sellBy === 'weight' ? (unitType || 'kg') : (unitType || 'piece'),
          weightPerUnit: numericWeightPerUnit || undefined,
          stockQuantity: roundedAddedQty,
          minStockLevel: minStockLevel || 5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await setDoc(productDocRef, cleanFirestoreData(newProduct));

        const unitLabel = sellBy === 'weight' ? 'kg' : 'units';
        showNotification(
          'success',
          `Registered new product "${trimmedName}"${codeInfo ? ` (${codeInfo})` : ''} with initial stock of ${roundedAddedQty} ${unitLabel} at Rs. ${numericPrice.toFixed(2)}${sellBy === 'weight' ? '/kg' : ''}.`
        );
      }

      // Reset form
      setBarcode('');
      setSerialNumber('');
      setName('');
      setWeight('');
      setWeightPerUnit('');
      setCategory('General');
      setPrice('');
      setStockQuantityToAdd('');
      setExistingProduct(null);

      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Failed to save product stock: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handler for saving from BarcodeGeneratorModal
  const handleSaveFromGenerator = async (productData: {
    name: string;
    uniqueNumber: string;
    weight: string;
    price: number;
    category?: string;
    stockQuantity?: number;
  }) => {
    const existing = products.find(
      p => (p.barcode && p.barcode.toLowerCase() === productData.uniqueNumber.toLowerCase()) ||
           (p.name && p.name.toLowerCase() === productData.name.toLowerCase())
    );

    if (existing) {
      const newStock = existing.stockQuantity + (productData.stockQuantity || 50);
      await updateDoc(doc(db, 'products', existing.id), cleanFirestoreData({
        barcode: productData.uniqueNumber || '',
        name: productData.name,
        weight: productData.weight || '',
        price: productData.price,
        category: productData.category || 'General',
        stockQuantity: newStock,
        updatedAt: new Date().toISOString()
      }));
      showNotification('success', `Updated stock for "${productData.name}" (Total Stock: ${newStock}) at Rs. ${productData.price.toFixed(2)}`);
    } else {
      const newDocRef = doc(collection(db, 'products'));
      const newProd: Product = {
        id: newDocRef.id,
        storeId: store.id,
        barcode: productData.uniqueNumber || '',
        name: productData.name,
        weight: productData.weight || '',
        category: productData.category || 'General',
        price: productData.price,
        stockQuantity: productData.stockQuantity || 50,
        minStockLevel: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(newDocRef, cleanFirestoreData(newProd));
      showNotification('success', `Created & registered barcode for "${productData.name}" with ${productData.stockQuantity || 50} units at Rs. ${productData.price.toFixed(2)}`);
    }
  };

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  const confirmSingleDelete = async () => {
    if (!productToDelete) return;
    const p = productToDelete;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'products', p.id));
      showNotification('success', `Deleted "${p.name}" from stock inventory.`);

      setSelectedProductIds(prev => prev.filter(id => id !== p.id));

      if (existingProduct?.id === p.id) {
        setBarcode('');
        setSerialNumber('');
        setName('');
        setWeight('');
        setCategory('General');
        setPrice('');
        setStockQuantityToAdd('');
        setExistingProduct(null);
      }
      setProductToDelete(null);
    } catch (err: any) {
      console.error('Delete product error:', err);
      showNotification('error', 'Failed to delete product stock: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = (p: Product) => {
    setProductToDelete(p);
  };

  const handleToggleSelectProduct = (id: string) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedProductIds.length === filteredCatalog.length && filteredCatalog.length > 0) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredCatalog.map(p => p.id));
    }
  };

  const handleBulkDelete = () => {
    if (selectedProductIds.length === 0) return;
    setIsBulkDeleteModalOpen(true);
  };

  const confirmBulkDelete = async () => {
    if (selectedProductIds.length === 0) return;

    setLoading(true);
    let deletedCount = 0;
    try {
      for (const id of selectedProductIds) {
        await deleteDoc(doc(db, 'products', id));
        deletedCount++;
      }

      showNotification('success', `Successfully deleted ${deletedCount} selected product(s) from inventory.`);
      setSelectedProductIds([]);
      setIsBulkDeleteModalOpen(false);

      if (existingProduct && selectedProductIds.includes(existingProduct.id)) {
        setBarcode('');
        setSerialNumber('');
        setName('');
        setWeight('');
        setCategory('General');
        setPrice('');
        setStockQuantityToAdd('');
        setExistingProduct(null);
      }
    } catch (err: any) {
      console.error('Bulk delete error:', err);
      showNotification('error', 'Failed during bulk deletion: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredCatalog = products.filter(p => {
    if (catalogFilter === 'weight' && !(p.sellBy === 'weight' || p.unitType === 'kg' || p.pricePerKg)) return false;
    if (catalogFilter === 'unit' && (p.sellBy === 'weight' || p.unitType === 'kg' || p.pricePerKg)) return false;

    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.barcode.toLowerCase().includes(term) ||
      (p.serialNumber && p.serialNumber.toLowerCase().includes(term)) ||
      (p.weight && p.weight.toLowerCase().includes(term)) ||
      p.category.toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Top Control Banner */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="space-y-2 z-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200 flex items-center gap-1.5">
                <PackagePlus className="w-3.5 h-3.5 text-orange-600" /> Product Register & Inventory
              </span>
              <span className="text-xs text-slate-500 font-medium">Store: {store.name}</span>
              <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
                PKR (Rs.)
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Product Stock Entry & <span className="text-orange-600">Barcode Generator</span>
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl font-medium">
              Add products with custom weights, auto-generate and print barcode labels, and adjust stock quantities. External USB barcode scanners work automatically without clicking any buttons on screen.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 z-10 shrink-0">
            {/* Generate Barcode Button */}
            <button
              onClick={() => handleOpenGeneratorForProduct()}
              className="px-5 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-400" /> Generate & Print Barcode
            </button>

            {/* Camera Scanner Trigger (respects store setting) */}
            {store.cameraScannerEnabled !== false && (
              <button
                onClick={() => setIsScannerOpen(true)}
                className="px-5 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Camera className="w-4 h-4" /> Camera Scanner
              </button>
            )}
          </div>
        </div>

        {/* Hardware Permissions & Voice Controls */}
        <HardwarePermissionsBar 
          voiceEnabled={voiceEnabled} 
          onToggleVoice={setVoiceEnabled} 
          voiceAllowed={store?.voiceAnnouncementEnabled !== false}
        />

        {/* Global Notifications */}
        {msg && (
          <div className={`p-4 rounded-2xl border flex items-center gap-3 text-sm font-medium shadow-sm transition-all ${
            msg.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {msg.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />}
            <span>{msg.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Form Column: Stock In & Product Registration Form */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <PackagePlus className="w-5 h-5 text-orange-600" /> 
                  {existingProduct ? 'Update Stock & Price' : 'Register Product Stock'}
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {existingProduct ? `Modifying "${existingProduct.name}"` : 'Enter product details or scan barcode to add stock'}
                </p>
              </div>

              {existingProduct ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  Existing Item
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  New Item
                </span>
              )}
            </div>

            {/* Helpful Notice about Serial Number and Barcode */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
              <Info className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
              <span>
                <strong>Note:</strong> It is not compulsory to provide both Serial Number and Barcode. You can enter either one, or leave both empty to auto-generate a unique barcode.
              </span>
            </div>

            <form onSubmit={handleSubmitProductStock} className="space-y-4">
              
              {/* Selling Method Mode: Piece vs Weight */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Selling Method *
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setSellBy('unit');
                      if (unitType === 'kg' || unitType === 'g') setUnitType('piece');
                    }}
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      sellBy === 'unit'
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <PackagePlus className="w-4 h-4 text-blue-600" />
                    <span>📦 By Piece / Unit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSellBy('weight');
                      setUnitType('kg');
                    }}
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      sellBy === 'weight'
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Scale className="w-4 h-4 text-amber-300" />
                    <span>⚖️ By Weight (per kg)</span>
                  </button>
                </div>
              </div>

              {/* Product Barcode Field with Scan Trigger & Auto-Gen */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Product Barcode / Code
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoGenerateBarcodeNumber}
                    className="text-[10px] text-orange-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" /> Auto-fill Barcode
                  </button>
                </div>
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <BarcodeIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="Scan or enter barcode (Optional if S/N provided)..."
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && barcode.trim()) {
                          e.preventDefault();
                          if (existingProduct) {
                            if (quantityInputRef.current) quantityInputRef.current.focus();
                          } else {
                            if (serialNumberInputRef.current) serialNumberInputRef.current.focus();
                          }
                        }
                      }}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-orange-500 focus:bg-white font-mono shadow-inner transition-all"
                    />
                  </div>
                  {store.cameraScannerEnabled !== false && (
                    <button
                      type="button"
                      onClick={() => setIsScannerOpen(true)}
                      className="p-2.5 rounded-xl bg-slate-100 border border-slate-300 hover:border-orange-500 text-orange-600 hover:text-orange-700 transition-colors cursor-pointer shrink-0"
                      title="Camera Scanner"
                    >
                      <Camera className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Existing Stock Alert if found */}
              {existingProduct && (
                <div className="p-3 bg-amber-50/90 rounded-2xl border border-amber-200 text-xs space-y-1">
                  <div className="font-bold text-amber-900 flex items-center justify-between">
                    <span>Currently Available Stock:</span>
                    <span className="text-slate-900 text-sm font-extrabold">
                      {existingProduct.stockQuantity} {existingProduct.sellBy === 'weight' || existingProduct.unitType === 'kg' ? 'kg' : 'units'}
                    </span>
                  </div>
                  <p className="text-slate-600 font-medium">
                    Entering quantity below will <span className="text-emerald-700 font-bold">ADD</span> to the store inventory.
                  </p>
                </div>
              )}

              {/* Serial Number (S/N) / Item Code */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Serial Number (S/N) / Short Code</span>
                  <span className="text-[10px] text-slate-500 font-medium">Optional (e.g. 101, 1004)</span>
                </label>
                <input
                  ref={serialNumberInputRef}
                  type="text"
                  placeholder="e.g. SN-9021 or 1004"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-orange-500 focus:bg-white font-mono font-medium transition-all"
                />
              </div>

              {/* Product Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder={sellBy === 'weight' ? 'e.g. Basmati Rice, Fresh Apples, Sugar' : 'e.g. Milk Pack, Shampoo, Cooking Oil'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-orange-500 focus:bg-white font-medium transition-all"
                />
              </div>

              {/* Weight & Category Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {sellBy === 'weight' ? 'Unit Type' : 'Weight / Volume'}
                  </label>
                  {sellBy === 'weight' ? (
                    <select
                      value={unitType}
                      onChange={(e) => setUnitType(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:border-orange-500 focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="kg">kg (Kilogram)</option>
                      <option value="g">g (Grams)</option>
                      <option value="liter">liter (Liters)</option>
                    </select>
                  ) : (
                    <div className="relative">
                      <Scale className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="e.g. 500g, 1kg, 250ml"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-orange-500 focus:bg-white font-medium transition-all"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <input
                    type="text"
                    placeholder={sellBy === 'weight' ? 'e.g. Grocery, Fruits, Vegetables' : 'e.g. Grocery, Dairy'}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-orange-500 focus:bg-white font-medium transition-all"
                  />
                </div>
              </div>

              {/* Optional Pre-packaged pack weight when selling by weight */}
              {sellBy === 'weight' && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <span>Pre-packed Weight per Bag/Unit</span>
                      <span className="text-[10px] text-slate-500 font-normal">(Optional)</span>
                    </label>
                    <span className="text-[10px] text-orange-600 font-bold">Auto-multiply helper</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="e.g. 0.5 (kg per packet) or leave blank for loose"
                      value={weightPerUnit}
                      onChange={(e) => setWeightPerUnit(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-orange-500 font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">
                    If this item is sold in fixed-weight bags (e.g. 0.5 kg bag), entering quantity at checkout will automatically multiply: <em>Quantity × Weight</em>.
                  </p>
                </div>
              )}

              {/* Quantity to Add & Latest Price (Rs.) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {sellBy === 'weight' 
                      ? (existingProduct ? 'Add Weight (kg) *' : 'Total Stock (kg) *')
                      : (existingProduct ? 'Add Stock (+Qty) *' : 'Initial Stock Qty *')}
                  </label>
                  <input
                    ref={quantityInputRef}
                    type="number"
                    step={sellBy === 'weight' ? '0.001' : '1'}
                    min="0.001"
                    required
                    placeholder={sellBy === 'weight' ? 'e.g. 50.000' : 'e.g. 50'}
                    value={stockQuantityToAdd}
                    onChange={(e) => setStockQuantityToAdd(e.target.value === '' ? '' : (sellBy === 'weight' ? parseFloat(e.target.value) : parseInt(e.target.value, 10)))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-orange-500 focus:bg-white font-bold text-emerald-700 transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {sellBy === 'weight' ? 'Price Per KG (Rs.) *' : 'Unit Price (Rs.) *'}
                  </label>
                  <div className="relative">
                    <span className="text-xs font-black text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2">
                      Rs.
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder={sellBy === 'weight' ? '300.00 / kg' : '250.00'}
                      value={price}
                      onChange={(e) => setPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-orange-500 focus:bg-white font-black text-orange-600 transition-all font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 bg-orange-600 hover:bg-orange-500 text-white font-extrabold rounded-2xl shadow-lg shadow-orange-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs uppercase tracking-wider"
                >
                  <PlusCircle className="w-4 h-4" />
                  {loading ? 'Saving Stock...' : existingProduct ? 'Update Stock Batch & Price' : 'Register New Product Stock'}
                </button>

                {/* Quick Barcode Label Generation for current product */}
                <button
                  type="button"
                  onClick={() => handleOpenGeneratorForProduct()}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  Generate & Print Barcode Label for this Product
                </button>

                {existingProduct && (
                  <button
                    type="button"
                    onClick={() => handleDeleteProduct(existingProduct)}
                    disabled={loading}
                    className="w-full py-2 px-4 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    Delete Product From Stock
                  </button>
                )}
              </div>

            </form>
          </div>

          {/* Right Column: Registered Inventory Catalog */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-600" /> Current Store Inventory ({products.length})
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Manage inventory, print barcode stickers, or edit prices (Pakistani Rupees)
                </p>
              </div>

              <div className="flex items-center gap-2">
                {selectedProductIds.length > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedProductIds.length})
                  </button>
                )}

                <div className="relative min-w-[190px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search catalog or weight..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-orange-500 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Filter Tabs: All, By Weight, By Unit */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setCatalogFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  catalogFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Products ({products.length})
              </button>
              <button
                type="button"
                onClick={() => setCatalogFilter('weight')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  catalogFilter === 'weight'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'
                }`}
              >
                <Scale className="w-3 h-3" /> Sold by Weight ({products.filter(p => p.sellBy === 'weight' || p.unitType === 'kg' || p.pricePerKg).length})
              </button>
              <button
                type="button"
                onClick={() => setCatalogFilter('unit')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  catalogFilter === 'unit'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                <PackagePlus className="w-3 h-3" /> Sold by Unit ({products.filter(p => !(p.sellBy === 'weight' || p.unitType === 'kg' || p.pricePerKg)).length})
              </button>
            </div>

            {filteredCatalog.length === 0 ? (
              <div className="text-sm text-slate-500 p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 space-y-2">
                <PackagePlus className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="font-bold text-slate-700">No products found in catalog</p>
                <p className="text-xs text-slate-500">Use the form on the left or click "Generate & Print Barcode" to add items.</p>
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto max-h-[620px] overscroll-contain custom-scrollbar border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-600 uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="p-3.5 w-8">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.length === filteredCatalog.length && filteredCatalog.length > 0}
                          onChange={handleToggleSelectAll}
                          className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500 cursor-pointer"
                          title="Select / Deselect all"
                        />
                      </th>
                      <th className="p-3.5">Product & Method</th>
                      <th className="p-3.5">S/N & Barcode</th>
                      <th className="p-3.5 text-center">Price Rate</th>
                      <th className="p-3.5 text-center">Available Stock</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredCatalog.map((p) => {
                      const isSelected = selectedProductIds.includes(p.id);
                      const isWeighted = p.sellBy === 'weight' || p.unitType === 'kg' || !!p.pricePerKg;
                      return (
                        <tr key={p.id} className={`${isSelected ? 'bg-orange-50/60' : 'hover:bg-slate-50'} transition-colors`}>
                          <td className="p-3.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectProduct(p.id)}
                              className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{p.name}</span>
                              {isWeighted ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-orange-100 text-orange-800 border border-orange-200 flex items-center gap-0.5">
                                  <Scale className="w-2.5 h-2.5" /> By Weight
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                                  By Unit
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mt-0.5">
                              {p.weight && (
                                <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono font-bold">
                                  {p.weight}
                                </span>
                              )}
                              {p.weightPerUnit && (
                                <span className="text-orange-700 font-semibold">
                                  ({p.weightPerUnit} kg/pack)
                                </span>
                              )}
                              <span>{p.category || 'General'}</span>
                            </div>
                          </td>
                          <td className="p-3.5 text-xs space-y-0.5 font-mono">
                            {p.serialNumber && (
                              <div className="font-bold text-slate-800">
                                S/N: <span className="text-orange-700">{p.serialNumber}</span>
                              </div>
                            )}
                            <div className="text-[11px] text-slate-500">BC: {p.barcode || 'N/A'}</div>
                          </td>
                          <td className="p-3.5 text-center font-black text-orange-600 font-mono">
                            Rs. {p.price.toFixed(2)}{isWeighted ? '/kg' : ''}
                          </td>
                          <td className="p-3.5 text-center font-black text-sm">
                            <span className={p.stockQuantity <= 0 ? 'text-red-600 font-black' : p.stockQuantity <= 5 ? 'text-amber-600 font-bold' : 'text-emerald-600 font-black'}>
                              {p.stockQuantity % 1 === 0 ? p.stockQuantity : p.stockQuantity.toFixed(3)} {isWeighted ? 'kg' : 'units'}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Print Barcode / Sticker Action */}
                              <button
                                onClick={() => handleOpenGeneratorForProduct(p)}
                                className="px-2 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-all text-xs font-bold flex items-center gap-1 cursor-pointer shadow-sm"
                                title="Open Barcode & Label Station"
                              >
                                <Printer className="w-3 h-3 text-amber-300" /> Print
                              </button>

                              {/* Direct Download Barcode Image */}
                              <button
                                onClick={() => handleDirectDownloadBarcode(p)}
                                className="px-2 py-1.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-600 hover:text-white transition-all text-xs font-bold flex items-center gap-1 cursor-pointer shadow-sm"
                                title="Download Barcode Sticker PNG"
                              >
                                <Download className="w-3 h-3 text-sky-600 group-hover:text-white" /> Download
                              </button>

                              <button
                                onClick={() => handleSelectProductToEdit(p)}
                                className="px-2.5 py-1.5 rounded-lg bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-600 hover:text-white transition-all text-xs font-bold flex items-center gap-1 cursor-pointer shadow-sm"
                                title="Update stock or price"
                              >
                                <Edit3 className="w-3 h-3" /> Edit
                              </button>

                              <button
                                onClick={() => handleDeleteProduct(p)}
                                className="px-2 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white transition-all text-xs font-bold flex items-center gap-1 cursor-pointer shadow-sm"
                                title="Delete stock item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Dedicated Barcode Generator & Print Station Modal */}
        <BarcodeGeneratorModal
          isOpen={isGeneratorOpen}
          onClose={() => setIsGeneratorOpen(false)}
          store={store}
          initialProduct={productForGenerator}
          onSaveToInventory={handleSaveFromGenerator}
        />

        {/* Camera Scanner Modal */}
        <BarcodeScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScanSuccess={(scannedCode) => {
            setBarcode(scannedCode);
            showNotification('success', `Scanned Barcode: ${scannedCode}`);
          }}
        />

        {/* Single Product Delete Confirmation Modal */}
        {productToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-red-100 text-red-600 rounded-2xl shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Delete Product from Inventory?</h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Are you sure you want to permanently delete <span className="font-bold text-slate-900">"{productToDelete.name}"</span>?
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs font-mono space-y-1 text-slate-700">
                <div><span className="font-bold">Barcode:</span> {productToDelete.barcode || 'N/A'}</div>
                {productToDelete.serialNumber && <div><span className="font-bold">S/N:</span> {productToDelete.serialNumber}</div>}
                {productToDelete.weight && <div><span className="font-bold">Weight:</span> {productToDelete.weight}</div>}
                <div><span className="font-bold">Price:</span> Rs. {productToDelete.price.toFixed(2)}</div>
                <div><span className="font-bold">Current Stock:</span> {productToDelete.stockQuantity} units</div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setProductToDelete(null)}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmSingleDelete}
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer transition-all shadow-md flex items-center gap-1.5"
                >
                  {loading ? 'Deleting...' : 'Yes, Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Delete Confirmation Modal */}
        {isBulkDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-red-100 text-red-600 rounded-2xl shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Delete {selectedProductIds.length} Selected Products?</h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Are you sure you want to permanently delete all <span className="font-bold text-slate-900">{selectedProductIds.length} selected items</span> from your stock database? This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteModalOpen(false)}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmBulkDelete}
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer transition-all shadow-md flex items-center gap-1.5"
                >
                  {loading ? 'Deleting All...' : `Delete ${selectedProductIds.length} Items`}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
