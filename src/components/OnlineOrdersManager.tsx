import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Store, OnlineOrder, Product } from '../types';
import { 
  Globe, 
  ShoppingBag, 
  Truck, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Package, 
  Phone, 
  MapPin, 
  Search, 
  Printer, 
  ExternalLink, 
  Copy, 
  Check, 
  Sparkles, 
  AlertCircle,
  Code,
  DollarSign,
  ChevronRight,
  Filter,
  RefreshCw,
  User,
  ArrowUpRight
} from 'lucide-react';
import { doc, updateDoc, db } from '../lib/firebase';

interface OnlineOrdersManagerProps {
  store: Store;
  orders: OnlineOrder[];
  products: Product[];
  onOpenSimulator: () => void;
  onRefresh?: () => void;
}

type OrderStatusFilter = 'all' | 'received' | 'accepted' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';

export const OnlineOrdersManager: React.FC<OnlineOrdersManagerProps> = ({
  store,
  orders,
  products,
  onOpenSimulator,
  onRefresh
}) => {
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OnlineOrder | null>(null);
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [cancelModalOrder, setCancelModalOrder] = useState<OnlineOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('Out of stock or customer requested cancellation');

  const onlineStoreId = store.onlineStoreId || store.specialStoreId || store.id;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(label);
    setTimeout(() => setCopiedEndpoint(null), 2500);
  };

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    if (statusFilter !== 'all' && order.orderStatus !== statusFilter) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        order.orderNumber?.toLowerCase().includes(q) ||
        order.customerName?.toLowerCase().includes(q) ||
        order.customerPhone?.toLowerCase().includes(q) ||
        order.deliveryAddress?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Calculate stats
  const totalOrdersCount = orders.length;
  const receivedCount = orders.filter(o => o.orderStatus === 'received').length;
  const inProgressCount = orders.filter(o => ['accepted', 'preparing', 'out_for_delivery'].includes(o.orderStatus)).length;
  const deliveredCount = orders.filter(o => o.orderStatus === 'delivered').length;
  const onlineSalesRevenue = orders
    .filter(o => o.orderStatus !== 'cancelled')
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  // Status updater
  const handleUpdateStatus = async (orderId: string, newStatus: OnlineOrder['orderStatus'], reason?: string) => {
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch(`/api/stores/${encodeURIComponent(store.id)}/online-orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderStatus: newStatus,
          paymentStatus: newStatus === 'delivered' ? 'paid' : undefined,
          cancelledReason: reason
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update order status');
      }

      if (cancelModalOrder) {
        setCancelModalOrder(null);
      }
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Error updating status:', err);
      alert('Failed to update status: ' + err.message);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const getStatusBadge = (status: OnlineOrder['orderStatus']) => {
    switch (status) {
      case 'received':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            NEW ORDER RECEIVED
          </span>
        );
      case 'accepted':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-200">
            ACCEPTED
          </span>
        );
      case 'preparing':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
            <Package className="w-3.5 h-3.5" />
            PREPARING ITEMS
          </span>
        );
      case 'out_for_delivery':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
            <Truck className="w-3.5 h-3.5" />
            OUT FOR DELIVERY
          </span>
        );
      case 'delivered':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-slate-900 text-white flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            DELIVERED
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" />
            CANCELLED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Online Store Credentials & Simulator */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                ONLINE STORE & E-COMMERCE HUB
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-white/10 text-slate-300">
                Online Store ID: <strong className="text-white">{onlineStoreId}</strong>
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Incoming Online Orders & Dispatch
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Customers can order online from your website or mobile app. All products, quantities, prices, and promotional offers synchronize live via the Mart Pro REST API, and orders arrive directly here in your store admin dispatch board.
            </p>

            <div className="flex items-center gap-3 pt-1 flex-wrap text-xs text-slate-400 font-mono">
              <button
                onClick={() => copyToClipboard(`/api/online-stores/${onlineStoreId}/catalog`, 'catalog')}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 rounded-xl border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedEndpoint === 'catalog' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                Catalog API: <span className="text-emerald-400">/api/online-stores/{onlineStoreId}/catalog</span>
              </button>

              <button
                onClick={() => copyToClipboard(`/api/online-stores/${onlineStoreId}/orders`, 'orders')}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 rounded-xl border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedEndpoint === 'orders' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                Place Order API: <span className="text-indigo-400">/api/online-stores/{onlineStoreId}/orders</span>
              </button>
            </div>
          </div>

          {/* Test Simulator Button */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <button
              onClick={onOpenSimulator}
              className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer transform hover:scale-[1.02]"
            >
              <Sparkles className="w-4 h-4" />
              <span>Launch Webshop Simulator</span>
            </button>

            <a
              href={`/api/online-stores/${encodeURIComponent(onlineStoreId)}/catalog`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/10 flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Code className="w-4 h-4 text-emerald-400" />
              <span>Inspect Live JSON Catalog</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>
        </div>
      </div>

      {/* Online Sales Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Online Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
            Rs. {onlineSalesRevenue.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-500">
            Added to Total Store Revenue & Profit
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>New Orders</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 font-mono">
            {receivedCount}
          </div>
          <div className="text-[11px] text-slate-500">
            Awaiting store confirmation
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>In Preparation / Rider</span>
            <Truck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-indigo-600 font-mono">
            {inProgressCount}
          </div>
          <div className="text-[11px] text-slate-500">
            Active dispatch workflow
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Completed Orders</span>
            <CheckCircle2 className="w-4 h-4 text-slate-900" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
            {deliveredCount}
          </div>
          <div className="text-[11px] text-slate-500">
            Successfully delivered to customer
          </div>
        </div>
      </div>

      {/* Orders Filter & Search Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order #, Customer Name, Phone, Address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ×
              </button>
            )}
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin text-xs font-bold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({totalOrdersCount})
            </button>
            <button
              onClick={() => setStatusFilter('received')}
              className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                statusFilter === 'received'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-emerald-800 hover:bg-slate-200'
              }`}
            >
              New Received ({receivedCount})
            </button>
            <button
              onClick={() => setStatusFilter('preparing')}
              className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                statusFilter === 'preparing'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 text-amber-800 hover:bg-slate-200'
              }`}
            >
              Preparing ({orders.filter(o => o.orderStatus === 'preparing').length})
            </button>
            <button
              onClick={() => setStatusFilter('out_for_delivery')}
              className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                statusFilter === 'out_for_delivery'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-indigo-800 hover:bg-slate-200'
              }`}
            >
              Out for Delivery ({orders.filter(o => o.orderStatus === 'out_for_delivery').length})
            </button>
            <button
              onClick={() => setStatusFilter('delivered')}
              className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                statusFilter === 'delivered'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Delivered ({deliveredCount})
            </button>
            <button
              onClick={() => setStatusFilter('cancelled')}
              className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                statusFilter === 'cancelled'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 text-rose-800 hover:bg-slate-200'
              }`}
            >
              Cancelled ({orders.filter(o => o.orderStatus === 'cancelled').length})
            </button>
          </div>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-4 shadow-xs">
          <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto text-slate-400">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-900">No Online Orders Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchTerm 
                ? 'No online orders match your search keyword.' 
                : 'Your store has not received any online orders in this category yet.'}
            </p>
          </div>

          <button
            onClick={onOpenSimulator}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Place a Test Order via Webshop Simulator
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredOrders.map((order) => {
            const isUpdating = updatingOrderId === order.id;
            return (
              <div
                key={order.id}
                className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs hover:shadow-md transition-shadow space-y-4"
              >
                {/* Header: Order Number, Date, Status, Total */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-black text-base shrink-0">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-base text-slate-900">
                          {order.orderNumber}
                        </span>
                        {getStatusBadge(order.orderStatus)}
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-100 text-slate-600">
                          {order.paymentMethod} • {order.paymentStatus}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Received on {new Date(order.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="text-right sm:text-right">
                    <div className="text-xs text-slate-400 font-bold uppercase">Order Total</div>
                    <div className="text-xl font-black text-emerald-700 font-mono">
                      Rs. {(order.totalAmount || 0).toFixed(2)}
                    </div>
                    {order.discountAmount > 0 && (
                      <div className="text-[11px] text-rose-600 font-bold">
                        Saved Rs. {order.discountAmount.toFixed(2)} discount
                      </div>
                    )}
                  </div>
                </div>

                {/* Body: Customer Details & Ordered Items */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Customer & Delivery Information */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Customer & Delivery Destination
                    </div>

                    <div className="flex items-start gap-2">
                      <User className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-slate-900">{order.customerName}</div>
                        {order.customerEmail && <div className="text-slate-500">{order.customerEmail}</div>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 font-mono font-bold text-slate-800">
                      <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{order.customerPhone}</span>
                    </div>

                    <div className="flex items-start gap-2 text-slate-700">
                      <MapPin className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">{order.deliveryAddress}</span>
                        {order.deliveryNotes && (
                          <div className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] font-medium">
                            📝 <strong>Note:</strong> {order.deliveryNotes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ordered Items List */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex justify-between">
                        <span>Items in Order ({order.items?.length || 0})</span>
                        <span className="font-mono">Delivery Fee: Rs. {order.deliveryFee}</span>
                      </div>

                      <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {(order.items || []).map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-slate-200/60 last:border-0">
                            <span className="font-bold text-slate-800 truncate max-w-[200px]">
                              {item.quantity}× {item.name}
                            </span>
                            <span className="font-mono text-slate-900 font-bold shrink-0">
                              Rs. {(item.total || item.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {order.cancelledReason && (
                      <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] font-medium">
                        <strong>Cancellation Reason:</strong> {order.cancelledReason}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons: Status Workflow */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      Print Dispatch Slip
                    </button>
                  </div>

                  {/* Status Progression Controls */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {order.orderStatus === 'received' && (
                      <>
                        <button
                          disabled={isUpdating}
                          onClick={() => handleUpdateStatus(order.id, 'accepted')}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-colors cursor-pointer disabled:opacity-50"
                        >
                          ✓ Accept Order
                        </button>
                        <button
                          disabled={isUpdating}
                          onClick={() => setCancelModalOrder(order)}
                          className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold border border-rose-200 transition-colors cursor-pointer"
                        >
                          Reject / Cancel
                        </button>
                      </>
                    )}

                    {order.orderStatus === 'accepted' && (
                      <button
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(order.id, 'preparing')}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition-colors cursor-pointer"
                      >
                        📦 Start Packing Items
                      </button>
                    )}

                    {order.orderStatus === 'preparing' && (
                      <button
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(order.id, 'out_for_delivery')}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-colors cursor-pointer"
                      >
                        🚚 Dispatch with Delivery Rider
                      </button>
                    )}

                    {order.orderStatus === 'out_for_delivery' && (
                      <button
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(order.id, 'delivered')}
                        className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Mark Delivered & Complete
                      </button>
                    )}

                    {order.orderStatus === 'delivered' && (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Delivered successfully
                      </span>
                    )}

                    {order.orderStatus !== 'delivered' && order.orderStatus !== 'cancelled' && order.orderStatus !== 'received' && (
                      <button
                        disabled={isUpdating}
                        onClick={() => setCancelModalOrder(order)}
                        className="px-2.5 py-2 text-slate-400 hover:text-rose-600 text-xs font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Printable Dispatch / Delivery Slip Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">Delivery & Packing Slip</h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="border border-slate-300 rounded-2xl p-4 font-mono text-xs space-y-3 bg-slate-50">
              <div className="text-center pb-2 border-b border-dashed border-slate-300">
                <div className="font-black text-sm text-slate-900 uppercase">{store.name}</div>
                <div className="text-[10px] text-slate-500">ONLINE ORDER DISPATCH TICKET</div>
                <div className="font-bold text-xs text-slate-800 mt-1">{selectedOrder.orderNumber}</div>
              </div>

              <div className="space-y-1 text-[11px]">
                <div><strong>Customer:</strong> {selectedOrder.customerName}</div>
                <div><strong>Phone:</strong> {selectedOrder.customerPhone}</div>
                <div><strong>Address:</strong> {selectedOrder.deliveryAddress}</div>
                {selectedOrder.deliveryNotes && (
                  <div><strong>Note:</strong> {selectedOrder.deliveryNotes}</div>
                )}
                <div><strong>Payment:</strong> {selectedOrder.paymentMethod.toUpperCase()} ({selectedOrder.paymentStatus})</div>
              </div>

              <div className="pt-2 border-t border-dashed border-slate-300 space-y-1">
                <div className="font-bold text-[10px] uppercase text-slate-600">ITEMS TO PACK:</div>
                {selectedOrder.items?.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span>[ ] {it.quantity}× {it.name}</span>
                    <span>Rs. {it.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-dashed border-slate-300 flex justify-between font-black text-xs text-slate-900">
                <span>TOTAL COLLECTABLE:</span>
                <span>Rs. {selectedOrder.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="w-1/2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Print Ticket
              </button>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Cancellation Modal */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <XCircle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-black text-slate-900 text-base">Cancel Online Order?</h3>
              <p className="text-xs text-slate-500">
                Order <strong>{cancelModalOrder.orderNumber}</strong> will be cancelled and reserved product stock will be automatically restored into store inventory.
              </p>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Reason for Cancellation</label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setCancelModalOrder(null)}
                className="w-1/2 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
              >
                Keep Order
              </button>
              <button
                onClick={() => handleUpdateStatus(cancelModalOrder.id, 'cancelled', cancelReason)}
                className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
