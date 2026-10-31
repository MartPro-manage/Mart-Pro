import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Calculator, 
  Package, 
  ReceiptText, 
  Users, 
  Truck, 
  DollarSign, 
  FileBarChart, 
  ShieldCheck, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  ShoppingCart,
  Sparkles,
  ArrowRight,
  X
} from 'lucide-react';
import { AppNavView } from './Navbar';
import { UserAccount, Store } from '../types';

interface MartProSidebarProps {
  activeView: AppNavView;
  onSelectView: (view: AppNavView) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  currentUser: UserAccount | null;
  store: Store | null;
}

export const MartProSidebar: React.FC<MartProSidebarProps> = ({
  activeView,
  onSelectView,
  isCollapsed,
  onToggleCollapse,
  isOpenMobile,
  onCloseMobile,
  currentUser,
  store
}) => {
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isCashier = currentUser?.role === 'cash_counter';
  const isProductRegister = currentUser?.role === 'product_register';

  // 10 core navigation groups as specified in the brief and showcase image
  const navigationItems: Array<{
    id: AppNavView;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    allowedRoles?: string[];
    badge?: string;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      allowedRoles: ['super_admin', 'store_admin', 'admin', 'branch_admin']
    },
    {
      id: 'pos',
      label: 'POS / New Sale',
      icon: Calculator,
      allowedRoles: ['super_admin', 'store_admin', 'admin', 'branch_admin', 'cash_counter', 'product_register', 'customer_price_checker'],
      badge: 'POS'
    },
    {
      id: 'products',
      label: 'Products & Stock',
      icon: Package,
      allowedRoles: ['super_admin', 'store_admin', 'admin', 'branch_admin', 'product_register']
    },
    {
      id: 'sales',
      label: 'Sales & Orders',
      icon: ReceiptText,
      allowedRoles: ['super_admin', 'store_admin', 'admin', 'branch_admin']
    },
    {
      id: 'customers',
      label: 'Customers',
      icon: Users,
      allowedRoles: ['super_admin', 'store_admin', 'admin', 'branch_admin', 'cash_counter']
    },
    {
      id: 'suppliers',
      label: 'Suppliers',
      icon: Truck,
      allowedRoles: ['super_admin', 'store_admin', 'admin', 'branch_admin', 'product_register']
    },
    {
      id: 'expenses',
      label: 'Expenses & Accounts',
      icon: DollarSign,
      allowedRoles: ['super_admin', 'store_admin', 'admin', 'branch_admin']
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: FileBarChart,
      allowedRoles: ['super_admin', 'store_admin', 'admin', 'branch_admin']
    },
    {
      id: 'staff',
      label: 'Staff & Permissions',
      icon: ShieldCheck,
      allowedRoles: ['super_admin', 'store_admin', 'admin', 'branch_admin']
    },
    {
      id: 'settings',
      label: 'Settings & More',
      icon: Settings,
      allowedRoles: ['super_admin', 'store_admin', 'admin', 'branch_admin']
    }
  ];

  // Map legacy views into their parent navigation item
  const resolveActiveView = (view: AppNavView): AppNavView => {
    if (view === 'inventory') return 'products';
    if (view === 'add_supplier') return 'suppliers';
    if (view === 'attendance') return 'staff';
    return view;
  };

  const currentNormalizedView = resolveActiveView(activeView);

  const visibleItems = navigationItems.filter(item => {
    if (!currentUser?.role) return true;
    if (!item.allowedRoles) return true;
    return item.allowedRoles.includes(currentUser.role);
  });

  const handleItemClick = (id: AppNavView) => {
    onSelectView(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`
          fixed top-0 bottom-0 left-0 z-50
          bg-[#0B132B] text-slate-100 flex flex-col border-r border-slate-800/80
          transition-all duration-300 ease-in-out shrink-0 select-none shadow-xl
          ${isOpenMobile ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
          ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
        `}
      >
        {/* Top Brand Header */}
        <div className="h-16 px-4 border-b border-slate-800/90 flex items-center justify-between gap-3 shrink-0">
          <div 
            onClick={() => handleItemClick('dashboard')}
            className="flex items-center gap-3 cursor-pointer group min-w-0"
            title="Mart Pro - Home"
          >
            <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-600/30 shrink-0 group-hover:scale-105 transition-transform">
              <ShoppingCart className="w-5 h-5" />
            </div>
            {(!isCollapsed || isOpenMobile) && (
              <div className="min-w-0">
                <div className="text-base font-black tracking-tight text-white flex items-center gap-1.5 truncate">
                  <span>Mart</span>
                  <span className="text-orange-500 font-extrabold">Pro</span>
                </div>
                <div className="text-[10px] text-slate-400 font-medium truncate">
                  {store?.name || 'Retail ERP System'}
                </div>
              </div>
            )}
          </div>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden cursor-pointer"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items List */}
        <div className="flex-1 min-h-0 overflow-y-auto px-2.5 py-4 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const isActive = currentNormalizedView === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-xs
                  transition-all duration-150 cursor-pointer relative group
                  ${isActive 
                    ? 'bg-orange-600 text-white font-bold shadow-md shadow-orange-600/20' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }
                  ${isCollapsed && !isOpenMobile ? 'justify-center px-2' : ''}
                `}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                
                {(!isCollapsed || isOpenMobile) && (
                  <span className="truncate tracking-wide text-[13px]">{item.label}</span>
                )}

                {/* Optional Badge */}
                {(!isCollapsed || isOpenMobile) && item.badge && !isActive && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300 font-bold border border-slate-700/60">
                    {item.badge}
                  </span>
                )}

                {/* Tooltip when collapsed */}
                {isCollapsed && !isOpenMobile && (
                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-slate-900 text-white text-xs rounded-md shadow-lg border border-slate-700 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Banner Showcase Card (matching Screen 1 from showcase) */}
        {(!isCollapsed || isOpenMobile) && (
          <div className="p-3 border-t border-slate-800/80 shrink-0">
            <div className="p-3 rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900 border border-slate-700/60 text-slate-200">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-bold text-white">Mart Pro POS</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug mb-2">
                Manage your store smarter with live sync & analytics.
              </p>
              <button
                type="button"
                onClick={() => handleItemClick('pos')}
                className="w-full py-1.5 px-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <span>New Sale</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
