import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Store, UserAccount, Sale, Product } from '../types';
import { 
  Settings, 
  Store as StoreIcon, 
  Users, 
  CreditCard, 
  Printer, 
  Database, 
  Barcode, 
  Globe, 
  Info, 
  ChevronRight, 
  ArrowLeft, 
  Save, 
  Check, 
  AlertCircle, 
  Download, 
  Upload, 
  ShieldCheck, 
  FileText,
  Volume2,
  ExternalLink,
  Layers,
  Sparkles
} from 'lucide-react';
import { StoreSettingsView } from './StoreSettingsView';
import { PaymentMethodsView } from './PaymentMethodsView';
import { db, doc, updateDoc, collection, getDocs, writeBatch } from '../lib/firebase';

interface ModernSettingsViewProps {
  store: Store;
  currentUser: UserAccount;
  storeUsers: UserAccount[];
  sales?: Sale[];
  products?: Product[];
  onBack?: () => void;
  onUpdateStore?: (updatedStore: Store) => void;
}

type ActiveSettingsSection = 
  | 'overview' 
  | 'store_info' 
  | 'user_management' 
  | 'payment_methods' 
  | 'hardware_pos' 
  | 'backup_export' 
  | 'barcode_generator' 
  | 'online_store' 
  | 'about';

