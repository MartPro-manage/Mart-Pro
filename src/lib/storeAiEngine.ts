import { Product, Sale } from '../types';

export interface AiQueryResult {
  reply: string;
  speechText: string;
  matchedProducts: Product[];
  highlightedProduct: Product | null;
  intent: 'top_selling' | 'cheapest' | 'price_check' | 'stock_check' | 'category_list' | 'store_stat' | 'general';
  categoryTag?: string;
}

/**
 * Normalizes text for matching
 */
function clean(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Token overlap score between query and product name/category
 */
function calculateMatchScore(queryClean: string, p: Product): number {
  const pName = clean(p.name);
  const pCat = clean(p.category || '');
  const pBarcode = (p.barcode || '').trim();
  const pShortcut = (p.shortcutCode || '').trim();

  if (pShortcut && (queryClean.includes(pShortcut.toLowerCase()) || queryClean.includes('#' + pShortcut.toLowerCase()))) return 100;
  if (pBarcode && queryClean.includes(pBarcode.toLowerCase())) return 100;
  if (pName && queryClean.includes(pName)) return 90;

  let score = 0;
  const qTokens = queryClean.split(' ').filter(t => t.length > 1 && !['price', 'of', 'if', 'what', 'is', 'the', 'how', 'much', 'for', 'in', 'show', 'me', 'top', 'selling', 'cheapest', 'best', 'seller'].includes(t));

  if (qTokens.length === 0) return 0;

  qTokens.forEach(token => {
    if (pName.includes(token)) score += 15;
    if (pCat.includes(token)) score += 10;
  });

  return score;
}

/**
 * Extracts category or item target from query
 * e.g. "top selling oil" -> "oil"
 * "cheapest ghee" -> "ghee"
 */
function extractCategoryKeyword(query: string): string | null {
  const q = clean(query);
  const knownKeywords = [
    'oil',
    'ghee',
    'biscuit',
    'biscuits',
    'tea',
    'grain',
    'grains',
    'rice',
    'flour',
    'atta',
    'toy',
    'toys',
    'detergent',
    'soap',
    'soaps',
    'laundry',
    'milk',
    'dairy',
    'beverage',
    'beverages',
    'juice',
    'drink',
    'snack',
    'snacks',
    'spice',
    'spices',
    'vegetable',
    'fruit'
  ];

  for (const kw of knownKeywords) {
    // word boundary check
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(q)) {
      if (kw === 'biscuits') return 'biscuit';
      if (kw === 'grains') return 'grain';
      if (kw === 'toys') return 'toy';
      if (kw === 'soaps') return 'soap';
      return kw;
    }
  }

  return null;
}

/**
 * Primary AI Query Engine for Store, Price Checker & Software Help Guide
 */
