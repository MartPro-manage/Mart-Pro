import React, { useState, useEffect } from 'react';
import { 
  X, 
  Barcode as BarcodeIcon, 
  Sparkles, 
  Upload, 
  Image as ImageIcon, 
  Check, 
  AlertCircle 
} from 'lucide-react';
import { Product, Store, UserAccount } from '../../types';
import { db, doc, setDoc, updateDoc, cleanFirestoreData } from '../../lib/firebase';

interface Screen6AddEditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  store: Store | null;
  currentUser: UserAccount | null;
  onProductSaved: (product: Product) => void;
}

export const Screen6AddEditProductModal: React.FC<Screen6AddEditProductModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  store,
  currentUser,
  onProductSaved
}) => {
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('Grocery');
  const [unitType, setUnitType] = useState<'piece' | 'kg' | 'g' | 'liter' | 'dozen'>('piece');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [costPrice, setCostPrice] = useState<string>('0');
  const [sellingPrice, setSellingPrice] = useState<string>('0');
  const [stockQuantity, setStockQuantity] = useState<string>('50');
  const [reorderLevel, setReorderLevel] = useState<string>('10');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [trackStock, setTrackStock] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when editing an existing product
  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name || '');
      setBarcode(productToEdit.barcode || '');
      setCategory(productToEdit.category || 'Grocery');
      setUnitType(productToEdit.unitType || 'piece');
      setBrand(productToEdit.brand || '');
      setDescription(productToEdit.description || '');
      setCostPrice((productToEdit.costPrice || 0).toString());
      setSellingPrice((productToEdit.price || 0).toString());
      setStockQuantity((productToEdit.stockQuantity || 0).toString());
      setReorderLevel((productToEdit.reorderLevel || productToEdit.minStockLevel || 10).toString());
      setImageUrl(productToEdit.imageUrl || '');
      setIsActive(productToEdit.isActive !== false);
      setTrackStock(productToEdit.trackStock !== false);
    } else {
      // Default clean values matching reference mockup Screen 6
      setName('Tomato Ketchup');
      setBarcode('871234567890');
      setCategory('Sauces & Spreads');
      setUnitType('piece');
      setBrand('National');
      setDescription('Rich & Tasty');
      setCostPrice('180');
      setSellingPrice('260');
      setStockQuantity('50');
      setReorderLevel('10');
      setImageUrl('https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&auto=format&fit=crop&q=80');
      setIsActive(true);
      setTrackStock(true);
    }
  }, [productToEdit, isOpen]);

  if (!isOpen) return null;

  const handleGenerateBarcode = () => {
    const random12Digits = '896' + Math.floor(100000000 + Math.random() * 900000000).toString();
    setBarcode(random12Digits);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Product Name is required.');
      return;
    }

    const priceNum = parseFloat(sellingPrice) || 0;
    const costNum = parseFloat(costPrice) || 0;
    const stockNum = parseFloat(stockQuantity) || 0;
    const reorderNum = parseFloat(reorderLevel) || 5;

    if (priceNum <= 0) {
      setError('Selling price must be greater than 0.');
      return;
    }

    setLoading(true);
    try {
      const storeId = store?.id || 'mart-pro-store';
      const productId = productToEdit?.id || `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const productPayload: Product = {
        id: productId,
        storeId,
        name: name.trim(),
        barcode: barcode.trim() || '896' + Math.floor(100000000 + Math.random() * 900000000).toString(),
        shortcutCode: productToEdit?.shortcutCode || Math.floor(1000 + Math.random() * 9000).toString(),
        category,
        unitType,
        brand: brand.trim(),
        description: description.trim(),
        costPrice: costNum,
        price: priceNum,
        stockQuantity: stockNum,
        reorderLevel: reorderNum,
        minStockLevel: reorderNum,
        imageUrl: imageUrl.trim(),
        isActive,
        trackStock,
        updatedAt: new Date().toISOString(),
        createdAt: productToEdit?.createdAt || new Date().toISOString()
      };

      await setDoc(doc(db, 'products', productId), cleanFirestoreData(productPayload));

      onProductSaved(productPayload);
      onClose();
    } catch (err: any) {
      console.error('Error saving product:', err);
      setError('Failed to save product in database.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs select-none animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
        {/* Header matching Screen 6 in mockup */}
        <div className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-black text-[#111111] tracking-tight">
            {productToEdit ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body matching two-column layout */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 bg-[#F8F9FA] space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* LEFT COLUMN: Product Information */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
              <h3 className="text-sm font-black text-[#111111] uppercase tracking-wider border-b border-slate-100 pb-2">
                Product Information
              </h3>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Tomato Ketchup"
                  className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-semibold text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500] focus:ring-2 focus:ring-[#FF6500]/15"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Barcode
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateBarcode}
                    className="text-[11px] font-bold text-[#FF6500] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="871234567890"
                  className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-semibold text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-semibold text-slate-900 px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                  >
                    <option value="Sauces & Spreads">Sauces & Spreads</option>
                    <option value="Grocery">Grocery</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Bakery">Bakery</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Snacks">Snacks</option>
                    <option value="Household">Household</option>
                    <option value="Personal Care">Personal Care</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Unit
                  </label>
                  <select
                    value={unitType}
                    onChange={(e: any) => setUnitType(e.target.value)}
                    className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-semibold text-slate-900 px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                  >
                    <option value="piece">Piece</option>
                    <option value="kg">Kg</option>
                    <option value="g">Grams</option>
                    <option value="liter">Liter</option>
                    <option value="dozen">Dozen</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Brand
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. National"
                  className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-semibold text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Rich & Tasty"
                  className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-medium text-slate-900 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                />
              </div>
            </div>

            {/* RIGHT COLUMN: Pricing & Stock */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-sm font-black text-[#111111] uppercase tracking-wider border-b border-slate-100 pb-2">
                  Pricing & Stock
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Purchase Price (Rs.)
                    </label>
                    <input
                      type="number"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      placeholder="180"
                      className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-bold text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Selling Price (Rs.) *
                    </label>
                    <input
                      type="number"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      placeholder="260"
                      className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-bold text-[#FF6500] px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Stock Quantity
                    </label>
                    <input
                      type="number"
                      value={stockQuantity}
                      onChange={(e) => setStockQuantity(e.target.value)}
                      placeholder="50"
                      className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-bold text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Reorder Level
                    </label>
                    <input
                      type="number"
                      value={reorderLevel}
                      onChange={(e) => setReorderLevel(e.target.value)}
                      placeholder="10"
                      className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-bold text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                    />
                  </div>
                </div>

                {/* Image Section matching mockup */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Product Image
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {imageUrl ? (
                        <img src={imageUrl} alt="preview" className="w-full h-full object-contain p-1" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <input
                        type="text"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="Paste image link or choose preset..."
                        className="w-full bg-[#F8F9FA] focus:bg-white text-[11px] font-semibold text-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImageUrl('https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&auto=format&fit=crop&q=80');
                        }}
                        className="text-[11px] font-bold text-[#FF6500] hover:underline cursor-pointer"
                      >
                        Use Default Reference Image
                      </button>
                    </div>
                  </div>
                </div>

                {/* Toggles matching Screen 6 in mockup */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <label className="flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer">
                    <span>Active Product</span>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 text-[#FF6500] rounded focus:ring-[#FF6500]"
                    />
                  </label>
                  <label className="flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer">
                    <span>Track Stock</span>
                    <input
                      type="checkbox"
                      checked={trackStock}
                      onChange={(e) => setTrackStock(e.target.checked)}
                      className="w-4 h-4 text-[#FF6500] rounded focus:ring-[#FF6500]"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action Buttons matching mockup */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-[#FF6500] hover:bg-[#e65b00] active:scale-[0.98] text-white text-xs font-black shadow-md shadow-[#FF6500]/25 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Product</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
