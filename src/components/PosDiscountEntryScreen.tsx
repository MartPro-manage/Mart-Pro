import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tag, CheckCircle2, X } from 'lucide-react';
import { CartItem, Store } from '../types';

interface PosDiscountEntryScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: () => void;
  cart: CartItem[];
  store: Store;
  onUpdateItemDiscount: (productId: string, type: 'percentage' | 'fixed', value: number, scope: 'total' | 'perUnit') => void;
}

export const PosDiscountEntryScreen: React.FC<PosDiscountEntryScreenProps> = ({
  isOpen,
  onClose,
  onCheckout,
  cart,
  store,
  onUpdateItemDiscount
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900">Apply Item Discounts</h2>
            <button onClick={onClose} className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200"><X className="w-5 h-5"/></button>
          </div>
          
          <div className="p-5 overflow-y-auto flex-1 space-y-3">
             {cart.map((item) => (
                <div key={item.product.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">{item.product.name}</span>
                      <span className="text-xs text-slate-500 font-bold">Qty: {item.quantity}</span>
                    </div>
                    <div className="flex gap-2">
                        <input 
                          type="number" 
                          placeholder="Discount" 
                          value={item.customDiscountValue || ''}
                          className="px-3 py-2 border rounded-xl w-24 font-mono font-bold"
                          onChange={(e) => onUpdateItemDiscount(item.product.id, item.customDiscountType || 'fixed', parseFloat(e.target.value) || 0, item.discountScope || 'total')}
                        />
                        <select 
                          className="px-3 py-2 border rounded-xl"
                          value={item.customDiscountType || 'fixed'}
                          onChange={(e) => onUpdateItemDiscount(item.product.id, e.target.value as 'percentage' | 'fixed', item.customDiscountValue || 0, item.discountScope || 'total')}
                        >
                            <option value="fixed">Rs.</option>
                            <option value="percentage">%</option>
                        </select>
                         <select 
                          className="px-3 py-2 border rounded-xl"
                          value={item.discountScope || 'total'}
                          onChange={(e) => onUpdateItemDiscount(item.product.id, item.customDiscountType || 'fixed', item.customDiscountValue || 0, e.target.value as 'total' | 'perUnit')}
                        >
                            <option value="total">Total</option>
                            <option value="perUnit">Per Unit</option>
                        </select>
                    </div>
                </div>
             ))}
          </div>

          <div className="p-5 border-t border-slate-200 flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-3 rounded-2xl bg-slate-100 font-bold">Back</button>
            <button onClick={onCheckout} className="px-5 py-3 rounded-2xl bg-orange-600 text-white font-black flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5"/> Checkout
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
