'use client';

import React, { useState } from 'react';
import { User, LeaveRequest, Holiday, LeaveBalance } from '@/lib/types';
import {
  Users,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  UserPlus,
  Trash2,
  Edit3,
  Award,
  Download,
  CalendarDays,
  Plus,
  Search,
  Filter,
  Sparkles,
  Phone,
  Mail,
  RefreshCw,
  Eye,
  KeyRound,
  FileSpreadsheet,
  Smartphone,
} from 'lucide-react';
import PushNotificationButton from './PushNotificationButton';

interface DirectorDashboardProps {
  currentDirector: User;
  leaves: LeaveRequest[];
  employees: Array<User & { balance?: LeaveBalance | null }>;
  holidays: Holiday[];
  onRefreshData: () => void;
  onOpenDigest: () => void;
}

export default function DirectorDashboard({
  currentDirector,
  leaves,
  employees,
  holidays,
  onRefreshData,
  onOpenDigest,
}: DirectorDashboardProps) {
  // Tabs
  const [activeTab, setActiveTab] = useState<'INBOX' | 'ATTENDANCE' | 'ROSTER' | 'PAYROLL_HOLIDAYS'>('INBOX');

  // Modals state
  const [remarksModalOpen, setRemarksModalOpen] = useState(false);
  const [selectedLeaveForAction, setSelectedLeaveForAction] = useState<LeaveRequest | null>(null);
  const [pendingActionType, setPendingActionType] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [actionRemarks, setActionRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Add Employee Modal
  const [addEmpModalOpen, setAddEmpModalOpen] = useState(false);
  const [newEmpForm, setNewEmpForm] = useState({
    employee_id: '',
    name: '',
    role: 'EMPLOYEE',
    designation: 'Technician',
    contact: '',
    email: '',
    password: '',
  });
  const [addEmpLoading, setAddEmpLoading] = useState(false);
  const [addEmpError, setAddEmpError] = useState('');

  // Comp-off Modal
  const [compOffModalOpen, setCompOffModalOpen] = useState(false);
  const [selectedEmpForCompOff, setSelectedEmpForCompOff] = useState<User | null>(null);
  const [compOffReason, setCompOffReason] = useState('');
  const [compOffLoading, setCompOffLoading] = useState(false);

  // Delete Employee Confirmation Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [empToDelete, setEmpToDelete] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Add Holiday Modal
  const [addHolidayOpen, setAddHolidayOpen] = useState(false);
  const [holidayForm, setHolidayForm] = useState({ name: '', date: '', is_optional: false });
  const [holidayLoading, setHolidayLoading] = useState(false);

  // Filters
  const [inboxFilter, setInboxFilter] = useState<'ALL' | 'PENDING' | 'OVERLAP' | 'HISTORY'>('ALL');
  const [rosterSearch, setRosterSearch] = useState('');

  // 1. KPI Calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const activeStaff = employees.filter((e) => e.status === 'ACTIVE' && e.role !== 'DIRECTOR');

  // Staff on approved leave today
  const onLeaveToday = leaves.filter(
    (l) => l.status === 'APPROVED' && l.start_date <= todayStr && l.end_date >= todayStr
  );
  const onLeaveEmpIds = new Set(onLeaveToday.map((l) => l.employee_id));

  // Field Technicians
  const technicians = activeStaff.filter((e) => e.designation.toLowerCase().includes('technician'));
  const availableTechs = technicians.filter((t) => !onLeaveEmpIds.has(t.employee_id));

  // Pending Approvals
  const pendingLeaves = leaves.filter((l) => l.status === 'PENDING');
  const overlappingPendingLeaves = pendingLeaves.filter((l) => l.technician_overlap_flag);

  // Handle Approve / Reject
  const triggerLeaveAction = (leave: LeaveRequest, type: 'APPROVE' | 'REJECT') => {
    setSelectedLeaveForAction(leave);
    setPendingActionType(type);
    setActionRemarks('');
    setRemarksModalOpen(true);
  };

  const confirmLeaveAction = async () => {
    if (!selectedLeaveForAction || !pendingActionType) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/leaves/${selectedLeaveForAction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: pendingActionType,
          actor_id: currentDirector.id,
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

  // Handle Add Employee
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddEmpLoading(true);
    setAddEmpError('');

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newEmpForm,
          caller_id: currentDirector.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAddEmpError(data.error || 'Failed to add employee');
      } else {
        setAddEmpModalOpen(false);
        setNewEmpForm({
          employee_id: '',
          name: '',
          role: 'EMPLOYEE',
          designation: 'Technician',
          contact: '',
          email: '',
          password: '',
        });
        onRefreshData();
      }
    } catch (err: any) {
      setAddEmpError(err.message || 'Error saving employee');
    } finally {
      setAddEmpLoading(false);
    }
  };

  // Handle Grant Comp-Off
  const handleGrantCompOff = async () => {
    if (!selectedEmpForCompOff) return;
    setCompOffLoading(true);

    try {
      const res = await fetch(`/api/employees/${selectedEmpForCompOff.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller_id: currentDirector.id,
          action: 'GRANT_COMP_OFF',
          comp_off_reason: compOffReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to grant comp-off');
      } else {
        setCompOffModalOpen(false);
        setSelectedEmpForCompOff(null);
        setCompOffReason('');
        onRefreshData();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCompOffLoading(false);
    }
  };

  // Handle Delete Employee
  const handleDeleteEmployee = async () => {
    if (!empToDelete) return;
    setDeleteLoading(true);

    try {
      const res = await fetch(`/api/employees/${empToDelete.id}?caller_id=${currentDirector.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to remove employee');
      } else {
        setDeleteModalOpen(false);
        setEmpToDelete(null);
        onRefreshData();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handle Add Holiday
  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    setHolidayLoading(true);

    try {
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...holidayForm,
          caller_id: currentDirector.id,
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

  // Filtered inbox leaves
  const displayedLeaves = leaves.filter((l) => {
    if (inboxFilter === 'PENDING') return l.status === 'PENDING';
    if (inboxFilter === 'OVERLAP') return Boolean(l.technician_overlap_flag);
    if (inboxFilter === 'HISTORY') return l.status !== 'PENDING';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Welcome & Director Context Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 rounded-2xl p-6 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Executive Authority
            </span>
            <span className="text-xs text-slate-400">
              Co-Director: {currentDirector.employee_id === 'D001' ? 'Neer Savla (D002)' : 'Manav Shah (D001)'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Director Dashboard — {currentDirector.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Complete flat hierarchy control. All employees report directly to you and your co-director.
            Approve leaves, manage active roster, and monitor field coverage in real time.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center">
          <button
            onClick={onOpenDigest}
            className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-glow"
          >
            <Clock className="w-4 h-4 text-amber-300" />
            9 AM Briefing
          </button>
          <a
            href="/api/reports/payroll"
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-sky-400" />
            Payroll CSV
          </a>
        </div>

        {/* Real-time Web Push Alert Strip */}
        <div className="w-full mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-sky-400 flex-shrink-0" />
            <span>
              <strong>Real-Time Mobile & Browser Push:</strong> Instant lock screen alerts whenever an employee applies for leave (no email login needed).
            </span>
          </div>
          <PushNotificationButton userId={currentDirector.id} userName={currentDirector.name} />
        </div>
      </div>

      {/* MODULE 1: EXECUTIVE KPI & LIVE ATTENDANCE OVERVIEW */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Staff Working Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Staff Working Today</span>
            <span className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {activeStaff.length - onLeaveToday.length}/{activeStaff.length}
            </span>
            <span className="text-xs text-slate-500 font-medium">staff on duty</span>
          </div>
          <div className="mt-2.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-sky-600 h-1.5 rounded-full"
              style={{
                width: `${activeStaff.length ? Math.round(((activeStaff.length - onLeaveToday.length) / activeStaff.length) * 100) : 100}%`,
              }}
            ></div>
          </div>
        </div>

        {/* KPI 2: On Leave Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">On Leave Today</span>
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{onLeaveToday.length}</span>
            <span className="text-xs text-purple-600 font-semibold">
              {onLeaveToday.length > 0 ? 'Approved Absence' : 'Full Attendance'}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500 truncate">
            {onLeaveToday.length > 0
              ? onLeaveToday.map((l) => l.employee_name).join(', ')
              : 'Zero unscheduled absences today'}
          </p>
        </div>

        {/* KPI 3: Pending Approvals */}
        <div className={`p-5 rounded-2xl border shadow-sm transition-shadow ${
          pendingLeaves.length > 0 ? 'bg-amber-50/70 border-amber-200' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Approvals</span>
            <span className={`p-2 rounded-xl ${pendingLeaves.length > 0 ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-slate-100 text-slate-500'}`}>
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{pendingLeaves.length}</span>
            <span className="text-xs text-amber-700 font-bold">
              {pendingLeaves.length > 0 ? 'Awaiting Action' : 'All Clear'}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-600">
            {overlappingPendingLeaves.length > 0 ? (
              <span className="text-rose-600 font-bold">
                ⚠️ {overlappingPendingLeaves.length} Critical Technician Alert!
              </span>
            ) : (
              'All employees report directly here'
            )}
          </p>
        </div>

        {/* KPI 4: Field Technician Availability */}
        <div className={`p-5 rounded-2xl border shadow-sm transition-shadow ${
          availableTechs.length === 0
            ? 'bg-rose-50 border-rose-300 text-rose-950'
            : availableTechs.length === 1
            ? 'bg-amber-50 border-amber-300 text-amber-950'
            : 'bg-emerald-50 border-emerald-300 text-emerald-950'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Technician Field Coverage
            </span>
            <span className={`p-2 rounded-xl ${
              availableTechs.length === 0 ? 'bg-rose-200 text-rose-800' : 'bg-emerald-200 text-emerald-800'
            }`}>
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold">
              {availableTechs.length}/{technicians.length}
            </span>
            <span className="text-xs font-bold">
              {availableTechs.length === 0
                ? '🚨 0% Coverage (Critical)'
                : availableTechs.length === 1
                ? '⚠️ 50% Coverage'
                : '100% Available'}
            </span>
          </div>
          <p className="mt-2 text-[11px] font-medium text-slate-600">
            Mahesh (EMP001) & Ritesh (EMP002)
          </p>
        </div>
      </section>

      {/* Main Navigation Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('INBOX')}
          className={`py-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'INBOX'
              ? 'border-sky-600 text-sky-700 bg-sky-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Direct Approval Inbox
          {pendingLeaves.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
              {pendingLeaves.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('ATTENDANCE')}
          className={`py-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'ATTENDANCE'
              ? 'border-sky-600 text-sky-700 bg-sky-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Live Attendance & 7-Day Strip
        </button>

        <button
          onClick={() => setActiveTab('ROSTER')}
          className={`py-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'ROSTER'
              ? 'border-sky-600 text-sky-700 bg-sky-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Employee Directory (Add / Delete)
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-100 text-sky-800 font-extrabold">
            Director Only
          </span>
        </button>

        <button
          onClick={() => setActiveTab('PAYROLL_HOLIDAYS')}
          className={`py-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'PAYROLL_HOLIDAYS'
              ? 'border-sky-600 text-sky-700 bg-sky-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Company Holidays & Payroll
        </button>
      </div>

      {/* TAB 1: DIRECT APPROVAL INBOX */}
      {activeTab === 'INBOX' && (
        <div className="space-y-4">
          {/* Sub-filter bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              {(['ALL', 'PENDING', 'OVERLAP', 'HISTORY'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setInboxFilter(mode)}
                  className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors ${
                    inboxFilter === mode
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {mode === 'ALL'
                    ? 'All Requests'
                    : mode === 'PENDING'
                    ? `Pending (${pendingLeaves.length})`
                    : mode === 'OVERLAP'
                    ? '🚨 Overlap Alerts'
                    : 'Decision History'}
                </button>
              ))}
            </div>

            <button
              onClick={onRefreshData}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs flex items-center gap-1 self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {displayedLeaves.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="font-bold text-base text-slate-800">Inbox Zero</h3>
              <p className="text-xs text-slate-500 mt-1">No leave requests found for the selected view.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedLeaves.map((leave) => {
                const isPending = leave.status === 'PENDING';
                const isApproved = leave.status === 'APPROVED';
                const isRejected = leave.status === 'REJECTED';
                const isSameDay = Boolean(leave.is_same_day);
                const hasOverlap = Boolean(leave.technician_overlap_flag);

                return (
                  <div
                    key={leave.id}
                    className={`bg-white rounded-2xl border transition-all overflow-hidden shadow-sm hover:shadow-md ${
                      hasOverlap && isPending
                        ? 'border-rose-400 ring-2 ring-rose-200'
                        : isPending
                        ? 'border-sky-300 ring-1 ring-sky-100'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* CRITICAL OVERLAP ALERT BANNER (Direct Requirement) */}
                    {hasOverlap && (
                      <div className="bg-gradient-to-r from-rose-600 to-red-700 text-white px-5 py-2.5 flex items-center gap-2 text-xs font-bold animate-pulse">
                        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                        <span>
                          {leave.technician_overlap_details ||
                            '⚠️ CRITICAL SERVICE ALERT: Both Technicians will be out on these dates (0% Field Coverage)!'}
                        </span>
                      </div>
                    )}

                    {/* Same-day emergency banner */}
                    {isSameDay && (
                      <div className="bg-amber-500 text-white px-5 py-1.5 flex items-center gap-2 text-[11px] font-bold">
                        <Clock className="w-3.5 h-3.5" />
                        <span>🚨 SAME-DAY URGENT: Leave applied starting today! Immediate Director review required.</span>
                      </div>
                    )}

                    <div className="p-5 sm:p-6">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        {/* Employee & Leave Info */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-bold text-lg text-slate-900">{leave.employee_name}</span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {leave.employee_id} • {leave.designation}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              leave.leave_type === 'CASUAL'
                                ? 'bg-sky-100 text-sky-800'
                                : leave.leave_type === 'SICK'
                                ? 'bg-purple-100 text-purple-800'
                                : leave.leave_type === 'COMP_OFF'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}>
                              {leave.leave_type} LEAVE
                            </span>
                            {leave.is_half_day ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                                0.5 Day ({leave.half_day_period})
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
                            <span className="flex items-center gap-1 font-semibold text-slate-800">
                              <Calendar className="w-3.5 h-3.5 text-sky-600" />
                              {leave.start_date} {leave.start_date !== leave.end_date ? `to ${leave.end_date}` : ''}
                            </span>
                            <span className="font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                              Total Working Days: {leave.total_days} {leave.total_days === 1 ? 'day' : 'days'}
                            </span>
                            <span className="text-slate-400">
                              Applied: {new Date(leave.created_at).toLocaleDateString()}
                            </span>
                          </div>

                          {/* Reason */}
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700">
                            <strong className="text-slate-900">Reason:</strong> &ldquo;{leave.reason}&rdquo;
                          </div>

                          {/* Attribution for decision */}
                          {!isPending && (
                            <div className="text-xs pt-1 flex items-center gap-2 flex-wrap">
                              <span className={`font-bold px-2 py-0.5 rounded ${
                                isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {leave.status}
                              </span>
                              {leave.action_by_name && (
                                <span className="text-slate-600 font-medium">
                                  by <strong>{leave.action_by_name}</strong> on{' '}
                                  {leave.action_at ? new Date(leave.action_at).toLocaleString() : ''}
                                </span>
                              )}
                              {leave.action_remarks && (
                                <span className="text-slate-500 italic">
                                  — &ldquo;{leave.action_remarks}&rdquo;
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 1-Click Director Action Buttons */}
                        {isPending && (
                          <div className="flex items-center gap-2 self-start md:self-center flex-shrink-0 pt-2 md:pt-0">
                            <button
                              onClick={() => triggerLeaveAction(leave, 'APPROVE')}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Approve
                            </button>
                            <button
                              onClick={() => triggerLeaveAction(leave, 'REJECT')}
                              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                            >
                              <XCircle className="w-4 h-4" />
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LIVE ATTENDANCE & 7-DAY STRIP */}
      {activeTab === 'ATTENDANCE' && (
        <div className="space-y-6">
          {/* Visual "Who's In / Who's Out" */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Working Today */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Working Today ({activeStaff.length - onLeaveToday.length} Staff)
              </h3>
              <div className="space-y-2">
                {activeStaff
                  .filter((s) => !onLeaveEmpIds.has(s.employee_id))
                  .map((emp) => (
                    <div
                      key={emp.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${emp.avatar_color || 'bg-slate-700'} text-white font-bold flex items-center justify-center text-xs`}>
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{emp.name}</p>
                          <p className="text-slate-500">{emp.designation} • {emp.employee_id}</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        ON DUTY
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* On Leave Today */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-600" />
                On Leave Today ({onLeaveToday.length} Staff)
              </h3>
              {onLeaveToday.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  🎉 Full team attendance today! No approved leaves.
                </div>
              ) : (
                <div className="space-y-2">
                  {onLeaveToday.map((leave) => (
                    <div
                      key={leave.id}
                      className="p-3 rounded-xl bg-purple-50/50 border border-purple-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{leave.employee_name}</p>
                        <p className="text-slate-500">{leave.designation} • {leave.employee_id}</p>
                        <p className="text-[11px] text-purple-700 mt-1 italic">&ldquo;{leave.reason}&rdquo;</p>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 rounded bg-purple-200 text-purple-900 font-bold text-[10px]">
                          {leave.leave_type}
                        </span>
                        <p className="text-[10px] text-slate-500 mt-1">Until {leave.end_date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Upcoming 7-day calendar strip */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-sm text-slate-800 mb-4 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-sky-600" />
              Upcoming 7-Day Staff Availability Strip
            </h3>

            <div className="grid grid-cols-7 gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
                const dayDate = new Date();
                dayDate.setDate(dayDate.getDate() + offset);
                const dayStr = dayDate.toISOString().split('T')[0];
                const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
                const isSun = dayDate.getDay() === 0;

                const dayLeaves = leaves.filter(
                  (l) => l.status === 'APPROVED' && l.start_date <= dayStr && l.end_date >= dayStr
                );

                return (
                  <div
                    key={offset}
                    className={`p-3 rounded-xl border text-center text-xs ${
                      offset === 0
                        ? 'bg-sky-50 border-sky-300 ring-2 ring-sky-200'
                        : isSun
                        ? 'bg-slate-100/70 border-slate-200 text-slate-400'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="font-bold text-slate-700">{dayName}</div>
                    <div className="text-xs text-slate-500 mb-2">{dayDate.getDate()}</div>

                    {isSun ? (
                      <span className="text-[10px] font-semibold text-slate-400">Sunday</span>
                    ) : dayLeaves.length > 0 ? (
                      <div className="space-y-1">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10px]">
                          {dayLeaves.length} Out
                        </span>
                        {dayLeaves.map((l, i) => (
                          <div key={i} className="text-[10px] truncate text-slate-700 font-medium">
                            {l.employee_name.split(' ')[0]}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        Full
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: EMPLOYEE DIRECTORY (DIRECTOR EXCLUSIVE ADD / DELETE) */}
      {activeTab === 'ROSTER' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Search employee by name, ID or role..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setAddEmpModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              >
                <UserPlus className="w-4 h-4 text-sky-400" />
                + Add New Employee
              </button>
            </div>
          </div>

          {/* Employee Table / Cards */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Employee</th>
                    <th className="p-4">Role & Designation</th>
                    <th className="p-4">Reports To</th>
                    <th className="p-4">Contact & Email</th>
                    <th className="p-4">Leave Balances (CL / SL / PL / Comp-Off)</th>
                    <th className="p-4 text-right">Director Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees
                    .filter((e) =>
                      e.name.toLowerCase().includes(rosterSearch.toLowerCase()) ||
                      e.employee_id.toLowerCase().includes(rosterSearch.toLowerCase()) ||
                      e.designation.toLowerCase().includes(rosterSearch.toLowerCase())
                    )
                    .map((emp) => {
                      const b = emp.balance;
                      const isDirector = emp.role === 'DIRECTOR';

                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Employee */}
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg ${emp.avatar_color || 'bg-slate-800'} text-white font-bold flex items-center justify-center text-xs shadow-sm`}>
                                {emp.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                                  {emp.name}
                                  {emp.status === 'INACTIVE' && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-bold">
                                      INACTIVE
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-slate-400 font-mono">{emp.employee_id}</p>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              isDirector
                                ? 'bg-sky-100 text-sky-800 border border-sky-300'
                                : emp.role === 'ADMIN'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {emp.designation}
                            </span>
                            <p className="text-[11px] text-slate-400 mt-0.5">{emp.department}</p>
                          </td>

                          {/* Reports To */}
                          <td className="p-4 text-slate-600 font-medium">
                            {emp.reports_to === 'None' ? (
                              <span className="text-slate-400 italic">None (Director)</span>
                            ) : (
                              <span className="text-sky-700 font-semibold">Manav & Neer (Directors)</span>
                            )}
                          </td>

                          {/* Contact */}
                          <td className="p-4 text-slate-600">
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{emp.contact}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span>{emp.email}</span>
                            </div>
                          </td>

                          {/* Balances */}
                          <td className="p-4">
                            {b ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 font-medium text-[11px] border border-sky-200" title="Casual Leave: Available / Total">
                                  CL: {b.cl_allocated - b.cl_used - b.cl_pending}/{b.cl_allocated}
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 font-medium text-[11px] border border-purple-200" title="Sick Leave">
                                  SL: {b.sl_allocated - b.sl_used - b.sl_pending}/{b.sl_allocated}
                                </span>
                                {b.co_allocated > 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 font-bold text-[11px] border border-indigo-200" title="Comp-Off">
                                    CO: {b.co_allocated - b.co_used - b.co_pending}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Director Actions */}
                          <td className="p-4 text-right">
                            {!isDirector && emp.status === 'ACTIVE' && (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setSelectedEmpForCompOff(emp);
                                    setCompOffModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] border border-indigo-200 flex items-center gap-1"
                                  title="Credit +1 Day Comp-Off"
                                >
                                  <Award className="w-3 h-3" /> +1 Comp-Off
                                </button>
                                <button
                                  onClick={() => {
                                    setEmpToDelete(emp);
                                    setDeleteModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  title="Delete / Revoke Access"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
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

      {/* TAB 4: COMPANY HOLIDAYS & PAYROLL EXPORT */}
      {activeTab === 'PAYROLL_HOLIDAYS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payroll Export Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-sky-100 text-sky-700">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Monthly Attendance & Leave Payroll CSV</h3>
                <p className="text-xs text-slate-500">
                  Export complete month-wise attendance, used leaves, and LOP deductions for salary processing.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
              <p>✅ Generates standard HR & Payroll compliant CSV file.</p>
              <p>✅ Includes all 6 Nirmaan WaterTech personnel with reporting structure.</p>
              <p>✅ Automatically breaks down Casual, Sick, and Loss of Pay (LOP) days.</p>
            </div>

            <a
              href="/api/reports/payroll"
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-glow transition-all"
            >
              <Download className="w-4 h-4" /> Download Current Month Payroll CSV
            </a>
          </div>

          {/* Public Holidays Manager */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900">Company Public Holidays</h3>
                <p className="text-xs text-slate-500">Holidays are automatically excluded from leave deductions.</p>
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
                    <Calendar className="w-4 h-4 text-sky-600" />
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

      {/* MODAL 1: APPROVAL / REJECTION REMARKS */}
      {remarksModalOpen && selectedLeaveForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              {pendingActionType === 'APPROVE' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600" />
              )}
              {pendingActionType === 'APPROVE' ? 'Approve' : 'Reject'} Leave Request
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Decision will be recorded as <strong>&ldquo;{pendingActionType === 'APPROVE' ? 'Approved' : 'Rejected'} by {currentDirector.name}&rdquo;</strong> and notified instantly to the employee and your co-director.
            </p>

            <div className="my-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <p><strong>Employee:</strong> {selectedLeaveForAction.employee_name} ({selectedLeaveForAction.designation})</p>
              <p><strong>Duration:</strong> {selectedLeaveForAction.start_date} to {selectedLeaveForAction.end_date} ({selectedLeaveForAction.total_days} days)</p>
              <p><strong>Reason:</strong> {selectedLeaveForAction.reason}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Director Remarks (Optional)</label>
              <textarea
                value={actionRemarks}
                onChange={(e) => setActionRemarks(e.target.value)}
                placeholder="e.g., Approved. Please hand over pending service tickets before departure."
                rows={3}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-sky-500 outline-none"
              ></textarea>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setRemarksModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmLeaveAction}
                disabled={actionLoading}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 ${
                  pendingActionType === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirm {pendingActionType === 'APPROVE' ? 'Approval' : 'Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD NEW EMPLOYEE (DIRECTOR ONLY) */}
      {addEmpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-sky-600" /> Add New Employee
                </h3>
                <p className="text-xs text-slate-500">
                  New hires report directly to Directors (Manav Shah & Neer Savla)
                </p>
              </div>
              <button
                onClick={() => setAddEmpModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            </div>

            {addEmpError && (
              <div className="my-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {addEmpError}
              </div>
            )}

            <form onSubmit={handleAddEmployee} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Employee ID</label>
                  <input
                    type="text"
                    value={newEmpForm.employee_id}
                    onChange={(e) => setNewEmpForm({ ...newEmpForm, employee_id: e.target.value })}
                    placeholder="e.g. EMP005 (auto if blank)"
                    className="w-full mt-1 p-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newEmpForm.name}
                    onChange={(e) => setNewEmpForm({ ...newEmpForm, name: e.target.value })}
                    placeholder="e.g. Amit Patil"
                    className="w-full mt-1 p-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Role *</label>
                  <select
                    value={newEmpForm.role}
                    onChange={(e) => setNewEmpForm({ ...newEmpForm, role: e.target.value })}
                    className="w-full mt-1 p-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                  >
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="DIRECTOR">DIRECTOR</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700">Designation *</label>
                  <input
                    type="text"
                    required
                    value={newEmpForm.designation}
                    onChange={(e) => setNewEmpForm({ ...newEmpForm, designation: e.target.value })}
                    placeholder="e.g. Senior Technician"
                    className="w-full mt-1 p-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Contact Number *</label>
                  <input
                    type="tel"
                    required
                    value={newEmpForm.contact}
                    onChange={(e) => setNewEmpForm({ ...newEmpForm, contact: e.target.value })}
                    placeholder="e.g. 9820012345"
                    className="w-full mt-1 p-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Initial Password *</label>
                  <input
                    type="text"
                    required
                    value={newEmpForm.password}
                    onChange={(e) => setNewEmpForm({ ...newEmpForm, password: e.target.value })}
                    placeholder="e.g. 12345678"
                    className="w-full mt-1 p-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700">Company Email *</label>
                <input
                  type="email"
                  required
                  value={newEmpForm.email}
                  onChange={(e) => setNewEmpForm({ ...newEmpForm, email: e.target.value })}
                  placeholder="e.g. amit@nirmaanwatertech.com"
                  className="w-full mt-1 p-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="p-3 bg-sky-50 rounded-xl text-[11px] text-sky-800 border border-sky-200">
                ⚡ Initial annual balances will be auto-credited: <strong>12 Casual</strong> and <strong>12 Sick</strong> Leaves.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddEmpModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addEmpLoading}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold transition-colors flex items-center gap-1.5"
                >
                  {addEmpLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Save & Onboard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: GRANT COMP-OFF */}
      {compOffModalOpen && selectedEmpForCompOff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              Grant +1 Day Comp-Off
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Credit an extra day of compensatory off for <strong>{selectedEmpForCompOff.name}</strong> ({selectedEmpForCompOff.designation}).
            </p>

            <div className="my-4 space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Reason / Weekend Overtime Note</label>
              <textarea
                value={compOffReason}
                onChange={(e) => setCompOffReason(e.target.value)}
                placeholder="e.g. Worked Sunday emergency RO plant installation in Thane."
                rows={3}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              ></textarea>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setCompOffModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleGrantCompOff}
                disabled={compOffLoading}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-1.5"
              >
                {compOffLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirm +1 Day Credit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE CONFIRMATION */}
      {deleteModalOpen && empToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-rose-200 max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-bold text-lg text-rose-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Remove Employee from Roster
            </h3>
            <p className="text-xs text-slate-600 mt-2">
              Are you sure you want to deactivate and remove <strong>{empToDelete.name}</strong> ({empToDelete.employee_id})?
              Their login access will be immediately revoked.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEmployee}
                disabled={deleteLoading}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center gap-1.5"
              >
                {deleteLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: ADD HOLIDAY */}
      {addHolidayOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-2xl">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-sky-600" /> Add Public Holiday
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
                  className="w-full mt-1 p-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Date</label>
                <input
                  type="date"
                  required
                  value={holidayForm.date}
                  onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                  className="w-full mt-1 p-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-sky-500"
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
