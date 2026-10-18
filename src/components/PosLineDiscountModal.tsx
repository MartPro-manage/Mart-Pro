import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Percent, 
  Tag, 
  X, 
  Check, 
  Trash2, 
  TrendingDown, 
  Coins, 
  Calculator, 
  Sparkles,
  Scale,
  Sliders,
  Layers
} from 'lucide-react';
import { CartItem, Store } from '../types';
import { getEffectiveProductPrice } from '../utils/discountUtils';

interface PosLineDiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItem: CartItem | null;
  store: Store;
  onApplyDiscount: (
    productId: string, 
    discountType: 'percentage' | 'fixed', 
    discountValue: number, 
    discountScope: 'total' | 'perUnit',
    discountReason?: string
  ) => void;
  onRemoveDiscount: (productId: string) => void;
}

export const PosLineDiscountModal: React.FC<PosLineDiscountModalProps> = ({
  isOpen,
  onClose,
  cartItem,
  store,
  onApplyDiscount,
  onRemoveDiscount
}) => {
  const [discountMode, setDiscountMode] = useState<'all' | 'selected'>('all');
  const [discountedUnits, setDiscountedUnits] = useState<number>(1);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [entryBasis, setEntryBasis] = useState<'total' | 'perUnit'>('total');
  const [discountValue, setDiscountValue] = useState<number | ''>(10);
  const [discountReason, setDiscountReason] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const curr = store?.currencySymbol || 'Rs.';

  // Initialize modal state when cartItem is selected
  useEffect(() => {
    if (cartItem) {
      const qty = cartItem.quantity || 1;
      if (cartItem.customDiscountType && cartItem.customDiscountValue !== undefined) {
        setDiscountType(cartItem.customDiscountType);
        setDiscountValue(cartItem.customDiscountValue);
        setDiscountMode(cartItem.discountMode || (cartItem.discountScope === 'perUnit' ? 'selected' : 'all'));
        setDiscountedUnits(cartItem.discountedUnits ? Math.min(qty, cartItem.discountedUnits) : 1);
        setDiscountReason(cartItem.customDiscountReason || '');
      } else {
        setDiscountType('percentage');
        setDiscountValue(10);
        setDiscountMode('all');
        setDiscountedUnits(1);
        setDiscountReason('');
      }
      setErrorMsg(null);

      // Auto focus input
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 100);
    }
  }, [cartItem, isOpen]);

  const isPosDiscountAllowed = store?.posProductDiscountEnabled === true;

  if (!isOpen || !cartItem || !isPosDiscountAllowed) return null;

  const product = cartItem.product;
  const isWeight = product.sellBy === 'weight' || product.unitType === 'kg' || Boolean(product.pricePerKg);
  const catalogPrice = product.price || product.pricePerKg || 0;
  const baseEffectivePrice = getEffectiveProductPrice(product) || catalogPrice;
  const qty = cartItem.quantity || 1;
  const standardLineTotal = Math.round(qty * baseEffectivePrice * 100) / 100;

  // Calculate new unit price and savings
  const numValue = typeof discountValue === 'number' && !isNaN(discountValue) ? Math.max(0, discountValue) : 0;
  const applicableUnits = discountMode === 'all' ? qty : Math.max(1, Math.min(qty, discountedUnits));
  
  let finalUnitPrice = baseEffectivePrice;
  let discountPerUnit = 0;
  let totalSavings = 0;

  if (discountType === 'percentage') {
    const validPct = Math.min(100, Math.max(0, numValue));
    discountPerUnit = Math.round(((baseEffectivePrice * validPct) / 100) * 100) / 100;
    totalSavings = Math.round(discountPerUnit * applicableUnits * 100) / 100;
    finalUnitPrice = Math.max(0, Math.round((baseEffectivePrice - discountPerUnit) * 100) / 100);
  } else {
    // Fixed amount
    if (discountMode === 'all') {
      if (entryBasis === 'total') {
        totalSavings = Math.min(standardLineTotal, numValue);
        discountPerUnit = qty > 0 ? Math.round((totalSavings / qty) * 100) / 100 : 0;
      } else {
        discountPerUnit = Math.min(baseEffectivePrice, numValue);
        totalSavings = Math.round(discountPerUnit * qty * 100) / 100;
      }
    } else {
      discountPerUnit = Math.min(baseEffectivePrice, numValue);
      totalSavings = Math.round(discountPerUnit * applicableUnits * 100) / 100;
    }
    finalUnitPrice = Math.max(0, Math.round((baseEffectivePrice - discountPerUnit) * 100) / 100);
  }

  const finalLineTotal = Math.max(0, Math.round((standardLineTotal - totalSavings) * 100) / 100);

  const handleApply = () => {
    if (numValue <= 0) {
      onRemoveDiscount(product.id);
      onClose();
      return;
    }

    if (discountType === 'percentage' && numValue > 100) {
      setErrorMsg('Percentage discount cannot exceed 100%');
      return;
    }

    if (discountType === 'fixed' && discountPerUnit > baseEffectivePrice) {
      setErrorMsg(`Fixed discount cannot exceed unit price (${curr} ${baseEffectivePrice.toFixed(2)})`);
      return;
    }

    onApplyDiscount(
      product.id, 
      discountType, 
      numValue, 
      discountMode === 'all' ? 'total' : 'perUnit',
      discountReason.trim() || undefined
    );
    onClose();
  };

  const handleClear = () => {
    onRemoveDiscount(product.id);
    onClose();
  };

  const percentagePresets = [5, 10, 15, 20, 25, 30, 50];
  const fixedPresets = [5, 10, 20, 50, 100, 200];
  const quickReasons = ['Customer Promo', 'Damaged Packaging', 'Staff Discount', 'Loyalty Offer', 'Special Clearance'];

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-700/40 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header - Navy Dark Blue */}
          <div className="bg-[#0B192C] p-4 sm:p-5 text-white flex items-center justify-between shadow-md border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/20 text-cyan-300 border border-cyan-500/30">
                <Percent className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight">
                  POS Item Discount
                </h3>
                <p className="text-xs text-slate-300 font-medium mt-0.5">
                  Configure discount for this item on billing
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto custom-scrollbar flex-1 bg-slate-50">
            {/* Product Summary Header Card */}
            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-extrabold text-slate-900 text-sm sm:text-base truncate">
                    {product.name}
                  </h4>
                  {product.shortcutCode && (
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 text-xs font-mono font-black border border-blue-200">
                      #{product.shortcutCode}
                    </span>
                  )}
                  {isWeight && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-bold flex items-center gap-1 border border-amber-200">
                      <Scale className="w-3 h-3 text-amber-700" /> By Weight
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-1">
                  <span>Regular: <strong className="text-slate-800 font-mono">{curr} {baseEffectivePrice.toFixed(2)}</strong></span>
                  <span>•</span>
                  <span>Qty: <strong className="text-slate-800 font-mono">{qty} {isWeight ? 'kg' : 'units'}</strong></span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-[10px] uppercase font-bold text-slate-400">Original Total</div>
                <div className="text-base sm:text-lg font-black font-mono text-slate-800">
                  {curr} {standardLineTotal.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Scope: All Units vs Single/Selected Units */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Discount Scope
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-200/70 p-1.5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setDiscountMode('all')}
                  className={`py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    discountMode === 'all'
                      ? 'bg-[#0B192C] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>All Units ({qty})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDiscountMode('selected')}
                  className={`py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    discountMode === 'selected'
                      ? 'bg-[#0B192C] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sliders className="w-4 h-4" />
                  <span>Selected Unit(s)</span>
                </button>
              </div>

              {discountMode === 'selected' && (
                <div className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200 text-xs">
                  <span className="font-bold text-slate-700">Units getting discount:</span>
                  <input
                    type="number"
                    min="1"
                    max={qty}
                    value={discountedUnits}
                    onChange={(e) => setDiscountedUnits(Math.max(1, Math.min(qty, parseInt(e.target.value) || 1)))}
                    className="w-16 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-center font-mono font-bold"
                  />
                  <span className="text-slate-500">of {qty} total</span>
                  {qty > 1 && (
                    <button
                      type="button"
                      onClick={() => setDiscountedUnits(1)}
                      className={`px-2 py-1 rounded text-[11px] font-bold border ${
                        discountedUnits === 1 ? 'bg-blue-50 text-blue-900 border-blue-300' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      1 Unit Only
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Discount Type Switcher */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Discount Mode
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-200/70 p-1.5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setDiscountType('percentage')}
                  className={`py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    discountType === 'percentage'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Percent className="w-4 h-4" />
                  <span>Percentage (% Off)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDiscountType('fixed')}
                  className={`py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    discountType === 'fixed'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Coins className="w-4 h-4" />
                  <span>Rupees ({curr} Off)</span>
                </button>
              </div>
            </div>

            {/* Discount Input & Quick Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {discountType === 'percentage' ? 'Discount Percentage (%)' : (discountMode === 'all' && entryBasis === 'total' ? `Total Discount on ${qty} Units (${curr})` : `Discount per Unit (${curr})`)}
                </label>

                {discountMode === 'all' && discountType === 'fixed' && (
                  <button
                    type="button"
                    onClick={() => setEntryBasis(entryBasis === 'total' ? 'perUnit' : 'total')}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    {entryBasis === 'total' ? 'Switch to: Per Unit' : 'Switch to: Total Bill'}
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  ref={inputRef}
                  type="number"
                  step="any"
                  min="0"
                  max={discountType === 'percentage' ? 100 : (discountMode === 'all' && entryBasis === 'total' ? standardLineTotal : baseEffectivePrice)}
                  value={discountValue}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                    setDiscountValue(val);
                    setErrorMsg(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApply();
                    }
                  }}
                  placeholder={discountType === 'percentage' ? 'e.g. 10 or 15' : 'e.g. 50 or 250'}
                  className="w-full pl-4 pr-14 py-3 bg-white border-2 border-slate-300 focus:border-blue-700 focus:bg-white rounded-2xl text-slate-950 font-mono font-black text-lg focus:outline-none transition-all shadow-2xs"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black font-mono text-slate-400">
                  {discountType === 'percentage' ? '%' : curr}
                </span>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mr-1">Presets:</span>
                {discountType === 'percentage' ? (
                  percentagePresets.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        setDiscountValue(pct);
                        setErrorMsg(null);
                      }}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer border ${
                        discountValue === pct
                          ? 'bg-[#0B192C] text-white border-[#0B192C] shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))
                ) : (
                  fixedPresets.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setDiscountValue(amt);
                        setErrorMsg(null);
                      }}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer border ${
                        discountValue === amt
                          ? 'bg-[#0B192C] text-white border-[#0B192C] shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      {curr} {amt}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Optional Reason / Note */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Discount Note / Reason (Optional)
              </label>
              <input
                type="text"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="e.g. Clearance, Customer Request, Damaged Packaging..."
                className="w-full px-3.5 py-2 bg-white border border-slate-300 focus:border-blue-700 rounded-xl text-slate-900 text-xs font-semibold focus:outline-none transition-all"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {quickReasons.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setDiscountReason(r)}
                    className="px-2 py-0.5 rounded-lg bg-slate-200/80 hover:bg-slate-300 text-slate-700 text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-bold">
                {errorMsg}
              </div>
            )}

            {/* Live Calculation Preview Card */}
            <div className="p-4 bg-white border border-slate-300 rounded-2xl space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-900 font-bold">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Preview After Discount</span>
                </span>
                <span className="bg-blue-100 text-blue-950 px-2 py-0.5 rounded-full font-mono text-[11px] font-bold">
                  {numValue > 0 ? (discountType === 'percentage' ? `${numValue}% OFF` : `-${curr} ${discountPerUnit.toFixed(2)}/unit`) : 'No Discount'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Discount / Unit</div>
                  <div className="text-sm sm:text-base font-black font-mono text-slate-900 mt-0.5">
                    {curr} {discountPerUnit.toFixed(2)}
                  </div>
                </div>

                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-emerald-700 font-bold uppercase">Customer Saves</div>
                  <div className="text-sm sm:text-base font-black font-mono text-emerald-700 mt-0.5">
                    {curr} {totalSavings.toFixed(2)}
                  </div>
                </div>

                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-blue-800 font-bold uppercase">New Total</div>
                  <div className="text-sm sm:text-base font-black font-mono text-blue-900 mt-0.5">
                    {curr} {finalLineTotal.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer - Navy Dark Blue */}
          <div className="p-4 sm:p-5 border-t border-slate-800 bg-[#0B192C] flex items-center justify-between gap-3 text-white">
            <div>
              {cartItem.customDiscountValue !== undefined && cartItem.customDiscountValue > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-300 hover:bg-rose-950/60 flex items-center gap-1.5 transition-colors cursor-pointer border border-rose-800/40"
                  title="Remove custom discount from this product"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleApply}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Apply to Item</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
