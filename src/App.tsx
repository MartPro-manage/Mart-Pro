import React, { useState, useEffect } from 'react';
import { AuthState, Store, Sale, UserAccount } from './types';
import { ensureSuperAdminExists, db, doc, updateDoc, setDoc, collection, query, where, getDocs, onSnapshot } from './lib/firebase';
import { Login } from './components/Login';
import { Navbar, AppNavView } from './components/Navbar';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { StoreAdminDashboard } from './components/StoreAdminDashboard';
import { ProductRegisterView } from './components/ProductRegisterView';
import { CashCounterView } from './components/CashCounterView';
import { CustomerPriceCheckerView } from './components/CustomerPriceCheckerView';
import { SupplierManagementView } from './components/SupplierManagementView';
import { AddSupplierView } from './components/AddSupplierView';
import { StaffSessionsView } from './components/StaffSessionsView';
import { StaffAttendanceView } from './components/StaffAttendanceView';
import { ReceiptModal } from './components/ReceiptModal';
import { PublicReceiptView } from './components/PublicReceiptView';
import { OnlineStorefrontView } from './components/OnlineStorefrontView';
import { Screen1Login } from './components/martpro/Screen1Login';
import { MartProMainLayout } from './components/martpro/MartProMainLayout';
import { PackagePlus } from 'lucide-react';

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

  // 1. Render Screen 1: Login Page if not authenticated
  if (!auth.user) {
    return <Screen1Login onLoginSuccess={handleLoginSuccess} initialError={disabledNotice} />;
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

  // 2. Render complete 13-Screen Mart Pro layout matching reference mockup
  return (
    <MartProMainLayout
      store={effectiveStore}
      currentUser={auth.user}
      onLogout={handleLogout}
      onStoreChange={(s) => setInspectedStore(s)}
    />
  );
}
