import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  Table, 
  Plus, 
  Trash2, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Barcode as BarcodeIcon, 
  Download, 
  RefreshCw, 
  ArrowRight,
  Boxes,
  Layers,
  Check,
  FolderUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Store } from '../types';
import { BatchProductRow, parseExcelProductFile, generateRandomBarcode } from '../lib/excelParser';
import { getAllCategories, saveNewCategoryToStore, DEFAULT_PRESET_CATEGORIES } from '../lib/categories';
import { playScanSuccessBeep } from '../lib/sound';
import { ScannableBarcodePreview } from './ScannableBarcodePreview';

export interface SpreadsheetRowItem {
  id: string;
  name: string;
  price: number | '';
  quantity: number | '';
  category: string;
  barcode: string;
}

interface ExcelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: Store;
  existingProducts?: Product[];
  onSendToAi: (parsedProducts: BatchProductRow[]) => void;
  onDirectRegisterSuccess?: (count: number) => void;
  onProductsSaved?: (count?: number) => void;
  onOpenBatchModal?: () => void;
}

const DEFAULT_EXISTING_PRODUCTS: Product[] = [];

export const ExcelManagerModal: React.FC<ExcelManagerModalProps> = ({
  isOpen,
  onClose,
  store,
  existingProducts = DEFAULT_EXISTING_PRODUCTS,
  onSendToAi,
  onDirectRegisterSuccess,
  onProductsSaved,
  onOpenBatchModal
}) => {
  // Step/Mode: 'choose_option' | 'create_now'
  const [activeTab, setActiveTab] = useState<'choose_option' | 'create_now'>('choose_option');
  
  // Categories
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [newCatInput, setNewCatInput] = useState('');
  const [isAddingNewCat, setIsAddingNewCat] = useState(false);
  const [newCatRowTargetIndex, setNewCatRowTargetIndex] = useState<number | null>(null);

  // Rows for In-App Spreadsheet Creator - quantity is now explicitly required
  const [rows, setRows] = useState<SpreadsheetRowItem[]>([
    { id: 'row-1', name: '', price: '', quantity: '', category: 'Grain', barcode: '' },
    { id: 'row-2', name: '', price: '', quantity: '', category: 'Oil', barcode: '' },
    { id: 'row-3', name: '', price: '', quantity: '', category: 'Biscuit', barcode: '' },
    { id: 'row-4', name: '', price: '', quantity: '', category: 'Ghee', barcode: '' },
    { id: 'row-5', name: '', price: '', quantity: '', category: 'Tea', barcode: '' },
  ]);

  // Uploading status
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // References to input elements for precise Enter key navigation
  // Map key: `${rowIndex}-${fieldName}`
  const cellRefs = useRef<{ [key: string]: HTMLInputElement | HTMLSelectElement | null }>({});

  useEffect(() => {
    if (isOpen) {
      setCategoriesList(getAllCategories(store, existingProducts));
      setUploadError(null);
      setHasAttemptedSubmit(false);
    }
  }, [isOpen, store?.id, existingProducts.length]);

  if (!isOpen) return null;

  // Add 1 empty row
  const handleAddRow = () => {
    const newId = `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const defaultCat = categoriesList[0] || 'General';
    setRows(prev => [
      ...prev,
      { id: newId, name: '', price: '', quantity: '', category: defaultCat, barcode: '' }
    ]);
  };

  // Add 5 empty rows
  const handleAdd5Rows = () => {
    const defaultCat = categoriesList[0] || 'General';
    const newRows: SpreadsheetRowItem[] = [];
    for (let i = 0; i < 5; i++) {
      newRows.push({
        id: `row-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        name: '',
        price: '',
        quantity: '',
        category: defaultCat,
        barcode: ''
      });
    }
    setRows(prev => [...prev, ...newRows]);
  };

  // Delete row
  const handleDeleteRow = (id: string) => {
    if (rows.length <= 1) {
      // Clear instead of removing last row
      setRows([{ id: 'row-1', name: '', price: '', quantity: '', category: 'General', barcode: '' }]);
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
  };

  // Update cell
  const handleUpdateCell = (index: number, field: keyof SpreadsheetRowItem, value: any) => {
    setRows(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    if (uploadError) {
      setUploadError(null);
    }
  };

  // 4-Way Arrow Key & Enter Navigation for Excel spreadsheet cells (Up, Down, Left, Right, Enter)
  const columnOrder: Array<'name' | 'price' | 'quantity' | 'category' | 'barcode'> = ['name', 'price', 'quantity', 'category', 'barcode'];

  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    rowIndex: number,
    fieldName: 'name' | 'price' | 'quantity' | 'category' | 'barcode'
  ) => {
    const target = e.currentTarget;
    const isInput = target.tagName === 'INPUT';
    const inputEl = isInput ? (target as HTMLInputElement) : null;
    const colIdx = columnOrder.indexOf(fieldName);

    // 1. ARROW UP: Move to the cell directly above in the same column
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowIndex > 0) {
        cellRefs.current[`${rowIndex - 1}-${fieldName}`]?.focus();
      }
      return;
    }

    // 2. ARROW DOWN: Move to the cell directly below in the same column
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowIndex < rows.length - 1) {
        cellRefs.current[`${rowIndex + 1}-${fieldName}`]?.focus();
      } else {
        // Last row: automatically append a new row and focus the same column
        const newId = `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const defaultCat = rows[rowIndex]?.category || 'General';
        setRows(prev => [
          ...prev,
          { id: newId, name: '', price: '', quantity: '', category: defaultCat, barcode: '' }
        ]);
        setTimeout(() => {
          cellRefs.current[`${rowIndex + 1}-${fieldName}`]?.focus();
        }, 50);
      }
      return;
    }

    // 3. ARROW LEFT: Move to previous column if cursor at beginning or for select
    if (e.key === 'ArrowLeft') {
      const atStart = !inputEl || (inputEl.selectionStart === 0 && inputEl.selectionEnd === 0);
      if (atStart && colIdx > 0) {
        e.preventDefault();
        const prevCol = columnOrder[colIdx - 1];
        cellRefs.current[`${rowIndex}-${prevCol}`]?.focus();
        return;
      }
    }

    // 4. ARROW RIGHT: Move to next column if cursor at end or for select
    if (e.key === 'ArrowRight') {
      const atEnd = !inputEl || (inputEl.selectionStart === inputEl.value.length);
      if (atEnd && colIdx < columnOrder.length - 1) {
        e.preventDefault();
        const nextCol = columnOrder[colIdx + 1];
        cellRefs.current[`${rowIndex}-${nextCol}`]?.focus();
        return;
      }
    }

    // 5. ENTER: Move to next field or jump down to the next row's first column (Name)
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextRowIndex = rowIndex + 1;

      if (nextRowIndex < rows.length) {
        setTimeout(() => {
          cellRefs.current[`${nextRowIndex}-name`]?.focus();
        }, 10);
      } else {
        // Last row: automatically create a new row and focus it
        const newId = `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const defaultCat = rows[rowIndex]?.category || 'General';
        setRows(prev => [
          ...prev,
          { id: newId, name: '', price: '', quantity: '', category: defaultCat, barcode: '' }
        ]);

        setTimeout(() => {
          cellRefs.current[`${nextRowIndex}-name`]?.focus();
        }, 50);
      }
    }
  };

  // Handle saving new custom category
  const handleConfirmNewCategory = async () => {
    if (!newCatInput.trim()) {
      setIsAddingNewCat(false);
      return;
    }
    const trimmed = newCatInput.trim();
    const updated = await saveNewCategoryToStore(store.id, store.customCategories || [], trimmed);
    setCategoriesList(prev => Array.from(new Set([...prev, trimmed])));

    if (newCatRowTargetIndex !== null && rows[newCatRowTargetIndex]) {
      handleUpdateCell(newCatRowTargetIndex, 'category', trimmed);
    }
    setNewCatInput('');
    setIsAddingNewCat(false);
    setNewCatRowTargetIndex(null);
  };

  // Handle Option 1: File Upload from Device
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const parsed = await parseExcelProductFile(file);
      if (!parsed || parsed.length === 0) {
        throw new Error('No valid products found in the file.');
      }

      playScanSuccessBeep();

      // Convert parsed rows to spreadsheet rows
      const convertedRows: SpreadsheetRowItem[] = parsed.map((p, idx) => ({
        id: `upload-${Date.now()}-${idx}`,
        name: p.name,
        price: p.price,
        quantity: p.quantity ?? 1,
        category: p.category || 'General',
        barcode: p.barcode ? p.barcode.trim() : ''
      }));

      setRows(convertedRows);
      // Switch directly to in-app spreadsheet view so user can review and send to AI!
      setActiveTab('create_now');
    } catch (err: any) {
      setUploadError(err.message || 'Failed to parse Excel file. Ensure it has product names and prices.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle "Send to AI" button click with STRICT VALIDATION
  const handleSendToAi = () => {
    setHasAttemptedSubmit(true);
    setUploadError(null);

    // Identify rows that have ANY content
    const rowsWithData = rows.filter(r => 
      r.name.trim().length > 0 || 
      r.price !== '' || 
      r.quantity !== '' || 
      r.barcode.trim().length > 0
    );

    if (rowsWithData.length === 0) {
      setUploadError('Please fill in product details (Name, Price, and Quantity) for at least one item before proceeding.');
      return;
    }

    // STRICT VALIDATION: Without filling Name, Price (>0), and Quantity (>=0), we CANNOT proceed to next!
    const incompleteRows = rowsWithData.filter(r => {
      const hasName = r.name.trim().length > 0;
      const numPrice = typeof r.price === 'number' ? r.price : parseFloat(String(r.price));
      const hasValidPrice = !isNaN(numPrice) && numPrice > 0;
      const numQty = typeof r.quantity === 'number' ? r.quantity : parseFloat(String(r.quantity));
      const hasValidQty = r.quantity !== '' && !isNaN(numQty) && numQty >= 0;
      
      return !hasName || !hasValidPrice || !hasValidQty;
    });

    if (incompleteRows.length > 0) {
      setUploadError(`Cannot proceed: ${incompleteRows.length} product row(s) are missing required fields. Every product must have a Name, Selling Price (> 0), and Quantity (≥ 0).`);
      return;
    }

    // Convert to BatchProductRow format
    const batchProducts: BatchProductRow[] = rowsWithData.map((r, idx) => {
      const pPrice = typeof r.price === 'number' ? r.price : parseFloat(String(r.price)) || 0;
      const pQty = typeof r.quantity === 'number' ? r.quantity : parseFloat(String(r.quantity)) || 0;
      return {
        id: r.id || `batch-${idx}`,
        name: r.name.trim(),
        price: pPrice,
        costPrice: Math.round(pPrice * 0.8), // estimated cost or 0
        category: r.category.trim() || 'General',
        barcode: r.barcode.trim(),
        sellBy: 'unit',
        unitType: 'piece',
        quantity: pQty
      };
    });

    playScanSuccessBeep();
    onClose();
    onSendToAi(batchProducts);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-600 text-white">
                  Excel & Spreadsheet Manager
                </span>
                <span className="text-xs text-slate-400 font-mono">{store.name}</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                Bulk Products & In-App Spreadsheet
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'create_now' && (
              <button
                type="button"
                onClick={() => setActiveTab('choose_option')}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
              >
                ← Change Method
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ERROR NOTIFICATION BANNER */}
        {uploadError && (
          <div className="p-3 bg-red-50 border-b border-red-200 text-red-700 text-xs font-bold flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{uploadError}</span>
            </div>
            <button onClick={() => setUploadError(null)} className="text-red-500 hover:text-red-800 text-xs">
              Dismiss
            </button>
          </div>
        )}

        {/* SCREEN 1: THE TWO OPTIONS CHOICE SCREEN (AS REQUESTED) */}
        {activeTab === 'choose_option' && (
          <div className="p-6 sm:p-10 flex-1 overflow-y-auto space-y-6">
            <div className="text-center max-w-xl mx-auto space-y-1.5">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                How would you like to add your products?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 font-medium">
                Choose one of the two options below to import from a file or create in our interactive live spreadsheet:
              </p>
            </div>

            {/* Hidden native file input for Option 1 */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="hidden"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto pt-2">
              
              {/* OPTION 1: UPLOAD FROM DEVICE */}
              <motion.button
                whileHover={{ y: -3, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="p-6 rounded-3xl border-2 border-slate-200 hover:border-orange-500 bg-white hover:bg-orange-50/40 text-left transition-all shadow-sm hover:shadow-xl group flex flex-col justify-between cursor-pointer relative overflow-hidden"
              >
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold shadow-inner group-hover:bg-orange-600 group-hover:text-white transition-all">
                    <FolderUp className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 block mb-1">
                      Option 1
                    </span>
                    <h4 className="text-lg font-black text-slate-900 group-hover:text-orange-950">
                      Upload from device
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                      Upload an existing Excel (.xlsx, .xls) or CSV spreadsheet from your computer or phone. Columns and barcodes are parsed automatically.
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-orange-600">
                  <span>{isUploading ? 'Parsing file...' : 'Choose File from Device'}</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.button>

              {/* OPTION 2: CREATE NOW (IN-APP SPREADSHEET) */}
              <motion.button
                whileHover={{ y: -3, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="button"
                onClick={() => setActiveTab('create_now')}
                className="p-6 rounded-3xl border-2 border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/40 text-left transition-all shadow-sm hover:shadow-xl group flex flex-col justify-between cursor-pointer relative overflow-hidden"
              >
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold shadow-inner group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    <Table className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block mb-1">
                      Option 2
                    </span>
                    <h4 className="text-lg font-black text-slate-900 group-hover:text-emerald-950">
                      Create now
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                      Create a spreadsheet right inside the app! Add product name, price, choose category, and barcode. Press Enter to jump to the next row, then Send to AI.
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-600">
                  <span>Open In-App Table Creator</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.button>

            </div>

            {/* Quick Helper Tips */}
            <div className="max-w-xl mx-auto p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
              💡 <strong>Pro-Tip:</strong> In "Create now", pressing <strong>Enter</strong> automatically moves your cursor to the second/next row and adds new rows on the fly!
            </div>
          </div>
        )}

        {/* SCREEN 2: IN-APP SPREADSHEET CREATOR (OPTION 2) */}
        {activeTab === 'create_now' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Table Control Sub-header */}
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 px-6">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Product Rows ({rows.filter(r => r.name.trim()).length} of {rows.length} filled)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  ⌨️ Enter key moves to next row
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-orange-600" /> Add Row
                </button>
                <button
                  type="button"
                  onClick={handleAdd5Rows}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600" /> +5 Rows
                </button>
              </div>
            </div>

            {/* Scrollable Table Area */}
            <div className="flex-1 overflow-auto custom-scrollbar p-4 sm:p-6 bg-slate-100/50">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-w-[700px]">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[11px] uppercase tracking-wider font-extrabold border-b border-slate-800">
                      <th className="py-3 px-3 w-12 text-center">#</th>
                      <th className="py-3 px-3 min-w-[190px]">Name of Product *</th>
                      <th className="py-3 px-3 w-32">Price (Rs.) *</th>
                      <th className="py-3 px-3 w-28">Quantity *</th>
                      <th className="py-3 px-3 w-40">Choose Category</th>
                      <th className="py-3 px-3 min-w-[170px]">Barcode</th>
                      <th className="py-3 px-3 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {rows.map((row, index) => {
                      const hasRowData = row.name.trim().length > 0 || row.price !== '' || row.quantity !== '' || row.barcode.trim().length > 0;
                      const isNameInvalid = hasAttemptedSubmit && hasRowData && row.name.trim().length === 0;
                      const isPriceInvalid = hasAttemptedSubmit && hasRowData && (row.price === '' || isNaN(Number(row.price)) || Number(row.price) <= 0);
                      const isQtyInvalid = hasAttemptedSubmit && hasRowData && (row.quantity === '' || isNaN(Number(row.quantity)) || Number(row.quantity) < 0);

                      return (
                      <tr 
                        key={row.id}
                        className={`transition-colors group ${
                          (isNameInvalid || isPriceInvalid || isQtyInvalid) ? 'bg-red-50/60' : 'hover:bg-orange-50/30'
                        }`}
                      >
                        {/* Row Number */}
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-xs">
                          {index + 1}
                        </td>

                        {/* 1. Name of Product */}
                        <td className="py-2.5 px-3">
                          <input
                            ref={el => cellRefs.current[`${index}-name`] = el}
                            type="text"
                            value={row.name}
                            onChange={(e) => handleUpdateCell(index, 'name', e.target.value)}
                            onKeyDown={(e) => handleCellKeyDown(e, index, 'name')}
                            placeholder="e.g. Zeera Plus Biscuit, Dalda Oil..."
                            className={`w-full px-3 py-1.5 bg-slate-50 focus:bg-white border rounded-lg text-xs sm:text-sm font-medium focus:outline-none transition-all ${
                              isNameInvalid ? 'border-red-500 bg-red-50 focus:border-red-600' : 'border-slate-200 focus:border-orange-500'
                            }`}
                          />
                        </td>

                        {/* 2. Price of Product */}
                        <td className="py-2.5 px-3">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                              Rs.
                            </span>
                            <input
                              ref={el => cellRefs.current[`${index}-price`] = el}
                              type="number"
                              step="any"
                              min="0"
                              value={row.price}
                              onChange={(e) => handleUpdateCell(index, 'price', e.target.value === '' ? '' : parseFloat(e.target.value))}
                              onKeyDown={(e) => handleCellKeyDown(e, index, 'price')}
                              placeholder="0.00"
                              className={`w-full pl-8 pr-3 py-1.5 bg-slate-50 focus:bg-white border rounded-lg text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none transition-all ${
                                isPriceInvalid ? 'border-red-500 bg-red-50 focus:border-red-600' : 'border-slate-200 focus:border-orange-500'
                              }`}
                            />
                          </div>
                        </td>

                        {/* 3. Quantity of Product */}
                        <td className="py-2.5 px-3">
                          <div className="relative">
                            <input
                              ref={el => cellRefs.current[`${index}-quantity`] = el}
                              type="number"
                              step="any"
                              min="0"
                              value={row.quantity}
                              onChange={(e) => handleUpdateCell(index, 'quantity', e.target.value === '' ? '' : parseFloat(e.target.value))}
                              onKeyDown={(e) => handleCellKeyDown(e, index, 'quantity')}
                              placeholder="e.g. 10"
                              className={`w-full px-3 py-1.5 bg-slate-50 focus:bg-white border rounded-lg text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none transition-all ${
                                isQtyInvalid ? 'border-red-500 bg-red-50 focus:border-red-600' : 'border-slate-200 focus:border-orange-500'
                              }`}
                            />
                          </div>
                        </td>

                        {/* 4. Choose Category */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            <select
                              ref={el => cellRefs.current[`${index}-category`] = el}
                              value={row.category}
                              onChange={(e) => {
                                if (e.target.value === '__add_new__') {
                                  setNewCatRowTargetIndex(index);
                                  setIsAddingNewCat(true);
                                } else {
                                  handleUpdateCell(index, 'category', e.target.value);
                                }
                              }}
                              onKeyDown={(e) => handleCellKeyDown(e, index, 'category')}
                              className="w-full px-2.5 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-orange-500 rounded-lg text-xs font-bold text-slate-800 focus:outline-none transition-all"
                            >
                              {categoriesList.map(cat => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                              <option value="__add_new__" className="text-orange-600 font-bold">
                                ➕ + Add New Category...
                              </option>
                            </select>
                          </div>
                        </td>

                        {/* 5. Barcode with Automatic Scannable Preview */}
                        <td className="py-2.5 px-3 min-w-[170px]">
                          <div className="space-y-1.5">
                            <div className="relative flex items-center gap-1">
                              <input
                                ref={el => cellRefs.current[`${index}-barcode`] = el}
                                type="text"
                                value={row.barcode}
                                onChange={(e) => handleUpdateCell(index, 'barcode', e.target.value)}
                                onKeyDown={(e) => handleCellKeyDown(e, index, 'barcode')}
                                placeholder="Barcode / EAN"
                                className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-orange-500 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none transition-all"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateCell(index, 'barcode', generateRandomBarcode())}
                                className="p-1.5 text-slate-400 hover:text-orange-600 rounded-md hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
                                title="Generate fresh barcode"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Automatic Scannable Barcode Display */}
                            {row.barcode?.trim() ? (
                              <div className="bg-white p-1 rounded-md border border-slate-200/80 shadow-2xs flex items-center justify-center">
                                <ScannableBarcodePreview value={row.barcode} compact={true} />
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleUpdateCell(index, 'barcode', generateRandomBarcode())}
                                className="text-[10px] font-bold text-orange-600 hover:text-orange-700 underline flex items-center gap-1 cursor-pointer"
                              >
                                ⚡ Generate Scannable Barcode
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Delete Row */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row.id)}
                            className="p-1 text-slate-300 hover:text-red-600 transition-colors rounded-lg cursor-pointer"
                            title="Delete row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Footer Actions with "Send to AI" (as explicitly requested) */}
            <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 px-6 shrink-0">
              <div className="text-xs text-slate-500 font-medium">
                Tip: Pressing <kbd className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 font-mono font-bold">Enter</kbd> moves cursor straight to the second/next row!
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                {/* Send Button: sends created spreadsheet to AI */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={handleSendToAi}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 hover:from-orange-500 hover:to-amber-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-200" />
                  <span>Send to AI</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* QUICK INLINE MODAL TO ADD NEW CATEGORY */}
      {isAddingNewCat && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 space-y-3 animate-scale-in">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-slate-900">Add New Category</h4>
              <button 
                onClick={() => setIsAddingNewCat(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Type the new category name to add it to your store and select it for this product:
            </p>
            <input
              type="text"
              autoFocus
              placeholder="e.g. Pet Care, Stationery, Electronics..."
              value={newCatInput}
              onChange={(e) => setNewCatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirmNewCategory();
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingNewCat(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmNewCategory}
                className="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Add Category
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
