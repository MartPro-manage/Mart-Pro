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

export interface SpreadsheetRowItem {
  id: string;
  name: string;
  price: number | '';
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

export const ExcelManagerModal: React.FC<ExcelManagerModalProps> = ({
  isOpen,
  onClose,
  store,
  existingProducts = [],
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

  // Rows for In-App Spreadsheet Creator
  const [rows, setRows] = useState<SpreadsheetRowItem[]>([
    { id: 'row-1', name: '', price: '', category: 'Grain', barcode: generateRandomBarcode() },
    { id: 'row-2', name: '', price: '', category: 'Oil', barcode: generateRandomBarcode() },
    { id: 'row-3', name: '', price: '', category: 'Biscuit', barcode: generateRandomBarcode() },
    { id: 'row-4', name: '', price: '', category: 'Ghee', barcode: generateRandomBarcode() },
    { id: 'row-5', name: '', price: '', category: 'Tea', barcode: generateRandomBarcode() },
  ]);

  // Uploading status
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // References to input elements for precise Enter key navigation
  // Map key: `${rowIndex}-${fieldName}`
  const cellRefs = useRef<{ [key: string]: HTMLInputElement | HTMLSelectElement | null }>({});

  useEffect(() => {
    if (isOpen) {
      setCategoriesList(getAllCategories(store, existingProducts));
      setUploadError(null);
    }
  }, [isOpen, store, existingProducts]);

  if (!isOpen) return null;

  // Add 1 empty row
  const handleAddRow = () => {
    const newId = `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const defaultCat = categoriesList[0] || 'General';
    setRows(prev => [
      ...prev,
      { id: newId, name: '', price: '', category: defaultCat, barcode: generateRandomBarcode() }
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
        category: defaultCat,
        barcode: generateRandomBarcode()
      });
    }
    setRows(prev => [...prev, ...newRows]);
  };

  // Delete row
  const handleDeleteRow = (id: string) => {
    if (rows.length <= 1) {
      // Clear instead of removing last row
      setRows([{ id: 'row-1', name: '', price: '', category: 'General', barcode: generateRandomBarcode() }]);
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
  };

  // Keydown handler: when user clicks ENTER in a row cell (especially barcode or any cell), move to next row!
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    rowIndex: number,
    fieldName: 'name' | 'price' | 'category' | 'barcode'
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      // If user is on barcode, or presses enter, move down to second/next row!
      const nextRowIndex = rowIndex + 1;

      if (nextRowIndex < rows.length) {
        // Move to existing next row's Product Name
        setTimeout(() => {
          cellRefs.current[`${nextRowIndex}-name`]?.focus();
        }, 10);
      } else {
        // It's the last row! Automatically create a new row and focus it
        const newId = `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const defaultCat = rows[rowIndex].category || 'General';
        setRows(prev => [
          ...prev,
          { id: newId, name: '', price: '', category: defaultCat, barcode: generateRandomBarcode() }
        ]);

        // Focus the new row's name after re-render
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

      // Convert parsed rows to spreadsheet rows so user can see them in table
      const convertedRows: SpreadsheetRowItem[] = parsed.map((p, idx) => ({
        id: `upload-${Date.now()}-${idx}`,
        name: p.name,
        price: p.price,
        category: p.category || 'General',
        barcode: p.barcode || generateRandomBarcode()
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

  // Handle "Send to AI" button click
  const handleSendToAi = () => {
    setUploadError(null);

    // Filter valid rows (must have product name)
    const validRows = rows.filter(r => r.name.trim().length > 0);

    if (validRows.length === 0) {
      setUploadError('Please enter at least one product name before sending to AI.');
      return;
    }

    // Convert to BatchProductRow format
    const batchProducts: BatchProductRow[] = validRows.map((r, idx) => {
      const pPrice = typeof r.price === 'number' ? r.price : parseFloat(String(r.price)) || 0;
      return {
        id: r.id || `batch-${idx}`,
        name: r.name.trim(),
        price: pPrice,
        costPrice: Math.round(pPrice * 0.8), // estimated cost or 0
        category: r.category.trim() || 'General',
        barcode: r.barcode.trim() || generateRandomBarcode(),
        sellBy: 'unit',
        unitType: 'piece',
        quantity: 10
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
                      <th className="py-3 px-3 min-w-[200px]">Name of Product *</th>
                      <th className="py-3 px-3 w-36">Price (Rs.) *</th>
                      <th className="py-3 px-3 w-48">Choose Category</th>
                      <th className="py-3 px-3 min-w-[180px]">Barcode</th>
                      <th className="py-3 px-3 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {rows.map((row, index) => (
                      <tr 
                        key={row.id}
                        className="hover:bg-orange-50/30 transition-colors group"
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
                            className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-orange-500 rounded-lg text-xs sm:text-sm font-medium focus:outline-none transition-all"
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
                              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-orange-500 rounded-lg text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none transition-all"
                            />
                          </div>
                        </td>

                        {/* 3. Choose Category */}
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

                        {/* 4. Barcode */}
                        <td className="py-2.5 px-3">
                          <div className="relative flex items-center gap-1">
                            <input
                              ref={el => cellRefs.current[`${index}-barcode`] = el}
                              type="text"
                              value={row.barcode}
                              onChange={(e) => handleUpdateCell(index, 'barcode', e.target.value)}
                              onKeyDown={(e) => handleCellKeyDown(e, index, 'barcode')}
                              placeholder="Barcode / EAN"
                              className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-orange-500 rounded-lg text-xs font-mono font-medium text-slate-800 focus:outline-none transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateCell(index, 'barcode', generateRandomBarcode())}
                              className="p-1.5 text-slate-400 hover:text-orange-600 rounded-md hover:bg-slate-100 transition-colors"
                              title="Generate random barcode"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
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
                    ))}
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
