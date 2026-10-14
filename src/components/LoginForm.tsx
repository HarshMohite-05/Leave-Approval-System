'use client';

import React, { useState } from 'react';
import { User, LeaveBalance } from '@/lib/types';
import {
  Droplets,
  User as UserIcon,
  Shield,
  ArrowRight,
  AlertCircle,
  Lock,
} from 'lucide-react';

interface LoginFormProps {
  onLoginSuccess: (user: User, balance: LeaveBalance | null) => void;
}

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to authenticate');
      } else {
        onLoginSuccess(data.user, data.balance);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left: Branding & Overview */}
        <div className="lg:col-span-5 space-y-6 text-white text-center lg:text-left">
          <div className="inline-flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-cyan-400 flex items-center justify-center shadow-glow text-white">
              <Droplets className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-2xl tracking-tight text-white">
                  NIRMAAN
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-sky-500/20 text-sky-400 border border-sky-400/30">
                  WaterTech
                </span>
              </div>
              <p className="text-xs text-sky-200">Leave & Approval Management</p>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Leave & Attendance Portal
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Official workforce management system for <strong>Nirmaan WaterTech Private Limited</strong>. Secure role-based access for Technicians, Sales Executives, Admin, and Executive Directors.
            </p>
          </div>

          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 space-y-2.5 text-xs text-slate-300 text-left">
            <div className="flex items-center gap-2 font-bold text-white">
              <Shield className="w-4 h-4 text-sky-400" /> System Features
            </div>
            <p>• Multi-tier authorization by Executive Directors & Admin Operations.</p>
            <p>• Zero field technician overlap safeguard for water treatment sites.</p>
            <p>• Real-time Web Push alerts and 9:00 AM daily executive briefings.</p>
          </div>
        </div>

        {/* Right: Login Form */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Sign in to your account</h2>
            <p className="text-xs text-slate-500 mt-1">
              Enter your registered <strong>Employee ID</strong> (e.g. <code>D001</code>, <code>EMP001</code>) or <strong>Company Email</strong>
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Employee ID or Email Address
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. D001 or manav@nirmaanwatertech.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-sky-500 text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-sky-500 text-slate-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              {loading ? 'Authenticating...' : 'Sign In'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-400">
            Protected internal system • Nirmaan WaterTech Private Limited
          </div>
        </div>
      </div>
    </div>
  );
}
