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
import { Logo } from './Logo';
import { DownloadAppButton } from './DownloadAppButton';
import { safeStorage } from '../utils/safeStorage';
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
  Flame,
  KeyRound,
  ShieldAlert
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
      // 1. Check Super Admin hardcoded match
      if (trimmedUsername.toLowerCase() === SUPER_ADMIN_USERNAME.toLowerCase()) {
        const isPasswordCorrect = trimmedPassword === SUPER_ADMIN_PASSWORD;

        if (!isPasswordCorrect) {
          setError('Security Verification Failed: Incorrect Super Admin Password.');
          setLoading(false);
          return;
        }

        // Log in successfully!
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

      const targetUser: UserAccount = matchedUser;

      // Fetch store details if not super admin
      let storeDetails: Store | null = null;

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

      // Record real-time staff login activity
      if (targetUser.storeId && targetUser.storeId !== 'all') {
        try {
          const sessionRef = await addDoc(collection(db, 'staff_sessions'), {
            storeId: targetUser.storeId,
            userId: targetUser.id,
            userName: targetUser.name || targetUser.username,
            username: targetUser.username,
            role: targetUser.role,
            counterNumber: targetUser.counterNumber || '',
            loginTime: new Date().toISOString(),
            logoutTime: null,
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
    <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans select-none">
      
      {/* Ambient background glows */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(249,115,22,0.06),rgba(255,255,255,0))]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 pointer-events-none" />

      {/* Floating Animated Ambient Blobs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-orange-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-md w-full mx-auto relative z-10">
        
        {/* Main Clean High-Contrast Login Card */}
        <div className="relative">
          {/* Ambient Glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-yellow-500/10 rounded-3xl blur-xl opacity-60 pointer-events-none" />

          <div className="relative bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-slate-200/50 text-slate-800">
            
            {/* Mart Pro Branding & Logo */}
            <div className="flex flex-col items-center justify-center space-y-2 mb-6 text-center">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-amber-400 rounded-2xl blur-xs opacity-30 animate-pulse" />
                <div className="relative bg-slate-50 p-3 rounded-2xl border border-slate-200 shadow-sm">
                  <Logo size="lg" lightMode={true} />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">
                  Mart <span className="text-orange-500">Pro</span>
                </h1>
                <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mt-0.5">
                  Supermarket Management Software
                </p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-700 bg-orange-50 px-3 py-0.5 rounded-full border border-orange-200 inline-flex items-center gap-1.5 mt-1">
                <Sparkles className="w-3 h-3 text-orange-500 animate-spin" style={{ animationDuration: '6s' }} />
                Secure Gateway Access
              </span>
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
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5 animate-bounce" />
                  <div className="flex-1 leading-relaxed">{error}</div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Username Input Field */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Username or Email
                </label>
                <div className="relative group">
                  <div className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors ${
                    focusedField === 'username' ? 'text-orange-500' : 'text-slate-400'
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
                    placeholder="Enter username or email"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all text-sm font-medium shadow-2xs"
                  />
                </div>
              </div>

              {/* Password Input Field */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Password
                  </label>
                </div>
                <div className="relative group">
                  <div className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors ${
                    focusedField === 'password' ? 'text-orange-500' : 'text-slate-400'
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
                    className="w-full pl-11 pr-11 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all text-sm font-medium shadow-2xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-orange-500 transition-colors cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Submit Button with Interactive Micro-Animations */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 hover:from-orange-500 hover:to-amber-500 text-white font-black rounded-xl shadow-lg shadow-orange-600/30 hover:shadow-orange-600/50 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-wider mt-2 relative overflow-hidden group"
              >
                {/* Subtle shine sweep on hover */}
                <div className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:left-full transition-all duration-700 pointer-events-none" />

                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Authenticating Account...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-200 fill-amber-200" />
                    <span>Sign In to System</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Bottom Security & Download Footer */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Cloud Sync
              </span>

              <DownloadAppButton variant="primary" showInstalledBadge={true} />

              <span className="font-mono text-slate-400">v2.4 Pro</span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
