'use client';

import React, { useState, useEffect } from 'react';
import {
  isPushSupported,
  getCurrentSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/push-client';
import { Smartphone, Bell, BellRing, Check, SendHorizontal, AlertCircle, X, Sparkles } from 'lucide-react';

interface PushNotificationButtonProps {
  userId: string;
  userName: string;
}

export default function PushNotificationButton({ userId, userName }: PushNotificationButtonProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    const supported = isPushSupported();
    setIsSupported(supported);

    if (supported) {
      getCurrentSubscription().then((sub) => {
        setIsSubscribed(Boolean(sub));
      });
    }
  }, [userId]);

  const handleTogglePush = async () => {
    setLoading(true);
    setTestResult(null);

    if (isSubscribed) {
      const unsubscribed = await unsubscribeFromPush();
      if (unsubscribed) {
        setIsSubscribed(false);
      }
    } else {
      const res = await subscribeToPush(userId);
      if (res.success) {
        setIsSubscribed(true);
        setModalOpen(true);
      } else {
        alert(res.error || 'Failed to enable push notifications');
      }
    }
    setLoading(false);
  };

  const handleSendTestPush = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult(data.message || 'Push alert sent to your device!');
      } else {
        setTestResult(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setTestResult(`Error: ${err.message}`);
    } finally {
      setTestLoading(false);
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => {
          if (isSubscribed) {
            setModalOpen(true);
          } else {
            handleTogglePush();
          }
        }}
        disabled={loading}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
          isSubscribed
            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 hover:bg-emerald-500/30'
            : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
        }`}
        title={isSubscribed ? 'Mobile & Browser Push Notifications Active' : 'Enable Mobile & Browser Push Notifications'}
      >
        {isSubscribed ? (
          <>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
            <BellRing className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden lg:inline text-[11px]">Push Active</span>
          </>
        ) : (
          <>
            <Smartphone className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden lg:inline text-[11px]">Enable Push</span>
          </>
        )}
      </button>

      {/* Push Notification Manager Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200 text-slate-900">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-md">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Mobile & Browser Push
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Nirmaan WaterTech Executive Alerts
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                <Check className="w-4 h-4 text-emerald-600" />
                Push Notifications are Active!
              </p>
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                Your device will receive instant popups on your screen whenever someone applies for leave or when an approval is made, even if this browser tab is closed.
              </p>
            </div>

            {testResult && (
              <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-800 leading-relaxed">
                {testResult}
              </div>
            )}

            <div className="space-y-2 pt-1">
              <button
                onClick={handleSendTestPush}
                disabled={testLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
              >
                <SendHorizontal className="w-3.5 h-3.5" />
                {testLoading ? 'Sending Push...' : 'Send Test Push Alert to Device'}
              </button>

              <button
                onClick={handleTogglePush}
                disabled={loading}
                className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 font-semibold text-[11px] transition-colors"
              >
                Disable Push Notifications on this Device
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
