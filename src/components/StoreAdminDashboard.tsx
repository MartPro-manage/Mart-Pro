import React, { useState, useEffect, useMemo } from 'react';
import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  handleFirestoreError,
  OperationType 
} from '../lib/firebase';
import { Product, Sale, Store, UserAccount } from '../types';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  DollarSign, 
  ShoppingBag, 
  Search, 
  Calculator, 
  PackageCheck, 
  Receipt, 
  Eye, 
  ArrowUpRight, 
  RefreshCw,
  Layers
} from 'lucide-react';

interface StoreAdminDashboardProps {
  store: Store;
  currentUser: UserAccount;
  onNavigateToPOS?: () => void;
  onNavigateToInventory?: () => void;
  onViewReceipt?: (sale: Sale) => void;
}

export const StoreAdminDashboard: React.FC<StoreAdminDashboardProps> = ({
  store,
  currentUser,
  onNavigateToPOS,
  onNavigateToInventory,
  onViewReceipt
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [storeUsers, setStoreUsers] = useState<UserAccount[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'sold_products' | 'stock_remaining' | 'sales_history' | 'staff'>('sold_products');

  // Real-time synchronization of Products, Sales, and Staff for this store
  useEffect(() => {
    if (!store?.id) return;

    // 1. Subscribe to Products
    const productsQuery = query(
      collection(db, 'products'),
      where('storeId', '==', store.id)
    );

    const unsubProducts = onSnapshot(productsQuery, (snapshot) => {
      const prodList: Product[] = [];
      snapshot.forEach((doc) => {
        prodList.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(prodList);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'products');
    });

    // 2. Subscribe to Sales
    const salesQuery = query(
      collection(db, 'sales'),
      where('storeId', '==', store.id)
    );

    const unsubSales = onSnapshot(salesQuery, (snapshot) => {
      const saleList: Sale[] = [];
      snapshot.forEach((doc) => {
        saleList.push({ id: doc.id, ...doc.data() } as Sale);
      });
      // Sort sales by timestamp descending
      saleList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setSales(saleList);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'sales');
    });

    // 3. Subscribe to Staff Users
    const usersQuery = query(
      collection(db, 'users'),
      where('storeId', '==', store.id)
    );

    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
      const userList: UserAccount[] = [];
      snapshot.forEach((doc) => {
        userList.push({ id: doc.id, ...doc.data() } as UserAccount);
      });
      setStoreUsers(userList);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'users');
    });

    return () => {
      unsubProducts();
      unsubSales();
      unsubUsers();
    };
  }, [store?.id]);

  // Compute Aggregations
  const totalRevenue = useMemo(() => {
    return sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  }, [sales]);

  const totalItemsSoldQuantity = useMemo(() => {
    return sales.reduce((sum, sale) => {
      const itemsCount = sale.items?.reduce((iSum, item) => iSum + (item.quantity || 0), 0) || 0;
      return sum + itemsCount;
    }, 0);
  }, [sales]);

  // Aggregate Sold Products with quantity and total revenue per product
  const soldProductsSummary = useMemo(() => {
    const summaryMap: { [barcodeOrId: string]: { barcode: string; name: string; quantitySold: number; totalRevenue: number; lastPrice: number } } = {};

    sales.forEach((sale) => {
      sale.items?.forEach((item) => {
        const key = item.barcode || item.name;
        if (!summaryMap[key]) {
          summaryMap[key] = {
            barcode: item.barcode,
            name: item.name,
            quantitySold: 0,
            totalRevenue: 0,
            lastPrice: item.price
          };
        }
        summaryMap[key].quantitySold += item.quantity;
        summaryMap[key].totalRevenue += item.total;
        summaryMap[key].lastPrice = item.price;
      });
    });

    return Object.values(summaryMap).sort((a, b) => b.quantitySold - a.quantitySold);
  }, [sales]);

  // Low stock products count
  const lowStockCount = useMemo(() => {
    return products.filter(p => p.stockQuantity <= (p.minStockLevel || 5)).length;
  }, [products]);

  // Filtered sold products
  const filteredSoldProducts = useMemo(() => {
    if (!searchTerm.trim()) return soldProductsSummary;
    const term = searchTerm.toLowerCase();
    return soldProductsSummary.filter(
      sp => sp.name.toLowerCase().includes(term) || sp.barcode.toLowerCase().includes(term)
    );
  }, [soldProductsSummary, searchTerm]);

  // Filtered remaining stock products
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(
      p => p.name.toLowerCase().includes(term) || p.barcode.toLowerCase().includes(term) || p.category.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Store Admin Top Bar */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative overflow-hidden">
          <div className="space-y-2 z-10">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-orange-600" /> Store Admin Dashboard
              </span>
              <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Realtime Sync Active
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {store.name} <span className="text-orange-600">Analytics & Inventory</span>
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl font-medium">
              Track real-time stock levels, monitor total items sold by cash counters, and directly access inventory register and POS selling controls.
            </p>
          </div>

          {/* Quick Shortcuts for Admin */}
          <div className="flex flex-wrap items-center gap-3 z-10 shrink-0">
            {onNavigateToInventory && (
              <button
                onClick={onNavigateToInventory}
                className="px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-sm"
              >
                <PackageCheck className="w-4 h-4" /> Stock In Register Mode
              </button>
            )}

            {onNavigateToPOS && (
              <button
                onClick={onNavigateToPOS}
                className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-sm"
              >
                <Calculator className="w-4 h-4" /> Open POS Cash Counter
              </button>
            )}
          </div>
        </div>

        {/* Real-time High-Level Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Revenue */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Sales Revenue</span>
              <div className="p-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-200 font-bold text-xs">
                <span>PKR</span>
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900">
              Rs. {totalRevenue.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> From {sales.length} completed orders
            </p>
          </div>

          {/* Sold Products Quantity */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Units Sold</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-emerald-600">
              {totalItemsSoldQuantity.toLocaleString()} <span className="text-xs text-slate-500 font-normal">items</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              {soldProductsSummary.length} distinct products sold
            </p>
          </div>

          {/* Remaining Inventory Stock */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Remaining Stock</span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
                <Package className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-blue-600">
              {products.reduce((acc, p) => acc + (p.stockQuantity || 0), 0).toLocaleString()} <span className="text-xs text-slate-500 font-normal">units</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <RefreshCw className="w-3 h-3 text-orange-600 animate-spin" /> Real-time Firestore sync
            </p>
          </div>

          {/* Low Stock Warning */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Low Stock Alerts</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-amber-600">
              {lowStockCount} <span className="text-xs text-slate-500 font-normal">items critical</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              Stock ≤ 5 units remaining
            </p>
          </div>

        </div>

        {/* Tab Selection & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('sold_products')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all ${
                activeTab === 'sold_products'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              Total Products Sold ({soldProductsSummary.length})
            </button>

            <button
              onClick={() => setActiveTab('stock_remaining')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all ${
                activeTab === 'stock_remaining'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              Realtime Stock Remaining ({products.length})
            </button>

            <button
              onClick={() => setActiveTab('sales_history')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all ${
                activeTab === 'sales_history'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              Sales Receipt Log ({sales.length})
            </button>

            <button
              onClick={() => setActiveTab('staff')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all ${
                activeTab === 'staff'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              Store Cashiers & Staff
            </button>
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by product or barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-orange-500 font-medium"
            />
          </div>
        </div>

        {/* TAB 1: TOTAL PRODUCTS SOLD WITH NAMES AND QUANTITY */}
        {activeTab === 'sold_products' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-orange-600" /> Total Sold Products Overview
                </h2>
                <p className="text-xs text-slate-600 font-medium">
                  Breakdown of all products sold across cash counters with total quantities and revenue.
                </p>
              </div>
            </div>

            {filteredSoldProducts.length === 0 ? (
              <div className="p-10 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                No products sold yet. When sales are processed at the cash counter, they appear here live.
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto max-h-[580px] overscroll-contain custom-scrollbar border border-slate-200 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-600 uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="p-3.5">Product Name</th>
                      <th className="p-3.5">Barcode</th>
                      <th className="p-3.5 text-center">Unit Price</th>
                      <th className="p-3.5 text-center">Quantity Sold</th>
                      <th className="p-3.5 text-right">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredSoldProducts.map((sp, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-orange-50 text-orange-600 text-xs flex items-center justify-center font-bold border border-orange-200">
                            #{idx + 1}
                          </span>
                          {sp.name}
                        </td>
                        <td className="p-3.5 text-slate-500 font-mono text-xs">
                          {sp.barcode}
                        </td>
                        <td className="p-3.5 text-center font-semibold text-slate-700">
                          Rs. {sp.lastPrice.toFixed(2)}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {sp.quantitySold} units
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-extrabold text-orange-600">
                          Rs. {sp.totalRevenue.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: REALTIME REMAINING STOCK */}
        {activeTab === 'stock_remaining' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" /> Realtime Stock Available & Remaining
                </h2>
                <p className="text-xs text-slate-600 font-medium">
                  Live inventory levels. When cashiers make sales or product registers add stock, numbers update automatically.
                </p>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="p-10 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                No products found in inventory. Product Registers can scan barcodes and add stock.
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto max-h-[580px] overscroll-contain custom-scrollbar border border-slate-200 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-600 uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="p-3.5">Product Name</th>
                      <th className="p-3.5">Barcode</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5 text-center">Price</th>
                      <th className="p-3.5 text-center">Stock Remaining</th>
                      <th className="p-3.5 text-center">Stock Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredProducts.map((p) => {
                      const isOutOfStock = p.stockQuantity <= 0;
                      const isLowStock = p.stockQuantity > 0 && p.stockQuantity <= (p.minStockLevel || 5);

                      return (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3.5 font-bold text-slate-900">
                            {p.name}
                          </td>
                          <td className="p-3.5 text-slate-500 font-mono text-xs">
                            {p.barcode}
                          </td>
                          <td className="p-3.5 text-slate-600 text-xs">
                            <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 font-medium border border-slate-200">
                              {p.category || 'General'}
                            </span>
                          </td>
                          <td className="p-3.5 text-center font-bold text-orange-600">
                            Rs. {p.price?.toFixed(2)}
                          </td>
                          <td className="p-3.5 text-center font-black text-lg">
                            <span className={isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-emerald-600'}>
                              {p.stockQuantity}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            {isOutOfStock ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-red-50 text-red-700 border border-red-200">
                                OUT OF STOCK
                              </span>
                            ) : isLowStock ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                                LOW STOCK
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                HEALTHY STOCK
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SALES HISTORY */}
        {activeTab === 'sales_history' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
              <Receipt className="w-5 h-5 text-emerald-600" /> Completed Checkout Receipts ({sales.length})
            </h2>

            {sales.length === 0 ? (
              <p className="text-sm text-slate-500 p-8 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50">
                No checkout transactions recorded yet.
              </p>
            ) : (
              <div className="space-y-3 max-h-[580px] overflow-y-auto overscroll-contain pr-1.5 custom-scrollbar">
                {sales.map((sale) => (
                  <div key={sale.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-sm">Receipt #{sale.receiptNumber}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          sale.paymentMethod === 'cash' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {sale.paymentMethod}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 font-medium">
                        Counter: <span className="text-slate-900 font-semibold">{sale.counterName}</span> ({sale.cashierUsername}) • {new Date(sale.timestamp).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Items: {sale.items?.map(i => `${i.name} (x${i.quantity})`).join(', ')}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                      <span className="text-lg font-extrabold text-orange-600">
                        Rs. {sale.totalAmount.toFixed(2)}
                      </span>
                      {onViewReceipt && (
                        <button
                          onClick={() => onViewReceipt(sale)}
                          className="px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-600 hover:text-white transition-all text-xs font-bold flex items-center gap-1 cursor-pointer shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Receipt
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: STORE STAFF */}
        {activeTab === 'staff' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
              <Calculator className="w-5 h-5 text-orange-600" /> Cashiers & Product Registers for {store.name}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {storeUsers.map((usr) => (
                <div key={usr.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900 text-sm">{usr.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      usr.role === 'admin' ? 'bg-orange-100 text-orange-800' :
                      usr.role === 'cash_counter' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {usr.role === 'admin' ? 'Store Admin' : usr.role === 'cash_counter' ? `Cash Counter #${usr.counterNumber}` : 'Product Register'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium">
                    Username: <span className="text-orange-700 font-mono font-bold">{usr.username}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
