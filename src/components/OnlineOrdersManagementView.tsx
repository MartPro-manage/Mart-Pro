import React, { useState, useEffect, useMemo } from 'react';
import { 
  Globe, 
  ShoppingBag, 
  Clock, 
  Truck, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Filter, 
  Phone, 
  MapPin, 
  User, 
  ExternalLink, 
  DollarSign, 
  Package, 
  Receipt,
  AlertCircle
} from 'lucide-react';
import { Store, OnlineOrder } from '../types';
import { db, collection, query, where, onSnapshot, updateDoc, doc } from '../lib/firebase';
import { playScanSuccessBeep } from '../lib/sound';

interface OnlineOrdersManagementViewProps {
  store: Store;
  onOpenCustomerStore: () => void;
  onViewReceipt?: (order: OnlineOrder) => void;
}

export const OnlineOrdersManagementView: React.FC<OnlineOrdersManagementViewProps> = ({
  store,
  onOpenCustomerStore
}) => {
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OnlineOrder | null>(null);

  useEffect(() => {
    if (!store?.id) return;

    const q = query(
      collection(db, 'online_orders'),
      where('storeId', '==', store.id)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: OnlineOrder[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as OnlineOrder);
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(list);
    }, (err) => {
      console.warn('Error fetching online orders:', err);
    });

    return () => unsub();
  }, [store?.id]);

  const stats = useMemo(() => {
    const totalCount = orders.length;
    const pendingCount = orders.filter(o => o.status === 'pending').length;
    const processingCount = orders.filter(o => o.status === 'processing').length;
    const deliveredCount = orders.filter(o => o.status === 'delivered').length;
    const totalRevenue = orders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    return { totalCount, pendingCount, processingCount, deliveredCount, totalRevenue };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (statusFilter !== 'all') {
      list = list.filter(o => o.status === statusFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(o => 
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q) ||
        (o.deliveryAddress && o.deliveryAddress.toLowerCase().includes(q))
      );
    }
    return list;
  }, [orders, statusFilter, searchTerm]);

  const handleUpdateOrderStatus = async (orderId: string, newStatus: OnlineOrder['status']) => {
    try {
      const orderRef = doc(db, 'online_orders', orderId);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      playScanSuccessBeep();
    } catch (err) {
      console.error('Failed to update order status:', err);
      alert('Failed to update order status. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Launch E-Shop Button */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-600 rounded-3xl p-6 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
            <Globe className="w-3.5 h-3.5" /> H A Mart Online Store Section
          </div>
          <h2 className="text-xl md:text-2xl font-black">Customer Online Orders & Web Storefront</h2>
          <p className="text-xs md:text-sm text-orange-100 max-w-xl">
            All customer orders placed through your online store website appear here in real-time. Process orders, dispatch shipments, and track online revenue.
          </p>
        </div>

        <button
          onClick={onOpenCustomerStore}
          className="px-6 py-3.5 bg-slate-900 hover:bg-slate-950 text-white rounded-2xl font-black text-xs md:text-sm flex items-center gap-2.5 shadow-xl transition-all cursor-pointer shrink-0 hover:scale-105"
        >
          <ExternalLink className="w-4 h-4 text-orange-400" /> Launch Customer Online Store
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-slate-500 block">Total Online Orders</span>
          <div className="text-xl font-black text-slate-900 font-mono">{stats.totalCount}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-amber-600 block">Pending Orders</span>
          <div className="text-xl font-black text-amber-600 font-mono">{stats.pendingCount}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-emerald-600 block">Delivered Orders</span>
          <div className="text-xl font-black text-emerald-600 font-mono">{stats.deliveredCount}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-blue-600 block">Online Revenue</span>
          <div className="text-xl font-black text-blue-600 font-mono">{store.currencySymbol || 'Rs.'} {stats.totalRevenue.toLocaleString()}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search order #, customer name, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-orange-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          {[
            { id: 'all', label: 'All Orders' },
            { id: 'pending', label: 'Pending' },
            { id: 'processing', label: 'Processing' },
            { id: 'shipped', label: 'Shipped' },
            { id: 'delivered', label: 'Delivered' },
            { id: 'cancelled', label: 'Cancelled' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List / Cards */}
      <div className="space-y-4">
        {filteredOrders.map((ord) => {
          const statusColors = {
            pending: 'bg-amber-100 text-amber-800 border-amber-300',
            processing: 'bg-blue-100 text-blue-800 border-blue-300',
            shipped: 'bg-purple-100 text-purple-800 border-purple-300',
            delivered: 'bg-emerald-100 text-emerald-800 border-emerald-300',
            cancelled: 'bg-red-100 text-red-800 border-red-300'
          }[ord.status] || 'bg-slate-100 text-slate-800';

          return (
            <div key={ord.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 hover:border-orange-300 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-black text-orange-600 bg-orange-50 px-3 py-1 rounded-xl border border-orange-200">
                    {ord.orderNumber}
                  </span>
                  <span className={`text-[10px] uppercase tracking-wider font-black px-2.5 py-1 rounded-full border ${statusColors}`}>
                    {ord.status}
                  </span>
                </div>
                <span className="text-xs font-medium text-slate-400">
                  {new Date(ord.createdAt).toLocaleString()}
                </span>
              </div>

              {/* Customer & Delivery Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer Details</span>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-orange-600" /> {ord.customerName}
                  </div>
                  <div className="font-medium text-slate-600 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {ord.customerPhone}
                  </div>
                </div>

                <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fulfillment & Payment</span>
                  <div className="font-bold text-slate-900 capitalize flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-blue-600" /> {ord.deliveryType === 'delivery' ? 'Home Delivery' : 'Store Pickup'}
                  </div>
                  <div className="font-medium text-slate-600 uppercase">
                    Payment: {ord.paymentMethod === 'cod' ? 'Cash on Delivery' : `Online (${ord.paymentProvider})`}
                  </div>
                </div>

                <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Delivery Address</span>
                  <div className="font-medium text-slate-700 flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{ord.deliveryAddress}</span>
                  </div>
                </div>
              </div>

              {/* Ordered Items Summary */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-500 block">Ordered Items ({ord.items.length}):</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {ord.items.map((item, idx) => (
                    <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 truncate max-w-[160px]">{item.name}</span>
                      <span className="font-bold text-orange-600 font-mono">
                        {item.quantity} × {store.currencySymbol || 'Rs.'} {item.price}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Total & Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-500 font-medium">Subtotal: {store.currencySymbol || 'Rs.'} {ord.subtotalAmount.toLocaleString()} + Delivery: {store.currencySymbol || 'Rs.'} {ord.deliveryFee}</span>
                  <span className="text-sm font-black text-slate-900 font-mono">
                    Total: {store.currencySymbol || 'Rs.'} {ord.totalAmount.toLocaleString()}
                  </span>
                </div>

                {/* Status Update Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {ord.status === 'pending' && (
                    <button
                      onClick={() => handleUpdateOrderStatus(ord.id, 'processing')}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                    >
                      Accept & Process
                    </button>
                  )}
                  {ord.status === 'processing' && (
                    <button
                      onClick={() => handleUpdateOrderStatus(ord.id, 'shipped')}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                    >
                      Mark Shipped
                    </button>
                  )}
                  {(ord.status === 'processing' || ord.status === 'shipped') && (
                    <button
                      onClick={() => handleUpdateOrderStatus(ord.id, 'delivered')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                    >
                      Mark Delivered
                    </button>
                  )}
                  {ord.status !== 'cancelled' && ord.status !== 'delivered' && (
                    <button
                      onClick={() => handleUpdateOrderStatus(ord.id, 'cancelled')}
                      className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Cancel Order
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedOrder(ord)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Receipt className="w-3.5 h-3.5" /> View Slip
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredOrders.length === 0 && (
          <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 space-y-3">
            <Globe className="w-12 h-12 text-slate-400 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No online store orders found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Orders placed by customers on your online store website will appear here instantly. Click "Launch Customer Online Store" above to test placing an order!
            </p>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-orange-600" />
                <h3 className="text-sm font-black text-slate-900">Online Order #{selectedOrder.orderNumber}</h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between font-bold text-slate-600">
                <span>Customer:</span>
                <span className="text-slate-900">{selectedOrder.customerName}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-600">
                <span>Phone:</span>
                <span className="text-slate-900">{selectedOrder.customerPhone}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-600">
                <span>Delivery Address:</span>
                <span className="text-slate-900 text-right max-w-[200px]">{selectedOrder.deliveryAddress}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-600">
                <span>Status:</span>
                <span className="uppercase text-orange-600 font-black">{selectedOrder.status}</span>
              </div>

              <div className="border-t border-slate-100 pt-2 space-y-2">
                <span className="font-bold text-slate-500 block">Items Ordered:</span>
                {selectedOrder.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between text-slate-700">
                    <span>{i.name} (×{i.quantity})</span>
                    <span className="font-mono font-bold">{store.currencySymbol || 'Rs.'} {i.total}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-100 pt-2 flex justify-between font-black text-sm text-slate-900">
                <span>Total Amount:</span>
                <span className="text-orange-600 font-mono">{store.currencySymbol || 'Rs.'} {selectedOrder.totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedOrder(null)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-950 text-white rounded-xl font-bold transition-colors cursor-pointer text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
