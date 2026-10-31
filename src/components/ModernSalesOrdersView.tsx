import React, { useState, useMemo } from 'react';
import { 
  Receipt, 
  ShoppingBag, 
  Calendar, 
  Download, 
  Search, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  Eye,
  Store as StoreIcon,
  CreditCard
} from 'lucide-react';
import { Sale, Store, UserAccount, OnlineOrder } from '../types';

interface ModernSalesOrdersViewProps {
  store: Store;
  currentUser: UserAccount;
  sales: Sale[];
  onlineOrders?: OnlineOrder[];
  onViewReceipt: (sale: Sale) => void;
  allStores?: Store[];
}

export const ModernSalesOrdersView: React.FC<ModernSalesOrdersViewProps> = ({
  store,
  currentUser,
  sales,
  onlineOrders = [],
  onViewReceipt,
  allStores = []
}) => {
  const [activeTab, setActiveTab] = useState<'sales' | 'orders'>('sales');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('all');
  const [selectedStoreId, setSelectedStoreId] = useState('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Filter Sales
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const matchesSearch = !searchQuery || 
        (s.receiptNumber && s.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.id && s.id.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.cashierUsername && s.cashierUsername.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesPayment = selectedPaymentMethod === 'all' || 
        (s.paymentMethod && s.paymentMethod.toLowerCase() === selectedPaymentMethod.toLowerCase());

      const matchesStore = selectedStoreId === 'all' || s.storeId === selectedStoreId;

      let matchesDate = true;
      if (dateRange === 'today') {
        const today = new Date().toISOString().split('T')[0];
        matchesDate = s.timestamp.startsWith(today);
      } else if (dateRange === '7d') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        matchesDate = new Date(s.timestamp) >= d;
      } else if (dateRange === '30d') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        matchesDate = new Date(s.timestamp) >= d;
      }

      return matchesSearch && matchesPayment && matchesStore && matchesDate;
    });
  }, [sales, searchQuery, selectedPaymentMethod, selectedStoreId, dateRange]);

  const totalPages = Math.ceil((activeTab === 'sales' ? filteredSales.length : onlineOrders.length) / itemsPerPage) || 1;
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSales.slice(start, start + itemsPerPage);
  }, [filteredSales, currentPage]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return onlineOrders.slice(start, start + itemsPerPage);
  }, [onlineOrders, currentPage]);

  // Export to CSV
  const handleExportCSV = () => {
    const rows = activeTab === 'sales' ? filteredSales : onlineOrders;
    if (rows.length === 0) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    if (activeTab === 'sales') {
      csvContent += 'Receipt Number,Date,Items,Total Amount,Payment Method,Cashier\n';
      filteredSales.forEach(s => {
        csvContent += `"${s.receiptNumber || s.id}","${s.timestamp}","${s.items?.length || 0}","${s.totalAmount}","${s.paymentMethod || 'cash'}","${s.cashierUsername || ''}"\n`;
      });
    } else {
      csvContent += 'Order Number,Customer Name,Phone,Total Amount,Status,Date\n';
      onlineOrders.forEach(o => {
        csvContent += `"${o.orderNumber || o.id}","${o.customerName}","${o.customerPhone}","${o.totalAmount}","${o.status || 'Completed'}","${o.createdAt}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${activeTab}_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header with Sub-tabs (matching Screen 4 showcase) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Sales & Orders
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Audit customer checkout receipts, online delivery orders, and payment reconciliations.
          </p>
        </div>

        {/* Sub-tabs: Sales | Orders (matching Screen 4 showcase) */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('sales');
              setCurrentPage(1);
            }}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'sales'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sales
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('orders');
              setCurrentPage(1);
            }}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Orders
          </button>
        </div>
      </div>

      {/* Filter Bar (matching Screen 4 showcase) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by receipt # or cashier..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 font-medium"
          />
        </div>

        {/* Filters Group */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Date Range Filter */}
          <select
            value={dateRange}
            onChange={e => {
              setDateRange(e.target.value as any);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>

          {/* Payment Method Filter */}
          <select
            value={selectedPaymentMethod}
            onChange={e => {
              setSelectedPaymentMethod(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="all">All Payment Methods</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="jazzcash">JazzCash</option>
            <option value="easypaisa">EasyPaisa</option>
          </select>

          {/* Export Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white hover:bg-orange-50 text-orange-600 border border-orange-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Table (matching Screen 4 showcase) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'sales' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 font-bold">Bill #</th>
                  <th className="py-3 px-4 font-bold">Date & Time</th>
                  <th className="py-3 px-4 font-bold">Items</th>
                  <th className="py-3 px-4 font-bold">Total Amount</th>
                  <th className="py-3 px-4 font-bold">Payment Method</th>
                  <th className="py-3 px-4 font-bold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedSales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                      <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-500" />
                      <span>No sales records found.</span>
                    </td>
                  </tr>
                ) : (
                  paginatedSales.map(sale => (
                    <tr
                      key={sale.id}
                      onClick={() => onViewReceipt(sale)}
                      className="hover:bg-orange-50/50 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 group-hover:text-orange-600">
                        #{sale.receiptNumber || sale.id.slice(0, 8)}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(sale.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {sale.items?.length || 0}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">
                        Rs. {sale.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium capitalize">
                        {sale.paymentMethod || 'Cash'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200/60">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Completed</span>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 font-bold">Order #</th>
                  <th className="py-3 px-4 font-bold">Customer Name</th>
                  <th className="py-3 px-4 font-bold">Phone</th>
                  <th className="py-3 px-4 font-bold">Date</th>
                  <th className="py-3 px-4 font-bold">Total Amount</th>
                  <th className="py-3 px-4 font-bold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                      <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-500" />
                      <span>No online orders received yet.</span>
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        #{order.orderNumber || order.id.slice(0, 8)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {order.customerName}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        {order.customerPhone}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">
                        Rs. {order.totalAmount?.toFixed(2) || '0.00'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200/60">
                          <span>{order.status || 'Received'}</span>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
          <div>
            Showing <strong className="text-slate-800">{activeTab === 'sales' ? (paginatedSales.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0) : (paginatedOrders.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0)}</strong> to{' '}
            <strong className="text-slate-800">{activeTab === 'sales' ? Math.min(currentPage * itemsPerPage, filteredSales.length) : Math.min(currentPage * itemsPerPage, onlineOrders.length)}</strong> of{' '}
            <strong className="text-slate-800">{activeTab === 'sales' ? filteredSales.length : onlineOrders.length}</strong> records
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 bg-orange-600 text-white rounded-lg font-bold text-xs shadow-xs">
              {currentPage}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
