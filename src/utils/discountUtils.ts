import { Product } from '../types';

export interface ProductDiscountInfo {
  hasDiscount: boolean;
  basePrice: number;
  effectivePrice: number;
  discountedPrice: number;
  discountAmount: number;
  discountLabel: string;
  discountType: 'percentage' | 'fixed' | null;
  discountValue: number;
}

/**
 * Calculates discount details for a given product.
 */
export function getProductDiscountInfo(product: Product): ProductDiscountInfo {
  const basePrice = product.price || 0;
  
  if (!product.discountActive || !product.discountValue || product.discountValue <= 0) {
    return {
      hasDiscount: false,
      basePrice,
      effectivePrice: basePrice,
      discountedPrice: basePrice,
      discountAmount: 0,
      discountLabel: '',
      discountType: null,
      discountValue: 0
    };
  }

  let discountAmount = 0;
  let label = '';

  if (product.discountType === 'percentage') {
    discountAmount = Math.min(basePrice, (basePrice * product.discountValue) / 100);
    label = `${product.discountValue}% OFF`;
  } else {
    discountAmount = Math.min(basePrice, product.discountValue);
    label = `Rs. ${product.discountValue} OFF`;
  }

  const effectivePrice = Math.max(0, basePrice - discountAmount);

  return {
    hasDiscount: true,
    basePrice,
    effectivePrice,
    discountedPrice: effectivePrice,
    discountAmount,
    discountLabel: label,
    discountType: product.discountType || 'percentage',
    discountValue: product.discountValue
  };
}

/**
 * Calculates effective selling price for a product.
 */
export function getEffectiveProductPrice(product: Product): number {
  return getProductDiscountInfo(product).effectivePrice;
}
