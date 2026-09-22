// app/admin/dashboard/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import {
  LogOut, Building2, Landmark, LayoutDashboard, Search, Filter,
  Edit2, Trash2, Plus, Loader2, Eye, EyeOff, History, Move3d,
  Bell, CheckCircle2, X, Mail, MailOpen, CornerUpLeft, Menu, UserCircle2, Megaphone, Settings, ShieldAlert, AlertCircle, BookOpen, Upload, ChevronDown, GripVertical
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { toggleActiveStatus, archiveRecord } from '@/app/actions/updates';
import {
  fetchAdminProjectsList,
  ensureProjectNavigationEntriesAction,
  hideProjectNavigationEntryAction,
  setProjectWebsiteVisibilityAction,
} from '@/app/actions/projects';
import {
  fetchAdminVirtualToursList,
  fetchAdminPromotionsList,
  fetchAdminBanksList,
  fetchAdminStoryList,
  deleteRecordAction,
  toggleVirtualTourStatus,
  createAuditLogAction,
  fetchRecentAuditLogsAction,
  fetchNotificationsAction,
  fetchWebsiteSectionStatesAction,
  saveWebsiteSectionStatesAction,
  toggleNotificationReadAction
} from '@/app/actions/admin_fetchers';
import { getCustomSession, getCurrentUser, logoutAction, getRBACProfile } from '@/app/actions/auth';


