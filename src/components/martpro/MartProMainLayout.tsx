import React, { useState, useEffect, useMemo } from 'react';
import { Store, UserAccount, Product, Sale, Supplier, Expense, ActivityLog } from '../../types';
import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  where,
  getDocs
} from '../../lib/firebase';
import { seedMartProStoreData } from '../../lib/martProDataSeeder';
import { MartProSidebar, MartProScreenId } from './MartProSidebar';
import { MartProHeader } from './MartProHeader';
import { Screen2Dashboard } from './Screen2Dashboard';
import { Screen3Pos } from './Screen3Pos';
import { Screen5ProductsStock } from './Screen5ProductsStock';
import { Screen6AddEditProductModal } from './Screen6AddEditProductModal';
import { Screen7SalesOrders } from './Screen7SalesOrders';
import { Screen8Suppliers } from './Screen8Suppliers';
import { Screen9SupplierManagement } from './Screen9SupplierManagement';
import { Screen10ExpensesAccounts } from './Screen10ExpensesAccounts';
import { Screen11Reports } from './Screen11Reports';
import { Screen12LedgerReports } from './Screen12LedgerReports';
import { Screen13ProfitLossReport } from './Screen13ProfitLossReport';
import { ScreenSettings } from './ScreenSettings';
import { ReceiptModal } from '../ReceiptModal';
import { BarcodeScannerModal } from '../BarcodeScannerModal';

interface MartProMainLayoutProps {
  store: Store;
  currentUser: UserAccount;
  onLogout: () => void;
  onStoreChange?: (store: Store) => void;
}

