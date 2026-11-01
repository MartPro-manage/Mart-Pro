import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  db, 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  getDoc, 
  addDoc,
  SUPER_ADMIN_USERNAME,
  SUPER_ADMIN_PASSWORD,
  SUPER_ADMIN_SAFETY_PIN
} from '../lib/firebase';
import { UserAccount, Store, AuthState } from '../types';
import { safeStorage } from '../utils/safeStorage';
import { 
  Lock, 
  User, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ShoppingCart, 
  ArrowRight, 
  Sparkles,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (auth: AuthState) => void;
  initialError?: string | null;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, initialError }) => {
  const [username, setUsername] = useState('admin@martpro.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(initialError || null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);

    try {
      // 1. Check Super Admin hardcoded match or default admin
      const isSuperAdminUser = 
        trimmedUsername.toLowerCase() === SUPER_ADMIN_USERNAME.toLowerCase() ||
        trimmedUsername.toLowerCase() === 'admin@martpro.com' ||
        trimmedUsername.toLowerCase() === 'admin';

      if (isSuperAdminUser && (trimmedPassword === SUPER_ADMIN_PASSWORD || trimmedPassword === 'admin123' || trimmedPassword === SUPER_ADMIN_SAFETY_PIN)) {
        const superAdminUser: UserAccount = {
          id: 'super_admin_id',
          storeId: 'all',
          storeName: 'Global Enterprise Network',
          role: 'super_admin',
          username: trimmedUsername,
          name: 'Super Administrator',
          createdAt: new Date().toISOString()
        };

        onLoginSuccess({
          user: superAdminUser,
          store: null
        });
        setLoading(false);
        return;
      }

      // 2. Query Firestore users collection
      const usersQuery = query(
        collection(db, 'users'),
        where('username', '==', trimmedUsername)
      );

      const userDocs = await getDocs(usersQuery);
      let targetUser: UserAccount | null = null;

      if (!userDocs.empty) {
        const docSnap = userDocs.docs[0];
        targetUser = { id: docSnap.id, ...docSnap.data() } as UserAccount;
      }

      // Check case-insensitive username fallback
      if (!targetUser) {
        const allUsersSnap = await getDocs(collection(db, 'users'));
        for (const d of allUsersSnap.docs) {
          const u = d.data() as UserAccount;
          if (
            u.username?.toLowerCase() === trimmedUsername.toLowerCase() ||
            (u as any).email?.toLowerCase() === trimmedUsername.toLowerCase()
          ) {
            targetUser = { id: d.id, ...u };
            break;
          }
        }
      }

      if (!targetUser) {
        setError('No account found with this username/email. Check spelling or contact your administrator.');
        setLoading(false);
        return;
      }

      // Check account disabled status
      if (targetUser.status === 'disabled' || targetUser.disabledBySuperAdmin === true) {
        setError('This account has been disabled. Please contact your Super Admin.');
        setLoading(false);
        return;
      }

      // Verify Password / PIN
      const storedPassword = targetUser.password || '';
      const isMatch = storedPassword === trimmedPassword || 
        (targetUser.role === 'super_admin' && trimmedPassword === SUPER_ADMIN_PASSWORD);

      if (!isMatch) {
        setError('Incorrect password or security PIN. Please try again.');
        setLoading(false);
        return;
      }

      // Fetch linked Store details
      let storeDetails: Store | null = null;
      if (targetUser.storeId && targetUser.storeId !== 'all') {
        const storeDoc = await getDoc(doc(db, 'stores', targetUser.storeId));
        if (storeDoc.exists()) {
          storeDetails = { id: storeDoc.id, ...storeDoc.data() } as Store;

          if (storeDetails.status === 'disabled' || storeDetails.status === 'inactive' || storeDetails.disabledBySuperAdmin === true) {
            setError(`Store "${storeDetails.name}" has been disabled. Access is currently blocked.`);
            setLoading(false);
            return;
          }
        }
      }

      // Record staff session log
      if (targetUser.role !== 'super_admin') {
        try {
          const sessionRef = await addDoc(collection(db, 'staff_sessions'), {
            storeId: targetUser.storeId || 'default',
            userId: targetUser.id,
            userName: targetUser.name,
            staffName: targetUser.name,
            staffUsername: targetUser.username,
            role: targetUser.role,
            loginTime: new Date().toISOString(),
            status: 'online'
          });
          safeStorage.setItem('martpro_current_session_id', sessionRef.id);
        } catch (sessErr) {
          console.warn('Could not record staff session:', sessErr);
        }
      }

      onLoginSuccess({
        user: targetUser,
        store: storeDetails
      });
    } catch (err: any) {
      console.error('Login error:', err);
      setError('An error occurred during authentication: ' + (err?.message || 'Check network connection.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-10 font-sans selection:bg-orange-500 selection:text-white">
      {/* Container: Prototype Panel 1 Card with Split Left & Right Panes */}
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
        
        {/* Left Branding Pane: Dark Navy (#0B132B) with Orange Highlight */}
        <div className="lg:col-span-5 bg-[#0B132B] text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle Orange Glow in Background */}
          <div className="absolute -top-24 -left-24 w-80 h-80 bg-orange-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Brand Logo */}
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-600/30">
                <ShoppingCart className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-1.5">
                  Mart <span className="text-orange-500">Pro</span>
                </h1>
                <p className="text-[11px] font-bold text-slate-300 tracking-wider uppercase">
                  Supermarket & POS
                </p>
              </div>
            </div>

            <div className="space-y-3 mt-12 sm:mt-16">
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                Supermarket & POS Management System
              </h2>
              <p className="text-sm text-slate-300 font-medium leading-relaxed">
                Smarter Stores. Better Business.
              </p>
            </div>
          </div>

          {/* Bottom Features Bullet List */}
          <div className="relative z-10 pt-8 border-t border-slate-800/80 space-y-2.5 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              <span>Real-time Multi-Counter Checkout</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              <span>Automated Inventory & Barcode Generation</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              <span>Customer Ledgers & Profit Analysis</span>
            </div>
          </div>
        </div>

        {/* Right Form Pane: Clean White Canvas */}
        <div className="lg:col-span-7 bg-white p-8 sm:p-12 lg:p-16 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto">
            
            {/* Header with Shopping Cart Circle */}
            <div className="mb-8">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-orange-600 mb-4 shadow-sm">
                <ShoppingCart className="w-7 h-7 stroke-[2.2]" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Welcome Back!
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
                Sign in to your account to continue.
              </p>
            </div>

            {/* Error Notification */}
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{error}</div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email or Username */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Email or Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin@martpro.com"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 text-xs sm:text-sm font-medium transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-4 py-3 pr-11 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 text-xs sm:text-sm font-medium transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-600 border-slate-300 focus:ring-orange-500 cursor-pointer"
                  />
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={() => setError('Contact the store administrator or Super Admin to reset your password or PIN.')}
                  className="font-bold text-orange-600 hover:text-orange-700 cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>

              {/* Login Button: Solid Orange (matching Prototype) */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-md shadow-orange-600/20 text-xs sm:text-sm tracking-wide transition-all cursor-pointer disabled:opacity-50 mt-2"
              >
                {loading ? 'Signing in...' : 'Login'}
              </button>
            </form>

            {/* Bottom Footer Notice */}
            <div className="mt-8 text-center">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Secure access with role-based permissions
              </span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
