import React, { useState, useEffect } from 'react';
import { 
  db, 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc,
  deleteDoc,
  query, 
  where,
  handleFirestoreError,
  OperationType
} from '../lib/firebase';
import { Store, UserAccount } from '../types';
import { 
  Store as StoreIcon, 
  Plus, 
  UserCheck, 
  Calculator, 
  PackageCheck, 
  Eye, 
  EyeOff,
  ShieldCheck, 
  Building2, 
  UserPlus, 
  Trash2, 
  Key, 
  KeyRound,
  Power,
  Ban,
  CheckCircle, 
  AlertCircle,
  X,
  ChevronRight,
  Info,
  Lock,
  User,
  Shield,
  Camera,
  Volume2,
  VolumeX,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

interface SuperAdminProps {
  onSelectStoreToManage?: (store: Store) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminProps> = ({ onSelectStoreToManage }) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [activeTab, setActiveTab] = useState<'stores' | 'cash_counters' | 'product_registers' | 'all_accounts'>('stores');

  // Form states - Create Store
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreAdminUsername, setNewStoreAdminUsername] = useState('');
  const [newStoreAdminPassword, setNewStoreAdminPassword] = useState('');
  const [newStoreCameraScannerEnabled, setNewStoreCameraScannerEnabled] = useState(true);
  const [newStoreVoiceAnnouncementEnabled, setNewStoreVoiceAnnouncementEnabled] = useState(true);

  // Form states - Create Cash Counter
  const [selectedStoreIdForCounter, setSelectedStoreIdForCounter] = useState('');
  const [counterNumber, setCounterNumber] = useState('');
  const [counterName, setCounterName] = useState('');
  const [counterUsername, setCounterUsername] = useState('');
  const [counterPassword, setCounterPassword] = useState('');

  // Form states - Create Product Registrar
  const [selectedStoreIdForReg, setSelectedStoreIdForReg] = useState('');
  const [registrarName, setRegistrarName] = useState('');
  const [registrarUsername, setRegistrarUsername] = useState('');
  const [registrarPassword, setRegistrarPassword] = useState('');

  // Store Management Modals / Actions
  const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);
  const [resetStoreModal, setResetStoreModal] = useState<Store | null>(null);
  const [newStorePassword, setNewStorePassword] = useState('');

  // Security Matrix "Further Details" Modal
  const [furtherDetailsStore, setFurtherDetailsStore] = useState<Store | null>(null);
  const [showPasswordStoreId, setShowPasswordStoreId] = useState<string | null>(null);
  const [showUserPasswordId, setShowUserPasswordId] = useState<string | null>(null);

  // Sub-account management inside Further Details
  const [userToDelete, setUserToDelete] = useState<UserAccount | null>(null);
  const [resetUserModal, setResetUserModal] = useState<UserAccount | null>(null);
  const [newUserPassword, setNewUserPassword] = useState('');

  // Notifications
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Subscribe to stores and users
  useEffect(() => {
    const unsubStores = onSnapshot(collection(db, 'stores'), (snapshot) => {
      const storeList: Store[] = [];
      snapshot.forEach((d) => storeList.push({ id: d.id, ...d.data() } as Store));
      setStores(storeList);
      if (storeList.length > 0) {
        if (!selectedStoreIdForCounter) setSelectedStoreIdForCounter(storeList[0].id);
        if (!selectedStoreIdForReg) setSelectedStoreIdForReg(storeList[0].id);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'stores');
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const userList: UserAccount[] = [];
      snapshot.forEach((d) => userList.push({ id: d.id, ...d.data() } as UserAccount));
      setUsers(userList);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'users');
    });

    return () => {
      unsubStores();
      unsubUsers();
    };
  }, []);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 5000);
  };

  // Deduplicated users list
  const userMap = new Map<string, UserAccount>();
  users.forEach((user) => {
    const key = (user.username || user.id).trim().toLowerCase();
    if (!userMap.has(key)) {
      userMap.set(key, user);
    }
  });
  const uniqueUsers: UserAccount[] = Array.from(userMap.values());

  // Helper to check username uniqueness
  const isUsernameTaken = (uname: string) => {
    return users.some(u => u.username.toLowerCase() === uname.trim().toLowerCase());
  };

  // Handle Create Store
  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    const storeName = newStoreName.trim();
    const adminUsername = newStoreAdminUsername.trim();
    const adminPassword = newStoreAdminPassword.trim();

    if (!storeName || !adminUsername || !adminPassword) {
      showNotification('error', 'Please fill in all store creation fields.');
      return;
    }

    if (isUsernameTaken(adminUsername)) {
      showNotification('error', `Username "${adminUsername}" is already in use by another account.`);
      return;
    }

    setLoading(true);
    try {
      const storeDocRef = doc(collection(db, 'stores'));
      const storeId = storeDocRef.id;

      const newStoreData: Store = {
        id: storeId,
        name: storeName,
        adminUsername: adminUsername,
        adminPassword: adminPassword,
        status: 'active',
        cameraScannerEnabled: newStoreCameraScannerEnabled,
        voiceAnnouncementEnabled: newStoreVoiceAnnouncementEnabled,
        createdAt: new Date().toISOString()
      };
      await setDoc(storeDocRef, newStoreData);

      const userDocRef = doc(collection(db, 'users'));
      const newStoreAdminUser: UserAccount = {
        id: userDocRef.id,
        storeId: storeId,
        storeName: storeName,
        role: 'admin',
        username: adminUsername,
        password: adminPassword,
        name: `${storeName} Admin`,
        createdAt: new Date().toISOString()
      };
      await setDoc(userDocRef, newStoreAdminUser);

      showNotification('success', `Supermarket Store "${storeName}" and Admin Account created successfully!`);
      setNewStoreName('');
      setNewStoreAdminUsername('');
      setNewStoreAdminPassword('');
      setNewStoreCameraScannerEnabled(true);
      setNewStoreVoiceAnnouncementEnabled(true);
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Failed to create store: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Toggle Inbuilt Camera Scanner per Store (Super Admin Exclusive)
  const handleToggleCameraScanner = async (store: Store) => {
    setLoading(true);
    try {
      const currentVal = store.cameraScannerEnabled !== false;
      const nextVal = !currentVal;
      const storeRef = doc(db, 'stores', store.id);
      await updateDoc(storeRef, { cameraScannerEnabled: nextVal });

      showNotification(
        'success',
        `Inbuilt Camera Barcode Scanner ${nextVal ? 'ENABLED' : 'DISABLED'} for store "${store.name}".`
      );

      // Also update local modal state if open
      if (furtherDetailsStore && furtherDetailsStore.id === store.id) {
        setFurtherDetailsStore({ ...furtherDetailsStore, cameraScannerEnabled: nextVal });
      }
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Failed to toggle camera scanner setting: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Toggle Checkout Voice Announcement & Audio Generation per Store (Super Admin Exclusive)
  const handleToggleVoiceAnnouncement = async (store: Store) => {
    setLoading(true);
    try {
      const currentVal = store.voiceAnnouncementEnabled !== false;
      const nextVal = !currentVal;
      const storeRef = doc(db, 'stores', store.id);
      await updateDoc(storeRef, { voiceAnnouncementEnabled: nextVal });

      showNotification(
        'success',
        `Voice Generation & Audio Announcements ${nextVal ? 'ALLOWED & ENABLED' : 'DISALLOWED & MUTED'} for store "${store.name}".`
      );

      // Also update local modal state if open
      if (furtherDetailsStore && furtherDetailsStore.id === store.id) {
        setFurtherDetailsStore({ ...furtherDetailsStore, voiceAnnouncementEnabled: nextVal });
      }
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Failed to toggle voice generation permission: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Toggle Store Active / Disabled Status
  const handleToggleStoreStatus = async (store: Store) => {
    setLoading(true);
    try {
      const newStatus = store.status === 'disabled' ? 'active' : 'disabled';
      const storeRef = doc(db, 'stores', store.id);
      await updateDoc(storeRef, { status: newStatus });

      showNotification(
        'success', 
        `Store "${store.name}" is now ${newStatus.toUpperCase()}.${newStatus === 'disabled' ? ' Login access for this store is blocked.' : ''}`
      );
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Failed to update store status: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Confirm Delete Store
  const confirmDeleteStore = async () => {
    if (!storeToDelete) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'stores', storeToDelete.id));

      const associatedUsers = users.filter(u => u.storeId === storeToDelete.id);
      for (const u of associatedUsers) {
        await deleteDoc(doc(db, 'users', u.id));
      }

      showNotification('success', `Store "${storeToDelete.name}" and associated sub-accounts were permanently deleted.`);
      setStoreToDelete(null);
      if (furtherDetailsStore?.id === storeToDelete.id) {
        setFurtherDetailsStore(null);
      }
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Failed to delete store: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Reset Store Password
  const handleResetStorePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetStoreModal) return;

    const pass = newStorePassword.trim();
    if (!pass) {
      showNotification('error', 'Password cannot be empty.');
      return;
    }

    setLoading(true);
    try {
      const storeRef = doc(db, 'stores', resetStoreModal.id);
      await updateDoc(storeRef, { adminPassword: pass });

      const adminUser = users.find(u => u.storeId === resetStoreModal.id && u.role === 'admin');
      if (adminUser) {
        await updateDoc(doc(db, 'users', adminUser.id), { password: pass });
      }

      showNotification('success', `Password for store "${resetStoreModal.name}" admin updated successfully!`);
      setResetStoreModal(null);
      setNewStorePassword('');
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Failed to update password: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Create Cash Counter
  const handleCreateCashCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!selectedStoreIdForCounter) {
      showNotification('error', 'Please create or select a store first.');
      return;
    }

    const cNum = counterNumber.trim();
    const cName = counterName.trim();
    const uName = counterUsername.trim();
    const pWord = counterPassword.trim();

    if (!cNum || !cName || !uName || !pWord) {
      showNotification('error', 'All fields are required to create a cash counter.');
      return;
    }

    if (isUsernameTaken(uName)) {
      showNotification('error', `Username "${uName}" is already taken.`);
      return;
    }

    const targetStore = stores.find(s => s.id === selectedStoreIdForCounter);

    setLoading(true);
    try {
      const userDocRef = doc(collection(db, 'users'));
      const cashCounterAccount: UserAccount = {
        id: userDocRef.id,
        storeId: selectedStoreIdForCounter,
        storeName: targetStore?.name || 'Store',
        role: 'cash_counter',
        counterNumber: cNum,
        name: cName,
        username: uName,
        password: pWord,
        createdAt: new Date().toISOString()
      };

      await setDoc(userDocRef, cashCounterAccount);
      showNotification('success', `Cash Counter #${cNum} ("${cName}") account added successfully!`);
      setCounterNumber('');
      setCounterName('');
      setCounterUsername('');
      setCounterPassword('');
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Failed to add cash counter: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Create Product Registrar
  const handleCreateProductRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!selectedStoreIdForReg) {
      showNotification('error', 'Please create or select a store first.');
      return;
    }

    const rName = registrarName.trim();
    const uName = registrarUsername.trim();
    const pWord = registrarPassword.trim();

    if (!rName || !uName || !pWord) {
      showNotification('error', 'All fields are required to create a product register user.');
      return;
    }

    if (isUsernameTaken(uName)) {
      showNotification('error', `Username "${uName}" is already taken.`);
      return;
    }

    const targetStore = stores.find(s => s.id === selectedStoreIdForReg);

    setLoading(true);
    try {
      const userDocRef = doc(collection(db, 'users'));
      const registrarAccount: UserAccount = {
        id: userDocRef.id,
        storeId: selectedStoreIdForReg,
        storeName: targetStore?.name || 'Store',
        role: 'product_register',
        name: rName,
        username: uName,
        password: pWord,
        createdAt: new Date().toISOString()
      };

      await setDoc(userDocRef, registrarAccount);
      showNotification('success', `Product Register user "${rName}" created successfully!`);
      setRegistrarName('');
      setRegistrarUsername('');
      setRegistrarPassword('');
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Failed to add product register: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete Sub-user Account (Cashier / Registrar)
  const handleDeleteUserAccount = async () => {
    if (!userToDelete) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'users', userToDelete.id));
      showNotification('success', `Account "${userToDelete.name}" (${userToDelete.username}) deleted successfully.`);
      setUserToDelete(null);
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Failed to delete account: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset Sub-user Password (Cashier / Registrar)
  const handleResetUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUserModal) return;

    const pass = newUserPassword.trim();
    if (!pass) {
      showNotification('error', 'Password cannot be empty.');
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', resetUserModal.id), { password: pass });
      showNotification('success', `Password for "${resetUserModal.name}" updated successfully!`);
      setResetUserModal(null);
      setNewUserPassword('');
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Failed to reset password: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Title Banner - Clean White Theme */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="space-y-2 z-10">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-orange-600" /> Super Admin Control
              </span>
              <span className="text-xs text-slate-500 font-semibold">Total Stores: {stores.length}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Central Supermarket <span className="text-orange-600">Master Control</span>
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl font-medium">
              Manage Supermarket Stores, enable or disable stores, reset passwords, set up Cash Counters, manage Product Registers, and view Security Matrix.
            </p>
          </div>

          <div className="flex items-center gap-3 z-10 shrink-0">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center min-w-[100px]">
              <div className="text-2xl font-extrabold text-orange-600">{stores.length}</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stores</div>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center min-w-[100px]">
              <div className="text-2xl font-extrabold text-emerald-600">
                {uniqueUsers.filter(u => u.role !== 'super_admin').length}
              </div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Accounts</div>
            </div>
          </div>
        </div>

        {/* Global Notifications */}
        {msg && (
          <div className={`p-4 rounded-2xl border flex items-center gap-3 text-sm font-semibold shadow-sm transition-all ${
            msg.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
              : 'bg-red-50 border-red-200 text-red-900'
          }`}>
            {msg.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />}
            <span>{msg.text}</span>
          </div>
        )}

        {/* Action Tabs Navigation */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
          <button
            onClick={() => setActiveTab('stores')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm cursor-pointer transition-all ${
              activeTab === 'stores'
                ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" /> 1. Manage Stores & Admins
          </button>

          <button
            onClick={() => setActiveTab('cash_counters')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm cursor-pointer transition-all ${
              activeTab === 'cash_counters'
                ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Calculator className="w-4 h-4" /> 2. Add Cash Counters
          </button>

          <button
            onClick={() => setActiveTab('product_registers')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm cursor-pointer transition-all ${
              activeTab === 'product_registers'
                ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <PackageCheck className="w-4 h-4" /> 3. Add Product Registers
          </button>

          <button
            onClick={() => setActiveTab('all_accounts')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm cursor-pointer transition-all ${
              activeTab === 'all_accounts'
                ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4" /> All System Accounts & Security Matrix
          </button>
        </div>

        {/* TAB 1: STORES & STORE ADMINS */}
        {activeTab === 'stores' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Create Store Form */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-orange-600" /> Create New Supermarket Store
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Assign a unique store name and store admin username & password.
                </p>
              </div>

              <form onSubmit={handleCreateStore} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Store Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter store name"
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-orange-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Store Admin Username
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter admin username"
                    value={newStoreAdminUsername}
                    onChange={(e) => setNewStoreAdminUsername(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-orange-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Store Admin Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={newStoreAdminPassword}
                    onChange={(e) => setNewStoreAdminPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-orange-500 font-medium"
                  />
                </div>

                {/* Built-in Camera Scanner Default Setting */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Camera className="w-4 h-4 text-orange-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Inbuilt Barcode Camera Scanner</div>
                      <div className="text-[11px] text-slate-500 font-medium">Enable camera scanning for cashiers in this store</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewStoreCameraScannerEnabled(!newStoreCameraScannerEnabled)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition-all cursor-pointer ${
                      newStoreCameraScannerEnabled
                        ? 'bg-purple-50 border-purple-300 text-purple-800 hover:bg-purple-100'
                        : 'bg-slate-200 border-slate-300 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    {newStoreCameraScannerEnabled ? (
                      <>
                        <ToggleRight className="w-4 h-4 text-purple-600" />
                        <span>Enabled</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-4 h-4 text-slate-400" />
                        <span>Disabled</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Voice Generation & Audio Announcements Super Admin Setting */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Volume2 className="w-4 h-4 text-orange-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Voice Generation & Speech</div>
                      <div className="text-[11px] text-slate-500 font-medium">Allow speech checkout bill amounts & greetings</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewStoreVoiceAnnouncementEnabled(!newStoreVoiceAnnouncementEnabled)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition-all cursor-pointer ${
                      newStoreVoiceAnnouncementEnabled
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                        : 'bg-slate-200 border-slate-300 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    {newStoreVoiceAnnouncementEnabled ? (
                      <>
                        <ToggleRight className="w-4 h-4 text-emerald-600" />
                        <span>Allowed</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-4 h-4 text-slate-400" />
                        <span>Disallowed</span>
                      </>
                    )}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl shadow-md shadow-orange-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  <Plus className="w-4 h-4" />
                  {loading ? 'Creating Store...' : 'Create Supermarket Store'}
                </button>
              </form>
            </div>

            {/* Registered Stores List */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <StoreIcon className="w-5 h-5 text-orange-600" /> Supermarket Stores ({stores.length})
                </h2>
                <span className="text-xs text-slate-500 font-semibold">Active & Configured</span>
              </div>

              <div className="space-y-4">
                {stores.length === 0 ? (
                  <p className="text-sm text-slate-500 p-8 text-center border border-dashed border-slate-300 rounded-2xl font-medium">
                    No supermarket stores created yet. Use the form on the left to add your first store.
                  </p>
                ) : (
                  stores.map(s => {
                    const isDisabled = s.status === 'disabled';
                    const isVoiceAllowed = s.voiceAnnouncementEnabled !== false;
                    const cashierCount = users.filter(u => u.storeId === s.id && u.role === 'cash_counter').length;
                    const registrarCount = users.filter(u => u.storeId === s.id && u.role === 'product_register').length;

                    return (
                      <div 
                        key={s.id} 
                        className={`p-5 rounded-2xl border transition-all space-y-4 ${
                          isDisabled ? 'bg-slate-50 border-red-200' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <h3 className="text-base font-extrabold text-slate-900">{s.name}</h3>
                              {isDisabled ? (
                                <span className="text-[11px] font-bold bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full border border-red-200 flex items-center gap-1">
                                  <Ban className="w-3 h-3" /> Store Disabled
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" /> Active Store
                                </span>
                              )}
                              {s.cameraScannerEnabled !== false ? (
                                <span className="text-[11px] font-bold bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full border border-purple-200 flex items-center gap-1">
                                  <Camera className="w-3 h-3 text-purple-600" /> Camera: ON
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full border border-slate-200 flex items-center gap-1">
                                  <Camera className="w-3 h-3 text-slate-400" /> Camera: OFF
                                </span>
                              )}
                              {isVoiceAllowed ? (
                                <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                                  <Volume2 className="w-3 h-3 text-emerald-600" /> Voice: ALLOWED
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold bg-rose-50 text-rose-700 px-2.5 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
                                  <VolumeX className="w-3 h-3 text-rose-500" /> Voice: DISALLOWED
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1 font-medium">
                              Admin Username: <span className="text-slate-800 font-bold font-mono">{s.adminUsername}</span> | ID: <span className="font-mono">{s.id.substring(0, 8)}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                            {/* Super Admin Voice Toggle */}
                            <button
                              onClick={() => handleToggleVoiceAnnouncement(s)}
                              disabled={loading}
                              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                                isVoiceAllowed
                                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                              }`}
                              title={isVoiceAllowed ? "Disallow & Mute voice generation for this store" : "Allow voice generation for this store"}
                            >
                              {isVoiceAllowed ? <Volume2 className="w-3.5 h-3.5 text-emerald-600" /> : <VolumeX className="w-3.5 h-3.5 text-rose-600" />}
                              <span>{isVoiceAllowed ? 'Voice: ALLOWED' : 'Voice: BLOCKED'}</span>
                            </button>

                            {/* Super Admin Camera Scanner Toggle */}
                            <button
                              onClick={() => handleToggleCameraScanner(s)}
                              disabled={loading}
                              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                                s.cameraScannerEnabled !== false
                                  ? 'bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-200'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                              }`}
                              title={s.cameraScannerEnabled !== false ? "Disable inbuilt camera barcode scanner for this store" : "Enable inbuilt camera barcode scanner for this store"}
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>{s.cameraScannerEnabled !== false ? 'Camera: ON' : 'Camera: OFF'}</span>
                            </button>

                            {onSelectStoreToManage && (
                              <button
                                onClick={() => onSelectStoreToManage(s)}
                                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                              >
                                <Eye className="w-4 h-4 text-orange-600" /> Inspect
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Store Action Controls */}
                        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 text-slate-500 font-medium">
                            <span>Cashiers: <strong className="text-slate-800">{cashierCount}</strong></span>
                            <span>•</span>
                            <span>Registers: <strong className="text-slate-800">{registrarCount}</strong></span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleStoreStatus(s)}
                              disabled={loading}
                              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 text-xs cursor-pointer ${
                                isDisabled 
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-500' 
                                  : 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                              {isDisabled ? 'Enable Store' : 'Disable Store'}
                            </button>

                            <button
                              onClick={() => setResetStoreModal(s)}
                              className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold rounded-xl flex items-center gap-1 cursor-pointer transition-all"
                            >
                              <KeyRound className="w-3.5 h-3.5" /> Reset Admin Pass
                            </button>

                            <button
                              onClick={() => setStoreToDelete(s)}
                              className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 font-bold rounded-xl flex items-center gap-1 cursor-pointer transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete Store
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CASH COUNTERS */}
        {activeTab === 'cash_counters' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-emerald-600" /> Add Cash Counter Account
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Create cash counters (POS terminals) assigned to a specific store.
                </p>
              </div>

              <form onSubmit={handleCreateCashCounter} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Select Supermarket Store
                  </label>
                  <select
                    value={selectedStoreIdForCounter}
                    onChange={(e) => setSelectedStoreIdForCounter(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-orange-500 font-semibold"
                  >
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Counter Number
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 1, 2, 3"
                      value={counterNumber}
                      onChange={(e) => setCounterNumber(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-orange-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Cashier Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={counterName}
                      onChange={(e) => setCounterName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-orange-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Cashier Username
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter cashier username"
                    value={counterUsername}
                    onChange={(e) => setCounterUsername(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-orange-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Cashier Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={counterPassword}
                    onChange={(e) => setCounterPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-orange-500 font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  {loading ? 'Adding Counter...' : 'Add Cash Counter Account'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
                <Calculator className="w-5 h-5 text-emerald-600" /> Active Cash Counter Accounts
              </h2>

              <div className="space-y-3">
                {users.filter(u => u.role === 'cash_counter').length === 0 ? (
                  <p className="text-sm text-slate-500 p-6 text-center border border-dashed border-slate-300 rounded-xl font-medium">
                    No cash counters created yet. Add one using the form on the left!
                  </p>
                ) : (
                  users.filter(u => u.role === 'cash_counter').map(cc => (
                    <div key={cc.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm">{cc.name}</span>
                          <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200">
                            Counter #{cc.counterNumber}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 font-medium">
                          Store: <span className="text-slate-900 font-bold">{cc.storeName}</span> | Username: <span className="text-orange-600 font-bold font-mono">{cc.username}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setResetUserModal(cc)}
                          className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                        >
                          Reset Pass
                        </button>
                        <button
                          onClick={() => setUserToDelete(cc)}
                          className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                          title="Delete Account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PRODUCT REGISTERS */}
        {activeTab === 'product_registers' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-blue-600" /> Add Product Register User
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Product registers scan barcodes, register new items, and update inventory prices and stock.
                </p>
              </div>

              <form onSubmit={handleCreateProductRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Select Supermarket Store
                  </label>
                  <select
                    value={selectedStoreIdForReg}
                    onChange={(e) => setSelectedStoreIdForReg(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-orange-500 font-semibold"
                  >
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Register Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter register full name"
                    value={registrarName}
                    onChange={(e) => setRegistrarName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-orange-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Login Username
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter register username"
                    value={registrarUsername}
                    onChange={(e) => setRegistrarUsername(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-orange-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Login Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={registrarPassword}
                    onChange={(e) => setRegistrarPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-orange-500 font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  {loading ? 'Creating...' : 'Create Product Register Account'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
                <PackageCheck className="w-5 h-5 text-blue-600" /> Active Product Register Accounts
              </h2>

              <div className="space-y-3">
                {users.filter(u => u.role === 'product_register').length === 0 ? (
                  <p className="text-sm text-slate-500 p-6 text-center border border-dashed border-slate-300 rounded-xl font-medium">
                    No product registers created yet. Add one using the form on the left!
                  </p>
                ) : (
                  users.filter(u => u.role === 'product_register').map(pr => (
                    <div key={pr.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm">{pr.name}</span>
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold border border-blue-200">
                            Product Register
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 font-medium">
                          Store: <span className="text-slate-900 font-bold">{pr.storeName}</span> | Username: <span className="text-orange-600 font-bold font-mono">{pr.username}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setResetUserModal(pr)}
                          className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                        >
                          Reset Pass
                        </button>
                        <button
                          onClick={() => setUserToDelete(pr)}
                          className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                          title="Delete Account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ALL SYSTEM ACCOUNTS & SECURITY MATRIX */}
        {activeTab === 'all_accounts' && (
          <div className="space-y-6">
            
            {/* Super Admin Top Control Box */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-red-100 rounded-xl text-red-700 border border-red-200">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">Master Super Administrator</h2>
                    <p className="text-xs text-slate-500 font-medium">Global System Owner & Multi-Store Director</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-red-100 text-red-800 font-bold rounded-full text-xs border border-red-200">
                  Root Authority
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-medium">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold block mb-1">Super Admin Account</span>
                  <span className="text-slate-900 font-extrabold">Super Administrator</span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold block mb-1">Master Username / Email</span>
                  <span className="text-orange-600 font-extrabold font-mono text-sm">supermarketmanage@gmail.com</span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold block mb-1">Security Status</span>
                  <span className="text-emerald-700 font-extrabold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Protected Master Key
                  </span>
                </div>
              </div>
            </div>

            {/* STORES SECURITY MATRIX */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-orange-600" /> Stores Security Matrix ({stores.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    Store names, Admin usernames and passwords, enable/disable controls, and Further Details.
                  </p>
                </div>
              </div>

              {stores.length === 0 ? (
                <div className="text-center p-8 text-slate-500 border border-dashed border-slate-300 rounded-2xl">
                  No stores created in the system yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {stores.map((s) => {
                    const storeCashiers = users.filter(u => u.storeId === s.id && u.role === 'cash_counter');
                    const storeRegistrars = users.filter(u => u.storeId === s.id && u.role === 'product_register');
                    const isPassVisible = showPasswordStoreId === s.id;
                    const isDisabled = s.status === 'disabled';

                    return (
                      <div 
                        key={s.id}
                        className={`p-5 rounded-2xl border transition-all space-y-4 ${
                          isDisabled ? 'bg-slate-50 border-red-200' : 'bg-white border-slate-200 shadow-sm'
                        }`}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                          
                          {/* Store Name & ID */}
                          <div className="md:col-span-4 space-y-1">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-orange-600 shrink-0" />
                              <span className="font-extrabold text-base text-slate-900">{s.name}</span>
                              {isDisabled ? (
                                <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full border border-red-200">
                                  Disabled
                                </span>
                              ) : (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 font-mono pl-6">
                              ID: {s.id}
                            </p>
                          </div>

                          {/* Admin Username */}
                          <div className="md:col-span-3 space-y-0.5">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Store Admin Username</span>
                            <span className="text-sm font-extrabold font-mono text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200 inline-block">
                              {s.adminUsername}
                            </span>
                          </div>

                          {/* Admin Password & Eye Toggle */}
                          <div className="md:col-span-3 space-y-0.5">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Store Admin Password</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-extrabold font-mono text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 inline-block min-w-[100px]">
                                {isPassVisible ? (s.adminPassword || '••••••••') : '••••••••'}
                              </span>
                              <button
                                onClick={() => setShowPasswordStoreId(isPassVisible ? null : s.id)}
                                className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                                title={isPassVisible ? "Hide Password" : "Show Password"}
                              >
                                {isPassVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="md:col-span-2 flex flex-col gap-2 justify-end">
                            <button
                              onClick={() => setFurtherDetailsStore(s)}
                              className="w-full py-2 px-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            >
                              <Info className="w-4 h-4" />
                              <span>Further Details</span>
                            </button>
                          </div>

                        </div>

                        {/* Secondary Store Bar */}
                        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 text-slate-600 font-medium flex-wrap">
                            <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                              Cashiers: <strong className="text-emerald-700">{storeCashiers.length}</strong>
                            </span>
                            <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                              Registers: <strong className="text-blue-700">{storeRegistrars.length}</strong>
                            </span>
                            <button
                              onClick={() => handleToggleVoiceAnnouncement(s)}
                              disabled={loading}
                              className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                s.voiceAnnouncementEnabled !== false
                                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                              }`}
                              title="Click to toggle audio voice generation for this store"
                            >
                              {s.voiceAnnouncementEnabled !== false ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                              <span>Voice: {s.voiceAnnouncementEnabled !== false ? 'Allowed' : 'Disallowed'}</span>
                            </button>
                            <button
                              onClick={() => handleToggleCameraScanner(s)}
                              disabled={loading}
                              className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                s.cameraScannerEnabled !== false
                                  ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                              }`}
                              title="Click to toggle inbuilt camera scanner for this store"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>Camera Scanner: {s.cameraScannerEnabled !== false ? 'Enabled' : 'Disabled'}</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleStoreStatus(s)}
                              disabled={loading}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                                isDisabled 
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-500' 
                                  : 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                              {isDisabled ? 'Enable Store' : 'Disable Store'}
                            </button>

                            <button
                              onClick={() => setResetStoreModal(s)}
                              className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                            >
                              <KeyRound className="w-3.5 h-3.5" /> Change Password
                            </button>

                            <button
                              onClick={() => setStoreToDelete(s)}
                              className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete Store
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* MODAL 1: FURTHER DETAILS FOR A STORE */}
      {furtherDetailsStore && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full p-5 sm:p-8 shadow-2xl space-y-6 relative my-auto max-h-[92vh] overflow-y-auto overscroll-contain custom-scrollbar">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 sticky top-0 bg-white z-10">
              <div>
                <span className="text-xs font-bold text-orange-600 uppercase tracking-wider bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200">
                  Store Security Matrix Breakdown
                </span>
                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2 mt-1">
                  <Building2 className="w-6 h-6 text-orange-600" /> {furtherDetailsStore.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Store Admin Username: <span className="font-mono text-slate-900 font-bold">{furtherDetailsStore.adminUsername}</span>
                </p>
              </div>

              <button
                onClick={() => setFurtherDetailsStore(null)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* SUPER ADMIN HARDWARE & CAMERA SCANNER CONFIGURATION */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Inbuilt Camera Barcode Scanner Policy */}
              <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-2xl flex flex-col justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl shrink-0">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-purple-950">Inbuilt Barcode Camera Scanner</h4>
                    <p className="text-xs text-purple-800/80 font-medium mt-0.5">
                      {furtherDetailsStore.cameraScannerEnabled !== false 
                        ? 'Camera scanning is ENABLED for checkout cashiers in this store.' 
                        : 'Camera scanning is DISABLED for this store (External hardware scanner only).'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleCameraScanner(furtherDetailsStore)}
                  disabled={loading}
                  className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    furtherDetailsStore.cameraScannerEnabled !== false
                      ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-500 shadow-sm'
                      : 'bg-white text-purple-800 border-purple-300 hover:bg-purple-50'
                  }`}
                >
                  {furtherDetailsStore.cameraScannerEnabled !== false ? (
                    <>
                      <ToggleRight className="w-4 h-4 text-white" />
                      <span>Camera: Enabled (Click to Disable)</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4 h-4 text-purple-400" />
                      <span>Camera: Disabled (Click to Enable)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Super Admin Voice Generation Policy */}
              <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl flex flex-col justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-emerald-950">Audio Voice Generation Policy</h4>
                    <p className="text-xs text-emerald-800/80 font-medium mt-0.5">
                      {furtherDetailsStore.voiceAnnouncementEnabled !== false 
                        ? 'Speech announcements for checkout bill amounts & greetings are ALLOWED.' 
                        : 'Voice generation is DISALLOWED & MUTED for all terminals in this store.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleVoiceAnnouncement(furtherDetailsStore)}
                  disabled={loading}
                  className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    furtherDetailsStore.voiceAnnouncementEnabled !== false
                      ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-500 shadow-sm'
                      : 'bg-white text-rose-800 border-rose-300 hover:bg-rose-50'
                  }`}
                >
                  {furtherDetailsStore.voiceAnnouncementEnabled !== false ? (
                    <>
                      <ToggleRight className="w-4 h-4 text-white" />
                      <span>Voice: Allowed (Click to Disallow)</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4 h-4 text-rose-400" />
                      <span>Voice: Disallowed (Click to Allow)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* SECTION A: ALL PRODUCT REGISTERS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-blue-600" />
                  Product Registers ({users.filter(u => u.storeId === furtherDetailsStore.id && u.role === 'product_register').length})
                </h4>
                <span className="text-xs text-slate-500 font-medium">Full Credentials Matrix</span>
              </div>

              {users.filter(u => u.storeId === furtherDetailsStore.id && u.role === 'product_register').length === 0 ? (
                <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-xs text-slate-500 text-center font-medium">
                  No product registers registered for this store yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {users.filter(u => u.storeId === furtherDetailsStore.id && u.role === 'product_register').map((pr) => {
                    const isVisible = showUserPasswordId === pr.id;

                    return (
                      <div key={pr.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-sm">{pr.name}</span>
                            <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                              Stock Register
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs mt-1 font-medium text-slate-600">
                            <span>Username: <strong className="text-orange-600 font-mono">{pr.username}</strong></span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              Password: <strong className="text-slate-900 font-mono">{isVisible ? (pr.password || '••••••••') : '••••••••'}</strong>
                              <button
                                onClick={() => setShowUserPasswordId(isVisible ? null : pr.id)}
                                className="text-slate-500 hover:text-slate-800 p-0.5 ml-1"
                                title="Toggle Password"
                              >
                                {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setResetUserModal(pr)}
                            className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded-xl cursor-pointer"
                          >
                            Reset Password
                          </button>
                          <button
                            onClick={() => setUserToDelete(pr)}
                            className="px-3 py-1.5 text-xs font-bold text-red-700 bg-white hover:bg-red-50 border border-red-200 rounded-xl cursor-pointer flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECTION B: ALL CASHIERS / CASH COUNTERS */}
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-emerald-600" />
                  Cashiers & Cash Counters ({users.filter(u => u.storeId === furtherDetailsStore.id && u.role === 'cash_counter').length})
                </h4>
                <span className="text-xs text-slate-500 font-medium">POS Terminal Credentials Matrix</span>
              </div>

              {users.filter(u => u.storeId === furtherDetailsStore.id && u.role === 'cash_counter').length === 0 ? (
                <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-xs text-slate-500 text-center font-medium">
                  No cash counters registered for this store yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {users.filter(u => u.storeId === furtherDetailsStore.id && u.role === 'cash_counter').map((cc) => {
                    const isVisible = showUserPasswordId === cc.id;

                    return (
                      <div key={cc.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-sm">{cc.name}</span>
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                              Counter #{cc.counterNumber || '1'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs mt-1 font-medium text-slate-600">
                            <span>Username: <strong className="text-orange-600 font-mono">{cc.username}</strong></span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              Password: <strong className="text-slate-900 font-mono">{isVisible ? (cc.password || '••••••••') : '••••••••'}</strong>
                              <button
                                onClick={() => setShowUserPasswordId(isVisible ? null : cc.id)}
                                className="text-slate-500 hover:text-slate-800 p-0.5 ml-1"
                                title="Toggle Password"
                              >
                                {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setResetUserModal(cc)}
                            className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded-xl cursor-pointer"
                          >
                            Reset Password
                          </button>
                          <button
                            onClick={() => setUserToDelete(cc)}
                            className="px-3 py-1.5 text-xs font-bold text-red-700 bg-white hover:bg-red-50 border border-red-200 rounded-xl cursor-pointer flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setFurtherDetailsStore(null)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm"
              >
                Close Further Details
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: RESET STORE ADMIN PASSWORD */}
      {resetStoreModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 relative">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-600" /> Reset Store Admin Password
              </h3>
              <button
                onClick={() => setResetStoreModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-slate-700 font-semibold">
                Store: <span className="text-orange-600">{resetStoreModal.name}</span>
              </p>
              <p className="text-xs text-slate-500 font-medium">
                Admin Username: <span className="font-mono text-slate-900 font-bold">{resetStoreModal.adminUsername}</span>
              </p>
            </div>

            <form onSubmit={handleResetStorePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  New Admin Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  value={newStorePassword}
                  onChange={(e) => setNewStorePassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-blue-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetStoreModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                >
                  {loading ? 'Updating...' : 'Save New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RESET SUB-USER PASSWORD (CASHIER / REGISTRAR) */}
      {resetUserModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 relative">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-600" /> Reset User Password
              </h3>
              <button
                onClick={() => setResetUserModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1 text-xs text-slate-600">
              <p className="font-bold text-slate-900 text-sm">{resetUserModal.name}</p>
              <p>Username: <span className="font-mono text-orange-600 font-bold">{resetUserModal.username}</span></p>
              <p>Role: <span className="font-semibold text-slate-800 uppercase">{resetUserModal.role}</span></p>
            </div>

            <form onSubmit={handleResetUserPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-blue-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetUserModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                >
                  {loading ? 'Updating...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE STORE CONFIRMATION */}
      {storeToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-red-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 relative">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="text-lg font-bold text-red-600 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-600" /> Confirm Delete Store
              </h3>
              <button
                onClick={() => setStoreToDelete(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-slate-700">
              <p>
                Are you sure you want to delete <span className="font-extrabold text-slate-900">{storeToDelete.name}</span>?
              </p>
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1 font-medium">
                <p className="font-bold">⚠️ Warning:</p>
                <p>Deleting this store will permanently remove the store record and all associated cashier / store admin accounts from the system.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStoreToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteStore}
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-600/20 transition-all cursor-pointer"
              >
                {loading ? 'Deleting...' : 'Delete Store Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: DELETE SUB-USER CONFIRMATION */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-red-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 relative">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="text-lg font-bold text-red-600 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-600" /> Confirm Delete Account
              </h3>
              <button
                onClick={() => setUserToDelete(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-slate-700 font-medium">
              <p>
                Delete account <span className="font-extrabold text-slate-900">{userToDelete.name}</span> (<span className="font-mono text-orange-600">{userToDelete.username}</span>)?
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUserAccount}
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-600/20 transition-all cursor-pointer"
              >
                {loading ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
