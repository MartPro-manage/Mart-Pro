import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, doc, getDoc, collection, query, where, getDocs, deleteDoc } from '../lib/firebase';
import { Sale, Store } from '../types';
import { isSaleExpired, getReceiptRemainingDays } from '../lib/salesCleanup';
import JsBarcode from 'jsbarcode';
import html2canvas from 'html2canvas';
import { 
  CheckCircle2, 
  Printer, 
  Download, 
  Share2, 
  Copy, 
  Check, 
  ArrowLeft, 
  Phone, 
  MapPin, 
  ShieldCheck, 
  AlertCircle, 
  Search,
  Image as ImageIcon,
  MessageCircle,
  Sparkles,
  Receipt,
  FileCheck,
  Clock,
  ShoppingBag,
  User,
  Wallet,
  ExternalLink,
  ChevronRight,
  Trash2,
  Calendar,
  Layers,
  Store as StoreIcon,
  Smartphone
} from 'lucide-react';

interface PublicReceiptViewProps {
  receiptId?: string | null;
  receiptNumber?: string | null;
  encodedData?: string | null;
  onExitToLogin: () => void;
}

interface CustomerAccountProfile {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
}

interface SavedWalletReceipt {
  id: string;
  receiptNumber: string;
  storeName: string;
  timestamp: string;
  totalAmount: number;
  currency: string;
  itemCount: number;
  saleData?: Sale;
  storeData?: Partial<Store>;
}

const WALLET_STORAGE_KEY = 'mart_pro_customer_wallet_receipts_v1';
const PROFILE_STORAGE_KEY = 'mart_pro_customer_profile_v1';

