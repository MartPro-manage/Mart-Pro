import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Activity, 
  Clock, 
  ShieldCheck, 
  Calculator, 
  PackageCheck, 
  UserCheck, 
  UserX, 
  LogOut, 
  LogIn, 
  KeyRound, 
  Plus, 
  Search, 
  RefreshCw,
  Sparkles,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  db, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  handleFirestoreError, 
  OperationType 
} from '../lib/firebase';
import { Store, UserAccount, StaffSessionLog, UserRole } from '../types';

interface StoreStaffTrackerViewProps {
  store: Store;
  currentUser: UserAccount;
  storeUsers: UserAccount[];
  onStaffUpdated?: () => void;
}

export const StoreStaffTrackerView: React.FC<StoreStaffTrackerViewProps> = ({
  store,
  currentUser,
  storeUsers,
  onStaffUpdated
}) => {
  const [sessions, setSessions] = useState<StaffSessionLog[]>([]);
  const [activeTab, setActiveTab] = useState<'working_now' | 'session_logs' | 'staff_accounts'>('working_now');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [nowTime, setNowTime] = useState(Date.now());

  // Periodically tick every 10 seconds to update live duration displays
  useEffect(() => {
    const timer = setInterval(() => setNowTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Real-time synchronization of Staff Sessions
  useEffect(() => {
    if (!store?.id) return;

    const q = query(
      collection(db, 'staff_sessions'),
      where('storeId', '==', store.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: StaffSessionLog[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as StaffSessionLog);
      });
      // Sort newest login first
      list.sort((a, b) => new Date(b.loginTime).getTime() - new Date(a.loginTime).getTime());
      setSessions(list);
    }, (err) => {
      console.error('Error listening to staff sessions:', err);
      handleFirestoreError(err, OperationType.GET, 'staff_sessions');
    });

    return () => unsubscribe();
  }, [store?.id]);

  // Real-time working staff: sessions with status === 'online'
  const currentlyWorkingStaff = useMemo(() => {
    return sessions.filter(s => s.status === 'online');
  }, [sessions]);

  // Format active duration
  const getDurationString = (loginTime: string, logoutTime?: string | null) => {
    const start = new Date(loginTime).getTime();
    const end = logoutTime ? new Date(logoutTime).getTime() : nowTime;
    const diffMs = Math.max(0, end - start);
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins} min${mins === 1 ? '' : 's'}`;
  };

  // Filtered session logs
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (filterRole !== 'all' && s.role !== filterRole) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = s.userName?.toLowerCase().includes(q);
        const matchesUsername = s.username?.toLowerCase().includes(q);
        const matchesRole = s.role?.toLowerCase().includes(q);
        if (!matchesName && !matchesUsername && !matchesRole) return false;
      }
      return true;
    });
  }, [sessions, filterRole, searchQuery]);

  const getRoleBadge = (role: UserRole, counter?: string) => {
    switch (role) {
      case 'admin':
        return (
          <span className="px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-extrabold uppercase flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-orange-600" /> Store Admin
          </span>
        );
      case 'cash_counter':
        return (
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold uppercase flex items-center gap-1">
            <Calculator className="w-3 h-3 text-emerald-600" /> Cash Counter {counter ? `#${counter}` : ''}
          </span>
        );
      case 'product_register':
        return (
          <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-extrabold uppercase flex items-center gap-1">
            <PackageCheck className="w-3 h-3 text-blue-600" /> Product Register
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-extrabold uppercase">
            {role}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-200 shadow-2xs">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-900">Real-Time Working Staff Tracker</h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live Tracker
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Monitor active roles, track exact login and logout timestamps, and audit staff shifts
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('working_now')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
              activeTab === 'working_now'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Working Now ({currentlyWorkingStaff.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('session_logs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
              activeTab === 'session_logs'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Login / Logout Audit ({sessions.length})
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Working Now</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-emerald-600 flex items-center gap-2">
            <span>{currentlyWorkingStaff.length}</span>
            <span className="text-xs font-bold text-emerald-700 px-2 py-0.5 bg-emerald-50 rounded-full border border-emerald-200 uppercase">
              Online
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Active staff members currently signed in
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Registered Staff</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-blue-600">
            {storeUsers.length} <span className="text-xs text-slate-500 font-normal">accounts</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Total staff authorized for {store.name}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today's Shifts</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-200">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-purple-600">
            {sessions.filter(s => new Date(s.loginTime).toDateString() === new Date().toDateString()).length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Sessions documented today
          </p>
        </div>
      </div>

      {/* TAB 1: WORKING NOW */}
      {activeTab === 'working_now' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-live-pulse" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Currently Active Staff ({currentlyWorkingStaff.length})
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Updates in real time
            </span>
          </div>

          {currentlyWorkingStaff.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <UserX className="w-8 h-8 mx-auto opacity-40 text-slate-400" />
              <p className="font-bold text-slate-600">No staff members currently working online</p>
              <p className="text-xs text-slate-400">
                When cashiers, product registrars, or store admins log into Mart Pro, their live active session appears here instantly.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
              {currentlyWorkingStaff.map((staff) => (
                <div 
                  key={staff.id} 
                  className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/50 transition-all shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      <span className="font-black text-slate-900 text-sm">{staff.userName}</span>
                    </div>
                    {getRoleBadge(staff.role, staff.counterNumber)}
                  </div>

                  <div className="space-y-1 text-xs text-slate-600 border-t border-emerald-100 pt-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Username:</span>
                      <span className="font-mono font-bold text-slate-800">@{staff.username}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Logged In At:</span>
                      <span className="font-mono font-medium text-slate-800">
                        {new Date(staff.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-emerald-100 font-bold text-emerald-800">
                      <span>Working Duration:</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-200/60 font-mono text-[11px]">
                        ⏳ {getDurationString(staff.loginTime)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AUDIT LOG (LOGIN & LOGOUT TIMESTAMPS) */}
      {activeTab === 'session_logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500"
              >
                <option value="all">All Roles</option>
                <option value="cash_counter">Cash Counter</option>
                <option value="product_register">Product Register</option>
                <option value="admin">Store Admin</option>
              </select>
            </div>

            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff name or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-orange-500 font-medium"
              />
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar border border-slate-100 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Role Assigned</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Login Time</th>
                  <th className="py-3 px-4">Logout Time</th>
                  <th className="py-3 px-4">Total Duration</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400 font-medium">
                      No staff session logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{session.userName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">@{session.username}</div>
                      </td>
                      <td className="py-3 px-4">
                        {getRoleBadge(session.role, session.counterNumber)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {new Date(session.loginTime).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">
                        <div className="flex items-center gap-1 text-emerald-700">
                          <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                          {new Date(session.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">
                        {session.logoutTime ? (
                          <div className="flex items-center gap-1 text-slate-600">
                            <LogOut className="w-3.5 h-3.5 text-rose-500" />
                            {new Date(session.logoutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                        ) : (
                          <span className="text-emerald-600 font-bold text-[11px]">Still Logged In</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {getDurationString(session.loginTime, session.logoutTime)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {session.status === 'online' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] uppercase">
                            Online
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] uppercase">
                            Shift Ended
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
