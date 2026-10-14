'use client';

import React from 'react';
import { User } from '@/lib/types';
import PushNotificationButton from './PushNotificationButton';
import {
  Droplets,
  Bell,
  SunMedium,
  LogOut,
  User as UserIcon,
  Shield,
  Briefcase,
  Wrench,
  FileSpreadsheet,
} from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  onOpenNotifications: () => void;
  onOpenDailyDigest: () => void;
  unreadCount?: number;
  onLogout: () => void;
}

export default function Navbar({
  currentUser,
  onOpenNotifications,
  onOpenDailyDigest,
  unreadCount = 0,
  onLogout,
}: NavbarProps) {
  const getRoleBadge = (role: string, designation: string) => {
    if (role === 'DIRECTOR') {
      return {
        label: 'Director',
        classes: 'bg-sky-500/20 text-sky-300 border-sky-400/30',
        icon: Shield,
      };
    }
    if (role === 'ADMIN') {
      return {
        label: 'Admin',
        classes: 'bg-purple-500/20 text-purple-300 border-purple-400/30',
        icon: FileSpreadsheet,
      };
    }
    if (designation.toLowerCase().includes('technician')) {
      return {
        label: 'Technician',
        classes: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
        icon: Wrench,
      };
    }
    return {
      label: designation || 'Staff',
      classes: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
      icon: Briefcase,
    };
  };

  const badgeInfo = currentUser
    ? getRoleBadge(currentUser.role, currentUser.designation)
    : null;
  const RoleIcon = badgeInfo?.icon || UserIcon;

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center shadow-glow text-white">
            <Droplets className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-sky-100 to-sky-300 bg-clip-text text-transparent">
                NIRMAAN
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-sky-500/20 text-sky-400 border border-sky-400/30">
                WaterTech
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide hidden sm:block">
              Leave & Approval Management System
            </p>
          </div>
        </div>

        {/* Center / Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Logged-In User Profile Card */}
          {currentUser && (
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 shadow-sm">
              <div
                className={`w-7 h-7 rounded-lg ${
                  currentUser.avatar_color || 'bg-slate-700'
                } flex items-center justify-center text-white font-bold text-xs shadow-inner`}
              >
                {currentUser.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>

              <div className="hidden sm:block text-left">
                <p className="font-bold text-xs text-white leading-tight">
                  {currentUser.name}
                </p>
                <p className="text-[10px] text-slate-400 font-mono leading-tight">
                  {currentUser.employee_id}
                </p>
              </div>

              {badgeInfo && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border flex items-center gap-1 ${badgeInfo.classes}`}
                >
                  <RoleIcon className="w-3 h-3" />
                  <span>{badgeInfo.label}</span>
                </span>
              )}
            </div>
          )}

          {/* 9 AM Director Digest Button */}
          <button
            onClick={onOpenDailyDigest}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white text-xs font-semibold shadow-glow transition-all"
            title="Preview 9 AM Director Digest"
          >
            <SunMedium className="w-4 h-4 text-amber-300" />
            <span className="hidden sm:inline">9 AM Digest</span>
          </button>

          {/* Mobile & Browser Web Push Notification Trigger */}
          {currentUser && (
            <PushNotificationButton
              userId={currentUser.id}
              userName={currentUser.name}
            />
          )}

          {/* Notification Engine Bell */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            title="Notification Engine"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center animate-bounce shadow-glow-rose">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
