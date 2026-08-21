import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../types';
import { Scale, Plus, Sparkles, X, Calculator, Package } from 'lucide-react';

interface WeightPromptModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (product: Product, quantityInKg: number, totalPrice: number) => void;
}

export const WeightPromptModal: React.FC<WeightPromptModalProps> = ({
  product,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [inputMode, setInputMode] = useState<'direct_weight' | 'pack_multiplier'>('direct_weight');
  const [weightKg, setWeightKg] = useState<string>('1');
  const [packQuantity, setPackQuantity] = useState<string>('1');
  const [packWeightKg, setPackWeightKg] = useState<string>('0.5');
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Initialize defaults whenever product changes or modal opens
  useEffect(() => {
    if (product && isOpen) {
      if (product.weightPerUnit && product.weightPerUnit > 0) {
        setInputMode('pack_multiplier');
        setPackWeightKg(product.weightPerUnit.toString());
        setPackQuantity('1');
        setWeightKg((product.weightPerUnit * 1).toString());
      } else {
        setInputMode('direct_weight');
        setWeightKg('1');
      }
      setError(null);

      // Auto-focus input for rapid cashier workflow
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 80);
    }
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  const perKgRate = product.price || product.pricePerKg || 0;

  // Calculate final effective weight in KG
  let effectiveWeightKg = 0;
  if (inputMode === 'direct_weight') {
    effectiveWeightKg = parseFloat(weightKg) || 0;
  } else {
    const qty = parseFloat(packQuantity) || 0;
    const unitWt = parseFloat(packWeightKg) || 0;
    effectiveWeightKg = qty * unitWt;
  }

  const calculatedTotalPrice = effectiveWeightKg * perKgRate;
  const isOutOfStock = product.stockQuantity <= 0;
  const exceedsStock = effectiveWeightKg > product.stockQuantity;

  const handleApplyWeight = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (effectiveWeightKg <= 0) {
      setError('Please enter a valid weight or quantity greater than 0.');
      return;
    }

    if (exceedsStock) {
      setError(`Cannot add ${effectiveWeightKg.toFixed(3)} kg. Only ${product.stockQuantity} kg available in store stock!`);
      return;
    }

    onConfirm(product, effectiveWeightKg, calculatedTotalPrice);
    onClose();
  };

  const handleQuickAddWeight = (amountKg: number) => {
    const current = parseFloat(weightKg) || 0;
    const nextVal = Math.max(0.01, +(current + amountKg).toFixed(3));
    setWeightKg(nextVal.toString());
    setInputMode('direct_weight');
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-amber-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-widest text-amber-200">
                Weight-Based Item Entry
              </div>
              <h3 className="text-lg font-black tracking-tight line-clamp-1">
                {product.name}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleApplyWeight} className="p-6 space-y-5">
          {/* Product Meta Banner */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 font-medium">Rate per KG:</span>{' '}
              <strong className="text-slate-900 font-extrabold text-sm font-mono">
                Rs. {perKgRate.toFixed(2)} / kg
              </strong>
            </div>
            <div className="text-right">
              <span className="text-slate-500 font-medium">Store Stock:</span>{' '}
              <strong className={`font-extrabold font-mono ${product.stockQuantity <= 5 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {product.stockQuantity % 1 === 0 ? product.stockQuantity : product.stockQuantity.toFixed(3)} kg
              </strong>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setInputMode('direct_weight');
                if (effectiveWeightKg > 0) setWeightKg(effectiveWeightKg.toFixed(3));
              }}
              className={`py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                inputMode === 'direct_weight'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-orange-600" />
              <span>Direct Scale Weight (kg)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setInputMode('pack_multiplier');
              }}
              className={`py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                inputMode === 'pack_multiplier'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-blue-600" />
              <span>Quantity × Pack Weight</span>
            </button>
          </div>

          {/* INPUT FIELDS ACCORDING TO MODE */}
          {inputMode === 'direct_weight' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Enter Measured Weight (KG / Decimal) *
                </label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="number"
                    step="0.001"
                    min="0.001"
                    max={product.stockQuantity || 9999}
                    required
                    placeholder="e.g. 0.750, 1.250, 2.500"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="w-full pl-4 pr-16 py-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-2xl font-black text-slate-900 text-center focus:outline-none focus:border-orange-500 focus:bg-white transition-all font-mono"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">
                    KG
                  </span>
                </div>
              </div>

              {/* Quick Weight Presets */}
              <div className="flex flex-wrap gap-1.5 justify-center pt-1">
                {[
                  { label: '100g', val: 0.1 },
                  { label: '250g', val: 0.25 },
                  { label: '500g', val: 0.5 },
                  { label: '750g', val: 0.75 },
                  { label: '1 kg', val: 1.0 },
                  { label: '2 kg', val: 2.0 },
                  { label: '5 kg', val: 5.0 },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setWeightKg(item.val.toString());
                      if (inputRef.current) inputRef.current.focus();
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-orange-100 text-slate-700 hover:text-orange-800 font-bold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Quantity (Packs / Units) *
                  </label>
                  <input
                    ref={inputRef}
                    type="number"
                    step="1"
                    min="1"
                    required
                    placeholder="e.g. 3"
                    value={packQuantity}
                    onChange={(e) => setPackQuantity(e.target.value)}
                    className="w-full px-3 py-3 bg-slate-50 border border-slate-300 rounded-xl text-lg font-black text-slate-900 text-center focus:outline-none focus:border-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Weight per Pack (KG) *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    placeholder="e.g. 0.5"
                    value={packWeightKg}
                    onChange={(e) => setPackWeightKg(e.target.value)}
                    className="w-full px-3 py-3 bg-slate-50 border border-slate-300 rounded-xl text-lg font-black text-slate-900 text-center focus:outline-none focus:border-orange-500 font-mono"
                  />
                </div>
              </div>

              {/* Auto Multiply Display */}
              <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-center justify-between font-semibold">
                <span>Total Weight:</span>
                <span className="font-extrabold font-mono text-sm">
                  {packQuantity || '0'} × {packWeightKg || '0'} kg = {effectiveWeightKg.toFixed(3)} kg
                </span>
              </div>
            </div>
          )}

          {/* Realtime Calculated Price Box */}
          <div className="p-4 bg-orange-50 rounded-2xl border border-orange-200 text-center space-y-1">
            <div className="text-xs font-bold text-orange-900 uppercase tracking-wider">
              Calculated Total Price
            </div>
            <div className="text-3xl font-black text-orange-600 font-mono">
              Rs. {calculatedTotalPrice.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-600 font-medium">
              {effectiveWeightKg.toFixed(3)} kg @ Rs. {perKgRate.toFixed(2)}/kg
            </div>
          </div>

          {/* Validation Feedback */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold">
              {error}
            </div>
          )}

          {exceedsStock && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold">
              ⚠️ Warning: Requested weight ({effectiveWeightKg.toFixed(3)} kg) exceeds current available stock ({product.stockQuantity} kg).
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
            >
              Cancel (Esc)
            </button>

            <button
              type="submit"
              disabled={isOutOfStock || effectiveWeightKg <= 0 || exceedsStock}
              className="flex-2 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-extrabold rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-orange-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Weight to Bill (Enter)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
