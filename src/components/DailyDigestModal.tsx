'use client';

import React, { useEffect, useState } from 'react';
import { DailyDigest } from '@/lib/types';
import { X, Calendar, Users, AlertTriangle, Clock, CheckCircle2, RefreshCw, Send, ShieldAlert } from 'lucide-react';

interface DailyDigestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActionClick?: (leaveId: string) => void;
}

export default function DailyDigestModal({ isOpen, onClose, onActionClick }: DailyDigestModalProps) {
  const [digest, setDigest] = useState<DailyDigest | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDigest = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cron/daily-digest');
      const data = await res.json();
      if (data.success) {
        setDigest(data.digest);
      }
    } catch (err) {
      console.error('Failed to load digest:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDigest();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-400/30 flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> 9:00 AM Automated Executive Briefing
            </span>
            <span className="text-xs text-slate-400">Scheduled for Manav Shah & Neer Savla</span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            🌅 Director Daily Digest
          </h2>
          <p className="text-sm text-slate-300 mt-1">
            Real-time morning summary of company attendance, active field coverage, and pending approvals.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50">
          {loading ? (
            <div className="py-16 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-sky-600 mb-3" />
              <p className="text-sm font-medium">Compiling 9 AM executive morning briefing...</p>
            </div>
          ) : digest ? (
            <>
              {/* Coverage Cards */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-600" />
                  Department Coverage & Field Readiness
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Technicians */}
                  <div className={`p-4 rounded-xl border ${
                    digest.coverage_status.technicians.available === 0
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : digest.coverage_status.technicians.available === 1
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  }`}>
                    <div className="text-xs font-semibold text-slate-600 uppercase">Field Technicians</div>
                    <div className="text-2xl font-extrabold mt-1">
                      {digest.coverage_status.technicians.available}/{digest.coverage_status.technicians.total}
                    </div>
                    <div className="text-xs mt-1 font-medium">
                      {digest.coverage_status.technicians.percentage}% Coverage
                    </div>
                  </div>

                  {/* Sales */}
                  <div className="p-4 rounded-xl border bg-white border-slate-200">
                    <div className="text-xs font-semibold text-slate-500 uppercase">Sales Executive</div>
                    <div className="text-2xl font-extrabold text-slate-800 mt-1">
                      {digest.coverage_status.sales.available}/{digest.coverage_status.sales.total}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {digest.coverage_status.sales.percentage}% Active
                    </div>
                  </div>

                  {/* Admin */}
                  <div className="p-4 rounded-xl border bg-white border-slate-200">
                    <div className="text-xs font-semibold text-slate-500 uppercase">Admin / Operations</div>
                    <div className="text-2xl font-extrabold text-slate-800 mt-1">
                      {digest.coverage_status.admin.available}/{digest.coverage_status.admin.total}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {digest.coverage_status.admin.percentage}% Active
                    </div>
                  </div>

                  {/* Overall */}
                  <div className="p-4 rounded-xl border bg-sky-50 border-sky-200">
                    <div className="text-xs font-semibold text-sky-800 uppercase">Overall Staff</div>
                    <div className="text-2xl font-extrabold text-sky-950 mt-1">
                      {digest.coverage_status.overall_staff.working}/{digest.coverage_status.overall_staff.total}
                    </div>
                    <div className="text-xs text-sky-700 mt-1 font-medium">
                      {digest.coverage_status.overall_staff.percentage}% Working
                    </div>
                  </div>
                </div>
              </div>

              {/* Who is On Leave Today & Tomorrow */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Today */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <h4 className="font-semibold text-sm text-slate-800 flex items-center justify-between mb-3">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-sky-600" /> On Leave Today
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {digest.on_leave_today.length} staff
                    </span>
                  </h4>
                  {digest.on_leave_today.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 flex flex-col items-center gap-1">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      All team members are present today.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {digest.on_leave_today.map((item, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-slate-800">{item.employee_name}</p>
                            <p className="text-slate-500">{item.designation} ({item.employee_id})</p>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-semibold text-[11px]">
                              {item.leave_type}
                            </span>
                            {item.is_half_day && (
                              <p className="text-[10px] text-amber-600 font-medium mt-0.5">Half Day</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tomorrow */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <h4 className="font-semibold text-sm text-slate-800 flex items-center justify-between mb-3">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-purple-600" /> On Leave Tomorrow
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {digest.on_leave_tomorrow.length} staff
                    </span>
                  </h4>
                  {digest.on_leave_tomorrow.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 flex flex-col items-center gap-1">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      Full attendance expected tomorrow.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {digest.on_leave_tomorrow.map((item, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-slate-800">{item.employee_name}</p>
                            <p className="text-slate-500">{item.designation} ({item.employee_id})</p>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold text-[11px]">
                              {item.leave_type}
                            </span>
                            {item.is_half_day && (
                              <p className="text-[10px] text-amber-600 font-medium mt-0.5">Half Day</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Pending Approvals */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Pending Approvals Requiring Director Attention ({digest.pending_requests.length})
                  </h4>
                  <span className="text-xs text-slate-500">Direct reports to Manav & Neer</span>
                </div>

                {digest.pending_requests.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">
                    🎉 Inbox zero! All leave requests have been acted upon.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {digest.pending_requests.map((req) => (
                      <div
                        key={req.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          req.technician_overlap
                            ? 'bg-rose-50/60 border-rose-300'
                            : req.is_same_day
                            ? 'bg-amber-50/60 border-amber-300'
                            : 'bg-slate-50 border-slate-200 hover:border-sky-300'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-slate-900">{req.employee_name}</span>
                              <span className="text-xs text-slate-500">({req.designation})</span>
                              {req.is_same_day && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                                  🚨 SAME-DAY URGENT
                                </span>
                              )}
                              {req.technician_overlap && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white flex items-center gap-1">
                                  <ShieldAlert className="w-3 h-3" /> 0% FIELD COVERAGE
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 mt-1">
                              <span className="font-semibold text-slate-800">{req.dates}</span> ({req.total_days} days) • Reason: &ldquo;{req.reason}&rdquo;
                            </p>
                          </div>
                          {onActionClick && (
                            <button
                              onClick={() => {
                                onClose();
                                onActionClick(req.id);
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 text-white hover:bg-sky-700 transition-colors whitespace-nowrap self-start sm:self-center"
                            >
                              Review & Act &rarr;
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-center text-slate-500 py-10">Unable to load daily digest data.</p>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            Automated Cron trigger: <code>0 9 * * *</code> (9:00 AM IST)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDigest}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-700 font-medium transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors"
            >
              Close Briefing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
