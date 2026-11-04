'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'admin-login-retry-until';

export function useLoginCooldown() {
  const [retryUntil, setRetryUntil] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    try {
      const saved = Number(sessionStorage.getItem(STORAGE_KEY));
      const remaining = Math.ceil((saved - Date.now()) / 1000);
      if (Number.isFinite(saved) && remaining > 0 && remaining <= 900) {
        setRetryUntil(saved);
        setRemainingSeconds(remaining);
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Browser storage is optional; the server always enforces the lockout.
    }
  }, []);

  useEffect(() => {
    if (!retryUntil) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (!remaining) {
        setRetryUntil(0);
        try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be disabled. */ }
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [retryUntil]);

  const startCooldown = useCallback((seconds: number) => {
    if (!Number.isInteger(seconds) || seconds <= 0 || seconds > 900) return;
    const deadline = Date.now() + seconds * 1000;
    setRetryUntil(deadline);
    setRemainingSeconds(seconds);
    try { sessionStorage.setItem(STORAGE_KEY, String(deadline)); } catch { /* Server enforcement remains active. */ }
  }, []);

  const countdown = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`;
  return { remainingSeconds, countdown, startCooldown };
}
