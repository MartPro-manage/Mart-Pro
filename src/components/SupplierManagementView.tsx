import React, { useState, useEffect, useMemo } from 'react';
import { Store, UserAccount, Product, SupplierOrder, SupplierOrderItem, SupplierProfile, SupplierPayment, GoodsReceipt, GoodsReceiptItem } from '../types';
import { db, collection, query, where, onSnapshot, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, cleanFirestoreData } from '../lib/firebase';
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
  RotateCcw,
  CreditCard,
  Banknote,
  X,
  ShieldCheck,
  MessageCircle,
  Eye,
  Edit,
  DollarSign,
  Building,
  Mail,
  MapPin,
  ArrowRight,
  Printer,
  UserPlus,
  Grid,
  List,
  Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateOrderProductListPdf, generateSupplierProductsCatalogPdf, generateSupplierLedgerPdf } from '../lib/pdfGenerator';

export type SupplierMainTab = 'suppliers' | 'add_supplier' | 'orders' | 'payments' | 'new_order';

export const SUPPLIER_PAYMENT_METHODS = [
  'Cash',
  'HBL',
  'Jazz Cash',
  'Easy Paisa',
  'Other'
] as const;

export type SupplierPaymentMethod = typeof SUPPLIER_PAYMENT_METHODS[number];

interface SupplierManagementViewProps {
  store: Store;
  currentUser: UserAccount;
  onBack: () => void;
  initialTab?: SupplierMainTab;
}

const formatCurrency = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '0';
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(num) ? '0' : (num ?? 0).toLocaleString();
};

