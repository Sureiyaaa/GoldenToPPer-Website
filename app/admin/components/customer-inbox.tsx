'use client';

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Building2, CheckCircle2, CornerUpLeft, Landmark, Loader2, Mail, MailOpen, RefreshCw, Search, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { fetchNotificationsAction, toggleNotificationReadAction } from '@/app/actions/admin_fetchers';
import {
  customerInboxContext, customerInboxKey, customerInboxReplyHref, customerInboxTypeLabels,
  filterCustomerInbox, formatCustomerInboxDate,
  type CustomerInboxItem, type CustomerInboxItemType, type CustomerInboxReadFilter,
} from '@/lib/customer-inbox';

const focusStyle = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2';
const typeStyles: Record<CustomerInboxItemType, string> = {
  inquiry: 'bg-brand-blue/5 text-brand-blue',
  loan_application: 'bg-brand-gold/15 text-brand-blue',
  customer_support: 'bg-gray-100 text-gray-600',
};
const typeIcons = { inquiry: Building2, loan_application: Landmark, customer_support: Mail };

type InboxState = {
  items: CustomerInboxItem[]; isLoading: boolean; error: string; readError: string;
  liveUnavailable: boolean; pendingKeys: Set<string>; unreadCount: number;
  refresh: () => Promise<void>; openItem: (item: CustomerInboxItem) => void;
  toggleRead: (item: CustomerInboxItem) => Promise<void>;
};
const InboxContext = createContext<InboxState | null>(null);
function useCustomerInbox() {
  const context = useContext(InboxContext);
  if (!context) throw new Error('Customer Inbox must be inside its provider.');
  return context;
}

export function CustomerInboxProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [items, setItems] = useState<CustomerInboxItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [readError, setReadError] = useState('');
  const [liveUnavailable, setLiveUnavailable] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const mounted = useRef(false);
  const pending = useRef(new Set<string>());
  const mutationVersion = useRef(0);
  const refreshAgain = useRef(false);
  const inFlight = useRef<Promise<void> | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  // One fetch stream for the bell and workspace. Coalesce realtime bursts and
  // discard a fetch that started before a successful read-state mutation.
  const refresh = useCallback((): Promise<void> => {
    if (!enabled || !mounted.current) return Promise.resolve();
    if (inFlight.current) {
      refreshAgain.current = true;
      return inFlight.current;
    }
    setIsLoading(true);
    const request = async () => {
      try {
        do {
          refreshAgain.current = false;
          const version = mutationVersion.current;
          const data = await fetchNotificationsAction();
          if (!mounted.current) return;
          if (version === mutationVersion.current) {
            setItems(data);
            setError('');
          } else {
            refreshAgain.current = true;
          }
        } while (refreshAgain.current && mounted.current);
      } catch {
        if (mounted.current) setError('Could not load customer messages. Please try refreshing.');
      } finally {
        inFlight.current = null;
        if (mounted.current) setIsLoading(false);
      }
    };
    inFlight.current = request();
    return inFlight.current;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    mounted.current = true;
    void refresh();
    const channel = supabase.channel('customer-inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inquire' }, () => void refresh())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contact' }, () => void refresh())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'loan_preapp' }, () => void refresh())
      .subscribe(status => {
        if (mounted.current) setLiveUnavailable(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED');
      });
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      mounted.current = false;
      window.removeEventListener('focus', onFocus);
      void supabase.removeChannel(channel);
    };
  }, [enabled, refresh, supabase]);

  const setRead = useCallback(async (item: CustomerInboxItem, isRead: boolean) => {
    const key = customerInboxKey(item);
    if (!enabled || !item.can_mark_read || pending.current.has(key)) return;
    pending.current.add(key);
    setPendingKeys(new Set(pending.current));
    setReadError('');
    try {
      await toggleNotificationReadAction(item.id, item.type, isRead);
      mutationVersion.current += 1;
      if (mounted.current) setItems(current => current.map(record =>
        customerInboxKey(record) === key ? { ...record, is_read: isRead } : record));
    } catch {
      if (mounted.current) setReadError('Could not save read status. Please try again.');
    } finally {
      pending.current.delete(key);
      if (mounted.current) setPendingKeys(new Set(pending.current));
    }
  }, [enabled]);

  const openItem = (item: CustomerInboxItem) => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedKey(customerInboxKey(item));
    setReadError('');
    if (!item.is_read && item.can_mark_read) void setRead(item, true);
  };
  const closeItem = () => {
    setSelectedKey(null);
    const target = returnFocus.current;
    requestAnimationFrame(() => {
      if (target?.isConnected) target.focus();
      else document.querySelector<HTMLButtonElement>('[data-customer-inbox-bell]')?.focus();
    });
  };
  const selected = items.find(item => customerInboxKey(item) === selectedKey);
  const value: InboxState = {
    items, isLoading, error, readError, liveUnavailable, pendingKeys,
    unreadCount: items.filter(item => !item.is_read).length,
    refresh, openItem, toggleRead: item => setRead(item, !item.is_read),
  };
  return (
    <InboxContext.Provider value={value}>
      {children}
      {enabled && selected && <CustomerMessageDialog item={selected} onClose={closeItem} />}
    </InboxContext.Provider>
  );
}

