import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { AuthState } from '../types';
import { Logo } from './Logo';
import { 
  LogOut, 
  User, 
  Store as StoreIcon, 
  ShieldCheck, 
  Calculator, 
  PackageCheck, 
  PackagePlus,
  Wifi, 
  Truck, 
  LayoutDashboard, 
  ScanLine, 
  Users,
  UserPlus,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export type AppNavView = 
  | 'dashboard' 
  | 'pos' 
  | 'inventory' 
  | 'products'
  | 'sales'
  | 'customers'
  | 'expenses'
  | 'reports'
  | 'settings'
  | 'suppliers' 
  | 'add_supplier' 
  | 'staff' 
  | 'attendance' 
  | 'price_checker';

interface NavbarProps {
  auth: AuthState;
  activeView: AppNavView;
  onSelectView: (view: AppNavView) => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  auth, 
  activeView, 
  onSelectView, 
  onLogout 
}) => {
  const { user, store } = auth;

  const navRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);
  const hasMovedDistance = useRef(false);

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return { 
          label: 'SUPER ADMIN', 
          color: 'bg-red-50 text-red-700 border-red-200 shadow-red-100', 
          icon: ShieldCheck 
        };
      case 'store_admin':
      case 'admin':
        return { 
          label: 'CHAIN OWNER', 
          color: 'bg-orange-50 text-orange-700 border-orange-200 shadow-orange-100', 
          icon: StoreIcon 
        };
      case 'branch_admin':
        return { 
          label: 'BRANCH ADMIN', 
          color: 'bg-amber-50 text-amber-700 border-amber-200 shadow-amber-100', 
          icon: StoreIcon 
        };
      case 'cash_counter':
        return { 
          label: `CASH COUNTER ${user?.counterNumber ? `#${user.counterNumber}` : ''}`, 
          color: 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-emerald-100', 
          icon: Calculator 
        };
      case 'product_register':
        return { 
          label: 'PRODUCT REGISTER', 
          color: 'bg-blue-50 text-blue-700 border-blue-200 shadow-blue-100', 
          icon: PackageCheck 
        };
      case 'customer_price_checker':
        return { 
          label: 'PRICE CHECKER', 
          color: 'bg-purple-50 text-purple-700 border-purple-200 shadow-purple-100', 
          icon: ScanLine 
        };
      default:
        return { 
          label: (role || 'STAFF').replace(/_/g, ' ').toUpperCase(), 
          color: 'bg-slate-100 text-slate-700 border-slate-200 shadow-slate-100', 
          icon: User 
        };
    }
  };

  const roleInfo = getRoleLabel(user?.role);
  const RoleIcon = roleInfo.icon;

  const isSuperAdmin = user?.role === 'super_admin';
  const isStoreAdmin = user?.role === 'store_admin' || user?.role === 'admin';

  const navItems = [
    {
      id: 'dashboard' as AppNavView,
      label: isStoreAdmin ? 'Executive Analytics' : isSuperAdmin ? 'Master Control' : 'Dashboard',
      shortLabel: isStoreAdmin ? 'Analytics' : isSuperAdmin ? 'Control' : 'Dashboard',
      icon: LayoutDashboard,
      roles: ['super_admin', 'store_admin', 'admin', 'branch_admin', 'cash_counter', 'product_register', 'customer_price_checker']
    },
    {
      id: 'pos' as AppNavView,
      label: 'POS Counter',
      shortLabel: 'POS Counter',
      icon: Calculator,
      roles: ['super_admin', 'store_admin', 'admin', 'branch_admin', 'cash_counter', 'product_register', 'customer_price_checker']
    },
    {
      id: 'inventory' as AppNavView,
      label: 'Product Register',
      shortLabel: 'Register',
      icon: PackagePlus,
      roles: ['super_admin', 'store_admin', 'admin', 'branch_admin', 'product_register']
    },
    {
      id: 'suppliers' as AppNavView,
      label: 'Supplier Management',
      shortLabel: 'Suppliers',
      icon: Truck,
      roles: ['super_admin', 'store_admin', 'admin', 'branch_admin', 'product_register', 'cash_counter']
    },
    {
      id: 'add_supplier' as AppNavView,
      label: 'Add Supplier',
      shortLabel: 'Add Supplier',
      icon: UserPlus,
      roles: ['super_admin', 'store_admin', 'admin', 'branch_admin', 'product_register', 'cash_counter']
    },
    {
      id: 'staff' as AppNavView,
      label: 'Staff Sessions',
      shortLabel: 'Staff',
      icon: Users,
      roles: ['super_admin', 'store_admin', 'admin', 'branch_admin']
    },
    {
      id: 'attendance' as AppNavView,
      label: 'Staff Attendance',
      shortLabel: 'Attendance',
      icon: CalendarCheck2,
      roles: ['super_admin', 'store_admin', 'admin', 'branch_admin']
    },
    {
      id: 'price_checker' as AppNavView,
      label: 'Price Checker',
      shortLabel: 'Kiosk',
      icon: ScanLine,
      roles: ['super_admin', 'store_admin', 'admin', 'branch_admin', 'customer_price_checker']
    }
  ];

  const visibleNavItems = navItems.filter(item => 
    !user?.role || item.roles.includes(user.role)
  );

  // Check scroll bounds to enable/disable arrow controls and fade shadows
  const checkScroll = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
  }, []);

  // Update scroll bounds on mount, items change, resize and scroll
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);

    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, visibleNavItems.length]);

  // Translate vertical mouse wheel scrolling into horizontal scrolling
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth > el.clientWidth) {
        if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
          e.preventDefault();
          el.scrollBy({
            left: e.deltaY * 1.2,
            behavior: 'auto'
          });
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Auto-scroll the active tab into center view smoothly
  useEffect(() => {
    const container = navRef.current;
    if (!container) return;

    const activeEl = container.querySelector(`[data-nav-id="${activeView}"]`) as HTMLElement;
    if (activeEl) {
      const elLeft = activeEl.offsetLeft;
      const elWidth = activeEl.offsetWidth;
      const containerWidth = container.clientWidth;
      const target = elLeft - (containerWidth / 2) + (elWidth / 2);
      container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    }
    const timer = setTimeout(checkScroll, 250);
    return () => clearTimeout(timer);
  }, [activeView, checkScroll]);

  // Smooth scroll button handlers
  const handleScrollLeft = () => {
    if (!navRef.current) return;
    navRef.current.scrollBy({ left: -240, behavior: 'smooth' });
  };

  const handleScrollRight = () => {
    if (!navRef.current) return;
    navRef.current.scrollBy({ left: 240, behavior: 'smooth' });
  };

  // Mouse Drag-to-Scroll handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!navRef.current) return;
    setIsMouseDown(true);
    hasMovedDistance.current = false;
    dragStartX.current = e.pageX - navRef.current.offsetLeft;
    dragScrollLeft.current = navRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !navRef.current) return;
    const x = e.pageX - navRef.current.offsetLeft;
    const walk = (x - dragStartX.current) * 1.4;
    if (Math.abs(walk) > 5) {
      hasMovedDistance.current = true;
    }
    navRef.current.scrollLeft = dragScrollLeft.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    setIsMouseDown(false);
  };

  return (
    <header 
      id="main-navigation-bar"
      className="bg-white/95 backdrop-blur-md border-b border-slate-200 text-slate-900 sticky top-0 z-40 shadow-xs transition-all shrink-0 select-none"
    >
      <div className="max-w-[1920px] w-full mx-auto px-2 sm:px-4 lg:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Left: Brand & Store Indicator */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div 
            onClick={() => onSelectView('dashboard')}
            className="flex items-center cursor-pointer transition-transform hover:scale-[1.02]"
            title="Go to Dashboard"
          >
            <Logo size="sm" showSubtitle={false} lightMode={true} />
          </div>

          {store && (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/80 rounded-full text-xs font-bold text-slate-800 shadow-2xs">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <StoreIcon className="w-3.5 h-3.5 text-orange-600" />
              <span className="truncate max-w-[130px]">{store.name}</span>
            </div>
          )}
        </div>

        {/* Center: Dedicated Easily Scrollable Navigation Bar above the interface */}
        {visibleNavItems.length > 0 && (
          <div className="flex-1 min-w-0 mx-1 sm:mx-2 relative flex items-center group">
            
            {/* Left Scroll Button */}
            <button
              type="button"
              onClick={handleScrollLeft}
              className={`absolute left-0 z-30 p-1.5 rounded-full bg-white/95 hover:bg-orange-600 hover:text-white text-slate-700 border border-slate-200 shadow-md backdrop-blur-md transition-all duration-200 cursor-pointer flex items-center justify-center -translate-x-1 sm:translate-x-0 ${
                canScrollLeft ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-75 pointer-events-none'
              }`}
              title="Scroll interfaces left (or roll mouse wheel)"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Left Edge Gradient Mask */}
            <div 
              className={`absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white via-white/90 to-transparent z-10 pointer-events-none transition-opacity duration-200 ${
                canScrollLeft ? 'opacity-100' : 'opacity-0'
              }`} 
            />

            {/* Scrollable Navigation Track */}
            <nav 
              ref={navRef}
              aria-label="Interface Selector" 
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              className={`flex items-center gap-1.5 overflow-x-auto py-1 px-2 w-full nav-scrollbar scroll-smooth select-none ${
                isMouseDown ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              {visibleNavItems.map((item) => {
                const isActive = activeView === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    id={`nav-btn-${item.id}`}
                    data-nav-id={item.id}
                    type="button"
                    onClick={(e) => {
                      if (hasMovedDistance.current) {
                        e.stopPropagation();
                        e.preventDefault();
                        return;
                      }
                      onSelectView(item.id);
                    }}
                    className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/30 ring-2 ring-orange-500/20 scale-[1.02]'
                        : 'bg-slate-100 hover:bg-slate-200/90 text-slate-700 hover:text-slate-900 border border-slate-200/60'
                    }`}
                    title={`Switch to ${item.label}`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-600'}`} />
                    <span className="hidden md:inline">{item.label}</span>
                    <span className="md:hidden">{item.shortLabel}</span>
                  </button>
                );
              })}
            </nav>

            {/* Right Edge Gradient Mask */}
            <div 
              className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white via-white/90 to-transparent z-10 pointer-events-none transition-opacity duration-200 ${
                canScrollRight ? 'opacity-100' : 'opacity-0'
              }`} 
            />

            {/* Right Scroll Button */}
            <button
              type="button"
              onClick={handleScrollRight}
              className={`absolute right-0 z-30 p-1.5 rounded-full bg-white/95 hover:bg-orange-600 hover:text-white text-slate-700 border border-slate-200 shadow-md backdrop-blur-md transition-all duration-200 cursor-pointer flex items-center justify-center translate-x-1 sm:translate-x-0 ${
                canScrollRight ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-75 pointer-events-none'
              }`}
              title="Scroll interfaces right (or roll mouse wheel)"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

          </div>
        )}

        {/* Right: Cloud Connection, User Role Badge & Logout */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-bold">
            <Wifi className="w-3 h-3 text-emerald-600" />
            <span>Cloud Connected</span>
          </div>

          <div className="hidden sm:flex flex-col items-end">
            <div className="text-xs font-extrabold text-slate-900 truncate max-w-[120px]">
              {user?.name || user?.username}
            </div>
            <div className={`text-[9px] font-black tracking-wider px-2 py-0.2 rounded-full border shadow-2xs ${roleInfo.color} flex items-center gap-1`}>
              <RoleIcon className="w-2.5 h-2.5" />
              <span className="truncate max-w-[100px]">{roleInfo.label}</span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          <button
            id="nav-logout-btn"
            type="button"
            onClick={onLogout}
            title="Log Out"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 hover:border-red-200 transition-all text-xs font-bold cursor-pointer shadow-2xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Log Out</span>
          </button>
        </div>

      </div>
    </header>
  );
};
