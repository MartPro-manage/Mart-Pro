import React, { useState, useEffect, useMemo } from 'react';
import { Store, UserAccount, Product, SupplierOrder, SupplierOrderItem } from '../types';
import { db, collection, query, where, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from '../lib/firebase';
import { UniversalBackButton } from './UniversalBackButton';
import { 
  Truck, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Download, 
  Search, 
  Phone, 
  User, 
  Package, 
  FileText, 
  Trash2, 
  Check, 
  AlertCircle,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SupplierManagementViewProps {
  store: Store;
  currentUser: UserAccount;
  onBack: () => void;
}

export const SupplierManagementView: React.FC<SupplierManagementViewProps> = ({
  store,
  currentUser,
  onBack
}) => {
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<'queue' | 'new_order' | 'archive'>('queue');

  // New Order Form State
  const [supplierName, setSupplierName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductCategory, setSelectedProductCategory] = useState('all');

  // Selected checklist items: map productId -> SupplierOrderItem
  const [checklist, setChecklist] = useState<Record<string, SupplierOrderItem>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Subscribe to real-time products
  useEffect(() => {
    if (!store?.id) return;
    const qProducts = query(
      collection(db, 'products'),
      where('storeId', '==', store.id)
    );
    const unsub = onSnapshot(qProducts, (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach(docSnap => {
        prods.push({ id: docSnap.id, ...docSnap.data() } as Product);
      });
      setProducts(prods);
    });
    return () => unsub();
  }, [store?.id]);

  // Subscribe to real-time supplier orders
  useEffect(() => {
    if (!store?.id) return;
    const qOrders = query(
      collection(db, 'supplier_orders'),
      where('storeId', '==', store.id)
    );
    const unsub = onSnapshot(qOrders, (snapshot) => {
      const list: SupplierOrder[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as SupplierOrder);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(list);
    });
    return () => unsub();
  }, [store?.id]);

  // Show notification helper
  const showToast = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 3500);
  };

  // Toggle item in checklist
  const handleToggleProduct = (product: Product) => {
    setChecklist(prev => {
      const copy = { ...prev };
      if (copy[product.id]) {
        delete copy[product.id];
      } else {
        const costPrice = product.costPrice || (product.price ? Math.round(product.price * 0.75) : 0);
        const defaultQty = product.stockQuantity <= (product.minStockLevel || 5) ? 25 : 10;
        copy[product.id] = {
          id: `item-${Date.now()}-${product.id}`,
          productId: product.id,
          name: product.name,
          category: product.category || 'General',
          barcode: product.barcode || '',
          shortcutCode: product.shortcutCode || '',
          currentStock: product.stockQuantity || 0,
          orderQuantity: defaultQty,
          unitType: product.unitType || (product.sellBy === 'weight' ? 'kg' : 'piece'),
          costPrice,
          estimatedTotal: defaultQty * costPrice,
          checked: true
        };
      }
      return copy;
    });
  };

  // Update quantity in checklist
  const handleUpdateChecklistQty = (productId: string, qty: number) => {
    if (qty <= 0) return;
    setChecklist(prev => {
      const item = prev[productId];
      if (!item) return prev;
      const cost = item.costPrice || 0;
      return {
        ...prev,
        [productId]: {
          ...item,
          orderQuantity: qty,
          estimatedTotal: Math.round(qty * cost * 100) / 100
        }
      };
    });
  };

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  // Filtered products for checklist
  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    return products.filter(p => {
      const matchCat = selectedProductCategory === 'all' || p.category === selectedProductCategory;
      if (!matchCat) return false;
      if (!term) return true;
      return (
        p.name?.toLowerCase().includes(term) ||
        p.shortcutCode?.toLowerCase().includes(term) ||
        p.barcode?.toLowerCase().includes(term)
      );
    });
  }, [products, productSearch, selectedProductCategory]);

  // Calculate estimated total for new order
  const newOrderTotal = useMemo(() => {
    const items = Object.values(checklist) as SupplierOrderItem[];
    return items.reduce((acc, item) => acc + (item.estimatedTotal || 0), 0);
  }, [checklist]);

  // Submit new supplier order
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      showToast('error', 'Please enter a Supplier Name.');
      return;
    }

    const items = Object.values(checklist) as SupplierOrderItem[];
    if (items.length === 0) {
      showToast('error', 'Please select at least one product from the checklist.');
      return;
    }

    setIsSubmitting(true);
    try {
      const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const orderPayload: SupplierOrder = {
        id: orderId,
        storeId: store.id,
        supplierName: supplierName.trim(),
        contactNumber: contactNumber.trim(),
        items,
        status: 'pending',
        notes: notes.trim() || undefined,
        totalEstimatedAmount: newOrderTotal,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'supplier_orders', orderId), orderPayload);
      showToast('success', `Order for "${supplierName}" created successfully!`);
      
      // Reset form
      setSupplierName('');
      setContactNumber('');
      setNotes('');
      setChecklist({});
      setActiveTab('queue');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Failed to save order: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mark order as Delivered (Removes from active queue)
  const handleMarkDelivered = async (order: SupplierOrder) => {
    try {
      await updateDoc(doc(db, 'supplier_orders', order.id), {
        status: 'delivered',
        deliveredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      showToast('success', `Order #${order.id.slice(-6)} from ${order.supplierName} marked as DELIVERED and removed from active queue.`);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Failed to update order status: ' + err.message);
    }
  };

  // Delete / Discard order
  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to delete this supplier order record?')) return;
    try {
      await deleteDoc(doc(db, 'supplier_orders', orderId));
      showToast('success', 'Order record deleted.');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Failed to delete order: ' + err.message);
    }
  };

  // Export orders as CSV
  const handleExportOrders = () => {
    if (orders.length === 0) {
      showToast('error', 'No orders to export.');
      return;
    }

    const headers = [
      'Order ID',
      'Supplier Name',
      'Contact Number',
      'Status',
      'Item Count',
      'Estimated Total (Rs.)',
      'Created Date',
      'Delivered Date',
      'Products Ordered'
    ];

    const rows = orders.map(o => {
      const itemsSummary = o.items.map(i => `${i.name} (Qty: ${i.orderQuantity} ${i.unitType || ''})`).join('; ');
      return [
        `"${o.id}"`,
        `"${(o.supplierName || '').replace(/"/g, '""')}"`,
        `"${(o.contactNumber || '').replace(/"/g, '""')}"`,
        `"${o.status.toUpperCase()}"`,
        o.items.length,
        o.totalEstimatedAmount || 0,
        `"${new Date(o.createdAt).toLocaleString()}"`,
        o.deliveredAt ? `"${new Date(o.deliveredAt).toLocaleString()}"` : '""',
        `"${itemsSummary.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Supplier_Orders_${store.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('success', 'Supplier orders list exported successfully!');
  };

  const activeOrders = orders.filter(o => o.status !== 'delivered');
  const deliveredOrders = orders.filter(o => o.status === 'delivered');

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex flex-col">
      {/* Top Action & Navigation Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            {/* Universal Return Button */}
            <UniversalBackButton onBack={onBack} label="Back to Dashboard" />

            <div className="h-6 w-px bg-slate-200 hidden sm:block" />

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center shadow-xs">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base font-black text-slate-900 leading-tight">Supplier Management</h1>
                <p className="text-[11px] text-slate-500">Procurement & inventory supply queue</p>
              </div>
            </div>
          </div>

          {/* Tab Navigation & Export Actions */}
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('queue')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'queue'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-orange-600" />
                <span>Active Queue</span>
                {activeOrders.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-orange-100 text-orange-800 text-[10px]">
                    {activeOrders.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('new_order')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'new_order'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Create Order</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('archive')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'archive'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Delivered Archive</span>
                {deliveredOrders.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px]">
                    {deliveredOrders.length}
                  </span>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportOrders}
              id="export-supplier-orders-btn"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
              title="Download full supplier orders list as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export List</span>
            </button>
          </div>

        </div>
      </div>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`max-w-md mx-auto mt-4 px-4 py-3 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 ${
              notification.type === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{notification.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        
        {/* 1. ACTIVE ORDERS QUEUE */}
        {activeTab === 'queue' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">Active Supply Orders Queue</h2>
                <p className="text-xs text-slate-500">Orders waiting for delivery and fulfillment</p>
              </div>
              <button
                onClick={() => setActiveTab('new_order')}
                className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Supplier Order</span>
              </button>
            </div>

            {activeOrders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                <Truck className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <h3 className="text-base font-bold text-slate-800">No Orders in Active Queue</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  All supplier orders have been delivered, or no new orders have been submitted yet.
                </p>
                <button
                  onClick={() => setActiveTab('new_order')}
                  className="mt-4 px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold cursor-pointer hover:bg-orange-700"
                >
                  Create New Order Checklist
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeOrders.map((order) => {
                  const createdDate = new Date(order.createdAt).toLocaleDateString();
                  const createdTime = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-orange-300 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                          <div>
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-bold text-[10px] uppercase tracking-wider">
                              In Queue • Pending Delivery
                            </span>
                            <h3 className="text-base font-black text-slate-900 mt-1">
                              {order.supplierName}
                            </h3>
                            {order.contactNumber && (
                              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{order.contactNumber}</span>
                              </p>
                            )}
                          </div>

                          <div className="text-right">
                            <span className="text-[11px] text-slate-400 block">{createdDate}</span>
                            <span className="text-[11px] text-slate-400 font-mono">{createdTime}</span>
                          </div>
                        </div>

                        {/* Order Items Summary */}
                        <div className="py-3">
                          <p className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                            <span>Products ({order.items.length}):</span>
                            <span className="text-slate-500 font-normal">
                              Est. Total: <strong>Rs. {Number(order.totalEstimatedAmount || 0).toFixed(2)}</strong>
                            </span>
                          </p>
                          <div className="bg-slate-50 rounded-xl p-2.5 max-h-36 overflow-y-auto custom-scrollbar space-y-1 text-xs">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-slate-700 py-0.5">
                                <div className="truncate pr-2">
                                  <span className="font-bold">{item.name}</span>
                                  {item.shortcutCode && (
                                    <span className="text-[10px] text-orange-600 font-mono ml-1">
                                      #{item.shortcutCode}
                                    </span>
                                  )}
                                </div>
                                <span className="font-mono font-bold text-slate-900 shrink-0">
                                  {item.orderQuantity} {item.unitType || 'pcs'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {order.notes && (
                          <div className="text-xs text-slate-500 italic bg-amber-50/50 p-2 rounded-lg border border-amber-100 mb-3">
                            "{order.notes}"
                          </div>
                        )}
                      </div>

                      {/* Action buttons: Delivered & Delete */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(order.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete / Cancel Order"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleMarkDelivered(order)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
                          title="Mark order as delivered and remove from queue"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Delivered (Remove from Queue)</span>
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 2. CREATE NEW ORDER (WITH PRODUCT CHECKLIST) */}
        {activeTab === 'new_order' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h2 className="text-lg font-black text-slate-900 mb-1">Create Supplier Order</h2>
            <p className="text-xs text-slate-500 mb-6">
              Enter supplier details and select required inventory products from the checklist
            </p>

            <form onSubmit={handleSubmitOrder} className="space-y-6">
              {/* Supplier Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="e.g. Metro Wholesale / Ali Distributors"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-xs sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Contact / Phone Number
                  </label>
                  <input
                    type="text"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="e.g. +92 300 1234567"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-xs sm:text-sm"
                  />
                </div>

                <div className="sm:col-span-2 md:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Order Notes / Delivery Instructions
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Urgent morning delivery before 10 AM"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-xs sm:text-sm"
                  />
                </div>
              </div>

              {/* Product Checklist Section */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Product Checklist</h3>
                    <p className="text-xs text-slate-500">
                      Check the products you wish to order from this supplier
                    </p>
                  </div>

                  {/* Search and Category Filter */}
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Search products or #code..."
                        className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500 w-48 sm:w-60"
                      />
                    </div>

                    <select
                      value={selectedProductCategory}
                      onChange={(e) => setSelectedProductCategory(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700"
                    >
                      <option value="all">All Categories</option>
                      {categories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Checklist Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="p-2.5 w-12 text-center">Select</th>
                        <th className="p-2.5 w-20">Code</th>
                        <th className="p-2.5">Product Name</th>
                        <th className="p-2.5 w-28">Category</th>
                        <th className="p-2.5 w-24 text-right">Current Stock</th>
                        <th className="p-2.5 w-32 text-right">Order Quantity</th>
                        <th className="p-2.5 w-28 text-right">Est. Cost/Unit</th>
                        <th className="p-2.5 w-28 text-right">Est. Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProducts.map((p) => {
                        const isChecked = Boolean(checklist[p.id]);
                        const checkItem = checklist[p.id];
                        const isLowStock = p.stockQuantity <= (p.minStockLevel || 5);

                        return (
                          <tr
                            key={p.id}
                            className={`transition-colors ${
                              isChecked ? 'bg-orange-50/50' : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleProduct(p)}
                                className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 cursor-pointer"
                              />
                            </td>

                            <td className="p-2.5 font-mono font-bold text-orange-700">
                              #{p.shortcutCode || '----'}
                            </td>

                            <td className="p-2.5 font-bold text-slate-800">
                              <div className="flex items-center gap-1.5">
                                <span>{p.name}</span>
                                {isLowStock && (
                                  <span className="px-1.5 py-0.2 rounded-md bg-red-100 text-red-700 text-[10px] font-bold">
                                    Low Stock
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="p-2.5 text-slate-500 truncate max-w-[120px]">
                              {p.category || 'General'}
                            </td>

                            <td className={`p-2.5 text-right font-mono font-bold ${
                              isLowStock ? 'text-red-600' : 'text-slate-700'
                            }`}>
                              {p.stockQuantity} {p.unitType || ''}
                            </td>

                            <td className="p-2.5 text-right">
                              {isChecked ? (
                                <div className="flex items-center justify-end gap-1">
                                  <input
                                    type="number"
                                    min="1"
                                    value={checkItem.orderQuantity}
                                    onChange={(e) => handleUpdateChecklistQty(p.id, parseInt(e.target.value, 10) || 1)}
                                    className="w-16 px-2 py-1 text-right border border-orange-300 rounded-lg text-xs font-mono font-bold focus:outline-hidden bg-white"
                                  />
                                  <span className="text-[10px] text-slate-500">{checkItem.unitType}</span>
                                </div>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>

                            <td className="p-2.5 text-right font-mono text-slate-600">
                              Rs. {Number(p.costPrice || (p.price ? p.price * 0.75 : 0)).toFixed(2)}
                            </td>

                            <td className="p-2.5 text-right font-mono font-bold text-slate-800">
                              {isChecked ? `Rs. ${Number(checkItem.estimatedTotal || 0).toFixed(2)}` : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Order Summary & Submit Button */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-xs">
                  <span>Selected Products: <strong>{Object.keys(checklist).length}</strong></span>
                  <span>Estimated Total Amount: <strong className="text-orange-700 text-sm">Rs. {newOrderTotal.toFixed(2)}</strong></span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setChecklist({});
                      setActiveTab('queue');
                    }}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting || Object.keys(checklist).length === 0}
                    className="px-6 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold text-xs cursor-pointer shadow-md transition-colors"
                  >
                    {isSubmitting ? 'Submitting Order...' : 'Submit Order into Queue'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* 3. DELIVERED ARCHIVE */}
        {activeTab === 'archive' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">Delivered Orders Archive</h2>
                <p className="text-xs text-slate-500">History of fulfilled shipments from suppliers</p>
              </div>
            </div>

            {deliveredOrders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                <CheckCircle2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <h3 className="text-base font-bold text-slate-800">No Delivered Orders Yet</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Once an order in the active queue is marked as delivered, it will be catalogued here.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Order ID</th>
                      <th className="p-3">Supplier</th>
                      <th className="p-3">Contact</th>
                      <th className="p-3">Items</th>
                      <th className="p-3 text-right">Estimated Total</th>
                      <th className="p-3">Created</th>
                      <th className="p-3">Delivered Date</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deliveredOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono text-slate-500">#{o.id.slice(-6)}</td>
                        <td className="p-3 font-bold text-slate-900">{o.supplierName}</td>
                        <td className="p-3 text-slate-600">{o.contactNumber || '-'}</td>
                        <td className="p-3 text-slate-600">
                          {o.items.length} {o.items.length === 1 ? 'item' : 'items'}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-800">
                          Rs. {Number(o.totalEstimatedAmount || 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-slate-500">
                          {new Date(o.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-emerald-700 font-bold">
                          {o.deliveredAt ? new Date(o.deliveredAt).toLocaleDateString() : 'Delivered'}
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            Delivered
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
