import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where,
  increment 
} from 'firebase/firestore';

// Initialize server-side Firebase Firestore instance
let db: any = null;
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf8');
    const firebaseConfig = JSON.parse(raw);
    const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const dbId = firebaseConfig?.firestoreDatabaseId;
    db = dbId ? getFirestore(firebaseApp, dbId) : getFirestore(firebaseApp);
  }
} catch (e) {
  console.warn('[Server Firebase Init Warning]:', e);
}

// Helper to resolve store by either onlineStoreId slug, doc ID, or store name
async function resolveStore(identifier: string) {
  if (!db || !identifier) return null;
  const clean = identifier.trim().toLowerCase();

  // 1. Try finding by onlineStoreId
  try {
    const q1 = query(collection(db, 'stores'), where('onlineStoreId', '==', clean));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      return { id: snap1.docs[0].id, ...snap1.docs[0].data() } as any;
    }
  } catch (e) {
    // ignore
  }

  // 2. Try finding by direct doc ID
  try {
    const dRef = doc(db, 'stores', identifier.trim());
    const dSnap = await getDoc(dRef);
    if (dSnap.exists()) {
      return { id: dSnap.id, ...dSnap.data() } as any;
    }
  } catch (e) {
    // ignore
  }

  // 3. Try finding by store name (case-insensitive search)
  try {
    const allStoresSnap = await getDocs(collection(db, 'stores'));
    for (const d of allStoresSnap.docs) {
      const data = d.data();
      if ((data.name || '').toLowerCase() === clean) {
        return { id: d.id, ...data } as any;
      }
    }
  } catch (e) {
    // ignore
  }

  return null;
}

// Compute discounted price for a product
function computeEffectivePrice(product: any) {
  const price = Number(product.price) || 0;
  if (!product.discountActive || !product.discountValue || product.discountValue <= 0) {
    return {
      effectivePrice: price,
      discountAmount: 0,
      hasDiscount: false,
      discountLabel: ''
    };
  }

  const todayStr = new Date().toISOString().split('T')[0];
  if (product.discountStartDate && todayStr < product.discountStartDate) {
    return { effectivePrice: price, discountAmount: 0, hasDiscount: false, discountLabel: '' };
  }
  if (product.discountEndDate && todayStr > product.discountEndDate) {
    return { effectivePrice: price, discountAmount: 0, hasDiscount: false, discountLabel: '' };
  }

  let disc = 0;
  let label = '';
  if (product.discountType === 'percentage') {
    disc = (price * Number(product.discountValue)) / 100;
    label = `${product.discountValue}% OFF`;
  } else {
    disc = Number(product.discountValue);
    label = `Rs. ${product.discountValue} OFF`;
  }

  const finalPrice = Math.max(0, price - disc);
  return {
    effectivePrice: finalPrice,
    discountAmount: disc,
    hasDiscount: true,
    discountLabel: label
  };
}

