import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  db, 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  getDoc,
  SUPER_ADMIN_USERNAME,
  SUPER_ADMIN_PASSWORD 
} from '../lib/firebase';
import { UserAccount, Store, AuthState } from '../types';
import { Logo } from './Logo';
import { 
  Lock, 
  User, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  ShoppingCart, 
  Barcode, 
  ArrowRight, 
  Sparkles,
  ScanLine
} from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (auth: AuthState) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      // 1. Check Super Admin hardcoded match or Firestore query
      if (
        trimmedUsername.toLowerCase() === SUPER_ADMIN_USERNAME.toLowerCase() && 
        trimmedPassword === SUPER_ADMIN_PASSWORD
      ) {
        // Find or build super admin account object
        const superAdminUser: UserAccount = {
          id: 'super_admin_id',
          storeId: 'all',
          storeName: 'Global Enterprise Network',
          role: 'super_admin',
          username: SUPER_ADMIN_USERNAME,
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

      // If user typed supermarketmanage@gmail.com but wrong password
      if (trimmedUsername.toLowerCase() === SUPER_ADMIN_USERNAME.toLowerCase()) {
        setError('Invalid password for Super Admin account.');
        setLoading(false);
        return;
      }

      // 2. Query Firestore 'users' collection for matching username and password
      const usersQuery = query(
        collection(db, 'users'),
        where('username', '==', trimmedUsername)
      );
      
      const querySnapshot = await getDocs(usersQuery);

      if (querySnapshot.empty) {
        setError('No account found with this username. Please contact your Super Admin or Store Admin.');
        setLoading(false);
        return;
      }

      let matchedUser: UserAccount | null = null;

      querySnapshot.forEach((docSnap) => {
        const userData = docSnap.data() as UserAccount;
        if (userData.password === trimmedPassword) {
          matchedUser = { ...userData, id: docSnap.id };
        }
      });

      if (!matchedUser) {
        setError('Incorrect password. Access denied.');
        setLoading(false);
        return;
      }

      // Fetch store details if not super admin
      let storeDetails: Store | null = null;
      const targetUser: UserAccount = matchedUser;

      if (targetUser.storeId && targetUser.storeId !== 'all') {
        const storeDocRef = doc(db, 'stores', targetUser.storeId);
        const storeSnap = await getDoc(storeDocRef);
        if (storeSnap.exists()) {
          storeDetails = { id: storeSnap.id, ...storeSnap.data() } as Store;
          if (storeDetails.status === 'disabled') {
            setError('This store has been disabled by the Super Admin. Login access is disabled.');
            setLoading(false);
            return;
          }
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
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans">
      
      {/* Animated Floating Ambient Background Gradients */}
      <motion.div 
        animate={{ 
          scale: [1, 1.15, 1],
          opacity: [0.15, 0.28, 0.15],
          x: [0, 20, 0],
          y: [0, -20, 0]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-32 -left-32 w-96 h-96 bg-orange-400/25 rounded-full blur-3xl pointer-events-none" 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.12, 0.22, 0.12],
          x: [0, -25, 0],
          y: [0, 25, 0]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-400/25 rounded-full blur-3xl pointer-events-none" 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.08, 0.18, 0.08]
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-emerald-400/15 rounded-full blur-3xl pointer-events-none" 
      />

      <div className="max-w-4xl w-full mx-auto relative z-10">
        
        {/* Main Grid: Left Feature Overview + Right Login Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Brand & Security Overview */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="lg:col-span-6 space-y-6 text-center lg:text-left"
          >
            <div className="flex items-center justify-center lg:justify-start gap-3">
              <Logo size="lg" />
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  SuperMarket <span className="text-orange-600">POS</span>
                </h1>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Enterprise Cloud Billing
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                Secure Multi-Store & <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-600">Self-Service System</span>
              </h2>
              <p className="text-slate-600 text-sm leading-relaxed max-w-md mx-auto lg:mx-0">
                Log in to your authorized terminal role: Super Admin, Store Admin, Cash Counter, Product Register, or Customer Price Checker Kiosk.
              </p>
            </div>

            {/* Feature Highlights with Staggered Fade-in */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="p-3.5 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3"
              >
                <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-900">Multi-Role RBAC</div>
                  <div className="text-[11px] text-slate-500">Secure Access Control</div>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="p-3.5 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3"
              >
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-900">POS Billing</div>
                  <div className="text-[11px] text-slate-500">Print & E-Receipts</div>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="p-3.5 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3"
              >
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Barcode className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-900">Live Inventory</div>
                  <div className="text-[11px] text-slate-500">Fast Barcode Scan</div>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="p-3.5 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3"
              >
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <ScanLine className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-900">Price Checker</div>
                  <div className="text-[11px] text-slate-500">Self-Service Terminal</div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Right Column: Modern Animated Login Card */}
          <motion.div 
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
            className="lg:col-span-6 bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 relative"
          >
            <div className="space-y-1 mb-6">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200 inline-block">
                Secure System Gateway
              </span>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight pt-1">
                Account Sign In
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Enter your authorized username and password to proceed.
              </p>
            </div>

            {/* Error Notification Banner */}
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-medium flex items-start gap-2.5 animate-shake"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">{error}</div>
              </motion.div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Username Input Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Username or Email
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-600 transition-colors">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your system username..."
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all text-sm font-medium shadow-2xs"
                  />
                </div>
              </div>

              {/* Password Input Field */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-600 transition-colors">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all text-sm font-medium shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Submit Button with Interactive Micro-Animations */}
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 hover:from-orange-500 hover:to-amber-500 text-white font-black rounded-xl shadow-lg shadow-orange-600/25 hover:shadow-orange-600/35 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-wider mt-2"
              >
                {loading ? (
                  <>
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" 
                    />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to System</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-500">
              <span>Super Admin manages stores & accounts &bull; Protected by Cloud Firestore</span>
            </div>

          </motion.div>
        </div>

      </div>
    </div>
  );
};
