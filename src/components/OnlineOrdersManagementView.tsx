import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  db, 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  updateDoc, 
  setDoc, 
  addDoc, 
  increment,
  cleanFirestoreData
} from '../lib/firebase';
import { Store, UserAccount, OnlineOrder, OnlineOrderStatus, Sale, SaleItem } from '../types';
import QRCode from 'qrcode';
import { 
  ShoppingBag, 
  Globe, 
  Copy, 
  Check, 
  QrCode, 
  ExternalLink, 
  Share2, 
  MessageCircle, 
  Clock, 
  Truck, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Package, 
  PackageCheck, 
  Printer, 
  Code2, 
  DollarSign, 
  Sparkles, 
  ChevronRight, 
  FileCode, 
  Send, 
  Settings, 
  Search, 
  Filter, 
  TrendingUp, 
  MapPin, 
  Phone, 
  Save, 
  RefreshCw,
  Terminal,
  Layers,
  ArrowRight
} from 'lucide-react';

interface OnlineOrdersManagementViewProps {
  store: Store;
  currentUser: UserAccount;
  onPreviewStorefront?: () => void;
}

export const OnlineOrdersManagementView: React.FC<OnlineOrdersManagementViewProps> = ({
  store,
  currentUser,
  onPreviewStorefront
}) => {
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'orders' | 'share' | 'api' | 'settings'>('orders');
  const [statusFilter, setStatusFilter] = useState<'all' | OnlineOrderStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OnlineOrder | null>(null);

  // Settings form states
  const [deliveryFeeInput, setDeliveryFeeInput] = useState<string>(
    store.onlineStoreDeliveryFee !== undefined ? String(store.onlineStoreDeliveryFee) : '150'
  );
  const [minOrderInput, setMinOrderInput] = useState<string>(
    store.onlineStoreMinOrder !== undefined ? String(store.onlineStoreMinOrder) : '500'
  );
  const [storePhoneInput, setStorePhoneInput] = useState<string>(
    store.onlineStorePhone || store.phone || ''
  );
  const [noticeInput, setNoticeInput] = useState<string>(
    store.onlineStoreNotice || 'Special 10% to 25% Off on Selected Supermarket Grocery!'
  );
  const [estimatedTimeInput, setEstimatedTimeInput] = useState<string>(
    store.onlineStoreEstimatedTime || '30-45 mins'
  );
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState(false);

  // QR Code data URL
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCodeTab, setCopiedCodeTab] = useState<string | null>(null);
  const [activeCodeLang, setActiveCodeLang] = useState<'curl' | 'javascript' | 'react' | 'flutter' | 'endpoints'>('endpoints');

  // Audio chime for new online orders
  const prevOrdersCountRef = useRef<number>(0);
  const isFirstLoadRef = useRef(true);

  // Public Online Storefront URL
  const onlineSlug = store.onlineStoreId || store.id;
  const storefrontUrl = `${window.location.origin}/?onlineStore=${onlineSlug}`;

  // Generate QR Code for sharing
  useEffect(() => {
    QRCode.toDataURL(storefrontUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#1e293b',
        light: '#ffffff'
      }
    })
      .then(url => setQrCodeDataUrl(url))
      .catch(err => console.warn('QR code generation error:', err));
  }, [storefrontUrl]);

  // Subscribe to real-time Online Orders for this store
  useEffect(() => {
    if (!store?.id) return;

    const q = query(
      collection(db, 'online_orders'),
      where('storeId', '==', store.id)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: OnlineOrder[] = [];
      snapshot.forEach(d => {
        list.push({ id: d.id, ...d.data() } as OnlineOrder);
      });

      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(list);

      // Play chime if new order arrived while open
      if (!isFirstLoadRef.current && list.length > prevOrdersCountRef.current) {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.5);
        } catch {
          // ignore
        }
      }

      isFirstLoadRef.current = false;
      prevOrdersCountRef.current = list.length;
    }, (err) => {
      console.warn('Online orders sync warning:', err);
    });

    return () => unsub();
  }, [store?.id]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q) ||
        o.customerAddress.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [orders, statusFilter, searchQuery]);

  // KPI Calculations for Online Channel
  const onlineStats = useMemo(() => {
    let totalRevenue = 0;
    let totalProfit = 0;
    let pendingCount = 0;
    let deliveredCount = 0;

    orders.forEach(o => {
      if (o.status === 'delivered') {
        totalRevenue += (o.totalAmount || 0);
        totalProfit += (o.netProfit || 0);
        deliveredCount++;
      } else if (o.status === 'pending') {
        pendingCount++;
      }
    });

    return {
      totalOrders: orders.length,
      pendingCount,
      deliveredCount,
      totalRevenue,
      totalProfit,
      avgOrderValue: deliveredCount > 0 ? Math.round(totalRevenue / deliveredCount) : 0
    };
  }, [orders]);

  // Action: Update Order Status
  const handleUpdateStatus = async (order: OnlineOrder, newStatus: OnlineOrderStatus) => {
    try {
      const orderRef = doc(db, 'online_orders', order.id);
      const updates: any = {
        status: newStatus,
        updatedAt: new Date().toISOString()
      };

      if (newStatus === 'accepted') {
        updates.acceptedAt = new Date().toISOString();
      } else if (newStatus === 'delivered') {
        updates.deliveredAt = new Date().toISOString();
        updates.paymentStatus = 'paid';

        // CRITICAL: When order is delivered, automatically record it into the permanent 'sales' collection!
        // This ensures online sales are recorded into total revenue and profit.
        const saleId = `sale_online_${order.id}`;
        updates.saleId = saleId;

        const saleItems: SaleItem[] = order.items.map(i => ({
          productId: i.productId,
          barcode: i.barcode || '',
          shortcutCode: i.shortcutCode || '',
          name: i.name,
          costPrice: i.costPrice || 0,
          price: i.price,
          originalPrice: i.originalPrice || i.price,
          quantity: i.quantity,
          total: i.total,
          sellBy: i.sellBy || 'unit',
          unitType: i.unitType || 'piece'
        }));

        const saleRecord: Partial<Sale> = {
          id: saleId,
          storeId: store.id,
          storeName: store.name,
          counterId: 'online_channel',
          counterName: 'Online Store Dispatch',
          cashierUsername: 'Online Mart',
          cashierName: 'Online Delivery Hub',
          items: saleItems,
          subtotalAmount: order.subtotal,
          discountAmount: order.discountAmount || 0,
          totalAmount: order.totalAmount,
          deliveryFee: order.deliveryFee || 0,
          paymentMethod: order.paymentMethod === 'cod' ? 'cash' : 'online',
          onlinePaymentProvider: order.paymentMethod !== 'cod' ? order.paymentMethod : undefined,
          receiptNumber: order.orderNumber,
          timestamp: new Date().toISOString(),
          // Channel differentiation tag
          orderSource: 'online',
          onlineOrderId: order.id,
          onlineCustomerName: order.customerName,
          onlineCustomerPhone: order.customerPhone,
          customerAddress: order.customerAddress
        };

        await setDoc(doc(db, 'sales', saleId), cleanFirestoreData(saleRecord));
      } else if (newStatus === 'cancelled') {
        updates.cancelledAt = new Date().toISOString();
        // Restock inventory items
        for (const item of order.items) {
          try {
            await updateDoc(doc(db, 'products', item.productId), {
              stockQuantity: increment(item.quantity)
            });
          } catch (e) {
            console.warn('Restock warning:', e);
          }
        }
      }

      await updateDoc(orderRef, updates);
    } catch (err: any) {
      console.error(err);
      alert('Failed to update order status: ' + err.message);
    }
  };

  // Action: Save Online Store Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const storeRef = doc(db, 'stores', store.id);
      await updateDoc(storeRef, {
        onlineStoreDeliveryFee: Number(deliveryFeeInput) || 0,
        onlineStoreMinOrder: Number(minOrderInput) || 0,
        onlineStorePhone: storePhoneInput.trim(),
        onlineStoreNotice: noticeInput.trim(),
        onlineStoreEstimatedTime: estimatedTimeInput.trim()
      });

      setSettingsSavedMsg(true);
      setTimeout(() => setSettingsSavedMsg(false), 3000);
    } catch (err: any) {
      console.error(err);
      alert('Failed to save settings: ' + err.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Copy helper
  const handleCopy = (text: string, tabName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeTab(tabName);
    setTimeout(() => setCopiedCodeTab(null), 2500);
  };

  // Print Delivery Slip
  const handlePrintSlip = (order: OnlineOrder) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsHtml = order.items.map(i => `
      <tr>
        <td style="padding: 6px 0; border-bottom: 1px dashed #cbd5e1;">${i.name}</td>
        <td style="padding: 6px 0; border-bottom: 1px dashed #cbd5e1; text-align: center;">${i.quantity}</td>
        <td style="padding: 6px 0; border-bottom: 1px dashed #cbd5e1; text-align: right;">Rs. ${i.price}</td>
        <td style="padding: 6px 0; border-bottom: 1px dashed #cbd5e1; text-align: right; font-weight: bold;">Rs. ${i.total}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Delivery Slip - ${order.orderNumber}</title>
          <style>
            body { font-family: monospace; padding: 20px; font-size: 13px; max-width: 380px; margin: 0 auto; }
            h2, h3, p { margin: 4px 0; }
            .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
            .details { margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            .total-row { font-size: 15px; font-weight: bold; border-top: 2px dashed #000; padding-top: 8px; margin-top: 8px; }
            .footer { text-align: center; margin-top: 20px; border-top: 1px dashed #999; padding-top: 10px; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${store.name}</h2>
            <h3>ONLINE DELIVERY DISPATCH SLIP</h3>
            <p>Order #${order.orderNumber}</p>
            <p>Time: ${new Date(order.createdAt).toLocaleString()}</p>
          </div>

          <div class="details">
            <p><strong>Customer:</strong> ${order.customerName}</p>
            <p><strong>Phone:</strong> ${order.customerPhone}</p>
            <p><strong>Address:</strong> ${order.customerAddress}</p>
            ${order.customerNotes ? `<p><strong>Instructions:</strong> ${order.customerNotes}</p>` : ''}
            <p><strong>Payment Method:</strong> ${order.paymentMethod.toUpperCase()}</p>
          </div>

          <table>
            <thead>
              <tr style="border-bottom: 1px solid #000;">
                <th style="text-align: left;">Item</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="text-align: right;">
            <p>Subtotal: Rs. ${order.subtotal}</p>
            <p>Delivery Fee: Rs. ${order.deliveryFee}</p>
            <div class="total-row">
              <p>TOTAL PAYABLE: Rs. ${order.totalAmount}</p>
            </div>
          </div>

          <div class="footer">
            <p>Thank you for ordering with ${store.name}!</p>
            <p>For assistance, contact: ${store.onlineStorePhone || store.phone || 'Store Admin'}</p>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // API Code Snippets generator for the Chat / Developer Hub
  const apiBaseUrl = window.location.origin;
  const storeIdParam = store.onlineStoreId || store.id;

  const codeSnippets = {
    endpoints: `// === H A MART ONLINE STORE REST API SPECIFICATION ===
// Base URL: ${apiBaseUrl}

// 1. GET ALL PRODUCTS, PRICES, QUANTITIES & OFFERS
GET /api/v1/store/${storeIdParam}/online-catalog
Description: Returns store details, category list, all products with current stock quantity, prices, and active discount offers.

// 2. SUBMIT NEW ONLINE ORDER DIRECTLY TO MART PRO
POST /api/v1/store/${storeIdParam}/online-order
Content-Type: application/json
Body:
{
  "customerName": "Customer Full Name",
  "customerPhone": "03001234567",
  "customerAddress": "Delivery Address, Street, House #",
  "customerNotes": "Optional gate instructions",
  "paymentMethod": "cod", // "cod" | "online_transfer" | "easypaisa" | "jazzcash"
  "items": [
    { "productId": "prod_ha_01", "quantity": 2 },
    { "productId": "prod_ha_02", "quantity": 1 }
  ]
}

// 3. TRACK LIVE ORDER STATUS
GET /api/v1/store/${storeIdParam}/orders/{orderId}
Description: Returns real-time status (pending -> accepted -> packing -> out_for_delivery -> delivered).

// 4. GET ONLINE STORE SALES & REVENUE STATS
GET /api/v1/store/${storeIdParam}/online-stats
Description: Returns total online revenue, profit, and order metrics.`,

    curl: `# 1. Test fetching all products & active discounts:
curl -X GET "${apiBaseUrl}/api/v1/store/${storeIdParam}/online-catalog"

# 2. Test placing an online order directly into Mart Pro:
curl -X POST "${apiBaseUrl}/api/v1/store/${storeIdParam}/online-order" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customerName": "Hamza Tariq",
    "customerPhone": "03001234567",
    "customerAddress": "House 12, Street 4, Phase 2, Lahore",
    "customerNotes": "Call before arriving",
    "paymentMethod": "cod",
    "items": [
      { "productId": "prod_ha_01", "quantity": 2 }
    ]
  }'`,

    javascript: `// === JavaScript Fetch API for any Website or App ===

// Step 1: Fetch all products, quantities, prices and offers from H A Mart
async function loadHAMartCatalog() {
  const response = await fetch('${apiBaseUrl}/api/v1/store/${storeIdParam}/online-catalog');
  const data = await response.json();
  console.log("Store Name:", data.store.name);
  console.log("Products Catalog:", data.products);
  return data.products;
}

// Step 2: Send Customer Order to Mart Pro
async function submitOrderToMartPro(customer, cartItems) {
  const response = await fetch('${apiBaseUrl}/api/v1/store/${storeIdParam}/online-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: customer.name,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      paymentMethod: customer.paymentMethod || 'cod',
      items: cartItems.map(item => ({
        productId: item.id,
        quantity: item.qty
      }))
    })
  });

  const result = await response.json();
  if (result.success) {
    alert(\`Order placed! Order Number: \${result.orderNumber}\`);
  } else {
    alert(\`Error: \${result.error}\`);
  }
}`,

    react: `// === Ready-to-use React Shopping Catalog Hook & Component ===
import React, { useState, useEffect } from 'react';

export function HAMartOnlineStore() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);

  useEffect(() => {
    fetch('${apiBaseUrl}/api/v1/store/${storeIdParam}/online-catalog')
      .then(res => res.json())
      .then(data => setProducts(data.products || []));
  }, []);

  const placeOrder = async () => {
    const res = await fetch('${apiBaseUrl}/api/v1/store/${storeIdParam}/online-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: "Ali Raza",
        customerPhone: "03001234567",
        customerAddress: "Main Boulevard, Lahore",
        paymentMethod: "cod",
        items: cart.map(c => ({ productId: c.id, quantity: c.qty }))
      })
    });
    const data = await res.json();
    alert("Order Received at Mart Pro: #" + data.orderNumber);
  };

  return (
    <div>
      <h1>H A Mart Online Catalog</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {products.map(p => (
          <div key={p.id} style={{ border: '1px solid #ccc', padding: 16 }}>
            <h3>{p.name}</h3>
            <p>Price: Rs. {p.price} {p.hasDiscount && <span style={{ color: 'red' }}>({p.discountLabel})</span>}</p>
            <p>Stock Available: {p.stockQuantity}</p>
            <button onClick={() => setCart([...cart, { id: p.id, qty: 1 }])}>Add to Cart</button>
          </div>
        ))}
      </div>
    </div>
  );
}`,

    flutter: `// === Flutter / Dart Mobile App Integration Code ===
import 'dart:convert';
import 'package:http/http.dart' as http;

class HAMartService {
  static const String baseUrl = '${apiBaseUrl}/api/v1/store/${storeIdParam}';

  // 1. Fetch live products catalog with stock & offers
  static Future<List<dynamic>> fetchCatalog() async {
    final response = await http.get(Uri.parse('$baseUrl/online-catalog'));
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['products'];
    }
    throw Exception('Failed to load store catalog');
  }

  // 2. Submit customer order to Mart Pro
  static Future<Map<String, dynamic>> sendOrder({
    required String name,
    required String phone,
    required String address,
    required List<Map<String, dynamic>> items,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/online-order'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'customerName': name,
        'customerPhone': phone,
        'customerAddress': address,
        'paymentMethod': 'cod',
        'items': items,
      }),
    );
    return json.decode(response.body);
  }
}`
  };

  return (
    <div className="space-y-6 text-left">
      {/* Top Banner KPI Highlight Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Online Sales
          </span>
          <span className="font-mono font-black text-xl text-slate-900 block mt-1">
            Rs. {onlineStats.totalRevenue.toLocaleString()}
          </span>
          <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
            {onlineStats.deliveredCount} delivered orders
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-emerald-600">
            Online Net Profit
          </span>
          <span className="font-mono font-black text-xl text-emerald-700 block mt-1">
            Rs. {onlineStats.totalProfit.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
            Separately accounted & in total profit
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-amber-600">
            Action Required
          </span>
          <span className="font-mono font-black text-xl text-amber-700 block mt-1">
            {onlineStats.pendingCount} New Orders
          </span>
          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
            Awaiting store confirmation
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Average Order Value
          </span>
          <span className="font-mono font-black text-xl text-slate-900 block mt-1">
            Rs. {onlineStats.avgOrderValue}
          </span>
          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
            Per delivered basket
          </span>
        </div>
      </div>

      {/* Main Feature Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('orders')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
            activeSubTab === 'orders'
              ? 'bg-orange-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Live Online Orders</span>
          {onlineStats.pendingCount > 0 && (
            <span className="bg-white text-orange-700 px-1.5 py-0.2 rounded-full text-[10px] font-black">
              {onlineStats.pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('share')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
            activeSubTab === 'share'
              ? 'bg-orange-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>Storefront Link & QR Code</span>
        </button>

        <button
          onClick={() => setActiveSubTab('api')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
            activeSubTab === 'api'
              ? 'bg-orange-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Code2 className="w-4 h-4" />
          <span>API & Developer Code Hub</span>
        </button>

        <button
          onClick={() => setActiveSubTab('settings')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
            activeSubTab === 'settings'
              ? 'bg-orange-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Online Store Settings</span>
        </button>
      </div>

      {/* TAB 1: LIVE ORDERS DISPATCH BOARD */}
      {activeSubTab === 'orders' && (
        <div className="space-y-4">
          {/* Status Filter Buttons and Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {[
                { key: 'all', label: 'All Orders', count: orders.length },
                { key: 'pending', label: 'New / Pending', count: orders.filter(o => o.status === 'pending').length },
                { key: 'accepted', label: 'Accepted', count: orders.filter(o => o.status === 'accepted').length },
                { key: 'packing', label: 'Packing', count: orders.filter(o => o.status === 'packing').length },
                { key: 'out_for_delivery', label: 'Out for Delivery', count: orders.filter(o => o.status === 'out_for_delivery').length },
                { key: 'delivered', label: 'Delivered', count: orders.filter(o => o.status === 'delivered').length },
                { key: 'cancelled', label: 'Cancelled', count: orders.filter(o => o.status === 'cancelled').length }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                    statusFilter === tab.key
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="ml-1.5 opacity-75">({tab.count})</span>
                </button>
              ))}
            </div>

            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search orders by name, phone..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-hidden focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
          </div>

          {/* Orders Cards Grid */}
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-slate-800">No online orders found</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                {statusFilter === 'all' 
                  ? 'Share your online store link or QR code with customers to receive orders directly in Mart Pro.' 
                  : `No orders currently matching "${statusFilter}".`}
              </p>
              {onPreviewStorefront && (
                <button
                  onClick={onPreviewStorefront}
                  className="px-4 py-2 bg-orange-600 text-white font-bold rounded-xl text-xs hover:bg-orange-500 cursor-pointer shadow-sm"
                >
                  Test Place an Order on Storefront →
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOrders.map(order => {
                const isPending = order.status === 'pending';
                const isAccepted = order.status === 'accepted';
                const isPacking = order.status === 'packing';
                const isOut = order.status === 'out_for_delivery';
                const isDelivered = order.status === 'delivered';
                const isCancelled = order.status === 'cancelled';

                return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-2xl border p-5 space-y-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between ${
                      isPending ? 'border-amber-300 ring-2 ring-amber-400/20' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      {/* Order Header */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-slate-900">
                              {order.orderNumber}
                            </span>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              isPending ? 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse' :
                              isAccepted ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                              isPacking ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                              isOut ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                              isDelivered ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                              'bg-red-100 text-red-800 border border-red-200'
                            }`}>
                              {order.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
                            {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(order.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <button
                          onClick={() => handlePrintSlip(order)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
                          title="Print Delivery Slip"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Customer Info */}
                      <div className="py-2.5 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{order.customerName}</span>
                          <a
                            href={`https://wa.me/${order.customerPhone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>{order.customerPhone}</span>
                          </a>
                        </div>
                        <p className="text-slate-500 font-medium truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{order.customerAddress}</span>
                        </p>
                        {order.customerNotes && (
                          <p className="text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded-md font-medium">
                            Note: {order.customerNotes}
                          </p>
                        )}
                      </div>

                      {/* Ordered Items Preview */}
                      <div className="bg-slate-50 rounded-xl p-2.5 space-y-1.5 text-xs border border-slate-100 max-h-36 overflow-y-auto">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-slate-700">
                            <span className="truncate pr-2 font-medium">
                              {item.name} <strong className="text-slate-900">× {item.quantity}</strong>
                            </span>
                            <span className="font-mono font-bold text-slate-900 shrink-0">
                              Rs. {item.total}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Financials Breakdown */}
                      <div className="pt-2 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">Payment:</span>
                          <span className="font-bold text-slate-800 uppercase">{order.paymentMethod}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 font-bold block">Order Total:</span>
                          <span className="font-mono font-black text-sm text-orange-700">
                            Rs. {order.totalAmount}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Dispatch Buttons */}
                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                      {isPending && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(order, 'accepted')}
                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs transition-all"
                          >
                            Accept Order
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(order, 'cancelled')}
                            className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl text-xs cursor-pointer transition-colors"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {isAccepted && (
                        <button
                          onClick={() => handleUpdateStatus(order, 'packing')}
                          className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs transition-all flex items-center justify-center gap-1.5"
                        >
                          <Package className="w-3.5 h-3.5" /> Start Packing
                        </button>
                      )}

                      {isPacking && (
                        <button
                          onClick={() => handleUpdateStatus(order, 'out_for_delivery')}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs transition-all flex items-center justify-center gap-1.5"
                        >
                          <Truck className="w-3.5 h-3.5" /> Hand Over to Rider (Out for Delivery)
                        </button>
                      )}

                      {isOut && (
                        <button
                          onClick={() => handleUpdateStatus(order, 'delivered')}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Mark Delivered & Settle Sale
                        </button>
                      )}

                      {isDelivered && (
                        <div className="w-full py-1.5 bg-emerald-50 text-emerald-800 rounded-xl text-center text-xs font-bold flex items-center justify-center gap-1 border border-emerald-200">
                          <Check className="w-3.5 h-3.5" /> Completed & Added to Store Revenue
                        </div>
                      )}

                      {isCancelled && (
                        <div className="w-full py-1.5 bg-red-50 text-red-700 rounded-xl text-center text-xs font-bold flex items-center justify-center gap-1 border border-red-200">
                          <XCircle className="w-3.5 h-3.5" /> Cancelled / Restocked
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STOREFRONT LINK & QR CODE CENTER */}
      {activeSubTab === 'share' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Link and Share details */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-2xs">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Globe className="w-5 h-5 text-orange-600" />
                <span>Your Live Online Shopping Website Link</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Share this link on WhatsApp groups, Facebook, Instagram, or printed promotional flyers. Customers can open it on mobile or PC to view live products and place orders.
              </p>
            </div>

            {/* Direct Link Box */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Customer Web Storefront URL:
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={storefrontUrl}
                  className="w-full font-mono text-xs bg-white px-3 py-2.5 rounded-xl border border-slate-200 text-slate-800 select-all outline-hidden"
                />
                <button
                  onClick={() => handleCopy(storefrontUrl, 'link')}
                  className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs transition-all"
                >
                  {copiedCodeTab === 'link' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCodeTab === 'link' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Quick Share Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Order fresh groceries, staples, and daily essentials online from ${store.name}!\n\nShop online now: ${storefrontUrl}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Share Store on WhatsApp</span>
              </a>

              {onPreviewStorefront && (
                <button
                  onClick={onPreviewStorefront}
                  className="p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Preview Customer Storefront</span>
                </button>
              )}
            </div>

            <div className="p-4 bg-orange-50 rounded-2xl border border-orange-200 space-y-1 text-xs text-orange-950">
              <span className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-orange-600" />
                <span>Real-Time Catalog Sync</span>
              </span>
              <p className="text-orange-900/80">
                Any products added in Product Register, price changes, stock additions, or promotional discount offers applied in Store Admin automatically update on the online storefront in real-time!
              </p>
            </div>
          </div>

          {/* Printable QR Code Poster */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-2xs text-center">
            <h4 className="text-base font-black text-slate-900">
              Printable Storefront QR Code
            </h4>
            <p className="text-xs text-slate-500 font-medium">
              Customers can scan this QR code with their mobile camera to shop directly.
            </p>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 inline-block shadow-inner mx-auto">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="Online Store QR Code"
                  className="w-48 h-48 mx-auto rounded-xl"
                />
              ) : (
                <div className="w-48 h-48 bg-slate-200 rounded-xl animate-pulse" />
              )}
              <span className="block font-bold text-xs text-slate-700 mt-2">
                Scan to Shop Online at {store.name}
              </span>
            </div>

            {qrCodeDataUrl && (
              <a
                href={qrCodeDataUrl}
                download={`${store.name}-Online-Store-QR.png`}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Download High-Res QR for Banner</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DEVELOPER API & INTEGRATION CODE HUB */}
      {activeSubTab === 'api' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-2xs">
          <div>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-orange-600" />
                  <span>Developer API & Custom App Integration Kit</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Connect custom mobile apps, React/Vue websites, Flutter apps, or Telegram/WhatsApp bots directly to {store.name}'s inventory and order system.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-bold">
                  Store Slug: <strong>{storeIdParam}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Code Tabs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 flex-wrap gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {[
                  { key: 'endpoints', label: '1. REST Endpoints' },
                  { key: 'curl', label: '2. cURL' },
                  { key: 'javascript', label: '3. JavaScript / Fetch' },
                  { key: 'react', label: '4. React Component' },
                  { key: 'flutter', label: '5. Flutter / Dart' }
                ].map(lang => (
                  <button
                    key={lang.key}
                    onClick={() => setActiveCodeLang(lang.key as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      activeCodeLang === lang.key
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => handleCopy(codeSnippets[activeCodeLang], activeCodeLang)}
                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
              >
                {copiedCodeTab === activeCodeLang ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCodeTab === activeCodeLang ? 'Copied Code!' : 'Copy Code Snippet'}</span>
              </button>
            </div>

            {/* Code Display Area */}
            <div className="relative">
              <pre className="p-4 sm:p-5 rounded-2xl bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto max-h-[460px] leading-relaxed shadow-inner">
                <code>{codeSnippets[activeCodeLang]}</code>
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ONLINE STORE SETTINGS */}
      {activeSubTab === 'settings' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-2xs max-w-2xl">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-orange-600" />
              <span>Online Store Delivery & Order Parameters</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Configure delivery rates, order thresholds, and support contact details for {store.name}.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Delivery Fee (Rs.) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={deliveryFeeInput}
                  onChange={(e) => setDeliveryFeeInput(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Minimum Order Amount (Rs.) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={minOrderInput}
                  onChange={(e) => setMinOrderInput(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  WhatsApp Support Phone Number
                </label>
                <input
                  type="tel"
                  value={storePhoneInput}
                  onChange={(e) => setStorePhoneInput(e.target.value)}
                  placeholder="e.g. 0300 1234567"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Estimated Delivery Time
                </label>
                <input
                  type="text"
                  value={estimatedTimeInput}
                  onChange={(e) => setEstimatedTimeInput(e.target.value)}
                  placeholder="e.g. 30-45 mins"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Storefront Promo Notice Banner
              </label>
              <input
                type="text"
                value={noticeInput}
                onChange={(e) => setNoticeInput(e.target.value)}
                placeholder="e.g. Free delivery on orders above Rs. 2,000!"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-all"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingSettings ? 'Saving Settings...' : 'Save Settings'}</span>
              </button>

              {settingsSavedMsg && (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <Check className="w-4 h-4" /> Settings updated successfully!
                </span>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
