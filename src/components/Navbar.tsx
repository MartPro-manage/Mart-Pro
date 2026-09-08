import React from 'react';
import { motion } from 'motion/react';
import { AuthState } from '../types';
import { Logo } from './Logo';
import { LogOut, User, Store as StoreIcon, ShieldCheck, Calculator, PackageCheck, Activity, Sparkles, Wifi } from 'lucide-react';

interface NavbarProps {
  auth: AuthState;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ auth, onLogout }) => {
  const { user, store } = auth;

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return { 
          label: 'SUPER ADMIN', 
          color: 'bg-red-50 text-red-700 border-red-200 shadow-red-100', 
          dot: 'bg-red-500',
          icon: ShieldCheck 
        };
      case 'admin':
        return { 
          label: 'STORE ADMIN', 
          color: 'bg-orange-50 text-orange-700 border-orange-200 shadow-orange-100', 
          dot: 'bg-orange-500',
          icon: StoreIcon 
        };
      case 'cash_counter':
        return { 
          label: `CASH COUNTER ${user?.counterNumber ? `#${user.counterNumber}` : ''}`, 
          color: 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-emerald-100', 
          dot: 'bg-emerald-500',
          icon: Calculator 
        };
      case 'product_register':
        return { 
          label: 'PRODUCT REGISTER', 
          color: 'bg-blue-50 text-blue-700 border-blue-200 shadow-blue-100', 
          dot: 'bg-blue-500',
          icon: PackageCheck 
        };
      default:
        return { 
          label: 'USER', 
          color: 'bg-slate-100 text-slate-700 border-slate-200 shadow-slate-100', 
          dot: 'bg-slate-500',
          icon: User 
        };
    }
  };

  const roleInfo = getRoleLabel(user?.role);
  const RoleIcon = roleInfo.icon;

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 text-slate-900 sticky top-0 z-40 shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand & Store Context */}
        <div className="flex items-center gap-3 sm:gap-4">
          <motion.div 
            whileHover={{ scale: 1.03 }}
            className="flex items-center cursor-pointer"
          >
            <Logo size="sm" showSubtitle={false} />
          </motion.div>

          {store && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="hidden sm:flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/80 rounded-full text-xs font-bold text-slate-800 shadow-2xs"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-live-pulse" />
              <StoreIcon className="w-3.5 h-3.5 text-orange-600" />
              <span className="truncate max-w-[160px] md:max-w-[220px]">{store.name}</span>
            </motion.div>
          )}

          {user?.role === 'super_admin' && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="hidden sm:flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-red-50 to-rose-50 border border-red-200/80 rounded-full text-xs font-bold text-red-700 shadow-2xs"
            >
              <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <ShieldCheck className="w-3.5 h-3.5 text-red-600" />
              <span>Central Admin Hub</span>
            </motion.div>
          )}
        </div>

        {/* Live Network & Terminal Controls */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Online Connection Pill */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-bold">
            <Wifi className="w-3 h-3 text-emerald-600" />
            <span>Cloud Connected</span>
          </div>

          {/* User Badge */}
          <div className="hidden sm:flex flex-col items-end">
            <div className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
              <span>{user?.name || user?.username}</span>
            </div>
            <div className={`text-[10px] font-black tracking-wider px-2.5 py-0.5 rounded-full border shadow-xs ${roleInfo.color} flex items-center gap-1 mt-0.5`}>
              <RoleIcon className="w-3 h-3" />
              {roleInfo.label}
            </div>
          </div>

          <div className="h-8 w-px bg-slate-200 hidden sm:block" />

          {/* Logout Button */}
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={onLogout}
            title="Log Out"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100/90 hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 hover:border-red-200 transition-all text-xs font-bold cursor-pointer shadow-2xs"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">Log Out</span>
          </motion.button>
        </div>

      </div>
    </header>
  );
};
