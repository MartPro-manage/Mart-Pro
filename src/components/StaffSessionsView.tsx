import React, { useState, useEffect } from 'react';
import { Store, UserAccount, StaffSession } from '../types';
import { db, collection, query, where, onSnapshot } from '../lib/firebase';
import { UniversalBackButton } from './UniversalBackButton';
import { 
  Users, 
  Activity, 
  Clock, 
  Wifi, 
  WifiOff, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Search, 
  Download,
  Calculator,
  DollarSign
} from 'lucide-react';
import { motion } from 'motion/react';

interface StaffSessionsViewProps {
  store: Store;
  currentUser: UserAccount;
  onBack: () => void;
}

export const StaffSessionsView: React.FC<StaffSessionsViewProps> = ({
  store,
  currentUser,
  onBack
}) => {
  const [sessions, setSessions] = useState<StaffSession[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'offline'>('all');

  // Real-time listener for staff sessions in this store
  useEffect(() => {
    if (!store?.id) return;
    const qSessions = query(
      collection(db, 'staff_sessions'),
      where('storeId', '==', store.id)
    );

    const unsub = onSnapshot(qSessions, (snapshot) => {
      const list: StaffSession[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as StaffSession);
      });
      list.sort((a, b) => new Date(b.loginTime).getTime() - new Date(a.loginTime).getTime());
      setSessions(list);
    });

    return () => unsub();
  }, [store?.id]);

  // Filtered sessions
  const filteredSessions = sessions.filter(s => {
    const isOnline = s.status === 'active' && !s.logoutTime;
    if (statusFilter === 'active' && !isOnline) return false;
    if (statusFilter === 'offline' && isOnline) return false;

    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.staffName?.toLowerCase().includes(term) ||
      s.staffUsername?.toLowerCase().includes(term) ||
      s.counterName?.toLowerCase().includes(term)
    );
  });

  const onlineCount = sessions.filter(s => s.status === 'active' && !s.logoutTime).length;
  const offlineCount = sessions.length - onlineCount;

  // Export sessions as CSV
  const handleExportCsv = () => {
    const headers = ['Staff Name', 'Username', 'Role', 'Counter', 'Status', 'Login Time', 'Logout Time', 'Total Sales Count', 'Total Sales Value (Rs.)'];
    const rows = sessions.map(s => {
      const isOnline = s.status === 'active' && !s.logoutTime;
      return [
        `"${s.staffName}"`,
        `"${s.staffUsername}"`,
        `"${s.role}"`,
        `"${s.counterName || ''}"`,
        `"${isOnline ? 'ONLINE' : 'OFFLINE'}"`,
        `"${new Date(s.loginTime).toLocaleString()}"`,
        s.logoutTime ? `"${new Date(s.logoutTime).toLocaleString()}"` : '""',
        s.totalSalesCount || 0,
        s.totalSalesAmount || 0
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Staff_Sessions_${store.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex flex-col">
      {/* Top Action Header */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <UniversalBackButton onBack={onBack} label="Back to Dashboard" />
            
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base font-black text-slate-900 leading-tight">Staff & Live Sessions</h1>
                <p className="text-[11px] text-slate-500">Real-time cashier activity and terminal monitoring</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick status pill summary */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
              <span className="flex items-center gap-1 text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {onlineCount} Online
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">{offlineCount} Offline</span>
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
              title="Export staff sessions to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export Log</span>
            </button>
          </div>

        </div>
      </div>

      {/* Main Content Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-4">
        
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by staff name, username, or counter..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({sessions.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Live Online ({onlineCount})</span>
            </button>
            <button
              onClick={() => setStatusFilter('offline')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === 'offline'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Offline ({offlineCount})
            </button>
          </div>
        </div>

        {/* Sessions Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          {filteredSessions.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Users className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-700 text-base">No Sessions Found</p>
              <p className="text-xs text-slate-400 mt-1">
                Cashiers will appear here automatically when they log into their counters.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3 w-36">Live Status</th>
                  <th className="p-3">Staff Member</th>
                  <th className="p-3">Counter / Role</th>
                  <th className="p-3">Login Time</th>
                  <th className="p-3">Logout Time</th>
                  <th className="p-3 text-right">Bills Generated</th>
                  <th className="p-3 text-right">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSessions.map((session) => {
                  const isOnline = session.status === 'active' && !session.logoutTime;
                  const loginFormatted = new Date(session.loginTime).toLocaleString([], {
                    dateStyle: 'short',
                    timeStyle: 'short'
                  });
                  const logoutFormatted = session.logoutTime 
                    ? new Date(session.logoutTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                    : null;

                  return (
                    <tr
                      key={session.id}
                      className={`transition-colors ${
                        isOnline ? 'bg-emerald-50/40 hover:bg-emerald-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Live Online / Offline Status Indicator */}
                      <td className="p-3">
                        {isOnline ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[11px] shadow-2xs">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-live-pulse" />
                            <span>LIVE ONLINE</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-bold text-[11px]">
                            <span className="w-2 h-2 rounded-full bg-slate-400" />
                            <span>OFFLINE</span>
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-slate-900">{session.staffName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">@{session.staffUsername}</div>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <Calculator className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold text-slate-800">
                            {session.counterName || 'Counter #1'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 capitalize">{session.role.replace('_', ' ')}</div>
                      </td>

                      <td className="p-3 font-mono text-slate-600">
                        {loginFormatted}
                      </td>

                      <td className="p-3 font-mono text-slate-600">
                        {logoutFormatted ? (
                          logoutFormatted
                        ) : (
                          <span className="text-emerald-600 font-bold">Active Session Now</span>
                        )}
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-slate-800">
                        {session.totalSalesCount || 0}
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-emerald-700 text-sm">
                        Rs. {Number(session.totalSalesAmount || 0).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
};
