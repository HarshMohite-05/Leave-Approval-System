'use client';

import React, { useState } from 'react';
import { User, LeaveBalance, LeaveRequest, Holiday } from '@/lib/types';
import EmployeeDashboard from './EmployeeDashboard';
import { checkTechnicianOverlap } from '@/lib/date-utils';
import {
  FileSpreadsheet,
  Calendar,
  CheckCircle2,
  XCircle,
  Download,
  Plus,
  Users,
  Clock,
  Sparkles,
  ShieldAlert,
  Info,
  Check,
  X,
  ShieldCheck,
  AlertTriangle,
  Bell,
} from 'lucide-react';
import PushNotificationButton from './PushNotificationButton';

interface AdminDashboardProps {
  currentAdmin: User;
  balance: LeaveBalance | null;
  leaves: LeaveRequest[];
  allLeaves: LeaveRequest[];
  employees: Array<User & { balance?: LeaveBalance | null }>;
  holidays: Holiday[];
  onRefreshData: () => void;
  onOpenNotifications?: () => void;
}

export default function AdminDashboard({
  currentAdmin,
  balance,
  leaves,
  allLeaves,
  employees,
  holidays,
  onRefreshData,
  onOpenNotifications,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'LEAVE_APPROVALS' | 'COMPANY_CALENDAR' | 'HOLIDAYS_PAYROLL' | 'PERSONAL'>('LEAVE_APPROVALS');

  // Leave Action Modal (Approve / Reject)
  const [remarksModalOpen, setRemarksModalOpen] = useState(false);
  const [selectedLeaveForAction, setSelectedLeaveForAction] = useState<LeaveRequest | null>(null);
  const [pendingActionType, setPendingActionType] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [actionRemarks, setActionRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Add Holiday modal for Admin
  const [addHolidayOpen, setAddHolidayOpen] = useState(false);
  const [holidayForm, setHolidayForm] = useState({ name: '', date: '', is_optional: false });
  const [holidayLoading, setHolidayLoading] = useState(false);



  const pendingLeaves = allLeaves.filter((l) => l.status === 'PENDING');
  const approvedLeaves = allLeaves.filter((l) => l.status === 'APPROVED');
  const rejectedLeaves = allLeaves.filter((l) => l.status === 'REJECTED');

  const handleOpenActionModal = (leave: LeaveRequest, action: 'APPROVE' | 'REJECT') => {
    setSelectedLeaveForAction(leave);
    setPendingActionType(action);
    setActionRemarks(action === 'APPROVE' ? 'Approved by Admin Desk.' : 'Rejected by Admin Desk.');
    setRemarksModalOpen(true);
  };

  const handleExecuteAction = async () => {
    if (!selectedLeaveForAction || !pendingActionType) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/leaves/${selectedLeaveForAction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: pendingActionType,
          actor_id: currentAdmin.id,
          remarks: actionRemarks.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to process request');
      } else {
        setRemarksModalOpen(false);
        setSelectedLeaveForAction(null);
        setPendingActionType(null);
        onRefreshData();
      }
    } catch (err: any) {
      alert(err.message || 'Error executing action');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    setHolidayLoading(true);
    try {
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...holidayForm,
          caller_id: currentAdmin.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to add holiday');
      } else {
        setAddHolidayOpen(false);
        setHolidayForm({ name: '', date: '', is_optional: false });
        onRefreshData();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setHolidayLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner with Authorization & Mail Dispatch Status */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-xl border border-purple-900/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Admin Approval & Operations Desk
              </span>
              <span className="text-xs text-slate-300 font-medium">
                Direct Sync: <strong className="text-purple-300">Manav Shah & Neer Savla</strong>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Operations & Approvals — {currentAdmin.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Review and approve leave requests, manage public holidays, and export monthly payroll.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-center flex-wrap">
            <PushNotificationButton userId={currentAdmin.id} userName={currentAdmin.name} />

            {onOpenNotifications && (
              <button
                onClick={onOpenNotifications}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-200 border border-purple-500/30 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all"
              >
                <Bell className="w-4 h-4 text-sky-400" />
                Notification Hub
              </button>
            )}

            <a
              href="/api/reports/payroll"
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all"
            >
              <Download className="w-4 h-4" /> Export Payroll CSV
            </a>
          </div>
        </div>

        {/* Authorization & Status Badge */}
        <div className="mt-4 pt-3 border-t border-purple-800/40 flex items-center justify-between flex-wrap gap-2 text-xs text-purple-200">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>
              <strong>Leave Approval Authority Enabled:</strong> Admin has full authority to approve/reject leave requests. Every decision updates balances and alerts staff in real time.
            </span>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-semibold text-[11px] flex items-center gap-1">
            <Check className="w-3 h-3" /> System Active
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('LEAVE_APPROVALS')}
          className={`py-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'LEAVE_APPROVALS'
              ? 'border-purple-600 text-purple-700 bg-purple-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Leave Requests & Approvals
          {pendingLeaves.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white animate-pulse">
              {pendingLeaves.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('COMPANY_CALENDAR')}
          className={`py-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'COMPANY_CALENDAR'
              ? 'border-purple-600 text-purple-700 bg-purple-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Company Attendance Log
        </button>

        <button
          onClick={() => setActiveTab('HOLIDAYS_PAYROLL')}
          className={`py-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'HOLIDAYS_PAYROLL'
              ? 'border-purple-600 text-purple-700 bg-purple-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Holidays & Payroll Export
        </button>

        <button
          onClick={() => setActiveTab('PERSONAL')}
          className={`py-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'PERSONAL'
              ? 'border-purple-600 text-purple-700 bg-purple-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          My Personal Leave
        </button>
      </div>

      {/* TAB 1: LEAVE REQUESTS & APPROVALS */}
      {activeTab === 'LEAVE_APPROVALS' && (
        <div className="space-y-6">
          {/* Real-time Notification & Approval Alert Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50 via-indigo-50 to-purple-50 border border-sky-200 shadow-sm flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-sky-600 text-white shadow-sm flex-shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div className="text-xs text-slate-700 space-y-1">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  Real-Time Notification & Approval Engine
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Live Sync Enabled
                  </span>
                </h4>
                <p>
                  When anyone submits a leave request, or when Admin/Director decides, instantaneous notifications are synchronized to:
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px] text-slate-800">
                  <span className="px-2 py-0.5 rounded bg-white border border-slate-200">1. Applicant Employee</span>
                  <span className="px-2 py-0.5 rounded bg-white border border-slate-200">2. Manav Shah (Director)</span>
                  <span className="px-2 py-0.5 rounded bg-white border border-slate-200">3. Neer Savla (Director)</span>
                  <span className="px-2 py-0.5 rounded bg-purple-100 border border-purple-300 text-purple-900 font-bold">4. Payal Kadam (Admin)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Leave Requests Queue */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Pending Approvals Queue
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    {pendingLeaves.length} Awaiting Decision
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Admin authorization updates balances immediately and triggers synchronized real-time notifications.
                </p>
              </div>
            </div>

            {pendingLeaves.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-2 opacity-80" />
                <p className="font-bold text-slate-700 text-sm">All caught up!</p>
                <p className="mt-1">No pending leave applications requiring approval.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingLeaves.map((leave) => {
                  const overlap = checkTechnicianOverlap(
                    leave.employee_id,
                    leave.start_date,
                    leave.end_date,
                    allLeaves,
                    leave.id
                  );

                  return (
                    <div
                      key={leave.id}
                      className={`p-5 transition-colors ${
                        overlap.hasOverlap ? 'bg-rose-50/40' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">
                              {leave.employee_name}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-700">
                              {leave.employee_id}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-100 text-purple-800">
                              {leave.designation}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-100 text-sky-800">
                              {leave.leave_type} LEAVE
                            </span>
                            {leave.is_same_day ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                                SAME-DAY URGENT
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
                            <div className="flex items-center gap-1.5 font-mono">
                              <Calendar className="w-3.5 h-3.5 text-purple-600" />
                              <span>{leave.start_date} to {leave.end_date}</span>
                            </div>
                            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                              {leave.total_days} Day(s) Total
                            </span>
                            <span className="text-slate-400">
                              Applied on {new Date(leave.created_at).toLocaleDateString()}
                            </span>
                          </div>

                          <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 italic">
                            &ldquo;{leave.reason}&rdquo;
                          </p>

                          {overlap.hasOverlap && (
                            <div className="p-2.5 rounded-xl bg-rose-100 border border-rose-300 text-xs text-rose-900 flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                              <span className="font-bold">{overlap.message}</span>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons for Admin */}
                        <div className="flex items-center gap-2.5 self-start lg:self-center flex-shrink-0">
                          <button
                            onClick={() => handleOpenActionModal(leave, 'APPROVE')}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Approve Leave
                          </button>

                          <button
                            onClick={() => handleOpenActionModal(leave, 'REJECT')}
                            className="px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold text-xs flex items-center gap-1.5 transition-all"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject Request
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Decision & Approval Log */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-purple-600" />
                  Recent Approvals & Notifications Audit Log
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete audit log of authorizations by Directors and Admin with synchronized notifications.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Staff Member</th>
                    <th className="p-3">Type & Dates</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Authorized By</th>
                    <th className="p-3">Decision Remarks</th>
                    <th className="p-3">Notification Status</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allLeaves
                    .filter((l) => l.status === 'APPROVED' || l.status === 'REJECTED')
                    .slice(0, 15)
                    .map((l) => {
                      const isApproved = l.status === 'APPROVED';

                      return (
                        <tr key={l.id} className="hover:bg-slate-50">
                          <td className="p-3">
                            <p className="font-bold text-slate-900">{l.employee_name}</p>
                            <p className="text-[11px] text-slate-400 font-mono">{l.employee_id} • {l.designation}</p>
                          </td>
                          <td className="p-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                              {l.leave_type}
                            </span>
                            <p className="mt-1 font-mono text-[11px] text-slate-600">
                              {l.start_date} &rarr; {l.end_date}
                            </p>
                          </td>
                          <td className="p-3 font-bold text-slate-900">{l.total_days}d</td>
                          <td className="p-3">
                            <span className="font-semibold text-slate-800">
                              {l.action_by_name || 'Authorized'}
                            </span>
                            {l.action_at && (
                              <p className="text-[10px] text-slate-400">
                                {new Date(l.action_at).toLocaleDateString()}
                              </p>
                            )}
                          </td>
                          <td className="p-3 text-slate-600 max-w-xs truncate">
                            {l.action_remarks || '—'}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300 flex items-center gap-1 w-max">
                              <Bell className="w-2.5 h-2.5" /> Push & Sync Sent
                            </span>
                          </td>
                          <td className="p-3">
                            {isApproved ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                APPROVED
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                REJECTED
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COMPANY ATTENDANCE LOG */}
      {activeTab === 'COMPANY_CALENDAR' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900">Company-Wide Approved Leave Logs</h3>
              <p className="text-xs text-slate-500">
                Attendance and coverage overview for operations scheduling and salary sync.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Active Roster
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Staff Member</th>
                  <th className="p-3">Role / Dept</th>
                  <th className="p-3">Leave Type</th>
                  <th className="p-3">Dates</th>
                  <th className="p-3">Days</th>
                  <th className="p-3">Authorization</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allLeaves
                  .filter((l) => l.status === 'APPROVED')
                  .map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">
                        {l.employee_name} ({l.employee_id})
                      </td>
                      <td className="p-3 text-slate-500">{l.designation}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded font-semibold text-[11px] bg-sky-100 text-sky-800">
                          {l.leave_type}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-700">
                        {l.start_date} to {l.end_date}
                      </td>
                      <td className="p-3 font-bold text-slate-900">{l.total_days}d</td>
                      <td className="p-3 text-slate-600">
                        {l.action_by_name ? `Approved by ${l.action_by_name}` : 'Approved'}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          APPROVED
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: HOLIDAYS & PAYROLL EXPORT */}
      {activeTab === 'HOLIDAYS_PAYROLL' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payroll Export Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-100 text-purple-700">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Monthly Attendance CSV Export</h3>
                <p className="text-xs text-slate-500">
                  Export attendance, allocated/used leave breakdown, and LOP for salary calculations.
                </p>
              </div>
            </div>

            <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-200 text-xs text-purple-900 space-y-1.5">
              <p>• Used by Admin for monthly payroll dispatch.</p>
              <p>• Automatically includes all 6 Nirmaan WaterTech employees.</p>
              <p>• Calculates Loss of Pay (LOP) deductions automatically.</p>
            </div>

            <a
              href="/api/reports/payroll"
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <Download className="w-4 h-4" /> Download Monthly Payroll CSV
            </a>
          </div>

          {/* Holiday Manager */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900">Company Public Holidays</h3>
                <p className="text-xs text-slate-500">Maintained by Admin for automated smart day deduction.</p>
              </div>
              <button
                onClick={() => setAddHolidayOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Holiday
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {holidays.map((h) => (
                <div
                  key={h.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    <div>
                      <p className="font-bold text-slate-800">{h.name}</p>
                      <p className="text-[11px] text-slate-500">{h.date}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                    Paid Holiday
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PERSONAL LEAVE */}
      {activeTab === 'PERSONAL' && (
        <EmployeeDashboard
          currentUser={currentAdmin}
          balance={balance}
          leaves={leaves}
          allActiveLeaves={allLeaves.filter((l) => l.status === 'APPROVED' || l.status === 'PENDING')}
          holidays={holidays}
          onRefreshData={onRefreshData}
        />
      )}

      {/* Modal: Approve / Reject Decision with Email Dispatch Preview */}
      {remarksModalOpen && selectedLeaveForAction && pendingActionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 rounded-xl text-white ${
                    pendingActionType === 'APPROVE' ? 'bg-emerald-600' : 'bg-rose-600'
                  }`}
                >
                  {pendingActionType === 'APPROVE' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    {pendingActionType === 'APPROVE' ? 'Authorize Leave Request' : 'Reject Leave Request'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedLeaveForAction.employee_name} ({selectedLeaveForAction.employee_id})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRemarksModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-2xl text-xs text-purple-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-purple-700" />
                Real-Time Notification on Confirmation:
              </p>
              <p className="text-[11px] text-purple-800">
                • Applicant ({selectedLeaveForAction.employee_name})<br />
                • Directors (Manav Shah & Neer Savla)<br />
                • Admin Records
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Decision Remarks & Instructions for Staff
              </label>
              <textarea
                rows={3}
                value={actionRemarks}
                onChange={(e) => setActionRemarks(e.target.value)}
                placeholder="e.g. Approved by Admin. Please brief backup personnel before leaving."
                className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRemarksModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleExecuteAction}
                className={`px-5 py-2 rounded-xl text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 ${
                  pendingActionType === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                }`}
              >
                {actionLoading ? (
                  'Processing...'
                ) : pendingActionType === 'APPROVE' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Confirm Approval
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" /> Confirm Rejection
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Holiday */}
      {addHolidayOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-2xl">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" /> Add Public Holiday
            </h3>

            <form onSubmit={handleAddHoliday} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Holiday Name</label>
                <input
                  type="text"
                  required
                  value={holidayForm.name}
                  onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                  placeholder="e.g. Diwali (New Year)"
                  className="w-full mt-1 p-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Date</label>
                <input
                  type="date"
                  required
                  value={holidayForm.date}
                  onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                  className="w-full mt-1 p-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddHolidayOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={holidayLoading}
                  className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-bold"
                >
                  Save Holiday
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
}
