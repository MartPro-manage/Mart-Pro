import { Product } from '../types';

/**
 * Generates the next available unique 4-digit shortcut code for a product.
 * Range: 1001 to 9999.
 */
export function generateNextShortcutCode(existingProducts: Array<{ shortcutCode?: string }>): string {
  const usedCodes = new Set<number>();
  
  for (const p of existingProducts) {
    if (p.shortcutCode) {
      const num = parseInt(p.shortcutCode, 10);
      if (!isNaN(num) && num >= 1000 && num <= 9999) {
        usedCodes.add(num);
      }
    }
  }

  // Find lowest available 4-digit code starting from 1001
  for (let candidate = 1001; candidate <= 9999; candidate++) {
    if (!usedCodes.has(candidate)) {
      return candidate.toString();
    }
  }

  // Fallback if all 1001-9999 are taken (rare in standard stores)
  const random4Digit = Math.floor(1000 + Math.random() * 9000).toString();
  return random4Digit;
}

/**
 * Ensures all products have a valid 4-digit shortcut code.
 */
export function ensureProductShortcutCodes(products: Product[]): Product[] {
  const usedCodes = new Set<string>();
  
  // First pass: collect existing valid 4-digit codes
  products.forEach(p => {
    if (p.shortcutCode && /^\d{4}$/.test(p.shortcutCode)) {
      usedCodes.add(p.shortcutCode);
    }
  });

  let currentCounter = 1001;
  const getNextAvailable = (): string => {
    while (currentCounter <= 9999) {
      const codeStr = currentCounter.toString();
      currentCounter++;
      if (!usedCodes.has(codeStr)) {
        usedCodes.add(codeStr);
        return codeStr;
      }
    }
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  return products.map(p => {
    if (p.shortcutCode && /^\d{4}$/.test(p.shortcutCode)) {
      return p;
    }
    return {
      ...p,
      shortcutCode: getNextAvailable()
    };
  });
}

/**
 * Matches a user entry to a product by 4-digit shortcut code, barcode, or serial number.
 */
export function findProductByShortcutOrBarcode(
  term: string, 
  products: Product[]
): Product | undefined {
  const cleanTerm = term.trim();
  if (!cleanTerm) return undefined;
  const cleanTermLower = cleanTerm.toLowerCase();

  // 1. High priority: Exact match by 4-digit shortcut code
  const byShortcut = products.find(p => p.shortcutCode === cleanTerm);
  if (byShortcut) return byShortcut;

  // 2. Exact match by barcode
  const byBarcode = products.find(p => p.barcode && p.barcode.toLowerCase() === cleanTermLower);
  if (byBarcode) return byBarcode;

  // 3. Exact match by serial number
  const bySerial = products.find(p => p.serialNumber && p.serialNumber.toLowerCase() === cleanTermLower);
  if (bySerial) return bySerial;

  return undefined;
}
