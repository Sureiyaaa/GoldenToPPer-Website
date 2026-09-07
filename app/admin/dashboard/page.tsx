// app/admin/dashboard/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import {
  LogOut, Building2, Landmark, LayoutDashboard, Search, Filter,
  Edit2, Trash2, Plus, Loader2, Eye, EyeOff, History, Move3d,
  Bell, CheckCircle2, X, Mail, MailOpen, CornerUpLeft, Menu, UserCircle2, Megaphone, Settings, ShieldAlert, AlertCircle, BookOpen, Upload
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { toggleActiveStatus, archiveRecord } from '@/app/actions/updates';
import { fetchAdminProjectsList } from '@/app/actions/projects';
import {
  fetchAdminVirtualToursList, fetchAdminPromotionsList,
  fetchAdminBanksList, fetchAdminStoryList, deleteRecordAction, toggleVirtualTourStatus,
  createAuditLogAction, fetchNotificationsAction, toggleNotificationReadAction
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
      await archiveRecord('project_table', projectToArchive.id, 'deleted_at');

      // ✅ SERVER-SIDE AUDIT LOG
      await createAuditLogAction('DELETE', 'Projects', projectToArchive.title, 'Deleted project from dashboard.');

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
    try {
      await toggleActiveStatus('project_table', id, currentStatus);

      // ✅ SERVER-SIDE AUDIT LOG
      await createAuditLogAction('EDIT', 'Projects', title, `Changed active status to ${!currentStatus ? 'Visible' : 'Hidden'}.`);

      setProjects(prev => prev.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
    } catch (error: any) { alert(`Failed to toggle status: ${error.message}`); }
  };

  const filteredProjects = projects.filter(proj => proj.title.toLowerCase().includes(searchQuery.toLowerCase()) || proj.city.toLowerCase().includes(searchQuery.toLowerCase()));

  if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-brand-blue" size={40} /></div>;

  return (
    <div className="animate-in fade-in duration-300">

      {/* === ARCHIVE CONFIRMATION MODAL === */}
      {projectToArchive && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 backdrop-blur-sm animate-in fade-in duration-300 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center shadow-inner mb-2">
              <AlertCircle size={40} />
            </div>
            <h2 className="text-2xl font-serif text-brand-blue text-center font-bold">Delete Project?</h2>
            <p className="text-gray-600 text-center text-sm font-medium">
              Are you sure you want to Delete? <strong>{projectToArchive.title}</strong>? It will be removed from this list.
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

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="text-sm text-brand-blue/70 font-medium"><span className="text-brand-blue font-bold">Showing ({filteredProjects.length})</span> <span className="mx-2 hidden sm:inline">|</span><br className="sm:hidden" /> Active Projects</div>
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search projects..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-brand-blue text-sm focus:border-brand-gold outline-none transition-all shadow-sm" />
        </div>
      </div>

      <div className="w-full overflow-x-auto pb-4">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-12 gap-4 py-4 border-y border-gray-200 text-[10px] font-bold tracking-widest uppercase text-brand-blue/60">
            <div className="col-span-5 sm:col-span-5">Project Name</div>
            <div className="col-span-3">Location</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          <div className="flex flex-col">
            {filteredProjects.length === 0 ? <div className="py-12 text-center text-gray-400 text-sm">No projects found.</div> : filteredProjects.map((proj) => (
              <div key={proj.id} className="grid grid-cols-12 gap-4 py-4 items-center border-b border-gray-100 hover:bg-gray-50/50 transition-colors group">

                <div className="col-span-5 flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gray-200 overflow-hidden shrink-0 shadow-sm">
                    <img src={proj.image || 'https://via.placeholder.com/150?text=No+Image'} alt={proj.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {checkPerm('edit_project', 'can_edit') ? (
                      <button onClick={() => router.push(`/admin/projects?edit=${proj.id}`)} className="text-brand-blue font-bold text-sm hover:text-brand-gold transition-colors text-left block w-full truncate">{proj.title}</button>
                    ) : (
                      <span className="text-brand-blue font-bold text-sm text-left block w-full truncate">{proj.title}</span>
                    )}
                  </div>
                </div>

                <div className="col-span-3 text-sm text-gray-500 truncate">{proj.city}</div>
                <div className="col-span-2"><span className="text-[10px] font-bold uppercase tracking-widest px-2 sm:px-3 py-1.5 rounded-md bg-brand-gold/10 text-brand-gold">{proj.status || 'Draft'}</span></div>

                <div className="col-span-2 flex justify-end gap-1 sm:gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  {checkPerm('edit_project', 'can_edit') && (
                    <button onClick={() => handleToggleProject(proj.id, proj.is_active, proj.title)} className={`p-1.5 sm:p-2 bg-white shadow-sm border rounded-lg ${proj.is_active ? 'border-green-200 text-green-600' : 'border-gray-200 text-gray-400'}`}>{proj.is_active ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                  )}
                  {checkPerm('edit_project', 'can_edit') && (
                    <button onClick={() => router.push(`/admin/projects?edit=${proj.id}`)} className="p-1.5 sm:p-2 bg-white shadow-sm border border-gray-200 text-brand-blue hover:bg-brand-blue hover:text-white rounded-lg transition-colors"><Edit2 size={14} /></button>
                  )}
                  {checkPerm('edit_project', 'can_delete') && (
                    <button onClick={() => handleArchiveClick(proj.id, proj.title)} className="p-1.5 sm:p-2 bg-white shadow-sm border border-gray-200 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors">
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

                    <div className="col-span-3 flex justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      {checkPerm('virtual_tours', 'can_edit') && (
                        <button onClick={() => handleToggleStatus(tour.id, tour.status, tour.title)} className={`p-2 bg-white shadow-sm border rounded-lg ${tour.status === 'Active' ? 'border-green-200 text-green-600' : 'border-gray-200 text-gray-400'}`}>
                          {tour.status === 'Active' ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                      )}
                      {checkPerm('virtual_tours', 'can_edit') && (
                        <button onClick={() => router.push(`/admin/virtualtours?edit=${tour.id}`)} className="p-2 bg-white shadow-sm border border-gray-200 text-brand-blue hover:bg-brand-blue hover:text-white rounded-lg transition-colors"><Edit2 size={14} /></button>
                      )}
                      {checkPerm('virtual_tours', 'can_delete') && (
                        <button onClick={() => handleArchiveClick(tour.id, tour.title)} className="p-2 bg-white shadow-sm border border-gray-200 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors"><Trash2 size={14} /></button>
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
  const supabase = createClient();
  const [navProjects, setNavProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingData, setEditingData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [itemToArchive, setItemToArchive] = useState<{ id: number, nav_title: string } | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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
      alert('Please upload a valid image file (PNG, JPG, etc).');
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

      setEditingData({ ...editingData, nav_image_url: publicUrl });

    } catch (error: any) {
      alert(`Error uploading image: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    const fetchNavProjects = async () => { setIsLoading(true); const { data } = await supabase.from('navbar_projects').select('*, project_table(title)').order('display_order', { ascending: true }); if (data) setNavProjects(data); setIsLoading(false); };
    fetchNavProjects();
  }, [supabase]);

  const handleEditClick = (item: any) => { setEditingData(item); setEditModalOpen(true); };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await supabase.from('navbar_projects').update({ nav_title: editingData.nav_title, tagline: editingData.tagline, nav_image_url: editingData.nav_image_url, display_order: parseInt(editingData.display_order) }).eq('id', editingData.id);
      await createAuditLogAction('EDIT', 'Navbar Settings', editingData.nav_title, 'Updated navbar project details.');
      setSuccessMessage('Updated successfully!');
      setEditModalOpen(false);
      setNavProjects(prev => prev.map(p => p.id === editingData.id ? { ...p, nav_image_url: editingData.nav_image_url, nav_title: editingData.nav_title, tagline: editingData.tagline, display_order: parseInt(editingData.display_order) } : p).sort((a,b) => a.display_order - b.display_order));
      setTimeout(() => setSuccessMessage(''), 2500);
    } catch (error: any) { alert(`Failed to update: ${error.message}`); } finally { setIsSaving(false); }
  };

  const handleToggleActive = async (id: number, currentStatus: boolean, title: string) => {
    try {
      await toggleActiveStatus('navbar_projects', id, currentStatus);
      await createAuditLogAction('EDIT', 'Navbar Setup', title, `Changed active status.`);
      setNavProjects(prev => prev.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
    } catch (error: any) { alert(`Failed to toggle: ${error.message}`); }
  };

  // ✅ THIS MISSING FUNCTION WAS CAUSING YOUR ERRORS!
  const handleArchiveClick = (id: number, nav_title: string) => {
    setItemToArchive({ id, nav_title });
  };

  const confirmArchive = async () => {
    if (!itemToArchive) return;
    setIsArchiving(true);
    try {
      await deleteRecordAction('navbar_projects', itemToArchive.id);
      await createAuditLogAction('DELETE', 'Navbar Setup', itemToArchive.nav_title, 'Deleted navbar project item.');
      setNavProjects(prev => prev.filter(p => p.id !== itemToArchive.id));
      setItemToArchive(null);
      setSuccessMessage(`Deleted successfully.`);
      setTimeout(() => setSuccessMessage(''), 2500);
    } catch (error: any) { alert(`Failed to delete: ${error.message}`); } finally { setIsArchiving(false); }
  };

  if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-brand-blue" size={40} /></div>;

  return (
    <div className="animate-in fade-in duration-300">
      {itemToArchive && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full"><AlertCircle size={40} className="text-red-500 mb-2"/>
            <h2 className="text-2xl font-serif text-brand-blue font-bold">Delete Item?</h2>
            <div className="flex gap-3 w-full mt-4">
              <button onClick={() => setItemToArchive(null)} disabled={isArchiving} className="flex-1 py-3 bg-gray-100 font-bold rounded-xl text-xs uppercase">Cancel</button>
              <button onClick={confirmArchive} disabled={isArchiving} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl text-xs uppercase flex justify-center">{isArchiving ? <Loader2 size={16} className="animate-spin" /> : 'Delete'}</button>
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
      {editModalOpen && editingData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col">
            <div className="px-6 py-4 bg-[#f8f9fa] border-b border-gray-100 flex justify-between items-center"><h3 className="font-bold text-brand-blue tracking-widest uppercase text-sm">Edit Navbar Details</h3><button onClick={() => setEditModalOpen(false)}><X size={20} /></button></div>
            <div className="p-6 space-y-4">
              <div><label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1 block">Display Title</label><input type="text" value={editingData.nav_title} onChange={(e) => setEditingData({ ...editingData, nav_title: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm" /></div>
              <div><label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1 block">Tagline</label><textarea rows={2} value={editingData.tagline || ''} onChange={(e) => setEditingData({ ...editingData, tagline: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm" /></div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1 block">Project Image</label>
                <div
                  className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${isDragging ? 'border-brand-gold bg-brand-gold/5' : 'border-gray-200 hover:border-brand-blue/50 hover:bg-gray-50'}`}
                  onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
                >
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-3 py-4"><Loader2 className="animate-spin text-brand-blue" size={28} /><span className="text-xs font-bold tracking-widest uppercase text-brand-blue">Uploading...</span></div>
                  ) : editingData.nav_image_url ? (
                    <div className="flex flex-col items-center gap-3 w-full"><img src={editingData.nav_image_url} alt="Preview" className="h-28 w-auto object-contain rounded-lg shadow-sm border border-gray-100" /><span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-brand-gold transition-colors">Click or drag to replace image</span></div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-400 py-2"><div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-2 group-hover:bg-brand-blue group-hover:text-white transition-colors"><Upload size={20} className="text-brand-blue" /></div><span className="text-sm font-bold text-brand-blue">Click to upload or drag and drop</span><span className="text-[10px] uppercase tracking-widest">SVG, PNG, JPG or WEBP (max. 5MB)</span></div>
                  )}
                </div>
              </div>
              <div><label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1 block">Order</label><input type="number" value={editingData.display_order} onChange={(e) => setEditingData({ ...editingData, display_order: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm" /></div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3"><button onClick={() => setEditModalOpen(false)} className="px-5 py-2.5 text-xs font-bold text-gray-600 bg-gray-200 rounded-xl uppercase">Cancel</button><button onClick={handleSave} disabled={isSaving} className="px-5 py-2.5 text-xs font-bold text-white bg-brand-blue rounded-xl uppercase flex gap-2">{isSaving ? <Loader2 size={14} className="animate-spin" /> : 'Save Changes'}</button></div>
          </div>
        </div>
      )}

      <div className="w-full overflow-x-auto pb-4"><div className="min-w-[600px]">
        <div className="grid grid-cols-12 gap-4 py-4 border-y border-gray-200 text-[10px] font-bold tracking-widest uppercase text-brand-blue/60"><div className="col-span-1">Order</div><div className="col-span-3">Title</div><div className="col-span-4">Tagline</div><div className="col-span-2">Status</div><div className="col-span-2 text-right">Actions</div></div>
        <div className="flex flex-col">
          {navProjects.map((item) => (
            <div key={item.id} className="grid grid-cols-12 gap-4 py-4 items-center border-b border-gray-100 hover:bg-gray-50/50 group">
              <div className="col-span-1 font-bold text-brand-blue text-sm pl-2">{item.display_order}</div>
              <div className="col-span-3 flex items-center gap-3"><div className="w-8 h-8 rounded bg-gray-200 overflow-hidden"><img src={item.nav_image_url || 'https://via.placeholder.com/150'} alt="" className="w-full h-full object-cover" /></div><span className="font-bold text-sm text-brand-blue">{item.nav_title}</span></div>
              <div className="col-span-4 text-xs text-gray-500 pr-4">{item.tagline || '—'}</div>
              <div className="col-span-2"><span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1.5 rounded-md ${item.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>{item.is_active ? 'Visible' : 'Hidden'}</span></div>
              <div className="col-span-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100">
                {checkPerm('edit_project', 'can_edit') && <button onClick={() => handleToggleActive(item.id, item.is_active, item.nav_title)} className={`p-2 bg-white border rounded-lg ${item.is_active ? 'border-green-200 text-green-600' : 'border-gray-200 text-gray-400'}`}>{item.is_active ? <Eye size={14} /> : <EyeOff size={14} />}</button>}
                {checkPerm('edit_project', 'can_edit') && <button onClick={() => handleEditClick(item)} className="p-2 bg-white border border-gray-200 text-brand-blue rounded-lg"><Edit2 size={14} /></button>}
                {checkPerm('edit_project', 'can_delete') && <button onClick={() => handleArchiveClick(item.id, item.nav_title)} className="p-2 bg-white border border-gray-200 text-red-500 rounded-lg"><Trash2 size={14} /></button>}
              </div>
            </div>
          ))}
        </div>
      </div></div>
    </div>
  );
}

// ==========================================
// MAIN DASHBOARD WRAPPER
// ==========================================
export default function AdminMainDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(true);
  const [newsList, setNewsList] = useState<NewsArticle[]>([]);
  const [activeTab, setActiveTab] = useState('News & Updates');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const [articleToArchive, setArticleToArchive] = useState<{ id: string, title: string } | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleArchiveClick = (id: string, title: string) => {
    setArticleToArchive({ id, title });
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
    { name: 'News & Updates', icon: LayoutDashboard, moduleCode: 'edit_news' },
    { name: 'Projects', icon: Building2, moduleCode: 'edit_project' },
    { name: 'Virtual Tours', icon: Move3d, moduleCode: 'virtual_tours' },
    { name: 'Navbar Setup', icon: LayoutDashboard, moduleCode: 'edit_project' },
    { name: 'Promotions', icon: Megaphone, moduleCode: 'promotion_code' },
    { name: 'Partner Banks', icon: Landmark, moduleCode: 'edit_banks' },
    { name: 'our story', icon: BookOpen, moduleCode: 'our_story' },
    { name: 'Audit Logs', icon: History, moduleCode: 'audit_log' },
    { name: 'Modules', icon: Settings, moduleCode: 'admin_manage' }
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

  const contentMenuItems = allowedMenuItems.filter(item => !['Audit Logs', 'Modules'].includes(item.name));
  const systemMenuItems = allowedMenuItems.filter(item => ['Audit Logs', 'Modules'].includes(item.name));

  return (
    <div className="flex h-screen bg-[#F8F9FA] text-gray-900 font-sans overflow-hidden relative">
      {isSidebarOpen && <div className="fixed inset-0 bg-brand-blue/40 backdrop-blur-sm z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 w-64 bg-brand-blue text-white flex flex-col shadow-2xl z-40 transform transition-transform duration-300 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-20 flex items-center justify-start px-8 border-b border-white/10 bg-[#0f1d40] shrink-0"><img src="/images/navigation/GoldenTopperlogo.svg" alt="Logo" className="h-10 w-auto object-contain" /></div>
        <nav className="flex-1 py-8 px-4 space-y-2 overflow-y-auto">
          <div className="px-4 mb-3 text-[10px] font-bold tracking-widest uppercase text-brand-gold/70">Content Management</div>
          {contentMenuItems.map((item) => {
            const isActive = activeTab === item.name;
            const Icon = item.icon;
            return (
              <button key={item.name} onClick={() => { setActiveTab(item.name); setFilterCategory(''); setSearchQuery(''); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 group outline-none ${isActive ? 'bg-brand-blue text-brand-gold font-bold shadow-lg' : 'text-gray-300 hover:bg-brand-blue/50 hover:text-white'}`}>
                <div className="flex items-center gap-4"><Icon size={20} className={isActive ? 'text-brand-gold' : 'text-gray-400 group-hover:text-white'} /><span className="text-[13px] font-bold tracking-widest uppercase">{item.name}</span></div>
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10 bg-[#0f1d40]/50 space-y-2">
          {systemMenuItems.length > 0 && (
            <div className="mb-4 space-y-2">
              {systemMenuItems.map((item) => {
                const isActive = activeTab === item.name;
                const Icon = item.icon;
                return (
                  <button key={item.name} onClick={() => { setActiveTab(item.name); setFilterCategory(''); setSearchQuery(''); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group outline-none ${isActive ? 'bg-brand-blue text-brand-gold font-bold shadow-lg' : 'text-gray-400 hover:bg-brand-blue/50 hover:text-white'}`}>
                    <div className="flex items-center gap-4"><Icon size={18} className={isActive ? 'text-brand-gold' : 'text-gray-500 group-hover:text-white'} /><span className="text-xs font-bold tracking-widest uppercase">{item.name}</span></div>
                  </button>
                );
              })}
            </div>
          )}
          <button onClick={handleSignOut} className="flex items-center gap-4 px-4 py-3 w-full text-left text-red-400/80 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-colors text-xs font-bold uppercase tracking-widest outline-none mt-2"><LogOut size={18} /><span>Sign Out</span></button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
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
            <h1 className="text-2xl md:text-3xl font-serif text-brand-blue truncate">{activeTab}</h1>
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
          {allowedMenuItems.length === 0 ? (
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