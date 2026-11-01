import React, { useState, useEffect } from 'react';
import { AuthState, Store, Sale, UserAccount, Product, Expense, Supplier, Customer, SupplierProfile } from './types';
import { ensureSuperAdminExists, db, doc, updateDoc, setDoc, collection, query, where, getDocs, onSnapshot } from './lib/firebase';
import { Login } from './components/Login';
import { AppNavView } from './components/Navbar';
import { MartProSidebar } from './components/MartProSidebar';
import { MartProTopBar } from './components/MartProTopBar';
import { UniversalSearchModal } from './components/UniversalSearchModal';
import { ModernStoreDashboard } from './components/ModernStoreDashboard';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { StoreAdminDashboard } from './components/StoreAdminDashboard';
import { ModernProductsView } from './components/ModernProductsView';
import { ProductRegisterView } from './components/ProductRegisterView';
import { CashCounterView } from './components/CashCounterView';
import { CustomerPriceCheckerView } from './components/CustomerPriceCheckerView';
import { ModernSalesOrdersView } from './components/ModernSalesOrdersView';
import { ModernCustomersView } from './components/ModernCustomersView';
import { SupplierManagementView } from './components/SupplierManagementView';
import { AddSupplierView } from './components/AddSupplierView';
import { ModernExpensesView } from './components/ModernExpensesView';
import { ModernReportsView } from './components/ModernReportsView';
import { ModernSettingsView } from './components/ModernSettingsView';
import { StaffSessionsView } from './components/StaffSessionsView';
import { StaffAttendanceView } from './components/StaffAttendanceView';
import { ReceiptModal } from './components/ReceiptModal';
import { BarcodeGeneratorModal } from './components/BarcodeGeneratorModal';
import { PublicReceiptView } from './components/PublicReceiptView';
import { OnlineStorefrontView } from './components/OnlineStorefrontView';

