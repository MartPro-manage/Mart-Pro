import React, { useState } from 'react';
import { 
  Search, 
  Calendar, 
  Menu, 
  ShoppingCart, 
  PlusCircle, 
  Bell, 
  Maximize, 
  ChevronDown 
} from 'lucide-react';
import { Store, UserAccount } from '../../types';

interface MartProHeaderProps {
  onToggleMobileSidebar: () => void;
  onOpenPos: () => void;
  onOpenAddProduct: () => void;
  store: Store | null;
  currentUser: UserAccount | null;
  selectedDateText: string;
  onSelectDateText?: (date: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const MartProHeader: React.FC<MartProHeaderProps> = ({
  onToggleMobileSidebar,
  onOpenPos,
  onOpenAddProduct,
  store,
  currentUser,
  selectedDateText,
  searchQuery,
  onSearchChange
}) => {
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/90 px-4 md:px-6 flex items-center justify-between gap-4 shrink-0 z-20">
      {/* Left: Mobile Toggle & Global Search Input */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          onClick={onToggleMobileSidebar}
          className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search anything (products, bills, suppliers, orders)..."
            className="w-full bg-[#F8F9FA] hover:bg-[#F3F4F6] focus:bg-white text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF6500] focus:ring-2 focus:ring-[#FF6500]/15 transition-all"
          />
        </div>
      </div>

      {/* Right Controls: Quick Actions, Date Filter, User Info */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick New Sale POS Button */}
        <button
          onClick={onOpenPos}
          className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#FF6500] hover:bg-[#e65b00] text-white text-xs font-bold transition-all shadow-sm shadow-[#FF6500]/25 cursor-pointer active:scale-95"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>New Sale (F9)</span>
        </button>

        {/* Quick Add Product Button */}
        <button
          onClick={onOpenAddProduct}
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer"
        >
          <PlusCircle className="w-3.5 h-3.5 text-[#FF6500]" />
          <span>+ Add Product</span>
        </button>

        {/* Date Filter Dropdown Badge (as shown in reference image) */}
        <div className="relative">
          <button
            onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-[#FF6500]" />
            <span className="hidden md:inline">{selectedDateText}</span>
            <span className="md:hidden">Today</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
        </div>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          title="Fullscreen Mode"
          className="hidden sm:flex p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <Maximize className="w-4 h-4" />
        </button>

        {/* User Avatar & Name */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-xl bg-[#FF6500] text-white font-black text-xs flex items-center justify-center shadow-xs">
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="hidden xl:block text-left">
            <div className="text-xs font-bold text-slate-900 leading-tight">
              {currentUser?.name || 'Admin'}
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              {currentUser?.role === 'super_admin' ? 'Super Admin' : 'Store Admin'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
