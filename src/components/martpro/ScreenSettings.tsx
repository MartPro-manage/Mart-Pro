import React, { useState } from 'react';
import { 
  Settings, 
  Store as StoreIcon, 
  Printer, 
  Camera, 
  Volume2, 
  RotateCcw, 
  ShieldCheck, 
  Save,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { Store, UserAccount } from '../../types';
import { db, doc, updateDoc } from '../../lib/firebase';
import { seedMartProStoreData } from '../../lib/martProDataSeeder';

interface ScreenSettingsProps {
  store: Store | null;
  currentUser: UserAccount | null;
  onStoreUpdated: (store: Store) => void;
}

export const ScreenSettings: React.FC<ScreenSettingsProps> = ({
  store,
  currentUser,
  onStoreUpdated
}) => {
  const [storeName, setStoreName] = useState(store?.name || 'Mart Pro Supermarket');
  const [phone, setPhone] = useState(store?.phone || '0300-8899770');
  const [address, setAddress] = useState(store?.address || 'Commercial Avenue, Block 4');
  const [receiptHeader, setReceiptHeader] = useState(store?.receiptHeader || 'Welcome to Mart Pro!');
  const [receiptFooter, setReceiptFooter] = useState(store?.receiptFooter || 'Thank you for shopping with us! No Customer hassle.');
  const [cameraScanner, setCameraScanner] = useState(store?.cameraScannerEnabled !== false);
  const [voiceAnnouncement, setVoiceAnnouncement] = useState(store?.voiceAnnouncementEnabled !== false);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store?.id) return;
    setSaving(true);
    try {
      const updated: Partial<Store> = {
        name: storeName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        receiptHeader: receiptHeader.trim(),
        receiptFooter: receiptFooter.trim(),
        cameraScannerEnabled: cameraScanner,
        voiceAnnouncementEnabled: voiceAnnouncement
      };
      await updateDoc(doc(db, 'stores', store.id), updated);
      onStoreUpdated({ ...store, ...updated });
      alert('Settings saved successfully!');
    } catch (err) {
      console.error('Settings save error:', err);
      alert('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleReSeedData = async () => {
    if (!store?.id) return;
    if (confirm('Re-seed the exact reference image mock data (Products, Suppliers, Expenses, Sales)?')) {
      setSeeding(true);
      try {
        await seedMartProStoreData(store.id);
        alert('Reference mock data seeded successfully! All screens now populated.');
      } catch (err) {
        console.error('Seed err:', err);
        alert('Seed failed.');
      } finally {
        setSeeding(false);
      }
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 bg-[#F8F9FA] custom-scrollbar select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#111111] tracking-tight">
            Settings & Store Configuration
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Store metadata, thermal receipt layout, hardware permissions, and demo data controls
          </p>
        </div>

        <button
          onClick={handleReSeedData}
          disabled={seeding}
          className="px-4 py-2.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#FF6500] text-xs font-bold border border-orange-200 transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <Sparkles className="w-4 h-4" />
          <span>{seeding ? 'Seeding...' : 'Load Reference Mock Data'}</span>
        </button>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6 max-w-4xl">
        {/* Store Profile */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
          <h2 className="text-sm font-black text-[#111111] uppercase tracking-wider border-b border-slate-100 pb-2">
            Store Profile
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Store Name
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-bold text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Helpline Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-bold text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Store Physical Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-bold text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
              />
            </div>
          </div>
        </div>

        {/* Receipt Setup */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
          <h2 className="text-sm font-black text-[#111111] uppercase tracking-wider border-b border-slate-100 pb-2">
            Receipt Customization
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Receipt Header Greeting
              </label>
              <input
                type="text"
                value={receiptHeader}
                onChange={(e) => setReceiptHeader(e.target.value)}
                className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-bold text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Receipt Footer Notice
              </label>
              <input
                type="text"
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                className="w-full bg-[#F8F9FA] focus:bg-white text-xs font-bold text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500]"
              />
            </div>
          </div>
        </div>

        {/* Hardware & Automation Switches */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-3">
          <h2 className="text-sm font-black text-[#111111] uppercase tracking-wider border-b border-slate-100 pb-2">
            Hardware & Audio Automation
          </h2>

          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 cursor-pointer">
            <div>
              <div className="text-xs font-bold text-slate-900">Inbuilt Barcode Camera Scanner</div>
              <div className="text-[11px] text-slate-500 font-medium">Use device webcam/phone camera to scan barcodes directly</div>
            </div>
            <input
              type="checkbox"
              checked={cameraScanner}
              onChange={(e) => setCameraScanner(e.target.checked)}
              className="w-4 h-4 text-[#FF6500] rounded focus:ring-[#FF6500]"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 cursor-pointer">
            <div>
              <div className="text-xs font-bold text-slate-900">Audio Voice Announcements</div>
              <div className="text-[11px] text-slate-500 font-medium">Announce total bill amounts in natural spoken audio upon sale completion</div>
            </div>
            <input
              type="checkbox"
              checked={voiceAnnouncement}
              onChange={(e) => setVoiceAnnouncement(e.target.checked)}
              className="w-4 h-4 text-[#FF6500] rounded focus:ring-[#FF6500]"
            />
          </label>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-[#FF6500] hover:bg-[#e65b00] active:scale-[0.98] text-white text-xs font-black shadow-md shadow-[#FF6500]/25 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
