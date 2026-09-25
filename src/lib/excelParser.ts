import * as XLSX from 'xlsx';
import { Product } from '../types';

export interface BatchProductRow {
  id: string;
  barcode: string;
  serialNumber?: string;
  shortcutCode?: string;
  name: string;
  category: string;
  sellBy: 'unit' | 'weight';
  unitType: 'piece' | 'kg' | 'g' | 'liter' | 'dozen';
  quantity: number;
  costPrice: number;
  price: number; // Retail selling price (per piece or per kg/liter)
  status?: 'valid' | 'warning' | 'error';
  errorMessage?: string;
}

/**
 * Generates a clean EAN-13 compatible 12-digit random barcode
 */
export function generateRandomBarcode(): string {
  const prefix = '890';
  let middle = '';
  for (let i = 0; i < 9; i++) {
    middle += Math.floor(Math.random() * 10).toString();
  }
  return prefix + middle;
}

/**
 * Parse Excel (.xlsx, .xls) or CSV file into batch product rows
 */
export async function parseExcelProductFile(file: File): Promise<BatchProductRow[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('No sheets found in the uploaded spreadsheet.');
  }

  // Read first sheet as JSON array of objects
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('The spreadsheet is empty. Please ensure it contains product data.');
  }

  const products: BatchProductRow[] = [];

  rawRows.forEach((row, index) => {
    // Normalise column keys (lowercase without spaces or punctuation)
    const normalized: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      normalized[cleanKey] = value;
    }

    // Attempt to identify product name
    const name = String(
      normalized['productname'] ||
      normalized['product'] ||
      normalized['itemname'] ||
      normalized['item'] ||
      normalized['name'] ||
      normalized['description'] ||
      normalized['title'] ||
      ''
    ).trim();

    // Skip empty dummy rows
    if (!name) return;

    // Identify barcode or serial number - only set if explicitly provided
    const barcode = String(
      normalized['barcode'] ||
      normalized['code'] ||
      normalized['sku'] ||
      normalized['upc'] ||
      normalized['ean'] ||
      normalized['srno'] ||
      normalized['serialno'] ||
      normalized['serialnumber'] ||
      ''
    ).trim();

    // Identify unit type (kg, liter, piece, weight)
    const unitStr = String(
      normalized['unit'] ||
      normalized['unittype'] ||
      normalized['type'] ||
      normalized['uom'] ||
      ''
    ).toLowerCase().trim();

    let sellBy: 'unit' | 'weight' = 'unit';
    let unitType: 'piece' | 'kg' | 'g' | 'liter' | 'dozen' = 'piece';

    if (unitStr.includes('kg') || unitStr.includes('kilo') || unitStr.includes('weight')) {
      sellBy = 'weight';
      unitType = 'kg';
    } else if (unitStr.includes('l') || unitStr.includes('liter') || unitStr.includes('litre') || unitStr.includes('ml')) {
      sellBy = 'weight';
      unitType = 'liter';
    } else if (unitStr.includes('g') || unitStr.includes('gram')) {
      sellBy = 'weight';
      unitType = 'g';
    } else if (unitStr.includes('doz') || unitStr.includes('dozen')) {
      sellBy = 'unit';
      unitType = 'dozen';
    }

    // Identify Quantity
    const qtyVal = parseFloat(
      normalized['quantity'] ||
      normalized['qty'] ||
      normalized['stock'] ||
      normalized['stockquantity'] ||
      normalized['units'] ||
      '1'
    );
    const quantity = isNaN(qtyVal) ? 1 : Math.max(0, qtyVal);

    // Identify Selling Price (price per piece or per kg/liter)
    const priceVal = parseFloat(
      normalized['price'] ||
      normalized['sellingprice'] ||
      normalized['retailprice'] ||
      normalized['rate'] ||
      normalized['mrp'] ||
      normalized['unitprice'] ||
      normalized['sale'] ||
      '0'
    );
    const price = isNaN(priceVal) ? 0 : Math.max(0, priceVal);

    // Identify Cost Price
    const costVal = parseFloat(
      normalized['cost'] ||
      normalized['costprice'] ||
      normalized['wholesaleprice'] ||
      normalized['purchaseprice'] ||
      normalized['buyprice'] ||
      '0'
    );
    const costPrice = isNaN(costVal) ? 0 : Math.max(0, costVal);

    // Identify Category
    const category = String(
      normalized['category'] ||
      normalized['cat'] ||
      normalized['department'] ||
      normalized['group'] ||
      'General'
    ).trim();

    // Identify Shortcut Code (if column provided)
    const rawShortcut = String(
      normalized['shortcutcode'] ||
      normalized['shortcut'] ||
      normalized['shortkey'] ||
      normalized['quickcode'] ||
      normalized['itemcode'] ||
      ''
    ).replace(/\D/g, '').slice(0, 4);
    const shortcutCode = rawShortcut.length === 4 ? rawShortcut : undefined;

    products.push({
      id: `row-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
      barcode,
      shortcutCode,
      name,
      category: category || 'General',
      sellBy,
      unitType,
      quantity,
      costPrice,
      price,
      status: price > 0 ? 'valid' : 'warning',
      errorMessage: price === 0 ? 'Selling price is 0' : undefined
    });
  });

  return products;
}
