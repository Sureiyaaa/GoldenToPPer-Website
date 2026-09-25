// app/admin/dashboard/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import {
  fetchLiveHomepageAdminDataAction,
  saveHomepageSettingsAction,
  upsertHomepageRowAction,
  toggleHomepageRowStatusAction,
  deleteHomepageRowAction,
} from '@/app/actions/homepage';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import {
  LogOut, Building2, Landmark, LayoutDashboard, Search, Filter,
  Edit2, Archive, Plus, Loader2, Eye, EyeOff, History, Move3d, Newspaper, House,
  Bell, CheckCircle2, X, Mail, MailOpen, CornerUpLeft, Menu, UserCircle2, Megaphone, Settings, ShieldAlert, AlertCircle, BookOpen, Upload, ChevronDown, GripVertical, ArrowUpRight
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { toggleActiveStatus, archiveRecord } from '@/app/actions/updates';
import {
  fetchAdminProjectsList,
  fetchArchivedProjectsList,
  archiveProjectAction,
  restoreArchivedProjectAction,
  ensureProjectNavigationEntriesAction,
  setProjectWebsiteVisibilityAction,
} from '@/app/actions/projects';
import {
  fetchAdminVirtualToursList,
  fetchAdminPromotionsList,
  fetchAdminBanksList,
  fetchAdminStoryList,
  fetchArchivedCmsRecordsAction,
  restoreArchivedCmsRecordAction,
  createAuditLogAction,
  fetchRecentAuditLogsAction,
  fetchDetailedAuditLogsAction,
  deleteAuditLogAction,
  fetchNotificationsAction,
  fetchWebsiteSectionStatesAction,
  saveWebsiteSectionStatesAction,
  toggleNotificationReadAction
} from '@/app/actions/admin_fetchers';
import { getCustomSession, getCurrentUser, logoutAction, getRBACProfile } from '@/app/actions/auth';


// --- SCHEMAS & TYPES ---
const NewsArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string().nullish().transform(value => value ?? ''),
  date: z.string().nullish().transform(value => value ?? ''),
  slug: z.string().nullish().transform(value => value ?? ''),
  excerpt: z.string().nullish().transform(value => value ?? ''),
  image: z.string().nullish().transform(value => value ?? ''),
  created_at: z.string().nullish(),
  is_active: z.boolean().nullish().transform(value => value === true),
});
type NewsArticle = z.infer<typeof NewsArticleSchema>;
interface Project {
  id: number;
  title: string;
  city: string;
  status: string;
  is_active: boolean;
  image: string;
  slug?: string | null;
  deleted_at?: string | null;
}
interface Bank { id: number; bank_name: string; max_loan: string; terms: string; image: string; is_active: boolean; }
interface AuditLog {
  id: number; created_at: string; user_email: string; action_type: string;
  entity_type: string; entity_name: string; details: string;
  actor_id?: string | null; entity_id?: string | null; parent_entity_id?: string | null;
  field_key?: string | null; old_value?: unknown; new_value?: unknown; target_url?: string | null;
}

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

