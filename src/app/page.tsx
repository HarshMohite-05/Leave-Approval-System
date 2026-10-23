'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import LoginForm from '@/components/LoginForm';
import DirectorDashboard from '@/components/DirectorDashboard';
import AdminDashboard from '@/components/AdminDashboard';
import EmployeeDashboard from '@/components/EmployeeDashboard';
import DirectorNotificationDrawer from '@/components/DirectorNotificationDrawer';
import DailyDigestModal from '@/components/DailyDigestModal';
import { User, LeaveBalance, LeaveRequest, Holiday } from '@/lib/types';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { syncPushSubscription } from '@/lib/push-client';

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentBalance, setCurrentBalance] = useState<LeaveBalance | null>(null);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Array<User & { balance?: LeaveBalance | null }>>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  // Modals
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [digestModalOpen, setDigestModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<{ isPersistent: boolean; mode: string } | null>(null);

  // Load all system data
  const refreshAllData = useCallback(async () => {
    try {
      // 1. Fetch leaves
      const leavesRes = await fetch('/api/leaves', { cache: 'no-store' });
      const leavesData = await leavesRes.json();
      if (leavesData.leaves) {
        setLeaves(leavesData.leaves);
      }
      if (leavesData.dbStatus) {
        setDbStatus(leavesData.dbStatus);
      }

      // 2. Fetch employees & balances
      const empRes = await fetch('/api/employees', { cache: 'no-store' });
      const empData = await empRes.json();
      if (empData.employees) {
        setEmployees(empData.employees);
      }

      // 3. Fetch holidays
      const holRes = await fetch('/api/holidays', { cache: 'no-store' });
      const holData = await holRes.json();
      if (holData.holidays) {
        setHolidays(holData.holidays);
      }

      // 4. Fetch notification count
      const notifRes = await fetch('/api/notifications', { cache: 'no-store' });
      const notifData = await notifRes.json();
      setUnreadNotificationsCount(notifData.unreadCount || 0);

      // 5. Refresh current user's balance
      if (currentUser) {
        const userRes = await fetch(`/api/auth/me?user_id=${currentUser.id}`, { cache: 'no-store' });
        const userData = await userRes.json();
        if (userData.balance) {
          setCurrentBalance(userData.balance);
        }
      }
    } catch (err) {
      console.error('Failed to load application data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Initial load: Check for existing session in localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('nirmaan_current_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
      } catch {
        localStorage.removeItem('nirmaan_current_user');
        setCurrentUser(null);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (currentUser) {
      refreshAllData();
    }
  }, [currentUser, refreshAllData]);

  // Re-link this device's push subscription to whoever is logged in
  useEffect(() => {
    if (currentUser) syncPushSubscription(currentUser.id);
  }, [currentUser]);

  // Live updates: poll every 15s and refresh when the tab regains focus
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(refreshAllData, 15000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshAllData();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [currentUser, refreshAllData]);

  const handleLogout = () => {
    localStorage.removeItem('nirmaan_current_user');
    setCurrentUser(null);
    setCurrentBalance(null);
  };

  if (loading && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-white">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-400 mb-3" />
        <p className="text-sm font-semibold tracking-wide">Initializing Nirmaan WaterTech Portal...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginForm
        onLoginSuccess={(user, balance) => {
          setCurrentUser(user);
          setCurrentBalance(balance);
          localStorage.setItem('nirmaan_current_user', JSON.stringify(user));
        }}
      />
    );
  }

  // Filter leaves for individual employees (Mahesh, Ritesh, Shubham)
  const myLeaves = leaves.filter((l) => l.user_id === currentUser.id || l.employee_id === currentUser.employee_id);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        onOpenNotifications={() => setDrawerOpen(true)}
        onOpenDailyDigest={() => setDigestModalOpen(true)}
        unreadCount={unreadNotificationsCount}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {dbStatus && !dbStatus.isPersistent && (currentUser.role === 'DIRECTOR' || currentUser.role === 'ADMIN') && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-3 shadow-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <p className="font-extrabold text-amber-900 flex items-center gap-1.5">
                Database Notice: Running on Ephemeral Serverless Storage (/tmp)
              </p>
              <p className="mt-1 text-amber-800 leading-relaxed">
                The application is deployed on Vercel without <code className="px-1.5 py-0.5 bg-amber-100 rounded text-amber-950 font-mono font-bold">TURSO_DATABASE_URL</code>.
                In serverless environments, files in <code className="px-1.5 py-0.5 bg-amber-100 rounded text-amber-950 font-mono font-bold">/tmp</code> are erased during cold starts after a few minutes of inactivity.
                To preserve leave requests and user balances permanently, connect a free Turso cloud database and set <code className="px-1.5 py-0.5 bg-amber-100 rounded text-amber-950 font-mono font-bold">TURSO_DATABASE_URL</code> and <code className="px-1.5 py-0.5 bg-amber-100 rounded text-amber-950 font-mono font-bold">TURSO_AUTH_TOKEN</code> in your Vercel Project Settings.
              </p>
            </div>
          </div>
        )}
        {loading ? (
          <div className="py-24 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-sky-600 mb-3" />
            <p className="text-sm font-semibold">Loading Nirmaan WaterTech Leave Hub...</p>
          </div>
        ) : currentUser.role === 'DIRECTOR' ? (
          /* DIRECTORS (Manav Shah D001 & Neer Savla D002) */
          <DirectorDashboard
            currentDirector={currentUser}
            leaves={leaves}
            employees={employees}
            holidays={holidays}
            onRefreshData={refreshAllData}
            onOpenDigest={() => setDigestModalOpen(true)}
          />
        ) : currentUser.role === 'ADMIN' ? (
          /* ADMIN (Payal Kadam EMP003) */
          <AdminDashboard
            currentAdmin={currentUser}
            balance={currentBalance}
            leaves={myLeaves}
            allLeaves={leaves}
            employees={employees}
            holidays={holidays}
            onRefreshData={refreshAllData}
            onOpenNotifications={() => setDrawerOpen(true)}
          />
        ) : (
          /* FIELD EMPLOYEES & SALES (Mahesh EMP001, Ritesh EMP002, Shubham EMP004) */
          <EmployeeDashboard
            currentUser={currentUser}
            balance={currentBalance}
            leaves={myLeaves}
            allActiveLeaves={leaves.filter((l) => l.status === 'APPROVED' || l.status === 'PENDING')}
            holidays={holidays}
            onRefreshData={refreshAllData}
          />
        )}
      </main>

      {/* Live Director & Admin Notification Engine Drawer */}
      <DirectorNotificationDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        targetUserId={currentUser.role === 'DIRECTOR' || currentUser.role === 'ADMIN' ? undefined : currentUser.employee_id}
        onReviewLeave={(leaveId) => {
          // If leaveId clicked in drawer, focus inbox
          setDrawerOpen(false);
          refreshAllData();
        }}
      />

      {/* 9:00 AM Director Daily Digest Modal */}
      <DailyDigestModal
        isOpen={digestModalOpen}
        onClose={() => setDigestModalOpen(false)}
        onActionClick={(leaveId) => {
          setDigestModalOpen(false);
          refreshAllData();
        }}
      />

      {/* Modern WaterTech Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-6 text-xs text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            &copy; {new Date().getFullYear()} <strong>Nirmaan WaterTech Private Limited</strong>. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Mumbai & Ahmedabad Facilities</span>
            <span>•</span>
            <span>Flat Startup Architecture</span>
            <span>•</span>
            <span className="text-sky-400">Production Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