export function processStoreAiQuery(
  rawQuery: string,
  products: Product[],
  sales: Sale[] = []
): AiQueryResult {
  const q = clean(rawQuery);
  const targetCategory = extractCategoryKeyword(rawQuery);

  // 0. SOFTWARE FUNCTIONALITY & HOW-TO GUIDES
  // Keyboard shortcuts guide
  if (q.includes('shortcut') || q.includes('short cut') || q.includes('key combination') || q.includes('hotkey') || q.includes('keys')) {
    const reply = `⌨️ **Mart Pro POS Keyboard Shortcuts Guide:**\n\n` +
      `• \`H + D\` (or rapid HD) — **Hold Current Bill** (Parks active cart in memory)\n` +
      `• \`A + S\` (or rapid AS) — **Retrieve Held Bills** (Resumes parked customer cart)\n` +
      `• \`S + K\` (or rapid SK) — **4-Digit Product Shortcuts Directory**\n` +
      `• \`R + N\` (or rapid RN) — **Return & Refund Voucher** (Restocks inventory)\n` +
      `• \`Shift + P\` — **Quick Payment & Bill Settlement**\n` +
      `• \`P\` or \`Ctrl + P\` — **Instant Thermal Receipt Print**\n` +
      `• \`Escape (ESC)\` — **Close Modal / Back to Dashboard**\n\n` +
      `💡 *Tip: Every product also has a unique 4-digit code (e.g. #1001) that cashiers can type into the barcode box for ultra-fast checkout!*`;

    return {
      reply,
      speechText: `Mart Pro has fast keyboard shortcuts like H D to hold bills, A S to retrieve held bills, S K for product shortcuts, and R N for returns.`,
      matchedProducts: [],
      highlightedProduct: null,
      intent: 'general'
    };
  }

  // Hold / Park bill guide
  if (q.includes('hold bill') || q.includes('park bill') || q.includes('held bill') || q.includes('resume bill') || q.includes('park cart')) {
    const reply = `🛒 **How to Park & Resume Bills at Cash Counter:**\n\n` +
      `1. **Park Current Bill:** While items are in the cart, press \`H + D\` on keyboard or click the **"Hold Bill"** button.\n` +
      `2. **Ring Up Next Customer:** The cart clears immediately so you can serve the next person without waiting.\n` +
      `3. **Retrieve Parked Sale:** Press \`A + S\` or click **"Held Bills"** button at the top bar. Click on the customer's parked cart to restore all items with original quantities and prices!`;

    return {
      reply,
      speechText: `To hold a bill, press H D or click Hold Bill. To retrieve it later, press A S or click Held Bills.`,
      matchedProducts: [],
      highlightedProduct: null,
      intent: 'general'
    };
  }

  // Returns & Refunds guide
  if (q.includes('return') || q.includes('refund') || q.includes('wapsi') || q.includes('exchange')) {
    const reply = `🔄 **How to Process Product Returns & Refunds:**\n\n` +
      `1. At the Cash Counter, press \`R + N\` or click the **"Product Return"** button.\n` +
      `2. Look up the customer's receipt number or select the returned item from the list.\n` +
      `3. Enter the returned quantity and reason for return.\n` +
      `4. Click **"Process Refund & Print Voucher"**.\n` +
      `5. **Automatic Synchronization:** Stock is immediately added back into inventory, and refund is recorded in the store audit ledger!`;

    return {
      reply,
      speechText: `To process a return, press R N or click Product Return at the cash counter, specify the items, and print a verified refund voucher.`,
      matchedProducts: [],
      highlightedProduct: null,
      intent: 'general'
    };
  }

  // Discounts guide
  if (q.includes('discount') || q.includes('promotion') || q.includes('offer') || q.includes('sale price')) {
    const reply = `🏷️ **How to Set Discounts & Promotions:**\n\n` +
      `1. Go to **Store Admin Dashboard** -> Click **"Discounts & Promotions"**.\n` +
      `2. Choose target: **Storewide (All Products)** or **Selected Products**.\n` +
      `3. Choose discount format: **Percentage (% OFF)** or **Fixed Cash Amount (Rs. OFF)**.\n` +
      `4. Set validity dates (e.g. 3 days, 1 week, end of month).\n` +
      `5. Click **"Apply Discount"**.\n\n` +
      `🧾 **Receipt Output:** The receipt will clearly show regular price, discounted price, Gross Subtotal, Discount amount (or Rs. 0.00 if none), Total Discount, and Grand Total!`;

    return {
      reply,
      speechText: `You can set percentage or flat cash discounts from the Discounts Manager in Store Admin. Receipts will automatically display original price, discount amount, and total savings.`,
      matchedProducts: [],
      highlightedProduct: null,
      intent: 'general'
    };
  }

  // Sell by weight guide
  if (q.includes('weight') || q.includes('per kg') || q.includes('liquid') || q.includes('per liter') || q.includes('scale') || q.includes('wazan')) {
    const reply = `⚖️ **How to Sell Products by Weight (Kg / Liters):**\n\n` +
      `1. **Registration:** When adding a product, set **Sell By** to *"Weight (per kg/liter)"* and unit to *kg* or *liter*.\n` +
      `2. **At Cash Counter:** When cashiers scan or click the item, the **Weight Prompt Dialog** automatically pops up.\n` +
      `3. **Input Weight:** Type the exact weight (e.g. \`1.45\` kg) or connect a digital weighing scale.\n` +
      `4. The system calculates exact price: \`Weight × Price per Kg\` and prints it accurately on the receipt!`;

    return {
      reply,
      speechText: `For weight items, register them with Sell by Weight. Scanning them at checkout pops up the weight prompt to enter kilograms.`,
      matchedProducts: [],
      highlightedProduct: null,
      intent: 'general'
    };
  }

  // Thermal printing guide
  if (q.includes('receipt') || q.includes('thermal print') || q.includes('printer') || q.includes('print slip')) {
    const reply = `🖨️ **Receipt Printing & Thermal Slip Configuration:**\n\n` +
      `• **Standard Thermal Print:** Press \`P\` or \`Ctrl + P\` or click **"Print Receipt"** on the checkout modal.\n` +
      `• **Paper Sizes:** Supports both **80mm** (standard wide POS) and **58mm** (compact mobile) thermal printers.\n` +
      `• **Receipt Formats:** In Store Settings, choose between *Standard*, *Classic Detailed*, or *Compact Eco*.\n` +
      `• **Digital Pass & E-Receipt:** Every printed receipt includes a live QR code so customers can view and save their e-receipt on mobile devices (valid online for 7 days; store accounting records are permanent).`;

    return {
      reply,
      speechText: `Press P to print thermal receipts. The software supports 80 millimeter and 58 millimeter thermal printers and QR code e receipts.`,
      matchedProducts: [],
      highlightedProduct: null,
      intent: 'general'
    };
  }

  // Excel / CSV bulk import guide
  if (q.includes('excel') || q.includes('csv') || q.includes('import') || q.includes('bulk upload') || q.includes('spreadsheet')) {
    const reply = `📊 **How to Bulk Import Products via Excel / CSV:**\n\n` +
      `1. Go to **Store Admin** -> **"Product Register"** -> click **"Excel / CSV Import"**.\n` +
      `2. Upload your spreadsheet (supports \`.xlsx\`, \`.xls\`, \`.csv\`).\n` +
      `3. The AI engine auto-detects column names (Name, Barcode, Retail Price, Cost Price, Stock, Category, Unit).\n` +
      `4. Review the preview table, edit any values, and click **"Import All Products"**.\n` +
      `5. You can also upload spreadsheets directly into this AI Copilot chat!`;

    return {
      reply,
      speechText: `To import products, go to Product Register and click Excel Import, or attach your spreadsheet directly into this AI chat.`,
      matchedProducts: [],
      highlightedProduct: null,
      intent: 'general'
    };
  }

  // 1. TOP SELLING QUERY (e.g. "Top selling oil", "most selling ghee", "best seller biscuit")
  if (
    q.includes('top selling') || 
    q.includes('most selling') || 
    q.includes('best seller') || 
    q.includes('highest selling') ||
    q.includes('popular')
  ) {
    // Filter candidate products
    let candidates = products;
    if (targetCategory) {
      candidates = products.filter(p => {
        const pName = clean(p.name);
        const pCat = clean(p.category || '');
        return pName.includes(targetCategory) || pCat.includes(targetCategory);
      });
    }

    if (candidates.length === 0 && targetCategory) {
      return {
        reply: `🔍 We currently do not have any items registered under "${targetCategory}" in our catalog.`,
        speechText: `We do not have any items registered under ${targetCategory} right now.`,
        matchedProducts: [],
        highlightedProduct: null,
        intent: 'top_selling',
        categoryTag: targetCategory
      };
    }

    // Compute sales volume per candidate
    const salesMap = new Map<string, { product: Product; unitsSold: number; totalRevenue: number }>();
    candidates.forEach(p => {
      salesMap.set(p.id, { product: p, unitsSold: 0, totalRevenue: 0 });
    });

    sales.forEach(s => {
      (s.items || []).forEach(item => {
        const found = salesMap.get(item.productId);
        if (found) {
          found.unitsSold += item.quantity || 1;
          found.totalRevenue += item.total || (item.price * (item.quantity || 1));
        }
      });
    });

    // Sort by units sold descending
    const ranked = Array.from(salesMap.values()).sort((a, b) => b.unitsSold - a.unitsSold);

    if (ranked.length > 0 && ranked[0].unitsSold > 0) {
      const top = ranked[0];
      const topProd = top.product;
      const unitLabel = topProd.sellBy === 'weight' ? (topProd.unitType || 'kg') : 'units';
      
      const reply = `🔥 **Top Selling ${targetCategory ? targetCategory.toUpperCase() : 'Product'}:**\n• **Item:** ${topProd.name}\n• **Retail Price:** Rs. ${topProd.price.toFixed(2)}${topProd.sellBy === 'weight' ? ` per ${topProd.unitType || 'kg'}` : ''}\n• **Sales Record:** ${top.unitsSold.toLocaleString()} ${unitLabel} sold\n• **Stock Status:** ${topProd.stockQuantity > 0 ? `In Stock (${topProd.stockQuantity} remaining)` : 'Out of Stock'}`;
      const speech = `Our top selling ${targetCategory || 'item'} is ${topProd.name}, priced at ${Math.round(topProd.price)} rupees. Over ${top.unitsSold} ${unitLabel} have been sold!`;

      return {
        reply,
        speechText: speech,
        matchedProducts: ranked.slice(0, 3).map(r => r.product),
        highlightedProduct: topProd,
        intent: 'top_selling',
        categoryTag: targetCategory || topProd.category
      };
    }

    // If no sales recorded yet, provide the first/most stocked product in that category
    const featured = candidates[0];
    if (featured) {
      const reply = `🌟 **Featured ${targetCategory ? targetCategory.toUpperCase() : 'Item'}:**\n• **Item:** ${featured.name}\n• **Retail Price:** Rs. ${featured.price.toFixed(2)}\n• **Stock:** ${featured.stockQuantity} available\n*(No transactions recorded yet in sales history, showing top catalog item)*`;
      const speech = `Our featured ${targetCategory || 'item'} is ${featured.name}, priced at ${Math.round(featured.price)} rupees.`;

      return {
        reply,
        speechText: speech,
        matchedProducts: candidates.slice(0, 3),
        highlightedProduct: featured,
        intent: 'top_selling',
        categoryTag: targetCategory || featured.category
      };
    }
  }

  // 2. CHEAPEST QUERY (e.g. "cheapest oil", "cheapest ghee", "cheapest biscuit", "cheapest soap")
  if (
    q.includes('cheap') || 
    q.includes('lowest price') || 
    q.includes('least price') || 
    q.includes('budget') ||
    q.includes('minimum price') ||
    q.includes('sasta') ||
    q.includes('sasti')
  ) {
    let candidates = products;
    if (targetCategory) {
      candidates = products.filter(p => {
        const pName = clean(p.name);
        const pCat = clean(p.category || '');
        return pName.includes(targetCategory) || pCat.includes(targetCategory);
      });
    }

    if (candidates.length === 0) {
      return {
        reply: `🔍 We couldn't find any items matching "${targetCategory || rawQuery}". Please check with store staff or register this category.`,
        speechText: `We could not find any ${targetCategory || 'items'} matching that description in store catalog.`,
        matchedProducts: [],
        highlightedProduct: null,
        intent: 'cheapest',
        categoryTag: targetCategory || undefined
      };
    }

    // Sort ascending by price
    const sorted = [...candidates].sort((a, b) => (a.price || 0) - (b.price || 0));
    const cheapest = sorted[0];

    const altOptions = sorted.slice(1, 4);
    let altText = '';
    if (altOptions.length > 0) {
      altText = `\n\n**Other budget options:**\n` + altOptions.map(p => `• ${p.name} — Rs. ${p.price.toFixed(2)}`).join('\n');
    }

    const reply = `💰 **Cheapest ${targetCategory ? targetCategory.toUpperCase() : 'Item'}:**\n• **Product:** ${cheapest.name}\n• **Retail Price:** Rs. ${cheapest.price.toFixed(2)}${cheapest.sellBy === 'weight' ? ` per ${cheapest.unitType || 'kg'}` : ''}\n• **Category:** ${cheapest.category || 'General'}\n• **Stock Status:** ${cheapest.stockQuantity > 0 ? `In Stock (${cheapest.stockQuantity} units)` : 'Out of Stock'}${altText}`;
    const speech = `The cheapest ${targetCategory || 'item'} is ${cheapest.name} at only ${Math.round(cheapest.price)} rupees. It is currently in stock.`;

    return {
      reply,
      speechText: speech,
      matchedProducts: sorted.slice(0, 4),
      highlightedProduct: cheapest,
      intent: 'cheapest',
      categoryTag: targetCategory || cheapest.category
    };
  }

  // 3. SPECIFIC PRODUCT PRICE QUERY (e.g. "Price of zeera biscuit", "Price if zeera biscuit", "Rate of Dalda")
  const isPriceQuery = 
    q.includes('price') || 
    q.includes('rate') || 
    q.includes('cost') || 
    q.includes('how much') ||
    q.includes('kitna') ||
    q.includes('kitne ka');

  if (isPriceQuery || targetCategory) {
    // Score all products against the query
    const scored = products.map(p => ({
      product: p,
      score: calculateMatchScore(q, p)
    })).filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      const match = scored[0].product;
      const otherMatches = scored.slice(1, 4).map(s => s.product);

      const reply = `🏷️ **Price Check for "${match.name}":**\n• **Retail Price:** Rs. ${match.price.toFixed(2)}${match.sellBy === 'weight' ? ` per ${match.unitType || 'kg'}` : ''}\n• **Barcode:** \`${match.barcode || 'N/A'}\`\n• **Category:** ${match.category || 'General'}\n• **Stock Availability:** ${match.stockQuantity > 0 ? `✅ In Stock (${match.stockQuantity} available)` : '❌ Currently Out of Stock'}`;
      const speech = `${match.name} is priced at ${Math.round(match.price)} rupees ${match.sellBy === 'weight' ? `per ${match.unitType || 'kilogram'}` : ''}. ${match.stockQuantity > 0 ? 'It is in stock.' : 'It is currently out of stock.'}`;

      return {
        reply,
        speechText: speech,
        matchedProducts: [match, ...otherMatches],
        highlightedProduct: match,
        intent: 'price_check',
        categoryTag: match.category
      };
    }
  }

  // 4. STOCK CHECK QUERY (e.g. "do you have milk?", "is rice in stock?")
  if (q.includes('stock') || q.includes('available') || q.includes('have') || q.includes('hai kya')) {
    const scored = products.map(p => ({
      product: p,
      score: calculateMatchScore(q, p)
    })).filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      const match = scored[0].product;
      const inStock = match.stockQuantity > 0;
      const reply = `📦 **Stock Verification: "${match.name}"**\n• **Status:** ${inStock ? `✅ In Stock (${match.stockQuantity} remaining)` : '❌ Out of Stock'}\n• **Price:** Rs. ${match.price.toFixed(2)}\n• **Barcode:** \`${match.barcode || 'N/A'}\``;
      const speech = inStock 
        ? `Yes! We have ${match.name} in stock with ${match.stockQuantity} units available at ${Math.round(match.price)} rupees.`
        : `Sorry, ${match.name} is currently out of stock.`;

      return {
        reply,
        speechText: speech,
        matchedProducts: [match],
        highlightedProduct: match,
        intent: 'stock_check'
      };
    }
  }

  // 5. GENERAL QUERY OR FALLBACK
  // Try to search if any product name matches partially
  const fallbackMatches = products.filter(p => {
    const pName = clean(p.name);
    return q.split(' ').some(t => t.length > 2 && pName.includes(t));
  });

  if (fallbackMatches.length > 0) {
    const top = fallbackMatches[0];
    return {
      reply: `🔍 Here is what I found for "${rawQuery}":\n• **Product:** ${top.name}\n• **Price:** Rs. ${top.price.toFixed(2)}\n• **Stock:** ${top.stockQuantity} in stock`,
      speechText: `I found ${top.name} priced at ${Math.round(top.price)} rupees.`,
      matchedProducts: fallbackMatches.slice(0, 3),
      highlightedProduct: top,
      intent: 'general'
    };
  }

  return {
    reply: `🤖 I understand you are asking: "${rawQuery}".\n\nTry asking questions like:\n• 🧴 *"Cheapest oil"* or *"Cheapest ghee"*\n• 🔥 *"Top selling oil"* or *"Top selling biscuit"*\n• 🍪 *"Price of zeera biscuit"*\n• ☕ *"Cheapest tea"*\n• 🧺 *"Cheapest detergent"* or *"Cheapest soap"*`,
    speechText: `You can ask me for the cheapest oil, cheapest ghee, top selling items, or the price of any product like zeera biscuit.`,
    matchedProducts: [],
    highlightedProduct: null,
    intent: 'general'
  };
}