export default function App() {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    store: null
  });

  // URL query params & hash detection for scanned QR codes (e.g. ?receiptId=... or ?no=... or #data=...)
  const [publicReceiptTarget, setPublicReceiptTarget] = useState<{ id?: string | null; number?: string | null; encodedData?: string | null } | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const rId = params.get('receiptId') || params.get('receipt') || params.get('r');
      const rNo = params.get('no') || params.get('receiptNo');
      let dataPayload = params.get('data') || params.get('d');

      const hash = window.location.hash;
      if (hash.includes('data=')) {
        dataPayload = hash.split('data=')[1]?.split('&')[0];
      }

      if (rId || rNo || dataPayload) {
        return { id: rId, number: rNo, encodedData: dataPayload };
      }
    } catch (e) {
      console.warn('URL parsing error:', e);
    }
    return null;
  });

  // URL query param for Online Storefront (e.g. ?onlineStore=ha-mart)
  const [onlineStoreTarget, setOnlineStoreTarget] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('onlineStore') || params.get('store');
    } catch {
      return null;
    }
  });

  // Dynamic Interface Switching state - Clicking any navbar button will instantly display only that interface
  const [activeNavView, setActiveNavView] = useState<AppNavView>('dashboard');

  // Inspected store for Super Admin
  const [inspectedStore, setInspectedStore] = useState<Store | null>(null);

  // All stores for quick selection if super admin accesses a store interface directly
  const [allStores, setAllStores] = useState<Store[]>([]);

  useEffect(() => {
    if (!auth.user) return;
    const unsub = onSnapshot(collection(db, 'stores'), (snapshot) => {
      const list: Store[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Store);
      });
      setAllStores(list);
    }, (err) => {
      console.warn('Error fetching all stores in App:', err);
    });
    return () => unsub();
  }, [auth.user]);

  // Synchronized store users for attendance and operations
  const [storeUsers, setStoreUsers] = useState<UserAccount[]>([]);

  useEffect(() => {
    const storeIdToWatch = inspectedStore?.id || auth.store?.id;
    if (!storeIdToWatch) return;

    const rawIds = [storeIdToWatch, 'all', auth.store?.parentStoreId].filter(Boolean) as string[];
    const uniqueIds = Array.from(new Set(rawIds));

    const q = query(
      collection(db, 'users'),
      where('storeId', 'in', uniqueIds)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: UserAccount[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as UserAccount);
      });
      setStoreUsers(list);
    }, (err) => {
      console.warn('Error fetching store users:', err);
    });

    return () => unsub();
  }, [auth.store?.id, auth.store?.parentStoreId, inspectedStore?.id]);

  // Selected receipt to view
  const [selectedReceiptSale, setSelectedReceiptSale] = useState<Sale | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [disabledNotice, setDisabledNotice] = useState<string | null>(null);

  // Left Vertical Sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Universal Search modal state
  const [isUniversalSearchOpen, setIsUniversalSearchOpen] = useState(false);

  // Barcode Generator modal state
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [selectedBarcodeProduct, setSelectedBarcodeProduct] = useState<Product | null>(null);

  // Dashboard presentation mode (Modern / Classic)
  const [dashboardViewMode, setDashboardViewMode] = useState<'modern' | 'classic'>('modern');

  // Real-time synchronized collections for universal search and modern views
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Subscriptions for products, sales, expenses, suppliers, customers
  useEffect(() => {
    if (!auth.user) return;
    const storeId = inspectedStore?.id || auth.store?.id;

    // 1. Products
    const unsubProd = onSnapshot(collection(db, 'products'), (snapshot) => {
      const list: Product[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Product;
        if (!storeId || data.storeId === storeId || !data.storeId) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      setProducts(list);
    }, (err) => console.warn('Products sync warning in App:', err));

    // 2. Sales
    const unsubSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
      const list: Sale[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Sale;
        if (!storeId || data.storeId === storeId || !data.storeId) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setSales(list);
    }, (err) => console.warn('Sales sync warning in App:', err));

    // 3. Expenses
    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      const list: Expense[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Expense;
        if (!storeId || data.storeId === storeId || !data.storeId) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setExpenses(list);
    }, (err) => console.warn('Expenses sync warning in App:', err));

    // 4. Suppliers
    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      const list: Supplier[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Supplier;
        if (!storeId || data.storeId === storeId || !data.storeId) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      setSuppliers(list);
    }, (err) => console.warn('Suppliers sync warning in App:', err));

    // 5. Customers
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const list: Customer[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Customer;
        if (!storeId || data.storeId === storeId || !data.storeId) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      setCustomers(list);
    }, (err) => console.warn('Customers sync warning in App:', err));

    return () => {
      unsubProd();
      unsubSales();
      unsubExpenses();
      unsubSuppliers();
      unsubCustomers();
    };
  }, [auth.user, auth.store?.id, inspectedStore?.id]);

  // Global Keyboard shortcuts: Cmd+K / Ctrl+K for search, F9 for POS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsUniversalSearchOpen(prev => !prev);
      } else if (e.key === 'F9') {
        e.preventDefault();
        setActiveNavView('pos');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Real-time access revocation listener: when Super Admin disables any account or store, immediately terminate active session
  useEffect(() => {
    if (!auth.user || auth.user.role === 'super_admin') return;

    // Listen to user document
    const userUnsub = onSnapshot(doc(db, 'users', auth.user.id), (userSnap) => {
      if (userSnap.exists()) {
        const uData = userSnap.data() as UserAccount;
        if (uData.status === 'disabled' || uData.disabledBySuperAdmin === true) {
          setDisabledNotice(`Access Revoked: Account "${uData.name || uData.username}" has been DISABLED by Super Admin. No one can enable this account except Super Admin.`);
          handleLogout();
        }
      }
    }, (err) => console.warn('User status listener error:', err));

    // Listen to store document
    let storeUnsub: (() => void) | undefined;
    if (auth.store?.id) {
      storeUnsub = onSnapshot(doc(db, 'stores', auth.store.id), (storeSnap) => {
        if (storeSnap.exists()) {
          const sData = storeSnap.data() as Store;
          if (sData.status === 'disabled' || sData.status === 'inactive' || sData.disabledBySuperAdmin === true) {
            setDisabledNotice(`Access Revoked: Store "${sData.name}" has been DISABLED by Super Admin. All login access is blocked. No one can enable this store except Central Super Admin.`);
            handleLogout();
          }
        }
      }, (err) => console.warn('Store status listener error:', err));
    }

    return () => {
      userUnsub();
      if (storeUnsub) storeUnsub();
    };
  }, [auth.user?.id, auth.store?.id]);

  // Seed Super Admin on boot after initial connection initialization
  useEffect(() => {
    const timer = setTimeout(() => {
      ensureSuperAdminExists();
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const handleExitPublicReceipt = () => {
    // Clear URL search params and hash cleanly without page reload
    try {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.pushState({}, document.title, cleanUrl);
    } catch (e) {
      console.warn(e);
    }
    setPublicReceiptTarget(null);
  };

  // If user scanned a receipt QR code, render PublicReceiptView directly
  if (publicReceiptTarget) {
    return (
      <PublicReceiptView
        receiptId={publicReceiptTarget.id || undefined}
        receiptNumber={publicReceiptTarget.number || undefined}
        encodedData={publicReceiptTarget.encodedData || undefined}
        onExitToLogin={handleExitPublicReceipt}
      />
    );
  }

  // If user navigated via ?onlineStore=..., render Online Storefront View directly
  if (onlineStoreTarget) {
    return (
      <OnlineStorefrontView
        storeIdOrSlug={onlineStoreTarget}
        onExit={() => {
          try {
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.pushState({}, document.title, cleanUrl);
          } catch (e) {
            console.warn(e);
          }
          setOnlineStoreTarget(null);
        }}
      />
    );
  }

  const handleLoginSuccess = (newAuth: AuthState) => {
    setDisabledNotice(null);
    setAuth(newAuth);
    setInspectedStore(newAuth.store);
    
    // Set initial view according to role
    if (newAuth.user?.role === 'cash_counter') {
      setActiveNavView('pos');
    } else if (newAuth.user?.role === 'product_register') {
      setActiveNavView('inventory');
    } else if (newAuth.user?.role === 'customer_price_checker') {
      setActiveNavView('price_checker');
    } else {
      setActiveNavView('dashboard');
    }
  };

  const handleLogout = async () => {
    // If there is an active in-progress billing cart, automatically hold it before completing logout
    try {
      const keysToProcess: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('martpro_active_cart_draft_')) {
          keysToProcess.push(key);
        }
      }

      for (const key of keysToProcess) {
        const rawDraft = localStorage.getItem(key);
        if (rawDraft) {
          const draft = JSON.parse(rawDraft);
          if (draft.items && draft.items.length > 0) {
            const heldId = `autoheld_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const storeId = draft.storeId || auth.store?.id || 'default';
            await setDoc(doc(db, 'held_bills', heldId), {
              id: heldId,
              storeId: storeId,
              counterId: draft.counterNumber?.toString() || auth.user?.counterNumber?.toString() || '1',
              counterName: `Counter #${draft.counterNumber || auth.user?.counterNumber || 1}`,
              cashierUsername: draft.cashierUsername || auth.user?.username || 'cashier',
              items: draft.items,
              subtotal: draft.subtotal || 0,
              total: draft.total || 0,
              heldAt: new Date().toISOString(),
              isAutoHeld: true,
              notes: 'Auto-held during logout'
            });
            localStorage.removeItem(key);
          }
        }
      }
    } catch (err) {
      console.warn('Auto-holding bill on logout warning:', err);
    }

    const nowIso = new Date().toISOString();
    const activeSessionId = localStorage.getItem('martpro_current_session_id');
    const loggedUser = auth.user;

    // 1. Mark current staff session as offline
    if (activeSessionId) {
      try {
        await updateDoc(doc(db, 'staff_sessions', activeSessionId), {
          logoutTime: nowIso,
          status: 'offline'
        });
      } catch (err) {
        console.warn('Could not record logout time:', err);
      }
      localStorage.removeItem('martpro_current_session_id');
    }

    // 2. Query and mark any other active sessions for this user as offline
    if (loggedUser) {
      try {
        const uQuery = query(
          collection(db, 'staff_sessions'),
          where('userId', '==', loggedUser.id),
          where('status', '==', 'online')
        );
        const uSnap = await getDocs(uQuery);
        const updates = uSnap.docs.map(d => updateDoc(doc(db, 'staff_sessions', d.id), {
          logoutTime: nowIso,
          status: 'offline'
        }));
        await Promise.allSettled(updates);

        // Also update users document status if exists
        try {
          await updateDoc(doc(db, 'users', loggedUser.id), {
            isOnline: false,
            lastLogout: nowIso
          });
        } catch {
          // ignore
        }
      } catch (sessErr) {
        console.warn('Error clearing user online status:', sessErr);
      }
    }

    setAuth({ user: null, store: null });
    setActiveNavView('dashboard');
    setInspectedStore(null);
  };

  const handleViewReceipt = (sale: Sale) => {
    setSelectedReceiptSale(sale);
    setIsReceiptModalOpen(true);
  };

  // 1. Render Login Page if not authenticated
  if (!auth.user) {
    return <Login onLoginSuccess={handleLoginSuccess} initialError={disabledNotice} />;
  }

  const defaultStore: Store = {
    id: 'mart-pro-store',
    name: 'Mart Pro Main Supermarket',
    adminUsername: 'admin@martpro.com',
    phone: '0300-8899770',
    address: 'Commercial Avenue, Block 4, Supermarket Hub',
    currencySymbol: 'Rs.',
    status: 'active',
    createdAt: new Date().toISOString()
  };

  const userRole = auth.user.role;
  const currentStoreId = inspectedStore?.id || auth.store?.id;
  const liveStoreFromList = currentStoreId ? allStores.find(s => s.id === currentStoreId) : null;
  const effectiveStore = liveStoreFromList || inspectedStore || auth.store || defaultStore;

  // 2. Render Mart Pro Full Interactive System
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex text-slate-900 font-sans antialiased selection:bg-[#FF6500] selection:text-white">
      {/* 1. Left Vertical Dark Sidebar (Matches Mart Pro Mockup) */}
      <MartProSidebar
        activeView={activeNavView}
        onSelectView={(view) => {
          setActiveNavView(view);
          setIsMobileSidebarOpen(false);
        }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        currentUser={auth.user}
        store={effectiveStore}
      />

      {/* 2. Main Right Column with Top Header Bar + Active Screen */}
      <div 
        className={`flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300 ${
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        {/* Top Header Bar matching Showcase Reference */}
        <MartProTopBar
          currentUser={auth.user}
          currentStore={effectiveStore}
          allStores={allStores}
          onSelectStore={(st) => setInspectedStore(st)}
          onOpenSearch={() => setIsUniversalSearchOpen(true)}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          onNavigate={(view) => setActiveNavView(view)}
          onLogout={handleLogout}
          isSidebarCollapsed={isSidebarCollapsed}
          dateText="25-10-2026 13:56:08"
        />

        {/* Dynamic Main Views */}
        <main className="flex-1 w-full overflow-y-auto">
          {activeNavView === 'dashboard' && (
            userRole === 'super_admin' ? (
              <SuperAdminDashboard
                onSelectStoreToManage={(s) => {
                  setInspectedStore(s);
                  setActiveNavView('pos');
                }}
              />
            ) : (
              <div className="relative">
                {/* Optional Quick Mode Switcher for Store Admin */}
                <div className="px-4 pt-3 pb-1 flex justify-end items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-500">View Style:</span>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-bold shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setDashboardViewMode('modern')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        dashboardViewMode === 'modern' ? 'bg-[#FF6500] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Modern Showcase
                    </button>
                    <button
                      type="button"
                      onClick={() => setDashboardViewMode('classic')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        dashboardViewMode === 'classic' ? 'bg-[#FF6500] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Classic Analytics
                    </button>
                  </div>
                </div>

                {dashboardViewMode === 'modern' ? (
                  <ModernStoreDashboard
                    store={effectiveStore}
                    currentUser={auth.user}
                    products={products}
                    sales={sales}
                    expenses={expenses}
                    onNavigateToPOS={() => setActiveNavView('pos')}
                    onNavigateToProducts={() => setActiveNavView('products')}
                    onNavigateToReports={() => setActiveNavView('reports')}
                    onViewReceipt={handleViewReceipt}
                  />
                ) : (
                  <StoreAdminDashboard
                    store={effectiveStore}
                    currentUser={auth.user}
                    onNavigateToPOS={() => setActiveNavView('pos')}
                    onNavigateToInventory={() => setActiveNavView('inventory')}
                    onViewReceipt={handleViewReceipt}
                  />
                )}
              </div>
            )
          )}

          {activeNavView === 'pos' && (
            <CashCounterView
              store={effectiveStore}
              currentUser={auth.user}
              onBack={() => setActiveNavView('dashboard')}
              onLogout={handleLogout}
            />
          )}

          {(activeNavView === 'products' || activeNavView === 'inventory') && (
            activeNavView === 'inventory' ? (
              <ProductRegisterView
                store={effectiveStore}
                currentUser={auth.user}
                onBack={() => setActiveNavView('products')}
              />
            ) : (
              <ModernProductsView
                store={effectiveStore}
                currentUser={auth.user}
                products={products}
                onOpenBarcodeGenerator={(prod) => {
                  setSelectedBarcodeProduct(prod || null);
                  setIsBarcodeModalOpen(true);
                }}
                onOpenAdvancedRegister={() => setActiveNavView('inventory')}
              />
            )
          )}

          {activeNavView === 'sales' && (
            <ModernSalesOrdersView
              store={effectiveStore}
              currentUser={auth.user}
              sales={sales}
              onViewReceipt={handleViewReceipt}
              allStores={allStores}
            />
          )}

          {activeNavView === 'customers' && (
            <ModernCustomersView
              store={effectiveStore}
              currentUser={auth.user}
            />
          )}

          {activeNavView === 'suppliers' && (
            <SupplierManagementView
              store={effectiveStore}
              currentUser={auth.user}
              onBack={() => setActiveNavView('dashboard')}
            />
          )}

          {activeNavView === 'add_supplier' && (
            <AddSupplierView
              store={effectiveStore}
              currentUser={auth.user}
              onBack={() => setActiveNavView('suppliers')}
            />
          )}

          {activeNavView === 'expenses' && (
            <ModernExpensesView
              store={effectiveStore}
              currentUser={auth.user}
              expenses={expenses}
            />
          )}

          {activeNavView === 'reports' && (
            <ModernReportsView
              store={effectiveStore}
              sales={sales}
              products={products}
              expenses={expenses}
              customers={customers}
              suppliers={suppliers}
            />
          )}

          {activeNavView === 'staff' && (
            <StaffSessionsView
              store={effectiveStore}
              currentUser={auth.user}
              onBack={() => setActiveNavView('dashboard')}
            />
          )}

          {activeNavView === 'attendance' && (
            <StaffAttendanceView
              store={effectiveStore}
              currentUser={auth.user}
              storeUsers={storeUsers}
              onBack={() => setActiveNavView('dashboard')}
            />
          )}

          {activeNavView === 'settings' && (
            <ModernSettingsView
              store={effectiveStore}
              currentUser={auth.user}
              storeUsers={storeUsers}
              sales={sales}
              products={products}
              onBack={() => setActiveNavView('dashboard')}
              onUpdateStore={(updated) => {
                setInspectedStore(updated);
              }}
            />
          )}

          {activeNavView === 'price_checker' && (
            <CustomerPriceCheckerView
              store={effectiveStore}
              currentUser={auth.user}
              onBack={() => setActiveNavView('dashboard')}
            />
          )}
        </main>
      </div>

      {/* 3. Universal Search Modal (Cmd+K / Ctrl+K) */}
      <UniversalSearchModal
        isOpen={isUniversalSearchOpen}
        onClose={() => setIsUniversalSearchOpen(false)}
        products={products}
        sales={sales}
        customers={customers}
        suppliers={suppliers}
        onSelectProduct={() => {
          setIsUniversalSearchOpen(false);
          setActiveNavView('products');
        }}
        onSelectSale={(sale) => {
          setIsUniversalSearchOpen(false);
          handleViewReceipt(sale);
        }}
        onSelectCustomer={() => {
          setIsUniversalSearchOpen(false);
          setActiveNavView('customers');
        }}
        onSelectSupplier={() => {
          setIsUniversalSearchOpen(false);
          setActiveNavView('suppliers');
        }}
      />

      {/* 4. Barcode Generator Modal */}
      {isBarcodeModalOpen && (
        <BarcodeGeneratorModal
          isOpen={isBarcodeModalOpen}
          onClose={() => {
            setIsBarcodeModalOpen(false);
            setSelectedBarcodeProduct(null);
          }}
          store={effectiveStore}
          initialProduct={selectedBarcodeProduct}
        />
      )}

      {/* 5. Shared Receipt Modal */}
      {selectedReceiptSale && (
        <ReceiptModal
          sale={selectedReceiptSale}
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          store={effectiveStore}
        />
      )}
    </div>
  );
}