// ==========================================
// NOTIFICATION CENTER COMPONENT
// ==========================================
function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<any | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    setIsLoading(true);
    const user = await getCurrentUser();
    if (!user) return;

    try {
      // ✅ SECURE SERVER ACTION FETCH (Bypasses RLS)
      const data = await fetchNotificationsAction(user.id);
      setNotifications(data || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inquire' }, () => fetchNotifications())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contact' }, () => fetchNotifications())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const toggleReadStatus = async (e: React.MouseEvent, notif: any) => {
    e.stopPropagation();
    const newStatus = !notif.is_read;
    const user = await getCurrentUser();
    if (!user) return;

    setNotifications(prev => prev.map(n => n.id === notif.id && n.type === notif.type ? { ...n, is_read: newStatus } : n));
    if (selectedMessage && selectedMessage.id === notif.id && selectedMessage.type === notif.type) {
      setSelectedMessage({ ...selectedMessage, is_read: newStatus });
    }

    // ✅ SECURE SERVER ACTION UPDATE (Bypasses RLS)
    await toggleNotificationReadAction(user.id, notif.id, notif.type, newStatus);
  };

  const handleOpenMessage = async (notif: any) => {
    setSelectedMessage(notif);
    setIsOpen(false);

    if (!notif.is_read) {
      const user = await getCurrentUser();
      if (!user) return;

      setNotifications(prev => prev.map(n => n.id === notif.id && n.type === notif.type ? { ...n, is_read: true } : n));
      setSelectedMessage({ ...notif, is_read: true });

      // ✅ SECURE SERVER ACTION UPDATE (Bypasses RLS)
      await toggleNotificationReadAction(user.id, notif.id, notif.type, true);
    }
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => { setIsOpen(!isOpen); if (!isOpen) fetchNotifications(); }}
          className="relative p-2.5 text-brand-blue hover:bg-[#f8f9fa] hover:shadow-sm rounded-full transition-all outline-none"
        >
          <Bell size={22} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full border-2 border-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-3 w-[300px] sm:w-[400px] bg-white rounded-2xl shadow-2xl shadow-black/10 border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-[#f8f9fa]">
              <h3 className="text-xs font-bold text-brand-blue tracking-widest uppercase">Inbox</h3>
              {unreadCount > 0 && <span className="text-[10px] font-bold px-2 py-0.5 bg-brand-gold/10 text-brand-gold rounded-full">{unreadCount} Unread</span>}
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {isLoading ? (
                <div className="flex justify-center items-center p-8"><Loader2 className="animate-spin text-brand-blue" size={24} /></div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-10 text-gray-400">
                  <CheckCircle2 size={36} className="mb-3 text-green-400/50" />
                  <p className="text-sm font-medium text-brand-blue">Inbox Empty</p>
                  <p className="text-xs mt-1">No messages recorded yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 flex flex-col">
                  {notifications.map((notif) => (
                    <div
                      key={`${notif.type}-${notif.id}`}
                      onClick={() => handleOpenMessage(notif)}
                      className={`w-full text-left p-4 cursor-pointer transition-colors flex gap-3 sm:gap-4 group relative ${!notif.is_read ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 hover:bg-gray-100'}`}
                    >
                      <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${notif.type === 'inquiry' ? 'bg-brand-blue/10 text-brand-blue' : 'bg-brand-gold/10 text-brand-gold'}`}>
                        {notif.type === 'inquiry' ? <Building2 size={14} /> : <Mail size={14} />}
                      </div>
                      <div className="flex-1 min-w-0 pr-8">
                        <p className={`text-xs truncate mb-0.5 ${!notif.is_read ? 'font-bold text-brand-blue' : 'font-semibold text-gray-600'}`}>{notif.title}</p>
                        <p className={`text-xs sm:text-sm truncate ${!notif.is_read ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                          {notif.name} sent a message.
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1.5 uppercase tracking-wider font-semibold">
                          {formatDateTime(notif.created_at)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => toggleReadStatus(e, notif)}
                        className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all shrink-0 ${!notif.is_read ? 'text-brand-blue bg-brand-blue/5 hover:bg-brand-blue/10' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 opacity-100 sm:opacity-0 group-hover:opacity-100'}`}
                        title={notif.is_read ? "Mark as Unread" : "Mark as Read"}
                      >
                        {notif.is_read ? <MailOpen size={16} /> : <Mail size={16} className="fill-current" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reading Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-brand-blue/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5 border-b border-gray-100 bg-[#f8f9fa]">
              <div className="flex items-center gap-3">
                <span className="inline-block px-2 sm:px-3 py-1 bg-white border border-gray-200 text-brand-blue rounded-md text-[10px] font-bold tracking-widest uppercase truncate max-w-[150px] sm:max-w-none">
                  {selectedMessage.title}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={(e) => toggleReadStatus(e, selectedMessage)} className="hidden sm:flex px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-brand-blue hover:bg-gray-100 rounded-md transition-colors items-center gap-2">
                  {selectedMessage.is_read ? <MailOpen size={14} /> : <Mail size={14} />}
                  {selectedMessage.is_read ? 'Mark Unread' : 'Mark Read'}
                </button>
                <div className="hidden sm:block w-px h-4 bg-gray-300 mx-1"></div>
                <button onClick={() => setSelectedMessage(null)} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-8 overflow-y-auto">
              <h2 className="text-xl sm:text-2xl font-serif text-brand-blue pl-4 sm:pl-6">Message Details</h2>
              <div className="bg-gray-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-6 flex flex-col sm:flex-row flex-wrap gap-4 sm:gap-6">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Client Name</div>
                  <div className="text-sm font-semibold text-gray-900">{selectedMessage.name}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Email</div>
                  <div className="text-sm font-semibold text-blue-600 break-all">{selectedMessage.client_email || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Phone</div>
                  <div className="text-sm font-semibold text-gray-900">{selectedMessage.client_phone || 'N/A'}</div>
                </div>
                <div className="w-full mt-2 pt-4 border-t border-gray-200">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Date Received</div>
                  <div className="text-sm text-gray-600">{formatDateTime(selectedMessage.created_at)}</div>
                </div>
              </div>
              <div className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap bg-white border border-gray-100 p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm">
                {selectedMessage.type === 'inquiry' ? (
                  <>I am interested in getting more information about the property <strong>{selectedMessage.title.replace('Inquiry: ', '')}</strong>. Please contact me at your earliest convenience.</>
                ) : (
                  <>{selectedMessage.message}</>
                )}
              </div>
            </div>
            <div className="px-4 sm:px-8 py-4 sm:py-5 border-t border-gray-100 bg-gray-50 flex justify-end">
              <a
                href={`mailto:${selectedMessage.client_email}?subject=RE: ${selectedMessage.title}`}
                onClick={() => setSelectedMessage(null)}
                className="flex items-center justify-center w-full sm:w-auto gap-2 px-6 py-3 sm:py-2.5 bg-brand-blue text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-brand-blue/80 transition-colors"
              >
                <CornerUpLeft size={16} /> Reply via Email
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ==========================================
// MANAGER COMPONENTS
// ==========================================

interface ManagerProps {
  checkPerm: (moduleCode: string, action: string) => boolean;
}

function ProjectsManager({ checkPerm }: ManagerProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [projectToArchive, setProjectToArchive] = useState<{ id: number, title: string } | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
    const openProject = (id: number) => {
          router.push(`/admin/projects?edit=${id}`);
        };

        const openNavigationSetup = () => {
          router.push('/admin/dashboard?section=Navbar%20Setup');
        };

        const openArchivedProjects = () => {
          router.push('/admin/dashboard?section=Archived%20Projects');
        };

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await fetchAdminProjectsList();
        setProjects(data || []);
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const handleArchiveClick = (id: number, title: string) => {
    setProjectToArchive({ id, title });
  };

  const confirmArchive = async () => {
    if (!projectToArchive) return;
    setIsArchiving(true);

    try {
      await archiveProjectAction(projectToArchive.id);

      await createAuditLogAction(
        'DELETE',
        'Projects',
        projectToArchive.title,
        'Archived project. Removed it from active CMS views and hid its linked navigation item while retaining project data for recovery.',
        { entityId: projectToArchive.id, fieldKey: 'is_active' }
      );

      const archivedTitle = projectToArchive.title;
      setProjects(prevProjects => prevProjects.filter(p => p.id !== projectToArchive.id));
      setProjectToArchive(null);
      setSuccessMessage(`Project "${archivedTitle}" archived.`);
      setTimeout(() => setSuccessMessage(''), 2500);

    } catch (error: any) {
      alert(`Failed to archive project: ${error.message}`);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleToggleProject = async (id: number, currentStatus: boolean, title: string) => {
    const nextStatus = !currentStatus;

    try {
      await setProjectWebsiteVisibilityAction(id, nextStatus);

      await createAuditLogAction(
        'EDIT',
        'Projects',
        title,
        nextStatus
          ? 'Changed project website visibility to Visible. Linked navigation now follows its saved visibility preference.'
          : 'Changed project website visibility to Hidden. Linked navigation is automatically hidden while preserving its saved visibility preference.',
        { entityId: id, fieldKey: 'is_active', oldValue: currentStatus, newValue: nextStatus }
      );

      setProjects(prev =>
        prev.map(p =>
          p.id === id
            ? { ...p, is_active: nextStatus }
            : p
        )
      );
    } catch (error: any) {
      alert(`Failed to update project visibility: ${error.message}`);
    }
  };

  const filteredProjects = projects.filter(proj => proj.title.toLowerCase().includes(searchQuery.toLowerCase()) || proj.city.toLowerCase().includes(searchQuery.toLowerCase()));
  const visibleProjectCount = projects.filter(proj => proj.is_active).length;
  const hiddenProjectCount = projects.length - visibleProjectCount;

  if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-brand-blue" size={40} /></div>;

  return (
    <div className="animate-in fade-in duration-300 max-w-6xl mx-auto">

      {/* === ARCHIVE CONFIRMATION MODAL === */}
      {projectToArchive && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 backdrop-blur-sm animate-in fade-in duration-300 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center shadow-inner mb-2">
              <AlertCircle size={40} />
            </div>
            <h2 className="text-2xl font-serif text-brand-blue text-center font-bold">Archive Project?</h2>
            <p className="text-gray-600 text-center text-sm font-medium leading-relaxed">
              Archive <strong>{projectToArchive.title}</strong>? It will be removed from the website and active admin lists, but its content will be retained and can be restored later.
            </p>

            <div className="flex gap-3 w-full mt-4">
              <button type="button" onClick={() => setProjectToArchive(null)} disabled={isArchiving} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-xs uppercase tracking-widest outline-none">Cancel</button>
              <button type="button" onClick={confirmArchive} disabled={isArchiving} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors text-xs uppercase tracking-widest flex items-center justify-center gap-2 outline-none">
                {isArchiving ? <Loader2 size={16} className="animate-spin" /> : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div role="status" className="fixed right-6 top-24 z-[120] flex max-w-sm items-center gap-3 rounded-xl border border-green-100 bg-white px-4 py-3 text-sm text-brand-blue shadow-xl">
          <CheckCircle2 size={18} className="shrink-0 text-green-600" />{successMessage}
        </div>
      )}

      {/* PROJECTS SUB-NAVIGATION */}
      <div className="mb-7 flex items-center gap-6 border-b border-gray-200">
        <button
          type="button"
          className="relative pb-3 text-sm font-bold text-brand-blue"
          aria-current="page"
        >
          Projects
          <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-brand-blue" />
        </button>

        <button
          type="button"
          onClick={openNavigationSetup}
          className="pb-3 text-sm font-medium text-gray-400 transition-colors hover:text-brand-blue"
        >
          Navigation Setup
        </button>

        <button
          type="button"
          onClick={openArchivedProjects}
          className="pb-3 text-sm font-medium text-gray-400 transition-colors hover:text-brand-blue"
        >
          Archived
        </button>
      </div>

      {/* PAGE INTRO */}
      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">Projects · Content</p>
          <h2 className="mt-2 font-serif text-4xl leading-none text-brand-blue">Project Website Content</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
            Select a project to manage its website content, visibility, layouts, amenities, and other project details.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
          </span>
          <span className="rounded-full border border-green-100 bg-green-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-green-600">
            {visibleProjectCount} Visible
          </span>
          {hiddenProjectCount > 0 && (
            <span className="rounded-full border border-gray-200 bg-gray-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              {hiddenProjectCount} Hidden
            </span>
          )}
        </div>
      </div>

      {/* LIST CONTROLS */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-400">
          Showing <span className="font-semibold text-brand-blue">{filteredProjects.length}</span> of {projects.length}
        </p>

        <div className="relative w-full sm:w-80">
          <Search
            size={16}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-brand-blue shadow-sm outline-none transition-all focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10"
          />
        </div>
      </div>

      <div className="w-full overflow-x-auto pb-4">
        <div
          className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm"
        >

  {/* TABLE HEADER */}
  <div
    className="
      hidden md:grid
      grid-cols-12
      gap-4
      px-6 py-3.5
      bg-gray-50/70
      border-b border-gray-100
      text-[10px]
      font-bold
      uppercase
      tracking-widest
      text-gray-400
    "
  >
    <div className="col-span-4">
      Project
    </div>

    <div className="col-span-3">
      Location
    </div>

    <div className="col-span-2">
      Project Status
    </div>

    <div className="col-span-2">
      Website Visibility
    </div>

    <div className="col-span-1 text-right">
      Actions
    </div>
  </div>


  {/* EMPTY STATE */}
  {filteredProjects.length === 0 ? (
    <div
      className="
        flex flex-col
        items-center
        justify-center
        py-16
        px-6
        text-center
      "
    >
      <div
        className="
          w-12 h-12
          rounded-xl
          bg-brand-blue/5
          text-brand-blue/40
          flex items-center justify-center
          mb-4
        "
      >
        <Building2 size={22} />
      </div>

      <p className="text-sm font-bold text-brand-blue">
        No projects found
      </p>

      <p className="text-xs text-gray-400 mt-1">
        Try another search term.
      </p>
    </div>
  ) : (

    <div className="divide-y divide-gray-100">

      {filteredProjects.map((proj) => (

        <div
          key={proj.id}
          role={
            checkPerm('edit_project', 'can_edit')
              ? 'button'
              : undefined
          }
          tabIndex={
            checkPerm('edit_project', 'can_edit')
              ? 0
              : -1
          }
          onClick={() => {
            if (checkPerm('edit_project', 'can_edit')) {
              openProject(proj.id);
            }
          }}
          onKeyDown={(e) => {
            if (
              checkPerm('edit_project', 'can_edit') &&
              (e.key === 'Enter' || e.key === ' ')
            ) {
              e.preventDefault();
              openProject(proj.id);
            }
          }}
          className={`
            group
            grid grid-cols-1 md:grid-cols-12
            gap-4
            px-6 py-4
            items-center
            transition-colors

            ${
              checkPerm('edit_project', 'can_edit')
                ? 'cursor-pointer hover:bg-gray-50/80'
                : ''
            }
          `}
        >

          {/* PROJECT */}
          <div
            className="
              md:col-span-4
              flex items-center
              gap-4
              min-w-0
            "
          >
            <div
              className="
                w-12 h-12
                rounded-xl
                bg-gray-100
                overflow-hidden
                shrink-0
                border border-gray-100
              "
            >
              <img
                src={
                  proj.image ||
                  'https://via.placeholder.com/150?text=No+Image'
                }
                alt={proj.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="min-w-0">

              <div
                className="
                  text-sm
                  font-bold
                  text-brand-blue
                  truncate
                  group-hover:text-brand-gold
                  transition-colors
                "
              >
                {proj.title}
              </div>

              <div className="md:hidden text-xs text-gray-400 mt-1">
                {proj.city}
              </div>

            </div>
          </div>


          {/* LOCATION */}
          <div
            className="
              hidden md:block
              md:col-span-3
              text-sm
              text-gray-500
              truncate
            "
          >
            {proj.city || '—'}
          </div>


          {/* BUSINESS / PROJECT STATUS */}
          <div className="md:col-span-2">
            <span
              className="
                inline-flex
                items-center
                px-2.5 py-1.5
                rounded-lg
                bg-brand-gold/10
                text-brand-gold
                text-[9px]
                font-bold
                uppercase
                tracking-wider
              "
            >
              {proj.status || 'No status'}
            </span>
          </div>


          {/* WEBSITE VISIBILITY */}
          <div className="md:col-span-2">
            <button
              type="button"
              disabled={!checkPerm('edit_project', 'can_edit')}
              onClick={(e) => {
                e.stopPropagation();

                handleToggleProject(
                  proj.id,
                  proj.is_active,
                  proj.title
                );
              }}
              className={`
                inline-flex
                items-center
                gap-2.5
                rounded-xl
                px-1 py-1
                text-[10px]
                font-bold
                uppercase
                tracking-wider
                transition-colors
                ${
                  checkPerm('edit_project', 'can_edit')
                    ? 'cursor-pointer'
                    : 'cursor-not-allowed opacity-60'
                }
              `}
              title={
                proj.is_active
                  ? 'Click to hide this project from the website'
                  : 'Click to make this project visible on the website'
              }
              aria-pressed={Boolean(proj.is_active)}
              aria-label={`${proj.is_active ? 'Hide' : 'Show'} ${proj.title} on the website`}
            >
              <span
                className={`
                  ${proj.is_active ? 'text-green-600' : 'text-gray-400'}
                `}
              >
                {proj.is_active ? 'Visible' : 'Hidden'}
              </span>

              <span
                className={`
                  relative
                  h-7 w-12
                  shrink-0
                  rounded-full
                  transition-colors
                  ${
                    proj.is_active
                      ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-gray-300 hover:bg-gray-400'
                  }
                `}
              >
                <span
                  className={`
                    absolute top-1
                    h-5 w-5
                    rounded-full
                    bg-white
                    shadow-sm
                    transition-all
                    ${proj.is_active ? 'left-6' : 'left-1'}
                  `}
                />
              </span>
            </button>
          </div>


          {/* ARCHIVE */}
          <div
            className="
              md:col-span-1
              flex md:justify-end
            "
          >
            {checkPerm(
              'edit_project',
              'can_delete'
            ) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();

                  handleArchiveClick(
                    proj.id,
                    proj.title
                  );
                }}
                className="
                  p-2
                  rounded-lg
                  text-gray-300
                  hover:text-red-500
                  hover:bg-red-50
                  transition-colors
                "
                title={`Archive ${proj.title}`}
                aria-label={`Archive ${proj.title}`}
              >
                <Archive size={16} />
              </button>
            )}
          </div>

        </div>

      ))}

    </div>
  )}

</div>
      </div>
    </div>
  );
}

// --- ARCHIVED PROJECTS MANAGER ---
function ArchivedProjectsManager({ checkPerm }: ManagerProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<Project | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadArchivedProjects = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await fetchArchivedProjectsList();
      setProjects((data || []) as Project[]);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to load archived projects.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadArchivedProjects();
  }, []);

  const openProjects = () => {
    router.push('/admin/dashboard?section=Projects');
  };

  const openNavigationSetup = () => {
    router.push('/admin/dashboard?section=Navbar%20Setup');
  };

  const confirmRestore = async () => {
    if (!restoreTarget) return;
    setIsWorking(true);
    setErrorMessage('');

    try {
      await restoreArchivedProjectAction(restoreTarget.id);
      const restoredTitle = restoreTarget.title;
      setProjects((current) => current.filter((project) => project.id !== restoreTarget.id));
      setRestoreTarget(null);
      setSuccessMessage(`Project "${restoredTitle}" restored as Hidden.`);
      window.setTimeout(() => setSuccessMessage(''), 2600);
      try {
        await createAuditLogAction(
          'EDIT',
          'Projects',
          restoredTitle,
          'Restored archived project as Hidden. Linked navigation remains hidden until intentionally republished.',
          { entityId: restoreTarget.id, fieldKey: 'is_active' }
        );
      } catch (auditError) {
        console.error('Project restored, but its audit log failed:', auditError);
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to restore project.');
    } finally {
      setIsWorking(false);
    }
  };

  const filteredProjects = projects.filter((project) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      String(project.title || '').toLowerCase().includes(query) ||
      String(project.city || '').toLowerCase().includes(query)
    );
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-brand-blue" size={40} />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 max-w-6xl mx-auto">
      {successMessage && (
        <div className="fixed top-24 right-8 z-[120] flex items-center gap-2 rounded-xl border border-green-200 bg-white px-4 py-3 shadow-xl">
          <CheckCircle2 size={17} className="text-green-500" />
          <span className="text-xs font-semibold text-brand-blue">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="fixed top-24 right-8 z-[120] flex max-w-lg items-start gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 shadow-xl">
          <AlertCircle size={17} className="mt-0.5 shrink-0 text-red-500" />
          <span className="text-xs font-semibold leading-relaxed text-red-600">{errorMessage}</span>
        </div>
      )}

      {restoreTarget && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-brand-blue/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
            <h2 className="text-center font-serif text-2xl font-bold text-brand-blue">Restore Project?</h2>
            <p className="mt-3 text-center text-sm leading-relaxed text-gray-500">
              <strong className="text-brand-blue">{restoreTarget.title}</strong> will return to the active CMS as <strong>Hidden</strong>. It will not be published automatically.
            </p>
            <div className="mt-6 flex gap-3">
              <button type="button" disabled={isWorking} onClick={() => setRestoreTarget(null)} className="flex-1 rounded-xl bg-gray-100 py-3 text-xs font-bold uppercase tracking-widest text-gray-600 hover:bg-gray-200 disabled:opacity-60">Cancel</button>
              <button type="button" disabled={isWorking} onClick={confirmRestore} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-blue py-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-brand-gold disabled:opacity-60">
                {isWorking ? <Loader2 size={15} className="animate-spin" /> : null}
                Restore
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-7 flex items-center gap-6 border-b border-gray-200">
        <button type="button" onClick={openProjects} className="pb-3 text-sm font-medium text-gray-400 transition-colors hover:text-brand-blue">Projects</button>
        <button type="button" onClick={openNavigationSetup} className="pb-3 text-sm font-medium text-gray-400 transition-colors hover:text-brand-blue">Navigation Setup</button>
        <button type="button" className="relative pb-3 text-sm font-bold text-brand-blue" aria-current="page">
          Archived
          <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-brand-blue" />
        </button>
      </div>

      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">Projects · Archive</p>
          <h2 className="mt-2 font-serif text-4xl leading-none text-brand-blue">Archived Projects</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
            Archived projects are removed from the website and active admin lists. Restore them later with their content retained.
          </p>
        </div>
        <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
          {projects.length} Archived
        </span>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-400">Showing <span className="font-semibold text-brand-blue">{filteredProjects.length}</span> of {projects.length}</p>
        <div className="relative w-full sm:w-80">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search archived projects..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-brand-blue shadow-sm outline-none transition-all focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10" />
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="hidden grid-cols-12 gap-4 border-b border-gray-100 bg-gray-50/70 px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-brand-blue/50 md:grid">
          <div className="col-span-4">Project</div>
          <div className="col-span-2">Location</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Archived</div>
          <div className="col-span-2 text-right">Restore</div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <Archive size={30} className="mb-3 text-gray-300" />
            <p className="text-sm font-semibold text-brand-blue">No archived projects</p>
            <p className="mt-1 text-xs text-gray-400">Projects you archive will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredProjects.map((project) => (
              <div key={project.id} className="grid grid-cols-1 items-center gap-4 px-6 py-4 md:grid-cols-12">
                <div className="col-span-4 flex min-w-0 items-center gap-4">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-100">
                    <img src={project.image || 'https://via.placeholder.com/150?text=No+Image'} alt={project.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-brand-blue">{project.title}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Archived</p>
                  </div>
                </div>
                <div className="col-span-2 text-sm text-gray-500">{project.city || '—'}</div>
                <div className="col-span-2"><span className="inline-flex rounded-lg bg-brand-gold/10 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-brand-gold">{project.status || 'No status'}</span></div>
                <div className="col-span-2 text-xs text-gray-400">{project.deleted_at ? formatDateTime(project.deleted_at) : '—'}</div>
                <div className="col-span-2 flex items-center gap-2 md:justify-end">
                  {checkPerm('edit_project', 'can_edit') && (
                    <button type="button" onClick={() => setRestoreTarget(project)} className="rounded-lg border border-brand-blue/15 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-brand-blue transition-colors hover:bg-brand-blue hover:text-white">Restore</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-brand-blue/10 bg-brand-blue/[0.03] px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-blue/60">
          Restore safely
        </p>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          Restored projects return as Hidden. Review their content and website visibility before publishing.
        </p>
      </div>
    </div>
  );
}

// --- VIRTUAL TOURS MANAGER ---

function VirtualToursManager({ checkPerm }: ManagerProps) {
  const router = useRouter();
  const [tours, setTours] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchTours = async () => {
      try {
        const data = await fetchAdminVirtualToursList();
        setTours(data || []);
      } catch (error) {
        console.error('Failed to fetch virtual tour project summaries:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTours();
  }, []);

  const filtered = tours.filter((tour) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    return (
      String(tour.title || '').toLowerCase().includes(query) ||
      String(tour.project_name || '').toLowerCase().includes(query)
    );
  });

  const totalProjects = tours.length;
  const configuredProjects = tours.filter(
    (tour) => Number(tour.total_units || 0) > 0
  ).length;
  const totalVisibleUnits = tours.reduce(
    (sum, tour) => sum + Number(tour.visible_units || 0),
    0
  );

  const openProjectTours = (projectId: number) => {
    if (!checkPerm('virtual_tours', 'can_edit')) return;
    router.push(`/admin/virtualtours?project=${projectId}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-brand-blue" size={40} />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      <div className="max-w-6xl mx-auto w-full">
        <div className="mb-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold tracking-[0.24em] uppercase text-brand-gold">
                Content · Virtual Tours
              </p>

              <h2 className="mt-2 text-4xl font-serif text-brand-blue leading-none">
                360° Virtual Tours
              </h2>

              <p className="mt-3 text-sm text-gray-500 leading-relaxed">
                Select a project to manage its towers, unit tours, visibility, and 360° view areas.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                {totalProjects} {totalProjects === 1 ? 'project' : 'projects'}
              </span>

              <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-green-700">
                {configuredProjects} configured
              </span>

              <span className="inline-flex items-center rounded-full bg-brand-blue/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-blue">
                {totalVisibleUnits} visible units
              </span>
            </div>
          </div>

          <div className="mt-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-brand-blue">
                Showing {filtered.length} of {tours.length}
              </div>

              <p className="text-xs text-gray-400 mt-1">
                Select a project to manage its virtual tour content.
              </p>
            </div>

            <div className="relative w-full sm:w-80">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />

              <input
                type="text"
                placeholder="Search project tours..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-brand-blue text-sm outline-none shadow-sm focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-all"
              />
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto pb-4">
          <div className="min-w-[920px] bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3.5 bg-gray-50/70 border-b border-gray-100 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <div className="col-span-4">Virtual Tour Project</div>
              <div className="col-span-2">Towers</div>
              <div className="col-span-2">Units</div>
              <div className="col-span-2">View Areas</div>
              <div className="col-span-2 text-right">Visibility</div>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-brand-blue/5 text-brand-blue/40 flex items-center justify-center mb-4">
                  <Move3d size={22} />
                </div>

                <p className="text-sm font-bold text-brand-blue">
                  {tours.length === 0 ? 'No virtual tours available yet' : 'No virtual tours found'}
                </p>

                <p className="text-xs text-gray-400 mt-1">
                  {tours.length === 0
                    ? 'Add a tour to start linking projects, towers, and units.'
                    : 'Try another search term.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map((tour) => {
                  const hasUnits = Number(tour.total_units || 0) > 0;
                  const canEdit = checkPerm('virtual_tours', 'can_edit');
                  const previewImage = tour.preview_image || null;

                  return (
                    <div
                      key={tour.project_id}
                      role={canEdit ? 'button' : undefined}
                      tabIndex={canEdit ? 0 : -1}
                      onClick={() => {
                        if (canEdit) {
                          openProjectTours(tour.project_id);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (!canEdit) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openProjectTours(tour.project_id);
                        }
                      }}
                      className={`group grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 items-center transition-colors ${
                        canEdit ? 'cursor-pointer hover:bg-gray-50/80 focus:outline-none focus:bg-gray-50/80' : ''
                      }`}
                    >
                      <div className="md:col-span-4 flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden shrink-0 border border-gray-100 flex items-center justify-center">
                          {previewImage ? (
                            <img
                              src={previewImage}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Move3d size={18} className="text-gray-300" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="text-sm font-bold text-brand-blue truncate group-hover:text-brand-gold transition-colors">
                            {tour.title}
                          </div>

                          <div className="text-xs text-gray-400 mt-1 truncate">
                            Linked to {tour.project_name}
                          </div>
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <span className="text-sm font-bold text-brand-blue">
                          {tour.total_towers}
                        </span>
                        <span className="text-xs text-gray-400 ml-1.5">
                          {Number(tour.total_towers) === 1 ? 'tower' : 'towers'}
                        </span>
                      </div>

                      <div className="md:col-span-2">
                        <span className="text-sm font-bold text-brand-blue">
                          {tour.total_units}
                        </span>
                        <span className="text-xs text-gray-400 ml-1.5">
                          {Number(tour.total_units) === 1 ? 'unit' : 'units'}
                        </span>
                      </div>

                      <div className="md:col-span-2">
                        <span className="text-sm font-bold text-brand-blue">
                          {tour.total_view_areas}
                        </span>
                        <span className="text-xs text-gray-400 ml-1.5">
                          {Number(tour.total_view_areas) === 1 ? 'area' : 'areas'}
                        </span>
                      </div>

                      <div className="md:col-span-2 flex items-center justify-start md:justify-end gap-1.5 flex-nowrap whitespace-nowrap">
                        {!hasUnits ? (
                          <span className="inline-flex shrink-0 items-center rounded-lg bg-gray-100 px-2 py-1.5 text-[8px] font-bold uppercase tracking-wider text-gray-500">
                            Not configured
                          </span>
                        ) : (
                          <>
                            <span className="inline-flex items-center rounded-lg bg-green-50 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-green-700 whitespace-nowrap">
                              {tour.visible_units} visible
                            </span>

                            {Number(tour.hidden_units || 0) > 0 && (
                              <span className="inline-flex items-center rounded-lg bg-gray-100 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                                {tour.hidden_units} hidden
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-brand-blue/10 bg-brand-blue/[0.03] px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-blue/60">
            Visibility tip
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            Visibility is managed per unit inside each project's Virtual Tour editor. Open a
            project to manage its towers, units, and 360° view areas.
          </p>
        </div>
      </div>
    </div>
  );
}


// --- PROMOTIONS MANAGER ---
function PromotionsManager({ checkPerm }: ManagerProps) {
  const router = useRouter();
  const [promotions, setPromotions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [promoToArchive, setPromoToArchive] = useState<{ id: number; title: string } | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const fetchPromos = async () => {
      try {
        const data = await fetchAdminPromotionsList();
        setPromotions(data || []);
      } catch (error: any) {
        console.error(error);
        setErrorMessage(error?.message || 'Failed to load promotions.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPromos();
  }, []);

  const showSuccess = (message: string) => {
    setErrorMessage('');
    setSuccessMessage(message);
    window.setTimeout(() => setSuccessMessage(''), 2500);
  };

  const showError = (message: string) => {
    setSuccessMessage('');
    setErrorMessage(message);
    window.setTimeout(() => setErrorMessage(''), 3500);
  };

  const handleArchiveClick = (id: number, title: string) => {
    setPromoToArchive({ id, title });
  };

  const confirmArchive = async () => {
    if (!promoToArchive) return;

    const target = promoToArchive;
    setIsArchiving(true);

    try {
      await archiveRecord('promotions', target.id, 'is_archived');

      await createAuditLogAction(
        'DELETE',
        'Promotions',
        target.title,
        'Archived promotion. Content retained for restoration.',
        { entityId: target.id }
      );

      setPromotions((prev) => prev.filter((promo) => promo.id !== target.id));
      setPromoToArchive(null);
      showSuccess(`Promotion "${target.title}" archived.`);
    } catch (error: any) {
      setPromoToArchive(null);
      showError(error?.message || 'Failed to archive promotion.');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleToggleStatus = async (
    id: number,
    currentStatus: boolean,
    title: string
  ) => {
    try {
      await toggleActiveStatus('promotions', id, currentStatus);

      await createAuditLogAction(
        'EDIT',
        'Promotions',
        title,
        `Changed website visibility to ${!currentStatus ? 'Visible' : 'Hidden'}.`,
        { entityId: id, fieldKey: 'is_active', oldValue: currentStatus, newValue: !currentStatus }
      );

      setPromotions((prev) =>
        prev.map((promo) =>
          promo.id === id ? { ...promo, is_active: !currentStatus } : promo
        )
      );

      showSuccess(
        `"${title}" is now ${!currentStatus ? 'visible' : 'hidden'} on the website.`
      );
    } catch (error: any) {
      showError(error?.message || 'Failed to update promotion visibility.');
    }
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filtered = promotions.filter((promo) =>
    String(promo.title || '')
      .toLowerCase()
      .includes(normalizedSearch)
  );

  const visibleCount = promotions.filter((promo) => Boolean(promo.is_active)).length;
  const hiddenCount = promotions.length - visibleCount;

  const openPromotion = (id: number) => {
    if (!checkPerm('promotion_code', 'can_edit')) return;
    router.push(`/admin/promotions?edit=${id}`);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-brand-blue" size={40} />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      {promoToArchive && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mb-1 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500 shadow-inner">
              <AlertCircle size={32} />
            </div>

            <h2 className="text-center font-serif text-2xl font-bold text-brand-blue">
              Archive Promotion?
            </h2>

            <p className="text-center text-sm leading-relaxed text-gray-500">
              <strong className="text-brand-blue">{promoToArchive.title}</strong> will be
              removed from the active Promotions list and will no longer appear on the
              public website.
            </p>

            <div className="mt-3 flex w-full gap-3">
              <button
                type="button"
                onClick={() => setPromoToArchive(null)}
                disabled={isArchiving}
                className="flex-1 rounded-xl bg-gray-100 py-3 text-xs font-bold uppercase tracking-widest text-gray-700 outline-none transition-colors hover:bg-gray-200 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmArchive}
                disabled={isArchiving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-xs font-bold uppercase tracking-widest text-white outline-none transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                {isArchiving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  'Archive'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="fixed top-24 right-6 z-[120] max-w-sm rounded-2xl border border-green-100 bg-white px-4 py-3 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
              <CheckCircle2 size={17} />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-green-700">
                Updated
              </p>
              <p className="mt-1 text-sm text-gray-600">{successMessage}</p>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="fixed top-24 right-6 z-[120] max-w-sm rounded-2xl border border-red-100 bg-white px-4 py-3 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500">
              <AlertCircle size={17} />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-red-600">
                Could not update
              </p>
              <p className="mt-1 text-sm text-gray-600">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-gold">
                Content · Promotions
              </p>

              <h2 className="mt-2 font-serif text-4xl leading-none text-brand-blue">
                Promotions
              </h2>

              <p className="mt-3 text-sm leading-relaxed text-gray-500">
                Manage promotional offers shown on the website, including campaign status,
                validity, and website visibility.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                {promotions.length} {promotions.length === 1 ? 'promotion' : 'promotions'}
              </span>

              <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-green-700">
                {visibleCount} visible
              </span>

              {hiddenCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  {hiddenCount} hidden
                </span>
              )}
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-bold text-brand-blue">
                Showing {filtered.length} of {promotions.length}
              </div>

              <p className="mt-1 text-xs text-gray-400">
                Select a promotion to edit its website content.
              </p>
            </div>

            <div className="relative w-full sm:w-80">
              <Search
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                placeholder="Search promotions..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-brand-blue shadow-sm outline-none transition-all focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10"
              />
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto pb-4">
          <div className="min-w-[820px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="hidden grid-cols-12 gap-4 border-b border-gray-100 bg-gray-50/70 px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 md:grid">
              <div className="col-span-4">Promotion</div>
              <div className="col-span-2">Campaign Status</div>
              <div className="col-span-3">Validity</div>
              <div className="col-span-2">Website Visibility</div>
              <div className="col-span-1 text-right">Archive</div>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-blue/5 text-brand-blue/40">
                  <Megaphone size={22} />
                </div>

                <p className="text-sm font-bold text-brand-blue">
                  {promotions.length === 0 ? 'No promotions yet' : 'No promotions found'}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  {promotions.length === 0
                    ? 'Use Add Promo to create the first promotional offer.'
                    : 'Try another search term.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map((promo) => {
                  const canEdit = checkPerm('promotion_code', 'can_edit');

                  return (
                    <div
                      key={promo.id}
                      role={canEdit ? 'button' : undefined}
                      tabIndex={canEdit ? 0 : -1}
                      onClick={() => {
                        if (canEdit) openPromotion(promo.id);
                      }}
                      onKeyDown={(event) => {
                        if (!canEdit) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openPromotion(promo.id);
                        }
                      }}
                      className={`group grid grid-cols-1 items-center gap-4 px-6 py-4 transition-colors md:grid-cols-12 ${
                        canEdit
                          ? 'cursor-pointer hover:bg-gray-50/80 focus:bg-gray-50/80 focus:outline-none'
                          : ''
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-4 md:col-span-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50 shadow-sm">
                          {promo.image ? (
                            <img
                              src={promo.image}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={(event) => {
                                event.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <Megaphone size={18} className="text-gray-300" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-brand-blue transition-colors group-hover:text-brand-gold">
                            {promo.title || 'Untitled Promotion'}
                          </div>

                          <div className="mt-1 text-xs text-gray-400 md:hidden">
                            {promo.validity_date || 'No validity date'}
                          </div>
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <span className="inline-flex items-center rounded-lg bg-brand-gold/10 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-brand-gold">
                          {promo.status || 'Promotion'}
                        </span>
                      </div>

                      <div className="text-sm font-medium text-gray-500 md:col-span-3">
                        {promo.validity_date || 'No validity date'}
                      </div>

                      <div className="md:col-span-2">
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleToggleStatus(
                              promo.id,
                              Boolean(promo.is_active),
                              promo.title || 'Untitled Promotion'
                            );
                          }}
                          className={`inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
                            canEdit
                              ? 'cursor-pointer'
                              : 'cursor-not-allowed opacity-60'
                          }`}
                          title={
                            promo.is_active
                              ? 'Hide this promotion from the website'
                              : 'Show this promotion on the website'
                          }
                        >
                          <span className={promo.is_active ? 'text-green-700' : 'text-gray-400'}>
                            {promo.is_active ? 'Visible' : 'Hidden'}
                          </span>

                          <span
                            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                              promo.is_active ? 'bg-green-500' : 'bg-gray-300'
                            } ${canEdit ? 'hover:ring-4 hover:ring-brand-blue/5' : ''}`}
                            aria-hidden="true"
                          >
                            <span
                              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                                promo.is_active
                                  ? 'translate-x-5'
                                  : 'translate-x-0.5'
                              }`}
                            />
                          </span>
                        </button>
                      </div>

                      <div className="flex md:col-span-1 md:justify-end">
                        {checkPerm('promotion_code', 'can_delete') && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleArchiveClick(
                                promo.id,
                                promo.title || 'Untitled Promotion'
                              );
                            }}
                            className="cursor-pointer rounded-lg p-2 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                            title={`Archive ${promo.title || 'promotion'}`}
                            aria-label={`Archive ${promo.title || 'promotion'}`}
                          >
                            <Archive size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-brand-blue/10 bg-brand-blue/[0.03] px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-blue/60">
            Visibility & archiving
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            Hiding a promotion keeps it available for editing while removing it from the
            public website. Archiving removes it from the active Promotions list.
          </p>
        </div>
      </div>
    </div>
  );
}

// --- PARTNER BANKS MANAGER ---
function PartnerBanksManager({ checkPerm }: ManagerProps) {
  const router = useRouter();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [bankToArchive, setBankToArchive] = useState<{ id: number, name: string } | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const data = await fetchAdminBanksList();
        setBanks(data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBanks();
  }, []);

  const handleArchiveClick = (id: number, name: string) => {
    setBankToArchive({ id, name });
  };

  const confirmArchive = async () => {
    if (!bankToArchive) return;
    setIsArchiving(true);

    try {
      await archiveRecord('banks', bankToArchive.id, 'is_archived');

      await createAuditLogAction(
        'DELETE',
        'Partner Banks',
        bankToArchive.name,
        'Archived bank. Content retained for restoration.',
        { entityId: bankToArchive.id }
      );

      const archivedName = bankToArchive.name;
      setBanks((prev) => prev.filter((bank) => bank.id !== bankToArchive.id));
      setBankToArchive(null);
      setSuccessMessage(`Bank "${archivedName}" archived.`);
      setTimeout(() => setSuccessMessage(''), 2500);
    } catch (error: any) {
      alert(`Failed to archive bank: ${error.message}`);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleToggleBank = async (
    id: number,
    currentStatus: boolean,
    bankName: string
  ) => {
    try {
      await toggleActiveStatus('banks', id, currentStatus);

      await createAuditLogAction(
        'EDIT',
        'Partner Banks',
        bankName,
        `Changed website visibility to ${!currentStatus ? 'Visible' : 'Hidden'}.`,
        { entityId: id, fieldKey: 'is_active', oldValue: currentStatus, newValue: !currentStatus }
      );

      setBanks((prev) =>
        prev.map((bank) =>
          bank.id === id ? { ...bank, is_active: !currentStatus } : bank
        )
      );
    } catch (error: any) {
      alert(`Failed to toggle status: ${error.message}`);
    }
  };

  const filteredBanks = banks.filter((bank) =>
    String(bank.bank_name || '')
      .toLowerCase()
      .includes(searchQuery.trim().toLowerCase())
  );

  const visibleCount = banks.filter((bank) => bank.is_active).length;
  const hiddenCount = banks.length - visibleCount;

  const openBank = (id: number) => {
    if (!checkPerm('edit_banks', 'can_edit')) return;
    router.push(`/admin/partnerbanks?edit=${id}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-brand-blue" size={40} />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      {bankToArchive && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center shadow-inner mb-1">
              <AlertCircle size={32} />
            </div>

            <h2 className="text-2xl font-serif text-brand-blue text-center font-bold">
              Archive Partner Bank?
            </h2>

            <p className="text-gray-500 text-center text-sm leading-relaxed">
              <strong className="text-brand-blue">{bankToArchive.name}</strong> will leave the active list and website. Its content will be retained for restoration.
            </p>

            <div className="flex gap-3 w-full mt-3">
              <button
                type="button"
                onClick={() => setBankToArchive(null)}
                disabled={isArchiving}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-xs uppercase tracking-widest outline-none disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmArchive}
                disabled={isArchiving}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors text-xs uppercase tracking-widest flex items-center justify-center gap-2 outline-none disabled:opacity-60"
              >
                {isArchiving ? <Loader2 size={16} className="animate-spin" /> : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="fixed right-6 top-24 z-[120] max-w-sm rounded-2xl border border-green-100 bg-white px-4 py-3 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
              <CheckCircle2 size={17} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-green-700">
                Updated
              </p>
              <p className="mt-1 text-sm text-gray-600">{successMessage}</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto w-full">
        <div className="mb-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold tracking-[0.24em] uppercase text-brand-gold">
                Content · Partner Banks
              </p>

              <h2 className="mt-2 text-4xl font-serif text-brand-blue leading-none">
                Partner Banks
              </h2>

              <p className="mt-3 text-sm text-gray-500 leading-relaxed">
                Manage financing partners shown on the website, including each bank's logo,
                maximum loan value, financing terms, and website visibility.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                {banks.length} {banks.length === 1 ? 'bank' : 'banks'}
              </span>

              <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-green-700">
                {visibleCount} visible
              </span>

              {hiddenCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  {hiddenCount} hidden
                </span>
              )}
            </div>
          </div>

          <div className="mt-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-brand-blue">
                Showing {filteredBanks.length} of {banks.length}
              </div>

              <p className="text-xs text-gray-400 mt-1">
                Select a bank to edit its website content.
              </p>
            </div>

            <div className="relative w-full sm:w-80">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />

              <input
                type="text"
                placeholder="Search banks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-brand-blue text-sm outline-none shadow-sm focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-all"
              />
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto pb-4">
          <div className="min-w-[820px] bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3.5 bg-gray-50/70 border-b border-gray-100 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <div className="col-span-4">Partner Bank</div>
              <div className="col-span-2">Max Loan</div>
              <div className="col-span-3">Terms</div>
              <div className="col-span-2">Website Visibility</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {filteredBanks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-brand-blue/5 text-brand-blue/40 flex items-center justify-center mb-4">
                  <Landmark size={22} />
                </div>

                <p className="text-sm font-bold text-brand-blue">
                  {banks.length === 0 ? 'No partner banks yet' : 'No banks found'}
                </p>

                <p className="text-xs text-gray-400 mt-1">
                  {banks.length === 0
                    ? 'Use Add Bank to create the first financing partner.'
                    : 'Try another search term.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredBanks.map((bank) => {
                  const canEdit = checkPerm('edit_banks', 'can_edit');

                  return (
                    <div
                      key={bank.id}
                      role={canEdit ? 'button' : undefined}
                      tabIndex={canEdit ? 0 : -1}
                      onClick={() => {
                        if (canEdit) openBank(bank.id);
                      }}
                      onKeyDown={(e) => {
                        if (!canEdit) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openBank(bank.id);
                        }
                      }}
                      className={`group grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 items-center transition-colors ${
                        canEdit
                          ? 'cursor-pointer hover:bg-gray-50/80 focus:outline-none focus:bg-gray-50/80'
                          : ''
                      }`}
                    >
                      <div className="md:col-span-4 flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-white overflow-hidden shrink-0 border border-gray-100 shadow-sm flex items-center justify-center p-1.5">
                          {bank.image ? (
                            <img
                              src={bank.image}
                              alt={bank.bank_name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Landmark size={18} className="text-gray-300" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="text-sm font-bold text-brand-blue truncate group-hover:text-brand-gold transition-colors">
                            {bank.bank_name}
                          </div>

                          <div className="md:hidden text-xs text-gray-400 mt-1">
                            {bank.max_loan || '—'}% maximum loan
                          </div>
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <span className="inline-flex items-center rounded-lg bg-brand-gold/10 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-brand-gold">
                          {bank.max_loan || '—'}% max
                        </span>
                      </div>

                      <div className="md:col-span-3 text-sm text-gray-500 leading-relaxed md:truncate md:pr-4">
                        {bank.terms || 'No financing terms provided.'}
                      </div>

                      <div className="md:col-span-2">
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleBank(bank.id, bank.is_active, bank.bank_name);
                          }}
                          className={`inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
                            canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                          }`}
                          title={
                            bank.is_active
                              ? 'Hide this bank from the website'
                              : 'Show this bank on the website'
                          }
                        >
                          <span className={bank.is_active ? 'text-green-700' : 'text-gray-400'}>
                            {bank.is_active ? 'Visible' : 'Hidden'}
                          </span>

                          <span
                            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                              bank.is_active ? 'bg-green-500' : 'bg-gray-300'
                            } ${canEdit ? 'hover:ring-4 hover:ring-brand-blue/5' : ''}`}
                            aria-hidden="true"
                          >
                            <span
                              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                                bank.is_active ? 'translate-x-5' : 'translate-x-0.5'
                              }`}
                            />
                          </span>
                        </button>
                      </div>

                      <div className="md:col-span-1 flex md:justify-end">
                        {checkPerm('edit_banks', 'can_delete') && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchiveClick(bank.id, bank.bank_name);
                            }}
                            className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                            title={`Archive ${bank.bank_name}`}
                            aria-label={`Archive ${bank.bank_name}`}
                          >
                            <Archive size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-brand-blue/10 bg-brand-blue/[0.03] px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-blue/60">
            Website visibility
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            A hidden bank stays available in the admin but is removed from the public website until it is made visible again.
          </p>
        </div>
      </div>
    </div>
  );
}

// --- OUR STORY MANAGER ---
function OurStoryManager({ checkPerm }: ManagerProps) {
  const router = useRouter();
  const [milestones, setMilestones] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [milestoneToArchive, setMilestoneToArchive] = useState<{ id: number; title: string } | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [pendingVisibilityId, setPendingVisibilityId] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchAdminStoryList()
      .then(data => setMilestones(data || []))
      .catch(error => {
        console.error('Could not load Our Story milestones:', error);
        setErrorMessage('Could not load milestones.');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const showSuccess = (message: string) => {
    setErrorMessage('');
    setSuccessMessage(message);
    window.setTimeout(() => setSuccessMessage(''), 2500);
  };
  const showError = (message: string) => {
    setSuccessMessage('');
    setErrorMessage(message);
    window.setTimeout(() => setErrorMessage(''), 3500);
  };

  const confirmArchive = async () => {
    if (!milestoneToArchive) return;
    const target = milestoneToArchive;
    setIsArchiving(true);
    try {
      await archiveRecord('our story', target.id, 'is_archived');
      setMilestones(prev => prev.filter(item => item.id !== target.id));
      setMilestoneToArchive(null);
      showSuccess(`Milestone "${target.title}" archived.`);
      try {
        await createAuditLogAction('DELETE', 'Our Story', target.title, 'Archived milestone.', { entityId: target.id });
      } catch (auditError) {
        console.error('Milestone archived, but its audit log failed:', auditError);
      }
    } catch (error: any) {
      showError(error?.message || 'Could not archive milestone.');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean, title: string) => {
    if (pendingVisibilityId !== null) return;
    setPendingVisibilityId(id);
    try {
      await toggleActiveStatus('our story', id, currentStatus);
      const visible = !currentStatus;
      setMilestones(prev => prev.map(item => item.id === id ? { ...item, is_active: visible } : item));
      showSuccess(`"${title}" is now ${visible ? 'visible' : 'hidden'} on the website.`);
      try {
        await createAuditLogAction('EDIT', 'Our Story', title, `Changed website visibility to ${visible ? 'Visible' : 'Hidden'}.`, { entityId: id, fieldKey: 'is_active', oldValue: currentStatus, newValue: visible });
      } catch (auditError) {
        console.error('Milestone visibility changed, but its audit log failed:', auditError);
      }
    } catch (error: any) {
      showError(error?.message || 'Could not change website visibility.');
    } finally {
      setPendingVisibilityId(null);
    }
  };

  const term = searchQuery.trim().toLowerCase();
  const filtered = milestones.filter(item =>
    !term || String(item.title || '').toLowerCase().includes(term) || String(item.year ?? '').includes(term),
  );
  const visibleCount = milestones.filter(item => item.is_active === true).length;
  const hiddenCount = milestones.length - visibleCount;
  const canEdit = checkPerm('our_story', 'can_edit');

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 size={40} className="animate-spin text-brand-blue" /></div>;

  return (
    <div className="mx-auto w-full max-w-6xl animate-in fade-in duration-300">
      {milestoneToArchive && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 p-4 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" aria-labelledby="story-archive-title" className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500"><AlertCircle size={24} /></div>
            <h2 id="story-archive-title" className="font-serif text-2xl text-brand-blue">Archive Milestone?</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500"><strong className="text-brand-blue">{milestoneToArchive.title}</strong> will leave the active list and public website. Its content will be retained.</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setMilestoneToArchive(null)} disabled={isArchiving} className="flex-1 rounded-xl bg-gray-100 py-3 text-xs font-bold uppercase tracking-widest text-gray-700 hover:bg-gray-200 disabled:opacity-60">Cancel</button>
              <button type="button" onClick={confirmArchive} disabled={isArchiving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-red-700 disabled:opacity-60">{isArchiving ? <Loader2 size={16} className="animate-spin" /> : 'Archive'}</button>
            </div>
          </div>
        </div>
      )}
      {successMessage && <div role="status" className="fixed top-24 right-6 z-[120] flex max-w-sm items-center gap-3 rounded-xl border border-green-100 bg-white px-4 py-3 text-sm text-brand-blue shadow-xl"><CheckCircle2 size={18} className="shrink-0 text-green-600" />{successMessage}</div>}
      {errorMessage && <div role="alert" className="fixed top-24 right-6 z-[120] flex max-w-sm items-center gap-3 rounded-xl border border-red-100 bg-white px-4 py-3 text-sm text-red-600 shadow-xl"><AlertCircle size={18} className="shrink-0" />{errorMessage}</div>}

      <div className="mb-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-gold">Content · Our Story</p>
            <h2 className="mt-2 font-serif text-4xl leading-none text-brand-blue">Our Story</h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-500">Manage the milestones in the public timeline, their images, and website visibility.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">{milestones.length} {milestones.length === 1 ? 'milestone' : 'milestones'}</span>
            <span className="rounded-full bg-green-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-green-700">{visibleCount} visible</span>
            {hiddenCount > 0 && <span className="rounded-full bg-gray-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">{hiddenCount} hidden</span>}
          </div>
        </div>
        <div className="mt-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="text-sm font-bold text-brand-blue">Showing {filtered.length} of {milestones.length}</p><p className="mt-1 text-xs text-gray-400">Select a milestone row to edit its content.</p></div>
          <div className="relative w-full sm:w-80">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="search" placeholder="Search milestones..." value={searchQuery} onChange={event => setSearchQuery(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-brand-blue shadow-sm outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10" />
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto pb-4">
        <div className="min-w-[800px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="grid grid-cols-12 gap-4 border-b border-gray-100 bg-gray-50/70 px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            <div className="col-span-2">Year</div><div className="col-span-4">Milestone</div><div className="col-span-3">Description</div><div className="col-span-2">Website Visibility</div><div className="col-span-1 text-right">Archive</div>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center"><p className="text-sm font-bold text-brand-blue">{milestones.length === 0 ? 'No milestones yet' : 'No milestones found'}</p><p className="mt-1 text-xs text-gray-400">{milestones.length === 0 ? 'Use Add Milestone to create the first entry.' : 'Try another year or title.'}</p></div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map(item => {
                const visible = item.is_active === true;
                return (
                  <div key={item.id} role={canEdit ? 'button' : undefined} tabIndex={canEdit ? 0 : -1}
                    onClick={() => { if (canEdit) router.push(`/admin/story?edit=${item.id}`); }}
                    onKeyDown={event => { if (!canEdit || event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); router.push(`/admin/story?edit=${item.id}`); } }}
                    className={`group grid grid-cols-12 items-center gap-4 px-6 py-4 transition-colors ${canEdit ? 'cursor-pointer hover:bg-gray-50/80 focus:bg-gray-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold/60' : ''}`}>
                    <div className="col-span-2 font-serif text-xl font-bold text-brand-gold">{item.year}</div>
                    <div className="col-span-4 flex min-w-0 items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-brand-blue/5">
                        {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <BookOpen size={18} className="text-brand-blue/30" />}
                      </div>
                      <p className="min-w-0 truncate text-sm font-bold text-brand-blue group-hover:text-brand-gold">{item.title}</p>
                    </div>
                    <div className="col-span-3 truncate text-xs text-gray-500">{item.description}</div>
                    <div className="col-span-2">
                      <button type="button" disabled={!canEdit || pendingVisibilityId !== null} aria-pressed={visible} aria-label={`${visible ? 'Hide' : 'Show'} ${item.title} on the website`}
                        onClick={event => { event.stopPropagation(); handleToggleStatus(item.id, visible, item.title); }}
                        className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60">
                        <span className={visible ? 'text-green-700' : 'text-gray-400'}>{visible ? 'Visible' : 'Hidden'}</span>
                        <span aria-hidden="true" className={`relative inline-flex h-6 w-11 shrink-0 rounded-full ${visible ? 'bg-green-500' : 'bg-gray-300'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${visible ? 'translate-x-5' : 'translate-x-0.5'}`} /></span>
                      </button>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      {checkPerm('our_story', 'can_delete') && <button type="button" onClick={event => { event.stopPropagation(); setMilestoneToArchive({ id: item.id, title: item.title }); }} aria-label={`Archive ${item.title}`} title={`Archive ${item.title}`} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"><Archive size={16} /></button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-brand-blue/10 bg-brand-blue/[0.03] px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-widest text-brand-blue/60">Visibility & archiving</p><p className="mt-1 text-xs leading-relaxed text-gray-500">Hiding keeps a milestone available in the CMS while removing it from the website. Archiving removes it from the active list and retains its content.</p></div>
    </div>
  );
}

const archiveSections = {
  'Archived Promotions': { table: 'promotions', moduleCode: 'promotion_code', label: 'Promotions', itemName: 'promotion' },
  'Archived Partner Banks': { table: 'banks', moduleCode: 'edit_banks', label: 'Partner Banks', itemName: 'bank' },
  'Archived News & Updates': { table: 'news_updates', moduleCode: 'edit_news', label: 'News & Updates', itemName: 'article' },
  'Archived Our Story': { table: 'our story', moduleCode: 'our_story', label: 'Our Story', itemName: 'milestone' },
} as const;

type ArchivedContentSection = keyof typeof archiveSections;

function ContentArchiveTabs({ section, archived, checkPerm }: ManagerProps & { section: ArchivedContentSection; archived?: boolean }) {
  const router = useRouter();
  const config = archiveSections[section];
  if (!checkPerm(config.moduleCode, 'can_view')) return null;
  const activeSection = section === 'Archived Our Story' ? 'our story' : config.label;
  const tabs = [
    { label: config.label, target: activeSection, current: !archived },
    { label: 'Archived', target: section, current: Boolean(archived) },
  ];

  return (
    <div className="mb-7 flex items-center gap-6 border-b border-gray-200">
      {tabs.map(tab => (
        <button
          key={tab.label}
          type="button"
          onClick={tab.current ? undefined : () => router.push(`/admin/dashboard?section=${encodeURIComponent(tab.target)}`)}
          aria-current={tab.current ? 'page' : undefined}
          className={tab.current
            ? 'relative pb-3 text-sm font-bold text-brand-blue'
            : 'pb-3 text-sm font-medium text-gray-400 transition-colors hover:text-brand-blue'}
        >
          {tab.label}
          {tab.current && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-brand-blue" />}
        </button>
      ))}
    </div>
  );
}

function ArchivedContentManager({ section, checkPerm }: ManagerProps & { section: ArchivedContentSection }) {
  const config = archiveSections[section];
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<any | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setErrorMessage('');
    fetchArchivedCmsRecordsAction(config.table)
      .then(data => { if (!cancelled) setRecords(data || []); })
      .catch((error: any) => { if (!cancelled) setErrorMessage(error?.message || 'Could not load archived records.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [section]);

  const nameOf = (record: any) => String(record.bank_name || record.title || `Untitled ${config.itemName}`);
  const confirmRestore = async () => {
    if (!restoreTarget) return;
    const target = restoreTarget;
    setIsRestoring(true);
    setErrorMessage('');
    try {
      await restoreArchivedCmsRecordAction(config.table, target.id);
      setRecords(previous => previous.filter(record => record.id !== target.id));
      setRestoreTarget(null);
      setSuccessMessage(`"${nameOf(target)}" restored as Hidden.`);
      window.setTimeout(() => setSuccessMessage(''), 2600);
      try {
        await createAuditLogAction('EDIT', config.label, nameOf(target), 'Restored archived record as Hidden. Website visibility remains off.', { entityId: target.id });
      } catch (auditError) {
        console.error('Record restored, but its audit log failed:', auditError);
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Could not restore the record.');
    } finally {
      setIsRestoring(false);
    }
  };

  const term = searchQuery.trim().toLowerCase();
  const filtered = records.filter(record =>
    !term || nameOf(record).toLowerCase().includes(term) || String(record.year ?? '').toLowerCase().includes(term),
  );
  if (!checkPerm(config.moduleCode, 'can_view')) {
    return <div className="rounded-2xl bg-white p-10 text-center text-sm text-gray-500">You do not have access to this archive.</div>;
  }
  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 size={40} className="animate-spin text-brand-blue" /></div>;

  return (
    <div className="mx-auto w-full max-w-6xl animate-in fade-in duration-300">
      {successMessage && <div role="status" className="fixed right-6 top-24 z-[120] flex items-center gap-2 rounded-xl border border-green-100 bg-white px-4 py-3 text-xs font-semibold text-brand-blue shadow-xl"><CheckCircle2 size={17} className="text-green-600" />{successMessage}</div>}
      {errorMessage && <div role="alert" className="fixed right-6 top-24 z-[120] flex max-w-lg items-start gap-2 rounded-xl border border-red-100 bg-white px-4 py-3 text-xs font-semibold text-red-600 shadow-xl"><AlertCircle size={17} className="shrink-0" />{errorMessage}</div>}
      {restoreTarget && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-brand-blue/60 p-4 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" aria-labelledby="restore-record-title" className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
            <h2 id="restore-record-title" className="font-serif text-2xl text-brand-blue">Restore {config.itemName}?</h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-500"><strong className="text-brand-blue">{nameOf(restoreTarget)}</strong> will return to {config.label} as <strong>Hidden</strong>. You can review it before making it visible on the website.</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setRestoreTarget(null)} disabled={isRestoring} className="flex-1 rounded-xl bg-gray-100 py-3 text-xs font-bold uppercase tracking-widest text-gray-600 hover:bg-gray-200 disabled:opacity-60">Cancel</button>
              <button type="button" onClick={confirmRestore} disabled={isRestoring} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-blue py-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-brand-gold disabled:opacity-60">{isRestoring && <Loader2 size={15} className="animate-spin" />}Restore</button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">{config.label} · Archive</p><h2 className="mt-1 font-serif text-2xl font-bold text-brand-blue">{section}</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">Archived {config.itemName}s are off the website and retained here for restoration.</p></div>
        <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">{records.length} Archived</span>
      </div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-400">Showing <span className="font-semibold text-brand-blue">{filtered.length}</span> of {records.length}</p>
        <div className="relative w-full sm:w-80"><Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" /><input type="search" placeholder={`Search archived ${config.itemName}s...`} value={searchQuery} onChange={event => setSearchQuery(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-brand-blue shadow-sm outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10" /></div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="hidden grid-cols-12 gap-4 border-b border-gray-100 bg-gray-50/70 px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 md:grid"><div className="col-span-6">{config.itemName}</div><div className="col-span-3">Archived</div><div className="col-span-3 text-right">Restore</div></div>
        {filtered.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><Archive size={30} className="mb-3 text-gray-300" /><p className="text-sm font-semibold text-brand-blue">No archived {config.itemName}s</p><p className="mt-1 text-xs text-gray-400">{term ? 'Try another search term.' : `Items you archive from ${config.label} will appear here.`}</p></div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(record => (
              <div key={record.id} className="grid grid-cols-1 items-center gap-4 px-6 py-4 md:grid-cols-12">
                <div className="col-span-6 flex min-w-0 items-center gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-brand-blue/5">{record.image ? <img src={record.image} alt="" className="h-full w-full object-cover" /> : <Archive size={18} className="text-brand-blue/30" />}</div><div className="min-w-0"><p className="truncate text-sm font-bold text-brand-blue">{nameOf(record)}</p><p className="mt-1 truncate text-[10px] text-gray-400">{record.year ?? record.category ?? record.status ?? ''}</p></div></div>
                <div className="col-span-3 text-xs text-gray-500">{typeof record.is_archived === 'string' ? formatDateTime(record.is_archived) : 'Archived'}</div>
                <div className="col-span-3 md:text-right">{checkPerm(config.moduleCode, 'can_edit') && <button type="button" onClick={() => setRestoreTarget(record)} className="rounded-lg border border-brand-blue/15 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-brand-blue hover:bg-brand-blue hover:text-white">Restore</button>}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-4 rounded-2xl border border-brand-blue/10 bg-brand-blue/[0.03] px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-widest text-brand-blue/60">Restore safely</p><p className="mt-1 text-xs leading-relaxed text-gray-500">Restored items return as Hidden with their content intact. Publish them explicitly from the active list.</p></div>
    </div>
  );
}

// --- AUDIT LOGS MANAGER ---
function AuditLogsManager({ checkPerm, canDelete }: ManagerProps & { canDelete: boolean }) {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<AuditLog | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchDetailedAuditLogsAction(sortOrder, page * 50)
      .then(data => { if (!cancelled) { setHasMore(data.length > 50); setLogs(data.slice(0, 50) as AuditLog[]); setErrorMessage(''); } })
      .catch(error => { if (!cancelled) setErrorMessage(error?.message || 'Could not load audit history.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [sortOrder, page, refreshKey]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAuditLogAction(deleteTarget.id);
      setDeleteTarget(null);
      setSelectedLog(null);
      setPage(0);
      setRefreshKey(value => value + 1);
      setSuccessMessage('Audit entry removed. A receipt was recorded.');
      window.setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Could not remove the audit entry.');
    } finally {
      setIsDeleting(false);
    }
  };

  const readableAction = (log: AuditLog) => log.action_type === 'DELETE' && /^archiv/i.test(log.details)
    ? 'ARCHIVED' : log.action_type;
  const valueLabel = (value: unknown) => value == null || value === '' ? '(empty)'
    : typeof value === 'string' ? value : JSON.stringify(value);
  const canOpenLog = (log: AuditLog) => {
    if (!log.target_url?.startsWith('/admin/') || log.target_url.startsWith('//')) return false;
    const codes: Record<string, string> = {
      Projects: 'edit_project', Promotions: 'promotion_code', 'Partner Banks': 'edit_banks',
      'News & Updates': 'edit_news', 'Our Story': 'our_story', 'Navigation Setup': 'edit_project',
    };
    const code = codes[log.entity_type];
    return Boolean(code && checkPerm(code, log.action_type === 'ARCHIVED' ? 'can_view' : 'can_edit'));
  };

  const filteredLogs = logs.filter(log =>
    String(log.entity_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(log.user_email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(log.details || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.action_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-brand-blue" size={40} /></div>;

  return (
    <div className="animate-in fade-in duration-300">
      {successMessage && <div role="status" className="fixed right-6 top-24 z-[120] rounded-xl border border-green-100 bg-white px-4 py-3 text-sm font-semibold text-brand-blue shadow-xl">{successMessage}</div>}
      {deleteTarget && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-brand-blue/60 p-4 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" aria-label="Delete audit entry" className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
            <h2 className="font-serif text-2xl text-brand-blue">Delete audit entry?</h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-500">Entry #{deleteTarget.id} will be removed permanently. A separate receipt will retain who removed it and which entry was removed.</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="flex-1 rounded-xl bg-gray-100 py-3 text-xs font-bold uppercase tracking-widest text-gray-600 disabled:opacity-60">Cancel</button>
              <button type="button" onClick={confirmDelete} disabled={isDeleting} className="flex-1 rounded-xl bg-red-600 py-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-red-700 disabled:opacity-60">{isDeleting ? 'Removing...' : 'Delete entry'}</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="flex items-center gap-4 text-brand-blue/60 font-bold text-xs">
          <History size={16} /> <span className="hidden sm:inline">RECENT ACTIVITY</span>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button
            className={`flex items-center gap-1.5 text-xs font-bold tracking-wider transition-colors cursor-pointer ${sortOrder === 'desc' ? 'text-brand-gold' : 'text-brand-blue hover:text-brand-gold'}`}
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            title={sortOrder === 'desc' ? "Showing Newest First" : "Showing Oldest First"}
          >
            <Filter size={14} />
            {sortOrder === 'desc' ? 'NEWEST' : 'OLDEST'}
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search user, project, or action..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-brand-blue text-sm outline-none focus:border-brand-gold transition-colors shadow-sm" />
        </div>
      </div>

      {errorMessage && <div role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>}
      <div className="w-full overflow-x-auto pb-4">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-12 gap-4 py-4 border-y border-gray-200 text-[10px] font-bold tracking-widest uppercase text-brand-blue/60">
            <div className="col-span-3">Date & Time</div>
            <div className="col-span-3">User</div>
            <div className="col-span-2">Action</div>
            <div className="col-span-4">Details</div>
          </div>

          {selectedLog && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 p-4 backdrop-blur-sm">
              <div role="dialog" aria-modal="true" aria-label="Audit log details" className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-brand-blue">Audit Log Details</h3>
                  <button type="button" onClick={() => setSelectedLog(null)} aria-label="Close audit log" className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900"><X size={20} /></button>
                </div>
                <div className="max-h-[75vh] overflow-y-auto p-6 sm:p-8">
                  <div className="mb-6 grid grid-cols-2 gap-6">
                    <div><p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Date & Time</p><p className="text-sm font-semibold text-gray-900">{formatDateTime(selectedLog.created_at)}</p></div>
                    <div><p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">User</p><p className="break-all text-sm font-semibold text-brand-blue">{selectedLog.user_email}</p></div>
                    <div><p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Action</p><span className="inline-block rounded-md bg-blue-100 px-2 py-1 text-[10px] font-bold uppercase text-brand-blue">{readableAction(selectedLog)}</span></div>
                    <div><p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Content</p><p className="text-sm font-semibold text-brand-blue">{selectedLog.entity_type} › {selectedLog.entity_name}</p></div>
                  </div>
                  <div className="border-t border-gray-100 pt-6">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Change</p>
                    <p className="whitespace-pre-wrap rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm leading-relaxed text-gray-800">{selectedLog.details}</p>
                    {selectedLog.field_key && (
                      <div className="mt-4 rounded-xl border border-gray-100 p-4 text-sm">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-brand-blue/60">Field · {selectedLog.field_key}</p>
                        <p className="break-words text-gray-500"><strong>Before:</strong> {valueLabel(selectedLog.old_value)}</p>
                        <p className="mt-2 break-words text-brand-blue"><strong>After:</strong> {valueLabel(selectedLog.new_value)}</p>
                      </div>
                    )}
                    {canOpenLog(selectedLog) && (
                      <button type="button" onClick={() => router.push(selectedLog.target_url!)} className="mt-5 rounded-lg bg-brand-blue px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-gold">
                        Open {readableAction(selectedLog) === 'ARCHIVED' ? 'archive' : 'edited content'}
                      </button>
                    )}
                    {canDelete && selectedLog.action_type !== 'AUDIT_REMOVED' && (
                      <button type="button" onClick={() => setDeleteTarget(selectedLog)} className="ml-3 mt-5 rounded-lg border border-red-200 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50">Delete entry</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col max-h-[600px] overflow-y-auto">
            {filteredLogs.length === 0 ? <div className="py-12 text-center text-gray-400 text-sm">No activity recorded yet.</div> : filteredLogs.map((log) => (
              <div key={log.id} className="grid grid-cols-12 gap-4 py-4 items-center border-b border-gray-100 hover:bg-gray-50/50 text-sm transition-colors">
                <div className="col-span-3 text-gray-500 text-xs">{formatDateTime(log.created_at)}</div>
                <div className="col-span-3 font-medium text-brand-blue truncate pr-2" title={log.user_email}>{log.user_email}</div>
                <div className="col-span-2">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${log.action_type === 'CREATE' ? 'bg-green-100 text-green-700' :
                    readableAction(log) === 'REMOVED' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                    {log.action_type}
                  </span>
                </div>
                <div
                  onClick={() => setSelectedLog(log)}
                  className="col-span-4 text-gray-600 pr-4 truncate cursor-pointer hover:text-brand-gold transition-colors"
                  title="Click to view full details"
                >
                  <span className="font-semibold text-brand-blue group-hover:text-brand-gold transition-colors">{log.entity_type}: {log.entity_name}</span> - {log.details}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-5 text-xs text-gray-500">
            <span>Showing up to 50 entries per page · Page {page + 1}</span>
            <div className="flex items-center gap-3">
              <button type="button" disabled={page === 0} onClick={() => setPage(current => current - 1)} className="rounded-lg border border-gray-200 px-3 py-2 text-brand-blue disabled:opacity-40">Previous</button>
              <button type="button" disabled={!hasMore} onClick={() => setPage(current => current + 1)} className="rounded-lg border border-gray-200 px-3 py-2 text-brand-blue disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SystemModulesManager() {
  const supabase = createClient();
  const [modules, setModules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchModules = async () => {
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .neq('module_code', 'audit_log')
        .neq('module_code', 'admin_manage')
        .neq('module_code', 'notifications_code')
        .neq('module_code', 'navbar_setup')
        .order('id');

      if (data) setModules(data);
      setIsLoading(false);
    };
    fetchModules();
  }, [supabase]);

  const handleToggle = async (id: number, currentStatus: boolean, moduleName: string) => {
    try {
      const { error } = await supabase.from('modules').update({ is_active: !currentStatus }).eq('id', id);
      if (error) throw error;
      setModules(prev => prev.map(m => m.id === id ? { ...m, is_active: !currentStatus } : m));

      // ✅ SERVER-SIDE AUDIT LOG
      await createAuditLogAction('EDIT', 'Modules', moduleName, `Globally turned module ${!currentStatus ? 'ON' : 'OFF'}`);

    } catch (e: any) { alert(e.message); }
  };

  if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-brand-blue" size={40} /></div>;

  return (
    <div className="animate-in fade-in duration-300 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-xl sm:text-2xl font-serif text-brand-blue mb-2">Module Management</h2>
        <p className="text-sm text-gray-500">Disabling a module here acts as a global kill switch. It will immediately hide the module from the Navigation bar for ALL users and remove it from the public website.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {modules.map(mod => (
          <div key={mod.id} className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-50 hover:bg-gray-50 transition-colors">
            <div>
              <div className="font-bold text-brand-blue uppercase tracking-wide">{mod.module_name.replace(/management/i, '')}</div>
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-md ${mod.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {mod.is_active ? 'Active' : 'Disabled'}
              </span>
              <button
                onClick={() => handleToggle(mod.id, mod.is_active, mod.module_name)}
                className={`p-2.5 bg-white shadow-sm border rounded-lg transition-colors ${mod.is_active ? 'border-green-200 text-green-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600' : 'border-gray-200 text-gray-400 hover:bg-green-50 hover:border-green-200 hover:text-green-600'}`}
                title={mod.is_active ? "Disable Module" : "Enable Module"}
              >
                {mod.is_active ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function NavbarProjectsManager({ checkPerm }: ManagerProps) {
  const router = useRouter();
  const supabase = createClient();
  const [navProjects, setNavProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingData, setEditingData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const showSuccess = (message: string) => {
    setErrorMessage('');
    setSuccessMessage(message);
    window.setTimeout(() => setSuccessMessage(''), 2400);
  };

  const showError = (message: string) => {
    setSuccessMessage('');
    setErrorMessage(message);
    window.setTimeout(() => setErrorMessage(''), 4000);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await handleImageUpload(file);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleImageUpload(file);
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showError('Please upload a valid image file such as PNG, JPG, or WEBP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError('Navigation logos must be 5 MB or smaller.');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `navbar/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      setEditingData((current: any) => ({
        ...current,
        nav_image_url: publicUrl,
      }));
    } catch (error: any) {
      showError(`Logo upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    const fetchNavProjects = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        // Keep the project/navigation relationship complete for legacy data
        // as well as newly created projects.
        await ensureProjectNavigationEntriesAction();
      } catch (syncError: any) {
        console.warn(
          'Navigation link sync failed:',
          syncError
        );
        showError(
          `Some projects could not be linked to navigation automatically: ${
            syncError?.message || 'Unknown error.'
          }`
        );
      }

      const { data, error } = await supabase
        .from('navbar_projects')
        .select('*, project_table(title, is_active, deleted_at)')
        .order('display_order', { ascending: true });

      if (error) {
        showError(`Unable to load navigation items: ${error.message}`);
      } else if (data) {
        const activeProjectNavigationItems = data.filter((item: any) => {
          const linkedProject = Array.isArray(item.project_table)
            ? item.project_table[0]
            : item.project_table;

          return Boolean(linkedProject && !linkedProject.deleted_at);
        });

        setNavProjects(activeProjectNavigationItems);
      }

      setIsLoading(false);
    };

    fetchNavProjects();
  }, [supabase]);

  const handleEditClick = (item: any) => {
    setEditingData({ ...item });
    setEditModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingData) return;

    const trimmedTitle = String(editingData.nav_title || '').trim();
    if (!trimmedTitle) {
      showError('Navigation title is required.');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('navbar_projects')
        .update({
          nav_title: trimmedTitle,
          tagline: String(editingData.tagline || '').trim(),
          nav_image_url: editingData.nav_image_url || null,
          is_active: Boolean(editingData.is_active),
        })
        .eq('id', editingData.id);

      if (error) throw error;

      await createAuditLogAction(
        'EDIT',
        'Navigation Setup',
        trimmedTitle,
        'Updated navigation title, tagline, image, or visibility.'
      );

      setNavProjects(prev =>
        prev.map(item =>
          item.id === editingData.id
            ? {
                ...item,
                nav_title: trimmedTitle,
                tagline: String(editingData.tagline || '').trim(),
                nav_image_url: editingData.nav_image_url || null,
                is_active: Boolean(editingData.is_active),
              }
            : item
        )
      );

      setEditModalOpen(false);
      setEditingData(null);
      showSuccess('Navigation item saved.');
    } catch (error: any) {
      showError(`Failed to save navigation item: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (id: number, currentStatus: boolean, title: string) => {
    if (!checkPerm('edit_project', 'can_edit')) return;

    try {
      await toggleActiveStatus('navbar_projects', id, currentStatus);
      await createAuditLogAction(
        'EDIT',
        'Navigation Setup',
        title,
        `Changed navigation visibility to ${currentStatus ? 'Hidden' : 'Visible'}.`
      );

      setNavProjects(prev =>
        prev.map(item =>
          item.id === id
            ? { ...item, is_active: !currentStatus }
            : item
        )
      );

      showSuccess(`${title} is now ${currentStatus ? 'hidden' : 'visible'} in navigation.`);
    } catch (error: any) {
      showError(`Failed to update visibility: ${error.message}`);
    }
  };

  const persistNavigationOrder = async (items: any[]) => {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const nextOrder = index + 1;

      const { error } = await supabase
        .from('navbar_projects')
        .update({ display_order: nextOrder })
        .eq('id', item.id);

      if (error) throw error;
    }
  };

  const handleDropOnItem = async (targetId: number) => {
    if (
      draggedId === null ||
      draggedId === targetId ||
      isReordering ||
      !checkPerm('edit_project', 'can_edit')
    ) {
      setDraggedId(null);
      return;
    }

    const previous = [...navProjects];
    const fromIndex = previous.findIndex(item => item.id === draggedId);
    const toIndex = previous.findIndex(item => item.id === targetId);

    if (fromIndex < 0 || toIndex < 0) {
      setDraggedId(null);
      return;
    }

    const reordered = [...previous];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    const normalized = reordered.map((item, index) => ({
      ...item,
      display_order: index + 1,
    }));

    setNavProjects(normalized);
    setDraggedId(null);
    setIsReordering(true);

    try {
      await persistNavigationOrder(normalized);
      const oldOrder = previous.map(item => String(item.nav_title || item.project_table?.title || item.id));
      const newOrder = normalized.map(item => String(item.nav_title || item.project_table?.title || item.id));
      await createAuditLogAction(
        'REORDERED',
        'Navigation Setup',
        'Project Navigation',
        `Reordered navigation: ${oldOrder.join(' → ')} to ${newOrder.join(' → ')}.`,
        { fieldKey: 'navigation-order', oldValue: oldOrder, newValue: newOrder }
      );
      showSuccess('Navigation order saved.');
    } catch (error: any) {
      setNavProjects(previous);
      showError(`Failed to save navigation order: ${error.message}`);
    } finally {
      setIsReordering(false);
    }
  };

  const openProjects = () => {
    router.push('/admin/dashboard?section=Projects');
  };

  const openArchivedProjects = () => {
    router.push('/admin/dashboard?section=Archived%20Projects');
  };

  const isProjectAvailable = (item: any) => {
    const project = Array.isArray(item.project_table)
      ? item.project_table[0]
      : item.project_table;

    return Boolean(project && project.is_active && !project.deleted_at);
  };

  const isNavigationEffectivelyVisible = (item: any) =>
    Boolean(item.is_active && isProjectAvailable(item));

  const visibleCount = navProjects.filter(isNavigationEffectivelyVisible).length;
  const hiddenCount = navProjects.length - visibleCount;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-brand-blue" size={40} />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 max-w-6xl mx-auto">
      {successMessage && (
        <div className="fixed top-24 right-8 z-[120] flex items-center gap-2 rounded-xl border border-green-200 bg-white px-4 py-3 shadow-xl">
          <CheckCircle2 size={17} className="text-green-500" />
          <span className="text-xs font-semibold text-brand-blue">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="fixed top-24 right-8 z-[120] flex max-w-md items-start gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 shadow-xl">
          <AlertCircle size={17} className="mt-0.5 shrink-0 text-red-500" />
          <span className="text-xs font-semibold leading-relaxed text-red-600">{errorMessage}</span>
        </div>
      )}


      {editModalOpen && editingData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 backdrop-blur-sm p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 bg-[#f8f9fa] px-6 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold">Navigation Item</p>
                <h3 className="mt-1 text-lg font-serif font-bold text-brand-blue">Edit {editingData.nav_title || 'Project'}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditModalOpen(false);
                  setEditingData(null);
                }}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white hover:text-brand-blue"
                aria-label="Close editor"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-5">
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Navigation Title</label>
                <input
                  type="text"
                  value={editingData.nav_title || ''}
                  onChange={(e) => setEditingData({ ...editingData, nav_title: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-brand-blue outline-none transition-colors focus:border-brand-gold"
                  placeholder="Project name shown in navigation"
                />
                <p className="mt-1.5 text-[10px] leading-relaxed text-gray-400">
                  This is the label visitors see in the website navigation. It can differ from the project&apos;s internal title.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Tagline</label>
                <textarea
                  rows={3}
                  value={editingData.tagline || ''}
                  onChange={(e) => setEditingData({ ...editingData, tagline: e.target.value })}
                  className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm leading-relaxed text-brand-blue outline-none transition-colors focus:border-brand-gold"
                  placeholder="Short supporting line shown with the project"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Navigation Logo</label>
                <div
                  className={`relative flex min-h-52 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed text-center transition-all duration-200 ${
                    isDragging
                      ? 'border-brand-gold bg-brand-gold/5'
                      : 'border-gray-200 hover:border-brand-blue/40 hover:bg-gray-50'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                  />

                  {isUploading ? (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <Loader2 className="animate-spin text-brand-blue" size={30} />
                      <span className="text-xs font-bold uppercase tracking-widest text-brand-blue">Uploading logo...</span>
                    </div>
                  ) : editingData.nav_image_url ? (
                    <div className="relative h-52 w-full bg-gray-100">
                      <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                        <Building2 size={34} />
                      </div>
                      <img
                        src={editingData.nav_image_url}
                        alt={`${editingData.nav_title || 'Project'} navigation logo preview`}
                        className="relative h-full w-full object-contain p-5"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-12 text-left">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white">Click or drag to replace logo</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 px-5 py-8 text-gray-400">
                      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue/5 text-brand-blue">
                        <Upload size={20} />
                      </div>
                      <span className="text-sm font-bold text-brand-blue">Add navigation logo</span>
                      <span className="text-[10px] uppercase tracking-widest">PNG, JPG, WEBP or SVG · max 5 MB</span>
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-start justify-between gap-4">
                  <p className="text-[10px] leading-relaxed text-gray-400">
                    This logo is independent from the project hero image. Transparent PNG, WEBP, or SVG files work best.
                  </p>
                  {editingData.nav_image_url && (
                    <button
                      type="button"
                      onClick={() =>
                        setEditingData({
                          ...editingData,
                          nav_image_url: null,
                        })
                      }
                      className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-red-500 hover:text-red-600"
                    >
                      Remove Logo
                    </button>
                  )}
                </div>
              </div>

              {(() => {
                const linkedProject = Array.isArray(editingData.project_table)
                  ? editingData.project_table[0]
                  : editingData.project_table;
                const projectIsVisible = Boolean(
                  linkedProject?.is_active && !linkedProject?.deleted_at
                );
                const effectiveVisible = Boolean(
                  projectIsVisible && editingData.is_active
                );

                return (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-brand-blue">
                          Visible in website navigation
                        </p>
                        <p className="mt-1 text-[10px] leading-relaxed text-gray-400">
                          {!projectIsVisible
                            ? editingData.is_active
                              ? 'Hidden automatically because the project is hidden. It will return when the project is shown.'
                              : 'The project is hidden, and this navigation item is also intentionally set to stay hidden.'
                            : 'Turn this off to keep the navigation item hidden even while the project itself is shown.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!projectIsVisible) return;
                          setEditingData({
                            ...editingData,
                            is_active: !editingData.is_active,
                          });
                        }}
                        disabled={!projectIsVisible}
                        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                          projectIsVisible
                            ? 'cursor-pointer'
                            : 'cursor-not-allowed'
                        } ${
                          effectiveVisible
                            ? 'bg-green-500 hover:bg-green-600'
                            : 'bg-gray-300 hover:bg-gray-400'
                        } disabled:opacity-70`}
                        aria-pressed={effectiveVisible}
                        aria-label="Toggle navigation visibility"
                        title={
                          projectIsVisible
                            ? 'Toggle navigation visibility'
                            : 'Show the project first to change this setting'
                        }
                      >
                        <span
                          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                            effectiveVisible ? 'left-6' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>

                    {!projectIsVisible && editingData.is_active && (
                      <div className="mt-3 inline-flex rounded-full bg-brand-gold/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-brand-gold">
                        Will show with project
                      </div>
                    )}

                    {!projectIsVisible && !editingData.is_active && (
                      <div className="mt-3 inline-flex rounded-full bg-gray-200 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                        Keep hidden
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="rounded-xl border border-brand-blue/10 bg-brand-blue/[0.03] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-blue/60">Linked Project</p>
                <p className="mt-1 text-sm font-semibold text-brand-blue">{editingData.project_table?.title || 'Project unavailable'}</p>
                <p className="mt-1.5 text-[10px] leading-relaxed text-gray-400">
                  Created automatically with the project. The link stays fixed; hide the item instead of removing it.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditModalOpen(false);
                    setEditingData(null);
                  }}
                  className="rounded-xl bg-gray-200 px-5 py-2.5 text-xs font-bold uppercase text-gray-600 transition-colors hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || isUploading}
                  className="flex min-w-32 items-center justify-center gap-2 rounded-xl bg-brand-blue px-5 py-2.5 text-xs font-bold uppercase text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROJECTS SUB-NAVIGATION */}
      <div className="mb-7 flex items-center gap-6 border-b border-gray-200">
        <button
          type="button"
          onClick={openProjects}
          className="pb-3 text-sm font-medium text-gray-400 transition-colors hover:text-brand-blue"
        >
          Projects
        </button>

        <button
          type="button"
          className="relative pb-3 text-sm font-bold text-brand-blue"
          aria-current="page"
        >
          Navigation Setup
          <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-brand-blue" />
        </button>

        <button
          type="button"
          onClick={openArchivedProjects}
          className="pb-3 text-sm font-medium text-gray-400 transition-colors hover:text-brand-blue"
        >
          Archived
        </button>
      </div>

      {/* PAGE INTRO */}
      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">Projects · Navigation</p>
          <h2 className="mt-2 font-serif text-4xl leading-none text-brand-blue">Website Navigation Order</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
            Every project gets one navigation item automatically. Project visibility temporarily hides its navigation item without overwriting your navigation preference.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            {navProjects.length} Items
          </span>
          <span className="rounded-full border border-green-100 bg-green-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-green-600">
            {visibleCount} Visible
          </span>
          {hiddenCount > 0 && (
            <span className="rounded-full border border-gray-200 bg-gray-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              {hiddenCount} Hidden
            </span>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            <GripVertical size={14} />
            Drag to reorder
          </div>
          {isReordering && (
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-blue">
              <Loader2 size={13} className="animate-spin" />
              Saving order
            </div>
          )}
        </div>

        <div className="space-y-3">
          {navProjects.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-blue/5 text-brand-blue/50">
                <Building2 size={24} />
              </div>
              <h3 className="font-serif text-lg font-bold text-brand-blue">No projects available for navigation</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-400">
                Create a project first. Its linked navigation item will be created automatically and follow the project's website visibility.
              </p>
            </div>
          ) : (
            navProjects.map((item, index) => {
              const canEdit = checkPerm('edit_project', 'can_edit');
              const isBeingDragged = draggedId === item.id;
              const linkedProject = Array.isArray(item.project_table)
                ? item.project_table[0]
                : item.project_table;
              const projectIsVisible = Boolean(
                linkedProject?.is_active && !linkedProject?.deleted_at
              );
              const effectiveVisible = Boolean(
                projectIsVisible && item.is_active
              );

              return (
                <div
                  key={item.id}
                  role={canEdit ? 'button' : undefined}
                  tabIndex={canEdit ? 0 : -1}
                  aria-label={
                    canEdit
                      ? `Edit navigation item for ${item.nav_title || linkedProject?.title || 'project'}`
                      : undefined
                  }
                  draggable={canEdit && !isReordering}
                  onClick={() => {
                    if (canEdit) handleEditClick(item);
                  }}
                  onKeyDown={(event) => {
                    if (!canEdit || event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleEditClick(item);
                    }
                  }}
                  onDragStart={() => setDraggedId(item.id)}
                  onDragEnd={() => setDraggedId(null)}
                  onDragOver={(event) => {
                    if (canEdit) event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleDropOnItem(item.id);
                  }}
                  className={`group grid grid-cols-[auto_1fr] gap-3 rounded-2xl border px-3 py-3 transition-all sm:grid-cols-[auto_80px_1fr_auto] sm:items-center sm:gap-4 sm:px-4 ${
                    isBeingDragged
                      ? 'border-brand-gold bg-brand-gold/5 opacity-60'
                      : canEdit
                        ? 'cursor-pointer border-gray-100 bg-[#fbfbfc] hover:border-brand-blue/20 hover:bg-white hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/20'
                        : 'border-gray-100 bg-[#fbfbfc]'
                  }`}
                >
                  <div className="row-span-2 flex items-center gap-2 sm:row-span-1">
                    <button
                      type="button"
                      onClick={(event) => event.stopPropagation()}
                      className={`flex h-10 w-8 items-center justify-center rounded-lg text-gray-300 transition-colors ${
                        canEdit ? 'cursor-grab hover:bg-white hover:text-brand-gold active:cursor-grabbing' : 'cursor-default'
                      }`}
                      aria-label={`Drag ${item.nav_title} to reorder`}
                      tabIndex={-1}
                    >
                      <GripVertical size={18} />
                    </button>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue text-[11px] font-bold text-white shadow-sm">
                      {index + 1}
                    </div>
                  </div>

                  <div className="relative hidden h-16 w-20 overflow-hidden rounded-xl bg-gray-100 sm:block">
                    <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                      <Building2 size={20} />
                    </div>
                    {item.nav_image_url && (
                      <img
                        src={item.nav_image_url}
                        alt=""
                        className="relative h-full w-full object-contain p-2"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                  </div>

                  <div className="min-w-0 text-left">
                    <div className="flex min-w-0 items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-brand-blue transition-colors group-hover:text-brand-gold sm:text-base">
                        {item.nav_title || item.project_table?.title || 'Untitled Project'}
                      </h3>
                      {!effectiveVisible && (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                          !projectIsVisible && item.is_active
                            ? 'bg-brand-gold/10 text-brand-gold'
                            : 'bg-gray-200 text-gray-500'
                        }`}>
                          {!projectIsVisible && item.is_active
                            ? 'Hidden with project'
                            : 'Hidden'}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500 sm:text-sm">
                      {item.tagline || 'No tagline added yet.'}
                    </p>
                    <p className="mt-1.5 text-[10px] font-medium text-gray-400">
                      Linked to {linkedProject?.title || 'project unavailable'}
                    </p>
                  </div>

                  <div className="col-start-2 flex items-center justify-between gap-3 sm:col-start-auto sm:justify-end">
                    <div className="flex items-center gap-2">
                      <span className={`hidden text-[10px] font-bold uppercase tracking-wider md:inline ${
                        effectiveVisible
                          ? 'text-green-600'
                          : !projectIsVisible && item.is_active
                            ? 'text-brand-gold'
                            : 'text-gray-400'
                      }`}>
                        {effectiveVisible
                          ? 'Visible'
                          : !projectIsVisible && item.is_active
                            ? 'Hidden with project'
                            : 'Hidden'}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!projectIsVisible) return;
                          handleToggleActive(
                            item.id,
                            Boolean(item.is_active),
                            item.nav_title
                          );
                        }}
                        disabled={!canEdit || !projectIsVisible}
                        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                          canEdit && projectIsVisible
                            ? 'cursor-pointer'
                            : 'cursor-not-allowed'
                        } ${
                          effectiveVisible
                            ? 'bg-green-500 hover:bg-green-600'
                            : 'bg-gray-300 hover:bg-gray-400'
                        } ${!canEdit ? 'opacity-50' : ''}`}
                        aria-pressed={effectiveVisible}
                        aria-label={
                          projectIsVisible
                            ? `${effectiveVisible ? 'Hide' : 'Show'} ${item.nav_title} in navigation`
                            : `${item.nav_title} is hidden because its project is hidden`
                        }
                        title={
                          projectIsVisible
                            ? effectiveVisible
                              ? 'Hide from navigation'
                              : 'Show in navigation'
                            : item.is_active
                              ? 'Hidden automatically with the project. It will turn back on when the project is shown.'
                              : 'Project is hidden and this navigation item is intentionally disabled.'
                        }
                      >
                        <span
                          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                            effectiveVisible ? 'left-6' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-brand-blue/10 bg-brand-blue/[0.03] px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-blue/60">Ordering tip</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          The number is managed automatically. Drag a project to a new position instead of typing an order value.
        </p>
      </div>
    </div>
  );
}
// ==========================================
// HOME DASHBOARD
// ==========================================

interface HomeDashboardProps {
  checkPerm: (moduleCode: string, action: string) => boolean;
  onOpenSection: (section: string) => void;
}

function HomeDashboard({
  checkPerm,
  onOpenSection,
}: HomeDashboardProps) {
  const router = useRouter();
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [sectionStates, setSectionStates] = useState<any[]>([]);
  const [originalSectionStates, setOriginalSectionStates] = useState<any[]>([]);
  const [isLoadingSections, setIsLoadingSections] = useState(true);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [isSavingSections, setIsSavingSections] = useState(false);
  const [sectionSaveSuccess, setSectionSaveSuccess] = useState(false);
  const [sectionSaveError, setSectionSaveError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadRecentActivity = async () => {
      if (!checkPerm('audit_log', 'can_view')) { if (isMounted) setIsLoadingLogs(false); return; }
      try {
        const data = await fetchRecentAuditLogsAction(5);

        if (isMounted) {
          setRecentLogs(data as AuditLog[]);
        }
      } catch (error) {
        console.error('Failed to load recent activity:', error);
      } finally {
        if (isMounted) {
          setIsLoadingLogs(false);
        }
      }
    };

    loadRecentActivity();

    return () => {
      isMounted = false;
    };
  }, []);

      useEffect(() => {
      let isMounted = true;

      const loadSectionStates = async () => {
        try {
          const data = await fetchWebsiteSectionStatesAction();

          if (!isMounted) return;

          setSectionStates(data);
          setOriginalSectionStates(data);
        } catch (error) {
          console.error('Failed to load website section states:', error);
        } finally {
          if (isMounted) {
            setIsLoadingSections(false);
          }
        }
      };

      loadSectionStates();

      return () => {
        isMounted = false;
      };
    }, []);

      const sectionCards = [
      {
        label: 'Homepage',
        description: 'Hero, features, and featured content',
        tab: 'Homepage',
        moduleCode: 'homepage_manage',
        moduleName: 'HOMEPAGE',
        icon: House,
      },
      {
        label: 'Our Story',
        description: 'Milestones and company history',
        tab: 'our story',
        moduleCode: 'our_story',
        moduleName: 'OUR STORY',
        icon: BookOpen,
      },
      {
        label: 'Projects',
        description: 'Project pages and developments',
        tab: 'Projects',
        moduleCode: 'edit_project',
        moduleName: 'PROJECTS',
        icon: Building2,
      },
      {
        label: 'Virtual Tours',
        description: 'Towers, units, and 360° views',
        tab: 'Virtual Tours',
        moduleCode: 'virtual_tours',
        moduleName: 'VIRTUAL TOURS',
        icon: Move3d,
      },
      {
        label: 'Partner Banks',
        description: 'Financing partners and offers',
        tab: 'Partner Banks',
        moduleCode: 'edit_banks',
        moduleName: 'BANKS',
        icon: Landmark,
      },
      {
        label: 'News & Updates',
        description: 'Articles and announcements',
        tab: 'News & Updates',
        moduleCode: 'edit_news',
        moduleName: 'NEWS AND UPDATES',
        icon: Newspaper,
      },
      {
        label: 'Promotions',
        description: 'Current offers and promotions',
        tab: 'Promotions',
        moduleCode: 'promotion_code',
        moduleName: 'PROMOTION',
        icon: Megaphone,
      },

    ];

  const visibleCards = sectionCards.filter((card) =>
    checkPerm(card.moduleCode, 'can_view')
  );

const normalizeModuleName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ');


const getModuleForCard = (moduleCode: string) => {
  return sectionStates.find(
    (section) => section.module_code === moduleCode
  );
};


const getOriginalModule = (id: number) => {
  return originalSectionStates.find((section) => section.id === id);
};


const pendingSectionChanges = sectionStates.filter((section) => {
  const original = getOriginalModule(section.id);

  if (!original) return false;

  return original.is_active !== section.is_active;
});


const hasPendingSectionChanges = pendingSectionChanges.length > 0;


const handleSectionVisibilityToggle = (
  e: React.MouseEvent,
  moduleId: number
) => {
  e.stopPropagation();

  setSectionStates((current) =>
    current.map((section) =>
      section.id === moduleId
        ? {
            ...section,
            is_active: !section.is_active,
          }
        : section
    )
  );

  setSectionSaveSuccess(false);
  setSectionSaveError('');
};


const handleResetSectionChanges = () => {
  setSectionStates(
    originalSectionStates.map((section) => ({ ...section }))
  );

  setSectionSaveSuccess(false);
  setSectionSaveError('');
};


const handleSaveSectionChanges = async () => {
  if (pendingSectionChanges.length === 0) {
    return;
  }

  setIsSavingSections(true);

  try {
    await saveWebsiteSectionStatesAction(
  pendingSectionChanges.map((section) => {
    const matchingCard = sectionCards.find(
      (card) => card.moduleCode === section.module_code
    );

    return {
      id: section.id,
      is_active: section.is_active,
      module_name: section.module_name,
      display_name: matchingCard?.label || section.module_name,
    };
  })
);

      setOriginalSectionStates(
        sectionStates.map((section) => ({ ...section }))
      );

      setShowSaveConfirmation(false);
      setSectionSaveSuccess(true);
      setSectionSaveError('');

      if (checkPerm('audit_log', 'can_view')) {
        try {
          const refreshedLogs = await fetchRecentAuditLogsAction(5);
          setRecentLogs(refreshedLogs as AuditLog[]);
        } catch (activityError) {
          console.error('Visibility saved, but recent activity could not refresh:', activityError);
        }
      }

      setTimeout(() => {
        setSectionSaveSuccess(false);
      }, 3000);
    } catch (error: any) {
      console.error('Failed to save website section visibility:', error);
      setSectionSaveError(error?.message || 'Could not save website visibility. Please try again.');
    } finally {
      setIsSavingSections(false);
    }
  };

  const getActivityDestination = (entityType: string) => {
    const destinations: Record<string, string> = {
      'Our Story': 'our story',
      Projects: 'Projects',
      'Virtual Tours': 'Virtual Tours',
      'Partner Banks': 'Partner Banks',
      'News & Updates': 'News & Updates',
      Promotions: 'Promotions',
      'Navbar Setup': 'Navbar Setup',
      'Navigation Setup': 'Navbar Setup',
      Modules: 'Home',
    };

    return destinations[entityType];
  };

  return (
    <div className="mx-auto w-full max-w-[1280px]">

        {showSaveConfirmation && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/55 backdrop-blur-sm p-4">

      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">

        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-serif text-brand-blue mb-2">
            Update website visibility?
          </h2>

          <p className="text-sm text-gray-500 leading-relaxed">
            These changes will take effect on the live website immediately after saving.
          </p>
        </div>

        <div className="p-6 space-y-3 max-h-[300px] overflow-y-auto">
          {pendingSectionChanges.map((section) => (
            <div
              key={section.id}
              className="flex items-center justify-between gap-4 py-2"
            >
              <span className="text-sm font-medium text-brand-blue">
                {sectionCards.find((card) => card.moduleCode === section.module_code)?.label || section.module_name}
              </span>

              <span
                className={`
                  text-[10px]
                  font-bold
                  px-2.5 py-1
                  rounded-md
                  ${
                    section.is_active
                      ? 'bg-green-50 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }
                `}
              >
                {section.is_active
                  ? 'Shown on website'
                  : 'Hidden from website'}
              </span>
            </div>
          ))}
        </div>

        <div className="px-6 py-5 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">

          <button
            type="button"
            disabled={isSavingSections}
            onClick={() => setShowSaveConfirmation(false)}
            className="
              px-4 py-2.5
              rounded-lg
              text-xs font-bold
              text-gray-600
              hover:bg-gray-200
              transition-colors
            "
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isSavingSections}
            onClick={handleSaveSectionChanges}
            className="
              min-w-[120px]
              px-5 py-2.5
              rounded-lg
              bg-brand-blue
              text-white
              text-xs font-bold
              hover:bg-brand-blue/90
              transition-colors
              flex items-center justify-center gap-2
              disabled:opacity-60
            "
          >
            {isSavingSections ? (
              <>
                <Loader2
                  size={14}
                  className="animate-spin"
                />
                Saving...
              </>
            ) : (
              'Save changes'
            )}
          </button>

        </div>
      </div>
    </div>
  )}

      {/* PENDING WEBSITE CHANGES */}
      {hasPendingSectionChanges && (
        <div
          role="alert"
          className="fixed left-1/2 top-24 z-[90] flex w-[calc(100vw-2rem)] max-w-[680px] -translate-x-1/2 flex-col gap-3 rounded-2xl border border-brand-gold/70 bg-[#0f1d40] px-4 py-4 text-white shadow-2xl ring-4 ring-brand-gold/15 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:px-5"
        >
          <div className="min-w-0">
            <div className="text-sm font-bold">
              {pendingSectionChanges.length}{' '}
              {pendingSectionChanges.length === 1 ? 'website change' : 'website changes'} waiting for review
            </div>
            <div className="mt-1 text-xs leading-snug text-white/75">
              Visibility affects the live website. Review and save, or reset your changes.
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleResetSectionChanges}
              disabled={isSavingSections}
              className="
                px-4 py-2
                rounded-lg
                border border-white/20
                text-xs font-bold
                hover:bg-white/10
                transition-colors
                disabled:opacity-50
              "
            >
              Reset
            </button>

            <button
              type="button"
              onClick={() => setShowSaveConfirmation(true)}
              disabled={isSavingSections}
              className="
                px-5 py-2
                rounded-lg
                bg-brand-gold
                text-brand-blue
                text-xs font-bold
                hover:brightness-105
                transition-all
                disabled:opacity-50
              "
            >
              Review &amp; save
            </button>
          </div>
        </div>
      )}

      {sectionSaveSuccess && (
        <div role="status" className="fixed right-5 top-5 z-[120] flex items-center gap-2 rounded-xl border border-green-100 bg-white px-4 py-3 text-xs font-semibold text-green-700 shadow-xl">
          <CheckCircle2 size={17} /> Website visibility updated.
        </div>
      )}
      {sectionSaveError && (
        <div role="alert" className="fixed right-5 top-5 z-[120] flex max-w-sm items-start gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-xs text-red-700 shadow-xl">
          <AlertCircle size={17} className="shrink-0" />
          <span>{sectionSaveError}</span>
          <button type="button" aria-label="Dismiss error" onClick={() => setSectionSaveError('')} className="ml-1 rounded p-0.5 hover:bg-red-50"><X size={14} /></button>
        </div>
      )}
      {/* PAGE INTRO */}
      <div className="mb-5">
        <h2 className="mb-1 font-serif text-2xl text-brand-blue md:text-[26px]">
          Manage Website Sections
        </h2>

        <p className="text-sm text-gray-500">
          Choose a section to manage its content on the website.
        </p>
      </div>

      {/* WEBSITE SECTION CARDS */}
      {visibleCards.length > 0 ? (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleCards.map((card) => {
            const Icon = card.icon;
            const module = getModuleForCard(card.moduleCode);
            const canEditVisibility = Boolean(module) && checkPerm(card.moduleCode, 'can_edit');
            const isShown = module?.is_active !== false;
            const statusReady = !isLoadingSections && Boolean(module);
            const originalModule = module ? getOriginalModule(module.id) : null;
            const hasUnsavedChange = Boolean(originalModule && originalModule.is_active !== module.is_active);

            return (
              <article
                key={card.tab}
                className={`group relative flex min-h-[156px] flex-col rounded-2xl border bg-white p-5 shadow-sm transition-[background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-brand-gold hover:bg-brand-blue hover:shadow-lg focus-within:border-brand-gold focus-within:ring-2 focus-within:ring-brand-gold/25 ${hasUnsavedChange ? 'border-brand-gold/70 ring-1 ring-brand-gold/20' : 'border-gray-200'}`}
              >
                <button
                  type="button"
                  onClick={() => onOpenSection(card.tab)}
                  aria-label={`Open ${card.label}`}
                  className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none"
                />

                <div className="pointer-events-none relative z-[1] flex items-start justify-between gap-2">
                  <Icon size={25} strokeWidth={1.8} aria-hidden="true" className="shrink-0 text-brand-blue transition-colors group-hover:text-white" />
                  <div className="pointer-events-auto relative z-10 shrink-0 text-right">
                    {statusReady ? (
                      canEditVisibility ? (
                        <button
                          type="button"
                          onClick={(event) => handleSectionVisibilityToggle(event, module!.id)}
                          disabled={isSavingSections}
                          aria-pressed={isShown}
                          aria-label={`${isShown ? 'Hide' : 'Show'} ${card.label} on the website`}
                          title="Changes to website visibility take effect after you save"
                          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-1 text-[10px] font-semibold text-gray-600 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold group-hover:text-white group-hover:hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
                        >
                          <span className="whitespace-nowrap">{isShown ? 'Shown on website' : 'Hidden from website'}</span>
                          <span aria-hidden="true" className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${isShown ? 'bg-green-500' : 'bg-gray-300'}`}>
                            <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${isShown ? 'translate-x-4' : ''}`} />
                          </span>
                        </button>
                      ) : (
                        <span className="inline-block py-2 text-[10px] font-semibold text-gray-500 group-hover:text-white/80">{isShown ? 'Shown on website' : 'Hidden from website'}</span>
                      )
                    ) : (
                      <span className="inline-block py-2 text-[10px] font-semibold text-gray-400 group-hover:text-white/70">{isLoadingSections ? 'Loading status...' : 'Status unavailable'}</span>
                    )}
                  </div>
                </div>

                <div className="pointer-events-none relative z-[1] mt-2">
                  <h3 className="text-lg font-semibold leading-tight tracking-tight text-brand-blue transition-colors group-hover:text-white">{card.label}</h3>
                  <p className="mt-1 text-xs leading-snug text-gray-500 transition-colors group-hover:text-white/75">{card.description}</p>
                </div>
                <div className="pointer-events-none relative z-[1] mt-auto flex items-center justify-between gap-2 pt-2">
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-brand-blue transition-colors group-hover:text-white">
                    Open section <ArrowUpRight size={14} aria-hidden="true" />
                  </span>
                  {hasUnsavedChange && <span className="rounded-full border border-brand-gold/40 bg-brand-gold/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-brand-blue group-hover:border-brand-gold/70 group-hover:text-white">Not saved</span>}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">No website sections have been assigned to your account.</p>
        </div>
      )}

      {/* RECENT CHANGES */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg text-brand-blue">
              Recent Changes
            </h3>

            <p className="text-xs text-gray-400 mt-1">
              Latest activity across the website.
            </p>
          </div>

          {checkPerm('audit_log', 'can_view') && (
            <button
              type="button"
              onClick={() => onOpenSection('Audit Logs')}
              className="
                text-xs
                font-bold
                text-brand-blue
                hover:text-brand-gold
                transition-colors
              "
            >
              View all activity
            </button>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">

          {/* TABLE HEADER */}
          <div
            className="
              hidden md:grid
              grid-cols-12
              gap-4
              px-4 py-2
              border-b border-gray-100
              bg-gray-50/70
              text-[10px]
              font-bold
              uppercase
              tracking-widest
              text-gray-400
            "
          >
            <div className="col-span-3">Section</div>
            <div className="col-span-4">Change</div>
            <div className="col-span-2">Edited by</div>
            <div className="col-span-3">Date & Time</div>
          </div>

          {isLoadingLogs ? (
            <div className="flex justify-center items-center py-12">
              <Loader2
                size={24}
                className="animate-spin text-brand-blue"
              />
            </div>
          ) : recentLogs.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              No recent activity yet.
            </div>
          ) : (
            recentLogs.map((log) => {
              const destination = getActivityDestination(log.entity_type);

              return (
                <button
                  key={log.id}
                  type="button"
                  disabled={!destination}
                  onClick={() => {
                    if (destination) {
                      onOpenSection(destination);
                    }
                  }}
                  className={`
                    w-full
                    grid grid-cols-1 md:grid-cols-12
                    gap-1 md:gap-4
                    px-4 py-2
                    border-b border-gray-100
                    last:border-b-0
                    text-left
                    transition-colors
                    ${
                      destination
                        ? 'hover:bg-gray-50 cursor-pointer'
                        : 'cursor-default'
                    }
                  `}
                >
                  <div className="min-w-0 md:col-span-3 lg:flex lg:items-center lg:gap-2">
                    <div className="font-bold text-sm text-brand-blue truncate">
                      {log.entity_type}
                    </div>

                    <div className="mt-0.5 min-w-0 truncate text-xs text-gray-400 lg:mt-0">
                      {log.entity_name}
                    </div>
                  </div>

                  <div className="md:col-span-4 flex items-center gap-3 min-w-0">
                    <span
                      className={`
                        shrink-0
                        text-[9px]
                        font-bold
                        uppercase
                        tracking-wider
                        px-2 py-1
                        rounded-md
                        ${
                          log.action_type === 'DELETE'
                            ? 'bg-red-50 text-red-600'
                            : log.action_type === 'CREATE'
                            ? 'bg-green-50 text-green-600'
                            : 'bg-blue-50 text-blue-600'
                        }
                      `}
                    >
                      {log.action_type}
                    </span>

                    <span className="text-xs text-gray-500 truncate">
                      {log.details}
                    </span>
                  </div>

                  <div className="md:col-span-2 text-xs text-gray-500 self-center">
                    {log.user_email}
                  </div>

                  <div className="md:col-span-3 text-xs text-gray-400 self-center">
                    {formatDateTime(log.created_at)}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}


// Inside app/admin/dashboard/page.tsx

function HomepageManager({ checkPerm }: ManagerProps) {
  const router = useRouter();
  const canEdit = checkPerm('homepage_manage', 'can_edit');

  return (
    <section className="mx-auto w-full max-w-6xl animate-in fade-in duration-300">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-gold">Homepage · Content</p>
          <h2 className="mt-2 font-serif text-4xl text-brand-blue">Homepage</h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            Manage the homepage hero, About Us, development areas, process, awards, video, and news.
          </p>
        </div>
        <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">1 Page</span>
      </div>
      <p className="mb-5 mt-9 text-xs text-gray-400">Select the homepage to manage its website content.</p>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center border-b border-gray-100 bg-gray-50/70 px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <span>Page</span><span className="hidden sm:block">Sections</span><span>Action</span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-6 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-brand-gold/20 bg-brand-blue/5 text-brand-gold"><House size={21} /></div>
            <div className="min-w-0"><h3 className="font-semibold text-brand-blue">Homepage</h3><p className="text-xs text-gray-400">Main website landing page</p></div>
          </div>
          <span className="hidden text-xs leading-relaxed text-gray-500 sm:block">Hero, About Us, developments, process, awards, video, news</span>
          {canEdit ? (
            <button type="button" onClick={() => router.push('/admin/homepage')} className="rounded-lg bg-brand-blue px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-brand-gold hover:text-brand-blue">Open editor</button>
          ) : <span className="text-xs text-gray-400">View only</span>}
        </div>
      </div>
    </section>
  );
}
// ==========================================
// MAIN DASHBOARD WRAPPER
// ==========================================
function AdminMainDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createClient());
  const [isLoading, setIsLoading] = useState(true);
  const [startupError, setStartupError] = useState('');
  const signOutAndRedirect = useCallback(async () => {
    try {
      await logoutAction();
      // Reload the login route after the server has cleared the HttpOnly cookie.
      window.location.replace('/admin');
    } catch (error) {
      console.error('Could not clear the admin session:', error);
      setStartupError('Could not sign out. Please try again.');
      setIsLoading(false);
    }
  }, []);
  const [newsList, setNewsList] = useState<NewsArticle[]>([]);
  const [activeTab, setActiveTab] = useState(
    () => (searchParams.get('section') === 'Homepage Content' ? 'Homepage' : searchParams.get('section')) || 'Home'
  );
  useEffect(() => {
  const requestedSection = searchParams.get('section');

  if (requestedSection) {
    setActiveTab(requestedSection === 'Homepage Content' ? 'Homepage' : requestedSection);
  }
}, [searchParams]);
  const [searchQuery, setSearchQuery] = useState(() => {
          if (typeof window === 'undefined') return '';

          return sessionStorage.getItem('admin-news-search') || '';
        });
        useEffect(() => {
          sessionStorage.setItem(
            'admin-news-search',
            searchQuery
          );
        }, [searchQuery]);
  const [filterCategory, setFilterCategory] = useState('');

  const [articleToArchive, setArticleToArchive] = useState<{ id: string, title: string } | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [pendingNewsStatusId, setPendingNewsStatusId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [newsErrorMessage, setNewsErrorMessage] = useState('');

  const showNewsSuccess = (message: string) => {
    setNewsErrorMessage('');
    setSuccessMessage(message);
    window.setTimeout(() => setSuccessMessage(''), 2500);
  };

  const showNewsError = (message: string) => {
    setSuccessMessage('');
    setNewsErrorMessage(message);
    window.setTimeout(() => setNewsErrorMessage(''), 3500);
  };

  const handleArchiveClick = (id: string, title: string) => {
    setArticleToArchive({ id, title });
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [projectsMenuOpen, setProjectsMenuOpen] = useState(false);
  const sidebarExpanded = isSidebarOpen || isSidebarHovered;
  const [currentUserRole, setCurrentUserRole] = useState('viewer');
  const [userPermissions, setUserPermissions] = useState<Record<string, any> | 'SUPER_ADMIN' | null>(null);

  const checkPerm = (moduleCode: string, action: string) => {
    if (userPermissions === 'SUPER_ADMIN') return true;
    if (!userPermissions || typeof userPermissions === 'string') return false;
    const perms = userPermissions as Record<string, any>;
    if (!perms[moduleCode]) return false;
    return perms[moduleCode][action] === true;
  };

const ALL_MENU_ITEMS = [
  {
    name: 'Homepage',
    icon: House,
    moduleCode: 'homepage_manage'
  },
  {
    name: 'our story',
    icon: BookOpen,
    moduleCode: 'our_story'
  },
  {
    name: 'Projects',
    icon: Building2,
    moduleCode: 'edit_project'
  },
  {
    name: 'Navbar Setup',
    icon: LayoutDashboard,
    moduleCode: 'edit_project'
  },
  {
    name: 'Virtual Tours',
    icon: Move3d,
    moduleCode: 'virtual_tours'
  },
  {
    name: 'Partner Banks',
    icon: Landmark,
    moduleCode: 'edit_banks'
  },
  {
    name: 'News & Updates',
    icon: Newspaper,
    moduleCode: 'edit_news'
  },
  {
    name: 'Promotions',
    icon: Megaphone,
    moduleCode: 'promotion_code'
  },
  // Kept internally even though they are no longer
  // displayed as normal sidebar destinations.
  {
    name: 'Audit Logs',
    icon: History,
    moduleCode: 'audit_log'
  },
  {
    name: 'Modules',
    icon: Settings,
    moduleCode: 'admin_manage'
  },

];

  const allowedMenuItems = ALL_MENU_ITEMS.filter(item => checkPerm(item.moduleCode, 'can_view'));

  useEffect(() => {
    let cancelled = false;
    const withTimeout = async <T,>(request: PromiseLike<T>, label: string): Promise<T> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          Promise.resolve(request),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${label} took too long. Check your connection and try again.`)), 12000);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    };
    const initData = async () => {
      try {
        const userId = await withTimeout(getCustomSession(), 'Checking your session');
        if (cancelled) return;
        if (!userId) {
          setStartupError('Your session has expired. Signing out...');
          await signOutAndRedirect();
          return;
        }

        const rbac = await withTimeout(getRBACProfile(), 'Loading your permissions');
        if (cancelled) return;
        if (!rbac) { setUserPermissions({}); setCurrentUserRole('viewer'); } 
        else {
           if (rbac.permissions === 'SUPER_ADMIN') setUserPermissions('SUPER_ADMIN');
           else setUserPermissions(rbac.permissions as Record<string, any>);
           setCurrentUserRole(rbac.role);

           if (rbac.permissions !== 'SUPER_ADMIN') {
             const perms = rbac.permissions as Record<string, any>; 
             setActiveTab(currentTab => {
               const currentTabModule = ALL_MENU_ITEMS.find(item => item.name === currentTab)?.moduleCode;
               if (currentTabModule && !perms[currentTabModule]?.can_view) {
                 const firstAllowedTab = ALL_MENU_ITEMS.find(item => perms[item.moduleCode]?.can_view === true);
                 return firstAllowedTab ? firstAllowedTab.name : currentTab;
               }
               return currentTab;
             });
           }
        }
        try {
          const { data, error: newsLoadError } = await withTimeout(
            supabase.from('news_updates').select('*').is('is_archived', null).order('date', { ascending: false }),
            'Loading News & Updates'
          );
          if (cancelled) return;
          if (newsLoadError) throw newsLoadError;
          if (data) {
          setNewsList(z.array(NewsArticleSchema).parse(data));
          }
        } catch (error) {
          console.error('Failed to read News & Updates:', error);
          setNewsErrorMessage('Could not load the article list.');
        }
      } catch (error: any) {
        console.error('Dashboard initialization failed:', error);
        if (!cancelled) setStartupError(error?.message || 'Could not load the dashboard.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    initData();
    return () => { cancelled = true; };
  }, [router, supabase, signOutAndRedirect]);

  const handleSignOut = async () => { localStorage.clear(); await signOutAndRedirect(); };

  const confirmArchive = async () => {
    if (!articleToArchive) return;

    const target = articleToArchive;
    setIsArchiving(true);
    setNewsErrorMessage('');

    try {
      await archiveRecord('news_updates', target.id);
      await createAuditLogAction(
        'DELETE',
        'News & Updates',
        target.title,
        'Archived news article.', { entityId: target.id }
      );

      setNewsList(prev => prev.filter(article => article.id !== target.id));
      setArticleToArchive(null);
      showNewsSuccess(`Article "${target.title}" archived.`);
    } catch (error: any) {
      setArticleToArchive(null);
      showNewsError(error?.message || 'Failed to archive article.');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleToggleNewsStatus = async (
    id: string,
    currentStatus: boolean,
    title: string
  ) => {
    if (pendingNewsStatusId) return;
    setPendingNewsStatusId(id);
    try {
      await toggleActiveStatus('news_updates', id, currentStatus);

      const nextStatus = !currentStatus;

      setNewsList(prev =>
        prev.map(article =>
          article.id === id
            ? { ...article, is_active: nextStatus }
            : article
        )
      );

      showNewsSuccess(
        `"${title}" is now ${nextStatus ? 'visible' : 'hidden'} on the website.`
      );

      try {
        await createAuditLogAction(
          'EDIT',
          'News & Updates',
          title,
          `Changed website visibility to ${nextStatus ? 'Visible' : 'Hidden'}.`,
          { entityId: id, fieldKey: 'is_active', oldValue: currentStatus, newValue: nextStatus }
        );
      } catch (auditError) {
        console.error('Article visibility changed, but the audit log failed:', auditError);
      }
    } catch (error: any) {
      showNewsError(error?.message || 'Failed to update article visibility.');
    } finally {
      setPendingNewsStatusId(null);
    }
  };

  const filteredNews = newsList.filter(article => {
    const cat = (article.category || '').toLowerCase();
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const dropdownMatch = filterCategory
      ? cat === filterCategory.toLowerCase()
      : true;
    const searchMatch =
      !normalizedSearch ||
      article.title.toLowerCase().includes(normalizedSearch) ||
      cat.includes(normalizedSearch);

    return dropdownMatch && searchMatch;
  });

  const visibleNewsCount = newsList.filter(
    article => article.is_active === true
  ).length;
  const hiddenNewsCount = newsList.length - visibleNewsCount;

  const openNewsArticle = (id: string) => {
    if (!checkPerm('edit_news', 'can_edit')) return;
    router.push(`/admin/news?edit=${id}`);
  };

  const formatNewsDate = (value: string) => {
    if (!value) return 'No date';

    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) return <div role="status" className="flex min-h-screen items-center justify-center bg-[#F8F9FA] text-sm text-brand-blue">Loading dashboard...</div>;
  if (startupError) return (
    <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F8F9FA] p-6 text-center">
      <p className="text-lg font-semibold text-brand-blue">{startupError}</p>
      <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-brand-blue px-5 py-3 text-sm font-semibold text-white">Try again</button>
      <button type="button" onClick={signOutAndRedirect} className="text-sm text-brand-blue underline">Sign out and go to login</button>
    </div>
  );

const contentMenuItems = allowedMenuItems.filter(
  item =>
    !['Audit Logs', 'Modules', 'Navbar Setup'].includes(item.name)
);
  // Keep the active and archived tabs together for every archivable content module.
  const contentArchiveSection = (Object.keys(archiveSections) as ArchivedContentSection[])
    .find(section => section === activeTab || archiveSections[section].label === activeTab ||
      (section === 'Archived Our Story' && activeTab === 'our story'));


  return (
    <div className="flex h-screen bg-[#F8F9FA] text-gray-900 font-sans overflow-hidden relative">
      {isSidebarOpen && <div className="fixed inset-0 bg-brand-blue/40 backdrop-blur-sm z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} />}

      <aside
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => {
          setIsSidebarHovered(false);

          if (
            activeTab !== 'Projects' &&
            activeTab !== 'Navbar Setup'
          ) {
            setProjectsMenuOpen(false);
          }
        }}
        className={`
          fixed inset-y-0 left-0
          bg-brand-blue
          text-white
          flex flex-col
          shadow-2xl
          z-40
          overflow-hidden

          transition-[width,transform]
          duration-300
          ease-in-out

          ${
            sidebarExpanded
              ? 'w-64'
              : 'w-20'
          }

          ${
            isSidebarOpen
              ? 'translate-x-0'
              : '-translate-x-full'
          }

          md:translate-x-0
        `}
      >

        {/* ===================================== */}
        {/* LOGO */}
        {/* ===================================== */}

        <div
          className="
            h-20
            flex items-center
            border-b border-white/10
            bg-[#0f1d40]
            shrink-0
            overflow-hidden
          "
        >
          {sidebarExpanded ? (
            <img
              src="/images/navigation/GoldenTopperlogo.svg"
              alt="Golden ToPPer"
              className="h-10 w-auto object-contain ml-7"
            />
          ) : (
            <div className="w-20 flex justify-center">
              <div className="w-10 overflow-hidden">
                <img
                  src="/images/navigation/GoldenTopperlogo.svg"
                  alt="Golden ToPPer"
                  className="
                    h-10
                    w-auto
                    max-w-none
                    object-left
                  "
                />
              </div>
            </div>
          )}
        </div>


        {/* ===================================== */}
        {/* MAIN NAVIGATION */}
        {/* ===================================== */}

        <nav
          className={`
            flex-1
            py-6
            overflow-y-auto
            overflow-x-hidden

            ${
              sidebarExpanded
                ? 'px-4'
                : 'px-3'
            }
          `}
        >

          {/* HOME */}
          <button
            type="button"
            title={!sidebarExpanded ? 'Home' : undefined}
            onClick={() => {
              setActiveTab('Home');
              setFilterCategory('');
              setSearchQuery('');
              setProjectsMenuOpen(false);
              setIsSidebarOpen(false);
            }}
            className={`
              w-full
              h-12
              flex items-center
              rounded-xl
              transition-all
              duration-200
              group
              outline-none
              mb-6

              ${
                sidebarExpanded
                  ? 'gap-4 px-4'
                  : 'justify-center'
              }

              ${
                activeTab === 'Home'
                  ? 'bg-white/5 text-brand-gold font-bold shadow-lg'
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
              }
            `}
          >
            <LayoutDashboard
              size={20}
              className={`
                shrink-0
                ${
                  activeTab === 'Home'
                    ? 'text-brand-gold'
                    : 'text-gray-400 group-hover:text-white'
                }
              `}
            />

            {sidebarExpanded && (
              <span
                className="
                  whitespace-nowrap
                  text-[13px]
                  font-bold
                  tracking-widest
                  uppercase
                "
              >
                Home
              </span>
            )}
          </button>


          {/* SECTION LABEL */}
          {sidebarExpanded && (
            <div
              className="
                px-4
                mb-3
                text-[10px]
                font-bold
                tracking-widest
                uppercase
                text-brand-gold/70
                whitespace-nowrap
              "
            >
              Content Management
            </div>
          )}


          {/* CONTENT ITEMS */}
          <div className="space-y-2">
            {contentMenuItems.map((item) => {
              const Icon = item.icon;

              /* ===================================== */
              /* PROJECTS + SUBMENU */
              /* ===================================== */

              if (item.name === 'Projects') {
                const isProjectSection =
                  activeTab === 'Projects' ||
                  activeTab === 'Navbar Setup' ||
                  activeTab === 'Archived Projects';

                const showProjectMenu =
                  sidebarExpanded &&
                  (projectsMenuOpen || isProjectSection);

                return (
                  <div key={item.name}>

                    <button
                      type="button"
                      title={!sidebarExpanded ? 'Projects' : undefined}
                      onClick={() => {
                        setActiveTab('Projects');
                        setFilterCategory('');
                        setSearchQuery('');
                        setProjectsMenuOpen(true);
                        setIsSidebarOpen(false);
                      }}
                      className={`
                        w-full
                        h-12
                        flex items-center
                        rounded-xl
                        transition-all
                        duration-200
                        group
                        outline-none

                        ${
                          sidebarExpanded
                            ? 'gap-4 px-4'
                            : 'justify-center'
                        }

                        ${
                          isProjectSection
                            ? 'bg-white/5 text-brand-gold font-bold'
                            : 'text-gray-300 hover:bg-white/5 hover:text-white'
                        }
                      `}
                    >
                      <Building2
                        size={20}
                        className={`
                          shrink-0
                          ${
                            isProjectSection
                              ? 'text-brand-gold'
                              : 'text-gray-400 group-hover:text-white'
                          }
                        `}
                      />

                      {sidebarExpanded && (
                        <>
                          <span
                            className="
                              flex-1
                              text-left
                              whitespace-nowrap
                              text-[13px]
                              font-bold
                              tracking-widest
                              uppercase
                            "
                          >
                            Projects
                          </span>

                          <ChevronDown
                            size={15}
                            className={`
                              transition-transform duration-200
                              ${
                                showProjectMenu
                                  ? 'rotate-180'
                                  : ''
                              }
                            `}
                          />
                        </>
                      )}
                    </button>


                    {/* PROJECT SUBMENU */}
                    {showProjectMenu && (
                      <div
                        className="
                          ml-6
                          mt-1
                          pl-5
                          border-l
                          border-white/10
                          space-y-1
                        "
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('Projects');
                            setFilterCategory('');
                            setSearchQuery('');
                            setIsSidebarOpen(false);
                          }}
                          className={`
                            w-full
                            text-left
                            px-3 py-2.5
                            rounded-lg
                            text-xs
                            font-medium
                            transition-colors

                            ${
                              activeTab === 'Projects'
                                ? 'text-brand-gold bg-white/5'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }
                          `}
                        >
                          Manage Projects
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('Navbar Setup');
                            setFilterCategory('');
                            setSearchQuery('');
                            setIsSidebarOpen(false);
                          }}
                          className={`
                            w-full
                            text-left
                            px-3 py-2.5
                            rounded-lg
                            text-xs
                            font-medium
                            transition-colors

                            ${
                              activeTab === 'Navbar Setup'
                                ? 'text-brand-gold bg-white/5'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }
                          `}
                        >
                          Navigation Setup
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('Archived Projects');
                            setFilterCategory('');
                            setSearchQuery('');
                            setIsSidebarOpen(false);
                          }}
                          className={`
                            w-full
                            text-left
                            px-3 py-2.5
                            rounded-lg
                            text-xs
                            font-medium
                            transition-colors

                            ${
                              activeTab === 'Archived Projects'
                                ? 'text-brand-gold bg-white/5'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }
                          `}
                        >
                          Archived Projects
                        </button>
                      </div>
                    )}

                  </div>
                );
              }


              /* ===================================== */
              /* NORMAL MENU ITEMS */
              /* ===================================== */

              const isActive = activeTab === item.name ||
                activeTab === `Archived ${item.name}` ||
                (activeTab === 'Archived Our Story' && item.name === 'our story');

              return (
                <button
                  key={item.name}
                  type="button"
                  title={!sidebarExpanded ? item.name : undefined}
                  onClick={() => {
                    setActiveTab(item.name);
                    setFilterCategory('');
                    setSearchQuery('');
                    setProjectsMenuOpen(false);
                    setIsSidebarOpen(false);
                  }}
                  className={`
                    w-full
                    h-12
                    flex items-center
                    rounded-xl
                    transition-all
                    duration-200
                    group
                    outline-none

                    ${
                      sidebarExpanded
                        ? 'gap-4 px-4'
                        : 'justify-center'
                    }

                    ${
                      isActive
                        ? 'bg-white/5 text-brand-gold font-bold'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }
                  `}
                >
                  <Icon
                    size={20}
                    className={`
                      shrink-0

                      ${
                        isActive
                          ? 'text-brand-gold'
                          : 'text-gray-400 group-hover:text-white'
                      }
                    `}
                  />

                  {sidebarExpanded && (
                    <span
                      className="
                        whitespace-nowrap
                        text-[13px]
                        font-bold
                        tracking-widest
                        uppercase
                      "
                    >
                      {item.name === 'our story'
                        ? 'Our Story'
                        : item.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>


        {/* ===================================== */}
        {/* BOTTOM ACTIONS */}
        {/* ===================================== */}

        <div
          className={`
            py-4
            border-t border-white/10
            bg-[#0f1d40]/50

            ${
              sidebarExpanded
                ? 'px-4'
                : 'px-3'
            }
          `}
        >
          <button
            type="button"
            title={!sidebarExpanded ? 'Sign Out' : undefined}
            onClick={handleSignOut}
            className={`
              w-full
              h-12
              flex items-center
              rounded-xl
              text-red-400/80
              hover:text-red-400
              hover:bg-red-400/10
              transition-colors
              outline-none

              ${
                sidebarExpanded
                  ? 'gap-4 px-4'
                  : 'justify-center'
              }
            `}
          >
            <LogOut
              size={18}
              className="shrink-0"
            />

            {sidebarExpanded && (
              <span
                className="
                  text-xs
                  font-bold
                  uppercase
                  tracking-widest
                  whitespace-nowrap
                "
              >
                Sign Out
              </span>
            )}
          </button>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden md:ml-20">
        {articleToArchive && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 p-4 backdrop-blur-sm">
            <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl bg-white p-8 shadow-2xl">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500 shadow-inner">
                <AlertCircle size={32} />
              </div>

              <h2 className="text-center font-serif text-2xl font-bold text-brand-blue">
                Archive Article?
              </h2>

              <p className="text-center text-sm leading-relaxed text-gray-500">
                <strong className="text-brand-blue">
                  {articleToArchive.title}
                </strong>{' '}
                will be removed from the active News & Updates list and from the public website.
              </p>

              <div className="mt-3 flex w-full gap-3">
                <button
                  type="button"
                  onClick={() => setArticleToArchive(null)}
                  disabled={isArchiving}
                  className="flex-1 rounded-xl bg-gray-100 py-3 text-xs font-bold uppercase tracking-widest text-gray-700 hover:bg-gray-200 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={confirmArchive}
                  disabled={isArchiving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {isArchiving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    'Archive'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="fixed top-24 right-6 z-[120] max-w-sm rounded-2xl border border-green-100 bg-white px-4 py-3 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
                <CheckCircle2 size={17} />
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-green-700">
                  Updated
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  {successMessage}
                </p>
              </div>
            </div>
          </div>
        )}

        {newsErrorMessage && (
          <div className="fixed top-24 right-6 z-[120] max-w-sm rounded-2xl border border-red-100 bg-white px-4 py-3 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500">
                <AlertCircle size={17} />
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-red-600">
                  Could not update
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  {newsErrorMessage}
                </p>
              </div>
            </div>
          </div>
        )}

        <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0 shadow-sm">
          <div className="flex items-center gap-6 min-w-0">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-brand-blue"><Menu size={24} /></button>
            <h1 className="text-2xl md:text-3xl font-serif text-brand-blue truncate">
              {activeTab === 'Home'
                ? 'Dashboard'
                : activeTab === 'our story'
                ? 'Our Story'
                : activeTab === 'Navbar Setup'
                ? 'Navigation Setup'
                : activeTab === 'Archived Projects'
                ? 'Projects'
                : Object.prototype.hasOwnProperty.call(archiveSections, activeTab)
                ? archiveSections[activeTab as ArchivedContentSection].label
                : activeTab}
            </h1>
            {activeTab === 'Projects' && checkPerm('edit_project', 'can_create') && <button onClick={() => router.push('/admin/projects')} className="flex items-center gap-2 px-4 py-2.5 bg-brand-blue text-white text-[10px] font-bold uppercase rounded-lg hover:bg-brand-gold"><Plus size={14} /> Add Project</button>}
            {activeTab === 'Promotions' && checkPerm('promotion_code', 'can_create') && <button onClick={() => router.push('/admin/promotions')} className="flex items-center gap-2 px-4 py-2.5 bg-brand-blue text-white text-[10px] font-bold uppercase rounded-lg hover:bg-brand-gold"><Plus size={14} /> Add Promo</button>}
            {activeTab === 'Partner Banks' && checkPerm('edit_banks', 'can_create') && <button onClick={() => router.push('/admin/partnerbanks')} className="flex items-center gap-2 px-4 py-2.5 bg-brand-blue text-white text-[10px] font-bold uppercase rounded-lg hover:bg-brand-gold"><Plus size={14} /> Add Bank</button>}
            {activeTab === 'our story' && checkPerm('our_story', 'can_create') && <button onClick={() => router.push('/admin/story')} className="flex items-center gap-2 px-4 py-2.5 bg-brand-blue text-white text-[10px] font-bold uppercase rounded-lg hover:bg-brand-gold"><Plus size={14} /> Add Milestone</button>}
            {activeTab === 'News & Updates' && checkPerm('edit_news', 'can_create') && <Link href="/admin/news" className="flex items-center gap-2 px-4 py-2.5 bg-brand-blue text-white text-[10px] font-bold uppercase rounded-lg hover:bg-brand-gold"><Plus size={14} /> Add Article</Link>}
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {checkPerm('notifications_code', 'can_view') && <NotificationCenter />}
            {currentUserRole === 'admin' && <><div className="w-px h-6 bg-gray-200"></div><button onClick={() => router.push('/admin/users')} className="flex items-center gap-2 p-2 text-brand-blue hover:bg-gray-100 rounded-lg"><UserCircle2 size={24} /><span className="text-[10px] font-bold uppercase tracking-widest">Admin</span></button></>}
          </div>
        </header>

                <div className={`min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable] ${activeTab === 'Home' ? 'px-4 py-4 sm:px-6 sm:py-5 xl:px-8' : 'p-8'}`}>
          {contentArchiveSection && (
            <div className="mx-auto w-full max-w-6xl">
              <ContentArchiveTabs
                section={contentArchiveSection}
                archived={activeTab === contentArchiveSection}
                checkPerm={checkPerm}
              />
            </div>
          )}
          {activeTab === 'Home' ? (
            <HomeDashboard
              checkPerm={checkPerm}
              onOpenSection={(section) => {
                setActiveTab(section);
                setFilterCategory('');
                setSearchQuery('');
              }}
            />
          ) : allowedMenuItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center"><div className="w-20 h-20 bg-brand-blue/5 rounded-full flex justify-center items-center mb-6"><ShieldAlert size={32} className="text-brand-blue/40" /></div><h2 className="text-2xl font-serif text-brand-blue mb-3">No Access</h2><p className="text-gray-500 text-sm">Please contact your Super Admin to request access.</p></div>
        ): activeTab === 'Modules' ? <SystemModulesManager />
          : activeTab === 'Homepage' ? <HomepageManager checkPerm={checkPerm} />
          : activeTab === 'Projects' ? <ProjectsManager checkPerm={checkPerm} />
          : activeTab === 'Virtual Tours' ? <VirtualToursManager checkPerm={checkPerm} />
          : activeTab === 'Navbar Setup' ? <NavbarProjectsManager checkPerm={checkPerm} />
          : activeTab === 'Archived Projects' ? <ArchivedProjectsManager checkPerm={checkPerm} />
          : activeTab === 'Promotions' ? <PromotionsManager checkPerm={checkPerm} />
          : activeTab === 'Partner Banks' ? <PartnerBanksManager checkPerm={checkPerm} />
          : activeTab === 'our story' ? <OurStoryManager checkPerm={checkPerm} />
          : activeTab === 'Audit Logs' ? <AuditLogsManager checkPerm={checkPerm} canDelete={userPermissions === 'SUPER_ADMIN'} />
          : Object.prototype.hasOwnProperty.call(archiveSections, activeTab) ? <ArchivedContentManager section={activeTab as ArchivedContentSection} checkPerm={checkPerm} />
          : (
            <div className="mx-auto w-full max-w-6xl animate-in fade-in duration-300">
              <div className="mb-7">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-gold">
                      Content · News & Updates
                    </p>

                    <h2 className="mt-2 font-serif text-4xl leading-none text-brand-blue">
                      News & Updates
                    </h2>

                    <p className="mt-3 text-sm leading-relaxed text-gray-500">
                      Manage published company news and updates, including article content,
                      publication details, featured images, and website visibility.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      {newsList.length} {newsList.length === 1 ? 'article' : 'articles'}
                    </span>

                    <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-green-700">
                      {visibleNewsCount} visible
                    </span>

                    {hiddenNewsCount > 0 && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        {hiddenNewsCount} hidden
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-sm font-bold text-brand-blue">
                      Showing {filteredNews.length} of {newsList.length}
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      Select an article row to edit its content.
                    </p>
                  </div>

                  <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                    <div className="relative w-full sm:w-48">
                      <Filter
                        size={16}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <select
                        value={filterCategory}
                        onChange={(event) => setFilterCategory(event.target.value)}
                        className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-brand-blue shadow-sm outline-none transition-all focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10"
                      >
                        <option value="">All categories</option>
                        <option value="News">News</option>
                        <option value="Updates">Updates</option>
                      </select>
                    </div>

                    <div className="relative w-full sm:w-80">
                      <Search
                        size={16}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="text"
                        placeholder="Search articles..."
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-brand-blue shadow-sm outline-none transition-all focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full overflow-x-auto pb-4">
                <div className="min-w-[900px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="grid grid-cols-12 gap-4 border-b border-gray-100 bg-gray-50/70 px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    <div className="col-span-4">Article</div>
                    <div className="col-span-2">Category</div>
                    <div className="col-span-2">Published</div>
                    <div className="col-span-3">Website Visibility</div>
                    <div className="col-span-1 text-right">Archive</div>
                  </div>

                  {filteredNews.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-blue/5 text-brand-blue/40">
                        <Newspaper size={22} />
                      </div>
                      <p className="text-sm font-bold text-brand-blue">
                        {newsList.length === 0 ? 'No articles yet' : 'No articles found'}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {newsList.length === 0
                          ? 'Use Add Article to create the first News & Updates entry.'
                          : 'Try another search term or category.'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {filteredNews.map((article) => {
                        const canEditNews = checkPerm('edit_news', 'can_edit');
                        const isVisible = article.is_active === true;

                        return (
                          <div
                            key={article.id}
                            role={canEditNews ? 'button' : undefined}
                            tabIndex={canEditNews ? 0 : -1}
                            onClick={() => {
                              if (canEditNews) openNewsArticle(article.id);
                            }}
                            onKeyDown={(event) => {
                              if (!canEditNews) return;
                              if (event.target !== event.currentTarget) return;
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                openNewsArticle(article.id);
                              }
                            }}
                            className={`group grid grid-cols-12 items-center gap-4 px-6 py-4 transition-colors ${
                              canEditNews
                                ? 'cursor-pointer hover:bg-gray-50/80 focus:bg-gray-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold/60'
                                : ''
                            }`}
                          >
                            <div className="col-span-4 flex min-w-0 items-center gap-4">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50 shadow-sm">
                                {article.image ? (
                                  <img
                                    src={article.image}
                                    alt=""
                                    className="h-full w-full object-cover"
                                    onError={(event) => {
                                      event.currentTarget.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <LayoutDashboard size={18} className="text-gray-300" />
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate text-sm font-bold text-brand-blue transition-colors group-hover:text-brand-gold">
                                  {article.title}
                                </div>
                                <div className="mt-1 truncate text-[10px] text-gray-400">
                                  /{article.slug}
                                </div>
                              </div>
                            </div>

                            <div className="col-span-2">
                              <span className="inline-flex rounded-lg bg-brand-gold/10 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-brand-gold">
                                {article.category || 'News'}
                              </span>
                            </div>

                            <div className="col-span-2 text-xs font-medium text-gray-500">
                              {formatNewsDate(article.date)}
                            </div>

                            <div className="col-span-3">
                              <button
                                type="button"
                                disabled={!canEditNews || pendingNewsStatusId !== null}
                                aria-pressed={isVisible}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleToggleNewsStatus(
                                    article.id,
                                    isVisible,
                                    article.title
                                  );
                                }}
                                className={`inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider ${
                                  canEditNews
                                    ? 'cursor-pointer'
                                    : 'cursor-not-allowed opacity-60'
                                }`}
                                title={
                                  isVisible
                                    ? 'Hide this article from the website'
                                    : 'Show this article on the website'
                                }
                              >
                                <span className={isVisible ? 'text-green-700' : 'text-gray-400'}>
                                  {isVisible ? 'Visible' : 'Hidden'}
                                </span>

                                <span
                                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                                    isVisible ? 'bg-green-500' : 'bg-gray-300'
                                  } ${canEditNews ? 'hover:ring-4 hover:ring-brand-blue/5' : ''}`}
                                  aria-hidden="true"
                                >
                                  <span
                                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                                      isVisible ? 'translate-x-5' : 'translate-x-0.5'
                                    }`}
                                  />
                                </span>
                              </button>
                            </div>

                            <div className="col-span-1 flex justify-end">
                              {checkPerm('edit_news', 'can_delete') && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleArchiveClick(article.id, article.title);
                                  }}
                                  className="rounded-lg p-2 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                                  title={`Archive ${article.title}`}
                                  aria-label={`Archive ${article.title}`}
                                >
                                  <Archive size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-brand-blue/10 bg-brand-blue/[0.03] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-blue/60">
                  Visibility & archiving
                </p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  Hiding an article keeps it available in the CMS while removing it from the public website.
                  Archiving removes it from the active News & Updates list.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AdminMainDashboard() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
          <Loader2 className="animate-spin text-brand-blue" size={40} />
        </div>
      }
    >
      <AdminMainDashboardContent />
    </Suspense>
  );
}