function TypeBadge({ item }: { item: CustomerInboxItem }) {
  return <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold ${typeStyles[item.type]}`}>{customerInboxTypeLabels[item.type]}</span>;
}
function ReadBadge({ item }: { item: CustomerInboxItem }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold ${item.is_read ? 'bg-gray-100 text-gray-500' : 'bg-brand-blue/5 text-brand-blue'}`}>
      {item.is_read ? 'Read' : 'Unread'}{!item.can_mark_read && <span className="font-normal"> · untracked</span>}
    </span>
  );
}
function ReadButton({ item, compact = false }: { item: CustomerInboxItem; compact?: boolean }) {
  const { toggleRead, pendingKeys } = useCustomerInbox();
  if (!item.can_mark_read) return null;
  const label = item.is_read ? 'Mark Unread' : 'Mark Read';
  return (
    <button type="button" onClick={() => void toggleRead(item)} disabled={pendingKeys.has(customerInboxKey(item))}
      aria-label={`${label}: ${item.title}`} title={label}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg p-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-brand-blue disabled:opacity-50 ${focusStyle}`}>
      {pendingKeys.has(customerInboxKey(item)) ? <Loader2 size={16} className="animate-spin" /> : item.is_read ? <MailOpen size={16} /> : <Mail size={16} />}
      {!compact && label}
    </button>
  );
}
function InboxError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
      <p>{message}</p>
      {onRetry && <button type="button" onClick={onRetry} className={`rounded-lg px-3 py-2 text-xs font-bold text-brand-blue hover:bg-gray-100 ${focusStyle}`}>Try again</button>}
    </div>
  );
}

export function NotificationCenter() {
  const { items, isLoading, error, readError, unreadCount, refresh, openItem } = useCustomerInbox();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownId = useId();
  const router = useRouter();
  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);
  return (
    <div className="relative" ref={dropdownRef} onKeyDown={event => {
      if (event.key === 'Escape') { setIsOpen(false); dropdownRef.current?.querySelector('button')?.focus(); }
    }}>
      <button type="button" data-customer-inbox-bell aria-label={`Customer notifications, ${unreadCount} unread`}
        aria-expanded={isOpen} aria-controls={dropdownId}
        onClick={() => { setIsOpen(current => !current); if (!isOpen) void refresh(); }}
        className={`relative rounded-full p-2.5 text-brand-blue transition-all hover:bg-gray-50 hover:shadow-sm ${focusStyle}`}>
        <Bell size={22} />
        {unreadCount > 0 && <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-brand-blue px-0.5 text-[9px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>
      {isOpen && (
        <div id={dropdownId} className="absolute right-0 z-50 mt-3 w-[min(400px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl shadow-black/10">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-5 py-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand-blue">Inbox</h2>
            <span className="rounded-full bg-brand-gold/10 px-2 py-0.5 text-[10px] font-bold text-brand-blue">{unreadCount} Unread</span>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {error && <div className="p-3"><InboxError message={error} onRetry={() => void refresh()} /></div>}
            {readError && <div className="p-3"><InboxError message={readError} /></div>}
            {isLoading && items.length === 0 ? (
              <div role="status" className="flex items-center justify-center gap-2 p-8 text-sm text-brand-blue"><Loader2 size={20} className="animate-spin" /> Loading messages...</div>
            ) : !error && items.length === 0 ? (
              <div className="p-10 text-center"><CheckCircle2 size={32} className="mx-auto mb-3 text-brand-blue/30" /><p className="text-sm font-medium text-brand-blue">No customer messages yet</p></div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {items.slice(0, 20).map(item => {
                  const Icon = typeIcons[item.type];
                  return (
                    <li key={customerInboxKey(item)} className={`flex items-center gap-2 p-3 ${item.is_read ? 'bg-gray-50/50' : 'bg-white'}`}>
                      <button type="button" onClick={() => { setIsOpen(false); openItem(item); }}
                        className={`flex min-w-0 flex-1 gap-3 rounded-lg p-1 text-left hover:bg-gray-50 ${focusStyle}`}>
                        <span className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${typeStyles[item.type]}`}><Icon size={14} /></span>
                        <span className="min-w-0">
                          <span className={`block truncate text-xs text-brand-blue ${item.is_read ? 'font-medium' : 'font-bold'}`}>{item.title}</span>
                          <span className="mt-1 block truncate text-xs text-gray-600">{item.name}</span>
                          <span className="mt-1 block text-[10px] text-gray-400">{customerInboxTypeLabels[item.type]} · {formatCustomerInboxDate(item.created_at)}</span>
                          {!item.can_mark_read && <span className="mt-1 block text-[10px] text-gray-500">Read status unavailable</span>}
                        </span>
                      </button>
                      <ReadButton item={item} compact />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="border-t border-gray-100 bg-gray-50 p-3">
            <button type="button" onClick={() => { setIsOpen(false); router.push('/admin/dashboard?section=Customer%20Inbox'); }}
              className={`w-full rounded-lg py-2 text-xs font-bold uppercase tracking-widest text-brand-blue hover:bg-gray-100 ${focusStyle}`}>Open Customer Inbox</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CustomerInboxManager() {
  const { items, isLoading, error, readError, liveUnavailable, unreadCount, refresh, openItem } = useCustomerInbox();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<CustomerInboxItemType | 'all'>('all');
  const [read, setRead] = useState<CustomerInboxReadFilter>('all');
  const filtered = filterCustomerInbox(items, search, type, read);
  const searchId = useId();
  const typeId = useId();
  const readId = useId();
  const hasLoans = items.some(item => !item.can_mark_read);
  const openButton = (item: CustomerInboxItem) => (
    <button type="button" onClick={() => openItem(item)} aria-label={`Open ${customerInboxTypeLabels[item.type]} from ${item.name}`}
      className={`rounded-lg bg-brand-blue px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-brand-blue/80 ${focusStyle}`}>Open</button>
  );
  return (
    <section className="mx-auto w-full max-w-6xl animate-in fade-in duration-300" aria-labelledby="customer-inbox-title">
      <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-gold">Customer · Communications</p>
          <h2 id="customer-inbox-title" className="mt-2 font-serif text-4xl leading-none text-brand-blue">Customer Inbox</h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">Review property inquiries, loan applications, and customer support messages received from the website.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-widest" aria-live="polite">
          <span className="rounded-full border border-gray-200 bg-white px-3 py-2 text-gray-500">{items.length} Total records</span>
          <span className="rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 py-2 text-brand-blue">{unreadCount} Unread</span>
        </div>
      </div>
      <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1 sm:min-w-52">
            <label htmlFor={searchId} className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Search messages</label>
            <div className="relative"><Search size={16} className="absolute left-3 top-3 text-gray-400" aria-hidden="true" />
              <input id={searchId} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, email, project, bank or message"
                className={`w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm text-gray-700 ${focusStyle}`} />
            </div>
          </div>
          <div>
            <label htmlFor={typeId} className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Type</label>
            <select id={typeId} value={type} onChange={event => setType(event.target.value as CustomerInboxItemType | 'all')}
              className={`w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 ${focusStyle}`}>
              <option value="all">All types</option>
              {Object.entries(customerInboxTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={readId} className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Read status</label>
            <select id={readId} value={read} onChange={event => setRead(event.target.value as CustomerInboxReadFilter)}
              className={`w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 ${focusStyle}`}>
              <option value="all">All statuses</option><option value="unread">Unread</option><option value="read">Read</option>
            </select>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={isLoading}
            className={`inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-bold text-brand-blue hover:bg-gray-50 disabled:opacity-50 ${focusStyle}`}>
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>
      <div className="mb-4 space-y-3">
        {error && <InboxError message={error} onRetry={() => void refresh()} />}
        {readError && <InboxError message={readError} />}
        {hasLoans && <p className="text-xs leading-relaxed text-gray-500">Read status is unavailable for loan applications. Opening one leaves it unread.</p>}
        {liveUnavailable && <p role="status" className="text-xs text-gray-500">Live updates are unavailable. Use Refresh to check for new messages.</p>}
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm" aria-busy={isLoading}>
        {isLoading && items.length === 0 ? (
          <div role="status" className="flex items-center justify-center gap-3 p-12 text-sm text-brand-blue"><Loader2 size={22} className="animate-spin" /> Loading customer messages...</div>
        ) : filtered.length === 0 ? (
          <div role="status" className="px-6 py-16 text-center">
            <Mail size={32} className="mx-auto mb-4 text-brand-blue/30" />
            <h3 className="font-serif text-xl text-brand-blue">{error && items.length === 0 ? 'Customer messages unavailable' : items.length === 0 ? 'No customer messages yet' : 'No matching messages'}</h3>
            {items.length > 0 && <p className="mt-2 text-sm text-gray-500">Try another search or change your filters.</p>}
          </div>
        ) : (
          <>
            <table className="hidden w-full table-fixed text-left lg:table">
              <caption className="sr-only">Customer messages, newest first</caption>
              <colgroup><col className="w-[23%]" /><col className="w-[15%]" /><col className="w-[23%]" /><col className="w-[17%]" /><col className="w-[14%]" /><col className="w-[8%]" /></colgroup>
              <thead className="border-b border-gray-100 bg-gray-50/70 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <tr>{['Sender', 'Type', 'Subject / Context', 'Received', 'Status', 'Action'].map(label => <th key={label} scope="col" className="px-4 py-4">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(item => (
                  <tr key={customerInboxKey(item)} className={item.is_read ? '' : 'bg-brand-blue/[0.02]'}>
                    <td className="break-words px-4 py-5"><p className={`text-sm text-brand-blue ${item.is_read ? 'font-medium' : 'font-bold'}`}>{item.name}</p><p className="mt-1 break-all text-xs text-gray-500">{item.client_email || 'Email not provided'}</p></td>
                    <td className="px-4 py-5"><TypeBadge item={item} /></td>
                    <td className="break-words px-4 py-5"><p className={`text-sm text-gray-700 ${item.is_read ? '' : 'font-semibold'}`}>{customerInboxContext(item)}</p></td>
                    <td className="px-4 py-5 text-xs leading-relaxed text-gray-500">{formatCustomerInboxDate(item.created_at)}</td>
                    <td className="px-4 py-5"><ReadBadge item={item} /></td>
                    <td className="px-2 py-5">{openButton(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-gray-100 lg:hidden">
              {filtered.map(item => (
                <li key={customerInboxKey(item)} className={`space-y-3 p-4 sm:p-5 ${item.is_read ? '' : 'bg-brand-blue/[0.02]'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2"><TypeBadge item={item} /><ReadBadge item={item} /></div>
                  <div className="min-w-0"><h3 className={`break-words text-sm text-brand-blue ${item.is_read ? 'font-medium' : 'font-bold'}`}>{item.name}</h3><p className="mt-1 break-all text-xs text-gray-500">{item.client_email || 'Email not provided'}</p><p className={`mt-2 break-words text-sm text-gray-700 ${item.is_read ? '' : 'font-semibold'}`}>{customerInboxContext(item)}</p></div>
                  <div className="flex items-center justify-between gap-3"><p className="text-xs text-gray-500">{formatCustomerInboxDate(item.created_at)}</p>{openButton(item)}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <p role="status" className="mt-3 text-xs text-gray-400">Showing {filtered.length} of {items.length} records · Newest first · Times in Manila</p>
    </section>
  );
}

function CustomerMessageDialog({ item, onClose }: { item: CustomerInboxItem; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { readError } = useCustomerInbox();
  const replyHref = customerInboxReplyHref(item);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  const detail = (label: string, value: string | number | null) => (
    <div key={label}><dt className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</dt><dd className="break-words text-sm font-semibold text-gray-800">{value ?? 'Not provided'}</dd></div>
  );
  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} onCancel={onClose}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex="0"]')]
          .filter(control => !control.matches(':disabled') && control.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-brand-blue/60 backdrop:backdrop-blur-sm md:rounded-3xl">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-4 py-4 sm:px-8">
          <TypeBadge item={item} />
          <div className="flex items-center gap-2"><ReadButton item={item} />
            <button type="button" onClick={onClose} aria-label="Close message details" className={`rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 ${focusStyle}`}><X size={20} /></button>
          </div>
        </div>
        <div className="space-y-5 p-4 sm:p-8">
          <h2 id={titleId} className="break-words font-serif text-2xl text-brand-blue">{item.title}</h2>
          {readError && <InboxError message={readError} />}
          <dl className="grid gap-5 rounded-2xl bg-gray-50 p-5 sm:grid-cols-2">
            {detail('Client Name', item.name)}{detail('Email', item.client_email)}{detail('Phone', item.client_phone)}{detail('Date Received (Manila)', formatCustomerInboxDate(item.created_at))}
          </dl>
          {item.type === 'customer_support' ? (
            <div className="space-y-3"><dl>{detail('Type of Inquiry', item.title)}</dl><p className="whitespace-pre-wrap break-words rounded-xl border border-gray-100 p-5 text-sm leading-relaxed text-gray-800">{item.message || 'No message provided.'}</p></div>
          ) : item.type === 'inquiry' ? (
            <div className="space-y-3"><dl>{detail('Project', item.project_name)}</dl><p className="rounded-xl border border-gray-100 p-5 text-sm leading-relaxed text-gray-800">This customer requested more information about <strong>{item.project_name}</strong>. Contact them using the details above.</p></div>
          ) : (
            <div className="space-y-4">
              <dl className="grid gap-5 rounded-xl border border-gray-100 p-5 sm:grid-cols-2">
                {detail('Project', item.project_name)}{detail('Preferred Bank', item.bank_name)}{detail('Tower', item.tower)}{detail('Unit', item.unit_no)}{detail('Floor', item.floor_no)}{detail('Co-buyer', item.co_buyer_name)}{detail('Terms Agreement', item.is_agreed === null ? 'Not provided' : item.is_agreed ? 'Agreed' : 'Not agreed')}
              </dl>
              <p className="text-xs text-gray-500">Read status is unavailable for loan applications. Opening this record leaves it unread.</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-4 py-5 sm:px-8">
          <ReadBadge item={item} />
          {replyHref ? <a href={replyHref} onClick={onClose} className={`inline-flex items-center justify-center gap-2 rounded-xl bg-brand-blue px-5 py-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-brand-blue/80 ${focusStyle}`}><CornerUpLeft size={16} /> Reply via Email</a> : <span className="text-xs text-gray-500">Reply unavailable: no valid email provided.</span>}
        </div>
      </div>
    </dialog>
  );
}