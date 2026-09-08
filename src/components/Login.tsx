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
  ScanLine,
  Zap,
  Activity,
  CheckCircle2,
  Scale,
  Receipt,
  Store as StoreIcon,
  Wifi,
  Flame
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
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30 text-slate-900 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans select-none">
      
      {/* Dynamic Animated Ambient Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(249,115,22,0.1),rgba(255,255,255,0))]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 pointer-events-none" />

      {/* Floating Animated Ambient Blobs */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.15, 0.25, 0.15],
          x: [0, 30, 0],
          y: [0, -30, 0]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-32 -left-32 w-96 h-96 bg-orange-400/25 rounded-full blur-[90px] pointer-events-none" 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.25, 1],
          opacity: [0.12, 0.22, 0.12],
          x: [0, -35, 0],
          y: [0, 35, 0]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-400/20 rounded-full blur-[90px] pointer-events-none" 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.15, 1],
          opacity: [0.08, 0.15, 0.08]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-400/10 rounded-full blur-[110px] pointer-events-none" 
      />

      {/* Floating Particles / Micro Sparkles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full bg-orange-400/40 pointer-events-none"
          style={{
            top: `${15 + i * 14}%`,
            left: `${10 + ((i * 37) % 80)}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.7, 0.2],
            scale: [0.8, 1.3, 0.8]
          }}
          transition={{
            duration: 4 + (i % 3) * 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.7
          }}
        />
      ))}

      <div className="max-w-5xl w-full mx-auto relative z-10">
        
        {/* Main Grid: Left Animated Brand/Kiosk Visualizer + Right Login Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          
          {/* Left Column: Interactive Brand, High-Tech Scanner Hologram & Feature Badges */}
          <motion.div 
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="lg:col-span-6 space-y-6 text-center lg:text-left"
          >
            {/* Brand Header */}
            <div className="flex items-center justify-center lg:justify-start gap-3">
              <motion.div
                whileHover={{ rotate: [0, -8, 8, 0], scale: 1.08 }}
                transition={{ duration: 0.5 }}
                className="relative"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-amber-400 rounded-2xl blur-xs opacity-60 animate-pulse" />
                <div className="relative bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                  <Logo size="lg" lightMode={true} />
                </div>
              </motion.div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-none">
                  <span className="text-slate-900">Mart</span> <span className="text-orange-500">Pro</span>
                </h1>
                <p className="text-[11px] font-bold text-orange-600 uppercase tracking-widest flex items-center gap-1 mt-1 justify-center lg:justify-start">
                  Retail & Supermarket Terminal
                </p>
              </div>
            </div>

            {/* Headline */}
            <div className="space-y-2">
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                Next-Gen Retail & <br className="hidden sm:inline" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 via-amber-600 to-amber-500">
                  Self-Service POS Terminal
                </span>
              </h2>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed max-w-md mx-auto lg:mx-0 font-normal">
                Multi-tier role authentication for Super Admin, Store Managers, Fast Cash Counters, Product Cataloging, and Kiosk Customer Price Checkers.
              </p>
            </div>

            {/* HIGH-TECH INTERACTIVE LASER SCANNER HOLOGRAM CARD */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="relative p-4 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200 shadow-md overflow-hidden group"
            >
              {/* Laser Scan Sweep Line */}
              <motion.div 
                animate={{ 
                  top: ['5%', '88%', '5%'],
                  opacity: [0.4, 0.9, 0.4]
                }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_10px_2px_rgba(239,68,68,0.7)] pointer-events-none z-10"
              />

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 shadow-xs shrink-0 relative">
                    <ScanLine className="w-6 h-6 animate-pulse" />
                    <motion.div 
                      animate={{ scale: [1, 1.4, 1], opacity: [0.8, 0, 0.8] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 rounded-xl border border-orange-400"
                    />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900">Laser Hardware Scan Ready</span>
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Auto-sync • Weight Scales • Thermal Slips
                    </p>
                  </div>
                </div>

                <div className="hidden sm:flex flex-col items-end text-right">
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                    SYSTEM ONLINE
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 font-mono">Port 3000 Secured</span>
                </div>
              </div>
            </motion.div>


            {/* Feature Highlights with Staggered Animations */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <motion.div 
                whileHover={{ scale: 1.03, y: -2 }}
                className="p-3 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2.5 transition-all hover:border-orange-300 hover:shadow-md"
              >
                <div className="p-2 bg-orange-50 text-orange-600 border border-orange-200 rounded-xl">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-900">Multi-Role RBAC</div>
                  <div className="text-[10px] text-slate-500">Granular Permissions</div>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.03, y: -2 }}
                className="p-3 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2.5 transition-all hover:border-emerald-300 hover:shadow-md"
              >
                <div className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-900">POS Billing</div>
                  <div className="text-[10px] text-slate-500">Laser Fast Checkout</div>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.03, y: -2 }}
                className="p-3 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2.5 transition-all hover:border-blue-300 hover:shadow-md"
              >
                <div className="p-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl">
                  <Barcode className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-900">Live Inventory</div>
                  <div className="text-[10px] text-slate-500">Cost & Profit COGS</div>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.03, y: -2 }}
                className="p-3 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2.5 transition-all hover:border-amber-300 hover:shadow-md"
              >
                <div className="p-2 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl">
                  <Flame className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-900">Price Checker</div>
                  <div className="text-[10px] text-slate-500">Self-Service Voice Kiosk</div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Right Column: Modern Clean White Login Card */}
          <motion.div 
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            className="lg:col-span-6 relative"
          >
            {/* Soft Ambient Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-400/20 via-amber-400/20 to-yellow-400/20 rounded-3xl blur-xl opacity-80 pointer-events-none" />

            <div className="relative bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/80">
              
              <div className="space-y-1 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-orange-700 bg-orange-50 px-3 py-1 rounded-full border border-orange-200 inline-flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-orange-600 animate-spin" style={{ animationDuration: '6s' }} />
                    Secure Gateway Access
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                    <Wifi className="w-3 h-3 text-emerald-600" />
                    <span>SSL Encrypted</span>
                  </div>
                </div>

                <h3 className="text-2xl font-black text-slate-900 tracking-tight pt-2">
                  Account Sign In
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Enter your terminal credentials to access your designated workspace.
                </p>
              </div>

              {/* Error Notification Banner */}
              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-medium flex items-start gap-2.5 shadow-xs"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 animate-bounce" />
                    <div className="flex-1 leading-relaxed">{error}</div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Username Input Field */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Username or Email
                  </label>
                  <div className="relative group">
                    <div className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors ${
                      focusedField === 'username' ? 'text-orange-600' : 'text-slate-400'
                    }`}>
                      <User className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      required
                      value={username}
                      onFocus={() => setFocusedField('username')}
                      onBlur={() => setFocusedField(null)}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter system username..."
                      className="w-full pl-11 pr-4 py-3 bg-slate-50/70 border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all text-sm font-medium shadow-2xs"
                    />
                  </div>
                </div>

                {/* Password Input Field */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Password
                    </label>
                  </div>
                  <div className="relative group">
                    <div className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors ${
                      focusedField === 'password' ? 'text-orange-600' : 'text-slate-400'
                    }`}>
                      <Lock className="w-5 h-5" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-11 pr-11 py-3 bg-slate-50/70 border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all text-sm font-medium shadow-2xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-orange-600 transition-colors cursor-pointer"
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
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 hover:from-orange-500 hover:to-amber-500 text-white font-black rounded-xl shadow-lg shadow-orange-600/25 hover:shadow-orange-600/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-wider mt-2 relative overflow-hidden group"
                >
                  {/* Subtle shine sweep on hover */}
                  <div className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:left-full transition-all duration-700 pointer-events-none" />

                  {loading ? (
                    <>
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" 
                      />
                      <span>Authenticating Terminal...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-amber-200 fill-amber-200" />
                      <span>Sign In to System</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </form>

              {/* Bottom Security Footer */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Cloud Firestore Sync
                </span>
                <span className="font-mono text-slate-400">v2.4 Pro</span>
              </div>

            </div>
          </motion.div>
        </div>

      </div>

    </div>
  );
};
