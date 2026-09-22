import React, { useState, useEffect } from 'react';
import { AuthState, Store, Sale } from './types';
import { ensureSuperAdminExists, db, doc, updateDoc } from './lib/firebase';
import { Login } from './components/Login';
import { Navbar, AppNavView } from './components/Navbar';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { StoreAdminDashboard } from './components/StoreAdminDashboard';
import { ProductRegisterView } from './components/ProductRegisterView';
import { CashCounterView } from './components/CashCounterView';
import { CustomerPriceCheckerView } from './components/CustomerPriceCheckerView';
import { SupplierManagementView } from './components/SupplierManagementView';
import { StaffSessionsView } from './components/StaffSessionsView';
import { ReceiptModal } from './components/ReceiptModal';
import { PublicReceiptView } from './components/PublicReceiptView';

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

  // Dynamic Interface Switching state - Clicking any navbar button will instantly display only that interface
  const [activeNavView, setActiveNavView] = useState<AppNavView>('dashboard');

  // Inspected store for Super Admin
  const [inspectedStore, setInspectedStore] = useState<Store | null>(null);

  // Selected receipt to view
  const [selectedReceiptSale, setSelectedReceiptSale] = useState<Sale | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

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

  // If user scanned a QR code or navigated via ?receiptId=..., render Public E-Receipt View directly
  if (publicReceiptTarget) {
    return (
      <PublicReceiptView
        receiptId={publicReceiptTarget.id}
        receiptNumber={publicReceiptTarget.number}
        encodedData={publicReceiptTarget.encodedData}
        onExitToLogin={handleExitPublicReceipt}
      />
    );
  }

  const handleLoginSuccess = (newAuth: AuthState) => {
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
    const activeSessionId = localStorage.getItem('martpro_current_session_id');
    if (activeSessionId) {
      try {
        await updateDoc(doc(db, 'staff_sessions', activeSessionId), {
          logoutTime: new Date().toISOString(),
          status: 'offline'
        });
      } catch (err) {
        console.warn('Could not record logout time:', err);
      }
      localStorage.removeItem('martpro_current_session_id');
    }
    setAuth({ user: null, store: null });
    setActiveNavView('dashboard');
    setInspectedStore(null);
  };

  const handleViewReceipt = (sale: Sale) => {
    setSelectedReceiptSale(sale);
    setIsReceiptModalOpen(true);
  };

  // Render Login if not authenticated
  if (!auth.user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const userRole = auth.user.role;
  const activeStore = inspectedStore || auth.store;

  // Universal return action: returns back to main panel / default view
  const handleUniversalReturn = () => {
    if (userRole === 'cash_counter') {
      setActiveNavView('pos');
    } else if (userRole === 'product_register') {
      setActiveNavView('inventory');
    } else if (userRole === 'customer_price_checker') {
      setActiveNavView('price_checker');
    } else {
      setActiveNavView('dashboard');
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 text-slate-900 font-sans selection:bg-orange-500 selection:text-white">
      {/* Top Navbar with Dynamic Interface Switching - Moves separately from page interface */}
      <Navbar 
        auth={auth} 
        activeView={activeNavView}
        onSelectView={(view) => setActiveNavView(view)}
        onLogout={handleLogout} 
      />

      {/* Main Content Body - Dynamically renders ONLY the selected view and scrolls separately */}
      <main className="flex-1 overflow-y-auto min-h-0">

        {/* 1. SUPPLIER MODULE (Explicitly in Main Navigation) */}
        {activeNavView === 'suppliers' && activeStore && (
          <SupplierManagementView 
            store={activeStore} 
            currentUser={auth.user} 
            onBack={handleUniversalReturn}
          />
        )}

        {/* 2. STAFF SESSIONS & LIVE MONITORING */}
        {activeNavView === 'staff' && activeStore && (
          <StaffSessionsView 
            store={activeStore} 
            currentUser={auth.user} 
            onBack={handleUniversalReturn}
          />
        )}

        {/* 3. CASH COUNTER POINT OF SALE (POS) */}
        {activeNavView === 'pos' && activeStore && (
          <CashCounterView 
            store={activeStore} 
            currentUser={auth.user} 
            onBack={handleUniversalReturn}
          />
        )}

        {/* 4. PRODUCT REGISTER & STOCK IN */}
        {activeNavView === 'inventory' && activeStore && (
          <ProductRegisterView 
            store={activeStore} 
            currentUser={auth.user} 
            onBack={handleUniversalReturn}
          />
        )}

        {/* 5. CUSTOMER PRICE CHECKER KIOSK */}
        {activeNavView === 'price_checker' && activeStore && (
          <CustomerPriceCheckerView 
            store={activeStore} 
            currentUser={auth.user} 
            onBack={handleUniversalReturn}
          />
        )}

        {/* 6. PRIMARY DASHBOARD / MAIN PANEL */}
        {activeNavView === 'dashboard' && (
          <div>
            {userRole === 'super_admin' ? (
              inspectedStore ? (
                <div>
                  <div className="bg-orange-50 border-b border-orange-200 px-6 py-2.5 flex items-center justify-between text-xs text-orange-950 font-medium">
                    <span className="font-bold text-orange-700">
                      Inspecting Store: {inspectedStore.name}
                    </span>
                    <button
                      onClick={() => setInspectedStore(null)}
                      className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg cursor-pointer transition-colors shadow-sm"
                    >
                      ← Back to Central Super Admin
                    </button>
                  </div>

                  <StoreAdminDashboard
                    store={inspectedStore}
                    currentUser={auth.user}
                    onNavigateToPOS={() => setActiveNavView('pos')}
                    onNavigateToInventory={() => setActiveNavView('inventory')}
                    onNavigateToSuppliers={() => setActiveNavView('suppliers')}
                    onNavigateToLiveSessions={() => setActiveNavView('staff')}
                    onViewReceipt={handleViewReceipt}
                  />
                </div>
              ) : (
                <SuperAdminDashboard
                  onSelectStoreToManage={(store) => setInspectedStore(store)}
                />
              )
            ) : userRole === 'admin' && activeStore ? (
              <StoreAdminDashboard
                store={activeStore}
                currentUser={auth.user}
                onNavigateToPOS={() => setActiveNavView('pos')}
                onNavigateToInventory={() => setActiveNavView('inventory')}
                onNavigateToSuppliers={() => setActiveNavView('suppliers')}
                onNavigateToLiveSessions={() => setActiveNavView('staff')}
                onViewReceipt={handleViewReceipt}
              />
            ) : userRole === 'cash_counter' && activeStore ? (
              <CashCounterView 
                store={activeStore} 
                currentUser={auth.user} 
              />
            ) : userRole === 'product_register' && activeStore ? (
              <ProductRegisterView 
                store={activeStore} 
                currentUser={auth.user} 
              />
            ) : userRole === 'customer_price_checker' && activeStore ? (
              <CustomerPriceCheckerView 
                store={activeStore} 
                currentUser={auth.user} 
              />
            ) : null}
          </div>
        )}

      </main>

      {/* Global Receipt Modal for Viewing Historical or Inspected Receipts */}
      <ReceiptModal
        sale={selectedReceiptSale}
        store={activeStore}
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
      />
    </div>
  );
}