export const SupplierManagementView: React.FC<SupplierManagementViewProps> = ({
  store,
  currentUser,
  onBack,
  initialTab = 'suppliers'
}) => {
  const [suppliers, setSuppliers] = useState<SupplierProfile[]>([]);
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Main navigation tabs within Supplier Management
  const [mainTab, setMainTab] = useState<SupplierMainTab>(initialTab || 'suppliers');

  useEffect(() => {
    if (initialTab) {
      setMainTab(initialTab);
    }
  }, [initialTab]);

  // Supplier Profile Modal / View state
  const [selectedSupplierForView, setSelectedSupplierForView] = useState<SupplierProfile | null>(null);
  const [supplierDetailTab, setSupplierDetailTab] = useState<'pending' | 'history' | 'ledger'>('pending');
  const [ledgerSubTab, setLedgerSubTab] = useState<'payment' | 'product'>('payment');
  const [supplierViewLayout, setSupplierViewLayout] = useState<'blocks' | 'table'>('blocks');
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierProfile | null>(null);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supBusiness, setSupBusiness] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supNotes, setSupNotes] = useState('');

  // Search & Filter
  const [supplierSearch, setSupplierSearch] = useState('');

  // New Order Form State
  const [orderSupplierId, setOrderSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [orderNotes, setOrderNotes] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductCategory, setSelectedProductCategory] = useState('all');
  const [checklist, setChecklist] = useState<Record<string, { product?: Product; name: string; sku: string; barcode: string; category: string; orderQuantity: number; costPrice: number; sellingPrice: number; unitType: string }>>({});

  // Add New Product in Order Modal
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [npName, setNpName] = useState('');
  const [npSku, setNpSku] = useState('');
  const [npBarcode, setNpBarcode] = useState('');
  const [npCategory, setNpCategory] = useState('General');
  const [npCostPrice, setNpCostPrice] = useState<number>(0);
  const [npSellingPrice, setNpSellingPrice] = useState<number>(0);
  const [npQty, setNpQty] = useState<number>(10);
  const [npUnit, setNpUnit] = useState('pcs');

  // Advance Payment Modal during Order Creation
  const [pendingOrderPayload, setPendingOrderPayload] = useState<any | null>(null);
  const [advanceAmountInput, setAdvanceAmountInput] = useState<string>('0');
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<string>('Cash');
  const [advanceRefNotes, setAdvanceRefNotes] = useState<string>('');

  // Delivery Verification Interface state (Delivered Button)
  const [verifyingOrder, setVerifyingOrder] = useState<SupplierOrder | null>(null);
  const [verificationItems, setVerificationItems] = useState<GoodsReceiptItem[]>([]);
  const [isDeliveryConfirmedScreen, setIsDeliveryConfirmedScreen] = useState<{ orderId: string; updatedProductsCount: number; totalQty: number; newProductsAdded: number; stockValueAdded: number } | null>(null);

  // Make Payment Modal state
  const [paymentModalOrder, setPaymentModalOrder] = useState<SupplierOrder | null>(null);
  const [paymentModalSupplier, setPaymentModalSupplier] = useState<SupplierProfile | null>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('0');
  const [paymentMethodInput, setPaymentMethodInput] = useState<string>('Bank Transfer');
  const [paymentDateInput, setPaymentDateInput] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [paymentReferenceInput, setPaymentReferenceInput] = useState<string>('');
  const [paymentNotesInput, setPaymentNotesInput] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Subscribe to real-time data from Firebase
  useEffect(() => {
    if (!store?.id) return;

    const unsubSuppliers = onSnapshot(query(collection(db, 'suppliers'), where('storeId', '==', store.id)), (snap) => {
      const list: SupplierProfile[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as SupplierProfile));
      setSuppliers(list);
    });

    const unsubOrders = onSnapshot(query(collection(db, 'supplier_orders'), where('storeId', '==', store.id)), (snap) => {
      const list: SupplierOrder[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as SupplierOrder));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(list);
    });

    const unsubPayments = onSnapshot(query(collection(db, 'supplier_payments'), where('storeId', '==', store.id)), (snap) => {
      const list: SupplierPayment[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as SupplierPayment));
      setPayments(list);
    });

    const unsubReceipts = onSnapshot(query(collection(db, 'goods_receipts'), where('storeId', '==', store.id)), (snap) => {
      const list: GoodsReceipt[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as GoodsReceipt));
      setGoodsReceipts(list);
    });

    const unsubProducts = onSnapshot(query(collection(db, 'products'), where('storeId', '==', store.id)), (snap) => {
      const list: Product[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Product));
      setProducts(list);
    });

    return () => {
      unsubSuppliers();
      unsubOrders();
      unsubPayments();
      unsubReceipts();
      unsubProducts();
    };
  }, [store?.id]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 3500);
  };

  // Calculations for Supplier Dues and Totals
  const supplierFinancials = useMemo(() => {
    const map: Record<string, { totalPurchases: number; totalAdvance: number; totalSubsequent: number; totalPaid: number; outstanding: number; pendingCount: number; partialCount: number; fullCount: number }> = {};
    
    suppliers.forEach(s => {
      map[s.id] = { totalPurchases: 0, totalAdvance: 0, totalSubsequent: 0, totalPaid: 0, outstanding: 0, pendingCount: 0, partialCount: 0, fullCount: 0 };
    });

    orders.forEach(o => {
      if (!map[o.supplierId]) {
        map[o.supplierId] = { totalPurchases: 0, totalAdvance: 0, totalSubsequent: 0, totalPaid: 0, outstanding: 0, pendingCount: 0, partialCount: 0, fullCount: 0 };
      }
      map[o.supplierId].totalPurchases += (o.totalOrderAmount || 0);
      map[o.supplierId].totalAdvance += (o.advancePaidAmount || 0);

      if (o.deliveryStatus === 'pending') map[o.supplierId].pendingCount++;
      else if (o.deliveryStatus === 'partially_received') map[o.supplierId].partialCount++;
      else if (o.deliveryStatus === 'fully_received') map[o.supplierId].fullCount++;
    });

    payments.forEach(p => {
      if (!map[p.supplierId]) {
        map[p.supplierId] = { totalPurchases: 0, totalAdvance: 0, totalSubsequent: 0, totalPaid: 0, outstanding: 0, pendingCount: 0, partialCount: 0, fullCount: 0 };
      }
      map[p.supplierId].totalSubsequent += (p.amount || 0);
    });

    Object.keys(map).forEach(supId => {
      const data = map[supId];
      data.totalPaid = data.totalAdvance + data.totalSubsequent;
      data.outstanding = Math.max(0, data.totalPurchases - data.totalPaid);
    });

    return map;
  }, [suppliers, orders, payments]);

  const globalStats = useMemo(() => {
    let totalPurchases = 0;
    let totalPaid = 0;
    let outstandingDues = 0;

    Object.values(supplierFinancials).forEach(f => {
      totalPurchases += f.totalPurchases;
      totalPaid += f.totalPaid;
      outstandingDues += f.outstanding;
    });

    return {
      totalSuppliers: suppliers.length,
      totalPurchases,
      totalPaid,
      outstandingDues
    };
  }, [suppliers, supplierFinancials]);

  // Open Payment Modal with 5 payment methods
  const openPaymentModal = (sup: SupplierProfile, targetOrder?: SupplierOrder) => {
    const supOrders = orders.filter(o => o.supplierId === sup.id);
    const orderToPay = targetOrder || supOrders.find(o => (o.paymentStatus || 'unpaid') !== 'paid') || supOrders[0];
    if (!orderToPay) {
      showToast('error', `No purchase orders found for ${sup.name}. Please create a purchase order first.`);
      return;
    }
    setPaymentModalSupplier(sup);
    setPaymentModalOrder(orderToPay);
    const remaining = Math.max(0, (orderToPay.totalOrderAmount || 0) - (orderToPay.totalPaidAmount || 0));
    setPaymentAmountInput(remaining > 0 ? remaining.toString() : '0');
    setPaymentMethodInput('Cash');
    setPaymentDateInput(new Date().toISOString().split('T')[0]);
    setPaymentReferenceInput('');
    setPaymentNotesInput('');
  };

  // 1. Download Product List Catalog as PDF
  const handleDownloadSupplierProducts = (sup: SupplierProfile) => {
    const supplierOrders = orders.filter(o => o.supplierId === sup.id);
    const productMap = new Map<string, {
      name: string;
      barcode: string;
      category: string;
      costPrice: number;
      sellingPrice: number;
      stockQuantity: number;
      unitType: string;
      status: string;
    }>();

    products.forEach(p => {
      if ((p as any).supplierId === sup.id || (p as any).supplierName?.toLowerCase() === sup.name.toLowerCase()) {
        productMap.set(p.barcode || p.id, {
          name: p.name,
          barcode: p.barcode || '-',
          category: p.category || 'General',
          costPrice: p.costPrice || 0,
          sellingPrice: p.price || 0,
          stockQuantity: p.stockQuantity || 0,
          unitType: p.unitType || 'piece',
          status: p.stockQuantity > 0 ? 'In Stock' : 'Out of Stock'
        });
      }
    });

    supplierOrders.forEach(o => {
      (o.items || []).forEach(item => {
        const key = item.barcode || item.name;
        const existingProduct = products.find(p => (item.barcode && p.barcode === item.barcode) || p.name.toLowerCase() === item.name.toLowerCase());
        const stock = existingProduct ? existingProduct.stockQuantity : 0;
        
        if (!productMap.has(key)) {
          productMap.set(key, {
            name: item.name,
            barcode: item.barcode || existingProduct?.barcode || '-',
            category: item.category || existingProduct?.category || 'General',
            costPrice: item.costPrice || 0,
            sellingPrice: item.sellingPrice || existingProduct?.price || 0,
            stockQuantity: stock,
            unitType: item.unitType || existingProduct?.unitType || 'piece',
            status: stock > 0 ? 'In Stock' : 'Out of Stock'
          });
        }
      });
    });

    const items = Array.from(productMap.values());
    if (items.length === 0) {
      showToast('error', `No products recorded for supplier "${sup.name}" yet.`);
      return;
    }

    generateSupplierProductsCatalogPdf(sup, items, store);
    showToast('success', `Product catalog PDF downloaded successfully (${items.length} items)!`);
  };

  // 2. Download Supplier Financial Ledger as PDF with exact timestamp & 5 payment methods
  const handleDownloadSupplierLedger = (sup: SupplierProfile) => {
    const supOrders = orders.filter(o => o.supplierId === sup.id);
    const supPayments = payments.filter(p => p.supplierId === sup.id);
    const fin = supplierFinancials[sup.id];

    const generationTime = new Date();
    generateSupplierLedgerPdf(sup, supOrders, supPayments, store, fin, generationTime);
    showToast('success', `Financial ledger PDF downloaded successfully for ${sup.name}!`);
  };

  // 3. Download Pending Orders Product List as PDF
  const handleDownloadOrderList = (order: SupplierOrder) => {
    const sup = suppliers.find(s => s.id === order.supplierId);
    generateOrderProductListPdf(order, store, sup);
    showToast('success', `Product list PDF downloaded for order ${order.orderNumber}!`);
  };

  const handleDownloadPendingProducts = (sup: SupplierProfile) => {
    const pendingOrders = orders.filter(o => o.supplierId === sup.id && o.status !== 'delivered');
    generateOrderProductListPdf(pendingOrders[0], store, sup); // Assuming logic change to download per order or just pick first for demo
    showToast('success', `Pending order product list PDF downloaded for ${sup.name}!`);
  };

  // Save Supplier Profile (Create / Edit)
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim() || !supPhone.trim() || !supAddress.trim()) {
      showToast('error', 'Please fill in required fields (Name, Phone, Address).');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingSupplier) {
        await updateDoc(doc(db, 'suppliers', editingSupplier.id), cleanFirestoreData({
          name: supName.trim(),
          phone: supPhone.trim(),
          address: supAddress.trim(),
          businessName: supBusiness.trim() || undefined,
          email: supEmail.trim() || undefined,
          notes: supNotes.trim() || undefined,
          updatedAt: new Date().toISOString()
        }));
        showToast('success', `Supplier "${supName}" updated successfully.`);
      } else {
        const supId = `sup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const newSup: SupplierProfile = {
          id: supId,
          storeId: store.id,
          name: supName.trim(),
          phone: supPhone.trim(),
          address: supAddress.trim(),
          businessName: supBusiness.trim() || undefined,
          email: supEmail.trim() || undefined,
          notes: supNotes.trim() || undefined,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'suppliers', supId), cleanFirestoreData(newSup));
        showToast('success', `Supplier "${supName}" created successfully.`);
      }

      setIsSupplierModalOpen(false);
      setEditingSupplier(null);
      setSupName('');
      setSupPhone('');
      setSupAddress('');
      setSupBusiness('');
      setSupEmail('');
      setSupNotes('');
      // Immediately switch to Suppliers directory tab to view the added/updated supplier
      setMainTab('suppliers');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Failed to save supplier: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditSupplier = (sup: SupplierProfile) => {
    setEditingSupplier(sup);
    setSupName(sup.name);
    setSupPhone(sup.phone);
    setSupAddress(sup.address);
    setSupBusiness(sup.businessName || '');
    setSupEmail(sup.email || '');
    setSupNotes(sup.notes || '');
    setMainTab('add_supplier');
  };

  // Product Selection & Checklist Handlers for PO Creation
  const categories = useMemo(() => {
    const s = new Set<string>();
    products.forEach(p => { if (p.category) s.add(p.category); });
    return Array.from(s).sort();
  }, [products]);

  const filteredProductsForOrder = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    return products.filter(p => {
      const matchCat = selectedProductCategory === 'all' || p.category === selectedProductCategory;
      if (!matchCat) return false;
      if (!term) return true;
      return (
        p.name?.toLowerCase().includes(term) ||
        p.barcode?.toLowerCase().includes(term) ||
        p.shortcutCode?.toLowerCase().includes(term) ||
        p.id.toLowerCase().includes(term)
      );
    });
  }, [products, productSearch, selectedProductCategory]);

  const handleToggleProductInChecklist = (p: Product) => {
    setChecklist(prev => {
      const copy = { ...prev };
      if (copy[p.id]) {
        delete copy[p.id];
      } else {
        copy[p.id] = {
          product: p,
          name: p.name,
          sku: p.shortcutCode || p.barcode || p.id.slice(-6),
          barcode: p.barcode || '',
          category: p.category || 'General',
          orderQuantity: 10,
          costPrice: p.costPrice || (p.price ? Math.round(p.price * 0.75 * 100) / 100 : 100),
          sellingPrice: p.price || 150,
          unitType: p.unitType || 'pcs'
        };
      }
      return copy;
    });
  };

  const handleAddCustomProductToOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!npName.trim()) {
      showToast('error', 'Please enter a product name.');
      return;
    }
    const key = `np_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setChecklist(prev => ({
      ...prev,
      [key]: {
        name: npName.trim(),
        sku: npSku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
        barcode: npBarcode.trim() || `890${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        category: npCategory,
        orderQuantity: npQty || 10,
        costPrice: npCostPrice || 100,
        sellingPrice: npSellingPrice || 150,
        unitType: npUnit
      }
    }));
    setNpName('');
    setNpSku('');
    setNpBarcode('');
    setNpCostPrice(0);
    setNpSellingPrice(0);
    setNpQty(10);
    setIsNewProductModalOpen(false);
    showToast('success', 'New product added to order items.');
  };

  const newOrderTotalAmount = useMemo(() => {
    return Object.values(checklist).reduce((sum, item) => sum + (item.orderQuantity * item.costPrice), 0);
  }, [checklist]);

  // Proceed to Advance Payment Step
  const handleProceedToAdvancePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderSupplierId) {
      showToast('error', 'Please select a supplier.');
      return;
    }
    const itemsList = Object.values(checklist);
    if (itemsList.length === 0) {
      showToast('error', 'Please add at least one product to the purchase order.');
      return;
    }

    const sup = suppliers.find(s => s.id === orderSupplierId);
    if (!sup) {
      showToast('error', 'Selected supplier not found.');
      return;
    }

    const orderId = `po_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const orderNumber = `PO-${Math.floor(100 + Math.random() * 900)}`;

    const orderItems: SupplierOrderItem[] = itemsList.map((i, idx) => ({
      id: `poi_${Date.now()}_${idx}`,
      productId: i.product?.id,
      name: i.name,
      category: i.category,
      barcode: i.barcode,
      sku: i.sku,
      orderQuantity: i.orderQuantity,
      previouslyReceivedQuantity: 0,
      remainingQuantity: i.orderQuantity,
      unitType: i.unitType,
      costPrice: i.costPrice,
      sellingPrice: i.sellingPrice,
      estimatedTotal: i.orderQuantity * i.costPrice,
      deliveryStatus: 'pending'
    }));

    const payload = {
      id: orderId,
      storeId: store.id,
      supplierId: sup.id,
      supplierName: sup.name,
      orderNumber,
      orderDate,
      contactNumber: sup.phone,
      items: orderItems,
      status: 'ordered',
      deliveryStatus: 'pending',
      paymentStatus: 'unpaid',
      totalOrderAmount: newOrderTotalAmount,
      advancePaidAmount: 0,
      totalPaidAmount: 0,
      notes: orderNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setPendingOrderPayload(payload);
    setAdvanceAmountInput('0');
    setAdvancePaymentMethod('Cash');
    setAdvanceRefNotes(`Advance payment for ${orderNumber}`);
  };

  // Confirm Purchase Order and Advance Payment
  const handleConfirmOrderAndAdvance = async () => {
    if (!pendingOrderPayload) return;
    setIsSubmitting(true);

    try {
      const advAmount = parseFloat(advanceAmountInput) || 0;

      const po: any = {
        ...pendingOrderPayload,
        advancePaidAmount: advAmount,
        advancePaymentMethod: advAmount > 0 ? advancePaymentMethod : undefined,
        advanceNotes: advAmount > 0 ? (advanceRefNotes || undefined) : undefined,
        totalPaidAmount: advAmount,
        paymentStatus: advAmount >= (pendingOrderPayload.totalOrderAmount || 0) ? 'paid' : advAmount > 0 ? 'partially_paid' : 'unpaid'
      };

      // If advance payment > 0, record expense and payment transaction
      if (advAmount > 0) {
        const expRef = await addDoc(collection(db, 'expenses'), {
          storeId: store.id,
          title: `Advance Payment: ${po.supplierName} (${po.orderNumber})`,
          amount: advAmount,
          category: 'Transport & Logistics',
          date: new Date().toISOString().split('T')[0],
          paymentMethod: advancePaymentMethod.toLowerCase(),
          notes: advanceRefNotes || `Advance payment for ${po.orderNumber}`,
          createdAt: new Date().toISOString()
        });
        po.paymentExpenseId = expRef.id;

        const payId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const payRecord: SupplierPayment = {
          id: payId,
          storeId: store.id,
          supplierId: po.supplierId,
          supplierName: po.supplierName,
          purchaseOrderId: po.id,
          orderNumber: po.orderNumber,
          amount: advAmount,
          paymentMethod: advancePaymentMethod,
          paymentDate: new Date().toISOString().split('T')[0],
          reference: advanceRefNotes,
          expenseId: expRef.id,
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'supplier_payments', payId), cleanFirestoreData(payRecord));
      }

      await setDoc(doc(db, 'supplier_orders', po.id), cleanFirestoreData(po));

      const sup = suppliers.find(s => s.id === po.supplierId);
      generateOrderProductListPdf(po, store, sup);

      showToast('success', `Purchase Order ${po.orderNumber} created successfully & product list PDF downloaded!`);
      setPendingOrderPayload(null);
      setChecklist({});
      setOrderNotes('');
      setMainTab('orders');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Failed to create order: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWhatsAppShareOrder = (order: SupplierOrder) => {
    const itemsText = (order.items || [])
      .map((i, idx) => `${idx + 1}. *${i.name}* - ${i.orderQuantity} ${i.unitType || 'pcs'} (Cost: Rs. ${i.costPrice})`)
      .join('\n');

    const msg = `🛒 *PURCHASE ORDER* — _${store.name}_\n` +
      `PO #: *${order.orderNumber}*\n` +
      `Date: ${order.orderDate}\n\n` +
      `*Items List:*\n${itemsText}\n\n` +
      `💰 *Total Amount:* Rs. ${(order.totalOrderAmount || 0).toFixed(2)}\n` +
      (order.notes ? `📝 *Notes:* ${order.notes}\n\n` : '\n') +
      `_Please confirm dispatch._`;

    const sup = suppliers.find(s => s.id === order.supplierId);
    const phone = sup?.phone ? sup.phone.replace(/[^0-9+]/g, '') : '';
    const url = phone 
      ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    window.open(url, '_blank');
    showToast('success', 'Opening WhatsApp to share order.');
  };

  const handleNativeShare = async (order: SupplierOrder) => {
    const itemsText = (order.items || [])
      .map((i, idx) => `${idx + 1}. ${i.name} - ${i.orderQuantity} ${i.unitType || 'pcs'}`)
      .join('\n');

    const shareData = {
      title: `Purchase Order ${order.orderNumber}`,
      text: `🛒 PURCHASE ORDER — ${store.name}\n` +
        `PO #: ${order.orderNumber}\n` +
        `Date: ${order.orderDate}\n\n` +
        `Items List:\n${itemsText}\n\n` +
        `💰 Total Amount: Rs. ${(order.totalOrderAmount || 0).toFixed(2)}\n` +
        (order.notes ? `📝 Notes: ${order.notes}\n\n` : ''),
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        showToast('success', 'Shared successfully.');
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      showToast('error', 'Sharing not supported on this browser.');
    }
  };



  // Open Delivery Verification Interface
  const openDeliveryVerification = (order: SupplierOrder) => {
    setVerifyingOrder(order);
    const initItems: GoodsReceiptItem[] = (order.items || []).map(i => {
      const previouslyRec = i.previouslyReceivedQuantity || 0;
      const remaining = Math.max(0, i.orderQuantity - previouslyRec);
      return {
        productId: i.productId,
        name: i.name,
        barcode: i.barcode,
        sku: i.sku,
        orderedQuantity: i.orderQuantity,
        previouslyReceived: previouslyRec,
        remainingQuantity: remaining,
        receiveNow: remaining,
        costPrice: i.costPrice || 0,
        sellingPrice: i.sellingPrice || 0,
        totalCost: remaining * (i.costPrice || 0),
        status: remaining === 0 ? 'Complete' : 'Pending',
        verified: remaining > 0
      };
    });
    setVerificationItems(initItems);
  };

  // Confirm Delivery & Update Stock (Only after verification)
  const handleConfirmDeliveryAndStockUpdate = async () => {
    if (!verifyingOrder) return;
    setIsSubmitting(true);

    try {
      const order = verifyingOrder;
      let totalQtyReceivedThisTime = 0;
      let totalPurchaseCostThisTime = 0;
      let newProductsAddedCount = 0;
      let stockValueAddedCount = 0;
      let updatedProductsCount = 0;

      const updatedItems: SupplierOrderItem[] = order.items.map((item, idx) => {
        const v = verificationItems[idx];
        const receiveNow = Number(v?.receiveNow) || 0;
        const prevRec = item.previouslyReceivedQuantity || 0;
        const newTotalRec = prevRec + receiveNow;
        const remaining = Math.max(0, item.orderQuantity - newTotalRec);
        
        let status: 'pending' | 'partially_received' | 'fully_received' = 'pending';
        if (newTotalRec >= item.orderQuantity) status = 'fully_received';
        else if (newTotalRec > 0) status = 'partially_received';

        if (receiveNow > 0) {
          totalQtyReceivedThisTime += receiveNow;
          totalPurchaseCostThisTime += receiveNow * (v.costPrice || item.costPrice);
        }

        return {
          ...item,
          previouslyReceivedQuantity: newTotalRec,
          remainingQuantity: remaining,
          costPrice: v.costPrice || item.costPrice,
          sellingPrice: v.sellingPrice || item.sellingPrice,
          deliveryStatus: status
        };
      });

      // Overall order delivery status
      const allFully = updatedItems.every(i => i.deliveryStatus === 'fully_received');
      const anyReceived = updatedItems.some(i => (i.previouslyReceivedQuantity || 0) > 0);
      const overallDeliveryStatus = allFully ? 'fully_received' : anyReceived ? 'partially_received' : 'pending';

      // 1. Record Goods Receipt in Firebase
      const receiptId = `gr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const receiptNumber = `GR-${Math.floor(1000 + Math.random() * 9000)}`;

      const receiptPayload: GoodsReceipt = {
        id: receiptId,
        storeId: store.id,
        purchaseOrderId: order.id,
        orderNumber: order.orderNumber,
        supplierId: order.supplierId,
        supplierName: order.supplierName,
        receiptNumber,
        receivedDate: new Date().toISOString().split('T')[0],
        items: verificationItems.map(v => ({
          ...v,
          totalCost: v.receiveNow * v.costPrice
        })),
        totalQuantityReceived: totalQtyReceivedThisTime,
        totalPurchaseCost: totalPurchaseCostThisTime,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'goods_receipts', receiptId), cleanFirestoreData(receiptPayload));

      // 2. Update stock & product records only for verified received quantities
      for (let i = 0; i < order.items.length; i++) {
        const item = order.items[i];
        const v = verificationItems[i];
        const receiveNow = Number(v?.receiveNow) || 0;
        if (receiveNow <= 0 || !v.verified) continue;

        let targetProductId = item.productId;
        let productExists = false;

        if (targetProductId) {
          const pRef = doc(db, 'products', targetProductId);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) productExists = true;
        }

        if (productExists && targetProductId) {
          const pRef = doc(db, 'products', targetProductId);
          const pSnap = await getDoc(pRef);
          const data = pSnap.data();
          const curStock = Number(data.stockQuantity) || 0;
          const newStock = Math.round((curStock + receiveNow) * 1000) / 1000;
          stockValueAddedCount += receiveNow * v.costPrice;
          updatedProductsCount++;

          await updateDoc(pRef, cleanFirestoreData({
            stockQuantity: newStock,
            costPrice: v.costPrice,
            price: v.sellingPrice,
            updatedAt: new Date().toISOString()
          }));
        } else {
          // Create new product in stock
          const newProdId = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const newProd: Product = {
            id: newProdId,
            storeId: store.id,
            barcode: item.barcode || `890${Math.floor(1000000000 + Math.random() * 9000000000)}`,
            shortcutCode: item.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
            name: item.name,
            category: item.category || 'General',
            costPrice: v.costPrice,
            price: v.sellingPrice,
            stockQuantity: receiveNow,
            minStockLevel: 5,
            sellBy: 'unit',
            unitType: (item.unitType as any) || 'piece',
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
          };
          newProductsAddedCount++;
          stockValueAddedCount += receiveNow * v.costPrice;
          await setDoc(doc(db, 'products', newProdId), cleanFirestoreData(newProd));

          // Link productId back to item
          updatedItems[i].productId = newProdId;
        }
      }

      // 3. Update Purchase Order status
      await updateDoc(doc(db, 'supplier_orders', order.id), cleanFirestoreData({
        items: updatedItems,
        deliveryStatus: overallDeliveryStatus,
        status: overallDeliveryStatus === 'fully_received' ? 'delivered' : 'ordered',
        deliveredAt: overallDeliveryStatus === 'fully_received' ? new Date().toISOString() : order.deliveredAt,
        updatedAt: new Date().toISOString()
      }));

      setIsDeliveryConfirmedScreen({
        orderId: order.orderNumber,
        updatedProductsCount: updatedProductsCount + newProductsAddedCount,
        totalQty: totalQtyReceivedThisTime,
        newProductsAdded: newProductsAddedCount,
        stockValueAdded: stockValueAddedCount
      });
      setVerifyingOrder(null);
      showToast('success', 'Delivery verified and stock successfully updated!');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Failed to confirm delivery: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Make Payment Handler
  const handleConfirmMakePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalOrder || !paymentModalSupplier) return;
    const amount = parseFloat(paymentAmountInput) || 0;
    if (amount <= 0) {
      showToast('error', 'Please enter a valid payment amount.');
      return;
    }

    const orderId = paymentModalOrder.id;
    const supId = paymentModalSupplier.id;

    setIsSubmitting(true);
    try {
      // 1. Record expense to deduct from store revenue/profit
      const expRef = await addDoc(collection(db, 'expenses'), {
        storeId: store.id,
        title: `Supplier Payment: ${paymentModalSupplier.name} (${paymentModalOrder.orderNumber})`,
        amount,
        category: 'Transport & Logistics',
        date: paymentDateInput,
        paymentMethod: paymentMethodInput.toLowerCase(),
        notes: paymentReferenceInput || paymentNotesInput || `Payment for ${paymentModalOrder.orderNumber}`,
        createdAt: new Date().toISOString()
      });

      // 2. Record payment record
      const payId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const paymentRecord: SupplierPayment = {
        id: payId,
        storeId: store.id,
        supplierId: supId,
        supplierName: paymentModalSupplier.name,
        purchaseOrderId: orderId,
        orderNumber: paymentModalOrder.orderNumber,
        amount,
        paymentMethod: paymentMethodInput,
        paymentDate: paymentDateInput,
        reference: paymentReferenceInput || undefined,
        notes: paymentNotesInput || undefined,
        expenseId: expRef.id,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'supplier_payments', payId), cleanFirestoreData(paymentRecord));

      // 3. Update PO total paid amount and payment status
      const newTotalPaid = (paymentModalOrder.advancePaidAmount || 0) + (paymentModalOrder.totalPaidAmount - (paymentModalOrder.advancePaidAmount || 0)) + amount;
      // recalculate total paid across all payments for this order
      const orderPaymentsTotal = payments
        .filter(p => p.purchaseOrderId === orderId)
        .reduce((sum, p) => sum + (p.amount || 0), 0) + amount + (paymentModalOrder.advancePaidAmount || 0);

      const paymentStatus: 'unpaid' | 'partially_paid' | 'paid' = 
        orderPaymentsTotal >= (paymentModalOrder.totalOrderAmount || 0) ? 'paid' : orderPaymentsTotal > 0 ? 'partially_paid' : 'unpaid';

      await updateDoc(doc(db, 'supplier_orders', orderId), cleanFirestoreData({
        totalPaidAmount: orderPaymentsTotal,
        paymentStatus,
        updatedAt: new Date().toISOString()
      }));

      showToast('success', `Payment of Rs. ${amount.toFixed(2)} recorded successfully!`);
      setPaymentModalOrder(null);
      setPaymentModalSupplier(null);
      setPaymentAmountInput('0');
      setPaymentReferenceInput('');
      setPaymentNotesInput('');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Failed to process payment: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSuppliers = useMemo(() => {
    const term = supplierSearch.trim().toLowerCase();
    if (!term) return suppliers;
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(term) ||
      s.phone.includes(term) ||
      (s.businessName && s.businessName.toLowerCase().includes(term))
    );
  }, [suppliers, supplierSearch]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex flex-col select-none">
      {/* Top Header & Navigation Bar */}
      <div className="bg-white border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <UniversalBackButton onBack={onBack} label="Back to Dashboard" />
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center shadow-xs">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base font-black text-slate-900 leading-tight">Supplier Management</h1>
                <p className="text-[11px] text-slate-500">Profiles, Purchase Orders, Goods Verification & Dues</p>
              </div>
            </div>
          </div>

          {/* Module Switcher Tabs */}
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setMainTab('suppliers')}
                className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  mainTab === 'suppliers' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5 text-orange-600" />
                <span>Suppliers ({suppliers.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingSupplier(null);
                  setSupName('');
                  setSupPhone('');
                  setSupAddress('');
                  setSupBusiness('');
                  setSupEmail('');
                  setSupNotes('');
                  setMainTab('add_supplier');
                }}
                className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  mainTab === 'add_supplier' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Add Supplier</span>
              </button>

              <button
                type="button"
                onClick={() => setMainTab('orders')}
                className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  mainTab === 'orders' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package className="w-3.5 h-3.5 text-blue-600" />
                <span>Purchase Orders ({orders.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setMainTab('payments')}
                className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  mainTab === 'payments' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                <span>Payments History</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingSupplier(null);
                setSupName('');
                setSupPhone('');
                setSupAddress('');
                setSupBusiness('');
                setSupEmail('');
                setSupNotes('');
                setMainTab('add_supplier');
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Supplier</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOrderSupplierId(suppliers[0]?.id || '');
                setChecklist({});
                setMainTab('new_order');
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create Order</span>
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
            className={`max-w-md mx-auto mt-4 px-4 py-3 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 z-50 ${
              notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{notification.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">

        {/* TOP STATS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Suppliers</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{globalStats.totalSuppliers}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Purchases</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">Rs. {formatCurrency(globalStats.totalPurchases)}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Paid</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-1">Rs. {formatCurrency(globalStats.totalPaid)}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Outstanding Dues</p>
              <h3 className="text-2xl font-black text-rose-600 mt-1">Rs. {formatCurrency(globalStats.outstandingDues)}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* 1. SUPPLIERS LIST TAB */}
        {mainTab === 'suppliers' && (
          <div className="space-y-4">
            {/* Toolbar: Search, Layout Switcher & Actions */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>Suppliers Directory</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                    {filteredSuppliers.length} Suppliers
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Click any supplier block to view Pending Orders, History, and Download Product Lists or Ledgers.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    placeholder="Search supplier, phone, company..."
                    className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-orange-500 w-56 sm:w-64 bg-slate-50 font-medium"
                  />
                </div>

                {/* Blocks vs Table Toggle */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSupplierViewLayout('blocks')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      supplierViewLayout === 'blocks'
                        ? 'bg-white text-orange-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Card / Blocks Grid View"
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span>Blocks</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSupplierViewLayout('table')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      supplierViewLayout === 'table'
                        ? 'bg-white text-orange-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Classic Table View"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>Table</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingSupplier(null);
                    setSupName('');
                    setSupPhone('');
                    setSupAddress('');
                    setSupBusiness('');
                    setSupEmail('');
                    setSupNotes('');
                    setMainTab('add_supplier');
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add Supplier</span>
                </button>
              </div>
            </div>

            {filteredSuppliers.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                <User className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <h3 className="text-base font-bold text-slate-800">No Suppliers Found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {supplierSearch ? 'No suppliers match your search query.' : 'Create your first supplier profile to start placing purchase orders.'}
                </p>
                <button
                  onClick={() => {
                    setEditingSupplier(null);
                    setSupName('');
                    setSupPhone('');
                    setSupAddress('');
                    setSupBusiness('');
                    setSupEmail('');
                    setSupNotes('');
                    setMainTab('add_supplier');
                  }}
                  className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Create Supplier Profile</span>
                </button>
              </div>
            ) : supplierViewLayout === 'blocks' ? (
              /* SUPPLIER BLOCKS (CARDS GRID VIEW) */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredSuppliers.map((sup) => {
                  const fin = supplierFinancials[sup.id] || { totalPurchases: 0, totalPaid: 0, outstanding: 0, pendingCount: 0, partialCount: 0, fullCount: 0 };
                  const pendingTotal = (fin.pendingCount || 0) + (fin.partialCount || 0);
                  const hasDues = fin.outstanding > 0;
                  const supOrders = orders.filter(o => o.supplierId === sup.id);

                  return (
                    <div
                      key={sup.id}
                      onClick={() => {
                        setSelectedSupplierForView(sup);
                        setSupplierDetailTab('pending');
                      }}
                      className="group bg-white rounded-2xl border border-slate-200 hover:border-orange-400 hover:shadow-lg transition-all p-5 flex flex-col justify-between cursor-pointer relative overflow-hidden"
                    >
                      {/* Top Bar / Header */}
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                              {sup.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-extrabold text-slate-900 text-base group-hover:text-orange-600 transition-colors truncate">
                                  {sup.name}
                                </h3>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold shrink-0">
                                  {sup.status}
                                </span>
                              </div>
                              {sup.businessName ? (
                                <p className="text-xs font-semibold text-slate-500 truncate flex items-center gap-1 mt-0.5">
                                  <Building className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>{sup.businessName}</span>
                                </p>
                              ) : (
                                <p className="text-[11px] font-mono text-slate-400 mt-0.5">#{sup.id.slice(-6)}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditSupplier(sup);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Edit Supplier Profile"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Contact info */}
                        <div className="mt-3.5 space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-medium font-mono">{sup.phone}</span>
                          </div>
                          {sup.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-medium truncate">{sup.email}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-medium truncate">{sup.address}</span>
                          </div>
                        </div>

                        {/* Financial stats strip */}
                        <div className="mt-4 grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Purchases</span>
                            <div className="font-mono font-bold text-slate-900 mt-0.5">
                              Rs. {formatCurrency(fin.totalPurchases)}
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Paid</span>
                            <div className="font-mono font-bold text-emerald-700 mt-0.5">
                              Rs. {formatCurrency(fin.totalPaid)}
                            </div>
                          </div>
                          <div className="col-span-2 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Outstanding Dues</span>
                              <div className={`font-mono font-black text-sm ${hasDues ? 'text-rose-600' : 'text-emerald-600'}`}>
                                Rs. {formatCurrency(fin.outstanding)}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Orders</span>
                              <div className="font-bold text-xs text-slate-700 mt-0.5">
                                {pendingTotal > 0 ? (
                                  <span className="text-orange-600">{pendingTotal} Pending</span>
                                ) : (
                                  <span className="text-emerald-700">{supOrders.length} Done</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons: Pending Order, History, and Downloads */}
                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                        {/* Two options: Pending Order & History */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSupplierForView(sup);
                              setSupplierDetailTab('pending');
                            }}
                            className="py-2 px-3 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-orange-200"
                          >
                            <Clock className="w-3.5 h-3.5 text-orange-600" />
                            <span>Pending Order</span>
                            {pendingTotal > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full bg-orange-600 text-white text-[10px] font-black">
                                {pendingTotal}
                              </span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSupplierForView(sup);
                              setSupplierDetailTab('history');
                            }}
                            className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                            <span>History</span>
                            <span className="text-[10px] text-slate-500 font-semibold">({supOrders.length})</span>
                          </button>
                        </div>

                        {/* Direct Download options for Products list and Ledger */}
                        <div className="grid grid-cols-2 gap-2">


                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadSupplierLedger(sup);
                            }}
                            className="py-1.5 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 text-[11px] font-bold transition-colors flex items-center justify-center gap-1 border border-blue-200 cursor-pointer"
                            title="Download supplier ledger showing exact payment time & method (CSV)"
                          >
                            <FileSpreadsheet className="w-3 h-3 text-blue-600" />
                            <span className="truncate">Download Ledger</span>
                          </button>
                        </div>

                        {hasDues && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPaymentModal(sup);
                            }}
                            className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pay Dues (Rs. {formatCurrency(fin.outstanding)})</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* SUPPLIERS TABLE VIEW */
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3">ID</th>
                        <th className="p-3">Supplier Name</th>
                        <th className="p-3">Phone</th>
                        <th className="p-3">Business Name</th>
                        <th className="p-3 text-right">Total Purchases</th>
                        <th className="p-3 text-right">Outstanding Dues</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSuppliers.map((sup) => {
                        const fin = supplierFinancials[sup.id] || { totalPurchases: 0, outstanding: 0 };
                        return (
                          <tr key={sup.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 font-mono text-slate-500 font-bold">#{sup.id.slice(-6)}</td>
                            <td className="p-3 font-bold text-slate-900">
                              <div className="flex items-center gap-2">
                                <span>{sup.name}</span>
                                {sup.businessName && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                                    {sup.businessName}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-slate-600 font-mono">{sup.phone}</td>
                            <td className="p-3 text-slate-600">{sup.businessName || '-'}</td>
                            <td className="p-3 text-right font-mono font-bold text-slate-900">Rs. {formatCurrency(fin?.totalPurchases)}</td>
                            <td className="p-3 text-right font-mono font-bold text-rose-600">Rs. {formatCurrency(fin?.outstanding)}</td>
                            <td className="p-3 text-center">
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                {sup.status}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSupplierForView(sup);
                                    setSupplierDetailTab('pending');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 font-bold text-xs cursor-pointer flex items-center gap-1"
                                  title="View Pending Orders"
                                >
                                  <Clock className="w-3.5 h-3.5" /> Pending
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSupplierForView(sup);
                                    setSupplierDetailTab('history');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs cursor-pointer flex items-center gap-1"
                                  title="View History & Payments"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" /> History
                                </button>
                                <button
                                  type="button"
                                  className="p-1 rounded-lg text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                                  title="Download Products List"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadSupplierLedger(sup)}
                                  className="p-1 rounded-lg text-blue-700 hover:bg-blue-50 cursor-pointer"
                                  title="Download Ledger Statement"
                                >
                                  <FileSpreadsheet className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditSupplier(sup)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                                  title="Edit Supplier"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 1b. ADD SUPPLIER OPTION & FUNCTION */}
        {mainTab === 'add_supplier' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden max-w-4xl mx-auto">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-emerald-50/60 to-teal-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    {editingSupplier ? 'Edit Supplier Profile' : 'Add New Supplier Profile'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enter supplier details below. Once saved, this supplier will immediately appear in Supplier Management and will be available for purchase orders.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMainTab('suppliers')}
                className="px-4 py-2 rounded-xl text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto shadow-2xs"
              >
                ← View Suppliers Directory
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                    Supplier Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={supName}
                      onChange={(e) => setSupName(e.target.value)}
                      placeholder="e.g. National Foods Distributors"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={supPhone}
                      onChange={(e) => setSupPhone(e.target.value)}
                      placeholder="e.g. +92 300 1234567"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                    Business / Company Name <span className="text-slate-400 text-[10px] font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={supBusiness}
                      onChange={(e) => setSupBusiness(e.target.value)}
                      placeholder="e.g. National Foods Pvt Ltd"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                    Email Address <span className="text-slate-400 text-[10px] font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={supEmail}
                      onChange={(e) => setSupEmail(e.target.value)}
                      placeholder="e.g. orders@nationalfoods.com"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                  Complete Address / Location <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <textarea
                    required
                    rows={2}
                    value={supAddress}
                    onChange={(e) => setSupAddress(e.target.value)}
                    placeholder="Enter physical address, city, warehouse or market stall number..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                  Supplier Notes & Delivery Terms <span className="text-slate-400 text-[10px] font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={supNotes}
                    onChange={(e) => setSupNotes(e.target.value)}
                    placeholder="e.g. Delivers every Monday, 15 days credit terms"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-emerald-950 text-xs flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-extrabold">Instant Supplier Directory Sync</p>
                  <p className="text-emerald-900/80 text-[11px]">
                    Once saved, this supplier will immediately show in the Supplier Management directory table, purchase order creation dropdown, and ledger tracking.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingSupplier(null);
                    setSupName('');
                    setSupPhone('');
                    setSupAddress('');
                    setSupBusiness('');
                    setSupEmail('');
                    setSupNotes('');
                    setMainTab('suppliers');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-7 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isSubmitting ? 'Saving Supplier...' : editingSupplier ? 'Update Supplier Profile' : 'Save Supplier & View in Directory'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 2. PURCHASE ORDERS TAB */}
        {mainTab === 'orders' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900">Purchase Orders</h2>
                <p className="text-xs text-slate-500">Track shipments, verify delivered goods, and manage PO statuses.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOrderSupplierId(suppliers[0]?.id || '');
                  setChecklist({});
                  setMainTab('new_order');
                }}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Create Purchase Order</span>
              </button>
            </div>

            {orders.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <h3 className="text-base font-bold text-slate-800">No Purchase Orders</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Create your first purchase order to stock products from suppliers.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">PO #</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Supplier Name</th>
                      <th className="p-3 text-right">Total Amount</th>
                      <th className="p-3 text-center">Delivery Status</th>
                      <th className="p-3 text-center">Payment Status</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.map((po) => {
                      const dStatus = po.deliveryStatus || 'pending';
                      const pStatus = po.paymentStatus || 'unpaid';

                      return (
                        <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-mono font-bold text-slate-900">{po.orderNumber}</td>
                          <td className="p-3 text-slate-500">{po.orderDate}</td>
                          <td className="p-3 font-bold text-slate-900">{po.supplierName}</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">Rs. {formatCurrency(po.totalOrderAmount)}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                              dStatus === 'fully_received' ? 'bg-emerald-100 text-emerald-800' :
                              dStatus === 'partially_received' ? 'bg-amber-100 text-amber-800' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {dStatus === 'fully_received' ? 'Fully Received' : dStatus === 'partially_received' ? 'Partially Received' : 'Pending'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                              pStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                              pStatus === 'partially_paid' ? 'bg-amber-100 text-amber-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {pStatus === 'paid' ? 'Paid' : pStatus === 'partially_paid' ? 'Partially Paid' : 'Unpaid'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {dStatus !== 'fully_received' && (
                                <button
                                  type="button"
                                  onClick={() => openDeliveryVerification(po)}
                                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer flex items-center gap-1 shadow-xs"
                                >
                                  <Truck className="w-3.5 h-3.5" /> Delivered
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleNativeShare(po)}
                                className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 cursor-pointer"
                                title="Share Order"
                              >
                                <Share2 className="w-4 h-4 text-indigo-600" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const sup = suppliers.find(s => s.id === po.supplierId);
                                  if (sup) {
                                    setPaymentModalSupplier(sup);
                                    setPaymentModalOrder(po);
                                    const fin = supplierFinancials[sup.id];
                                    const remainingBal = Math.max(0, po.totalOrderAmount - po.totalPaidAmount);
                                    setPaymentAmountInput(remainingBal.toString());
                                  }
                                }}
                                className="px-3 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs cursor-pointer"
                              >
                                Pay
                              </button>
                            </div>
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

        {/* 3. PAYMENTS HISTORY TAB */}
        {mainTab === 'payments' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h2 className="text-base font-black text-slate-900">Supplier Payments History</h2>
              <p className="text-xs text-slate-500">Complete audit trail of all payments made to suppliers.</p>
            </div>

            {payments.length === 0 ? (
              <div className="p-12 text-center">
                <CreditCard className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <h3 className="text-base font-bold text-slate-800">No Payments Recorded</h3>
                <p className="text-xs text-slate-500 mt-1">Payments made against purchase orders will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Payment ID</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Supplier</th>
                      <th className="p-3">PO #</th>
                      <th className="p-3">Method</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3">Reference / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono text-slate-500 font-bold">#{p.id.slice(-6)}</td>
                        <td className="p-3 text-slate-500">{p.paymentDate}</td>
                        <td className="p-3 font-bold text-slate-900">{p.supplierName}</td>
                        <td className="p-3 font-mono font-bold text-orange-600">{p.orderNumber || '-'}</td>
                        <td className="p-3 uppercase font-bold text-slate-700">{p.paymentMethod}</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-600">Rs. {formatCurrency(p.amount)}</td>
                        <td className="p-3 text-slate-600">{p.reference || p.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 4. CREATE PURCHASE ORDER TAB */}
        {mainTab === 'new_order' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">Create Purchase Order</h2>
                <p className="text-xs text-slate-500">Select supplier and add products to create a purchase order.</p>
              </div>
              <button
                type="button"
                onClick={() => setMainTab('suppliers')}
                className="text-xs font-bold text-slate-500 hover:text-slate-900"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Supplier *</label>
                <select
                  value={orderSupplierId}
                  onChange={(e) => setOrderSupplierId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-white text-slate-900"
                >
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} {s.businessName ? `(${s.businessName})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Order Date *</label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white text-slate-900"
                />
              </div>
            </div>

            {/* Add Products Header & Buttons */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">Add Products</h3>
                <p className="text-xs text-slate-500">Search products from stock or add new products directly.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewProductModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Product</span>
                </button>
              </div>
            </div>

            {/* Selected Checklist Items Table */}
            {Object.keys(checklist).length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900 text-white font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3 w-28">SKU/Barcode</th>
                      <th className="p-3 w-28 text-center">Ordered Qty</th>
                      <th className="p-3 w-32 text-right">Purchase Price</th>
                      <th className="p-3 w-32 text-right">Selling Price</th>
                      <th className="p-3 w-32 text-right">Total</th>
                      <th className="p-3 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(checklist).map(([key, item]) => (
                      <tr key={key} className="hover:bg-orange-50/40">
                        <td className="p-3 font-bold text-slate-900">{item.name}</td>
                        <td className="p-3 font-mono text-slate-500">{item.sku}</td>
                        <td className="p-3 text-center">
                          <input
                            type="number"
                            min="0"
                            value={item.orderQuantity}
                            onChange={(e) => {
                              const qty = parseInt(e.target.value, 10) || 1;
                              setChecklist(prev => ({
                                ...prev,
                                [key]: { ...prev[key], orderQuantity: qty }
                              }));
                            }}
                            className="w-20 px-2 py-1 text-center border border-slate-300 rounded-lg text-xs font-mono font-bold"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.costPrice}
                            onChange={(e) => {
                              const cp = parseFloat(e.target.value) || 0;
                              setChecklist(prev => ({
                                ...prev,
                                [key]: { ...prev[key], costPrice: cp }
                              }));
                            }}
                            className="w-24 px-2 py-1 text-right border border-slate-300 rounded-lg text-xs font-mono font-bold"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.sellingPrice}
                            onChange={(e) => {
                              const sp = parseFloat(e.target.value) || 0;
                              setChecklist(prev => ({
                                ...prev,
                                [key]: { ...prev[key], sellingPrice: sp }
                              }));
                            }}
                            className="w-24 px-2 py-1 text-right border border-emerald-300 rounded-lg text-xs font-mono font-bold text-emerald-900 bg-emerald-50/50"
                          />
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          Rs. {(((item.orderQuantity || 0) * (item.costPrice || 0)) || 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setChecklist(prev => {
                                const copy = { ...prev };
                                delete copy[key];
                                return copy;
                              });
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Product Stock Catalog Search & Selection */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Select Existing Products from Stock:</h4>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search name, barcode, SKU..."
                      className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs w-60"
                    />
                  </div>
                  <select
                    value={selectedProductCategory}
                    onChange={(e) => setSelectedProductCategory(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 w-12 text-center">Select</th>
                      <th className="p-2.5">Product Name</th>
                      <th className="p-2.5 w-28">SKU/Barcode</th>
                      <th className="p-2.5 w-24 text-right">Current Stock</th>
                      <th className="p-2.5 w-24 text-right">Cost Price</th>
                      <th className="p-2.5 w-24 text-right">Selling Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProductsForOrder.map((p) => {
                      const isSelected = Boolean(checklist[p.id]);
                      return (
                        <tr key={p.id} className={`transition-colors cursor-pointer ${isSelected ? 'bg-orange-50/60' : 'hover:bg-slate-50'}`} onClick={() => handleToggleProductInChecklist(p)}>
                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleProductInChecklist(p)}
                              className="w-4 h-4 rounded text-orange-600 cursor-pointer"
                            />
                          </td>
                          <td className="p-2.5 font-bold text-slate-900">{p.name}</td>
                          <td className="p-2.5 font-mono text-slate-500">{p.shortcutCode || p.barcode || '---'}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-700">{p.stockQuantity} {p.unitType || ''}</td>
                          <td className="p-2.5 text-right font-mono">Rs. {p.costPrice || 0}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">Rs. {p.price}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Total & Next Button */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Total Order Amount:</p>
                <h3 className="text-xl font-black text-orange-600 font-mono">Rs. {formatCurrency(newOrderTotalAmount)}</h3>
                <p className="text-[11px] text-amber-700 font-medium mt-0.5">ℹ️ Stock will only increase after delivery verification and confirmation.</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMainTab('orders')}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProceedToAdvancePayment}
                  disabled={Object.keys(checklist).length === 0}
                  className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-black text-xs shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Next: Advance Payment</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* SUPPLIER PROFILE VIEW MODAL WITH PENDING ORDER, HISTORY & LEDGER */}
      {selectedSupplierForView && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl max-w-5xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[92vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                  {selectedSupplierForView.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900">{selectedSupplierForView.name}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                      {selectedSupplierForView.status}
                    </span>
                    {selectedSupplierForView.businessName && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                        {selectedSupplierForView.businessName}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 font-medium">
                    <span className="flex items-center gap-1 font-mono"><Phone className="w-3.5 h-3.5 text-slate-400" /> {selectedSupplierForView.phone}</span>
                    {selectedSupplierForView.email && (
                      <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-slate-400" /> {selectedSupplierForView.email}</span>
                    )}
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {selectedSupplierForView.address}</span>
                  </div>
                </div>
              </div>

              {/* Header Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">


                <button
                  type="button"
                  onClick={() => handleDownloadSupplierLedger(selectedSupplierForView)}
                  className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs cursor-pointer flex items-center gap-1.5 transition-colors"
                  title="Download full supplier ledger statement with payment times & methods (CSV)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Download Ledger</span>
                </button>

                <button
                  type="button"
                  onClick={() => openPaymentModal(selectedSupplierForView)}
                  className="px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs cursor-pointer shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Make Payment</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedSupplierForView(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Supplier Financials Overview Cards */}
            {(() => {
              const fin = supplierFinancials[selectedSupplierForView.id] || { totalPurchases: 0, totalPaid: 0, outstanding: 0, pendingCount: 0, partialCount: 0, fullCount: 0 };
              const pendingCount = (fin.pendingCount || 0) + (fin.partialCount || 0);

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Purchases</span>
                    <h4 className="text-lg font-black text-slate-900 font-mono mt-0.5">Rs. {formatCurrency(fin.totalPurchases)}</h4>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Paid</span>
                    <h4 className="text-lg font-black text-emerald-600 font-mono mt-0.5">Rs. {formatCurrency(fin.totalPaid)}</h4>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Outstanding Dues</span>
                    <h4 className={`text-lg font-black font-mono mt-0.5 ${fin.outstanding > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      Rs. {formatCurrency(fin.outstanding)}
                    </h4>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pending Orders</span>
                    <h4 className="text-lg font-black text-blue-600 font-mono mt-0.5">
                      {pendingCount} Orders
                    </h4>
                  </div>
                </div>
              );
            })()}

            {/* The 2 Primary Options (Tabs): Pending Order and History (plus Ledger Statement view) */}
            <div className="flex items-center gap-1 border-b border-slate-200 shrink-0">
              {(() => {
                const supOrders = orders.filter(o => o.supplierId === selectedSupplierForView.id);
                const pendingOrders = supOrders.filter(o => (o.deliveryStatus || 'pending') !== 'fully_received' || (o.paymentStatus || 'unpaid') !== 'paid');
                const supPayments = payments.filter(p => p.supplierId === selectedSupplierForView.id);
                const historyOrders = supOrders.filter(o => o.deliveryStatus === 'fully_received');

                return (
                  <>
                    <button
                      type="button"
                      onClick={() => setSupplierDetailTab('pending')}
                      className={`pb-3 px-4 text-xs font-black transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
                        supplierDetailTab === 'pending'
                          ? 'border-orange-600 text-orange-600'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      <span>Pending Order ({pendingOrders.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSupplierDetailTab('history')}
                      className={`pb-3 px-4 text-xs font-black transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
                        supplierDetailTab === 'history'
                          ? 'border-orange-600 text-orange-600'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <RotateCcw className="w-4 h-4 text-blue-600" />
                      <span>History ({historyOrders.length} Completed, {supPayments.length} Payments)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSupplierDetailTab('ledger')}
                      className={`pb-3 px-4 text-xs font-black transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
                        supplierDetailTab === 'ledger'
                          ? 'border-orange-600 text-orange-600'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Ledger Statement</span>
                    </button>
                  </>
                );
              })()}
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
              {/* TAB 1: PENDING ORDERS */}
              {supplierDetailTab === 'pending' && (() => {
                const pendingOrders = orders.filter(
                  o => o.supplierId === selectedSupplierForView.id &&
                  ((o.deliveryStatus || 'pending') !== 'fully_received' || (o.paymentStatus || 'unpaid') !== 'paid')
                );

                if (pendingOrders.length === 0) {
                  return (
                    <div className="p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                      <div>
                        <h4 className="text-base font-bold text-slate-800">No Pending Orders</h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                          All orders for {selectedSupplierForView.name} have been fully delivered and payment accounts are clear.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSupplierForView(null);
                          setOrderSupplierId(selectedSupplierForView.id);
                          setChecklist({});
                          setMainTab('new_order');
                        }}
                        className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Create New Purchase Order</span>
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Active & In-Progress Orders ({pendingOrders.length})
                      </span>
                      <span className="text-xs text-slate-500">
                        Orders awaiting delivery verification or balance clearance
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-3">PO #</th>
                            <th className="p-3">Order Date</th>
                            <th className="p-3">Products Ordered</th>
                            <th className="p-3 text-right">Order Amount</th>
                            <th className="p-3 text-right">Paid</th>
                            <th className="p-3 text-right">Balance Due</th>
                            <th className="p-3 text-center">Delivery Status</th>
                            <th className="p-3 text-center">Payment Status</th>
                            <th className="p-3 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {pendingOrders.map((po) => {
                            const dStatus = po.deliveryStatus || 'pending';
                            const pStatus = po.paymentStatus || 'unpaid';
                            const totalAmount = po.totalOrderAmount || 0;
                            const paidAmount = po.totalPaidAmount || 0;
                            const remaining = Math.max(0, totalAmount - paidAmount);

                            return (
                              <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-3 font-mono font-bold text-slate-900">{po.orderNumber}</td>
                                <td className="p-3 text-slate-600">{po.orderDate}</td>
                                <td className="p-3 max-w-xs">
                                  <div className="text-[11px] text-slate-700 font-medium truncate">
                                    {(po.items || []).map(i => `${i.name} (x${i.orderQuantity})`).join(', ')}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {(po.items || []).length} products
                                  </div>
                                </td>
                                <td className="p-3 text-right font-mono font-bold text-slate-900">
                                  Rs. {formatCurrency(totalAmount)}
                                </td>
                                <td className="p-3 text-right font-mono font-bold text-emerald-700">
                                  Rs. {formatCurrency(paidAmount)}
                                  {po.advancePaymentMethod && (
                                    <span className="block text-[10px] text-slate-400 font-normal">
                                      via {po.advancePaymentMethod}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-right font-mono font-black text-rose-600">
                                  Rs. {formatCurrency(remaining)}
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                                    dStatus === 'fully_received' ? 'bg-emerald-100 text-emerald-800' :
                                    dStatus === 'partially_received' ? 'bg-amber-100 text-amber-800' :
                                    'bg-slate-100 text-slate-700'
                                  }`}>
                                    {dStatus === 'fully_received' ? 'Received' : dStatus === 'partially_received' ? 'Partial' : 'Pending'}
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                                    pStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                                    pStatus === 'partially_paid' ? 'bg-amber-100 text-amber-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {pStatus === 'paid' ? 'Paid' : pStatus === 'partially_paid' ? 'Partial' : 'Unpaid'}
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {dStatus !== 'fully_received' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedSupplierForView(null);
                                          openDeliveryVerification(po);
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer flex items-center gap-1 shadow-2xs"
                                        title="Verify received stock and add to inventory"
                                      >
                                        <Truck className="w-3 h-3" /> Verify
                                      </button>
                                    )}
                                    {remaining > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          openPaymentModal(selectedSupplierForView, po);
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-[11px] cursor-pointer flex items-center gap-1 shadow-2xs"
                                        title="Pay order dues (Cash, HBL, Jazz Cash, Easy Paisa, Other)"
                                      >
                                        <CreditCard className="w-3 h-3" /> Pay
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* TAB 2: HISTORY (COMPLETED ORDERS & PAYMENTS LOGS) */}
              {supplierDetailTab === 'history' && (() => {
                const supOrders = orders.filter(o => o.supplierId === selectedSupplierForView.id);
                const completedOrders = supOrders.filter(o => o.deliveryStatus === 'fully_received');
                const supPayments = payments.filter(p => p.supplierId === selectedSupplierForView.id);

                return (
                  <div className="space-y-6">
                    {/* Payments History (Tells exact time and payment method) */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-emerald-600" />
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                            Payment Transactions History ({supPayments.length})
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownloadSupplierLedger(selectedSupplierForView)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-[11px] flex items-center gap-1 cursor-pointer border border-blue-200"
                        >
                          <FileSpreadsheet className="w-3 h-3" />
                          <span>Export Payments Ledger</span>
                        </button>
                      </div>

                      {supPayments.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                          No direct payment transactions recorded yet. Payments made will appear with exact timestamps and payment methods here.
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                              <tr>
                                <th className="p-3">Payment ID</th>
                                <th className="p-3">Date & Exact Time</th>
                                <th className="p-3">PO Reference</th>
                                <th className="p-3">Payment Method</th>
                                <th className="p-3 text-right">Amount Paid</th>
                                <th className="p-3">Reference / Notes</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {supPayments.map((p) => {
                                const exactTimeStr = p.createdAt ? new Date(p.createdAt).toLocaleString() : `${p.paymentDate} —`;
                                const method = p.paymentMethod || 'Cash';

                                return (
                                  <tr key={p.id} className="hover:bg-slate-50">
                                    <td className="p-3 font-mono font-bold text-slate-500">#{p.id.slice(-6)}</td>
                                    <td className="p-3">
                                      <div className="font-bold text-slate-900">{p.paymentDate}</div>
                                      <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        {exactTimeStr}
                                      </div>
                                    </td>
                                    <td className="p-3 font-mono font-bold text-orange-600">{p.orderNumber || '-'}</td>
                                    <td className="p-3">
                                      <span className={`px-2.5 py-1 rounded-full font-extrabold text-[10px] uppercase border inline-flex items-center gap-1 ${
                                        method === 'HBL' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                        method === 'Jazz Cash' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                        method === 'Easy Paisa' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                        method === 'Cash' ? 'bg-green-50 text-green-700 border-green-200' :
                                        'bg-slate-100 text-slate-700 border-slate-200'
                                      }`}>
                                        <CreditCard className="w-2.5 h-2.5" />
                                        {method}
                                      </span>
                                    </td>
                                    <td className="p-3 text-right font-mono font-black text-emerald-700 text-sm">
                                      Rs. {formatCurrency(p.amount)}
                                    </td>
                                    <td className="p-3 text-slate-600 font-medium">
                                      {p.reference || p.notes || '-'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Completed Purchase Orders */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                          Fulfilled Purchase Orders ({completedOrders.length})
                        </h4>
                      </div>

                      {completedOrders.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                          No fully received orders yet. Once goods are verified and received, they will be archived here.
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                              <tr>
                                <th className="p-3">PO #</th>
                                <th className="p-3">Order Date</th>
                                <th className="p-3">Items Summary</th>
                                <th className="p-3 text-right">Total Order Value</th>
                                <th className="p-3 text-right">Total Paid</th>
                                <th className="p-3 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {completedOrders.map((po) => (
                                <tr key={po.id} className="hover:bg-slate-50">
                                  <td className="p-3 font-mono font-bold text-slate-900">{po.orderNumber}</td>
                                  <td className="p-3 text-slate-600">{po.orderDate}</td>
                                  <td className="p-3 text-slate-700">
                                    {(po.items || []).length} products delivered
                                  </td>
                                  <td className="p-3 text-right font-mono font-bold text-slate-900">
                                    Rs. {formatCurrency(po.totalOrderAmount)}
                                  </td>
                                  <td className="p-3 text-right font-mono font-bold text-emerald-700">
                                    Rs. {formatCurrency(po.totalPaidAmount)}
                                  </td>
                                  <td className="p-3 text-center">
                                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                      Fully Received
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* TAB 3: LEDGER STATEMENT VIEW */}
              {supplierDetailTab === 'ledger' && (() => {
                const supOrders = orders.filter(o => o.supplierId === selectedSupplierForView.id);
                const supPayments = payments.filter(p => p.supplierId === selectedSupplierForView.id);
                const pendingOrders = supOrders.filter(o => o.status !== 'delivered');

                type LedgerEntry = {
                  timestamp: number;
                  exactDateTime: string;
                  date: string;
                  type: 'Purchase Order' | 'Advance Payment' | 'Order Payment';
                  reference: string;
                  paymentMethod: string;
                  debit: number;
                  credit: number;
                  notes: string;
                };

                const entries: LedgerEntry[] = [];

                supOrders.forEach(o => {
                  const oDateStr = o.createdAt || `${o.orderDate}T10:00:00.000Z`;
                  const timeNum = new Date(oDateStr).getTime() || Date.now();
                  const exactTime = o.createdAt ? new Date(o.createdAt).toLocaleString() : `${o.orderDate} 10:00 AM`;

                  entries.push({
                    timestamp: timeNum,
                    exactDateTime: exactTime,
                    date: o.orderDate,
                    type: 'Purchase Order',
                    reference: o.orderNumber,
                    paymentMethod: '-',
                    debit: o.totalOrderAmount || 0,
                    credit: 0,
                    notes: `PO Created (${o.items?.length || 0} line items)`
                  });

                  if ((o.advancePaidAmount || 0) > 0) {
                    entries.push({
                      timestamp: timeNum + 50,
                      exactDateTime: exactTime,
                      date: o.orderDate,
                      type: 'Advance Payment',
                      reference: o.orderNumber,
                      paymentMethod: o.advancePaymentMethod || 'Cash',
                      debit: 0,
                      credit: o.advancePaidAmount || 0,
                      notes: o.advanceNotes || 'Advance payment'
                    });
                  }
                });

                supPayments.forEach(p => {
                  const pDateStr = p.createdAt || `${p.paymentDate}T12:00:00.000Z`;
                  const timeNum = new Date(pDateStr).getTime() || Date.now();
                  const exactTime = p.createdAt ? new Date(p.createdAt).toLocaleString() : `${p.paymentDate} 12:00 PM`;

                  entries.push({
                    timestamp: timeNum + 100,
                    exactDateTime: exactTime,
                    date: p.paymentDate,
                    type: 'Order Payment',
                    reference: p.orderNumber || '-',
                    paymentMethod: p.paymentMethod || 'Cash',
                    debit: 0,
                    credit: p.amount || 0,
                    notes: p.reference || p.notes || 'Settlement'
                  });
                });

                entries.sort((a, b) => a.timestamp - b.timestamp);

                let runningBalance = 0;
                const rows = entries.map(e => {
                  runningBalance += (e.debit - e.credit);
                  return { ...e, runningBalance };
                });

                return (
                  <div className="space-y-4">
                    <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                      <button onClick={() => setLedgerSubTab('payment')} className={`px-4 py-2 rounded-lg text-xs font-bold ${ledgerSubTab === 'payment' ? 'bg-white shadow-xs' : ''}`}>Payment Ledger</button>
                      <button onClick={() => setLedgerSubTab('product')} className={`px-4 py-2 rounded-lg text-xs font-bold ${ledgerSubTab === 'product' ? 'bg-white shadow-xs' : ''}`}>Product Order Ledger</button>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm">
                          {ledgerSubTab === 'payment' ? 'Financial Statement' : 'Product Order History'} for {selectedSupplierForView.name}
                        </h4>
                        <p className="text-xs text-slate-500">
                          Complete audit ledger with timestamps, payment methods, debits, credits, and running balance.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => ledgerSubTab === 'payment' ? handleDownloadSupplierLedger(selectedSupplierForView) : handleDownloadPendingProducts(selectedSupplierForView)}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download {ledgerSubTab === 'payment' ? 'CSV' : 'PDF'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>
                      </div>
                    </div>

                    {ledgerSubTab === 'payment' ? (
                      rows.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                          No financial activity recorded yet for this supplier.
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                              <tr>
                                <th className="p-3">Date & Time</th>
                                <th className="p-3">Type</th>
                                <th className="p-3">Reference</th>
                                <th className="p-3">Payment Method</th>
                                <th className="p-3 text-right">Debit (Orders)</th>
                                <th className="p-3 text-right">Credit (Paid)</th>
                                <th className="p-3 text-right">Running Balance</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {rows.map((r, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="p-3">
                                    <div className="font-sans font-bold text-slate-900">{r.date}</div>
                                    <div className="text-[10px] text-slate-400">{r.exactDateTime}</div>
                                  </td>
                                  <td className="p-3 font-sans">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      r.type === 'Purchase Order' ? 'bg-orange-100 text-orange-800' :
                                      r.type === 'Advance Payment' ? 'bg-blue-100 text-blue-800' :
                                      'bg-emerald-100 text-emerald-800'
                                    }`}>
                                      {r.type}
                                    </span>
                                  </td>
                                  <td className="p-3 font-bold text-slate-700">{r.reference}</td>
                                  <td className="p-3 font-sans">
                                    {r.paymentMethod !== '-' ? (
                                      <span className="font-extrabold text-slate-800">{r.paymentMethod}</span>
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-right text-slate-900 font-bold">
                                    {r.debit > 0 ? `Rs. ${formatCurrency(r.debit)}` : '—'}
                                  </td>
                                  <td className="p-3 text-right text-emerald-700 font-bold">
                                    {r.credit > 0 ? `Rs. ${formatCurrency(r.credit)}` : '—'}
                                  </td>
                                  <td className={`p-3 text-right font-black ${r.runningBalance > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                    Rs. {formatCurrency(r.runningBalance)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    ) : (
                      pendingOrders.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
                          No pending product orders found for this supplier.
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                              <tr>
                                <th className="p-3">Order #</th>
                                <th className="p-3">Product Name</th>
                                <th className="p-3 text-center">Quantity</th>
                                <th className="p-3 text-right">Unit Price</th>
                                <th className="p-3 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {pendingOrders.flatMap(order => 
                                order.items.map((item, idx) => (
                                  <tr key={`${order.id}-${idx}`} className="hover:bg-slate-50">
                                    <td className="p-3 font-sans font-bold text-slate-700">{order.orderNumber}</td>
                                    <td className="p-3 font-sans text-slate-900">{item.name}</td>
                                    <td className="p-3 text-center">{item.orderQuantity}</td>
                                    <td className="p-3 text-right">Rs. {formatCurrency(item.costPrice)}</td>
                                    <td className="p-3 text-right font-bold">Rs. {formatCurrency(item.orderQuantity * item.costPrice)}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                            <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                              <tr>
                                <td colSpan={4} className="p-3 text-right">Grand Total Pending</td>
                                <td className="p-3 text-right text-rose-600">
                                  Rs. {formatCurrency(pendingOrders.reduce((acc, order) => acc + order.items.reduce((sum, item) => sum + (item.orderQuantity * item.costPrice), 0), 0))}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )
                    )}
                  </div>
                );
              })()}
            </div>
          </motion.div>
        </div>
      )}

      {/* ADD / EDIT SUPPLIER PROFILE MODAL */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                {editingSupplier ? 'Edit Supplier Profile' : 'Add Supplier Profile'}
              </h3>
              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Supplier Name *</label>
                <input
                  type="text"
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="e.g. Ali Distributors"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    placeholder="e.g. +92 300 1234567"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Business Name (Optional)</label>
                  <input
                    type="text"
                    value={supBusiness}
                    onChange={(e) => setSupBusiness(e.target.value)}
                    placeholder="e.g. Ali Trading Co."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email (Optional)</label>
                <input
                  type="email"
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  placeholder="e.g. supplier@domain.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Address *</label>
                <textarea
                  required
                  rows={2}
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  placeholder="Enter full address..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold resize-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={supNotes}
                  onChange={(e) => setSupNotes(e.target.value)}
                  placeholder="Additional delivery instructions..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ADVANCE PAYMENT STEP MODAL */}
      {pendingOrderPayload && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-orange-100 text-orange-700 rounded-2xl">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Advance Payment</h3>
                  <p className="text-xs text-slate-500">Add advance payment for this purchase order.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingOrderPayload(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Summary */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between font-bold text-slate-700">
                <span>Order Total:</span>
                <span className="font-mono text-slate-900">Rs. {formatCurrency(pendingOrderPayload?.totalOrderAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-700">
                <span>Advance Paid:</span>
                <span className="font-mono">Rs. {formatCurrency(advanceAmountInput)}</span>
              </div>
              <div className="flex justify-between font-bold text-orange-600 pt-1 border-t border-slate-200 text-sm">
                <span>Remaining Balance:</span>
                <span className="font-mono">Rs. {formatCurrency(Math.max(0, (pendingOrderPayload?.totalOrderAmount || 0) - (parseFloat(advanceAmountInput) || 0)))}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Advance Amount (Rs.) *</label>
                <input
                  type="number"
                  min="0"
                  max={pendingOrderPayload?.totalOrderAmount || 0}
                  step="0.01"
                  value={advanceAmountInput}
                  onChange={(e) => setAdvanceAmountInput(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-bold font-mono text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Method *</label>
                <select
                  value={advancePaymentMethod}
                  onChange={(e) => setAdvancePaymentMethod(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-bold bg-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="HBL">HBL (Habib Bank Limited)</option>
                  <option value="Jazz Cash">Jazz Cash</option>
                  <option value="Easy Paisa">Easy Paisa</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reference / Notes (Optional)</label>
                <input
                  type="text"
                  value={advanceRefNotes}
                  onChange={(e) => setAdvanceRefNotes(e.target.value)}
                  placeholder="e.g. Advance payment reference #"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingOrderPayload(null)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmOrderAndAdvance}
                disabled={isSubmitting}
                className="w-1/2 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-xs shadow-md cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save & Continue'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* DELIVERY VERIFICATION INTERFACE MODAL */}
      {verifyingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl max-w-5xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[95vh] flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-2xl">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Delivery Verification — {verifyingOrder.orderNumber}</h3>
                  <p className="text-xs text-slate-500">Check quantities, cost and selling price for each product.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVerifyingOrder(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Verification Stats Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 shrink-0 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase">Verified Products</span>
                <div className="text-lg font-black text-emerald-700 mt-0.5">
                  {verificationItems.filter(v => v.verified).length} of {verificationItems.length} products verified
                </div>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase">Total Received Quantity</span>
                <div className="text-lg font-black text-blue-600 font-mono mt-0.5">
                  {verificationItems.reduce((sum, v) => sum + v.receiveNow, 0)} units
                </div>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase">Total Purchase Cost</span>
                <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
                  Rs. {formatCurrency(verificationItems.reduce((sum, v) => sum + ((v.receiveNow || 0) * (v.costPrice || 0)), 0))}
                </div>
              </div>
            </div>

            {/* Verification Items Table */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 w-12 text-center">Verify</th>
                    <th className="p-2.5">Product</th>
                    <th className="p-2.5 w-20 text-center">Ordered</th>
                    <th className="p-2.5 w-24 text-center">Prev. Rec.</th>
                    <th className="p-2.5 w-20 text-center">Remaining</th>
                    <th className="p-2.5 w-28 text-center">Receive Now</th>
                    <th className="p-2.5 w-28 text-right">Cost Price</th>
                    <th className="p-2.5 w-28 text-right">Selling Price</th>
                    <th className="p-2.5 w-28 text-right">Total Cost</th>
                    <th className="p-2.5 w-28 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {verificationItems.map((v, idx) => (
                    <tr key={idx} className={`hover:bg-slate-50 ${v.verified ? 'bg-emerald-50/40' : ''}`}>
                      <td className="p-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={v.verified}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setVerificationItems(prev => {
                              const copy = [...prev];
                              copy[idx] = { ...copy[idx], verified: checked };
                              return copy;
                            });
                          }}
                          className="w-4 h-4 rounded text-emerald-600 cursor-pointer"
                        />
                      </td>
                      <td className="p-2.5 font-bold text-slate-900">
                        {v.name}
                        {v.sku && <span className="block text-[10px] text-slate-400 font-mono">SKU: {v.sku}</span>}
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold text-slate-700">{v.orderedQuantity}</td>
                      <td className="p-2.5 text-center font-mono text-slate-500">{v.previouslyReceived}</td>
                      <td className="p-2.5 text-center font-mono font-bold text-orange-600">{v.remainingQuantity}</td>
                      <td className="p-2.5 text-center">
                        <input
                          type="number"
                          min="0"
                          max={v.remainingQuantity}
                          value={v.receiveNow}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                            setVerificationItems(prev => {
                              const copy = [...prev];
                              copy[idx] = { ...copy[idx], receiveNow: val, verified: val > 0 };
                              return copy;
                            });
                          }}
                          className="w-20 px-2 py-1 text-center border border-slate-300 rounded-lg text-xs font-mono font-bold bg-white focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                        />
                      </td>
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={v.costPrice}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setVerificationItems(prev => {
                              const copy = [...prev];
                              copy[idx] = { ...copy[idx], costPrice: val };
                              return copy;
                            });
                          }}
                          className="w-24 px-2 py-1 text-right border border-slate-300 rounded-lg text-xs font-mono font-bold bg-white focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                        />
                      </td>
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={v.sellingPrice}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setVerificationItems(prev => {
                              const copy = [...prev];
                              copy[idx] = { ...copy[idx], sellingPrice: val };
                              return copy;
                            });
                          }}
                          className="w-24 px-2 py-1 text-right border border-emerald-300 rounded-lg text-xs font-mono font-bold text-emerald-900 bg-emerald-50/50 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                        Rs. {(((v.receiveNow || 0) * (v.costPrice || 0)) || 0).toFixed(2)}
                      </td>
                      <td className="p-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          v.receiveNow >= v.remainingQuantity ? 'bg-emerald-100 text-emerald-800' :
                          v.receiveNow > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {v.receiveNow >= v.remainingQuantity ? 'Complete' : v.receiveNow > 0 ? 'Partial' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setVerifyingOrder(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeliveryAndStockUpdate}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Delivery & Update Stock</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* DELIVERY CONFIRMED & STOCK UPDATED SUCCESS SCREEN */}
      {isDeliveryConfirmedScreen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-slate-200 text-center space-y-6"
          >
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <Check className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900">Delivery Confirmed & Stock Updated!</h3>
              <p className="text-xs text-slate-500">The received quantities have been added to your inventory successfully.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Products Updated</span>
                <div className="text-base font-black text-slate-900 mt-0.5">{isDeliveryConfirmedScreen.updatedProductsCount} items</div>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Total Quantity Received</span>
                <div className="text-base font-black text-blue-600 font-mono mt-0.5">{isDeliveryConfirmedScreen.totalQty} units</div>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase">New Products Added</span>
                <div className="text-base font-black text-emerald-600 mt-0.5">{isDeliveryConfirmedScreen.newProductsAdded} items</div>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Stock Value Added</span>
                <div className="text-base font-black text-orange-600 font-mono mt-0.5">Rs. {formatCurrency(isDeliveryConfirmedScreen?.stockValueAdded)}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeliveryConfirmedScreen(null);
                  setMainTab('orders');
                }}
                className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs cursor-pointer shadow-md"
              >
                View Purchase Orders
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MAKE PAYMENT MODAL */}
      {paymentModalOrder && paymentModalSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-orange-100 text-orange-700 rounded-2xl">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Make Payment</h3>
                  <p className="text-xs text-slate-500">{paymentModalSupplier.name} ({paymentModalOrder.orderNumber})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setPaymentModalOrder(null); setPaymentModalSupplier(null); }}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Overview */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between font-bold text-slate-700">
                <span>Total Order Amount:</span>
                <span className="font-mono text-slate-900">Rs. {formatCurrency(paymentModalOrder?.totalOrderAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-700">
                <span>Total Paid (Advance + Previous):</span>
                <span className="font-mono">Rs. {formatCurrency(paymentModalOrder?.totalPaidAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-rose-600 pt-1 border-t border-slate-200 text-sm">
                <span>Outstanding Balance:</span>
                <span className="font-mono">Rs. {formatCurrency(Math.max(0, (paymentModalOrder?.totalOrderAmount || 0) - (paymentModalOrder?.totalPaidAmount || 0)))}</span>
              </div>
            </div>

            <form onSubmit={handleConfirmMakePayment} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Amount to Pay Now (Rs.) *</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={paymentAmountInput}
                  onChange={(e) => setPaymentAmountInput(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-bold font-mono text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Method *</label>
                <select
                  value={paymentMethodInput}
                  onChange={(e) => setPaymentMethodInput(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-bold bg-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="HBL">HBL (Habib Bank Limited)</option>
                  <option value="Jazz Cash">Jazz Cash</option>
                  <option value="Easy Paisa">Easy Paisa</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={paymentDateInput}
                  onChange={(e) => setPaymentDateInput(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-bold bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reference / Notes (Optional)</label>
                <input
                  type="text"
                  value={paymentReferenceInput}
                  onChange={(e) => setPaymentReferenceInput(e.target.value)}
                  placeholder="e.g. TR-12345678"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-bold"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setPaymentModalOrder(null); setPaymentModalSupplier(null); }}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ADD NEW PRODUCT MODAL DURING ORDER CREATION */}
      {isNewProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Add New Product to Order</h3>
              <button
                type="button"
                onClick={() => setIsNewProductModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomProductToOrder} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={npName}
                  onChange={(e) => setNpName(e.target.value)}
                  placeholder="e.g. Premium Basmati Rice 5kg"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">SKU / Code</label>
                  <input
                    type="text"
                    value={npSku}
                    onChange={(e) => setNpSku(e.target.value)}
                    placeholder="e.g. SKU-1001"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Barcode</label>
                  <input
                    type="text"
                    value={npBarcode}
                    onChange={(e) => setNpBarcode(e.target.value)}
                    placeholder="e.g. 890123456789"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Purchase Cost (Rs.) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={npCostPrice}
                    onChange={(e) => setNpCostPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Selling Price (Rs.) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={npSellingPrice}
                    onChange={(e) => setNpSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold font-mono text-emerald-800 bg-emerald-50/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Order Quantity *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={npQty}
                    onChange={(e) => setNpQty(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unit Type</label>
                  <select
                    value={npUnit}
                    onChange={(e) => setNpUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold bg-white"
                  >
                    <option value="pcs">pcs</option>
                    <option value="kg">kg</option>
                    <option value="packs">packs</option>
                    <option value="boxes">boxes</option>
                    <option value="cartons">cartons</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewProductModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black shadow-md cursor-pointer"
                >
                  Add to Order
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
};