export const PublicReceiptView: React.FC<PublicReceiptViewProps> = ({
  receiptId,
  receiptNumber,
  encodedData,
  onExitToLogin
}) => {
  const [activeTab, setActiveTab] = useState<'receipt' | 'wallet' | 'profile'>('receipt');
  const [sale, setSale] = useState<Sale | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [manualSearchNumber, setManualSearchNumber] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string | null>(null);
  
  // Customer Mart Pro Account state
  const [customerProfile, setCustomerProfile] = useState<CustomerAccountProfile>(() => {
    try {
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn(e);
    }
    const newId = `MP-${Math.floor(100000 + Math.random() * 900000)}`;
    const newProfile: CustomerAccountProfile = {
      id: newId,
      name: 'Customer Member',
      phone: '',
      createdAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(newProfile));
    } catch (e) {
      console.warn(e);
    }
    return newProfile;
  });

  const [savedReceipts, setSavedReceipts] = useState<SavedWalletReceipt[]>(() => {
    try {
      const saved = localStorage.getItem(WALLET_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn(e);
    }
    return [];
  });

  const [walletFilterSearch, setWalletFilterSearch] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [tempName, setTempName] = useState(customerProfile.name);
  const [tempPhone, setTempPhone] = useState(customerProfile.phone);

  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);
  const receiptCardRef = useRef<HTMLDivElement | null>(null);

  // Helper to save receipt into Mart Pro Wallet locally
  const saveToWallet = (currentSale: Sale, currentStore?: Partial<Store> | null) => {
    if (!currentSale) return;
    try {
      const curr = currentStore?.currencySymbol || '$';
      const storeName = currentStore?.name || currentSale.storeName || 'SUPERMARKET';
      const newEntry: SavedWalletReceipt = {
        id: currentSale.id || `rec_${currentSale.receiptNumber}`,
        receiptNumber: currentSale.receiptNumber,
        storeName: storeName,
        timestamp: currentSale.timestamp,
        totalAmount: currentSale.totalAmount,
        currency: curr,
        itemCount: currentSale.items ? currentSale.items.length : 0,
        saleData: currentSale,
        storeData: currentStore || undefined
      };

      setSavedReceipts((prev) => {
        const filtered = prev.filter(r => r.receiptNumber !== currentSale.receiptNumber && r.id !== currentSale.id);
        const updated = [newEntry, ...filtered];
        try {
          localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(updated.slice(0, 50)));
        } catch (err) {
          console.warn('Wallet save error:', err);
        }
        return updated;
      });
    } catch (err) {
      console.warn('Error saving to wallet:', err);
    }
  };

  // Helper to decode Base64 UTF-8 payload
  const parseEncodedReceipt = (rawEncoded: string): { sale: Sale; store: Partial<Store> } | null => {
    try {
      const binary = atob(rawEncoded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const jsonStr = new TextDecoder().decode(bytes);
      const compact = JSON.parse(jsonStr);

      if (!compact) return null;

      const saleObj: Sale = {
        id: compact.id || `sale_${compact.rn || Date.now()}`,
        receiptNumber: compact.rn || compact.id || '1001',
        storeId: compact.sId || 'store_1',
        storeName: compact.sNm || 'SUPERMARKET',
        counterId: compact.cId || 'counter_1',
        counterName: compact.cNm || 'Cash Counter',
        cashierUsername: compact.cUs || 'cashier',
        timestamp: compact.t || new Date().toISOString(),
        items: Array.isArray(compact.items) ? compact.items.map((it: any) => ({
          productId: it.id || '',
          name: it.n || 'Product',
          barcode: it.b || '',
          price: Number(it.p) || 0,
          quantity: Number(it.q) || 1,
          total: Number(it.t) !== undefined ? Number(it.t) : (Number(it.p) * Number(it.q)),
          unitType: it.u || 'piece',
          sellBy: it.u === 'kg' || (Number(it.q) % 1 !== 0) ? 'weight' : 'unit',
          weightInfo: it.w
        })) : [],
        subtotalAmount: compact.sub !== undefined ? Number(compact.sub) : undefined,
        discountAmount: compact.disc !== undefined ? Number(compact.disc) : undefined,
        totalAmount: Number(compact.tot) || 0,
        paymentMethod: compact.pm || 'cash',
        cashReceived: compact.cr !== undefined ? Number(compact.cr) : undefined,
        changeReturned: compact.ch !== undefined ? Number(compact.ch) : undefined
      };

      const storeObj: Partial<Store> = {
        id: compact.sId || 'store_1',
        name: compact.sNm || 'SUPERMARKET',
        currencySymbol: compact.cur || '$',
        receiptHeader: compact.stH || 'TAX INVOICE / CASH MEMO',
        receiptFooter: compact.stF || 'Thank you for shopping with us! Please visit again.',
        address: compact.stA || '',
        phone: compact.stP || '',
        taxRegistrationNumber: compact.stT || '',
        returnPolicyDays: compact.ret ? Number(compact.ret) : undefined
      };

      return { sale: saleObj, store: storeObj };
    } catch (err) {
      console.warn('Failed to parse encoded receipt data:', err);
      return null;
    }
  };

  // Fetch Sale & Store data
  const loadReceiptData = async (id?: string | null, num?: string | null, rawData?: string | null) => {
    setLoading(true);
    setError(null);

    // 1. Try decoding embedded data payload first (Instant offline-ready load)
    if (rawData) {
      const decoded = parseEncodedReceipt(rawData);
      if (decoded) {
        setSale(decoded.sale);
        setStore(decoded.store as Store);
        saveToWallet(decoded.sale, decoded.store);
        setLoading(false);

        // Fetch fresh store config in background if possible
        if (decoded.sale.storeId) {
          getDoc(doc(db, 'stores', decoded.sale.storeId)).then((snap) => {
            if (snap.exists()) {
              const freshStore = { id: snap.id, ...snap.data() } as Store;
              setStore(freshStore);
              saveToWallet(decoded.sale, freshStore);
            }
          }).catch((e) => console.log('Background store refresh:', e));
        }
        return;
      }
    }

    try {
      let foundSale: Sale | null = null;

      // 2. Try finding by Firestore document ID
      if (id) {
        try {
          const saleDocRef = doc(db, 'sales', id);
          const saleSnap = await getDoc(saleDocRef);
          if (saleSnap.exists()) {
            foundSale = { id: saleSnap.id, ...saleSnap.data() } as Sale;
          }
        } catch (e) {
          console.warn('Doc lookup error, attempting query:', e);
        }
      }

      // 3. Try query by receiptNumber
      if (!foundSale && (num || id)) {
        const targetNum = num || id;
        const salesQuery = query(
          collection(db, 'sales'),
          where('receiptNumber', '==', targetNum)
        );
        const qSnap = await getDocs(salesQuery);
        if (!qSnap.empty) {
          const d = qSnap.docs[0];
          foundSale = { id: d.id, ...d.data() } as Sale;
        }
      }

      if (!foundSale) {
        setError(`Receipt #${num || id || ''} could not be located. It may have expired (retained for 7 days) or was already removed.`);
        setLoading(false);
        return;
      }

      // Check 7-day expiration policy
      if (isSaleExpired(foundSale)) {
        if (foundSale.id) {
          deleteDoc(doc(db, 'sales', foundSale.id)).catch((e) => console.warn('Purge expired receipt:', e));
        }
        setError(`This receipt (#${foundSale.receiptNumber}) is over 7 days old and has been automatically deleted per our 7-day digital retention policy.`);
        setLoading(false);
        return;
      }

      setSale(foundSale);

      // Fetch Store details for headers & addresses
      if (foundSale.storeId) {
        try {
          const storeDocRef = doc(db, 'stores', foundSale.storeId);
          const storeSnap = await getDoc(storeDocRef);
          if (storeSnap.exists()) {
            const fetchedStore = { id: storeSnap.id, ...storeSnap.data() } as Store;
            setStore(fetchedStore);
            saveToWallet(foundSale, fetchedStore);
          } else {
            saveToWallet(foundSale, null);
          }
        } catch (e) {
          console.warn('Store details fetch error:', e);
          saveToWallet(foundSale, null);
        }
      } else {
        saveToWallet(foundSale, null);
      }
    } catch (err: any) {
      console.error('Error fetching public receipt:', err);
      setError('An error occurred while retrieving your e-receipt: ' + (err?.message || 'Check network connection.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check URL Hash or Query params for data
    let dataPayload = encodedData;
    if (!dataPayload && typeof window !== 'undefined') {
      try {
        const hash = window.location.hash;
        if (hash.includes('data=')) {
          dataPayload = hash.split('data=')[1]?.split('&')[0];
        }
        if (!dataPayload) {
          const params = new URLSearchParams(window.location.search);
          dataPayload = params.get('data') || params.get('d');
        }
      } catch (e) {
        console.warn(e);
      }
    }

    loadReceiptData(receiptId, receiptNumber, dataPayload);
  }, [receiptId, receiptNumber, encodedData]);

  // Render barcode once sale is loaded
  useEffect(() => {
    if (sale && barcodeSvgRef.current) {
      try {
        JsBarcode(barcodeSvgRef.current, String(sale.receiptNumber), {
          format: 'CODE128',
          width: 1.6,
          height: 40,
          displayValue: true,
          fontSize: 12,
          font: 'monospace',
          textMargin: 4,
          background: '#ffffff',
          lineColor: '#0f172a'
        });
      } catch (err) {
        console.warn('Barcode rendering error:', err);
      }
    }
  }, [sale, activeTab]);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSearchNumber.trim()) return;
    setIsSearching(true);
    loadReceiptData(null, manualSearchNumber.trim(), null).finally(() => {
      setIsSearching(false);
      setActiveTab('receipt');
    });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: CustomerAccountProfile = {
      ...customerProfile,
      name: tempName.trim() || 'Customer Member',
      phone: tempPhone.trim()
    };
    setCustomerProfile(updated);
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }
    setEditingProfile(false);
    showNotification('Account profile updated successfully!');
  };

  const handleSelectSavedReceipt = (saved: SavedWalletReceipt) => {
    if (saved.saleData) {
      setSale(saved.saleData);
      if (saved.storeData) {
        setStore(saved.storeData as Store);
      }
      setError(null);
      setActiveTab('receipt');
      showNotification(`Viewing Receipt #${saved.receiptNumber}`);
    } else {
      loadReceiptData(saved.id, saved.receiptNumber, null);
      setActiveTab('receipt');
    }
  };

  const handleRemoveFromWallet = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedReceipts.filter(r => r.id !== id);
    setSavedReceipts(updated);
    try {
      localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }
    showNotification('Receipt removed from your local Mart Pro wallet.');
  };

  const curr = store?.currencySymbol || '$';
  const storeName = store?.name || sale?.storeName || 'SUPERMARKET';
  const receiptSubHeader = store?.receiptHeader || 'TAX INVOICE / CASH MEMO';
  const receiptFooterText = store?.receiptFooter || 'Thank you for shopping with us! Please visit again.';

  const getFormattedReceiptText = (): string => {
    if (!sale) return '';
    const dateStr = new Date(sale.timestamp).toLocaleString();
    const divider = '========================================';
    const subDivider = '----------------------------------------';

    let txt = `MART PRO DIGITAL CUSTOMER ACCOUNT\n`;
    txt += `Account ID: ${customerProfile.id}\n`;
    txt += `${divider}\n`;
    txt += `${storeName}\n`;
    txt += `${receiptSubHeader}\n`;
    if (store?.address) txt += `${store.address}\n`;
    if (store?.phone) txt += `Tel: ${store.phone}\n`;
    if (store?.taxRegistrationNumber) txt += `Tax Reg: ${store.taxRegistrationNumber}\n`;
    txt += `${divider}\n`;
    txt += `RECEIPT NO: #${sale.receiptNumber}\n`;
    txt += `DATE & TIME: ${dateStr}\n`;
    txt += `COUNTER: ${sale.counterName} | CASHIER: ${sale.cashierUsername}\n`;
    txt += `PAYMENT: ${sale.paymentMethod.toUpperCase()}\n`;
    txt += `${divider}\n`;
    txt += `ITEMS:\n`;

    sale.items.forEach((item, idx) => {
      const isWeight = item.sellBy === 'weight' || item.unitType === 'kg' || item.quantity % 1 !== 0;
      const qtyStr = isWeight ? `${item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(3)} kg` : `${item.quantity} pcs`;
      txt += `${idx + 1}. ${item.name}\n`;
      txt += `   ${qtyStr} x ${curr} ${item.price.toFixed(2)} = ${curr} ${item.total.toFixed(2)}\n`;
    });

    txt += `${subDivider}\n`;
    if (sale.discountAmount && sale.discountAmount > 0) {
      txt += `SUBTOTAL: ${curr} ${(sale.subtotalAmount || (sale.totalAmount + sale.discountAmount)).toFixed(2)}\n`;
      txt += `DISCOUNT: -${curr} ${sale.discountAmount.toFixed(2)}\n`;
    }
    txt += `GRAND TOTAL: ${curr} ${sale.totalAmount.toFixed(2)}\n`;
    if (sale.paymentMethod === 'cash' && sale.cashReceived !== undefined) {
      txt += `CASH RECEIVED: ${curr} ${sale.cashReceived.toFixed(2)}\n`;
      txt += `CHANGE RETURNED: ${curr} ${(sale.changeReturned || 0).toFixed(2)}\n`;
    }
    txt += `${divider}\n`;
    txt += `${receiptFooterText}\n`;
    return txt;
  };

  const getReceiptHtmlContent = (): string => {
    if (!sale) return '';
    const dateStr = new Date(sale.timestamp).toLocaleString();
    const itemsHtml = sale.items.map(item => {
      const isWeight = item.sellBy === 'weight' || item.unitType === 'kg' || item.quantity % 1 !== 0;
      const qtyStr = isWeight ? `${item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(3)} kg` : `${item.quantity} pcs`;
      return `
        <tr>
          <td style="padding: 4px 0;"><strong>${item.name}</strong>${item.weightInfo ? `<br><small style="color:#64748b;">${item.weightInfo}</small>` : ''}</td>
          <td style="text-align: center; padding: 4px 0;">${qtyStr}</td>
          <td style="text-align: right; padding: 4px 0;">${curr} ${item.price.toFixed(2)}</td>
          <td style="text-align: right; padding: 4px 0; font-weight: bold;">${curr} ${item.total.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Mart Pro E-Receipt #${sale.receiptNumber} - ${storeName}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 20px; display: flex; justify-content: center; }
    .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; max-width: 420px; width: 100%; padding: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
    .brand-tag { background: #ea580c; color: white; display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; margin-bottom: 8px; }
    .text-center { text-align: center; }
    .divider { border-top: 1px dashed #cbd5e1; margin: 14px 0; }
    .solid-divider { border-top: 2px solid #0f172a; margin: 14px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; color: #64748b; font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    .row { display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0; }
    .total-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; color: #ea580c; margin-top: 8px; }
    .print-btn { background: #0f172a; color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: bold; width: 100%; margin-top: 16px; cursor: pointer; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="text-center">
      <span class="brand-tag">MART PRO DIGITAL PASS</span>
      <h2 style="margin: 4px 0; font-size: 20px;">${storeName}</h2>
      <p style="margin: 0; color: #64748b; font-size: 11px; font-weight: bold;">${receiptSubHeader}</p>
      ${store?.address ? `<p style="margin: 4px 0 0; color: #64748b; font-size: 11px;">${store.address}</p>` : ''}
      ${store?.phone ? `<p style="margin: 2px 0 0; color: #64748b; font-size: 11px;">Tel: ${store.phone}</p>` : ''}
    </div>

    <div class="divider"></div>

    <div class="row"><span>Receipt #: <strong>#${sale.receiptNumber}</strong></span><span>${dateStr}</span></div>
    <div class="row"><span>Counter: ${sale.counterName}</span><span>Cashier: ${sale.cashierUsername}</span></div>
    <div class="row"><span>Payment Method:</span><span style="font-weight: bold; text-transform: uppercase;">${sale.paymentMethod}</span></div>
    <div class="row"><span>Customer Account:</span><span style="font-weight: bold; font-family: monospace;">${customerProfile.id}</span></div>

    <div class="divider"></div>

    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align:center;">Qty</th>
          <th style="text-align:right;">Price</th>
          <th style="text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="solid-divider"></div>

    ${sale.discountAmount && sale.discountAmount > 0 ? `
      <div class="row">
        <span>Subtotal:</span>
        <span>${curr} ${(sale.subtotalAmount || (sale.totalAmount + sale.discountAmount)).toFixed(2)}</span>
      </div>
      <div class="row" style="color: #047857; font-weight: bold;">
        <span>Discount:</span>
        <span>-${curr} ${sale.discountAmount.toFixed(2)}</span>
      </div>
    ` : ''}

    <div class="total-row">
      <span>GRAND TOTAL:</span>
      <span>${curr} ${sale.totalAmount.toFixed(2)}</span>
    </div>

    ${sale.paymentMethod === 'cash' && sale.cashReceived !== undefined ? `
      <div class="row" style="margin-top: 6px;">
        <span>Cash Tendered:</span>
        <span>${curr} ${sale.cashReceived.toFixed(2)}</span>
      </div>
      <div class="row font-bold" style="color: #047857;">
        <span>Change Returned:</span>
        <span>${curr} ${(sale.changeReturned || 0).toFixed(2)}</span>
      </div>
    ` : ''}

    <div class="divider"></div>

    <div class="text-center" style="margin-top: 16px;">
      <p style="font-weight: bold; font-size: 11px; margin: 0;">${receiptFooterText}</p>
      <div style="font-size: 10px; color: #94a3b8; margin-top: 6px;">Mart Pro Verified Customer Receipt &bull; ID: ${customerProfile.id}</div>
    </div>

    <button onclick="window.print()" class="print-btn">🖨️ Save as PDF / Print</button>
  </div>
</body>
</html>`;
  };

  const showNotification = (text: string) => {
    setDownloadSuccessMsg(text);
    setTimeout(() => setDownloadSuccessMsg(null), 3500);
  };

  // 1. Download as High-Resolution PNG Image
  const handleDownloadImage = async () => {
    if (!sale) return;
    const element = receiptCardRef.current || document.getElementById('printable-public-receipt');
    if (!element) return;

    setIsExportingImage(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `MartPro-Receipt-${sale.receiptNumber}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification('Receipt image (PNG) downloaded successfully to your device!');
    } catch (err) {
      console.error('Failed to generate receipt image:', err);
    } finally {
      setIsExportingImage(false);
    }
  };

  // 2. Print or Save as PDF
  const handlePrintPdf = () => {
    window.print();
  };

  // 3. Download HTML Receipt
  const handleDownloadHtml = () => {
    if (!sale) return;
    const html = getReceiptHtmlContent();
    const element = document.createElement('a');
    const file = new Blob([html], { type: 'text/html' });
    element.href = URL.createObjectURL(file);
    element.download = `MartPro-Receipt-${sale.receiptNumber}.html`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showNotification('Digital HTML Receipt downloaded to your files!');
  };

  // 4. Download Plain Text (.txt)
  const handleDownloadText = () => {
    if (!sale) return;
    const text = getFormattedReceiptText();
    const element = document.createElement('a');
    const file = new Blob([text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `MartPro-Receipt-${sale.receiptNumber}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showNotification('Text receipt file (.txt) downloaded!');
  };

  const getPublicShareUrl = (): string => {
    if (typeof window === 'undefined') return 'https://ais-pre-tmjddyvpgndkt25xrveelm-532990536644.asia-southeast1.run.app';
    let url = window.location.href;
    if (url.includes('ais-dev-')) {
      url = url.replace('ais-dev-', 'ais-pre-');
    }
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      const receiptQuery = sale ? `?receiptId=${encodeURIComponent(sale.id || sale.receiptNumber)}&no=${encodeURIComponent(sale.receiptNumber)}` : '';
      return `https://ais-pre-tmjddyvpgndkt25xrveelm-532990536644.asia-southeast1.run.app${receiptQuery}`;
    }
    return url;
  };

  // 5. Copy Text
  const handleCopy = () => {
    const text = getFormattedReceiptText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    showNotification('Receipt details copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  // 6. Copy Direct Link
  const handleCopyLink = () => {
    const publicUrl = getPublicShareUrl();
    navigator.clipboard.writeText(publicUrl);
    setLinkCopied(true);
    showNotification('Public receipt link copied!');
    setTimeout(() => setLinkCopied(false), 2500);
  };

  // 7. Share to WhatsApp / Messaging
  const handleWhatsAppShare = () => {
    if (!sale) return;
    const publicUrl = getPublicShareUrl();
    const text = `*MART PRO CUSTOMER ACCOUNT - E-RECEIPT*\nStore: ${storeName}\nReceipt: #${sale.receiptNumber}\nDate: ${new Date(sale.timestamp).toLocaleString()}\nTotal: *${curr} ${sale.totalAmount.toFixed(2)}*\n\nView and download your receipt here:\n${publicUrl}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // 8. General Native Share
  const handleNativeShare = async () => {
    if (!sale) return;
    const publicUrl = getPublicShareUrl();
    const text = `Mart Pro Receipt #${sale.receiptNumber} (${storeName}) - Total: ${curr} ${sale.totalAmount.toFixed(2)}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receipt #${sale.receiptNumber} - ${storeName}`,
          text: text,
          url: publicUrl
        });
      } catch (err) {
        console.log('Share dismissed:', err);
      }
    } else {
      handleCopy();
    }
  };

  const filteredWalletReceipts = savedReceipts.filter(r => {
    if (!walletFilterSearch.trim()) return true;
    const query = walletFilterSearch.toLowerCase();
    return (
      r.receiptNumber.toLowerCase().includes(query) ||
      r.storeName.toLowerCase().includes(query) ||
      r.totalAmount.toString().includes(query)
    );
  });

  const totalWalletSpent = savedReceipts.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-4 sm:py-8 px-3 sm:px-6 flex flex-col items-center justify-start font-sans relative selection:bg-orange-500 selection:text-white">
      
      {/* Print-Specific Stylesheet */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-public-receipt, #printable-public-receipt * {
            visibility: visible !important;
          }
          #printable-public-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 100% !important;
            padding: 6mm !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border: none !important;
            background: #fff !important;
            color: #000 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Top Header: Mart Pro Customer Portal */}
      <header className="w-full max-w-lg mb-4 space-y-3 no-print">
        <div className="flex items-center justify-between bg-slate-900/90 backdrop-blur-md p-3.5 rounded-2xl border border-slate-800 shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base tracking-tight text-white">MART PRO</span>
                <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded-md bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  Customer Portal
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Auto-Registered Digital Pass: <span className="text-slate-200 font-mono font-bold">{customerProfile.id}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onExitToLogin}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl border border-slate-700 transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Store Login</span>
          </button>
        </div>

        {/* Customer Account Nav Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900/70 border border-slate-800/80 rounded-2xl">
          <button
            onClick={() => setActiveTab('receipt')}
            className={`py-2 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'receipt'
                ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Active Receipt</span>
          </button>

          <button
            onClick={() => setActiveTab('wallet')}
            className={`py-2 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer relative ${
              activeTab === 'wallet'
                ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>My Wallet</span>
            {savedReceipts.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 font-black text-[9px] flex items-center justify-center">
                {savedReceipts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`py-2 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>My Account</span>
          </button>
        </div>
      </header>

      {/* Temporary Download Feedback Toast */}
      {downloadSuccessMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed top-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-orange-500/40 text-xs font-bold flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{downloadSuccessMsg}</span>
        </motion.div>
      )}

      {/* TAB 1: ACTIVE RECEIPT VIEW */}
      {activeTab === 'receipt' && (
        <div className="w-full max-w-lg space-y-4">
          
          {/* Loading State */}
          {loading && (
            <div className="w-full bg-slate-900 rounded-3xl p-8 border border-slate-800 text-center space-y-4 shadow-xl">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full mx-auto"
              />
              <h3 className="text-base font-bold text-white">Opening Your Mart Pro E-Receipt...</h3>
              <p className="text-xs text-slate-400">Loading itemized receipt and store verification details</p>
            </div>
          )}

          {/* Error / Not Found State */}
          {!loading && error && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl text-center space-y-5"
            >
              <div className="w-14 h-14 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/20">
                <AlertCircle className="w-7 h-7" />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-black text-white">Receipt Not Found or Expired</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
              </div>

              {/* Manual Search Form */}
              <form onSubmit={handleManualSearch} className="space-y-3 pt-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider text-left">
                  Find by Receipt Number:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualSearchNumber}
                    onChange={(e) => setManualSearchNumber(e.target.value)}
                    placeholder="e.g. 1001 or sale id"
                    className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    <Search className="w-4 h-4" />
                    <span>{isSearching ? 'Searching...' : 'Find'}</span>
                  </button>
                </div>
              </form>

              {savedReceipts.length > 0 && (
                <div className="pt-3 border-t border-slate-800">
                  <button
                    onClick={() => setActiveTab('wallet')}
                    className="text-xs text-amber-400 font-bold hover:underline cursor-pointer flex items-center justify-center gap-1.5 mx-auto"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Check {savedReceipts.length} previously saved receipts in your Mart Pro Wallet</span>
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* Active Receipt & Download Dashboard */}
          {!loading && sale && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Account Confirmation Banner */}
              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs no-print shadow-md">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white block">Receipt Auto-Saved to Mart Pro Account</span>
                    <span className="text-[11px] text-slate-400">Account: {customerProfile.name} ({customerProfile.id})</span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('wallet')}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold rounded-lg text-[11px] transition-colors shrink-0 flex items-center gap-1"
                >
                  <Wallet className="w-3 h-3" />
                  <span>Wallet</span>
                </button>
              </div>

              {/* Main Printable / Downloadable Card */}
              <div 
                ref={receiptCardRef}
                id="printable-public-receipt"
                className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl p-6 sm:p-8 space-y-5 text-slate-900 relative overflow-hidden"
              >
                {/* Top Verified Seal */}
                <div className="text-center space-y-1.5 pb-4 border-b border-dashed border-slate-300">
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-extrabold border border-emerald-200 uppercase tracking-wider">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Mart Pro Verified E-Receipt</span>
                    </div>
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 text-[10px] font-bold border border-amber-200">
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span>Online for {getReceiptRemainingDays(sale.timestamp)} more days</span>
                    </div>
                  </div>

                  <h1 className="text-2xl font-black text-slate-900 tracking-tight pt-1">
                    {storeName}
                  </h1>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    {receiptSubHeader}
                  </p>

                  {store?.address && (
                    <p className="text-xs text-slate-500 flex items-center justify-center gap-1 font-medium pt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{store.address}</span>
                    </p>
                  )}

                  {store?.phone && (
                    <p className="text-xs text-slate-500 flex items-center justify-center gap-1 font-medium">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Tel: {store.phone}</span>
                    </p>
                  )}

                  {store?.taxRegistrationNumber && (
                    <p className="text-xs text-slate-700 font-bold pt-0.5">
                      Tax Reg: {store.taxRegistrationNumber}
                    </p>
                  )}

                  <div className="pt-2 flex items-center justify-between text-xs text-slate-600 font-mono">
                    <span>Receipt #: <strong className="text-slate-900 font-bold">#{sale.receiptNumber}</strong></span>
                    <span>{new Date(sale.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                {/* Cashier & Terminal Information */}
                <div className="grid grid-cols-2 text-xs text-slate-600 py-2 border-b border-dashed border-slate-300 gap-y-1 font-medium">
                  <div>Counter: <span className="font-bold text-slate-900">{sale.counterName}</span></div>
                  <div className="text-right">Cashier: <span className="font-bold text-slate-900">{sale.cashierUsername}</span></div>
                  <div>Payment Mode:</div>
                  <div className="text-right font-black uppercase text-orange-600">{sale.paymentMethod}</div>
                  <div>Customer Pass:</div>
                  <div className="text-right font-mono font-bold text-slate-800">{customerProfile.id}</div>
                </div>

                {/* Line Items Table */}
                <div className="space-y-2 py-1">
                  <div className="grid grid-cols-12 font-bold text-[11px] text-slate-500 uppercase border-b border-slate-200 pb-1.5">
                    <span className="col-span-6">Item Description</span>
                    <span className="col-span-2 text-center">Qty</span>
                    <span className="col-span-2 text-right">Price</span>
                    <span className="col-span-2 text-right">Total</span>
                  </div>

                  {sale.items.map((item, idx) => {
                    const isWeight = item.sellBy === 'weight' || item.unitType === 'kg' || item.quantity % 1 !== 0;
                    const qtyDisplay = isWeight ? `${item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(3)}kg` : item.quantity.toString();

                    return (
                      <div key={idx} className="grid grid-cols-12 text-slate-900 text-xs py-1.5 items-start border-b border-slate-100 last:border-0">
                        <div className="col-span-6 pr-2">
                          <div className="font-bold text-slate-900 leading-tight">{item.name}</div>
                          {item.weightInfo && (
                            <div className="text-[10px] text-slate-500 font-medium">{item.weightInfo}</div>
                          )}
                        </div>
                        <span className="col-span-2 text-center font-bold font-mono text-slate-700">{qtyDisplay}</span>
                        <span className="col-span-2 text-right text-slate-600 font-mono">{curr} {item.price.toFixed(2)}</span>
                        <span className="col-span-2 text-right font-black text-slate-900 font-mono">{curr} {item.total.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Calculations & Totals */}
                <div className="pt-3 border-t-2 border-slate-900 space-y-1.5">
                  {sale.discountAmount && sale.discountAmount > 0 ? (
                    <>
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Subtotal Amount:</span>
                        <span className="font-mono font-semibold">{curr} {(sale.subtotalAmount || (sale.totalAmount + sale.discountAmount)).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-emerald-700">
                        <span>Discount {sale.discountType === 'percentage' && sale.discountValue ? `(${sale.discountValue}%)` : ''}:</span>
                        <span className="font-mono">-{curr} {sale.discountAmount.toFixed(2)}</span>
                      </div>
                    </>
                  ) : null}

                  <div className="flex justify-between text-base sm:text-lg font-black text-slate-900 pt-2 border-t border-slate-200">
                    <span>GRAND TOTAL:</span>
                    <span className="text-orange-600">{curr} {sale.totalAmount.toFixed(2)}</span>
                  </div>

                  {sale.paymentMethod === 'cash' && sale.cashReceived !== undefined && (
                    <>
                      <div className="flex justify-between text-xs font-medium text-slate-600 pt-1">
                        <span>Cash Tendered:</span>
                        <span className="font-mono">{curr} {sale.cashReceived.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-black text-emerald-700">
                        <span>Change Returned:</span>
                        <span className="font-mono">{curr} {(sale.changeReturned || 0).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Barcode Render */}
                <div className="text-center pt-4 border-t border-dashed border-slate-300">
                  <div className="inline-block p-1 bg-white">
                    <svg ref={barcodeSvgRef} className="mx-auto max-w-full"></svg>
                  </div>
                  <p className="text-xs font-bold text-slate-800 mt-2">{receiptFooterText}</p>
                  {store?.returnPolicyDays && (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Returns accepted within {store.returnPolicyDays} days with this original receipt.
                    </p>
                  )}
                </div>
              </div>

              {/* Action Download & Sharing Dashboard */}
              <div className="bg-slate-900 rounded-3xl border border-slate-800 p-5 sm:p-6 shadow-xl space-y-4 no-print">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-extrabold text-orange-400 bg-orange-500/20 px-2.5 py-0.5 rounded-full border border-orange-500/30 uppercase tracking-wider">
                      Mart Pro Download Center
                    </span>
                    <h4 className="text-sm font-black text-white mt-1">
                      Download & Export This Receipt
                    </h4>
                  </div>
                  <Smartphone className="w-5 h-5 text-slate-500" />
                </div>

                {/* Primary Action Buttons Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  
                  {/* 1. Download PNG Image */}
                  <button
                    onClick={handleDownloadImage}
                    disabled={isExportingImage}
                    className="py-3.5 px-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold rounded-2xl shadow-md shadow-orange-600/30 text-xs flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>{isExportingImage ? 'Generating...' : 'Save as Image (PNG)'}</span>
                  </button>

                  {/* 2. Download PDF / Print */}
                  <button
                    onClick={handlePrintPdf}
                    className="py-3.5 px-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl text-xs flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-700 shadow-sm"
                  >
                    <Printer className="w-4 h-4 text-orange-400" />
                    <span>Save PDF / Print</span>
                  </button>

                  {/* 3. Download HTML E-Receipt */}
                  <button
                    onClick={handleDownloadHtml}
                    className="py-3.5 px-3 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-2xl text-xs flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <Download className="w-4 h-4 text-emerald-200" />
                    <span>Download HTML</span>
                  </button>

                  {/* 4. WhatsApp Share */}
                  <button
                    onClick={handleWhatsAppShare}
                    className="py-3.5 px-3 bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 font-bold border border-emerald-800/80 rounded-2xl text-xs flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                    <span>Send WhatsApp</span>
                  </button>

                  {/* 5. General Share */}
                  <button
                    onClick={handleNativeShare}
                    className="py-3.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 rounded-2xl text-xs flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Share2 className="w-4 h-4 text-orange-400" />
                    <span>Share Receipt</span>
                  </button>

                  {/* 6. Copy Link */}
                  <button
                    onClick={handleCopyLink}
                    className="py-3.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 rounded-2xl text-xs flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    {linkCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                    <span>{linkCopied ? 'Link Copied!' : 'Copy Direct Link'}</span>
                  </button>
                </div>

                {/* Additional Text Export */}
                <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800">
                  <button
                    onClick={handleDownloadText}
                    className="hover:text-white font-medium underline cursor-pointer"
                  >
                    Download Plain Text File (.txt)
                  </button>
                  <button
                    onClick={handleCopy}
                    className="hover:text-white font-medium cursor-pointer flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{copied ? 'Copied to Clipboard' : 'Copy Formatted Text'}</span>
                  </button>
                </div>
              </div>

            </motion.div>
          )}

        </div>
      )}

      {/* TAB 2: MART PRO WALLET / PAST RECEIPTS */}
      {activeTab === 'wallet' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg space-y-4 no-print"
        >
          {/* Wallet Summary Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-5 rounded-3xl border border-slate-800 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Mart Pro Wallet
                </span>
                <h3 className="text-base font-black text-white mt-1">Saved Digital Receipts</h3>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                <Wallet className="w-5 h-5" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Saved Bills</span>
                <span className="text-lg font-black text-white">{savedReceipts.length} Receipts</span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Value</span>
                <span className="text-lg font-black text-amber-400">{curr} {totalWalletSpent.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Search Wallet Receipts */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={walletFilterSearch}
              onChange={(e) => setWalletFilterSearch(e.target.value)}
              placeholder="Search receipts by # or store..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 font-medium"
            />
          </div>

          {/* Receipts List */}
          <div className="space-y-2.5">
            {filteredWalletReceipts.length === 0 ? (
              <div className="bg-slate-900/60 rounded-3xl p-8 border border-slate-800 text-center space-y-3">
                <Receipt className="w-10 h-10 text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-300">No Receipts Found in Wallet</h4>
                <p className="text-xs text-slate-500">
                  When you scan a QR code at any checkout, it will be saved here automatically for 24/7 access on this phone.
                </p>
              </div>
            ) : (
              filteredWalletReceipts.map((rec) => (
                <div
                  key={rec.id}
                  onClick={() => handleSelectSavedReceipt(rec)}
                  className="bg-slate-900 hover:bg-slate-850 p-4 rounded-2xl border border-slate-800 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 text-orange-400 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0 border border-slate-700">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-white">#{rec.receiptNumber}</span>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                          {rec.storeName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {new Date(rec.timestamp).toLocaleDateString()}
                        </span>
                        <span>&bull;</span>
                        <span>{rec.itemCount} items</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <span className="font-black text-sm text-amber-400 block font-mono">
                        {rec.currency} {rec.totalAmount.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center justify-end gap-1">
                        <Check className="w-3 h-3" /> Saved
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleRemoveFromWallet(rec.id, e)}
                      title="Remove receipt from wallet"
                      className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}

      {/* TAB 3: CUSTOMER ACCOUNT PROFILE */}
      {activeTab === 'profile' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg space-y-4 no-print"
        >
          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center font-black text-lg shadow-md shadow-orange-500/20">
                {customerProfile.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-base font-black text-white">{customerProfile.name}</h3>
                <p className="text-xs text-slate-400 font-mono">Customer ID: {customerProfile.id}</p>
                <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 mt-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Mart Pro Verified Digital Pass</span>
                </div>
              </div>
            </div>

            {!editingProfile ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Phone Number</span>
                    <span className="text-slate-200 font-medium">{customerProfile.phone || 'Not provided'}</span>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Member Since</span>
                    <span className="text-slate-200 font-medium">{new Date(customerProfile.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800 text-xs space-y-1.5 text-slate-400">
                  <span className="font-bold text-slate-300 block">About Your Mart Pro Pass:</span>
                  <p>
                    Your Mart Pro pass is stored in your device browser. Every time you scan a checkout QR code at any Mart Pro partner supermarket, your digital receipt will automatically sync and remain downloadable right here.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setTempName(customerProfile.name);
                    setTempPhone(customerProfile.phone);
                    setEditingProfile(true);
                  }}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl text-xs transition-colors cursor-pointer border border-slate-700"
                >
                  Edit Customer Profile Details
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">Your Full Name:</label>
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    placeholder="e.g. Alex Smith"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">Phone Number (Optional):</label>
                  <input
                    type="tel"
                    value={tempPhone}
                    onChange={(e) => setTempPhone(e.target.value)}
                    placeholder="e.g. +1 555-0199"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProfile(false)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer border border-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      )}

      {/* Footer */}
      <footer className="w-full max-w-lg text-center pt-6 pb-4 text-xs text-slate-500 space-y-1 no-print">
        <p className="font-bold text-slate-400">Mart Pro &bull; Supermarket Management System</p>
        <p className="text-[11px]">Instant E-Receipts &bull; Cloud Verified &bull; 7-Day Online Retention</p>
      </footer>

    </div>
  );
};
