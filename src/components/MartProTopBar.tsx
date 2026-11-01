import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Store as StoreIcon, 
  ChevronDown, 
  LogOut, 
  ShieldCheck, 
  User, 
  Menu, 
  Calculator, 
  ScanLine, 
  Settings, 
  Sparkles,
  Command,
  Calendar,
  Clock,
  ShoppingCart
} from 'lucide-react';
import { UserAccount, Store } from '../types';
import { AppNavView } from './Navbar';

interface MartProTopBarProps {
  currentUser: UserAccount | null;
  currentStore: Store | null;
  allStores: Store[];
  onSelectStore: (store: Store) => void;
  onOpenSearch: () => void;
  onOpenMobileMenu: () => void;
  onNavigate: (view: AppNavView) => void;
  onLogout: () => void;
  isSidebarCollapsed: boolean;
  dateText?: string;
}

export const MartProTopBar: React.FC<MartProTopBarProps> = ({
  currentUser,
  currentStore,
  allStores,
  onSelectStore,
  onOpenSearch,
  onOpenMobileMenu,
  onNavigate,
  onLogout,
  isSidebarCollapsed,
  dateText = '25-10-2026 13:56:08'
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isStoreMenuOpen, setIsStoreMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const storeMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (storeMenuRef.current && !storeMenuRef.current.contains(e.target as Node)) {
        setIsStoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return { label: 'Super Admin', color: 'bg-red-50 text-red-700 border-red-200' };
      case 'store_admin':
      case 'admin':
        return { label: 'Store Admin', color: 'bg-orange-50 text-orange-700 border-orange-200' };
      case 'cash_counter':
        return { label: `Cashier #${currentUser?.counterNumber || 1}`, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'product_register':
        return { label: 'Stock Manager', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'customer_price_checker':
        return { label: 'Price Checker', color: 'bg-purple-50 text-purple-700 border-purple-200' };
      default:
        return { label: (role || 'Staff').replace(/_/g, ' '), color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const roleBadge = getRoleBadge(currentUser?.role);

  return (
    <header className="h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 shrink-0">
      {/* Left: Mobile Menu Trigger & Global Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search Input (matching Showcase Image) */}
        <div 
          onClick={onOpenSearch}
          className="flex-1 flex items-center gap-2.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100/90 border border-slate-200 rounded-xl text-slate-400 hover:text-slate-600 text-xs sm:text-sm font-medium transition-all cursor-pointer shadow-2xs group"
          title="Search products, barcodes, customers, or sales (Press / or ⌘K)"
        >
          <Search className="w-4 h-4 text-slate-400 group-hover:text-orange-500 transition-colors" />
          <span className="truncate flex-1">Search products, barcodes, or stock...</span>
          <span className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-white border border-slate-200 rounded text-slate-400 shadow-3xs">
            <Command className="w-2.5 h-2.5" /> K
          </span>
        </div>
      </div>

      {/* Right: Quick POS, Date/Time Pill, Store Switcher & User Profile Menu */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Quick New Sale (POS) Button */}
        <button
          type="button"
          onClick={() => onNavigate('pos')}
          className="hidden md:flex items-center gap-2 px-3.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-orange-600/20 active:scale-95 cursor-pointer"
          title="Open POS New Sale Counter (F9)"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>New Sale (F9)</span>
        </button>

        {/* Date & Time pill restored to old date */}
        <div 
          className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
          title="Active System Date & Time"
        >
          <Calendar className="w-3.5 h-3.5 text-orange-600" />
          <span>{dateText}</span>
        </div>

        {/* Store Selector Pill (matching Showcase Image: "Main Store ▾") */}
        <div className="relative" ref={storeMenuRef}>
          <button
            type="button"
            onClick={() => setIsStoreMenuOpen(!isStoreMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-all cursor-pointer shadow-2xs"
            title="Active Store Branch"
          >
            <StoreIcon className="w-3.5 h-3.5 text-orange-600" />
            <span className="hidden sm:inline truncate max-w-[120px]">
              {currentStore?.name || 'Main Store'}
            </span>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isStoreMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isStoreMenuOpen && allStores.length > 0 && (
            <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in duration-150">
              <div className="px-3.5 py-2 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Select Branch
              </div>
              <div className="max-h-60 overflow-y-auto py-1">
                {allStores.map(st => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      onSelectStore(st);
                      setIsStoreMenuOpen(false);
                    }}
                    className={`w-full px-3.5 py-2 text-left text-xs font-medium flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                      st.id === currentStore?.id ? 'text-orange-600 font-bold bg-orange-50/50' : 'text-slate-700'
                    }`}
                  >
                    <span className="truncate">{st.name}</span>
                    {st.id === currentStore?.id && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">Active</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill (matching Showcase Image: "Admin ▾") */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <div className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 font-black flex items-center justify-center text-xs">
              {currentUser?.name?.charAt(0).toUpperCase() || currentUser?.username?.charAt(0).toUpperCase() || 'A'}
            </div>
            <span className="hidden sm:inline truncate max-w-[100px]">
              {currentUser?.name || currentUser?.username || 'Admin'}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* User Menu Dropdown */}
          {isUserMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-3.5 py-2.5 border-b border-slate-100">
                <div className="font-bold text-slate-900 text-xs truncate">
                  {currentUser?.name || currentUser?.username || 'Store Admin'}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-bold ${roleBadge.color}`}>
                    {roleBadge.label}
                  </span>
                </div>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('pos');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                >
                  <Calculator className="w-3.5 h-3.5 text-slate-400" />
                  <span>Open POS Counter</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onNavigate('price_checker');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                >
                  <ScanLine className="w-3.5 h-3.5 text-slate-400" />
                  <span>Price Checker Kiosk</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onNavigate('settings');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                  <span>Store Settings</span>
                </button>
              </div>

              <div className="pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