export function createApiApp() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // CORS middleware for external website and mobile app API access
  app.use((req: Request, res: Response, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check endpoint for Cloud Run, Vercel, and monitoring
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'mart-pro-pos',
      timestamp: new Date().toISOString()
    });
  });

  // =========================================================================
  // ONLINE STORE REST API (H A Mart & Online Shopping Apps)
  // =========================================================================

  // 1. GET /api/v1/store/:storeId/online-catalog
  // Returns store details, category list, active products, live stock and offers
  app.get('/api/v1/store/:storeId/online-catalog', async (req: Request, res: Response) => {
    try {
      const storeIdParam = req.params.storeId;
      const store = await resolveStore(storeIdParam);

      if (!store) {
        return res.status(404).json({ 
          error: 'Store not found', 
          message: `No active store matching "${storeIdParam}" was found.` 
        });
      }

      if (store.onlineStoreEnabled === false) {
        return res.status(403).json({
          error: 'Online Store Disabled',
          message: `Online shopping is currently disabled for ${store.name}. Please contact the store administrator.`
        });
      }

      // Query products for this store
      const prodQuery = query(collection(db, 'products'), where('storeId', '==', store.id));
      const prodSnap = await getDocs(prodQuery);

      const products: any[] = [];
      const categoriesSet = new Set<string>();

      prodSnap.forEach(d => {
        const p = { id: d.id, ...d.data() } as any;
        if (p.category) categoriesSet.add(p.category);

        const discountInfo = computeEffectivePrice(p);
        const inStock = (p.stockQuantity || 0) > 0;

        products.push({
          id: p.id,
          name: p.name,
          category: p.category || 'General',
          barcode: p.barcode,
          shortcutCode: p.shortcutCode,
          originalPrice: p.price,
          price: discountInfo.effectivePrice,
          regularPrice: p.price,
          effectivePrice: discountInfo.effectivePrice,
          hasDiscount: discountInfo.hasDiscount,
          discountAmount: discountInfo.discountAmount,
          discountLabel: discountInfo.discountLabel,
          discountType: p.discountType || null,
          discountValue: p.discountValue || 0,
          stockQuantity: p.stockQuantity || 0,
          inStock,
          unitType: p.unitType || 'piece',
          sellBy: p.sellBy || 'unit',
          weight: p.weight,
          imageUrl: p.imageUrl || null
        });
      });

      return res.json({
        success: true,
        store: {
          id: store.id,
          name: store.name,
          onlineStoreId: store.onlineStoreId || store.id,
          phone: store.onlineStorePhone || store.phone || '',
          address: store.onlineStoreAddress || store.address || '',
          deliveryFee: store.onlineStoreDeliveryFee ?? 150,
          minOrderAmount: store.onlineStoreMinOrder ?? 500,
          notice: store.onlineStoreNotice || 'Fast delivery right to your doorstep!',
          estimatedDeliveryTime: store.onlineStoreEstimatedTime || '30-45 mins',
          currencySymbol: store.currencySymbol || 'Rs.',
          status: store.status || 'active'
        },
        totalProducts: products.length,
        categories: Array.from(categoriesSet),
        products
      });
    } catch (err: any) {
      console.error('[API Catalog Error]:', err);
      return res.status(500).json({ error: 'Failed to retrieve catalog', details: err?.message });
    }
  });

  // 2. POST /api/v1/store/:storeId/online-order
  // Receives online customer shopping order and pushes it directly into Mart Pro
  app.post('/api/v1/store/:storeId/online-order', async (req: Request, res: Response) => {
    try {
      const storeIdParam = req.params.storeId;
      const store = await resolveStore(storeIdParam);

      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }

      if (store.onlineStoreEnabled === false) {
        return res.status(403).json({ error: 'Online store is not enabled for this mart' });
      }

      const { 
        customerName, 
        customerPhone, 
        customerAddress, 
        customerNotes, 
        paymentMethod = 'cod', 
        items 
      } = req.body;

      if (!customerName || typeof customerName !== 'string' || !customerName.trim()) {
        return res.status(400).json({ error: 'Customer name is required' });
      }
      if (!customerPhone || typeof customerPhone !== 'string' || !customerPhone.trim()) {
        return res.status(400).json({ error: 'Customer phone number is required' });
      }
      if (!customerAddress || typeof customerAddress !== 'string' || !customerAddress.trim()) {
        return res.status(400).json({ error: 'Delivery address is required' });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Cart must contain at least one item' });
      }

      // Query store products to verify pricing and stock
      const prodQuery = query(collection(db, 'products'), where('storeId', '==', store.id));
      const prodSnap = await getDocs(prodQuery);
      const productMap = new Map<string, any>();
      prodSnap.forEach(d => productMap.set(d.id, { id: d.id, ...d.data() }));

      let subtotal = 0;
      let totalDiscount = 0;
      let totalCost = 0;
      const orderItems: any[] = [];

      for (const item of items) {
        const prod = productMap.get(item.productId) || Array.from(productMap.values()).find(p => p.barcode === item.barcode);
        if (!prod) {
          return res.status(400).json({ error: `Product "${item.name || item.productId}" not found in catalog` });
        }

        const requestedQty = Number(item.quantity) || 1;
        const disc = computeEffectivePrice(prod);
        const itemSellingPrice = disc.effectivePrice;
        const itemOriginalPrice = prod.price || itemSellingPrice;
        const itemLineTotal = Math.round(itemSellingPrice * requestedQty * 100) / 100;
        const itemCost = Number(prod.costPrice) || (itemSellingPrice * 0.8);

        subtotal += itemLineTotal;
        totalDiscount += Math.round((itemOriginalPrice - itemSellingPrice) * requestedQty * 100) / 100;
        totalCost += Math.round(itemCost * requestedQty * 100) / 100;

        orderItems.push({
          productId: prod.id,
          barcode: prod.barcode || '',
          shortcutCode: prod.shortcutCode || '',
          name: prod.name,
          price: itemSellingPrice,
          originalPrice: itemOriginalPrice,
          costPrice: itemCost,
          quantity: requestedQty,
          sellBy: prod.sellBy || 'unit',
          unitType: prod.unitType || 'piece',
          total: itemLineTotal,
          imageUrl: prod.imageUrl || ''
        });

        // Decrement stock in database
        try {
          const prodRef = doc(db, 'products', prod.id);
          await updateDoc(prodRef, {
            stockQuantity: increment(-requestedQty)
          });
        } catch (stockErr) {
          console.warn('Could not decrement stock for prod:', prod.id, stockErr);
        }
      }

      const minOrder = Number(store.onlineStoreMinOrder) || 0;
      if (minOrder > 0 && subtotal < minOrder) {
        return res.status(400).json({ 
          error: `Minimum order amount is Rs. ${minOrder}. Current order is Rs. ${subtotal}.` 
        });
      }

      const deliveryFee = Number(store.onlineStoreDeliveryFee ?? 150);
      const totalAmount = subtotal + deliveryFee;
      const netProfit = Math.round((subtotal - totalCost) * 100) / 100;

      // Generate random order number e.g. ORD-8102
      const randomOrderSuffix = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `ORD-${randomOrderSuffix}`;
      const orderId = `order_${Date.now()}_${randomOrderSuffix}`;

      const newOrder = {
        id: orderId,
        orderNumber,
        storeId: store.id,
        onlineStoreId: store.onlineStoreId || store.id,
        storeName: store.name,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        customerNotes: customerNotes ? customerNotes.trim() : '',
        items: orderItems,
        subtotal,
        discountAmount: totalDiscount,
        deliveryFee,
        totalAmount,
        totalCost,
        netProfit,
        paymentMethod: ['cod', 'online_transfer', 'easypaisa', 'jazzcash'].includes(paymentMethod) ? paymentMethod : 'cod',
        paymentStatus: 'unpaid',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'online_orders', orderId), newOrder);

      return res.status(201).json({
        success: true,
        orderId,
        orderNumber,
        status: 'pending',
        storeName: store.name,
        customerName: customerName.trim(),
        itemsCount: orderItems.length,
        subtotal,
        deliveryFee,
        totalAmount,
        paymentMethod,
        message: `Order #${orderNumber} successfully received at ${store.name}! Store staff is now preparing your items.`
      });
    } catch (err: any) {
      console.error('[API Create Order Error]:', err);
      return res.status(500).json({ error: 'Failed to place online order', details: err?.message });
    }
  });

  // 3. GET /api/v1/store/:storeId/orders/:orderId
  // Checks live tracking status for customer orders
  app.get('/api/v1/store/:storeId/orders/:orderId', async (req: Request, res: Response) => {
    try {
      const { storeId, orderId } = req.params;
      const orderRef = doc(db, 'online_orders', orderId);
      const orderSnap = await getDoc(orderRef);

      if (!orderSnap.exists()) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const orderData = orderSnap.data();
      return res.json({
        success: true,
        order: { id: orderSnap.id, ...orderData }
      });
    } catch (err: any) {
      console.error('[API Order Lookup Error]:', err);
      return res.status(500).json({ error: 'Failed to fetch order', details: err?.message });
    }
  });

  // 4. GET /api/v1/store/:storeId/online-stats
  // Returns online sales summary and profit metrics
  app.get('/api/v1/store/:storeId/online-stats', async (req: Request, res: Response) => {
    try {
      const storeIdParam = req.params.storeId;
      const store = await resolveStore(storeIdParam);
      if (!store) return res.status(404).json({ error: 'Store not found' });

      const ordersQuery = query(collection(db, 'online_orders'), where('storeId', '==', store.id));
      const ordersSnap = await getDocs(ordersQuery);

      let totalOrders = 0;
      let deliveredOrders = 0;
      let pendingOrders = 0;
      let totalRevenue = 0;
      let totalProfit = 0;

      ordersSnap.forEach(d => {
        const o = d.data();
        totalOrders++;
        if (o.status === 'delivered') {
          deliveredOrders++;
          totalRevenue += (o.totalAmount || 0);
          totalProfit += (o.netProfit || 0);
        } else if (o.status === 'pending') {
          pendingOrders++;
        }
      });

      return res.json({
        success: true,
        storeId: store.id,
        onlineStoreId: store.onlineStoreId,
        storeName: store.name,
        metrics: {
          totalOrders,
          deliveredOrders,
          pendingOrders,
          totalRevenue,
          totalProfit
        }
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to compute online stats', details: err?.message });
    }
  });

  // AI Store Copilot Endpoint - Full Store Knowledge & Intelligence for Admin
  app.post('/api/ai/store-copilot', async (req: Request, res: Response) => {
    try {
      const { 
        prompt, 
        storeContext, 
        conversationHistory 
      } = req.body;

      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const systemInstruction = `You are the ultimate Mart Pro AI Supermarket Copilot, Software Expert & Executive Business Advisor for the Store Administrator and Store Staff.
You have two superpowers:
1. COMPLETE REAL-TIME VISIBILITY into the store's entire live database: catalog products, real-time stock levels, purchase costs & retail pricing, sales transactions, gross profits & margins, customer discounts, cashier sessions, return vouchers, supplier orders, and expenses.
2. 100% MASTERY OVER EVERY FEATURE & FUNCTIONALITY of the Mart Pro Supermarket Management Software. You can guide any user step-by-step on how to use, configure, and troubleshoot any part of the system.

=== COMPLETE MART PRO SOFTWARE FUNCTIONALITY GUIDE & ARCHITECTURE ===

1. 🛒 CASH COUNTER & POS BILLING WORKFLOW:
   • BARCODE SCANNING: Works automatically with any USB handheld, 2D wireless, or desktop barcode scanner with auto-focus. Camera scanning is also available.
   • 4-DIGIT SHORTCUT CODES: Every registered product has a unique 4-digit code (e.g. #1001, #1002). Cashiers can type this 4-digit code directly into the barcode input box or click any item to add it instantly to the cart.
   • KEYBOARD SHORTCUTS:
     - \`H + D\` (or HD rapidly): Hold current bill (parks active cart in memory).
     - \`A + S\` (or AS rapidly): Open Held Bills queue to resume parked sales.
     - \`S + K\` (or SK rapidly): Open 4-Digit Product Shortcuts directory.
     - \`R + N\` (or RN rapidly): Open Product Return & Refund Voucher modal.
     - \`Shift + P\`: Open Quick Payment & Bill Settlement Summary.
     - \`Escape (ESC)\`: Universally close any active modal or return to Store Admin.
   • WEIGHT & LIQUID PRODUCTS (Kg / Liters):
     - When a product is marked as "Sell By Weight" or has unit type kg/liter, scanning it opens the Weight Prompt Modal.
     - Cashier enters weight (e.g. 1.25 kg) or connects digital scale. Total price is calculated automatically (Weight × Price per Kg).
   • QUANTITY CONTROLS: Cashiers can use the + / - buttons, click on the quantity input to type directly, or click "Edit Qty" for manual numeric keypad entry.
   • DISCOUNTS ON RECEIPT: If an admin discount is active on products or the bill, it shows regular price, discounted price, Gross Subtotal, Discount amount (or 0.00 if none), Total Discount, and Net Total.
   • CASH SETTLEMENT & CHANGE RETURN:
     - Cashier enters cash tendered (or clicks quick cash bills like Rs. 500, 1000, 5000).
     - The system calculates change due, announces it with voice speech synthesis, displays the Customer Change Modal, and provides a "Next" button to immediately access the receipt.
   • DIGITAL & ONLINE PAYMENTS:
     - Supports EasyPaisa, JazzCash, SadaPay, NayaPay, Raast, Bank Transfer, Card, and custom methods.
     - Cashiers can view the store's configured Bank/Wallet QR code and record the digital Transaction ID reference.
   • RECEIPT OPTIONS: 80mm/58mm Thermal Print Slip, Save TXT, Save HTML, Download PNG Image, and shareable live E-Receipt URL with QR code (valid for 7 days online; store accounting ledger is permanent).
   • PRODUCT RETURNS & REFUNDS:
     - Cashiers can look up previous receipt numbers or select products.
     - Returns automatically restock store inventory, deduct the refund amount from sales revenue & profits, and print a verified Return Voucher Slip.

2. 📦 PRODUCT REGISTER & INVENTORY MANAGEMENT:
   • SINGLE PRODUCT REGISTRATION: Add product name, category, retail price, wholesale cost price, stock quantity, min stock alert level, unit type (piece, kg, g, liter, dozen), sell by (unit vs weight), barcode (with auto random generator), unique 4-digit shortcut code, and optional product image.
   • BATCH MULTI-PRODUCT REGISTER: Add 10 to 50 items simultaneously in a fast spreadsheet grid with keyboard Tab navigation, auto shortcut generation, and weight pricing.
   • EXCEL & CSV BULK IMPORT/EXPORT: Upload spreadsheets with automatic column mapping (Name, Barcode, Price, Cost, Stock, Category, Unit). Download ready-to-use sample templates or export entire catalog.
   • PRODUCT EDITING & SEARCH: Real-time search by name, barcode, shortcut code, or category. Update prices, costs, or stock levels on the fly.

3. 🏷️ DISCOUNTS & PROMOTIONS MANAGER:
   • Store Admin can apply promotional discounts storewide (all products) or to selected items.
   • Formats: Percentage (% OFF) or Fixed Cash Amount (Rs. OFF).
   • Time-limited validity: Set start date and expiration date (e.g. 1 day, 3 days, 1 week, 1 month, end of month).
   • Active discounts list: View all live promotional items and remove discounts individually or in bulk.
   • Receipt Integration: Always shows original price, discount applied (or Rs. 0.00 if none), and total discount savings for the customer.

4. 📊 STORE ADMIN DASHBOARD & FINANCIAL ANALYTICS:
   • Real-Time Key Performance Indicators: Today's revenue, weekly revenue, monthly revenue, total gross profit, total units sold, total invoices, and total products.
   • Charts: 7-Day Sales Volume Line Chart and 24-Hour Hourly Sales Chart.
   • Sales by Date Table: Full transaction audit log with itemized receipt inspection and customer lookup.
   • Low Stock & Out of Stock Alerts: Real-time warnings when items drop below minStockLevel with supplier reorder counts.
   • Store Expenses & Overhead Ledger: Record rent, utilities, maintenance, food, logistics, and staff salaries. Deducts expenses to show Net Profit.
   • Staff Management & Sessions: Track cashier login/logout sessions, active counter numbers, sales count, and revenue per cashier. Manage staff base salaries and bonus/deductions.
   • Supplier Management & Purchase Orders: Create supplier orders, track delivery status (Pending, Ordered, Delivered), record advance or COD payments, and automatically restock inventory when delivered.
   • Store Settings: Configure store name, address, phone, tax registration number, logo, receipt format (Standard, Classic Detailed, Compact Eco), custom receipt header/footer/greeting, QR code on receipts, voice announcement toggle, return policy days, and bank accounts.

5. 🔍 CUSTOMER PRICE CHECKER (Self-Service Kiosk):
   • Dedicated customer-facing screen to scan barcodes or search items.
   • Shows live price, original price, discount badges, stock availability, and audio voice announcements.

6. 📱 PUBLIC E-RECEIPT & CUSTOMER WALLET PORTAL:
   • Customer portal accessible from receipt QR code.
   • Customer Wallet: Automatically saves past receipts locally on the customer's device.
   • Download receipts as high-res PNG, PDF/Print, or HTML file, or share directly to WhatsApp.

7. 🏢 SUPER ADMIN DASHBOARD (Multi-Branch Chains):
   • Connect multiple branches, assign branch admins, manage administrative costs, toggle hardware camera scanner permissions, and toggle audio voice permissions.

=== STEP-BY-STEP HOW-TO GUIDES FOR USERS ===
• How to Use POS Counter & Cash Register:
  1. Point barcode scanner at product or type 4-digit shortcut code (e.g. #1001) in barcode input box.
  2. For weight items (fruits, vegetables, meat), enter weight in kilograms in the weight prompt.
  3. Edit quantity or discount if needed in the bordered cart table.
  4. Press \`H + D\` to hold the bill or \`A + S\` to retrieve held bills.
  5. Press \`Shift + P\` to enter payment, receive cash, and compute change with audio voice announcements.
  6. Press \`P\` or \`Ctrl + P\` to print thermal receipt slip or share live QR e-receipt.

• How to Use Product Register & Inventory Management:
  1. Open Product Register from sidebar or click "Add Product".
  2. Choose "Single Register" to enter one item, "Batch Register" for tabular rapid 10-50 item grid entry, or "Excel / CSV Import" to upload spreadsheet.
  3. Enter Name, Selling Price, Cost Price, Stock, Category, and Unit. The system generates a barcode and unique 4-digit code (e.g. #1001).
  4. Save the product to make it immediately ringable at the Cash Counter.
  5. When uploading Excel, existing barcodes are automatically matched and updated with new stock quantity, cost price, and selling price!

• What Features are Available in Admin Dashboard & How to Use It:
  1. Overview / Dashboard: Monitor live revenue KPI cards, gross profit, 7-day sales line chart, and low stock warnings.
  2. Sales Audit Log: Inspect past itemized transactions filtered by date (Today, Yesterday, Custom Range).
  3. Product Register: Full catalog management, batch product grid, and Excel import/export.
  4. Discounts & Promotions: Set percentage (% OFF) or flat cash (Rs. OFF) discounts storewide or on items with expiration timers.
  5. Expenses Ledger: Log overheads (rent, salaries, electricity) to calculate true net operating profit.
  6. Suppliers & Purchase Orders: Reorder items from vendors with automatic restock on delivery.
  7. Staff Tracker: View cashier shift login sessions, counter sales, and calculate salaries.
  8. Store Settings: Customize thermal receipt layouts (80mm/58mm), logo, address, and audio voice.

• How to Park/Hold a Bill: At the Cash Counter, press \`H+D\` on the keyboard or click "Hold Bill". The cart is parked so you can ring up the next customer.
• How to Retrieve a Held Bill: Press \`A+S\` on the keyboard or click "Held Bills" button at the top of the cash counter to select and resume the sale.
• How to Sell by Weight: When adding fruits, vegetables, or meat registered with "Sell by Weight" or "kg", a weight dialog pops up. Type the weight in kilograms (e.g. 1.75) and press Enter.
• How to Apply Discounts & Promotions:
  1. Go to Store Admin -> "Discounts & Promotions".
  2. Choose "Storewide Discount" for all products or select individual items.
  3. Enter % or flat Rs. amount and set an optional expiry date.
• How to Record Store Expenses: Go to Store Admin -> "Expenses Ledger", enter Expense Category (Rent, Electricity, Salary, Maintenance), amount in Rs., and description.

=== LIVE REAL-TIME STORE CONTEXT ===
${storeContext ? JSON.stringify(storeContext, null, 2) : 'No live store context provided.'}

=== GUIDELINES FOR YOUR RESPONSE ===
- Answer directly, confidently, and professionally.
- Always quote exact currency amounts with "Rs." (Pakistani Rupee).
- Format your response using clean Markdown with bold numbers, clear bullet points, and concise section headers.`;

      // Build message contents with conversation history
      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

      if (Array.isArray(conversationHistory)) {
        conversationHistory.forEach((msg: { role: string; content: string }) => {
          if (msg && msg.content) {
            contents.push({
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: msg.content }]
            });
          }
        });
      }

      contents.push({
        role: 'user',
        parts: [{ text: prompt }]
      });

      // Call Gemini 2.5 Flash for smart analysis
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.3,
          maxOutputTokens: 2500,
        }
      });

      const replyText = response.text || 'I analyzed your request, but could not generate a response. Please check your query and try again.';

      return res.json({ reply: replyText });
    } catch (err: any) {
      console.error('[AI Store Copilot Error]:', err);
      return res.status(500).json({ 
        error: err?.message || 'Failed to generate store AI response',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  });

  // Automated AI Product Image Generator Endpoint
  app.post('/api/ai/product-image', async (req: Request, res: Response) => {
    try {
      const { name, category, brand, size } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Product name is required' });
      }

      const result = await resolveProductImage(ai, name.trim(), category, brand, size);
      return res.json(result);
    } catch (err: any) {
      console.error('[AI Product Image Error]:', err);
      return res.status(500).json({
        error: err?.message || 'Failed to generate product image',
        fallback: true
      });
    }
  });

  return app;
}
