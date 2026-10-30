'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Cookie, ShieldCheck, X } from 'lucide-react';
import { readCookiePreferences, serializeCookiePreferences } from '@/lib/cookie-preferences';

type FormNotice = { purpose: string; description: string };
type ConsentContext = {
  optionalMedia: boolean;
  openSettings: () => void;
  requestFormConsent: (notice: FormNotice) => Promise<boolean>;
};

const Context = createContext<ConsentContext | null>(null);

export function useCookieConsent() {
  const context = useContext(Context);
  if (!context) throw new Error('Cookie consent requires CookieConsentProvider.');
  return context;
}

export default function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [optionalMedia, setOptionalMedia] = useState(false);
  const [request, setRequest] = useState<{ notice?: FormNotice } | null>(null);
  const [draftMedia, setDraftMedia] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resolver = useRef<((accepted: boolean) => void) | null>(null);
  const activeRequest = useRef(false);
  const pathname = usePathname();

  useEffect(() => {
    setOptionalMedia(readCookiePreferences(document.cookie)?.optionalMedia ?? false);
  }, []);

  const dismiss = useCallback(() => {
    resolver.current?.(false);
    resolver.current = null;
    activeRequest.current = false;
    setRequest(null);
  }, []);

  // Cancel pending submissions when navigating away, including browser Back.
  useEffect(() => { dismiss(); }, [pathname, dismiss]);
  useEffect(() => () => { resolver.current?.(false); }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!request || !dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [request]);

  const begin = useCallback((notice?: FormNotice) => {
    if (activeRequest.current) return false;
    activeRequest.current = true;
    setDraftMedia(optionalMedia);
    setAcknowledged(false);
    setRequest({ notice });
    return true;
  }, [optionalMedia]);

  const requestFormConsent = useCallback((notice: FormNotice) => {
    return new Promise<boolean>((resolve) => {
      if (!begin(notice)) { resolve(false); return; }
      resolver.current = resolve;
    });
  }, [begin]);

  const save = (allowMedia: boolean) => {
    if (request?.notice && !acknowledged) return;
    // Cookie choices contain no form data, names, contact details, or authentication tokens.
    // If cookies are blocked, retain the choice in memory for the current page.
    try { document.cookie = serializeCookiePreferences(allowMedia, window.location.protocol === 'https:'); } catch { /* Browser storage may be unavailable. */ }
    setOptionalMedia(allowMedia);
    resolver.current?.(true);
    resolver.current = null;
    activeRequest.current = false;
    setRequest(null);
  };

  const needsAcknowledgement = Boolean(request?.notice) && !acknowledged;
  const buttonClass = 'rounded-md border border-brand-blue px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <Context.Provider value={{ optionalMedia, openSettings: () => { begin(); }, requestFormConsent }}>
      {children}
      <dialog ref={dialogRef} aria-labelledby="cookie-consent-title" aria-describedby="cookie-consent-description"
        onCancel={(event) => { event.preventDefault(); dismiss(); }}
        className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-xl border border-brand-gold/30 bg-white p-0 text-gray-700 shadow-2xl backdrop:bg-black/65"
        data-lenis-prevent>
        {request && (
          <div className="p-6 sm:p-8">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <Cookie className="mb-3 text-brand-gold" aria-hidden="true" size={30} />
                <h2 id="cookie-consent-title" className="text-2xl font-semibold text-brand-blue">Cookies &amp; your privacy</h2>
              </div>
              <button type="button" onClick={dismiss} aria-label="Close without continuing" className="rounded p-2 text-gray-500 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-blue"><X size={22} /></button>
            </div>
            <p id="cookie-consent-description" className="text-sm leading-relaxed">
              Choose which cookies and third-party content you allow. Optional media is not required to submit a form. Your cookie choice is remembered for this browser session.
            </p>
            <div className="my-5 space-y-3">
              <div className="rounded-lg border border-gray-200 bg-slate-50 p-4 text-sm">
                <div className="flex items-center justify-between gap-3 font-semibold text-brand-blue"><span>Necessary cookies</span><span className="text-xs">Always available</span></div>
                <p className="mt-2 leading-relaxed">The preference cookie remembers this choice. A separate authentication cookie is used only when an administrator signs in.</p>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4 text-sm">
                <input type="checkbox" checked={draftMedia} onChange={(event) => setDraftMedia(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-brand-blue" />
                <span><span className="font-semibold text-brand-blue">Optional videos &amp; maps</span><span className="mt-1 block leading-relaxed">Allow YouTube videos, video thumbnails, and Google map tiles. These services receive connection information and may use their own cookies. Disabled until you allow them.</span></span>
              </label>
            </div>
            {request.notice && (
              <section className="mb-5 rounded-lg border border-brand-gold/40 bg-[#FDFBF7] p-4 text-sm">
                <h3 className="flex items-center gap-2 font-semibold text-brand-blue"><ShieldCheck size={18} aria-hidden="true" />{request.notice.purpose}</h3>
                <p className="mt-2 leading-relaxed">{request.notice.description}</p>
                <label className="mt-4 flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-brand-blue" />
                  <span>I have read the privacy notice and understand how my information will be used for this request. This does not opt me into marketing.</span>
                </label>
                <p className="mt-3 text-xs">Review our <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="font-medium text-brand-blue underline">Privacy Policy (new tab)</a> and <a href="/cookie-notice" target="_blank" rel="noopener noreferrer" className="font-medium text-brand-blue underline">Cookie Notice (new tab)</a>.</p>
              </section>
            )}
            <div className="flex flex-col gap-3">
              <button type="button" disabled={needsAcknowledgement} onClick={() => save(false)} className={`${buttonClass} bg-white text-brand-blue hover:bg-slate-50`}>Necessary cookies only{request.notice ? ' & continue' : ''}</button>
              <button type="button" disabled={needsAcknowledgement} onClick={() => save(draftMedia)} className={`${buttonClass} bg-brand-blue text-white hover:bg-[#0e2459]`}>Accept selected cookies{request.notice ? ' & continue' : ''}</button>
              <button type="button" onClick={dismiss} className="rounded py-2 text-sm text-gray-600 underline focus-visible:outline-2 focus-visible:outline-brand-blue">{request.notice ? 'Cancel and return to form' : 'Close without saving'}</button>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-gray-500">Change your choice anytime using Cookie settings. No optional analytics or advertising scripts are enabled by this form.</p>
          </div>
        )}
      </dialog>
    </Context.Provider>
  );
}

export function CookieSettingsButton({ className = '' }: { className?: string }) {
  const { openSettings } = useCookieConsent();
  return <button type="button" onClick={openSettings} className={`underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold ${className}`}>Cookie settings</button>;
}

export function FormPrivacyNotice() {
  return <p className="mt-3 text-center text-xs leading-relaxed text-gray-500">Before submitting, you can review the privacy notice and choose your cookies. <CookieSettingsButton className="text-brand-blue" /></p>;
}

export function OptionalMediaNotice() {
  const { openSettings } = useCookieConsent();
  return (
    <div className="flex min-h-0 h-full w-full flex-col items-center justify-center gap-3 bg-slate-100 px-4 py-4 text-center text-brand-blue">
      <ShieldCheck size={24} className="shrink-0" aria-hidden="true" />
      <p className="max-w-sm text-sm leading-relaxed">Allow optional media to view videos and maps.</p>
      <button type="button" onClick={openSettings} className="shrink-0 rounded-md border border-brand-blue px-5 py-2 text-sm font-semibold hover:bg-brand-blue hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold">Choose cookie settings</button>
    </div>
  );
}