export const ModernSettingsView: React.FC<ModernSettingsViewProps> = ({
  store,
  currentUser,
  storeUsers,
  sales = [],
  products = [],
  onBack,
  onUpdateStore
}) => {
  const [activeSection, setActiveSection] = useState<ActiveSettingsSection>('overview');
  const [printerPaperSize, setPrinterPaperSize] = useState<'80mm' | '58mm'>(
    (store.receiptPaperSize as '80mm' | '58mm') || '80mm'
  );
  const [scannerSound, setScannerSound] = useState<boolean>(store.soundEnabled ?? true);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState<boolean>(store.autoPrintReceipt ?? false);
  const [isSavingHardware, setIsSavingHardware] = useState(false);
  const [hardwareSavedNotice, setHardwareSavedNotice] = useState(false);
  
  // Barcode sheet state
  const [selectedBarcodeCount, setSelectedBarcodeCount] = useState<number>(24);
  const [barcodeSearch, setBarcodeSearch] = useState('');

  // Handle hardware save
  const handleSaveHardware = async () => {
    setIsSavingHardware(true);
    try {
      await updateDoc(doc(db, 'stores', store.id), {
        receiptPaperSize: printerPaperSize,
        soundEnabled: scannerSound,
        autoPrintReceipt: autoPrintReceipt
      });
      setHardwareSavedNotice(true);
      setTimeout(() => setHardwareSavedNotice(false), 3000);
    } catch (err) {
      console.error('Error saving hardware settings:', err);
    } finally {
      setIsSavingHardware(false);
    }
  };

  // Handle export data
  const handleExportJSON = () => {
    const backupData = {
      store: {
        id: store.id,
        name: store.name,
        branchCode: store.branchCode,
        currency: store.currencySymbol || 'Rs.'
      },
      exportedAt: new Date().toISOString(),
      productsCount: products.length,
      products: products,
      salesCount: sales.length,
      sales: sales.slice(0, 500)
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `martpro_backup_${store.id}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportProductsCSV = () => {
    if (products.length === 0) return;
    const headers = ['Name', 'Barcode', 'Category', 'Cost Price', 'Selling Price', 'Stock', 'Status'];
    const rows = products.map(p => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.barcode || ''}"`,
      `"${p.category || 'General'}"`,
      p.costPrice || 0,
      p.price || 0,
      p.stockQuantity ?? p.stock ?? 0,
      (p.stockQuantity ?? p.stock ?? 0) <= 0 
        ? 'Out of Stock' 
        : (p.stockQuantity ?? p.stock ?? 0) <= (p.minStockLevel ?? p.lowStockThreshold ?? 5) 
          ? 'Low Stock' 
          : 'In Stock'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `martpro_products_${store.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredBarcodeProducts = products.filter(p => 
    !barcodeSearch || 
    p.name.toLowerCase().includes(barcodeSearch.toLowerCase()) || 
    p.barcode?.includes(barcodeSearch)
  ).slice(0, 30);

  const cards = [
    {
      id: 'store_info' as const,
      title: 'Store Settings & Branding',
      desc: 'Business identity, tax ID, phone, address, receipts header & footer',
      icon: StoreIcon,
      color: 'bg-orange-50 text-orange-600 border-orange-200',
      badge: 'Profile'
    },
    {
      id: 'user_management' as const,
      title: 'User Management',
      desc: 'Add and manage staff, cashier PINs, access permissions & roles',
      icon: Users,
      color: 'bg-blue-50 text-blue-600 border-blue-200',
      badge: `${storeUsers.length} Users`
    },
    {
      id: 'payment_methods' as const,
      title: 'Payment Methods',
      desc: 'Manage Cash, Cards, Easypaisa, JazzCash, and Store Bank Accounts',
      icon: CreditCard,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      badge: 'Gateways'
    },
    {
      id: 'hardware_pos' as const,
      title: 'Hardware & POS',
      desc: 'Thermal receipt printer size (80mm/58mm), scanner sound & scale',
      icon: Printer,
      color: 'bg-purple-50 text-purple-600 border-purple-200',
      badge: printerPaperSize
    },
    {
      id: 'backup_export' as const,
      title: 'Backup & Export',
      desc: 'Download store data backups, CSV catalog exports, and sales data',
      icon: Database,
      color: 'bg-amber-50 text-amber-600 border-amber-200',
      badge: 'JSON / CSV'
    },
    {
      id: 'barcode_generator' as const,
      title: 'Barcode Label Studio',
      desc: 'Generate printable barcode labels, shelf tags, and price stickers',
      icon: Barcode,
      color: 'bg-cyan-50 text-cyan-600 border-cyan-200',
      badge: `${products.length} Items`
    },
    {
      id: 'online_store' as const,
      title: 'Online Storefront',
      desc: 'Customer self-service online catalogue and WhatsApp ordering',
      icon: Globe,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
      badge: store.onlineStoreEnabled ? 'Active' : 'Disabled'
    },
    {
      id: 'about' as const,
      title: 'About Mart Pro',
      desc: 'System version 1.2.0, license, cloud sync status & documentation',
      icon: Info,
      color: 'bg-slate-100 text-slate-700 border-slate-200',
      badge: 'v1.2.0'
    }
  ];

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-0 overflow-y-auto">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5 shrink-0 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {activeSection !== 'overview' && (
            <button
              onClick={() => setActiveSection('overview')}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer transition-colors"
              title="Back to Settings Overview"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {activeSection === 'overview' && 'Settings & More'}
                {activeSection === 'store_info' && 'Store Settings & Branding'}
                {activeSection === 'user_management' && 'User Management & Access Roles'}
                {activeSection === 'payment_methods' && 'Payment Methods & Gateways'}
                {activeSection === 'hardware_pos' && 'Hardware & POS Settings'}
                {activeSection === 'backup_export' && 'Data Backup & Export'}
                {activeSection === 'barcode_generator' && 'Barcode Label Studio'}
                {activeSection === 'online_store' && 'Online Storefront Settings'}
                {activeSection === 'about' && 'About Mart Pro ERP'}
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                {store.name}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {activeSection === 'overview' 
                ? 'Configure store identity, hardware, permissions, payment gateways, and data maintenance'
                : 'Manage configuration options and save changes to apply immediately across all counters'}
            </p>
          </div>
        </div>

        {activeSection !== 'overview' && (
          <button
            onClick={() => setActiveSection('overview')}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-colors"
          >
            ← View All Settings Cards
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {/* 1. OVERVIEW GRID (Matches Screen 14 of Showcase) */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {cards.map(card => {
                const IconComponent = card.icon;
                return (
                  <div
                    key={card.id}
                    onClick={() => setActiveSection(card.id)}
                    className="group bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-orange-300 transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${card.color}`}>
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          {card.badge}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-orange-600 transition-colors">
                        {card.title}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                        {card.desc}
                      </p>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-orange-600 group-hover:translate-x-0.5 transition-transform">
                      <span>Configure</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Summary Banner */}
            <div className="bg-gradient-to-r from-[#0B132B] to-slate-900 rounded-3xl p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-md">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-600 flex items-center justify-center text-white shrink-0 shadow-md">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-base text-white">Mart Pro Cloud Retail OS</h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Real-time Firestore synchronization active. All terminals automatically receive price updates and inventory changes.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Terminal Online
                </span>
                <button
                  onClick={() => setActiveSection('backup_export')}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
                >
                  Quick Backup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. STORE SETTINGS & BRANDING */}
        {activeSection === 'store_info' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <StoreSettingsView
              store={store}
              currentUser={currentUser}
              storeUsers={storeUsers}
              onStoreUpdated={onUpdateStore}
            />
          </div>
        )}

        {/* 3. USER MANAGEMENT */}
        {activeSection === 'user_management' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <StoreSettingsView
              store={store}
              currentUser={currentUser}
              storeUsers={storeUsers}
              onStoreUpdated={onUpdateStore}
            />
          </div>
        )}

        {/* 4. PAYMENT METHODS */}
        {activeSection === 'payment_methods' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden p-6">
            <PaymentMethodsView
              store={store}
              sales={sales}
              currencySymbol={store.currencySymbol || 'Rs.'}
              onUpdateStore={(partial) => {
                if (onUpdateStore) {
                  onUpdateStore({ ...store, ...partial });
                }
              }}
            />
          </div>
        )}

        {/* 5. HARDWARE & POS SETTINGS */}
        {activeSection === 'hardware_pos' && (
          <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-slate-200 p-8 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-black text-slate-900">POS Hardware & Peripheral Preferences</h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Configure your receipt printer roll dimensions, barcode sound triggers, and checkout automation.
              </p>
            </div>

            {hardwareSavedNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                Hardware settings saved successfully and synced to this counter.
              </div>
            )}

            <div className="space-y-4 pt-2">
              {/* Printer paper size */}
              <div className="border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-slate-900">Receipt Paper Width</div>
                  <div className="text-xs text-slate-500 font-medium mt-0.5">
                    Select the width of your thermal roll receipt printer.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPrinterPaperSize('80mm')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      printerPaperSize === '80mm'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    80mm (Standard POS)
                  </button>
                  <button
                    onClick={() => setPrinterPaperSize('58mm')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      printerPaperSize === '58mm'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    58mm (Compact Mobile)
                  </button>
                </div>
              </div>

              {/* Barcode scanner audio */}
              <div className="border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-slate-900">Barcode Scanner Beep Sound</div>
                  <div className="text-xs text-slate-500 font-medium mt-0.5">
                    Play confirmation audio tone upon successful barcode scan or product cart addition.
                  </div>
                </div>
                <button
                  onClick={() => setScannerSound(!scannerSound)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    scannerSound ? 'bg-orange-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      scannerSound ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Auto print receipt */}
              <div className="border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-slate-900">Automatic Print Dialog After Sale</div>
                  <div className="text-xs text-slate-500 font-medium mt-0.5">
                    Instantly trigger the system print dialog when checkout is completed.
                  </div>
                </div>
                <button
                  onClick={() => setAutoPrintReceipt(!autoPrintReceipt)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    autoPrintReceipt ? 'bg-orange-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      autoPrintReceipt ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={handleSaveHardware}
                disabled={isSavingHardware}
                className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isSavingHardware ? 'Saving...' : 'Save Hardware Settings'}
              </button>
            </div>
          </div>
        )}

        {/* 6. DATA BACKUP & EXPORT */}
        {activeSection === 'backup_export' && (
          <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-slate-200 p-8 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-black text-slate-900">Data Backup & Bulk Exports</h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Safeguard your retail operations by downloading portable JSON backups and CSV spreadsheets.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-5 rounded-2xl border border-slate-200 hover:border-orange-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold mb-3 border border-orange-200">
                    <Database className="w-5 h-5" />
                  </div>
                  <h3 className="font-extrabold text-sm text-slate-900">Full Store Snapshot (JSON)</h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                    Includes current store configuration, {products.length} products, inventory levels, and recent transactions.
                  </p>
                </div>
                <button
                  onClick={handleExportJSON}
                  className="mt-4 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2 shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  Download Backup JSON
                </button>
              </div>

              <div className="p-5 rounded-2xl border border-slate-200 hover:border-emerald-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold mb-3 border border-emerald-200">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h3 className="font-extrabold text-sm text-slate-900">Product Catalog (CSV)</h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                    Export all products with prices, cost, categories, and stock numbers for spreadsheet auditing in Excel.
                  </p>
                </div>
                <button
                  onClick={handleExportProductsCSV}
                  className="mt-4 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2 shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  Export Products CSV
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 7. BARCODE LABEL STUDIO */}
        {activeSection === 'barcode_generator' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">Barcode Label Studio</h2>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Preview and print barcode price stickers for shelf displays and product packaging.
                </p>
              </div>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print Label Sheet
              </button>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search products for barcode labels..."
                value={barcodeSearch}
                onChange={e => setBarcodeSearch(e.target.value)}
                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
              {filteredBarcodeProducts.map(p => (
                <div key={p.id} className="p-3 border border-slate-200 rounded-2xl text-center space-y-1 bg-white hover:border-orange-400 transition-colors">
                  <div className="text-[10px] font-bold text-slate-400 uppercase truncate">{store.name}</div>
                  <div className="font-extrabold text-xs text-slate-900 truncate">{p.name}</div>
                  <div className="text-xs font-black text-orange-600">{store.currencySymbol || 'Rs.'} {p.price.toLocaleString()}</div>
                  <div className="font-mono text-[10px] tracking-widest text-slate-600 bg-slate-100 py-1 px-1 rounded-md">
                    {p.barcode || 'NO-BARCODE'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 8. ONLINE STOREFRONT */}
        {activeSection === 'online_store' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <StoreSettingsView
              store={store}
              currentUser={currentUser}
              storeUsers={storeUsers}
              onStoreUpdated={onUpdateStore}
            />
          </div>
        )}

        {/* 9. ABOUT MART PRO */}
        {activeSection === 'about' && (
          <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-200 p-8 shadow-xs text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-[#0B132B] text-white flex items-center justify-center mx-auto shadow-md">
              <span className="font-black text-2xl tracking-tight text-white">
                M<span className="text-orange-500">.</span>
              </span>
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-900">Mart Pro Retail & Inventory ERP</h2>
              <div className="inline-block mt-2 px-3 py-1 bg-orange-50 border border-orange-200 rounded-full text-orange-700 text-xs font-black">
                Version 1.2.0 • Production Release
              </div>
            </div>

            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Designed for modern grocery stores, supermarkets, pharmacies, apparel retailers, and multi-counter chain operations. Featuring barcode scanning, automated profit calculation, supplier ledgers, customer credit tracking, and real-time offline PWA capabilities.
            </p>

            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-left">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <div className="text-[10px] font-bold text-slate-400">DATABASE</div>
                <div className="text-xs font-bold text-slate-800 mt-0.5">Cloud Firestore</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <div className="text-[10px] font-bold text-slate-400">FRAMEWORK</div>
                <div className="text-xs font-bold text-slate-800 mt-0.5">React 18 + Vite</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <div className="text-[10px] font-bold text-slate-400">SECURITY</div>
                <div className="text-xs font-bold text-slate-800 mt-0.5">RBAC & PINs</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
