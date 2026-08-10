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
  deleteDoc
} from '../lib/firebase';
import { Product, Store, UserAccount } from '../types';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { HardwarePermissionsBar } from './HardwarePermissionsBar';
import { 
  PackagePlus, 
  Barcode as BarcodeIcon, 
  Camera, 
  Search, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Tag, 
  DollarSign, 
  Layers, 
  PlusCircle, 
  Edit3,
  Trash2
} from 'lucide-react';

interface ProductRegisterViewProps {
  store: Store;
  currentUser: UserAccount;
}

export const ProductRegisterView: React.FC<ProductRegisterViewProps> = ({ store, currentUser }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Form states
  const [barcode, setBarcode] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [price, setPrice] = useState<number | ''>('');
  const [stockQuantityToAdd, setStockQuantityToAdd] = useState<number | ''>('');
  const [minStockLevel, setMinStockLevel] = useState<number>(5);

  const [existingProduct, setExistingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const serialNumberInputRef = useRef<HTMLInputElement | null>(null);
  const quantityInputRef = useRef<HTMLInputElement | null>(null);

  // Auto focus barcode input for fast hardware USB barcode scanner support
  useEffect(() => {
    if (!isScannerOpen && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [isScannerOpen]);

  // Catch physical barcode scanner typing if focus was accidentally blurred
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputActive = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
      if (!isInputActive && !isScannerOpen && barcodeInputRef.current) {
        if (e.key.length === 1 || e.key === 'Enter') {
          barcodeInputRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isScannerOpen]);

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
    });

    return () => unsub();
  }, [store?.id]);

  // Whenever barcode changes, check if existing product
  useEffect(() => {
    if (!barcode.trim()) {
      setExistingProduct(null);
      setSerialNumber('');
      setName('');
      setCategory('General');
      setPrice('');
      setStockQuantityToAdd('');
      return;
    }

    const trimmedBarcode = barcode.trim().toLowerCase();
    const found = products.find(p => p.barcode.trim().toLowerCase() === trimmedBarcode);

    if (found) {
      setExistingProduct(found);
      setSerialNumber(found.serialNumber || '');
      setName(found.name);
      setCategory(found.category || 'General');
      setPrice(found.price);
      setMinStockLevel(found.minStockLevel || 5);
      // Leave stock quantity to add blank so user can type the newly arrived quantity
      setStockQuantityToAdd('');
    } else {
      setExistingProduct(null);
    }
  }, [barcode, products]);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 5000);
  };

  const handleSelectProductToEdit = (p: Product) => {
    setBarcode(p.barcode);
    setSerialNumber(p.serialNumber || '');
    setExistingProduct(p);
    setName(p.name);
    setCategory(p.category || 'General');
    setPrice(p.price);
    setMinStockLevel(p.minStockLevel || 5);
    setStockQuantityToAdd('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitProductStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    const trimmedBarcode = barcode.trim();
    const trimmedSerial = serialNumber.trim();
    const trimmedName = name.trim();
    const numericPrice = typeof price === 'number' ? price : parseFloat(price as any);
    const addedQuantity = typeof stockQuantityToAdd === 'number' ? stockQuantityToAdd : parseInt(stockQuantityToAdd as string, 10);

    if (!trimmedBarcode) {
      showNotification('error', 'Barcode is required. Please scan or enter barcode.');
      return;
    }

    if (!trimmedSerial) {
      showNotification('error', 'Serial Number (S/N) is compulsory! Please enter a serial number for the product.');
      return;
    }

    if (!trimmedName) {
      showNotification('error', 'Product Name is required.');
      return;
    }

    if (isNaN(numericPrice) || numericPrice < 0) {
      showNotification('error', 'Please enter a valid price.');
      return;
    }

    if (isNaN(addedQuantity) || addedQuantity <= 0) {
      showNotification('error', 'Quantity is compulsory! Please enter stock quantity to add.');
      return;
    }

    // CHECK FOR BARCODE AND NAME MISMATCH VALIDATION
    // "if someone enter the same barcode the site will not proceed it, if the name of product is different from product that enter before, site will not proceed it"
    const existingBarcodeProduct = products.find(
      p => p.barcode.trim().toLowerCase() === trimmedBarcode.toLowerCase()
    );

    if (existingBarcodeProduct) {
      // Check if product names differ
      if (existingBarcodeProduct.name.trim().toLowerCase() !== trimmedName.toLowerCase()) {
        showNotification(
          'error',
          `Cannot proceed! Barcode "${trimmedBarcode}" is already registered under product name "${existingBarcodeProduct.name}". You cannot assign a different product name to an existing barcode. Use name "${existingBarcodeProduct.name}" or enter a new barcode.`
        );
        return;
      }
    }

    setLoading(true);

    try {
      const targetProduct = existingProduct || existingBarcodeProduct;

      if (targetProduct) {
        // UPDATE EXISTING PRODUCT
        const newTotalStock = targetProduct.stockQuantity + addedQuantity;
        const productDocRef = doc(db, 'products', targetProduct.id);

        await updateDoc(productDocRef, {
          barcode: trimmedBarcode,
          serialNumber: trimmedSerial,
          name: trimmedName,
          category: category.trim() || 'General',
          price: numericPrice,
          stockQuantity: newTotalStock,
          minStockLevel: minStockLevel || 5,
          updatedAt: new Date().toISOString()
        });

        showNotification(
          'success',
          `Updated "${trimmedName}" (S/N: ${trimmedSerial})! Added +${addedQuantity} units (New Total Stock: ${newTotalStock}). Latest Price: $${numericPrice.toFixed(2)}`
        );
      } else {
        // REGISTER NEW PRODUCT
        const productDocRef = doc(collection(db, 'products'));
        const newProduct: Product = {
          id: productDocRef.id,
          storeId: store.id,
          barcode: trimmedBarcode,
          serialNumber: trimmedSerial,
          name: trimmedName,
          category: category.trim() || 'General',
          price: numericPrice,
          stockQuantity: addedQuantity,
          minStockLevel: minStockLevel || 5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await setDoc(productDocRef, newProduct);

        showNotification(
          'success',
          `Registered new product "${trimmedName}" (S/N: ${trimmedSerial}) with initial stock of ${addedQuantity} units at $${numericPrice.toFixed(2)}.`
        );
      }

      // Reset form
      setBarcode('');
      setSerialNumber('');
      setName('');
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
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.barcode.toLowerCase().includes(term) ||
      (p.serialNumber && p.serialNumber.toLowerCase().includes(term)) ||
      p.category.toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Banner */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="space-y-2 z-10">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5">
                <PackagePlus className="w-3.5 h-3.5 text-blue-600" /> Product Register & Stock Entry
              </span>
              <span className="text-xs text-slate-500 font-medium">Store: {store.name}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Scan Barcode & <span className="text-orange-600">Update Stock</span>
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl font-medium">
              Scan product barcodes to add new inventory batches, adjust latest prices, or delete discontinued stock. Stock updates sync live across Store Admin and Cash Counters.
            </p>
          </div>

          <button
            onClick={() => setIsScannerOpen(true)}
            className="px-5 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 z-10"
          >
            <Camera className="w-5 h-5" /> Launch Camera Scanner
          </button>
        </div>

        {/* Hardware Permissions & Voice Controls */}
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
            {msg.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />}
            <span>{msg.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Form Column: Stock In & Product Form */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <PackagePlus className="w-5 h-5 text-orange-600" /> 
                  {existingProduct ? 'Update Existing Stock & Price' : 'Register New Stock Entry'}
                </h2>
                <p className="text-xs text-slate-600 mt-0.5 font-medium">
                  {existingProduct ? `Modifying "${existingProduct.name}"` : 'Enter product details and new stock batch'}
                </p>
              </div>

              {existingProduct && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  Existing Item
                </span>
              )}
            </div>

            <form onSubmit={handleSubmitProductStock} className="space-y-4">
              
              {/* Barcode Field with Scan Trigger */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Product Barcode *</span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    USB / Bluetooth Scanner Ready
                  </span>
                </label>
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <BarcodeIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      required
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      inputMode="text"
                      placeholder="Scan or enter barcode number..."
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
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-orange-500 font-mono shadow-inner"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="p-2.5 rounded-xl bg-slate-100 border border-slate-300 hover:border-orange-500 text-orange-600 hover:text-orange-700 transition-colors cursor-pointer shrink-0"
                    title="Camera Scanner"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Existing Stock Alert if found */}
              {existingProduct && (
                <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs space-y-1">
                  <div className="font-bold text-amber-900 flex items-center justify-between">
                    <span>Currently Available Stock:</span>
                    <span className="text-slate-900 text-sm font-extrabold">{existingProduct.stockQuantity} units</span>
                  </div>
                  <p className="text-slate-600 font-medium">
                    Entering quantity below will <span className="text-emerald-700 font-bold">ADD</span> to the available stock.
                  </p>
                </div>
              )}

              {/* Product Serial Number (Compulsory) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Serial Number (S/N) *</span>
                  <span className="text-[10px] text-red-600 font-bold">Compulsory for Cashier Lookup</span>
                </label>
                <input
                  ref={serialNumberInputRef}
                  type="text"
                  required
                  placeholder="e.g. SN-8839210 or 1004"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-orange-500 font-mono font-medium"
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Organic Whole Milk 1L"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-orange-500 font-medium"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Category
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dairy, Snacks, Beverages, Household"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-orange-500 font-medium"
                />
              </div>

              {/* Quantity to Add & Latest Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    {existingProduct ? 'Add Stock (+Qty) *' : 'Initial Stock Qty *'}
                  </label>
                  <input
                    ref={quantityInputRef}
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 50"
                    value={stockQuantityToAdd}
                    onChange={(e) => setStockQuantityToAdd(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-orange-500 font-bold text-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Latest Unit Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="e.g. 250.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-orange-500 font-bold text-orange-600"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  <PlusCircle className="w-5 h-5" />
                  {loading ? 'Saving Stock...' : existingProduct ? 'Update Stock Batch & Price' : 'Register New Product Stock'}
                </button>

                {existingProduct && (
                  <button
                    type="button"
                    onClick={() => handleDeleteProduct(existingProduct)}
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                    Delete Product From Stock
                  </button>
                )}
              </div>

            </form>
          </div>

          {/* Right Column: Registered Inventory Catalog */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-600" /> Current Store Inventory ({products.length})
                </h2>
                <p className="text-xs text-slate-600 font-medium">Click update or delete on any product to manage stock</p>
              </div>

              <div className="flex items-center gap-2">
                {selectedProductIds.length > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedProductIds.length})
                  </button>
                )}

                <div className="relative min-w-[180px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search catalog..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-orange-500 font-medium"
                  />
                </div>
              </div>
            </div>

            {filteredCatalog.length === 0 ? (
              <p className="text-sm text-slate-500 p-8 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50">
                No products found in catalog. Use the form on the left to add items.
              </p>
            ) : (
              <div className="overflow-x-auto overflow-y-auto max-h-[560px] border border-slate-200 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-600 uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="p-3 w-8">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.length === filteredCatalog.length && filteredCatalog.length > 0}
                          onChange={handleToggleSelectAll}
                          className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500 cursor-pointer"
                          title="Select / Deselect all"
                        />
                      </th>
                      <th className="p-3">Product</th>
                      <th className="p-3">S/N & Barcode</th>
                      <th className="p-3 text-center">Price</th>
                      <th className="p-3 text-center">Available Stock</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredCatalog.map((p) => {
                      const isSelected = selectedProductIds.includes(p.id);
                      return (
                        <tr key={p.id} className={`${isSelected ? 'bg-orange-50/60' : 'hover:bg-slate-50'} transition-colors`}>
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectProduct(p.id)}
                              className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{p.name}</div>
                            <div className="text-[10px] text-slate-500 font-medium">{p.category || 'General'}</div>
                          </td>
                          <td className="p-3 text-xs space-y-0.5 font-mono">
                            <div className="font-bold text-slate-800">S/N: <span className="text-orange-700">{p.serialNumber || 'N/A'}</span></div>
                            <div className="text-[11px] text-slate-500">BC: {p.barcode}</div>
                          </td>
                          <td className="p-3 text-center font-bold text-orange-600">
                            ₹{p.price.toFixed(2)}
                          </td>
                          <td className="p-3 text-center font-extrabold text-sm">
                            <span className={p.stockQuantity <= 0 ? 'text-red-600' : p.stockQuantity <= 5 ? 'text-amber-600' : 'text-emerald-600'}>
                              {p.stockQuantity}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleSelectProductToEdit(p)}
                                className="px-2.5 py-1.5 rounded-lg bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-600 hover:text-white transition-all text-xs font-bold flex items-center gap-1 cursor-pointer shadow-sm"
                                title="Update stock or price"
                              >
                                <Edit3 className="w-3 h-3" /> Edit
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p)}
                                className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white transition-all text-xs font-bold flex items-center gap-1 cursor-pointer shadow-sm"
                                title="Delete stock item"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
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
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-red-100 text-red-600 rounded-xl shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Delete Product from Inventory?</h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Are you sure you want to permanently delete <span className="font-bold text-slate-900">"{productToDelete.name}"</span>?
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-mono space-y-1 text-slate-700">
                <div><span className="font-bold">Barcode:</span> {productToDelete.barcode}</div>
                {productToDelete.serialNumber && <div><span className="font-bold">S/N:</span> {productToDelete.serialNumber}</div>}
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
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-red-100 text-red-600 rounded-xl shrink-0">
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
