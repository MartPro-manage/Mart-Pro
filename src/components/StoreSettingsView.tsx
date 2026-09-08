import React, { useState, useEffect } from 'react';
import { 
  db, 
  doc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  handleFirestoreError, 
  OperationType 
} from '../lib/firebase';
import { Store, UserAccount } from '../types';
import { speakMessage } from '../lib/speech';
import { 
  Settings, 
  Receipt, 
  Volume2, 
  Camera, 
  KeyRound, 
  ShieldCheck, 
  CheckCircle, 
  AlertCircle, 
  Save, 
  Bell, 
  Users, 
  Calculator, 
  PackageCheck,
  Check,
  Eye, 
  EyeOff
} from 'lucide-react';

interface StoreSettingsViewProps {
  store: Store;
  currentUser: UserAccount;
  storeUsers: UserAccount[];
  onStoreUpdated?: (updatedStore: Store) => void;
}

export const StoreSettingsView: React.FC<StoreSettingsViewProps> = ({
  store,
  currentUser,
  storeUsers,
  onStoreUpdated
}) => {
  // POS & Receipt Settings
  const [currencySymbol, setCurrencySymbol] = useState(store.currencySymbol || 'Rs.');
  const [receiptHeader, setReceiptHeader] = useState(store.receiptHeader || 'OFFICIAL SALES INVOICE');
  const [receiptFooter, setReceiptFooter] = useState(store.receiptFooter || 'THANK YOU FOR SHOPPING WITH US! Retain slip for returns.');
  const [returnPolicyDays, setReturnPolicyDays] = useState<number>(store.returnPolicyDays || 7);

  // Audio & Hardware Settings
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState<boolean>(store.soundEffectsEnabled !== false);
  const [lowStockAlertThreshold, setLowStockAlertThreshold] = useState<number>(store.lowStockAlertThreshold || 5);

  // Password Change State
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Voice Test & Status State
  const [voiceTestMsg, setVoiceTestMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync state if store prop changes
  useEffect(() => {
    setCurrencySymbol(store.currencySymbol || 'Rs.');
    setReceiptHeader(store.receiptHeader || 'OFFICIAL SALES INVOICE');
    setReceiptFooter(store.receiptFooter || 'THANK YOU FOR SHOPPING WITH US! Retain slip for returns.');
    setReturnPolicyDays(store.returnPolicyDays || 7);
    setSoundEffectsEnabled(store.soundEffectsEnabled !== false);
    setLowStockAlertThreshold(store.lowStockAlertThreshold || 5);
  }, [store]);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  const handleTestVoice = () => {
    if (store.voiceAnnouncementEnabled === false) {
      showNotification('error', '⚠️ Voice generation is DISALLOWED by Super Admin policy for this store.');
      return;
    }
    const storeLabel = store.name || 'our store';
    speakMessage(`Total bill is 450 rupees. Thank you for shopping at ${storeLabel}!`);
    setVoiceTestMsg(`🔊 Playing voice test for "${storeLabel}"`);
    setTimeout(() => setVoiceTestMsg(null), 4000);
  };

  const handleSaveAllSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setLoading(true);
    try {
      const storeRef = doc(db, 'stores', store.id);
      const updatePayload: Partial<Store> = {
        currencySymbol: currencySymbol.trim() || 'Rs.',
        receiptHeader: receiptHeader.trim(),
        receiptFooter: receiptFooter.trim(),
        returnPolicyDays: Number(returnPolicyDays) || 7,
        soundEffectsEnabled: Boolean(soundEffectsEnabled),
        lowStockAlertThreshold: Number(lowStockAlertThreshold) || 5
      };

      // Also update password if provided
      if (newAdminPassword.trim()) {
        if (newAdminPassword.trim().length < 4) {
          showNotification('error', 'New password must be at least 4 characters long.');
          setLoading(false);
          return;
        }
        updatePayload.adminPassword = newAdminPassword.trim();
      }

      await updateDoc(storeRef, updatePayload);

      // If admin password changed, synchronize user record for this admin
      if (newAdminPassword.trim()) {
        const usersQ = query(
          collection(db, 'users'),
          where('storeId', '==', store.id),
          where('role', '==', 'admin')
        );
        const usersSnap = await getDocs(usersQ);
        for (const userDoc of usersSnap.docs) {
          await updateDoc(doc(db, 'users', userDoc.id), {
            password: newAdminPassword.trim()
          });
        }
        setNewAdminPassword('');
      }

      if (onStoreUpdated) {
        onStoreUpdated({ ...store, ...updatePayload });
      }

      showNotification('success', '✅ Store settings and configuration updated successfully!');
    } catch (err: any) {
      console.error('Error saving store settings:', err);
      handleFirestoreError(err, OperationType.UPDATE, `stores/${store.id}`);
      showNotification('error', 'Failed to save settings: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const cashiers = storeUsers.filter(u => u.role === 'cash_counter');
  const registrars = storeUsers.filter(u => u.role === 'product_register');

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200 flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5 text-orange-600" /> Admin Settings & Configuration
            </span>
            <span className="text-xs text-slate-500 font-semibold">Store ID: {store.id.slice(0, 8)}...</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Configure {store.name}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-2xl">
            Manage POS receipts, voice announcement preferences, hardware audio policies, low inventory thresholds, and admin security in one centralized location.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleSaveAllSettings()}
          disabled={loading}
          className="px-6 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-extrabold rounded-2xl shadow-md shadow-orange-600/20 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <Save className="w-4 h-4" /> {loading ? 'Saving...' : 'Save All Settings'}
        </button>
      </div>

      {/* Global Notification Toast */}
      {feedbackMsg && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 text-xs sm:text-sm font-bold shadow-sm transition-all animate-fade-in ${
          feedbackMsg.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : 'bg-red-50 border-red-200 text-red-900'
        }`}>
          {feedbackMsg.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Main Settings Grid */}
      <form onSubmit={handleSaveAllSettings} className="space-y-6">
        
        {/* SECTION 1: Receipt & POS Billing Customization */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">1. POS Receipts & Invoice Customization</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Customize thermal print receipts, headers, thank-you notes, and returns policies.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Currency Symbol
              </label>
              <div className="flex items-center gap-2">
                {['Rs.', 'PKR', '$', '€', 'AED', 'SAR'].map((curr) => (
                  <button
                    key={curr}
                    type="button"
                    onClick={() => setCurrencySymbol(curr)}
                    className={`px-3 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                      currencySymbol === curr
                        ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {curr}
                  </button>
                ))}
                <input
                  type="text"
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  placeholder="Custom"
                  className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-bold text-center focus:outline-none focus:border-orange-500"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Currency prefix shown across prices and receipts.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Delete Slip After (Days) from Purchase for Restock & Refund *
              </label>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[1, 3, 7, 14, 30].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setReturnPolicyDays(days)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        returnPolicyDays === days
                          ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {days} {days === 1 ? 'Day' : 'Days'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={returnPolicyDays}
                    onChange={(e) => setReturnPolicyDays(Math.max(1, Number(e.target.value)))}
                    className="w-28 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-bold focus:outline-none focus:border-orange-500"
                  />
                  <span className="text-xs text-slate-600 font-bold">Days from purchase</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Slips older than {returnPolicyDays} days from purchase date will be deleted & disqualified from restock and customer refunds.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Receipt Subtitle / Header Note
              </label>
              <input
                type="text"
                value={receiptHeader}
                onChange={(e) => setReceiptHeader(e.target.value)}
                placeholder="e.g. OFFICIAL SALES INVOICE"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-bold focus:outline-none focus:border-orange-500 focus:bg-white transition-all shadow-xs"
              />
              <p className="text-[11px] text-slate-400 mt-1">Printed directly underneath your store title.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Receipt Footer Thank You Message
              </label>
              <input
                type="text"
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                placeholder="e.g. THANK YOU FOR SHOPPING! Please retain slip for return."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-bold focus:outline-none focus:border-orange-500 focus:bg-white transition-all shadow-xs"
              />
              <p className="text-[11px] text-slate-400 mt-1">Closing greeting printed at the bottom of the slip.</p>
            </div>
          </div>
        </div>

        {/* ROW 2: Hardware, Voice Announcements & Sound Effects (Only shown if allowed) */}
        {(store.voiceAnnouncementEnabled !== false || store.cameraScannerEnabled !== false) && (
          <div className={`grid grid-cols-1 ${store.voiceAnnouncementEnabled !== false && store.cameraScannerEnabled !== false ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-6`}>
            
            {/* Voice Announcement Policy & Tester (Completely hidden if disallowed) */}
            {store.voiceAnnouncementEnabled !== false && (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                        <Volume2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">Voice Speech Announcements</h3>
                        <p className="text-xs text-slate-500 font-medium">
                          Audio greeting & total bill speech at checkout.
                        </p>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold border bg-emerald-50 text-emerald-700 border-emerald-200">
                      ALLOWED
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>Voice Announcement Policy:</span>
                      <span className="font-mono text-emerald-700 font-extrabold">Active & Ready</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                      Cash counters announce: "Total bill is [X] rupees. Thank you for shopping at {store.name}!" at a natural 0.85 rate.
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleTestVoice}
                    className="w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600 shadow-sm cursor-pointer transition-all"
                  >
                    <Volume2 className="w-4 h-4" /> Test Checkout Voice Audio
                  </button>
                  {voiceTestMsg && (
                    <p className="text-xs text-emerald-700 font-bold text-center mt-2 animate-pulse">{voiceTestMsg}</p>
                  )}
                </div>
              </div>
            )}

            {/* Barcode Camera Scanner & Beep Sounds (Completely hidden if disallowed) */}
            {store.cameraScannerEnabled !== false && (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                        <Camera className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">Hardware & Barcode Scanning</h3>
                        <p className="text-xs text-slate-500 font-medium">
                          Camera scanner & USB barcode reader settings.
                        </p>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold border bg-purple-50 text-purple-700 border-purple-200">
                      CAMERA ALLOWED
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">Scan Audio Beep Effects:</span>
                      <button
                        type="button"
                        onClick={() => setSoundEffectsEnabled(!soundEffectsEnabled)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          soundEffectsEnabled
                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-300'
                        }`}
                      >
                        {soundEffectsEnabled ? 'Beep: ON' : 'Beep: OFF'}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Plays positive high-frequency beep on valid scan and buzz alert on out-of-stock items.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-purple-50/50 border border-purple-200 rounded-xl text-[11px] text-purple-900 font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>External USB & Wireless Barcode Scanners are plug-and-play active on all cash counters.</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ROW 4: Inventory Thresholds & Store Admin Security */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Stock & Low Inventory Threshold */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                <Bell className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Inventory & Alert Thresholds</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Trigger visual warnings when store stock drops below limit.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Low Stock Alert Threshold (Units)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={lowStockAlertThreshold}
                  onChange={(e) => setLowStockAlertThreshold(Number(e.target.value))}
                  className="w-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-bold focus:outline-none focus:border-orange-500"
                />
                <span className="text-xs text-slate-600 font-medium">
                  Alert when product quantity is ≤ <strong>{lowStockAlertThreshold} units</strong>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Products reaching this level will display amber low-stock badges in inventory and cashier lookup.
              </p>
            </div>
          </div>

          {/* Admin Credentials & Password Security */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Store Admin Security & Password</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Change the login password for Store Admin account.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-slate-600 font-medium">
                Admin Username: <strong className="text-orange-700 font-mono">{store.adminUsername}</strong>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Set New Store Admin Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="Leave blank to keep current password"
                    className="w-full pl-4 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-bold focus:outline-none focus:border-orange-500 focus:bg-white transition-all shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Enter 4+ characters only if you wish to change your password.</p>
              </div>
            </div>
          </div>

        </div>

        {/* ROW 5: Terminal Staff & Connected Accounts Overview */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Active Staff & Terminal Accounts</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Overview of all Cash Counters and Product Registers configured for {store.name}.
                </p>
              </div>
            </div>

            <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl border border-slate-200">
              {storeUsers.length} Total Users
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Cashiers */}
            <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-emerald-600" /> Cash Counters ({cashiers.length})
                </span>
                <span className="text-[10px] bg-emerald-200/60 text-emerald-900 font-extrabold px-2 py-0.5 rounded-full">
                  POS
                </span>
              </div>
              <div className="space-y-1.5">
                {cashiers.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No cash counters added yet.</p>
                ) : (
                  cashiers.map(c => (
                    <div key={c.id} className="bg-white p-2.5 rounded-xl border border-emerald-100 text-xs">
                      <div className="font-bold text-slate-900">{c.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">user: {c.username}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Product Registrars */}
            <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                  <PackageCheck className="w-4 h-4 text-blue-600" /> Product Registers ({registrars.length})
                </span>
                <span className="text-[10px] bg-blue-200/60 text-blue-900 font-extrabold px-2 py-0.5 rounded-full">
                  STOCK IN
                </span>
              </div>
              <div className="space-y-1.5">
                {registrars.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No product registers added yet.</p>
                ) : (
                  registrars.map(r => (
                    <div key={r.id} className="bg-white p-2.5 rounded-xl border border-blue-100 text-xs">
                      <div className="font-bold text-slate-900">{r.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">user: {r.username}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Store Admin */}
            <div className="p-4 bg-orange-50/50 border border-orange-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-orange-600" /> Store Administrator
                </span>
                <span className="text-[10px] bg-orange-200/60 text-orange-900 font-extrabold px-2 py-0.5 rounded-full">
                  ADMIN
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-orange-100 text-xs space-y-1">
                <div className="font-bold text-slate-900">{currentUser.name || store.name + ' Admin'}</div>
                <div className="text-[11px] text-orange-800 font-mono font-bold">user: {store.adminUsername}</div>
                <div className="text-[10px] text-slate-500">Full Reports & Settings Access</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Save Bar */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 font-medium">
            All modifications will immediately sync to Firestore and apply to customer receipts and terminal stations.
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-8 py-3.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-extrabold rounded-2xl shadow-md shadow-orange-600/20 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" /> {loading ? 'Saving Changes...' : 'Save All Settings'}
          </button>
        </div>

      </form>
    </div>
  );
};