export const MartProMainLayout: React.FC<MartProMainLayoutProps> = ({
  store,
  currentUser,
  onLogout,
  onStoreChange
}) => {
  // Navigation screen state
  const [currentScreen, setCurrentScreen] = useState<MartProScreenId>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  // Modals
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedReceiptSale, setSelectedReceiptSale] = useState<Sale | null>(null);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);

  // Live database collections
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  // Seed store data if products are missing on startup
  useEffect(() => {
    if (store?.id) {
      seedMartProStoreData(store.id);
    }
  }, [store?.id]);

  // Real-time Firestore Subscriptions
  useEffect(() => {
    const storeId = store?.id || 'mart-pro-store';

    // 1. Products
    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      const list: Product[] = [];
      snap.forEach(d => {
        const data = d.data() as Product;
        if (data.storeId === storeId || !data.storeId) {
          list.push({ id: d.id, ...data });
        }
      });
      setProducts(list);
    }, (err) => console.warn('Products sync err:', err));

    // 2. Sales
    const unsubSales = onSnapshot(collection(db, 'sales'), (snap) => {
      const list: Sale[] = [];
      snap.forEach(d => {
        const data = d.data() as Sale;
        if (data.storeId === storeId || !data.storeId) {
          list.push({ id: d.id, ...data });
        }
      });
      setSales(list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }, (err) => console.warn('Sales sync err:', err));

    // 3. Suppliers
    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snap) => {
      const list: Supplier[] = [];
      snap.forEach(d => {
        const data = d.data() as Supplier;
        if (data.storeId === storeId || !data.storeId) {
          list.push({ id: d.id, ...data });
        }
      });
      setSuppliers(list);
    }, (err) => console.warn('Suppliers sync err:', err));

    // 4. Expenses
    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snap) => {
      const list: Expense[] = [];
      snap.forEach(d => {
        const data = d.data() as Expense;
        if (data.storeId === storeId || !data.storeId) {
          list.push({ id: d.id, ...data });
        }
      });
      setExpenses(list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }, (err) => console.warn('Expenses sync err:', err));

    // 5. Activities
    const unsubActivities = onSnapshot(collection(db, 'activity_logs'), (snap) => {
      const list: ActivityLog[] = [];
      snap.forEach(d => {
        const data = d.data() as ActivityLog;
        if (data.storeId === storeId || !data.storeId) {
          list.push({ id: d.id, ...data });
        }
      });
      setActivities(list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }, (err) => console.warn('Activities sync err:', err));

    return () => {
      unsubProducts();
      unsubSales();
      unsubSuppliers();
      unsubExpenses();
      unsubActivities();
    };
  }, [store?.id]);

  const handleViewReceipt = (sale: Sale) => {
    setSelectedReceiptSale(sale);
    setIsReceiptModalOpen(true);
  };

  const handleBarcodeScanned = (scannedCode: string) => {
    setIsScannerModalOpen(false);
    // Switch to POS and notify
    setCurrentScreen('pos');
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#111111] text-slate-900 font-sans selection:bg-[#FF6500] selection:text-white">
      {/* Desktop Dark Left Sidebar matching reference image */}
      <div className="hidden md:flex">
        <MartProSidebar
          currentScreen={currentScreen}
          onSelectScreen={(screen) => setCurrentScreen(screen)}
          store={store}
          currentUser={currentUser}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onLogout={onLogout}
        />
      </div>

      {/* Mobile Drawer Sidebar */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-xs" 
            onClick={() => setIsMobileSidebarOpen(false)} 
          />
          <div className="relative z-10 w-64 bg-[#111111] h-full shadow-2xl">
            <MartProSidebar
              currentScreen={currentScreen}
              onSelectScreen={(screen) => {
                setCurrentScreen(screen);
                setIsMobileSidebarOpen(false);
              }}
              store={store}
              currentUser={currentUser}
              isCollapsed={false}
              onToggleCollapse={() => setIsMobileSidebarOpen(false)}
              onLogout={onLogout}
            />
          </div>
        </div>
      )}

      {/* Main View Area with Top Header */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#F8F9FA] overflow-hidden">
        {/* Header Bar */}
        <MartProHeader
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenPos={() => setCurrentScreen('pos')}
          onOpenAddProduct={() => setIsAddProductModalOpen(true)}
          store={store}
          currentUser={currentUser}
          selectedDateText="Today (Nov 1, 2026)"
          searchQuery={globalSearch}
          onSearchChange={(q) => setGlobalSearch(q)}
        />

        {/* Dynamic Screen Container */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {/* SCREEN 2: DASHBOARD */}
          {currentScreen === 'dashboard' && (
            <Screen2Dashboard
              store={store}
              currentUser={currentUser}
              products={products}
              sales={sales}
              activities={activities}
              onNavigateToScreen={(s) => setCurrentScreen(s)}
              onViewSaleReceipt={handleViewReceipt}
            />
          )}

          {/* SCREEN 3: POS / NEW SALE (which triggers SCREEN 4: PAYMENT SCREEN) */}
          {currentScreen === 'pos' && (
            <Screen3Pos
              store={store}
              currentUser={currentUser}
              products={products}
              onSaleComplete={(sale) => {
                handleViewReceipt(sale);
              }}
              onOpenScanner={() => setIsScannerModalOpen(true)}
            />
          )}

          {/* SCREEN 5: PRODUCTS & STOCK (which triggers SCREEN 6: ADD/EDIT PRODUCT) */}
          {currentScreen === 'products_stock' && (
            <Screen5ProductsStock
              store={store}
              currentUser={currentUser}
              products={products}
              onProductUpdated={() => {}}
              onOpenAddModal={() => setIsAddProductModalOpen(true)}
            />
          )}

          {/* SCREEN 7: SALES & ORDERS */}
          {currentScreen === 'sales_orders' && (
            <Screen7SalesOrders
              store={store}
              currentUser={currentUser}
              sales={sales}
              onViewReceipt={handleViewReceipt}
            />
          )}

          {/* SCREEN 8: SUPPLIERS */}
          {currentScreen === 'suppliers' && (
            <Screen8Suppliers
              store={store}
              currentUser={currentUser}
              suppliers={suppliers}
              onSupplierSaved={() => {}}
              onNavigateToManagement={() => setCurrentScreen('supplier_management')}
            />
          )}

          {/* SCREEN 9: SUPPLIER MANAGEMENT (PO, Delivery Verification, Advances, Balances) */}
          {currentScreen === 'supplier_management' && (
            <Screen9SupplierManagement
              store={store}
              currentUser={currentUser}
              suppliers={suppliers}
              products={products}
            />
          )}

          {/* SCREEN 10: EXPENSES & ACCOUNTS */}
          {currentScreen === 'expenses_accounts' && (
            <Screen10ExpensesAccounts
              store={store}
              currentUser={currentUser}
              expenses={expenses}
              onExpenseSaved={() => {}}
            />
          )}

          {/* SCREEN 11: REPORTS */}
          {currentScreen === 'reports' && (
            <Screen11Reports
              store={store}
              currentUser={currentUser}
              sales={sales}
              expenses={expenses}
              onNavigateToScreen={(s) => setCurrentScreen(s)}
            />
          )}

          {/* SCREEN 12: LEDGER REPORTS */}
          {currentScreen === 'ledger_reports' && (
            <Screen12LedgerReports
              store={store}
              currentUser={currentUser}
              suppliers={suppliers}
              sales={sales}
              expenses={expenses}
            />
          )}

          {/* SCREEN 13: PROFIT & LOSS REPORT */}
          {currentScreen === 'profit_loss' && (
            <Screen13ProfitLossReport
              store={store}
              currentUser={currentUser}
              sales={sales}
              expenses={expenses}
            />
          )}

          {/* SCREEN 14: SETTINGS */}
          {currentScreen === 'settings' && (
            <ScreenSettings
              store={store}
              currentUser={currentUser}
              onStoreUpdated={(updated) => {
                if (onStoreChange) onStoreChange(updated);
              }}
            />
          )}
        </main>
      </div>

      {/* Global Quick Add Product Modal */}
      <Screen6AddEditProductModal
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
        store={store}
        currentUser={currentUser}
        onProductSaved={() => {}}
      />

      {/* Printable Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        sale={selectedReceiptSale}
        store={store}
      />

      {/* Barcode Camera Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        onScanSuccess={handleBarcodeScanned}
      />
    </div>
  );
};
