import React, { useState, useEffect } from 'react';
import { AuthState, Store, Sale } from './types';
import { ensureSuperAdminExists } from './lib/firebase';
import { Login } from './components/Login';
import { Navbar } from './components/Navbar';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { StoreAdminDashboard } from './components/StoreAdminDashboard';
import { ProductRegisterView } from './components/ProductRegisterView';
import { CashCounterView } from './components/CashCounterView';
import { ReceiptModal } from './components/ReceiptModal';

export default function App() {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    store: null
  });

  // Admin temporary view overrides (e.g. if Store Admin or Super Admin switches view)
  const [activeOverrideView, setActiveOverrideView] = useState<'default' | 'pos' | 'inventory'>('default');
  
  // Inspected store for Super Admin
  const [inspectedStore, setInspectedStore] = useState<Store | null>(null);

  // Selected receipt to view
  const [selectedReceiptSale, setSelectedReceiptSale] = useState<Sale | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Seed Super Admin on boot
  useEffect(() => {
    ensureSuperAdminExists();
  }, []);

  const handleLoginSuccess = (newAuth: AuthState) => {
    setAuth(newAuth);
    setActiveOverrideView('default');
    setInspectedStore(newAuth.store);
  };

  const handleLogout = () => {
    setAuth({ user: null, store: null });
    setActiveOverrideView('default');
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar auth={auth} onLogout={handleLogout} />

      {/* Main Content Body */}
      <main className="flex-1">
        
        {/* VIEW ROUTING BASED ON ROLE */}

        {/* 1. SUPER ADMIN ROLE */}
        {userRole === 'super_admin' && (
          <div>
            {inspectedStore ? (
              <div>
                <div className="bg-orange-50 border-b border-orange-200 px-6 py-2 flex items-center justify-between text-xs text-orange-950 font-medium">
                  <span className="font-bold text-orange-700">
                    Inspecting Store: {inspectedStore.name}
                  </span>
                  <button
                    onClick={() => setInspectedStore(null)}
                    className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg cursor-pointer transition-colors shadow-sm"
                  >
                    ← Back to Super Admin Control
                  </button>
                </div>

                <StoreAdminDashboard
                  store={inspectedStore}
                  currentUser={auth.user}
                  onNavigateToPOS={() => setActiveOverrideView('pos')}
                  onNavigateToInventory={() => setActiveOverrideView('inventory')}
                  onViewReceipt={handleViewReceipt}
                />
              </div>
            ) : (
              <SuperAdminDashboard
                onSelectStoreToManage={(store) => setInspectedStore(store)}
              />
            )}
          </div>
        )}

        {/* 2. STORE ADMIN ROLE */}
        {userRole === 'admin' && activeStore && (
          <div>
            {activeOverrideView === 'pos' && (
              <div>
                <div className="bg-orange-50 border-b border-orange-200 px-6 py-2 flex items-center justify-between text-xs text-slate-700">
                  <span className="font-bold text-orange-700">Store Admin Mode: Cash Counter POS</span>
                  <button
                    onClick={() => setActiveOverrideView('default')}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg cursor-pointer transition-colors shadow-sm"
                  >
                    ← Back to Store Admin Dashboard
                  </button>
                </div>
                <CashCounterView store={activeStore} currentUser={auth.user} />
              </div>
            )}

            {activeOverrideView === 'inventory' && (
              <div>
                <div className="bg-blue-50 border-b border-blue-200 px-6 py-2 flex items-center justify-between text-xs text-slate-700">
                  <span className="font-bold text-blue-700">Store Admin Mode: Stock In & Product Register</span>
                  <button
                    onClick={() => setActiveOverrideView('default')}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg cursor-pointer transition-colors shadow-sm"
                  >
                    ← Back to Store Admin Dashboard
                  </button>
                </div>
                <ProductRegisterView store={activeStore} currentUser={auth.user} />
              </div>
            )}

            {activeOverrideView === 'default' && (
              <StoreAdminDashboard
                store={activeStore}
                currentUser={auth.user}
                onNavigateToPOS={() => setActiveOverrideView('pos')}
                onNavigateToInventory={() => setActiveOverrideView('inventory')}
                onViewReceipt={handleViewReceipt}
              />
            )}
          </div>
        )}

        {/* 3. PRODUCT REGISTER ROLE */}
        {userRole === 'product_register' && activeStore && (
          <ProductRegisterView store={activeStore} currentUser={auth.user} />
        )}

        {/* 4. CASH COUNTER ROLE */}
        {userRole === 'cash_counter' && activeStore && (
          <CashCounterView store={activeStore} currentUser={auth.user} />
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
