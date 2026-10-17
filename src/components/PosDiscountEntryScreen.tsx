import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Percent, 
  Tag, 
  X, 
  Check, 
  Trash2, 
  Coins, 
  Sparkles,
  Scale,
  ShieldAlert,
  ArrowRight,
  Sliders,
  CheckCircle2,
  Lock,
  Unlock,
  Layers,
  FileText
} from 'lucide-react';
import { CartItem, Store } from '../types';
import { getEffectiveProductPrice } from '../utils/discountUtils';

export interface PosDiscountConfig {
  productId: string;
  enabled: boolean;
  mode: 'all' | 'selected'; // Mode A: all units, Mode B: single / selected units
  discountedUnits: number; // 1 to total quantity
  discountType: 'percentage' | 'fixed';
  entryBasis: 'total' | 'perUnit'; // For Mode A fixed discount: entered as total discount or per unit
  discountValue: number; // Entered number
  discountReason?: string;
  managerPin?: string;
}

interface PosDiscountEntryScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedToPayment: (updatedCart: CartItem[]) => void;
  cart: CartItem[];
  store: Store;
}

export const PosDiscountEntryScreen: React.FC<PosDiscountEntryScreenProps> = ({
  isOpen,
  onClose,
  onProceedToPayment,
  cart,
  store
}) => {
  // Discount feature is DISABLED by default for every checkout review
  const [isDiscountEnabled, setIsDiscountEnabled] = useState<boolean>(false);
  const [discountConfigs, setDiscountConfigs] = useState<Record<string, PosDiscountConfig>>({});
  const [managerApprovalPin, setManagerApprovalPin] = useState<string>('');
  const [isManagerPinVerified, setIsManagerPinVerified] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const curr = store?.currencySymbol || 'Rs.';

  // When opening, reset the master discount toggle to FALSE (disabled by default)
  // and initialize item configurations based on cart items
  useEffect(() => {
    if (isOpen) {
      // Feature MUST BE DISABLED by default for every new sale
      setIsDiscountEnabled(false);
      setValidationError(null);
      setIsManagerPinVerified(false);
      setManagerApprovalPin('');

      const initialConfigs: Record<string, PosDiscountConfig> = {};
      cart.forEach((item) => {
        const qty = item.quantity || 1;
        const hasExisting = Boolean(item.customDiscountValue && item.customDiscountValue > 0);
        
        initialConfigs[item.product.id] = {
          productId: item.product.id,
          enabled: hasExisting,
          mode: item.discountMode || (item.discountScope === 'perUnit' ? 'selected' : 'all'),
          discountedUnits: item.discountedUnits && item.discountedUnits > 0 ? Math.min(qty, item.discountedUnits) : 1,
          discountType: item.customDiscountType || 'percentage',
          entryBasis: item.discountScope === 'perUnit' ? 'perUnit' : 'total',
          discountValue: item.customDiscountValue || 0,
          discountReason: item.customDiscountReason || ''
        };
      });

      setDiscountConfigs(initialConfigs);
    }
  }, [isOpen, cart]);

  const isPosDiscountAllowed = Boolean(
    store?.posProductDiscountEnabled === true && store?.allowPosItemDiscount !== false
  );

  if (!isOpen || !isPosDiscountAllowed) return null;

  // Calculate live item values
  const calculatedItems = cart.map((item) => {
    const p = item.product;
    const isWeight = p.sellBy === 'weight' || p.unitType === 'kg' || Boolean(p.pricePerKg);
    const catalogPrice = p.price || p.pricePerKg || 0;
    const baseUnitPrice = getEffectiveProductPrice(p) || catalogPrice;
    const qty = item.quantity || 1;
    const originalSubtotal = Math.round(qty * baseUnitPrice * 100) / 100;

    const cfg = discountConfigs[p.id] || {
      productId: p.id,
      enabled: false,
      mode: 'all',
      discountedUnits: 1,
      discountType: 'percentage',
      entryBasis: 'total',
      discountValue: 0
    };

    // If master discount feature is disabled or item discount is not enabled, discounts are 0
    if (!isDiscountEnabled || !cfg.enabled || cfg.discountValue <= 0) {
      return {
        item,
        cfg,
        isWeight,
        baseUnitPrice,
        qty,
        originalSubtotal,
        discountPerUnit: 0,
        discountedUnitsCount: 0,
        totalItemDiscount: 0,
        discountedUnitPrice: baseUnitPrice,
        finalSubtotal: originalSubtotal,
        hasError: false,
        errorMsg: ''
      };
    }

    const val = Math.max(0, Number(cfg.discountValue) || 0);
    let discountPerUnit = 0;
    let totalItemDiscount = 0;
    let discountedUnitsCount = cfg.mode === 'all' ? qty : Math.max(1, Math.min(qty, Number(cfg.discountedUnits) || 1));
    let hasError = false;
    let errorMsg = '';

    if (cfg.discountType === 'percentage') {
      const pct = Math.min(100, Math.max(0, val));
      if (store?.posMaxDiscountPercentage && pct > store.posMaxDiscountPercentage) {
        if (!isManagerPinVerified && store.posRequireManagerApproval) {
          hasError = true;
          errorMsg = `Exceeds max permitted ${store.posMaxDiscountPercentage}% discount (Manager PIN required).`;
        }
      }
      discountPerUnit = Math.round(((baseUnitPrice * pct) / 100) * 100) / 100;
      totalItemDiscount = Math.round(discountPerUnit * discountedUnitsCount * 100) / 100;
    } else {
      // Fixed Amount
      if (cfg.mode === 'all') {
        if (cfg.entryBasis === 'total') {
          // Entered total discount on entire quantity
          const maxAllowed = originalSubtotal;
          const enteredTotal = Math.min(maxAllowed, val);
          totalItemDiscount = Math.round(enteredTotal * 100) / 100;
          discountPerUnit = qty > 0 ? Math.round((totalItemDiscount / qty) * 100) / 100 : 0;
        } else {
          // Entered per-unit fixed discount
          const maxPerUnit = baseUnitPrice;
          discountPerUnit = Math.min(maxPerUnit, val);
          totalItemDiscount = Math.round(discountPerUnit * qty * 100) / 100;
        }
      } else {
        // Mode B: Selected Units (e.g. 1 unit or custom count)
        const maxPerUnit = baseUnitPrice;
        discountPerUnit = Math.min(maxPerUnit, val);
        totalItemDiscount = Math.round(discountPerUnit * discountedUnitsCount * 100) / 100;
      }

      if (store?.posMaxFixedDiscountAmount && totalItemDiscount > store.posMaxFixedDiscountAmount) {
        if (!isManagerPinVerified && store.posRequireManagerApproval) {
          hasError = true;
          errorMsg = `Exceeds max allowed fixed discount of ${curr} ${store.posMaxFixedDiscountAmount} (Manager PIN required).`;
        }
      }
    }

    // Safety checks: discount cannot exceed original applicable units price
    const maxApplicablePrice = Math.round(discountedUnitsCount * baseUnitPrice * 100) / 100;
    if (totalItemDiscount > maxApplicablePrice) {
      totalItemDiscount = maxApplicablePrice;
      discountPerUnit = discountedUnitsCount > 0 ? totalItemDiscount / discountedUnitsCount : 0;
    }

    const discountedUnitPrice = Math.max(0, Math.round((baseUnitPrice - discountPerUnit) * 100) / 100);
    const finalSubtotal = Math.max(0, Math.round((originalSubtotal - totalItemDiscount) * 100) / 100);

    return {
      item,
      cfg,
      isWeight,
      baseUnitPrice,
      qty,
      originalSubtotal,
      discountPerUnit,
      discountedUnitsCount,
      totalItemDiscount,
      discountedUnitPrice,
      finalSubtotal,
      hasError,
      errorMsg
    };
  });

  // Gross Totals
  const totalGrossSubtotal = calculatedItems.reduce((acc, i) => acc + i.originalSubtotal, 0);
  const totalDiscountAmount = isDiscountEnabled ? calculatedItems.reduce((acc, i) => acc + i.totalItemDiscount, 0) : 0;
  const grandPayableTotal = Math.max(0, Math.round((totalGrossSubtotal - totalDiscountAmount) * 100) / 100);

  const hasAnyErrors = calculatedItems.some((i) => i.hasError);

  // Helper to update individual item config
  const updateItemConfig = (productId: string, updates: Partial<PosDiscountConfig>) => {
    setDiscountConfigs((prev) => {
      const current = prev[productId] || {
        productId,
        enabled: true,
        mode: 'all',
        discountedUnits: 1,
        discountType: 'percentage',
        entryBasis: 'total',
        discountValue: 0
      };
      return {
        ...prev,
        [productId]: {
          ...current,
          ...updates,
          enabled: true // auto-enable item row when modified
        }
      };
    });
    setValidationError(null);
  };

  const handleToggleMasterDiscount = () => {
    setIsDiscountEnabled((prev) => !prev);
    setValidationError(null);
  };

  const handleVerifyManagerPin = () => {
    const requiredPin = store?.posManagerApprovalPin || '1234';
    if (managerApprovalPin.trim() === requiredPin.trim()) {
      setIsManagerPinVerified(true);
      setValidationError(null);
    } else {
      setValidationError('Incorrect Manager Approval PIN code.');
    }
  };

  const handleConfirmAndProceed = () => {
    if (hasAnyErrors && !isManagerPinVerified) {
      setValidationError('Some discounts exceed store limits. Please enter manager PIN or adjust discount.');
      return;
    }

    // Build finalized cart with proper discount calculations
    const updatedCart: CartItem[] = calculatedItems.map(({ item, cfg, baseUnitPrice, originalSubtotal, discountPerUnit, discountedUnitsCount, totalItemDiscount, finalSubtotal }) => {
      if (!isDiscountEnabled || !cfg.enabled || totalItemDiscount <= 0) {
        // Preserves original product price without any discount
        return {
          ...item,
          totalPrice: originalSubtotal,
          customDiscountType: undefined,
          customDiscountValue: undefined,
          customDiscountAmount: 0,
          customUnitPrice: baseUnitPrice,
          discountMode: undefined,
          discountedUnits: undefined,
          discountPerUnit: 0,
          originalUnitPrice: baseUnitPrice,
          originalSubtotal,
          finalSubtotal: originalSubtotal,
          discountReason: undefined
        };
      }

      return {
        ...item,
        totalPrice: finalSubtotal,
        customDiscountType: cfg.discountType,
        customDiscountValue: cfg.discountValue,
        customDiscountAmount: totalItemDiscount,
        customUnitPrice: cfg.mode === 'all' ? (baseUnitPrice - discountPerUnit) : undefined,
        discountMode: cfg.mode,
        discountedUnits: discountedUnitsCount,
        discountPerUnit: discountPerUnit,
        originalUnitPrice: baseUnitPrice,
        originalSubtotal,
        finalSubtotal,
        discountReason: cfg.discountReason?.trim() || undefined
      };
    });

    onProceedToPayment(updatedCart);
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-hidden"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-700/40 overflow-hidden flex flex-col max-h-[94vh]"
        >
          {/* 1. HEADER - NAVY DARK BLUE THEME */}
          <div className="bg-[#0B192C] text-white p-4 sm:p-5 border-b border-slate-700/80 flex items-center justify-between shrink-0 shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-500/20 text-cyan-400 border border-cyan-500/30">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-xl font-black tracking-tight text-white">
                    POS Bill Review & Item Discounts
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-blue-900/80 text-cyan-300 border border-blue-600/40 text-[11px] font-mono font-bold uppercase">
                    Step 1 of 2
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium mt-0.5">
                  Verify product items, review totals, or apply special discounts before payment.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Close and return to cart"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 2. BODY CONTENT - PRODUCT LIST & DISCOUNT CONTROLS */}
          <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4 bg-slate-50">
            {/* MASTER DISCOUNT TOGGLE BANNER */}
            <div className={`p-4 rounded-2xl border transition-all ${
              isDiscountEnabled 
                ? 'bg-blue-950/10 border-blue-300 text-slate-900 shadow-xs' 
                : 'bg-white border-slate-200 text-slate-700 shadow-2xs'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl mt-0.5 transition-colors ${
                    isDiscountEnabled ? 'bg-[#0B192C] text-cyan-300' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {isDiscountEnabled ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm sm:text-base text-slate-900">
                        Enable Discount on Billing
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono ${
                        isDiscountEnabled 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                          : 'bg-slate-200 text-slate-600'
                      }`}>
                        {isDiscountEnabled ? 'Active' : 'Disabled (Default)'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {isDiscountEnabled 
                        ? 'Discounts are enabled for this bill. You can apply discounts on all units or single units below.' 
                        : 'Discounts are disabled by default for new sales. Activate the toggle if you need to apply discounts.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={handleToggleMasterDiscount}
                    className={`px-4 py-2 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
                      isDiscountEnabled
                        ? 'bg-[#0B192C] text-white hover:bg-slate-900 border border-blue-800'
                        : 'bg-white border-2 border-slate-300 hover:border-slate-400 text-slate-700'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full transition-colors ${isDiscountEnabled ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-slate-400'}`} />
                    <span>{isDiscountEnabled ? 'Disable Discount' : 'Enable Discount'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* PRODUCT ITEMS LIST */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                <span>Products in Cart ({cart.length})</span>
                <span>Subtotal & Pricing</span>
              </div>

              {calculatedItems.map((calc, idx) => {
                const { item, cfg, isWeight, baseUnitPrice, qty, originalSubtotal, discountPerUnit, discountedUnitsCount, totalItemDiscount, discountedUnitPrice, finalSubtotal, hasError, errorMsg } = calc;
                const p = item.product;

                return (
                  <div
                    key={p.id || idx}
                    className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                      isDiscountEnabled && cfg.enabled && totalItemDiscount > 0
                        ? 'border-blue-300 shadow-sm ring-1 ring-blue-100'
                        : 'border-slate-200 shadow-2xs'
                    }`}
                  >
                    {/* Item Main Row */}
                    <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-900 text-sm sm:text-base">
                            {p.name}
                          </span>
                          {p.shortcutCode && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-mono font-bold border border-slate-200">
                              #{p.shortcutCode}
                            </span>
                          )}
                          {isWeight && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-bold flex items-center gap-1 border border-amber-200">
                              <Scale className="w-3 h-3 text-amber-700" /> By Weight
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-1 flex-wrap">
                          <span>
                            Unit Price: <strong className="text-slate-800 font-mono">{curr} {baseUnitPrice.toFixed(2)}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Quantity: <strong className="text-slate-800 font-mono">{qty} {isWeight ? 'kg' : 'units'}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Original Subtotal: <strong className="text-slate-800 font-mono">{curr} {originalSubtotal.toFixed(2)}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Right Subtotal Badge */}
                      <div className="text-right shrink-0 flex items-center md:flex-col md:items-end justify-between md:justify-center border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400">Final Subtotal</div>
                          <div className="text-base sm:text-lg font-black font-mono text-[#0B192C]">
                            {curr} {finalSubtotal.toFixed(2)}
                          </div>
                        </div>
                        {totalItemDiscount > 0 && isDiscountEnabled && (
                          <span className="text-[11px] font-bold font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 mt-0.5">
                            Saved {curr} {totalItemDiscount.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Discount Control Drawer (Only active when Master Discount is Enabled) */}
                    {isDiscountEnabled ? (
                      <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-3 bg-slate-50/80 border-t border-slate-100 space-y-3">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                          
                          {/* Column A: Discount Mode (All Units vs Selected Units) */}
                          <div className="lg:col-span-4 space-y-1.5">
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                              Discount Scope
                            </label>
                            <div className="grid grid-cols-2 gap-1.5 bg-slate-200/70 p-1 rounded-xl">
                              <button
                                type="button"
                                onClick={() => updateItemConfig(p.id, { mode: 'all' })}
                                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                  cfg.mode === 'all'
                                    ? 'bg-[#0B192C] text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                <Layers className="w-3.5 h-3.5" />
                                <span>All Units ({qty})</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => updateItemConfig(p.id, { mode: 'selected' })}
                                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                  cfg.mode === 'selected'
                                    ? 'bg-[#0B192C] text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                <Sliders className="w-3.5 h-3.5" />
                                <span>Selected Unit(s)</span>
                              </button>
                            </div>

                            {/* Mode B: Unit Selector if Selected Units chosen */}
                            {cfg.mode === 'selected' && (
                              <div className="pt-1 flex items-center gap-2">
                                <span className="text-[11px] font-bold text-slate-600">Discounted Qty:</span>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="1"
                                    max={qty}
                                    value={cfg.discountedUnits}
                                    onChange={(e) => {
                                      const val = Math.max(1, Math.min(qty, parseInt(e.target.value) || 1));
                                      updateItemConfig(p.id, { discountedUnits: val });
                                    }}
                                    className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500 text-center"
                                  />
                                  <span className="text-xs text-slate-500 font-medium">of {qty}</span>
                                </div>

                                {qty > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => updateItemConfig(p.id, { discountedUnits: 1 })}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                                      cfg.discountedUnits === 1 ? 'bg-blue-100 text-blue-900 border-blue-300' : 'bg-white text-slate-600 border-slate-200'
                                    }`}
                                  >
                                    1 Unit Only
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Column B: Discount Type & Input */}
                          <div className="lg:col-span-5 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                                Discount Amount / Rate
                              </label>

                              {/* Toggle Type: Fixed or Percentage */}
                              <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg text-[11px]">
                                <button
                                  type="button"
                                  onClick={() => updateItemConfig(p.id, { discountType: 'percentage' })}
                                  className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                                    cfg.discountType === 'percentage'
                                      ? 'bg-white text-slate-900 shadow-2xs'
                                      : 'text-slate-600'
                                  }`}
                                >
                                  % Percentage
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateItemConfig(p.id, { discountType: 'fixed' })}
                                  className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                                    cfg.discountType === 'fixed'
                                      ? 'bg-white text-slate-900 shadow-2xs'
                                      : 'text-slate-600'
                                  }`}
                                >
                                  {curr} Fixed
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  max={cfg.discountType === 'percentage' ? 100 : (cfg.mode === 'all' && cfg.entryBasis === 'total' ? originalSubtotal : baseUnitPrice)}
                                  value={cfg.discountValue || ''}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                    updateItemConfig(p.id, { discountValue: val });
                                  }}
                                  placeholder={cfg.discountType === 'percentage' ? 'e.g. 10 (%)' : 'e.g. 50 (Rs.)'}
                                  className="w-full pl-3 pr-10 py-1.5 bg-white border border-slate-300 focus:border-blue-600 rounded-xl text-slate-900 font-mono font-bold text-sm focus:outline-none shadow-2xs"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                                  {cfg.discountType === 'percentage' ? '%' : curr}
                                </span>
                              </div>

                              {/* For Mode A Fixed: toggle whether entering total discount or per-unit discount */}
                              {cfg.mode === 'all' && cfg.discountType === 'fixed' && (
                                <button
                                  type="button"
                                  onClick={() => updateItemConfig(p.id, { 
                                    entryBasis: cfg.entryBasis === 'total' ? 'perUnit' : 'total' 
                                  })}
                                  className="px-2 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-xl text-[10px] font-bold text-slate-700 whitespace-nowrap cursor-pointer transition-colors"
                                  title="Switch between total discount across all units vs discount per unit"
                                >
                                  {cfg.entryBasis === 'total' ? 'Entered: Total Bill' : 'Entered: Per Unit'}
                                </button>
                              )}

                              {cfg.discountValue > 0 && (
                                <button
                                  type="button"
                                  onClick={() => updateItemConfig(p.id, { discountValue: 0, enabled: false })}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer transition-colors"
                                  title="Clear discount for this product"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Column C: Live Math Breakdown */}
                          <div className="lg:col-span-3 bg-white p-2.5 rounded-xl border border-slate-200 text-xs space-y-1">
                            <div className="flex justify-between text-slate-500 font-medium">
                              <span>Per Unit Discount:</span>
                              <strong className="text-slate-800 font-mono">{curr} {discountPerUnit.toFixed(2)}</strong>
                            </div>
                            <div className="flex justify-between text-slate-500 font-medium">
                              <span>Eligible Units:</span>
                              <strong className="text-slate-800 font-mono">{discountedUnitsCount} {isWeight ? 'kg' : 'pcs'}</strong>
                            </div>
                            <div className="flex justify-between text-slate-500 font-medium">
                              <span>Total Saved:</span>
                              <strong className="text-emerald-600 font-mono font-bold">-{curr} {totalItemDiscount.toFixed(2)}</strong>
                            </div>
                          </div>

                        </div>

                        {hasError && (
                          <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 shrink-0" />
                            <span>{errorMsg}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="px-4 py-2 bg-slate-100/60 border-t border-slate-100 text-xs text-slate-400 font-medium flex items-center justify-between">
                        <span>Original product price active.</span>
                        <span className="text-[11px] font-mono font-bold text-slate-500">{curr} {originalSubtotal.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* MANAGER APPROVAL PIN OVERRIDE SECTION */}
            {hasAnyErrors && !isManagerPinVerified && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-black text-xs sm:text-sm">
                  <ShieldAlert className="w-4 h-4 text-amber-700" />
                  <span>Manager Approval Required for High Discount</span>
                </div>
                <p className="text-xs text-amber-800 font-medium">
                  One or more applied discounts exceed store policy thresholds. Enter the store manager PIN to approve.
                </p>
                <div className="flex items-center gap-2 max-w-xs">
                  <input
                    type="password"
                    placeholder="Enter PIN"
                    value={managerApprovalPin}
                    onChange={(e) => setManagerApprovalPin(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-amber-600"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyManagerPin}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors"
                  >
                    Verify PIN
                  </button>
                </div>
              </div>
            )}

            {validationError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold">
                {validationError}
              </div>
            )}
          </div>

          {/* 3. FOOTER - NAVY DARK BLUE THEME */}
          <div className="bg-[#0B192C] text-white p-4 sm:p-5 border-t border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 shadow-lg">
            {/* Left: Summary Metrics */}
            <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto justify-between sm:justify-start">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Gross Total</div>
                <div className="text-sm sm:text-base font-black font-mono text-slate-200">
                  {curr} {totalGrossSubtotal.toFixed(2)}
                </div>
              </div>

              {totalDiscountAmount > 0 && isDiscountEnabled && (
                <div>
                  <div className="text-[10px] text-cyan-400 uppercase font-bold tracking-wider">Total Discount</div>
                  <div className="text-sm sm:text-base font-black font-mono text-cyan-300">
                    -{curr} {totalDiscountAmount.toFixed(2)}
                  </div>
                </div>
              )}

              <div className="pl-3 sm:pl-4 border-l border-slate-700">
                <div className="text-[10px] text-amber-400 uppercase font-bold tracking-wider">Grand Payable</div>
                <div className="text-xl sm:text-2xl font-black font-mono text-white">
                  {curr} {grandPayableTotal.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                Back to Cart
              </button>

              <button
                type="button"
                onClick={handleConfirmAndProceed}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
              >
                <span>Proceed to Payment</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
