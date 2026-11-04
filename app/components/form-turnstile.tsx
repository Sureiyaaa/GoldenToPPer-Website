'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicFormAction } from '@/lib/security/form-turnstile';

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    const script = existing ?? document.createElement('script');
    const cleanup = () => {
      window.clearTimeout(timeout);
      script.removeEventListener('load', loaded);
      script.removeEventListener('error', failed);
    };
    const loaded = () => {
      cleanup();
      if (window.turnstile) resolve();
      else { scriptPromise = null; reject(new Error('Verification unavailable')); }
    };
    const failed = () => {
      cleanup(); scriptPromise = null; reject(new Error('Verification unavailable'));
    };
    const timeout = window.setTimeout(failed, 15000);
    script.addEventListener('load', loaded);
    script.addEventListener('error', failed);
    if (!existing) {
      script.src = SCRIPT_URL; script.async = true; script.defer = true;
      document.head.appendChild(script);
    }
  });
  return scriptPromise;
}

export function useFormTurnstile(action: PublicFormAction) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [size, setSize] = useState<'normal' | 'compact'>('normal');
  const widgetRef = useRef<string | undefined>(undefined);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

  useEffect(() => {
    if (!container) return;
    const measure = () => setSize(container.clientWidth < 300 ? 'compact' : 'normal');
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [container]);

  useEffect(() => {
    if (!container || !siteKey) return;
    let active = true;
    let widgetId: string | undefined;
    setToken(null);
    setError('');
    loadTurnstile().then(() => {
      if (!active) return;
      widgetId = window.turnstile.render(container, {
        sitekey: siteKey, action, theme: 'light', size,
        callback: (response: string) => { if (active) { setToken(response); setError(''); } },
        'expired-callback': () => { if (active) { setToken(null); setError('Verification expired. Please verify again.'); } },
        'error-callback': () => { if (active) { setToken(null); setError('Verification failed. Please try again.'); } },
      });
      widgetRef.current = widgetId;
    }).catch(() => {
      if (active) { setToken(null); setError('Verification could not load. Please refresh and try again.'); }
    });
    return () => {
      active = false;
      widgetRef.current = undefined;
      setToken(null);
      if (widgetId !== undefined) {
        try { window.turnstile?.remove(widgetId); } catch { /* The widget may already be removed. */ }
      }
    };
  }, [container, siteKey, action, size]);

  const getToken = useCallback(() => {
    try {
      const response = widgetRef.current !== undefined ? window.turnstile?.getResponse(widgetRef.current) : '';
      if (response) return response;
    } catch { /* Treat unavailable or expired widgets as unverified. */ }
    setToken(null);
    setError('Please complete the security verification.');
    return null;
  }, []);

  const reset = useCallback(() => {
    setToken(null);
    setError('');
    if (widgetRef.current !== undefined) {
      try { window.turnstile?.reset(widgetRef.current); }
      catch { setError('Verification could not reset. Please refresh and try again.'); }
    }
  }, []);

  return { containerRef: setContainer, token, error, getToken, reset, configured: Boolean(siteKey) };
}

export function FormTurnstile({ verification }: { verification: ReturnType<typeof useFormTurnstile> }) {
  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-2">
      {verification.configured ? (
        <div ref={verification.containerRef} className="flex min-h-[65px] w-full min-w-0 justify-center" aria-label="Security verification" />
      ) : (
        <p role="alert" className="text-center text-sm text-red-600">Security verification is temporarily unavailable. Please try again later.</p>
      )}
      {verification.error && <p role="alert" className="text-center text-sm text-red-600">{verification.error}</p>}
    </div>
  );
}
