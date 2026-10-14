'use client';

import React, { useState, useMemo } from 'react';
import { User, LeaveBalance, LeaveRequest, Holiday, LeaveType, HalfDayPeriod } from '@/lib/types';
import { calculateWorkingDays, isSameDayLeave, checkTechnicianOverlap } from '@/lib/date-utils';
import {
  Calendar,
  Clock,
  Send,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Info,
  CalendarDays,
  FileText,
  RotateCcw,
  Sparkles,
  Phone,
  Mail,
  RefreshCw,
  PlusCircle,
  HelpCircle,
} from 'lucide-react';

interface EmployeeDashboardProps {
  currentUser: User;
  balance: LeaveBalance | null;
  leaves: LeaveRequest[];
  allActiveLeaves: LeaveRequest[];
  holidays: Holiday[];
  onRefreshData: () => void;
}

export default function EmployeeDashboard({
  currentUser,
  balance,
  leaves,
  allActiveLeaves,
  holidays,
  onRefreshData,
}: EmployeeDashboardProps) {
  const [showApplyModal, setShowApplyModal] = useState(false);

  // Leave Form state
  const todayStr = new Date().toISOString().split('T')[0];
  const [leaveType, setLeaveType] = useState<LeaveType>('CASUAL');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<HalfDayPeriod>('FIRST_HALF');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Live Smart Days Calculation
  const holidayDates = useMemo(() => holidays.map((h) => h.date), [holidays]);
  const calculatedDays = useMemo(() => {
    return calculateWorkingDays(startDate, endDate, isHalfDay, holidayDates);
  }, [startDate, endDate, isHalfDay, holidayDates]);

  // Live Same-Day check
  const isSameDay = useMemo(() => isSameDayLeave(startDate), [startDate]);

  // Live Technician Overlap preview (Mahesh & Ritesh)
  const isTechnician = currentUser.employee_id === 'EMP001' || currentUser.employee_id === 'EMP002';
  const overlapCheck = useMemo(() => {
    if (!isTechnician) return { hasOverlap: false };
    return checkTechnicianOverlap(currentUser.employee_id, startDate, endDate, allActiveLeaves);
  }, [isTechnician, currentUser.employee_id, startDate, endDate, allActiveLeaves]);

  // Available balance for current selected leave type
  const currentAvailableBalance = useMemo(() => {
    if (!balance) return 0;
    if (leaveType === 'CASUAL') return balance.cl_allocated - balance.cl_used - balance.cl_pending;
    if (leaveType === 'SICK') return balance.sl_allocated - balance.sl_used - balance.sl_pending;
    if (leaveType === 'PAID') return balance.pl_allocated - balance.pl_used - balance.pl_pending;
    if (leaveType === 'COMP_OFF') return balance.co_allocated - balance.co_used - balance.co_pending;
    return 999; // UNPAID
  }, [balance, leaveType]);

  // Handle Submit Leave Request
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (calculatedDays <= 0) {
      setFormError('Selected date range contains only Sundays or Company Holidays. No leave deduction is needed.');
      return;
    }

    if (leaveType !== 'UNPAID' && currentAvailableBalance < calculatedDays) {
      setFormError(
        `Insufficient ${leaveType} balance. You have ${currentAvailableBalance} day(s) available, but requested ${calculatedDays} day(s). Choose UNPAID / Loss of Pay if urgent.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          leave_type: leaveType,
          start_date: startDate,
          end_date: isHalfDay ? startDate : endDate,
          is_half_day: isHalfDay,
          half_day_period: isHalfDay ? halfDayPeriod : null,
          reason: reason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to submit leave request');
      } else {
        setShowApplyModal(false);
        setReason('');
        setIsHalfDay(false);
        onRefreshData();
      }
    } catch (err: any) {
      setFormError(err.message || 'Error submitting leave request');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Cancel Leave
  const handleCancelLeave = async (leaveId: string) => {
    if (!confirm('Are you sure you want to cancel this pending leave request? Locked days will be released back to your available balance.')) {
      return;
    }

    setCancellingId(leaveId);
    try {
      const res = await fetch(`/api/leaves/${leaveId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CANCEL',
          actor_id: currentUser.id,
          remarks: 'Cancelled by employee',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to cancel leave');
      } else {
        onRefreshData();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Welcome Card with Flat Hierarchy Reminder */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30">
                {currentUser.employee_id} • {currentUser.designation}
              </span>
              <span className="text-xs text-slate-300 font-medium">
                Reports Directly to: <strong className="text-sky-300">Manav Shah & Neer Savla</strong> (Directors)
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome, {currentUser.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Field & Service Portal. Track your balances, apply for leaves, and check live approvals.
            </p>
          </div>

          <button
            onClick={() => {
              setFormError('');
              setShowApplyModal(true);
            }}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 font-extrabold text-sm shadow-glow transition-all flex items-center justify-center gap-2"
          >
            <PlusCircle className="w-5 h-5" /> Apply for Leave
          </button>
        </div>
      </div>

      {/* BALANCE CARDS (Mobile-First Responsive Grid) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Casual Leave */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Casual Leave (CL)</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
              12/yr
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-slate-900">
              {balance ? balance.cl_allocated - balance.cl_used - balance.cl_pending : 0}
            </span>
            <span className="text-xs text-slate-400 font-medium">days left</span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Used: <strong>{balance?.cl_used || 0}</strong></span>
            <span>Pending: <strong className="text-amber-600">{balance?.cl_pending || 0}</strong></span>
          </div>
        </div>

        {/* Sick Leave */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sick Leave (SL)</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
              8/yr
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-slate-900">
              {balance ? balance.sl_allocated - balance.sl_used - balance.sl_pending : 0}
            </span>
            <span className="text-xs text-slate-400 font-medium">days left</span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Used: <strong>{balance?.sl_used || 0}</strong></span>
            <span>Pending: <strong className="text-amber-600">{balance?.sl_pending || 0}</strong></span>
          </div>
        </div>

        {/* Paid Leave */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Paid Leave (PL)</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              15/yr
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-slate-900">
              {balance ? balance.pl_allocated - balance.pl_used - balance.pl_pending : 0}
            </span>
            <span className="text-xs text-slate-400 font-medium">days left</span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Used: <strong>{balance?.pl_used || 0}</strong></span>
            <span>Pending: <strong className="text-amber-600">{balance?.pl_pending || 0}</strong></span>
          </div>
        </div>

        {/* Comp-Off & LOP */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Comp-Off / LOP</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
              Director Grant
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-slate-900">
              {balance ? balance.co_allocated - balance.co_used - balance.co_pending : 0}
            </span>
            <span className="text-xs text-slate-400 font-medium">Comp-Off left</span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Total Granted: <strong>{balance?.co_allocated || 0}</strong></span>
            <span>LOP Taken: <strong className="text-rose-600">{balance?.lop_days || 0}</strong></span>
          </div>
        </div>
      </div>

      {/* MY LEAVE HISTORY & REAL-TIME TIMELINE */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-sky-600" /> My Leave Requests & Approvals
            </h2>
            <p className="text-xs text-slate-500">
              Direct reports to Directors Manav Shah and Neer Savla
            </p>
          </div>
          <button
            onClick={onRefreshData}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {leaves.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            No leave requests submitted yet. Use &ldquo;Apply for Leave&rdquo; above.
          </div>
        ) : (
          <div className="space-y-3">
            {leaves.map((l) => {
              const isPending = l.status === 'PENDING';
              const isApproved = l.status === 'APPROVED';
              const isRejected = l.status === 'REJECTED';
              const isCancelled = l.status === 'CANCELLED';

              return (
                <div
                  key={l.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isPending
                      ? 'bg-amber-50/40 border-amber-200'
                      : isApproved
                      ? 'bg-emerald-50/30 border-emerald-200'
                      : isRejected
                      ? 'bg-rose-50/30 border-rose-200'
                      : 'bg-slate-50/50 border-slate-200 opacity-75'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">
                          {l.leave_type} LEAVE
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-100 text-sky-800">
                          {l.total_days} {l.total_days === 1 ? 'day' : 'days'}
                        </span>
                        {l.is_half_day ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                            Half Day ({l.half_day_period})
                          </span>
                        ) : null}
                        {l.is_same_day ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                            🚨 SAME-DAY
                          </span>
                        ) : null}
                        {l.technician_overlap_flag ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white">
                            ⚠️ Overlap Alert
                          </span>
                        ) : null}
                      </div>

                      <p className="text-xs text-slate-600">
                        <strong>Dates:</strong> {l.start_date} {l.start_date !== l.end_date ? `to ${l.end_date}` : ''}
                      </p>

                      <p className="text-xs text-slate-700 bg-white/80 p-2 rounded-lg border border-slate-200/80 inline-block">
                        <strong>Reason:</strong> &ldquo;{l.reason}&rdquo;
                      </p>

                      {/* Decision Details with Attribution */}
                      {!isPending && (
                        <div className="text-xs pt-1 flex items-center gap-1.5 flex-wrap">
                          {l.action_by_name && (
                            <span className="font-semibold text-slate-700">
                              {isApproved ? '✅ Approved' : isRejected ? '❌ Rejected' : 'Cancelled'} by{' '}
                              <strong>{l.action_by_name}</strong>
                            </span>
                          )}
                          {l.action_remarks && (
                            <span className="text-slate-500 italic">
                              — &ldquo;{l.action_remarks}&rdquo;
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Status Badge & Cancel Action */}
                    <div className="flex items-center gap-2 sm:self-center self-end">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        isPending
                          ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                          : isApproved
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : isRejected
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {l.status}
                      </span>

                      {isPending && (
                        <button
                          onClick={() => handleCancelLeave(l.id)}
                          disabled={cancellingId === l.id}
                          className="px-3 py-1 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1"
                          title="Cancel request and unlock balance"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: APPLY FOR LEAVE (MOBILE-FIRST) */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-5 sm:p-6 shadow-2xl my-8 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-sky-600" /> Apply for Leave
                </h3>
                <p className="text-xs text-slate-500">
                  Routes directly to Directors (Manav Shah & Neer Savla)
                </p>
              </div>
              <button
                onClick={() => setShowApplyModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                &times;
              </button>
            </div>

            {formError && (
              <div className="my-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            {/* LIVE WARNINGS */}
            {/* 1. Same-Day Urgent Flag */}
            {isSameDay && (
              <div className="my-3 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 animate-pulse" />
                <span>🚨 SAME-DAY URGENT: Leave begins today. Directors will be notified with high-priority alert.</span>
              </div>
            )}

            {/* 2. Technician Overlap Alert (Direct Requirement) */}
            {overlapCheck.hasOverlap && (
              <div className="my-3 p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold flex items-start gap-2 animate-pulse">
                <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p>⚠️ CRITICAL FIELD OVERLAP WARNING:</p>
                  <p className="font-medium text-rose-800 mt-0.5">
                    Your colleague {currentUser.employee_id === 'EMP001' ? 'Ritesh Dantani' : 'Mahesh Kavadkar'} already has a scheduled leave during this timeframe. If you apply, field coverage drops to 0%!
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitLeave} className="mt-4 space-y-4 text-xs">
              {/* Leave Type */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Leave Category</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['CASUAL', 'SICK', 'PAID', 'COMP_OFF'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setLeaveType(type)}
                      className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all ${
                        leaveType === type
                          ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Available in {leaveType}: <strong>{currentAvailableBalance} days</strong></span>
                  <button
                    type="button"
                    onClick={() => setLeaveType('UNPAID')}
                    className={`underline text-[11px] ${leaveType === 'UNPAID' ? 'text-rose-600 font-bold' : 'text-slate-500'}`}
                  >
                    Select UNPAID / LOP
                  </button>
                </div>
              </div>

              {/* Half-Day Toggle */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <label htmlFor="half-day-toggle" className="font-bold text-slate-800 cursor-pointer">Half Day Leave (0.5 Day)</label>
                  <p className="text-[11px] text-slate-500">Deducts exactly 0.5 days from balance</p>
                </div>
                <input
                  id="half-day-toggle"
                  type="checkbox"
                  checked={isHalfDay}
                  onChange={(e) => setIsHalfDay(e.target.checked)}
                  className="w-4 h-4 text-sky-600 rounded cursor-pointer"
                />
              </div>

              {isHalfDay && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHalfDayPeriod('FIRST_HALF')}
                    className={`p-2 rounded-lg font-semibold text-xs border ${
                      halfDayPeriod === 'FIRST_HALF'
                        ? 'bg-sky-100 border-sky-400 text-sky-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    🌅 First Half (Morning)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHalfDayPeriod('SECOND_HALF')}
                    className={`p-2 rounded-lg font-semibold text-xs border ${
                      halfDayPeriod === 'SECOND_HALF'
                        ? 'bg-sky-100 border-sky-400 text-sky-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    🌇 Second Half (Afternoon)
                  </button>
                </div>
              )}

              {/* Date pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isHalfDay ? 'Leave Date *' : 'Start Date *'}
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (isHalfDay || e.target.value > endDate) setEndDate(e.target.value);
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                {!isHalfDay && (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">End Date *</label>
                    <input
                      type="date"
                      required
                      min={startDate}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                )}
              </div>

              {/* Smart calculation display */}
              <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-xl flex items-center justify-between text-xs text-sky-900">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-sky-600" />
                  <strong>Smart Net Working Days:</strong> (Excludes Sundays & Holidays)
                </span>
                <span className="font-extrabold text-sm text-sky-950 bg-white px-2.5 py-0.5 rounded-lg border border-sky-200">
                  {calculatedDays} {calculatedDays === 1 ? 'day' : 'days'}
                </span>
              </div>

              {/* Reason */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Reason for Leave *</label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide clear reason for Director approval (e.g., Medical appointment, Family emergency, Festival visit)..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-sky-500"
                ></textarea>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Submit to Directors &rarr;
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
