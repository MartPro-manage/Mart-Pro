import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Calendar, 
  Download, 
  Eye, 
  RotateCcw, 
  Receipt, 
  CheckCircle2, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  CreditCard,
  Banknote,
  Smartphone,
  Landmark,
  X
} from 'lucide-react';
import { Sale, ProductReturn, HeldBill, Store, UserAccount } from '../../types';
import { db, doc, updateDoc, increment, setDoc, cleanFirestoreData } from '../../lib/firebase';

interface Screen7SalesOrdersProps {
  store: Store | null;
  currentUser: UserAccount | null;
  sales: Sale[];
  onViewReceipt: (sale: Sale) => void;
}

export const Screen7SalesOrders: React.FC<Screen7SalesOrdersProps> = ({
  store,
  currentUser,
  sales,
  onViewReceipt
}) => {
  const [activeTab, setActiveTab] = useState<'sales' | 'returns' | 'hold_bills' | 'orders'>('sales');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Return item modal state
  const [returnModalSale, setReturnModalSale] = useState<Sale | null>(null);
  const [returnReason, setReturnReason] = useState('Customer returned unused');

  // Filter sales
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const matchSearch = !searchQuery.trim() ||
        (s.billNumber && s.billNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.receiptNumber && s.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.paymentMode && s.paymentMode.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchSearch;
    });
  }, [sales, searchQuery]);

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage) || 1;
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSales.slice(start, start + itemsPerPage);
  }, [filteredSales, currentPage]);

  const handleExportCSV = () => {
    if (sales.length === 0) return;
    const headers = ['Bill Number', 'Date', 'Time', 'Items Count', 'Total (Rs)', 'Payment Method', 'Status'];
    const rows = sales.map(s => [
      s.billNumber || s.receiptNumber,
      s.timestamp?.slice(0, 10) || '2026-11-01',
      s.timestamp ? new Date(s.timestamp).toLocaleTimeString() : '',
      s.items?.length || 1,
      s.totalAmount,
      s.paymentMode || s.paymentMethod,
      s.status || 'Completed'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mart_pro_sales_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleProcessReturn = async (sale: Sale) => {
    if (!confirm(`Are you sure you want to process a full return for ${sale.billNumber || sale.receiptNumber}? Restocks inventory and records refund.`)) {
      return;
    }

    try {
      // 1. Mark sale as returned
      await updateDoc(doc(db, 'sales', sale.id), {
        status: 'returned',
        returnReason: returnReason,
        returnedAt: new Date().toISOString()
      });

      // 2. Restock items in inventory
      if (sale.items) {
        for (const it of sale.items) {
          if (it.productId) {
            try {
              await updateDoc(doc(db, 'products', it.productId), {
                stockQuantity: increment(it.quantity || 1),
                updatedAt: new Date().toISOString()
              });
            } catch (err) {
              console.warn('Restock err:', err);
            }
          }
        }
      }

      alert(`Return processed successfully for ${sale.billNumber || sale.receiptNumber}. Inventory restocked.`);
      setReturnModalSale(null);
    } catch (e) {
      console.error('Return err:', e);
      alert('Error processing return.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-5 bg-[#F8F9FA] custom-scrollbar select-none">
      {/* Top Header matching Screen 7 in reference image */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#111111] tracking-tight">
            Sales & Orders
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Real-time transaction registers, order history, and product return processing
          </p>
        </div>

        {/* Tab Pills matching mockup: Sales, Returns, Hold Bills, Orders */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-slate-200/90 shadow-2xs">
          {[
            { id: 'sales', label: 'Sales' },
            { id: 'returns', label: 'Returns' },
            { id: 'hold_bills', label: 'Hold Bills' },
            { id: 'orders', label: 'Orders' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#FF6500] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Date Bar matching Screen 7 in reference mockup */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by bill no. or payment method..."
            className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-semibold text-slate-900 pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500] transition-all"
          />
        </div>

        {/* Date Filter & Export Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F8F9FA] border border-slate-200 text-xs font-bold text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-[#FF6500]" />
            <span>Date: Nov 1, 2026 – Nov 1, 2026</span>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2 rounded-xl bg-[#FF6500] hover:bg-[#e65b00] active:scale-[0.98] text-white text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Main Table matching Screen 7 in mockup */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Bill #</th>
                <th className="py-3.5 px-4">Date & Time</th>
                <th className="py-3.5 px-4">Items</th>
                <th className="py-3.5 px-4">Total</th>
                <th className="py-3.5 px-4">Payment Method</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {paginatedSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                    No sales records found.
                  </td>
                </tr>
              ) : (
                paginatedSales.map((s) => {
                  const isReturned = s.status === 'returned';
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Bill # */}
                      <td className="py-3 px-4 font-black text-[#FF6500]">
                        {s.billNumber || `#${s.receiptNumber}`}
                      </td>

                      {/* Date & Time */}
                      <td className="py-3 px-4 text-slate-500 font-medium text-[11px]">
                        {s.timestamp?.includes('T')
                          ? new Date(s.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : s.timestamp}
                      </td>

                      {/* Items */}
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {s.items?.length || 2} Items
                      </td>

                      {/* Total */}
                      <td className="py-3 px-4 font-black text-slate-900">
                        Rs. {(s.totalAmount || 0).toLocaleString()}
                      </td>

                      {/* Payment Method Badge */}
                      <td className="py-3 px-4 font-bold capitalize text-slate-700">
                        {s.paymentMode || s.paymentMethod || 'Cash'}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {isReturned ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-50 text-red-700 border border-red-200">
                            Returned
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Completed
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => onViewReceipt(s)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-orange-50 hover:text-[#FF6500] text-slate-600 transition-colors cursor-pointer"
                            title="View Receipt"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {!isReturned && (
                            <button
                              onClick={() => setReturnModalSale(s)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 transition-colors cursor-pointer"
                              title="Process Return / Refund"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer matching Screen 7 in mockup */}
        <div className="px-5 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-semibold">
          <div>
            Showing {filteredSales.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{' '}
            {Math.min(currentPage * itemsPerPage, filteredSales.length)} of {filteredSales.length}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }).map((_, i) => {
              const pNum = i + 1;
              const isActive = currentPage === pNum;
              return (
                <button
                  key={pNum}
                  onClick={() => setCurrentPage(pNum)}
                  className={`w-7 h-7 rounded-lg font-bold text-xs cursor-pointer ${
                    isActive
                      ? 'bg-[#FF6500] text-white shadow-xs'
                      : 'border border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {pNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Return Modal */}
      {returnModalSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">
                Process Return: {returnModalSale.billNumber || returnModalSale.receiptNumber}
              </h3>
              <button
                onClick={() => setReturnModalSale(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-xs font-semibold text-orange-950">
              Total Refund Amount: <span className="font-black text-[#FF6500]">Rs. {returnModalSale.totalAmount.toLocaleString()}</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Reason for Return
              </label>
              <textarea
                rows={2}
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-medium text-slate-900 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setReturnModalSale(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleProcessReturn(returnModalSale)}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-md cursor-pointer"
              >
                Confirm Return & Restock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
