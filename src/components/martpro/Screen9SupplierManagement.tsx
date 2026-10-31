import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, 
  Truck, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Plus, 
  Search, 
  DollarSign, 
  Boxes, 
  CheckSquare, 
  Square, 
  X,
  CreditCard,
  Banknote,
  FileText
} from 'lucide-react';
import { Supplier, Store, UserAccount, Product, SupplierOrder, SupplierOrderItem } from '../../types';
import { 
  db, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  increment, 
  onSnapshot, 
  cleanFirestoreData 
} from '../../lib/firebase';
import { playScanSuccessBeep } from '../../lib/sound';

interface Screen9SupplierManagementProps {
  store: Store | null;
  currentUser: UserAccount | null;
  suppliers: Supplier[];
  products: Product[];
  initialSupplier?: Supplier | null;
}

export const Screen9SupplierManagement: React.FC<Screen9SupplierManagementProps> = ({
  store,
  currentUser,
  suppliers,
  products,
  initialSupplier
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'delivery_verification' | 'advances' | 'payments'>('orders');
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(initialSupplier?.id || (suppliers[0]?.id || ''));

  // Create PO Modal
  const [isCreatePoOpen, setIsCreatePoOpen] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState(suppliers[0]?.id || '');
  const [poItems, setPoItems] = useState<{ productId: string; name: string; qty: number; costPrice: number }[]>([]);
  const [selectedProdId, setSelectedProdId] = useState(products[0]?.id || '');
  const [prodQty, setProdQty] = useState('20');
  const [advancePaid, setAdvancePaid] = useState('0');
  const [poNotes, setPoNotes] = useState('');

  // Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'cheque'>('bank_transfer');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Sync orders from Firestore
  useEffect(() => {
    const storeId = store?.id || 'mart-pro-store';
    const unsub = onSnapshot(collection(db, 'supplier_orders'), (snap) => {
      const list: SupplierOrder[] = [];
      snap.forEach(d => {
        const data = d.data() as SupplierOrder;
        if (data.storeId === storeId || !data.storeId) {
          list.push({ id: d.id, ...data });
        }
      });
      setOrders(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (err) => console.warn('Supplier orders fetch error:', err));

    return () => unsub();
  }, [store?.id]);

  // Selected supplier details
  const currentSupplier = useMemo(() => {
    return suppliers.find(s => s.id === selectedSupplierId) || suppliers[0];
  }, [suppliers, selectedSupplierId]);

  // Handle Add Item to PO draft
  const handleAddPoItem = () => {
    const prod = products.find(p => p.id === selectedProdId);
    if (!prod) return;
    const q = parseInt(prodQty) || 10;
    const cost = prod.costPrice || Math.round(prod.price * 0.75);

    setPoItems(prev => {
      const existing = prev.find(i => i.productId === prod.id);
      if (existing) {
        return prev.map(i => i.productId === prod.id ? { ...i, qty: i.qty + q } : i);
      }
      return [...prev, { productId: prod.id, name: prod.name, qty: q, costPrice: cost }];
    });
    setProdQty('20');
  };

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (poItems.length === 0) {
      alert('Please add at least one product to the purchase order.');
      return;
    }

    const supp = suppliers.find(s => s.id === poSupplierId);
    if (!supp) return;

    try {
      const poId = `po_${Date.now()}`;
      const poNum = `#PO-${Math.floor(100 + Math.random() * 900)}`;
      const totalCost = poItems.reduce((acc, i) => acc + (i.qty * i.costPrice), 0);
      const advNum = parseFloat(advancePaid) || 0;

      const orderPayload: SupplierOrder = {
        id: poId,
        storeId: store?.id || 'mart-pro-store',
        supplierId: supp.id,
        supplierName: supp.name,
        orderNumber: poNum,
        orderDate: new Date().toISOString().slice(0, 10),
        contactNumber: supp.phone,
        items: poItems.map((item, idx) => ({
          id: `item_${idx}`,
          productId: item.productId,
          name: item.name,
          orderQuantity: item.qty,
          previouslyReceivedQuantity: 0,
          remainingQuantity: item.qty,
          costPrice: item.costPrice,
          sellingPrice: item.costPrice * 1.3,
          deliveryStatus: 'pending',
          checked: false
        })),
        status: 'ordered',
        deliveryStatus: 'pending',
        paymentStatus: advNum >= totalCost ? 'paid' : advNum > 0 ? 'partially_paid' : 'unpaid',
        advancePaidAmount: advNum,
        totalPaidAmount: advNum,
        totalOrderAmount: totalCost,
        notes: poNotes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'supplier_orders', poId), cleanFirestoreData(orderPayload));

      // Update supplier due amount
      const remainingDue = Math.max(0, totalCost - advNum);
      if (remainingDue > 0) {
        await updateDoc(doc(db, 'suppliers', supp.id), {
          totalDue: increment(remainingDue),
          updatedAt: new Date().toISOString()
        });
      }

      alert(`Purchase Order ${poNum} created successfully!`);
      setIsCreatePoOpen(false);
      setPoItems([]);
      setAdvancePaid('0');
      setPoNotes('');
    } catch (err) {
      console.error('Error creating purchase order:', err);
      alert('Failed to create purchase order.');
    }
  };

  // Delivery Verification: verifies items and updates stock in Firestore
  const handleVerifyDeliveryAndStock = async (order: SupplierOrder) => {
    if (!confirm(`Verify delivery for Order ${order.orderNumber}? This will immediately update real-time stock levels for all verified products in inventory.`)) {
      return;
    }

    try {
      // 1. Update stock in products collection for each received item
      for (const item of order.items) {
        if (item.productId) {
          try {
            await updateDoc(doc(db, 'products', item.productId), {
              stockQuantity: increment(item.orderQuantity),
              updatedAt: new Date().toISOString()
            });
          } catch (e) {
            console.warn('Stock increment error:', e);
          }
        }
      }

      // 2. Mark order as fully delivered
      await updateDoc(doc(db, 'supplier_orders', order.id), {
        status: 'delivered',
        deliveryStatus: 'fully_received',
        deliveredAt: new Date().toISOString(),
        items: order.items.map(it => ({ ...it, deliveryStatus: 'fully_received', checked: true }))
      });

      playScanSuccessBeep();
      alert(`Order ${order.orderNumber} successfully verified! Stock quantities updated in inventory.`);
    } catch (err) {
      console.error('Error verifying delivery:', err);
      alert('Failed to complete delivery verification.');
    }
  };

  // Record payment to supplier
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(paymentAmount) || 0;
    if (amt <= 0 || !currentSupplier) {
      alert('Please enter a valid payment amount.');
      return;
    }

    try {
      const payId = `spay_${Date.now()}`;
      await setDoc(doc(db, 'supplier_payments', payId), cleanFirestoreData({
        id: payId,
        storeId: store?.id || 'mart-pro-store',
        supplierId: currentSupplier.id,
        supplierName: currentSupplier.name,
        amount: amt,
        paymentMethod,
        paymentDate: new Date().toISOString().slice(0, 10),
        notes: paymentNotes,
        createdAt: new Date().toISOString()
      }));

      // Deduct from supplier due
      await updateDoc(doc(db, 'suppliers', currentSupplier.id), {
        totalDue: increment(-amt),
        updatedAt: new Date().toISOString()
      });

      alert(`Payment of Rs. ${amt.toLocaleString()} recorded for ${currentSupplier.name}! Due balance updated.`);
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentNotes('');
    } catch (err) {
      console.error('Error recording supplier payment:', err);
      alert('Failed to record payment.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 bg-[#F8F9FA] custom-scrollbar select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#111111] tracking-tight">
            Supplier Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Purchase orders, advance payments, and delivery verification before inventory stock updates
          </p>
        </div>

        {/* Action button */}
        <button
          onClick={() => setIsCreatePoOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-[#FF6500] hover:bg-[#e65b00] active:scale-[0.98] text-white text-xs font-black shadow-md shadow-[#FF6500]/25 transition-all cursor-pointer flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create Purchase Order</span>
        </button>
      </div>

      {/* Tabs matching workflow: Purchase Orders, Delivery Verification, Advances, Payments */}
      <div className="flex items-center gap-1.5 overflow-x-auto bg-white p-1.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        {[
          { id: 'orders', label: 'Purchase Orders' },
          { id: 'delivery_verification', label: 'Delivery Verification & Stock In' },
          { id: 'advances', label: 'Advance Payments' },
          { id: 'payments', label: 'Supplier Balances & Settlements' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
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

      {/* TAB 1: PURCHASE ORDERS */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-black text-[#111111] uppercase tracking-wider">
              All Purchase Orders
            </h2>
            <span className="text-xs font-bold text-slate-400">
              Total: {orders.length} Orders
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Items Count</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Delivery Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                      No purchase orders yet. Click "+ Create Purchase Order" to make one.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => {
                    const isDelivered = o.deliveryStatus === 'fully_received';
                    return (
                      <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-black text-[#FF6500]">
                          {o.orderNumber}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {o.supplierName}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {o.orderDate}
                        </td>
                        <td className="py-3 px-4">
                          {o.items?.length || 0} Products
                        </td>
                        <td className="py-3 px-4 font-black text-slate-900">
                          Rs. {(o.totalOrderAmount || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          {isDelivered ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Delivered & Stocked
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-50 text-[#FF6500] border border-orange-200">
                              Pending Delivery
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {!isDelivered ? (
                            <button
                              onClick={() => {
                                setActiveTab('delivery_verification');
                              }}
                              className="px-3 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-[#FF6500] text-[11px] font-bold border border-orange-200 cursor-pointer"
                            >
                              Verify Delivery &rarr;
                            </button>
                          ) : (
                            <span className="text-[11px] font-bold text-slate-400">
                              Verified
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DELIVERY VERIFICATION BEFORE STOCK UPDATES (Explicit Prompt Requirement) */}
      {activeTab === 'delivery_verification' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 text-xs text-orange-950 font-medium">
            <span className="font-extrabold text-[#FF6500]">Supermarket Inbound Protocol: </span>
            Stock levels in inventory are protected and will ONLY update once physical goods are verified by the cashier/manager.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {orders.filter(o => o.deliveryStatus !== 'fully_received').length === 0 ? (
              <div className="md:col-span-2 bg-white rounded-2xl p-10 text-center border border-slate-200 text-slate-400">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                <h3 className="text-base font-black text-slate-800">All Shipments Verified</h3>
                <p className="text-xs text-slate-500 mt-1">No pending supplier deliveries awaiting verification.</p>
              </div>
            ) : (
              orders.filter(o => o.deliveryStatus !== 'fully_received').map((o) => (
                <div key={o.id} className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <div className="text-base font-black text-slate-900 flex items-center gap-2">
                        <span>{o.orderNumber}</span>
                        <span className="text-xs font-bold text-[#FF6500]">({o.supplierName})</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-semibold mt-0.5">
                        Order Date: {o.orderDate} &bull; Total: Rs. {(o.totalOrderAmount || 0).toLocaleString()}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-orange-100 text-[#FF6500] text-[10px] font-extrabold uppercase">
                      Awaiting Verification
                    </span>
                  </div>

                  {/* Line items to verify */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Verify Inbound Items:
                    </div>
                    <div className="divide-y divide-slate-100 text-xs">
                      {o.items?.map((it, idx) => (
                        <div key={idx} className="py-2 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-900">{it.name}</div>
                            <div className="text-[11px] text-slate-500">
                              Ordered: <span className="font-black text-slate-800">{it.orderQuantity} units</span> @ Rs. {it.costPrice}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-extrabold">
                            Ready to stock
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Verification action button */}
                  <button
                    onClick={() => handleVerifyDeliveryAndStock(o)}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verify Delivery & Update Stock (+ Units)</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3 & 4: ADVANCE PAYMENTS & SUPPLIER BALANCES */}
      {(activeTab === 'advances' || activeTab === 'payments') && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-black text-[#111111]">
                Supplier Balance & Settlement
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Record advance deposits or settle outstanding payables
              </p>
            </div>

            {/* Supplier selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">Select Supplier:</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="bg-[#F8F9FA] text-xs font-bold text-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
              >
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} (Due: Rs. {(s.totalDue || 0).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {currentSupplier && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total Outstanding Due
                </div>
                <div className="text-2xl font-black text-[#FF6500] mt-1">
                  Rs. {(currentSupplier.totalDue || 0).toLocaleString()}
                </div>
                <div className="text-[11px] font-semibold text-slate-600 mt-1">
                  Payable to {currentSupplier.name}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Contact Information
                </div>
                <div className="text-sm font-black text-slate-900 mt-1">
                  {currentSupplier.phone}
                </div>
                <div className="text-[11px] font-medium text-slate-600 mt-0.5">
                  {currentSupplier.email || 'No email provided'}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Quick Settlement
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Record bank transfer or cash payment to clear dues.
                  </div>
                </div>
                <button
                  onClick={() => {
                    setPaymentAmount(currentSupplier.totalDue?.toString() || '5000');
                    setIsPaymentModalOpen(true);
                  }}
                  className="mt-3 py-2 px-4 rounded-xl bg-[#FF6500] text-white font-bold text-xs shadow-xs hover:bg-[#e65b00] cursor-pointer"
                >
                  Record Payment
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE PURCHASE ORDER MODAL */}
      {isCreatePoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">
                Create New Purchase Order
              </h3>
              <button
                onClick={() => setIsCreatePoOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePo} className="space-y-4">
              {/* Select Supplier */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Supplier *
                </label>
                <select
                  value={poSupplierId}
                  onChange={(e) => setPoSupplierId(e.target.value)}
                  className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-bold text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Add Product Line to PO draft */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Add Products to Order
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-8">
                    <select
                      value={selectedProdId}
                      onChange={(e) => setSelectedProdId(e.target.value)}
                      className="w-full bg-white text-xs font-semibold text-slate-900 p-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Cost: Rs. {p.costPrice || Math.round(p.price * 0.75)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      value={prodQty}
                      onChange={(e) => setProdQty(e.target.value)}
                      placeholder="Qty"
                      className="w-full bg-white text-xs font-bold text-slate-900 p-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddPoItem}
                      className="w-full py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                {/* Items in PO draft */}
                {poItems.length > 0 && (
                  <div className="divide-y divide-slate-200/60 pt-2 text-xs">
                    {poItems.map((item, idx) => (
                      <div key={idx} className="py-1.5 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900">{item.name}</span>
                          <span className="text-slate-500 ml-2">&times; {item.qty} units</span>
                        </div>
                        <span className="font-black text-slate-900">
                          Rs. {(item.qty * item.costPrice).toLocaleString()}
                        </span>
                      </div>
                    ))}
                    <div className="pt-2 flex items-center justify-between font-black text-sm text-slate-900">
                      <span>Total Estimated Cost:</span>
                      <span className="text-[#FF6500]">
                        Rs. {poItems.reduce((acc, i) => acc + (i.qty * i.costPrice), 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Advance Payment */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Advance Payment Amount (Optional Rs.)
                </label>
                <input
                  type="number"
                  value={advancePaid}
                  onChange={(e) => setAdvancePaid(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-bold text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Delivery Notes & Instructions
                </label>
                <textarea
                  rows={2}
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="Expected by Monday morning..."
                  className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-medium text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreatePoOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#FF6500] hover:bg-[#e65b00] text-white text-xs font-black shadow-md cursor-pointer"
                >
                  Submit Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {isPaymentModalOpen && currentSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">
                Pay Supplier: {currentSupplier.name}
              </h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Amount (Rs.) *
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full bg-[#F8F9FA] focus:bg-white text-sm font-black text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e: any) => setPaymentMethod(e.target.value)}
                  className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-semibold text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reference / Notes
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Transaction TID / Cheque #..."
                  className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-medium text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#FF6500] hover:bg-[#e65b00] text-white text-xs font-black shadow-md cursor-pointer"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
