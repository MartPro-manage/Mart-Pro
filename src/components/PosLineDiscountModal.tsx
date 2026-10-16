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
  Scale
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
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number | ''>(10);
  const [discountReason, setDiscountReason] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const curr = store?.currencySymbol || 'Rs.';

  // Initialize modal state when cartItem is selected
  useEffect(() => {
    if (cartItem) {
      if (cartItem.customDiscountType && cartItem.customDiscountValue !== undefined) {
        setDiscountType(cartItem.customDiscountType);
        setDiscountValue(cartItem.customDiscountValue);
        setDiscountReason(cartItem.customDiscountReason || '');
      } else {
        setDiscountType('percentage');
        setDiscountValue(10);
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

  if (!isOpen || !cartItem) return null;

  const product = cartItem.product;
  const isWeight = product.sellBy === 'weight' || product.unitType === 'kg' || Boolean(product.pricePerKg);
  const catalogPrice = product.price || product.pricePerKg || 0;
  const baseEffectivePrice = getEffectiveProductPrice(product) || catalogPrice;
  const qty = cartItem.quantity || 1;
  const standardLineTotal = Math.round(qty * baseEffectivePrice * 100) / 100;

  // Calculate new unit price and savings
  const numValue = typeof discountValue === 'number' && !isNaN(discountValue) ? Math.max(0, discountValue) : 0;
  let finalUnitPrice = baseEffectivePrice;
  let discountPerUnit = 0;

  if (discountType === 'percentage') {
    const validPct = Math.min(100, Math.max(0, numValue));
    discountPerUnit = Math.round(((baseEffectivePrice * validPct) / 100) * 100) / 100;
    finalUnitPrice = Math.max(0, Math.round((baseEffectivePrice - discountPerUnit) * 100) / 100);
  } else {
    // Fixed amount off per unit
    discountPerUnit = Math.min(baseEffectivePrice, numValue);
    finalUnitPrice = Math.max(0, Math.round((baseEffectivePrice - discountPerUnit) * 100) / 100);
  }

  const finalLineTotal = Math.round(qty * finalUnitPrice * 100) / 100;
  const totalSavings = Math.max(0, Math.round((standardLineTotal - finalLineTotal) * 100) / 100);

  const handleApply = () => {
    if (numValue <= 0) {
      // Clear custom discount if value is 0
      onRemoveDiscount(product.id);
      onClose();
      return;
    }

    if (discountType === 'percentage' && numValue > 100) {
      setErrorMsg('Percentage discount cannot exceed 100%');
      return;
    }

    if (discountType === 'fixed' && numValue > baseEffectivePrice) {
      setErrorMsg(`Fixed discount cannot exceed unit price (${curr} ${baseEffectivePrice.toFixed(2)})`);
      return;
    }

    onApplyDiscount(product.id, discountType, numValue, discountReason.trim() || undefined);
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
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-rose-600 p-4 sm:p-5 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-xs text-white">
                <Percent className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                  Line Item Discount
                </h3>
                <p className="text-xs text-orange-100 font-medium mt-0.5">
                  Give discount on product during billing
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto custom-scrollbar flex-1">
            {/* Product Summary Header Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-extrabold text-slate-900 text-sm sm:text-base truncate">
                    {product.name}
                  </h4>
                  {product.shortcutCode && (
                    <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-950 text-xs font-mono font-black border border-orange-200">
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
                  <span>Qty in Bill: <strong className="text-slate-800 font-mono">{qty} {isWeight ? 'kg' : 'units'}</strong></span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-[10px] uppercase font-bold text-slate-400">Standard Total</div>
                <div className="text-base sm:text-lg font-black font-mono text-slate-800">
                  {curr} {standardLineTotal.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Discount Mode Switcher */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Discount Mode
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setDiscountType('percentage')}
                  className={`py-2 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    discountType === 'percentage'
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Percent className="w-4 h-4" />
                  <span>Percentage (% Off)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDiscountType('fixed')}
                  className={`py-2 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    discountType === 'fixed'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Coins className="w-4 h-4" />
                  <span>Rupees ({curr} Off / unit)</span>
                </button>
              </div>
            </div>

            {/* Discount Input & Quick Presets */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                {discountType === 'percentage' ? 'Discount Percentage (%)' : `Discount Amount per Unit (${curr})`}
              </label>

              <div className="relative">
                <input
                  ref={inputRef}
                  type="number"
                  step="any"
                  min="0"
                  max={discountType === 'percentage' ? 100 : baseEffectivePrice}
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
                  placeholder={discountType === 'percentage' ? 'e.g. 10 or 15' : 'e.g. 20 or 50'}
                  className="w-full pl-4 pr-14 py-3 bg-slate-50 border-2 border-slate-300 focus:border-orange-500 focus:bg-white rounded-2xl text-slate-950 font-mono font-black text-lg focus:outline-none transition-all shadow-2xs"
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
                      className={`px-2.5 py-1 rounded-xl text-xs font-black font-mono transition-all cursor-pointer border ${
                        discountValue === pct
                          ? 'bg-orange-600 text-white border-orange-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-orange-300 hover:bg-orange-50'
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
                      className={`px-2.5 py-1 rounded-xl text-xs font-black font-mono transition-all cursor-pointer border ${
                        discountValue === amt
                          ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-rose-300 hover:bg-rose-50'
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
                placeholder="e.g. Clearance, Customer Request, Damaged Seal..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 focus:border-orange-500 focus:bg-white rounded-xl text-slate-900 text-xs font-semibold focus:outline-none transition-all"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {quickReasons.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setDiscountReason(r)}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold cursor-pointer transition-colors"
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
            <div className="p-4 bg-gradient-to-br from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between text-xs text-emerald-900 font-bold">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Preview After Discount</span>
                </span>
                <span className="bg-emerald-200/80 text-emerald-950 px-2 py-0.5 rounded-full font-mono text-[11px]">
                  {numValue > 0 ? (discountType === 'percentage' ? `${numValue}% OFF` : `-${curr} ${numValue.toFixed(2)}/unit`) : 'No Discount'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-white/80 backdrop-blur-xs p-2 rounded-xl border border-emerald-200/60 shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">New Unit Rate</div>
                  <div className="text-sm sm:text-base font-black font-mono text-slate-900 mt-0.5">
                    {curr} {finalUnitPrice.toFixed(2)}
                  </div>
                </div>

                <div className="bg-white/80 backdrop-blur-xs p-2 rounded-xl border border-emerald-200/60 shadow-2xs">
                  <div className="text-[10px] text-emerald-700 font-bold uppercase">Customer Saves</div>
                  <div className="text-sm sm:text-base font-black font-mono text-emerald-700 mt-0.5">
                    {curr} {totalSavings.toFixed(2)}
                  </div>
                </div>

                <div className="bg-white/80 backdrop-blur-xs p-2 rounded-xl border border-emerald-200/60 shadow-2xs">
                  <div className="text-[10px] text-orange-600 font-bold uppercase">New Line Total</div>
                  <div className="text-sm sm:text-base font-black font-mono text-orange-600 mt-0.5">
                    {curr} {finalLineTotal.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
            <div>
              {cartItem.customDiscountValue !== undefined && cartItem.customDiscountValue > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Remove custom discount from this product"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Discount</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleApply}
                className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-orange-600/20 transition-all cursor-pointer"
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
