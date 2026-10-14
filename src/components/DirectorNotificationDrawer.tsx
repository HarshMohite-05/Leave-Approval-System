'use client';

import React, { useEffect, useState } from 'react';
import { NotificationItem } from '@/lib/types';
import {
  X,
  Bell,
  Calendar,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  RefreshCw,
  SendHorizontal,
} from 'lucide-react';

interface DirectorNotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId?: string;
  onReviewLeave?: (leaveId: string) => void;
}

export default function DirectorNotificationDrawer({
  isOpen,
  onClose,
  targetUserId,
  onReviewLeave,
}: DirectorNotificationDrawerProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'OVERLAP' | 'SUBMISSIONS' | 'DECISIONS'>('ALL');

  const fetchNotifications = React.useCallback(async () => {
    setLoading(true);
    try {
      const url = targetUserId
        ? `/api/notifications?user_id=${targetUserId}`
        : '/api/notifications';
      const res = await fetch(url);
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all: true, user_id: targetUserId }),
      });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  if (!isOpen) return null;

  const filteredNotifs = notifications.filter((n) => {
    if (filter === 'OVERLAP') return n.type === 'TECHNICIAN_OVERLAP';
    if (filter === 'SUBMISSIONS') return n.type === 'LEAVE_SUBMITTED';
    if (filter === 'DECISIONS') return n.type === 'LEAVE_APPROVED' || n.type === 'LEAVE_REJECTED';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200">
          {/* Header */}
          <div className="p-5 bg-gradient-to-r from-slate-900 to-sky-950 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-400/30">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base flex items-center gap-2 text-white">
                  Live Notification Engine
                </h3>
                <p className="text-xs text-slate-300">
                  Real-Time In-App & Mobile Push Engine
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={fetchNotifications}
                className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10"
                title="Refresh logs"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Subheader: Channels Status Banner */}
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Push & In-App: <strong>Active (200 OK)</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
              <span>Executive Channel</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-1 bg-white">
            <div className="flex items-center gap-1 overflow-x-auto text-xs py-1">
              {(['ALL', 'OVERLAP', 'SUBMISSIONS', 'DECISIONS'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors whitespace-nowrap ${
                    filter === tab
                      ? 'bg-sky-100 text-sky-800 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab === 'OVERLAP' ? '🚨 Overlaps' : tab === 'SUBMISSIONS' ? 'Submissions' : tab === 'DECISIONS' ? 'Decisions' : 'All'}
                </button>
              ))}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 whitespace-nowrap ml-2"
              >
                Mark read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/70">
            {loading && notifications.length === 0 ? (
              <div className="py-20 text-center text-slate-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-600 mb-2" />
                Loading dispatch events...
              </div>
            ) : filteredNotifs.length === 0 ? (
              <div className="py-20 text-center text-slate-400 text-xs">
                No notification events match this filter.
              </div>
            ) : (
              filteredNotifs.map((n) => {
                const isOverlap = n.type === 'TECHNICIAN_OVERLAP';
                const isApproved = n.type === 'LEAVE_APPROVED';
                const isRejected = n.type === 'LEAVE_REJECTED';
                const meta = n.metadata ? (typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata) : null;

                return (
                  <div
                    key={n.id}
                    className={`p-3.5 rounded-xl border transition-all text-xs shadow-sm ${
                      isOverlap
                        ? 'bg-rose-50 border-rose-300 text-rose-950'
                        : isApproved
                        ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                        : isRejected
                        ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                        : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold">
                        {isOverlap && <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />}
                        {isApproved && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                        {!isOverlap && !isApproved && <SendHorizontal className="w-4 h-4 text-sky-600 flex-shrink-0" />}
                        <span className="line-clamp-1">{n.title}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 whitespace-nowrap">
                        <Clock className="w-3 h-3" />
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="mt-1.5 text-slate-600 leading-relaxed">{n.message}</p>

                    {/* Metadata Dispatch Badges */}
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                        To: {n.target_user_ids}
                      </span>
                      {meta?.calendar_sync && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-medium flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" /> Calendar Synced
                        </span>
                      )}
                    </div>

                    {/* Action button if there is a leave request */}
                    {n.leave_request_id && onReviewLeave && (
                      <button
                        onClick={() => {
                          onClose();
                          onReviewLeave(n.leave_request_id!);
                        }}
                        className="mt-2.5 w-full py-1 px-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-[11px] transition-colors flex items-center justify-center gap-1"
                      >
                        Review Leave Request &rarr;
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="p-3 bg-white border-t border-slate-200 text-center text-[11px] text-slate-500">
            Targeting Directors: <strong>Manav Shah (`D001`)</strong> & <strong>Neer Savla (`D002`)</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
