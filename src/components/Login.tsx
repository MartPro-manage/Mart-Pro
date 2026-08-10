import React, { useState } from 'react';
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
import { Lock, User, AlertCircle, Eye, EyeOff, ShieldCheck, ShoppingCart, Barcode, ArrowRight, Sparkles } from 'lucide-react';

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
    <div className="min-h-screen bg-white text-slate-900 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans">
      {/* Decorative Soft Background Glow Gradients */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-orange-100/70 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-32 w-[30rem] h-[30rem] bg-amber-100/60 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-orange-50/80 rounded-full blur-3xl pointer-events-none" />

      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 pointer-events-none"
      />

      <div className="w-full max-w-5xl z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        
        {/* Left Side: Brand Showcase & Value Props */}
        <div className="lg:col-span-6 space-y-6 text-center lg:text-left py-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200/80 text-orange-700 text-xs font-semibold tracking-wide shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-orange-600" />
            <span>Smart Supermarket & POS Management</span>
          </div>

          <div className="flex flex-col items-center lg:items-start">
            <Logo size="xl" showSubtitle={true} lightMode={true} />
          </div>

          <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-lg mx-auto lg:mx-0 font-normal">
            Streamline supermarket sales, serial-number tracking, stock inventory management, and fast counter receipts with real-time sync.
          </p>

          {/* Key Feature Badges */}
          <div className="grid grid-cols-3 gap-3 pt-2 max-w-md mx-auto lg:mx-0">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col items-center text-center space-y-1 shadow-sm">
              <ShoppingCart className="w-5 h-5 text-orange-600" />
              <span className="text-xs font-bold text-slate-800">Express POS</span>
              <span className="text-[10px] text-slate-500 font-medium">Barcode & S/N</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col items-center text-center space-y-1 shadow-sm">
              <Barcode className="w-5 h-5 text-amber-600" />
              <span className="text-xs font-bold text-slate-800">Stock Register</span>
              <span className="text-[10px] text-slate-500 font-medium">Auto Deduct</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col items-center text-center space-y-1 shadow-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span className="text-xs font-bold text-slate-800">Multi-Store</span>
              <span className="text-[10px] text-slate-500 font-medium">Role Managed</span>
            </div>
          </div>
        </div>

        {/* Right Side: Sleek White Login Card */}
        <div className="lg:col-span-6">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xl shadow-slate-200/60 relative overflow-hidden">
            
            {/* Top Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600" />

            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-orange-600" /> Account Sign In
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Enter credentials to open your portal</p>
              </div>

              <span className="text-[11px] px-3 py-1 rounded-full bg-orange-50 text-orange-700 font-bold border border-orange-200 shrink-0">
                Mart Pro v2.0
              </span>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="leading-snug">{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Username / Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username or email address"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all text-sm font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 hover:from-orange-500 hover:to-orange-500 active:from-orange-700 active:to-orange-700 text-white font-black rounded-xl shadow-lg shadow-orange-600/20 hover:shadow-orange-600/30 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-wider"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <span>Sign In to System</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

          </div>
        </div>

      </div>
    </div>
  );
};

