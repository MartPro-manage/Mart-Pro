import React from 'react';
import { AuthState } from '../types';
import { Logo } from './Logo';
import { LogOut, User, Store as StoreIcon, ShieldCheck, Calculator, PackageCheck } from 'lucide-react';

interface NavbarProps {
  auth: AuthState;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ auth, onLogout }) => {
  const { user, store } = auth;

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return { label: 'SUPER ADMIN', color: 'bg-red-50 text-red-700 border-red-200', icon: ShieldCheck };
      case 'admin':
        return { label: 'STORE ADMIN', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: StoreIcon };
      case 'cash_counter':
        return { label: `CASH COUNTER ${user?.counterNumber ? `#${user.counterNumber}` : ''}`, color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Calculator };
      case 'product_register':
        return { label: 'PRODUCT REGISTER', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: PackageCheck };
      default:
        return { label: 'USER', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: User };
    }
  };

  const roleInfo = getRoleLabel(user?.role);
  const RoleIcon = roleInfo.icon;

  return (
    <header className="bg-white border-b border-slate-200 text-slate-900 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand & Store context */}
        <div className="flex items-center gap-4">
          <Logo size="sm" showSubtitle={false} />

          {store && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-xs font-semibold text-slate-700">
              <StoreIcon className="w-3.5 h-3.5 text-orange-600" />
              <span>{store.name}</span>
            </div>
          )}
          {user?.role === 'super_admin' && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200 rounded-full text-xs font-semibold text-red-700">
              <ShieldCheck className="w-3.5 h-3.5 text-red-600" />
              <span>Central Admin</span>
            </div>
          )}
        </div>

        {/* User Badge & Logout */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <span>{user?.name || user?.username}</span>
            </div>
            <div className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full border ${roleInfo.color} flex items-center gap-1 mt-0.5`}>
              <RoleIcon className="w-3 h-3" />
              {roleInfo.label}
            </div>
          </div>

          <div className="h-8 w-px bg-slate-200 hidden sm:block" />

          <button
            onClick={onLogout}
            title="Log Out"
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 hover:border-red-200 transition-all text-xs font-semibold cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">Log Out</span>
          </button>
        </div>

      </div>
    </header>
  );
};
