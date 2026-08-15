import React, { useState, useEffect, useMemo } from 'react';
import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  where, 
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
  Layers,
  Calendar,
  CalendarDays,
  Clock,
  Filter,
  Check,
  RotateCcw,
  CreditCard,
  Banknote,
  ChevronRight,
  ArrowDownRight,
  Tag
} from 'lucide-react';

interface StoreAdminDashboardProps {
  store: Store;
  currentUser: UserAccount;
  onNavigateToPOS?: () => void;
  onNavigateToInventory?: () => void;
  onViewReceipt?: (sale: Sale) => void;
}

type DateFilterType = 'all' | 'today' | 'yesterday' | 'last_7_days' | 'this_month' | 'custom_single' | 'custom_range';

// Helper to get YYYY-MM-DD from an ISO string or Date in local time
function getLocalDateString(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to format display date (e.g. "Sat, 15 Aug 2026")
function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts.map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
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
  const [activeTab, setActiveTab] = useState<'sales_by_date' | 'sold_products' | 'stock_remaining' | 'sales_history' | 'staff'>('sales_by_date');

  // Date Filtering State
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [selectedSingleDate, setSelectedSingleDate] = useState<string>(todayStr);
  const [customStartDate, setCustomStartDate] = useState<string>(todayStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // Selected date for deep inspection in Sales by Date tab
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

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
      // Sort sales by timestamp descending (newest first)
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

  // Compute yesterday string
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateString(d);
  }, []);

  // Filter Sales according to selected Date Range
  const filteredSalesByDate = useMemo(() => {
    if (dateFilter === 'all') return sales;

    const now = new Date();

    if (dateFilter === 'today') {
      return sales.filter(s => getLocalDateString(s.timestamp) === todayStr);
    }

    if (dateFilter === 'yesterday') {
      return sales.filter(s => getLocalDateString(s.timestamp) === yesterdayStr);
    }

    if (dateFilter === 'last_7_days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      return sales.filter(s => new Date(s.timestamp) >= sevenDaysAgo);
    }

    if (dateFilter === 'this_month') {
      const curYear = now.getFullYear();
      const curMonth = now.getMonth();
      return sales.filter(s => {
        const d = new Date(s.timestamp);
        return d.getFullYear() === curYear && d.getMonth() === curMonth;
      });
    }

    if (dateFilter === 'custom_single') {
      return sales.filter(s => getLocalDateString(s.timestamp) === selectedSingleDate);
    }

    if (dateFilter === 'custom_range') {
      return sales.filter(s => {
        const saleDate = getLocalDateString(s.timestamp);
        return saleDate >= customStartDate && saleDate <= customEndDate;
      });
    }

    return sales;
  }, [sales, dateFilter, todayStr, yesterdayStr, selectedSingleDate, customStartDate, customEndDate]);

  // Daily Sales Grouping (Day-by-Day Breakdown)
  const dailySalesBreakdown = useMemo(() => {
    const dateMap: { 
      [dateKey: string]: {
        date: string;
        formattedDate: string;
        totalRevenue: number;
        totalInvoices: number;
        totalUnitsSold: number;
        cashRevenue: number;
        onlineRevenue: number;
        totalDiscount: number;
        sales: Sale[];
      }
    } = {};

    sales.forEach((sale) => {
      const dateKey = getLocalDateString(sale.timestamp) || 'Unknown Date';
      if (!dateMap[dateKey]) {
        dateMap[dateKey] = {
          date: dateKey,
          formattedDate: formatDisplayDate(dateKey),
          totalRevenue: 0,
          totalInvoices: 0,
          totalUnitsSold: 0,
          cashRevenue: 0,
          onlineRevenue: 0,
          totalDiscount: 0,
          sales: []
        };
      }

      dateMap[dateKey].totalInvoices += 1;
      dateMap[dateKey].totalRevenue += (sale.totalAmount || 0);
      dateMap[dateKey].totalDiscount += (sale.discountAmount || 0);

      if (sale.paymentMethod === 'online') {
        dateMap[dateKey].onlineRevenue += (sale.totalAmount || 0);
      } else {
        dateMap[dateKey].cashRevenue += (sale.totalAmount || 0);
      }

      const unitsInSale = sale.items?.reduce((u, item) => u + (item.quantity || 0), 0) || 0;
      dateMap[dateKey].totalUnitsSold += unitsInSale;
      dateMap[dateKey].sales.push(sale);
    });

    // Sort descending by date
    return Object.values(dateMap).sort((a, b) => b.date.localeCompare(a.date));
  }, [sales]);

  // Compute Aggregations for Active Date Filter
  const filteredRevenue = useMemo(() => {
    return filteredSalesByDate.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  }, [filteredSalesByDate]);

  const filteredItemsSoldQuantity = useMemo(() => {
    return filteredSalesByDate.reduce((sum, sale) => {
      const itemsCount = sale.items?.reduce((iSum, item) => iSum + (item.quantity || 0), 0) || 0;
      return sum + itemsCount;
    }, 0);
  }, [filteredSalesByDate]);

  const filteredDiscounts = useMemo(() => {
    return filteredSalesByDate.reduce((sum, s) => sum + (s.discountAmount || 0), 0);
  }, [filteredSalesByDate]);

  // Aggregate Sold Products for Active Date Filter
  const soldProductsSummary = useMemo(() => {
    const summaryMap: { [barcodeOrId: string]: { barcode: string; name: string; quantitySold: number; totalRevenue: number; lastPrice: number } } = {};

    filteredSalesByDate.forEach((sale) => {
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
  }, [filteredSalesByDate]);

  // Low stock products count
  const lowStockCount = useMemo(() => {
    return products.filter(p => p.stockQuantity <= (p.minStockLevel || 5)).length;
  }, [products]);

  // Filtered sold products by search query
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

  // Filtered sales receipts by search query
  const filteredReceipts = useMemo(() => {
    if (!searchTerm.trim()) return filteredSalesByDate;
    const term = searchTerm.toLowerCase();
    return filteredSalesByDate.filter((s) => 
      s.receiptNumber.toLowerCase().includes(term) ||
      (s.counterName && s.counterName.toLowerCase().includes(term)) ||
      (s.cashierUsername && s.cashierUsername.toLowerCase().includes(term)) ||
      s.items?.some(i => i.name.toLowerCase().includes(term) || i.barcode.toLowerCase().includes(term))
    );
  }, [filteredSalesByDate, searchTerm]);

  // Text label describing active date filter
  const activeDateFilterLabel = useMemo(() => {
    switch (dateFilter) {
      case 'today':
        return `Today (${formatDisplayDate(todayStr)})`;
      case 'yesterday':
        return `Yesterday (${formatDisplayDate(yesterdayStr)})`;
      case 'last_7_days':
        return 'Last 7 Days';
      case 'this_month':
        return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'custom_single':
        return formatDisplayDate(selectedSingleDate);
      case 'custom_range':
        return `${formatDisplayDate(customStartDate)} to ${formatDisplayDate(customEndDate)}`;
      case 'all':
      default:
        return 'All Time (Lifetime History)';
    }
  }, [dateFilter, todayStr, yesterdayStr, selectedSingleDate, customStartDate, customEndDate]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

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
              {store.name} <span className="text-orange-600">Analytics & Sales Reports</span>
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl font-medium">
              View sales filtered by date, day-by-day revenue breakdown, product sales velocity, real-time inventory levels, and cashier checkout logs.
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

        {/* DATE FILTERING CONTROL TOOLBAR */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <span>Filter Sales By Date</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-orange-100 text-orange-800 border border-orange-200">
                    {activeDateFilterLabel}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Select any date or range to analyze sales revenue, transactions count, and sold items for that specific period.
                </p>
              </div>
            </div>

            {dateFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setDateFilter('all')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors self-start md:self-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Show All Time Sales
              </button>
            )}
          </div>

          {/* Quick Preset Buttons & Date Pickers */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDateFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                dateFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              All Time
            </button>

            <button
              type="button"
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                dateFilter === 'today'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Today
            </button>

            <button
              type="button"
              onClick={() => setDateFilter('yesterday')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                dateFilter === 'yesterday'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Yesterday
            </button>

            <button
              type="button"
              onClick={() => setDateFilter('last_7_days')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                dateFilter === 'last_7_days'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Last 7 Days
            </button>

            <button
              type="button"
              onClick={() => setDateFilter('this_month')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                dateFilter === 'this_month'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              This Month
            </button>

            <button
              type="button"
              onClick={() => setDateFilter('custom_single')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                dateFilter === 'custom_single'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" /> Specific Date
            </button>

            <button
              type="button"
              onClick={() => setDateFilter('custom_range')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                dateFilter === 'custom_range'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Date Range
            </button>
          </div>

          {/* SPECIFIC DATE INPUT */}
          {dateFilter === 'custom_single' && (
            <div className="flex items-center gap-3 bg-orange-50/70 p-3 rounded-xl border border-orange-200 animate-fade-in flex-wrap">
              <span className="text-xs font-bold text-orange-950 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-orange-600" /> Select Date:
              </span>
              <input
                type="date"
                value={selectedSingleDate}
                onChange={(e) => setSelectedSingleDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500 shadow-xs"
              />
              <span className="text-xs text-orange-800 font-medium">
                Viewing sales for: <strong>{formatDisplayDate(selectedSingleDate)}</strong>
              </span>
            </div>
          )}

          {/* CUSTOM DATE RANGE INPUTS */}
          {dateFilter === 'custom_range' && (
            <div className="flex items-center gap-3 bg-orange-50/70 p-3 rounded-xl border border-orange-200 animate-fade-in flex-wrap">
              <span className="text-xs font-bold text-orange-950 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-orange-600" /> From:
              </span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500 shadow-xs"
              />
              <span className="text-xs font-bold text-orange-950">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500 shadow-xs"
              />
              <span className="text-xs text-orange-800 font-medium">
                ({formatDisplayDate(customStartDate)} – {formatDisplayDate(customEndDate)})
              </span>
            </div>
          )}
        </div>

        {/* DYNAMIC REALTIME METRICS CARDS (Adjusts to selected Date Filter) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Revenue for Date */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {dateFilter === 'all' ? 'Total Sales Revenue' : 'Sales Revenue (Filtered Date)'}
              </span>
              <div className="p-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-200 font-bold text-xs">
                <span>PKR</span>
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900">
              Rs. {filteredRevenue.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> From {filteredSalesByDate.length} completed transactions
            </p>
          </div>

          {/* Sold Products Quantity for Date */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {dateFilter === 'all' ? 'Total Units Sold' : 'Units Sold (Filtered Date)'}
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-emerald-600">
              {filteredItemsSoldQuantity.toLocaleString()} <span className="text-xs text-slate-500 font-normal">items</span>
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

          {/* Low Stock Warning or Total Discounts */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {filteredDiscounts > 0 ? 'Discounts Given' : 'Low Stock Alerts'}
              </span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                {filteredDiscounts > 0 ? <Tag className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-amber-600">
              {filteredDiscounts > 0 ? (
                <>Rs. {filteredDiscounts.toFixed(2)}</>
              ) : (
                <>{lowStockCount} <span className="text-xs text-slate-500 font-normal">items critical</span></>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              {filteredDiscounts > 0 ? `Savings given to customers` : `Stock ≤ 5 units remaining`}
            </p>
          </div>

        </div>

        {/* Tab Selection & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('sales_by_date')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all flex items-center gap-1.5 ${
                activeTab === 'sales_by_date'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <CalendarDays className="w-4 h-4" /> Sales by Date ({dailySalesBreakdown.length} Days)
            </button>

            <button
              onClick={() => setActiveTab('sold_products')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all ${
                activeTab === 'sold_products'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              Sold Products Breakdown ({soldProductsSummary.length})
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
              Receipts Log ({filteredSalesByDate.length})
            </button>

            <button
              onClick={() => setActiveTab('staff')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all ${
                activeTab === 'staff'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              Store Staff ({storeUsers.length})
            </button>
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter products or receipt #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-orange-500 font-medium"
            />
          </div>
        </div>

        {/* TAB 1: SALES BY DATE - DAY BY DAY BREAKDOWN TABLE */}
        {activeTab === 'sales_by_date' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-orange-600" /> Day-by-Day Sales Breakdown
                </h2>
                <p className="text-xs text-slate-600 font-medium">
                  Summary of total revenue, transactions count, units sold, and payment methods for every date.
                </p>
              </div>

              <div className="text-xs text-slate-500 font-medium bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                Total Days with Sales: <strong className="text-slate-900">{dailySalesBreakdown.length}</strong>
              </div>
            </div>

            {dailySalesBreakdown.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
                <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-bold text-slate-700">No Sales Recorded Yet</p>
                <p className="text-xs text-slate-500">Sales completed at cash counters will be grouped and displayed by date here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-600 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="p-3.5">Date</th>
                        <th className="p-3.5 text-center">Invoices / Orders</th>
                        <th className="p-3.5 text-center">Items Sold</th>
                        <th className="p-3.5 text-center">Payment Split</th>
                        <th className="p-3.5 text-right">Discount</th>
                        <th className="p-3.5 text-right">Total Revenue</th>
                        <th className="p-3.5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {dailySalesBreakdown.map((daySummary) => {
                        const isToday = daySummary.date === todayStr;
                        const isYesterday = daySummary.date === yesterdayStr;
                        const isExpanded = expandedDate === daySummary.date;

                        return (
                          <React.Fragment key={daySummary.date}>
                            <tr className={`hover:bg-orange-50/40 transition-colors ${isExpanded ? 'bg-orange-50/60' : ''}`}>
                              <td className="p-3.5">
                                <div className="flex items-center gap-2">
                                  <div className="font-extrabold text-slate-900 text-sm">
                                    {daySummary.formattedDate}
                                  </div>
                                  {isToday && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      TODAY
                                    </span>
                                  )}
                                  {isYesterday && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                      YESTERDAY
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                  {daySummary.date}
                                </div>
                              </td>

                              <td className="p-3.5 text-center">
                                <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-slate-100 text-slate-800">
                                  {daySummary.totalInvoices} {daySummary.totalInvoices === 1 ? 'order' : 'orders'}
                                </span>
                              </td>

                              <td className="p-3.5 text-center font-bold text-slate-700">
                                {daySummary.totalUnitsSold} units
                              </td>

                              <td className="p-3.5 text-center text-xs">
                                <div className="flex items-center justify-center gap-2">
                                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold" title="Cash Revenue">
                                    Cash: Rs. {daySummary.cashRevenue.toFixed(0)}
                                  </span>
                                  {daySummary.onlineRevenue > 0 && (
                                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-bold" title="Online Revenue">
                                      Online: Rs. {daySummary.onlineRevenue.toFixed(0)}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="p-3.5 text-right font-medium text-slate-600 text-xs">
                                {daySummary.totalDiscount > 0 ? (
                                  <span className="text-amber-700 font-bold">-Rs. {daySummary.totalDiscount.toFixed(2)}</span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>

                              <td className="p-3.5 text-right">
                                <span className="text-base font-black text-orange-600">
                                  Rs. {daySummary.totalRevenue.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </td>

                              <td className="p-3.5 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedDate(isExpanded ? null : daySummary.date)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1 ${
                                      isExpanded
                                        ? 'bg-orange-600 text-white shadow-xs'
                                        : 'bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200'
                                    }`}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    {isExpanded ? 'Hide Invoices' : `View ${daySummary.totalInvoices} Invoices`}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDateFilter('custom_single');
                                      setSelectedSingleDate(daySummary.date);
                                      setActiveTab('sales_history');
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
                                    title="Drill down to receipt log for this date"
                                  >
                                    Filter History →
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* EXPANDED INVOICES LIST FOR THIS DATE */}
                            {isExpanded && (
                              <tr className="bg-slate-50/90 border-b border-orange-200">
                                <td colSpan={7} className="p-4 sm:p-6">
                                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                        <Receipt className="w-4 h-4 text-orange-600" />
                                        Invoices Issued on {daySummary.formattedDate} ({daySummary.sales.length} transactions)
                                      </h4>
                                      <span className="text-xs font-black text-orange-600">
                                        Daily Total: Rs. {daySummary.totalRevenue.toFixed(2)}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto overscroll-contain pr-1 custom-scrollbar">
                                      {daySummary.sales.map((sale) => (
                                        <div key={sale.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-orange-50/30 transition-colors flex items-center justify-between gap-3">
                                          <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                              <span className="font-extrabold text-xs text-slate-900">#{sale.receiptNumber}</span>
                                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                                                sale.paymentMethod === 'cash' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                                              }`}>
                                                {sale.paymentMethod}
                                              </span>
                                            </div>
                                            <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                              {sale.counterName} ({sale.cashierUsername}) • {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <div className="text-[10px] text-slate-600 font-medium truncate mt-0.5">
                                              {sale.items?.map(i => `${i.name} (x${i.quantity})`).join(', ')}
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-2 shrink-0">
                                            <div className="text-right">
                                              <div className="font-extrabold text-orange-600 text-xs">Rs. {sale.totalAmount.toFixed(2)}</div>
                                              {sale.discountAmount && sale.discountAmount > 0 ? (
                                                <div className="text-[9px] text-amber-700 font-bold">-Rs. {sale.discountAmount.toFixed(0)} off</div>
                                              ) : null}
                                            </div>
                                            {onViewReceipt && (
                                              <button
                                                type="button"
                                                onClick={() => onViewReceipt(sale)}
                                                className="p-1.5 bg-orange-50 hover:bg-orange-600 text-orange-700 hover:text-white rounded-lg border border-orange-200 transition-colors cursor-pointer"
                                                title="View Full Receipt"
                                              >
                                                <Eye className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TOTAL PRODUCTS SOLD WITH NAMES AND QUANTITY (FILTERED BY DATE) */}
        {activeTab === 'sold_products' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-orange-600" /> Products Sold Velocity Breakdown
                </h2>
                <p className="text-xs text-slate-600 font-medium">
                  Showing sold items for: <strong className="text-orange-700">{activeDateFilterLabel}</strong>
                </p>
              </div>

              <span className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                {filteredSoldProducts.length} Distinct Products Sold
              </span>
            </div>

            {filteredSoldProducts.length === 0 ? (
              <div className="p-10 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                No products sold during the selected date range ({activeDateFilterLabel}).
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

        {/* TAB 3: REALTIME REMAINING STOCK */}
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

        {/* TAB 4: SALES HISTORY (FILTERED BY SELECTED DATE) */}
        {activeTab === 'sales_history' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-600" /> Completed Checkout Receipts Log
                </h2>
                <p className="text-xs text-slate-600 font-medium">
                  Showing receipts for: <strong className="text-orange-700">{activeDateFilterLabel}</strong>
                </p>
              </div>

              <span className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                {filteredReceipts.length} Receipts
              </span>
            </div>

            {filteredReceipts.length === 0 ? (
              <p className="text-sm text-slate-500 p-8 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50">
                No checkout transactions recorded for {activeDateFilterLabel}.
              </p>
            ) : (
              <div className="space-y-3 max-h-[580px] overflow-y-auto overscroll-contain pr-1.5 custom-scrollbar">
                {filteredReceipts.map((sale) => (
                  <div key={sale.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-sm">Receipt #{sale.receiptNumber}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          sale.paymentMethod === 'cash' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {sale.paymentMethod}
                        </span>
                        {sale.discountAmount && sale.discountAmount > 0 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Discount -Rs. {sale.discountAmount.toFixed(2)}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-600 mt-1 font-medium">
                        Counter: <span className="text-slate-900 font-semibold">{sale.counterName}</span> ({sale.cashierUsername}) • <span className="text-orange-700 font-bold">{new Date(sale.timestamp).toLocaleString()}</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Items ({sale.items?.reduce((s, i) => s + i.quantity, 0)}): {sale.items?.map(i => `${i.name} (x${i.quantity})`).join(', ')}
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

        {/* TAB 5: STORE STAFF */}
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
