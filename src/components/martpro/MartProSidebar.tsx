import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Boxes, 
  Receipt, 
  Truck, 
  Building2, 
  WalletCards, 
  BarChart3, 
  BookOpen, 
  TrendingUp, 
  Settings, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Store as StoreIcon
} from 'lucide-react';
import { Store, UserAccount } from '../../types';

export type MartProScreenId = 
  | 'dashboard'
  | 'pos'
  | 'products_stock'
  | 'sales_orders'
  | 'suppliers'
  | 'supplier_management'
  | 'expenses_accounts'
  | 'reports'
  | 'ledger_reports'
  | 'profit_loss'
  | 'settings';

interface MartProSidebarProps {
  currentScreen: MartProScreenId;
  onSelectScreen: (screen: MartProScreenId) => void;
  store: Store | null;
  currentUser: UserAccount | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onLogout: () => void;
}

export const MartProSidebar: React.FC<MartProSidebarProps> = ({
  currentScreen,
  onSelectScreen,
  store,
  currentUser,
  isCollapsed,
  onToggleCollapse,
  onLogout
}) => {
  // 10 Customer-Free Nav Items directly matching reference image
  const navItems = [
    { id: 'dashboard' as MartProScreenId, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pos' as MartProScreenId, label: 'POS / New Sale', icon: ShoppingCart },
    { id: 'products_stock' as MartProScreenId, label: 'Products & Stock', icon: Boxes },
    { id: 'sales_orders' as MartProScreenId, label: 'Sales & Orders', icon: Receipt },
    { id: 'suppliers' as MartProScreenId, label: 'Suppliers', icon: Truck },
    { id: 'supplier_management' as MartProScreenId, label: 'Supplier Management', icon: Building2 },
    { id: 'expenses_accounts' as MartProScreenId, label: 'Expenses & Accounts', icon: WalletCards },
    { id: 'reports' as MartProScreenId, label: 'Reports', icon: BarChart3 },
    { id: 'ledger_reports' as MartProScreenId, label: 'Ledger Reports', icon: BookOpen },
    { id: 'profit_loss' as MartProScreenId, label: 'Profit & Loss', icon: TrendingUp },
    { id: 'settings' as MartProScreenId, label: 'Settings & More', icon: Settings },
  ];

  return (
    <aside 
      className={`h-screen bg-[#111111] text-white flex flex-col shrink-0 transition-all duration-300 z-30 select-none border-r border-neutral-800 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-800/80">
        <div 
          onClick={() => onSelectScreen('dashboard')}
          className="flex items-center gap-3 cursor-pointer group overflow-hidden"
        >
          {/* Brand Logo Icon */}
          <div className="w-10 h-10 rounded-xl bg-[#FF6500] flex items-center justify-center shrink-0 shadow-lg shadow-[#FF6500]/20 group-hover:scale-105 transition-transform">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="21" r="1"></circle>
              <circle cx="19" cy="21" r="1"></circle>
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
            </svg>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col truncate">
              <span className="text-lg font-black tracking-tight text-white flex items-center gap-1">
                Mart <span className="text-[#FF6500]">Pro</span>
              </span>
              <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider -mt-1 truncate">
                Supermarket & POS
              </span>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center justify-center transition-colors cursor-pointer"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Store Banner / Context Pill */}
      {!isCollapsed && (
        <div className="px-4 py-3 border-b border-neutral-800/50 bg-neutral-900/60">
          <div className="flex items-center gap-2 text-xs">
            <StoreIcon className="w-3.5 h-3.5 text-[#FF6500] shrink-0" />
            <span className="font-semibold text-neutral-200 truncate">
              {store?.name || 'Mart Pro Central'}
            </span>
          </div>
        </div>
      )}

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1 custom-scrollbar-dark">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectScreen(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#FF6500] text-white shadow-lg shadow-[#FF6500]/25'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800/70'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer Profile & Logout */}
      <div className="p-3 border-t border-neutral-800/80 bg-neutral-900/80">
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-[#FF6500] text-sm shrink-0">
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'A'}
          </div>
          {!isCollapsed && (
            <div className="flex-1 truncate">
              <div className="text-xs font-bold text-white truncate">
                {currentUser?.name || 'Store Admin'}
              </div>
              <div className="text-[10px] text-neutral-400 capitalize truncate">
                {currentUser?.role?.replace(/_/g, ' ') || 'Super Administrator'}
              </div>
            </div>
          )}
          <button
            onClick={onLogout}
            title="Sign out"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