// --- SCHEMAS & TYPES ---
const NewsArticleSchema = z.object({ id: z.string(), title: z.string(), category: z.string(), date: z.string(), slug: z.string(), excerpt: z.string(), image: z.string(), created_at: z.string().optional(), is_active: z.boolean().optional() });
type NewsArticle = z.infer<typeof NewsArticleSchema>;
interface Project {
  id: number;
  title: string;
  city: string;
  status: string;
  is_active: boolean;
  image: string;
}
interface Bank { id: number; bank_name: string; max_loan: string; terms: string; image: string; is_active: boolean; }
interface AuditLog { id: number; created_at: string; user_email: string; action_type: string; entity_type: string; entity_name: string; details: string; }

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
      // A project and its navigation item are tied together. Hide the
      // navigation entry first so an archived project can never leave a
      // visible navigation card pointing to unavailable content.
      await hideProjectNavigationEntryAction(projectToArchive.id);
      await archiveRecord('project_table', projectToArchive.id, 'deleted_at');

      // ✅ SERVER-SIDE AUDIT LOG
      await createAuditLogAction(
        'DELETE',
        'Projects',
        projectToArchive.title,
        'Deleted project from dashboard and hid its linked navigation item.'
      );

      setProjects(prevProjects => prevProjects.filter(p => p.id !== projectToArchive.id));
      setProjectToArchive(null);
      setSuccessMessage(`Project "${projectToArchive.title}" successfully deleted.`);
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
          : 'Changed project website visibility to Hidden. Linked navigation is automatically hidden while preserving its saved visibility preference.'
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
            <h2 className="text-2xl font-serif text-brand-blue text-center font-bold">Delete Project?</h2>
            <p className="text-gray-600 text-center text-sm font-medium leading-relaxed">
              Are you sure you want to delete{' '}
              <strong>{projectToArchive.title}</strong>?
              It will be removed from the admin project list.
            </p>

            <div className="flex gap-3 w-full mt-4">
              <button type="button" onClick={() => setProjectToArchive(null)} disabled={isArchiving} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-xs uppercase tracking-widest outline-none">Cancel</button>
              <button type="button" onClick={confirmArchive} disabled={isArchiving} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors text-xs uppercase tracking-widest flex items-center justify-center gap-2 outline-none">
                {isArchiving ? <Loader2 size={16} className="animate-spin" /> : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === SUCCESS MODAL === */}
      {successMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 backdrop-blur-sm animate-in fade-in duration-300 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-3 max-w-sm w-full animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-2 shadow-inner">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-2xl font-serif text-brand-blue text-center font-bold">Success!</h2>
            <p className="text-gray-600 text-center font-medium text-sm">{successMessage}</p>
          </div>
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
      </div>

      {/* PAGE INTRO */}
      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">Projects · Content</p>
          <h2 className="mt-1 text-2xl font-serif font-bold text-brand-blue">Project Website Content</h2>
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


          {/* DELETE */}
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
                title={`Delete ${proj.title}`}
                aria-label={`Delete ${proj.title}`}
              >
                <Trash2 size={16} />
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

// --- VIRTUAL TOURS MANAGER ---
function VirtualToursManager({ checkPerm }: ManagerProps) {
  const router = useRouter();
  const [tours, setTours] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [tourToArchive, setTourToArchive] = useState<{ id: number, title: string } | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const fetchTours = async () => {
      try {
        const data = await fetchAdminVirtualToursList();
        setTours(data || []);
      } catch (error) { console.error(error); } finally { setIsLoading(false); }
    };
    fetchTours();
  }, []);

  const handleArchiveClick = (id: number, title: string) => {
    setTourToArchive({ id, title });
  };

  const confirmArchive = async () => {
    if (!tourToArchive) return;
    setIsArchiving(true);
    try {
      await deleteRecordAction('virtual_tours', tourToArchive.id);

      // ✅ SERVER-SIDE AUDIT LOG
      await createAuditLogAction('DELETE', 'Virtual Tours', tourToArchive.title, 'Deleted 360 virtual tour.');

      setTours(prev => prev.filter(t => t.id !== tourToArchive.id));
      setTourToArchive(null);
      setSuccessMessage(`Tour "${tourToArchive.title}" deleted.`);
      setTimeout(() => setSuccessMessage(''), 2500);
    } catch (error: any) {
      alert(`Failed to delete: ${error.message}`);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: string, title: string) => {
    try {
      const newStatus = currentStatus === 'Active' ? 'Hidden' : 'Active';
      await toggleVirtualTourStatus(id, newStatus);

      // ✅ SERVER-SIDE AUDIT LOG
      await createAuditLogAction('EDIT', 'Virtual Tours', title, `Changed active status to ${newStatus}.`);

      setTours(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    } catch (error: any) { alert(`Failed to toggle: ${error.message}`); }
  };

  const filtered = tours.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));

  if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-brand-blue" size={40} /></div>;

  return (
    <div className="animate-in fade-in duration-300">
      {/* Archive Modal */}
      {tourToArchive && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-2"><AlertCircle size={40} /></div>
            <h2 className="text-2xl font-serif text-brand-blue font-bold">Delete Tour?</h2>
            <p className="text-gray-600 text-center text-sm font-medium">Permanently delete <strong>{tourToArchive.title}</strong>?</p>
            <div className="flex gap-3 w-full mt-4">
              <button onClick={() => setTourToArchive(null)} className="flex-1 py-3 bg-gray-100 font-bold rounded-xl text-xs uppercase">Cancel</button>
              <button onClick={confirmArchive} disabled={isArchiving} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl text-xs uppercase flex items-center justify-center">
                {isArchiving ? <Loader2 size={16} className="animate-spin" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-3 max-w-sm w-full">
            <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-2"><CheckCircle2 size={40} /></div>
            <h2 className="text-2xl font-serif text-brand-blue font-bold">Success!</h2>
            <p className="text-gray-600 text-sm">{successMessage}</p>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div className="text-sm font-medium"><span className="text-brand-blue font-bold">Showing ({filtered.length})</span> | Virtual Tours</div>
        <div className="relative w-72">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search tours..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:border-brand-gold" />
        </div>
      </div>

      <div className="w-full overflow-x-auto pb-4">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-12 gap-4 py-4 border-y border-gray-200 text-[10px] font-bold tracking-widest uppercase text-brand-blue/60">
            <div className="col-span-4">Tour Title</div>
            <div className="col-span-3">Linked Project</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3 text-right">Actions</div>
          </div>

          <div className="flex flex-col">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">
                No virtual tours found. Click 'Add Tour' to create one.
              </div>
            ) : (
              filtered.map((tour) => {
                const firstRoomImage = tour.rooms && tour.rooms.length > 0 ? tour.rooms[0].image : null;

                return (
                  <div key={tour.id} className="grid grid-cols-12 gap-4 py-4 items-center border-b border-gray-100 hover:bg-gray-50 transition-colors group">

                    <div className="col-span-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded bg-gray-200 overflow-hidden shrink-0">
                        <img src={firstRoomImage || 'https://via.placeholder.com/150'} alt={tour.title} className="w-full h-full object-cover" />
                      </div>
                      <span className="font-bold text-sm text-brand-blue truncate">{tour.title}</span>
                    </div>

                    <div className="col-span-3 text-sm text-gray-500 truncate">
                      {tour.project_table ? (Array.isArray(tour.project_table) ? tour.project_table[0]?.title : tour.project_table?.title) : 'None'}
                    </div>

                    <div className="col-span-2">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${tour.status === 'Active' ? 'bg-brand-gold/10 text-brand-gold' : 'bg-gray-100 text-gray-500'} px-3 py-1.5 rounded-md`}>
                        {tour.status}
                      </span>
                    </div>

                    <div className="col-span-3 flex items-center justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      {checkPerm('virtual_tours', 'can_edit') && (
                        <Link 
                          href={`/admin/virtualtours?project=${tour.project_id || tour.id}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white shadow-sm border border-gray-200 text-brand-blue hover:bg-brand-blue hover:text-white rounded-lg transition-colors text-xs font-bold uppercase tracking-wider"
                        >
                          <Edit2 size={13} />
                          <span>Manage Tours</span>
                        </Link>
                      )}
                      {checkPerm('virtual_tours', 'can_delete') && (
                        <button 
                          onClick={() => handleArchiveClick(tour.id, tour.title)} 
                          className="p-2 bg-white shadow-sm border border-gray-200 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
                          title="Delete Project Tours"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
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

  const [promoToArchive, setPromoToArchive] = useState<{ id: number, title: string } | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const fetchPromos = async () => {
      try {
        const data = await fetchAdminPromotionsList();
        setPromotions(data || []);
      } catch (error) { console.error(error); } finally { setIsLoading(false); }
    };
    fetchPromos();
  }, []);

  const handleArchiveClick = (id: number, title: string) => {
    setPromoToArchive({ id, title });
  };

  const confirmArchive = async () => {
    if (!promoToArchive) return;
    setIsArchiving(true);

    try {
      await archiveRecord('promotions', promoToArchive.id, 'is_archived');

      // ✅ SERVER-SIDE AUDIT LOG
      await createAuditLogAction('DELETE', 'Promotions', promoToArchive.title, 'Archived promotion. (Soft Delete)');

      setPromotions(prev => prev.filter(p => p.id !== promoToArchive.id));
      setPromoToArchive(null);
      setSuccessMessage(`Promotion "${promoToArchive.title}" successfully deleted.`);
      setTimeout(() => setSuccessMessage(''), 2500);

    } catch (error: any) {
      alert(`Failed to archive promotion: ${error.message}`);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean, title: string) => {
    try {
      await toggleActiveStatus('promotions', id, currentStatus);

      // ✅ SERVER-SIDE AUDIT LOG
      await createAuditLogAction('EDIT', 'Promotions', title, `Changed active status to ${!currentStatus ? 'Visible' : 'Hidden'}.`);

      setPromotions(prev => prev.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
    } catch (error: any) { alert(`Failed to toggle: ${error.message}`); }
  };

  const filtered = promotions.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));

  if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-brand-blue" size={40} /></div>;

  return (
    <div className="animate-in fade-in duration-300">
      {/* === ARCHIVE CONFIRMATION MODAL === */}
      {promoToArchive && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 backdrop-blur-sm animate-in fade-in duration-300 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center shadow-inner mb-2">
              <AlertCircle size={40} />
            </div>
            <h2 className="text-2xl font-serif text-brand-blue text-center font-bold">Delete Promotion?</h2>
            <p className="text-gray-600 text-center text-sm font-medium">
              Are you sure you want to delete <strong>{promoToArchive.title}</strong>? It will no longer be visible on the public site.
            </p>

            <div className="flex gap-3 w-full mt-4">
              <button
                type="button"
                onClick={() => setPromoToArchive(null)}
                disabled={isArchiving}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-xs uppercase tracking-widest outline-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmArchive}
                disabled={isArchiving}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors text-xs uppercase tracking-widest flex items-center justify-center gap-2 outline-none"
              >
                {isArchiving ? <Loader2 size={16} className="animate-spin" /> : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === SUCCESS MODAL === */}
      {successMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 backdrop-blur-sm animate-in fade-in duration-300 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-3 max-w-sm w-full animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-2 shadow-inner">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-2xl font-serif text-brand-blue text-center font-bold">Success!</h2>
            <p className="text-gray-600 text-center font-medium text-sm">{successMessage}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="text-sm text-brand-blue/70 font-medium"><span className="text-brand-blue font-bold">Showing ({filtered.length})</span> <span className="mx-2 hidden sm:inline">|</span><br className="sm:hidden" /> Active Promos</div>
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search promotions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-brand-blue text-sm focus:border-brand-gold outline-none shadow-sm" />
        </div>
      </div>

      <div className="w-full overflow-x-auto pb-4">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-12 gap-4 py-4 border-y border-gray-200 text-[10px] font-bold tracking-widest uppercase text-brand-blue/60">
            <div className="col-span-5">Promotion Title</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3">Validity</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          <div className="flex flex-col">
            {filtered.length === 0 ? <div className="py-12 text-center text-gray-400 text-sm">No promotions found.</div> : filtered.map((promo) => (
              <div key={promo.id} className="grid grid-cols-12 gap-4 py-4 items-center border-b border-gray-100 hover:bg-gray-50/50 transition-colors group">

                <div className="col-span-5">
                  {checkPerm('promotion_code', 'can_edit') ? (
                    <button onClick={() => router.push(`/admin/promotions?edit=${promo.id}`)} className="text-brand-blue font-bold text-sm hover:text-brand-gold text-left">{promo.title}</button>
                  ) : (
                    <span className="text-brand-blue font-bold text-sm text-left">{promo.title}</span>
                  )}
                </div>

                <div className="col-span-2"><span className="text-[10px] font-bold uppercase tracking-widest px-2 sm:px-3 py-1.5 rounded-md bg-brand-gold/10 text-brand-gold">{promo.status}</span></div>
                <div className="col-span-3 text-xs sm:text-sm text-gray-500 font-medium">{promo.validity_date}</div>

                <div className="col-span-2 flex justify-end gap-1 sm:gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  {checkPerm('promotion_code', 'can_edit') && (
                    <button onClick={() => handleToggleStatus(promo.id, promo.is_active, promo.title)} className={`p-1.5 sm:p-2 bg-white shadow-sm border rounded-lg ${promo.is_active ? 'border-green-200 text-green-600' : 'border-gray-200 text-gray-400'}`}>{promo.is_active ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                  )}
                  {checkPerm('promotion_code', 'can_edit') && (
                    <button onClick={() => router.push(`/admin/promotions?edit=${promo.id}`)} className="p-1.5 sm:p-2 bg-white shadow-sm border border-gray-200 text-brand-blue hover:bg-brand-blue hover:text-white rounded-lg transition-colors"><Edit2 size={14} /></button>
                  )}
                  {checkPerm('promotion_code', 'can_delete') && (
                    <button onClick={() => handleArchiveClick(promo.id, promo.title)} className="p-1.5 sm:p-2 bg-white shadow-sm border border-gray-200 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors"><Trash2 size={14} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
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
      } catch (error) { console.error(error); } finally { setIsLoading(false); }
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

      // ✅ SERVER-SIDE AUDIT LOG
      await createAuditLogAction('DELETE', 'Partner Banks', bankToArchive.name, 'Archived bank. (Soft Delete)');

      setBanks(prev => prev.filter(b => b.id !== bankToArchive.id));
      setBankToArchive(null);
      setSuccessMessage(`Bank "${bankToArchive.name}" successfully deleted.`);
      setTimeout(() => setSuccessMessage(''), 2500);

    } catch (error: any) {
      alert(`Failed to archive bank: ${error.message}`);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleToggleBank = async (id: number, currentStatus: boolean, bankName: string) => {
    try {
      await toggleActiveStatus('banks', id, currentStatus);

      // ✅ SERVER-SIDE AUDIT LOG
      await createAuditLogAction('EDIT', 'Partner Banks', bankName, `Changed active status to ${!currentStatus ? 'Visible' : 'Hidden'}.`);

      setBanks(prev => prev.map(b => b.id === id ? { ...b, is_active: !currentStatus } : b));
    } catch (error: any) { alert(`Failed to toggle status: ${error.message}`); }
  };

  const filteredBanks = banks.filter(bank => bank.bank_name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-brand-blue" size={40} /></div>;

  return (
    <div className="animate-in fade-in duration-300">

      {/* === ARCHIVE CONFIRMATION MODAL === */}
      {bankToArchive && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 backdrop-blur-sm animate-in fade-in duration-300 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center shadow-inner mb-2">
              <AlertCircle size={40} />
            </div>
            <h2 className="text-2xl font-serif text-brand-blue text-center font-bold">Delete Bank?</h2>
            <p className="text-gray-600 text-center text-sm font-medium">
              Are you sure you want to delete <strong>{bankToArchive.name}</strong>? It will no longer be visible on the public site.
            </p>

            <div className="flex gap-3 w-full mt-4">
              <button
                type="button"
                onClick={() => setBankToArchive(null)}
                disabled={isArchiving}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-xs uppercase tracking-widest outline-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmArchive}
                disabled={isArchiving}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors text-xs uppercase tracking-widest flex items-center justify-center gap-2 outline-none"
              >
                {isArchiving ? <Loader2 size={16} className="animate-spin" /> : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === SUCCESS MODAL === */}
      {successMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 backdrop-blur-sm animate-in fade-in duration-300 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-3 max-w-sm w-full animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-2 shadow-inner">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-2xl font-serif text-brand-blue text-center font-bold">Success!</h2>
            <p className="text-gray-600 text-center font-medium text-sm">{successMessage}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="text-sm text-brand-blue/70 font-medium"><span className="text-brand-blue font-bold">Showing ({filteredBanks.length})</span> <span className="mx-2 hidden sm:inline">|</span><br className="sm:hidden" /> Active Banks</div>
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search banks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-brand-blue text-sm focus:border-brand-gold outline-none shadow-sm" />
        </div>
      </div>

      <div className="w-full overflow-x-auto pb-4">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-12 gap-4 py-4 border-y border-gray-200 text-[10px] font-bold tracking-widest uppercase text-brand-blue/60">
            <div className="col-span-5">Bank Name</div>
            <div className="col-span-2">Max Loan</div>
            <div className="col-span-3">Terms</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          <div className="flex flex-col">
            {filteredBanks.length === 0 ? <div className="py-12 text-center text-gray-400 text-sm">No banks found.</div> : filteredBanks.map((bank) => (
              <div key={bank.id} className="grid grid-cols-12 gap-4 py-4 items-center border-b border-gray-100 hover:bg-gray-50/50 transition-colors group">

                <div className="col-span-5 flex items-center gap-3 sm:gap-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-white shadow-sm border border-gray-100 overflow-hidden flex items-center justify-center p-1 shrink-0"><img src={bank.image} alt={bank.bank_name} className="w-full h-full object-contain" /></div>
                  {checkPerm('edit_banks', 'can_edit') ? (
                    <button onClick={() => router.push(`/admin/partnerbanks?edit=${bank.id}`)} className="text-brand-blue font-bold text-sm hover:text-brand-gold text-left">{bank.bank_name}</button>
                  ) : (
                    <span className="text-brand-blue font-bold text-sm text-left">{bank.bank_name}</span>
                  )}
                </div>

                <div className="col-span-2"><span className="text-[10px] font-bold uppercase tracking-widest px-2 sm:px-3 py-1.5 rounded-md bg-green-50 text-green-600 border border-green-100">{bank.max_loan}% MAX</span></div>
                <div className="col-span-3 text-xs sm:text-sm text-gray-500 font-medium truncate pr-4">{bank.terms}</div>

                <div className="col-span-2 flex justify-end gap-1 sm:gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  {checkPerm('edit_banks', 'can_edit') && (
                    <button onClick={() => handleToggleBank(bank.id, bank.is_active, bank.bank_name)} className={`p-1.5 sm:p-2 bg-white shadow-sm border rounded-lg ${bank.is_active ? 'border-green-200 text-green-600' : 'border-gray-200 text-gray-400'}`}>{bank.is_active ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                  )}
                  {checkPerm('edit_banks', 'can_edit') && (
                    <button onClick={() => router.push(`/admin/partnerbanks?edit=${bank.id}`)} className="p-1.5 sm:p-2 bg-white shadow-sm border border-gray-200 text-brand-blue hover:bg-brand-blue hover:text-white rounded-lg transition-colors"><Edit2 size={14} /></button>
                  )}
                  {checkPerm('edit_banks', 'can_delete') && (
                    <button onClick={() => handleArchiveClick(bank.id, bank.bank_name)} className="p-1.5 sm:p-2 bg-white shadow-sm border border-gray-200 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
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

  const [milestoneToArchive, setMilestoneToArchive] = useState<{ id: number, title: string } | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const fetchMilestones = async () => {
      try {
        const data = await fetchAdminStoryList();
        setMilestones(data || []);
      } catch (error) { console.error(error); } finally { setIsLoading(false); }
    };
    fetchMilestones();
  }, []);

  const handleArchiveClick = (id: number, title: string) => {
    setMilestoneToArchive({ id, title });
  };

  const confirmArchive = async () => {
    if (!milestoneToArchive) return;
    setIsArchiving(true);

    try {
      await archiveRecord('our story', milestoneToArchive.id, 'is_archived');

      // ✅ SERVER-SIDE AUDIT LOG
      await createAuditLogAction('DELETE', 'Our Story', milestoneToArchive.title, 'Archived milestone.');

      setMilestones(prev => prev.filter(m => m.id !== milestoneToArchive.id));
      setMilestoneToArchive(null);
      setSuccessMessage(`Milestone successfully deleted.`);
      setTimeout(() => setSuccessMessage(''), 2500);

    } catch (error: any) {
      alert(`Failed to archive milestone: ${error.message}`);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean, title: string) => {
    try {
      await toggleActiveStatus('our story', id, currentStatus);

      // ✅ SERVER-SIDE AUDIT LOG
      await createAuditLogAction('EDIT', 'Our Story', title, `Changed active status to ${!currentStatus ? 'Visible' : 'Hidden'}.`);

      setMilestones(prev => prev.map(m => m.id === id ? { ...m, is_active: !currentStatus } : m));
    } catch (error: any) { alert(`Failed to toggle status: ${error.message}`); }
  };

  const filtered = milestones.filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()) || m.year.toString().includes(searchQuery));

  if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-brand-blue" size={40} /></div>;

  return (
    <div className="animate-in fade-in duration-300">
      {/* === ARCHIVE CONFIRMATION MODAL === */}
      {milestoneToArchive && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 backdrop-blur-sm animate-in fade-in duration-300 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center shadow-inner mb-2"><AlertCircle size={40} /></div>
            <h2 className="text-2xl font-serif text-brand-blue text-center font-bold">Delete Milestone?</h2>
            <p className="text-gray-600 text-center text-sm font-medium">Are you sure you want to delete <strong>{milestoneToArchive.title}</strong>?</p>
            <div className="flex gap-3 w-full mt-4">
              <button type="button" onClick={() => setMilestoneToArchive(null)} disabled={isArchiving} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-xs uppercase tracking-widest outline-none">Cancel</button>
              <button type="button" onClick={confirmArchive} disabled={isArchiving} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors text-xs uppercase tracking-widest flex items-center justify-center gap-2 outline-none">
                {isArchiving ? <Loader2 size={16} className="animate-spin" /> : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === SUCCESS MODAL === */}
      {successMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 backdrop-blur-sm animate-in fade-in duration-300 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-3 max-w-sm w-full animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-2 shadow-inner"><CheckCircle2 size={40} /></div>
            <h2 className="text-2xl font-serif text-brand-blue text-center font-bold">Success!</h2>
            <p className="text-gray-600 text-center font-medium text-sm">{successMessage}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="text-sm text-brand-blue/70 font-medium"><span className="text-brand-blue font-bold">Showing ({filtered.length})</span> <span className="mx-2 hidden sm:inline">|</span><br className="sm:hidden" /> Active Milestones</div>
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search milestones..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-brand-blue text-sm focus:border-brand-gold outline-none shadow-sm" />
        </div>
      </div>

      <div className="w-full overflow-x-auto pb-4">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-12 gap-4 py-4 border-y border-gray-200 text-[10px] font-bold tracking-widest uppercase text-brand-blue/60">
            <div className="col-span-2">Year</div>
            <div className="col-span-4">Title</div>
            <div className="col-span-4">Description</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          <div className="flex flex-col">
            {filtered.length === 0 ? <div className="py-12 text-center text-gray-400 text-sm">No milestones found.</div> : filtered.map((m) => (
              <div key={m.id} className="grid grid-cols-12 gap-4 py-4 items-center border-b border-gray-100 hover:bg-gray-50/50 transition-colors group">
                <div className="col-span-2 font-serif text-xl font-bold text-brand-gold pl-2">{m.year}</div>

                <div className="col-span-4 flex items-center gap-3 sm:gap-4 pr-4">
                  <div className="w-10 h-10 rounded-lg bg-gray-200 overflow-hidden shrink-0 shadow-sm">
                    <img src={m.image || 'https://via.placeholder.com/150?text=No+Image'} alt={m.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="font-bold text-sm text-brand-blue truncate flex-1">
                    {m.title}
                  </div>
                </div>

                <div className="col-span-4 text-xs text-gray-500 truncate pr-4">{m.description}</div>

                <div className="col-span-2 flex justify-end gap-1 sm:gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  {checkPerm('our_story', 'can_edit') && (
                    <button onClick={() => handleToggleStatus(m.id, m.is_active, m.title)} className={`p-1.5 sm:p-2 bg-white shadow-sm border rounded-lg ${m.is_active !== false ? 'border-green-200 text-green-600' : 'border-gray-200 text-gray-400'}`}>{m.is_active !== false ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                  )}
                  {checkPerm('our_story', 'can_edit') && (
                    <button onClick={() => router.push(`/admin/story?edit=${m.id}`)} className="p-1.5 sm:p-2 bg-white shadow-sm border border-gray-200 text-brand-blue hover:bg-brand-blue hover:text-white rounded-lg transition-colors"><Edit2 size={14} /></button>
                  )}
                  {checkPerm('our_story', 'can_delete') && (
                    <button onClick={() => handleArchiveClick(m.id, m.title)} className="p-1.5 sm:p-2 bg-white shadow-sm border border-gray-200 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors"><Trash2 size={14} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- AUDIT LOGS MANAGER ---
function AuditLogsManager() {
  const supabase = createClient();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: sortOrder === 'asc' })
        .limit(100);

      if (!error && data) setLogs(data);
      setIsLoading(false);
    };
    fetchLogs();
  }, [supabase, sortOrder]);

  const filteredLogs = logs.filter(log =>
    log.entity_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.action_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-brand-blue" size={40} /></div>;

  return (
    <div className="animate-in fade-in duration-300">
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

      <div className="w-full overflow-x-auto pb-4">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-12 gap-4 py-4 border-y border-gray-200 text-[10px] font-bold tracking-widest uppercase text-brand-blue/60">
            <div className="col-span-3">Date & Time</div>
            <div className="col-span-3">User</div>
            <div className="col-span-2">Action</div>
            <div className="col-span-4">Details</div>
          </div>

          {selectedLog && (
            <div className="fixed inset-0 bg-brand-blue/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-[#f8f9fa]">
                  <h3 className="text-brand-blue font-bold text-sm tracking-widest uppercase">Audit Log Details</h3>
                  <button onClick={() => setSelectedLog(null)} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors outline-none">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 sm:p-8">
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Date & Time</div>
                      <div className="text-sm font-semibold text-gray-900">{formatDateTime(selectedLog.created_at)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">User</div>
                      <div className="text-sm font-semibold text-brand-blue break-all">{selectedLog.user_email}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Action Type</div>
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md inline-block mt-1 ${selectedLog.action_type === 'CREATE' ? 'bg-green-100 text-green-700' :
                        selectedLog.action_type === 'DELETE' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                        {selectedLog.action_type}
                      </span>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Entity</div>
                      <div className="text-sm font-semibold text-gray-900">{selectedLog.entity_type}: {selectedLog.entity_name}</div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-6">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Full Details</div>
                    <div className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap bg-gray-50 p-4 sm:p-5 rounded-xl border border-gray-100 shadow-inner">
                      {selectedLog.details}
                    </div>
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
                    log.action_type === 'DELETE' ? 'bg-red-100 text-red-700' :
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
        setNavProjects(data);
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
      await createAuditLogAction(
        'EDIT',
        'Navigation Setup',
        'Project Navigation',
        'Reordered projects in the website navigation.'
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
      </div>

      {/* PAGE INTRO */}
      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">Projects · Navigation</p>
          <h2 className="mt-1 text-2xl font-serif font-bold text-brand-blue">Website Navigation Order</h2>
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
                  draggable={canEdit && !isReordering}
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
                      : 'border-gray-100 bg-[#fbfbfc] hover:border-brand-blue/15 hover:bg-white hover:shadow-sm'
                  }`}
                >
                  <div className="row-span-2 flex items-center gap-2 sm:row-span-1">
                    <button
                      type="button"
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

                  <button
                    type="button"
                    onClick={() => canEdit && handleEditClick(item)}
                    className={`min-w-0 text-left ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
                  >
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
                  </button>

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
                        onClick={() => {
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

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleEditClick(item)}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-brand-blue transition-all hover:border-brand-gold hover:text-brand-gold"
                      >
                        <Edit2 size={13} />
                        Edit
                      </button>
                    )}
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
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [sectionStates, setSectionStates] = useState<any[]>([]);
  const [originalSectionStates, setOriginalSectionStates] = useState<any[]>([]);
  const [isLoadingSections, setIsLoadingSections] = useState(true);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [isSavingSections, setIsSavingSections] = useState(false);
  const [sectionSaveSuccess, setSectionSaveSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadRecentActivity = async () => {
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
        label: 'Our Story',
        tab: 'our story',
        moduleCode: 'our_story',
        moduleName: 'OUR STORY',
        icon: BookOpen,
      },
      {
        label: 'Projects',
        tab: 'Projects',
        moduleCode: 'edit_project',
        moduleName: 'PROJECTS',
        icon: Building2,
      },
      {
        label: 'Virtual Tours',
        tab: 'Virtual Tours',
        moduleCode: 'virtual_tours',
        moduleName: 'VIRTUAL TOURS',
        icon: Move3d,
      },
      {
        label: 'Partner Banks',
        tab: 'Partner Banks',
        moduleCode: 'edit_banks',
        moduleName: 'BANKS',
        icon: Landmark,
      },
      {
        label: 'News & Updates',
        tab: 'News & Updates',
        moduleCode: 'edit_news',
        moduleName: 'NEWS AND UPDATES',
        icon: LayoutDashboard,
      },
      {
        label: 'Promotions',
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
};


const handleResetSectionChanges = () => {
  setSectionStates(
    originalSectionStates.map((section) => ({ ...section }))
  );

  setSectionSaveSuccess(false);
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

      const refreshedLogs = await fetchRecentAuditLogsAction(5);
      setRecentLogs(refreshedLogs as AuditLog[]);

      setTimeout(() => {
        setSectionSaveSuccess(false);
      }, 3000);
    } catch (error: any) {
      console.error('Failed to save website section visibility:', error);
      alert(
        `Failed to save changes: ${
          error?.message || 'Unknown error'
        }`
      );
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
    <div className="max-w-7xl mx-auto animate-in fade-in duration-300">

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
                {section.module_name}
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
          className="
            sticky top-0 z-30
            mb-6
            flex flex-col sm:flex-row
            sm:items-center
            justify-between
            gap-4
            bg-[#0f1d40]
            text-white
            px-5 py-4
            rounded-2xl
            shadow-xl
            border border-white/10
          "
        >
          <div>
            <div className="text-sm font-bold">
              {pendingSectionChanges.length}{' '}
              {pendingSectionChanges.length === 1 ? 'change' : 'changes'} not saved
            </div>

            <div className="text-xs text-white/60 mt-1">
              The live website will not change until you save.
            </div>
          </div>

          <div className="flex items-center gap-3">
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
              Save changes
            </button>
          </div>
        </div>
      )}

            {sectionSaveSuccess && (
        <div className="mb-6 flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
          <CheckCircle2 size={17} />
          Website visibility updated successfully.
        </div>
      )}
      {/* PAGE INTRO */}
      <div className="mb-8">
        <h2 className="text-2xl md:text-3xl font-serif text-brand-blue mb-2">
          Manage Website Sections
        </h2>

        <p className="text-sm text-gray-500">
          Choose a section to manage its content on the website.
        </p>
      </div>

      {/* WEBSITE SECTION CARDS */}
      {visibleCards.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mb-12">
          {visibleCards.map((card) => {
          const Icon = card.icon;
          const module = getModuleForCard(card.moduleCode);

          const isShown = module?.is_active !== false;

          return (
            <div
              key={card.tab}
              role="button"
              tabIndex={0}
              onClick={() => onOpenSection(card.tab)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onOpenSection(card.tab);
                }
              }}
              className={`
                group
                relative
                min-h-[160px]
                bg-white
                border
                rounded-2xl
                p-6
                text-left
                shadow-sm
                hover:shadow-md
                transition-all
                duration-200
                outline-none
                focus-visible:ring-2
                focus-visible:ring-brand-gold
                cursor-pointer
                ${
                  isShown
                    ? 'border-gray-200 hover:border-brand-gold/60'
                    : 'border-gray-200 bg-gray-50/70'
                }
              `}
            >
              <div className="flex items-start justify-between gap-4">

                <div
                  className={`
                    w-11 h-11
                    rounded-xl
                    flex items-center justify-center
                    transition-colors
                    ${
                      isShown
                        ? 'bg-brand-blue/5 text-brand-blue group-hover:bg-brand-blue group-hover:text-brand-gold'
                        : 'bg-gray-100 text-gray-400'
                    }
                  `}
                >
                  <Icon size={21} />
                </div>

                {module && checkPerm(card.moduleCode, 'can_edit') && (
                  <button
                    type="button"
                    onClick={(e) =>
                      handleSectionVisibilityToggle(e, module.id)
                    }
                    className="
                      flex items-center gap-2
                      rounded-full
                      px-3 py-1.5
                      hover:bg-gray-50
                      transition-colors
                      outline-none
                    "
                    title={
                      isShown
                        ? 'Hide this section from the website'
                        : 'Show this section on the website'
                    }
                  >
                    <span
                      className={`
                        text-[10px]
                        font-bold
                        ${
                          isShown
                            ? 'text-green-700'
                            : 'text-gray-500'
                        }
                      `}
                    >
                      {isShown
                        ? 'Shown on website'
                        : 'Hidden from website'}
                    </span>

                    <span
                      className={`
                        relative
                        inline-flex
                        h-5 w-9
                        shrink-0
                        rounded-full
                        transition-colors
                        ${
                          isShown
                            ? 'bg-green-500'
                            : 'bg-gray-300'
                        }
                      `}
                    >
                      <span
                        className={`
                          absolute top-0.5
                          h-4 w-4
                          rounded-full
                          bg-white
                          shadow-sm
                          transition-transform
                          ${
                            isShown
                              ? 'translate-x-[18px]'
                              : 'translate-x-0.5'
                          }
                        `}
                      />
                    </span>
                  </button>
                )}
              </div>

              <div className="absolute left-6 right-6 bottom-6 flex items-end justify-between gap-4">
                <h3
                  className={`
                    text-lg font-bold
                    ${
                      isShown
                        ? 'text-brand-blue'
                        : 'text-gray-500'
                    }
                  `}
                >
                  {card.label}
                </h3>

                <span
                  className="
                    text-brand-blue/30
                    group-hover:text-brand-gold
                    group-hover:translate-x-1
                    transition-all
                    text-xl
                  "
                >
                  →
                </span>
              </div>
            </div>
          );
        })}
        </div>
      ) : (
        <div className="mb-12 bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <p className="text-sm text-gray-500">
            No website sections have been assigned to your account.
          </p>
        </div>
      )}

      {/* RECENT CHANGES */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-serif text-brand-blue">
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
              px-6 py-3
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
                    gap-2 md:gap-4
                    px-6 py-4
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
                  <div className="md:col-span-3">
                    <div className="font-bold text-sm text-brand-blue truncate">
                      {log.entity_type}
                    </div>

                    <div className="text-xs text-gray-400 truncate mt-1">
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
// ==========================================
// MAIN DASHBOARD WRAPPER
// ==========================================
export default function AdminMainDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(true);
  const [newsList, setNewsList] = useState<NewsArticle[]>([]);
  const [activeTab, setActiveTab] = useState(
    () => searchParams.get('section') || 'Home'
  );
  useEffect(() => {
  const requestedSection = searchParams.get('section');

  if (requestedSection) {
    setActiveTab(requestedSection);
  }
}, [searchParams]);
  const [searchQuery, setSearchQuery] = useState(() => {
          if (typeof window === 'undefined') return '';

          return sessionStorage.getItem('admin-projects-search') || '';
        });
        useEffect(() => {
          sessionStorage.setItem(
            'admin-projects-search',
            searchQuery
          );
        }, [searchQuery]);
  const [filterCategory, setFilterCategory] = useState('');

  const [articleToArchive, setArticleToArchive] = useState<{ id: string, title: string } | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
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
    icon: LayoutDashboard,
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
  }
];

  const allowedMenuItems = ALL_MENU_ITEMS.filter(item => checkPerm(item.moduleCode, 'can_view'));

  useEffect(() => {
    const initData = async () => {
      const userId = await getCustomSession();
      if (!userId) { router.replace('/admin'); return; }

      try {
        const rbac = await getRBACProfile();
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
      } catch (error) { setUserPermissions({}); setCurrentUserRole('viewer'); }

      const { data } = await supabase.from('news_updates').select('*').is('is_archived', null).order('date', { ascending: false });
      if (data) try { setNewsList(z.array(NewsArticleSchema).parse(data)); } catch (e) { }

      setIsLoading(false);
    };
    initData();
  }, [router, supabase]);

  const handleSignOut = async () => { localStorage.clear(); await logoutAction(); router.replace('/admin'); router.refresh(); };

  const confirmArchive = async () => {
    if (!articleToArchive) return;
    setIsArchiving(true);
    try {
      await archiveRecord('news_updates', articleToArchive.id);
      await createAuditLogAction('DELETE', 'News & Updates', articleToArchive.title, 'Archived news article.');
      setNewsList(prev => prev.filter(a => a.id !== articleToArchive.id));
      setArticleToArchive(null);
      setSuccessMessage(`Article deleted.`);
      setTimeout(() => setSuccessMessage(''), 2500);
    } catch (error: any) { alert(`Failed to archive: ${error.message}`); } finally { setIsArchiving(false); }
  };

  const handleToggleNewsStatus = async (id: string, currentStatus: boolean, title: string) => {
    try {
      await toggleActiveStatus('news_updates', id, currentStatus !== false);
      await createAuditLogAction('EDIT', 'News & Updates', title, `Changed active status.`);
      setNewsList(newsList.map(article => article.id === id ? { ...article, is_active: currentStatus === false } : article));
    } catch (error: any) { alert(`Failed to toggle: ${error.message}`); }
  };

  const filteredNews = newsList.filter(article => {
    const cat = (article.category || '').toLowerCase();
    const dropdownMatch = filterCategory ? cat === filterCategory.toLowerCase() : true;
    const searchMatch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) || cat.includes(searchQuery.toLowerCase());
    return dropdownMatch && searchMatch;
  });

  if (isLoading) return <div className="min-h-screen bg-[#F8F9FA]" />;

const contentMenuItems = allowedMenuItems.filter(
  item =>
    !['Audit Logs', 'Modules', 'Navbar Setup'].includes(item.name)
);

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
                  activeTab === 'Navbar Setup';

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
                      </div>
                    )}

                  </div>
                );
              }


              /* ===================================== */
              /* NORMAL MENU ITEMS */
              /* ===================================== */

              const isActive = activeTab === item.name;

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

      <main className="flex-1 flex flex-col overflow-hidden relative md:ml-20">
        {articleToArchive && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 backdrop-blur-sm p-4">
            <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full"><AlertCircle size={40} className="text-red-500 mb-2"/>
              <h2 className="text-2xl font-serif text-brand-blue font-bold">Delete Article?</h2>
              <div className="flex gap-3 w-full mt-4">
                <button onClick={() => setArticleToArchive(null)} disabled={isArchiving} className="flex-1 py-3 bg-gray-100 font-bold rounded-xl text-xs uppercase">Cancel</button>
                <button onClick={confirmArchive} disabled={isArchiving} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl text-xs uppercase flex justify-center">{isArchiving ? <Loader2 size={16} className="animate-spin" /> : 'Yes'}</button>
              </div>
            </div>
          </div>
        )}
        {successMessage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 backdrop-blur-sm p-4">
            <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-3 max-w-sm w-full"><CheckCircle2 size={40} className="text-green-500 mb-2"/>
              <h2 className="text-2xl font-serif text-brand-blue font-bold">Success!</h2><p className="text-gray-600 text-sm">{successMessage}</p>
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
                : activeTab}
            </h1>
            {activeTab === 'Projects' && checkPerm('edit_project', 'can_create') && <button onClick={() => router.push('/admin/projects')} className="flex items-center gap-2 px-4 py-2.5 bg-brand-blue text-white text-[10px] font-bold uppercase rounded-lg hover:bg-brand-gold"><Plus size={14} /> Add Project</button>}
            {activeTab === 'Virtual Tours' && checkPerm('virtual_tours', 'can_create') && <button onClick={() => router.push('/admin/virtualtours')} className="flex items-center gap-2 px-4 py-2.5 bg-brand-blue text-white text-[10px] font-bold uppercase rounded-lg hover:bg-brand-gold"><Plus size={14} /> Add Tour</button>}
            {activeTab === 'Promotions' && checkPerm('promotion_code', 'can_create') && <button onClick={() => router.push('/admin/promotions')} className="flex items-center gap-2 px-4 py-2.5 bg-brand-blue text-white text-[10px] font-bold uppercase rounded-lg hover:bg-brand-gold"><Plus size={14} /> Add Promo</button>}
            {activeTab === 'Partner Banks' && checkPerm('edit_banks', 'can_create') && <button onClick={() => router.push('/admin/partnerbanks')} className="flex items-center gap-2 px-4 py-2.5 bg-brand-blue text-white text-[10px] font-bold uppercase rounded-lg hover:bg-brand-gold"><Plus size={14} /> Add Bank</button>}
            {activeTab === 'our story' && checkPerm('our_story', 'can_create') && <button onClick={() => router.push('/admin/story')} className="flex items-center gap-2 px-4 py-2.5 bg-brand-blue text-white text-[10px] font-bold uppercase rounded-lg hover:bg-brand-gold"><Plus size={14} /> Add Milestone</button>}
            {activeTab === 'News & Updates' && checkPerm('edit_news', 'can_create') && <Link href="/admin/news" className="flex items-center gap-2 px-4 py-2.5 bg-brand-blue text-white text-[10px] font-bold uppercase rounded-lg hover:bg-brand-gold"><Plus size={14} /> Add New</Link>}
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {checkPerm('notifications_code', 'can_view') && <NotificationCenter />}
            {currentUserRole === 'admin' && <><div className="w-px h-6 bg-gray-200"></div><button onClick={() => router.push('/admin/users')} className="flex items-center gap-2 p-2 text-brand-blue hover:bg-gray-100 rounded-lg"><UserCircle2 size={24} /><span className="text-[10px] font-bold uppercase tracking-widest">Admin</span></button></>}
          </div>
        </header>

                <div className="flex-1 p-8 overflow-y-auto">
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
          ) : activeTab === 'Modules' ? <SystemModulesManager />
          : activeTab === 'Projects' ? <ProjectsManager checkPerm={checkPerm} />
          : activeTab === 'Virtual Tours' ? <VirtualToursManager checkPerm={checkPerm} />
          : activeTab === 'Navbar Setup' ? <NavbarProjectsManager checkPerm={checkPerm} />
          : activeTab === 'Promotions' ? <PromotionsManager checkPerm={checkPerm} />
          : activeTab === 'Partner Banks' ? <PartnerBanksManager checkPerm={checkPerm} />
          : activeTab === 'our story' ? <OurStoryManager checkPerm={checkPerm} />
          : activeTab === 'Audit Logs' ? <AuditLogsManager />
          : (
            <div className="animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-6">
                <div className="text-sm font-medium"><span className="text-brand-blue font-bold">Showing ({filteredNews.length})</span> | Published</div>
                <div className="flex gap-4">
                  <div className="relative w-48"><Filter size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" /><select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm outline-none appearance-none"><option value="">All</option><option value="News">News</option><option value="Updates">Updates</option></select></div>
                  <div className="relative w-72"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Search articles..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm outline-none" /></div>
                </div>
              </div>

              <div className="w-full overflow-x-auto pb-4"><div className="min-w-[600px]">
                <div className="grid grid-cols-12 gap-4 py-4 border-y border-gray-200 text-[10px] font-bold tracking-widest uppercase text-brand-blue/60"><div className="col-span-5">Title</div><div className="col-span-2">Category</div><div className="col-span-3">Date</div><div className="col-span-2 text-right">Actions</div></div>
                <div className="flex flex-col">
                  {filteredNews.map((article) => (
                    <div key={article.id} className="grid grid-cols-12 gap-4 py-4 items-center border-b border-gray-100 hover:bg-gray-50/50 group">
                      <div className="col-span-5 flex items-center gap-4"><div className="w-10 h-10 rounded-lg bg-gray-200 overflow-hidden"><img src={article.image} alt="" className="w-full h-full object-cover" /></div><button onClick={() => router.push(`/admin/news?edit=${article.id}`)} className="text-brand-blue font-bold text-sm hover:text-brand-gold text-left truncate">{article.title}</button></div>
                      <div className="col-span-2"><span className="text-[10px] font-bold uppercase tracking-widest text-brand-gold bg-brand-gold/10 px-3 py-1.5 rounded-md">{article.category}</span></div>
                      <div className="col-span-3 text-xs text-gray-500">Published<br /><span className="text-[10px] font-light">{article.date}</span></div>
                      <div className="col-span-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100">
                        {checkPerm('edit_news', 'can_edit') && <button onClick={() => handleToggleNewsStatus(article.id, article.is_active !== false, article.title)} className={`p-2 bg-white border rounded-lg ${article.is_active !== false ? 'border-green-200 text-green-600' : 'border-gray-200 text-gray-400'}`}>{article.is_active !== false ? <Eye size={14} /> : <EyeOff size={14} />}</button>}
                        {checkPerm('edit_news', 'can_edit') && <button onClick={() => router.push(`/admin/news?edit=${article.id}`)} className="p-2 bg-white border border-gray-200 text-brand-blue rounded-lg"><Edit2 size={14} /></button>}
                        {checkPerm('edit_news', 'can_delete') && <button onClick={() => handleArchiveClick(article.id, article.title)} className="p-2 bg-white border border-gray-200 text-red-500 rounded-lg"><Trash2 size={14} /></button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div></div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}