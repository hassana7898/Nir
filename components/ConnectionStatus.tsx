import React, { useCallback, useEffect, useState } from 'react';
import { getSyncQueueCount, triggerSync } from '../services/dbStore';

const probeApi = async (): Promise<boolean> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch('/api/health', {
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
};

const ConnectionStatus: React.FC = () => {
  const [serverOnline, setServerOnline] = useState(false);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);

  const refresh = useCallback(async () => {
    const [online, count] = await Promise.all([probeApi(), getSyncQueueCount()]);
    setServerOnline(online);
    setPending(count);
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 10000);
    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (typeof detail.pending === 'number') setPending(detail.pending);
      if (typeof detail.syncing === 'boolean') {
        setSyncing(detail.syncing);
        setSyncingNow(detail.syncing);
      }
      if (typeof detail.synced === 'boolean' && detail.synced) void refresh();
    };
    window.addEventListener('nir_sync_status', onStatus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('nir_sync_status', onStatus);
    };
  }, [refresh]);

  const manualSync = async () => {
    setSyncingNow(true);
    try {
      await triggerSync();
      await refresh();
    } finally {
      setSyncingNow(false);
    }
  };

  const isOnline = serverOnline && navigator.onLine;
  const label = isOnline
    ? pending > 0 ? `${pending} مورد در انتظار همگام‌سازی` : 'متصل و همگام'
    : pending > 0 ? `آفلاین — ${pending} مورد در صف` : 'آفلاین — استفاده از اطلاعات محلی';

  return (
    <div dir="rtl" className="fixed bottom-4 right-4 z-[100] max-w-[calc(100vw-2rem)]">
      <div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium shadow-lg backdrop-blur ${isOnline ? 'border-emerald-200 bg-white/95 text-emerald-700' : 'border-amber-200 bg-white/95 text-amber-800'}`}>
        <span aria-hidden="true" className="text-[11px]">{isOnline ? '●' : '○'}</span>
        <span>{label}</span>
        {isOnline && pending === 0 && <span aria-hidden="true" title="همگام">✓</span>}
        {(pending > 0 || syncing) && (
          <button
            type="button"
            onClick={() => void manualSync()}
            disabled={syncingNow || !navigator.onLine}
            className="mr-1 rounded-full p-1 text-sm leading-none transition hover:bg-slate-100 disabled:opacity-50"
            title="همگام‌سازی"
            aria-label="همگام‌سازی"
          >
            <span aria-hidden="true" className={syncingNow ? 'inline-block animate-spin' : 'inline-block'}>↻</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ConnectionStatus;
