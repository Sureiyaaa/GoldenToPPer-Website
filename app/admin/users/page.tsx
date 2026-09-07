// app/admin/users/page.tsx
'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Plus, Search, Filter, Edit2, Trash2, X, ShieldAlert, 
  Eye, EyeOff, CheckCircle, AlertTriangle, Info 
} from 'lucide-react';
import PageTransition from '@/app/components/page-transitions';
import { createClient } from '@/utils/supabase/client';
import { 
  createUserAction, updateUserAction, 
  toggleUserStatusAction, toggleGroupStatusAction, createGroupAction 
} from '@/app/actions/user';
import { getCustomSession } from '@/app/actions/auth';
import { savePermissionsAction } from '@/app/actions/permissions';


function UsersManager() {
  const router = useRouter();
  const supabase = createClient();
  
  const [activeTab, setActiveTab] = useState<'users' | 'groups'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null); 

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  
  const [formData, setFormData] = useState({ username: '', password: '', is_super_admin: false, group_id: '' });
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
  const [groupFormData, setGroupFormData] = useState({ group_name: '', description: '' });

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [groupPermissions, setGroupPermissions] = useState<Record<number, any>>({});

  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info' | 'warning'; onClose?: () => void; }>({ isOpen: false, message: '', type: 'info' });
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; message: string; onConfirm: () => void; }>({ isOpen: false, message: '', onConfirm: () => {} });

  const showAlert = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', onClose?: () => void) => setAlertConfig({ isOpen: true, message, type, onClose });
  const handleCloseAlert = () => { const { onClose } = alertConfig; setAlertConfig({ isOpen: false, message: '', type: 'info' }); if (onClose) onClose(); };
  const showConfirm = (message: string, onConfirm: () => void) => setConfirmConfig({ isOpen: true, message, onConfirm });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      // USE CUSTOM SESSION INSTEAD OF SUPABASE AUTH
      const userId = await getCustomSession();
      if (!userId) {
        router.replace('/admin');
        return;
      }

      const { data: userData } = await supabase
        .from('admin_users')
        .select(`id, username, is_super_admin, group_id, is_active, last_login, groups ( group_name )`);

      if (userData) {
        const matchingProfile = userData.find(u => u.id === userId);
        
        if (matchingProfile && !matchingProfile.is_super_admin) {
          const { data: groupData } = await supabase.from('groups').select('is_active').eq('id', matchingProfile.group_id).single();
          if (groupData?.is_active === false || matchingProfile.is_active === false) {
             router.replace('/admin/dashboard'); 
             return; 
          }
        }
        setCurrentUser(matchingProfile);
      }
      
      const { data: groupData } = await supabase.from('groups').select('*');
      const { data: moduleData } = await supabase.from('modules').select('*');

      if (userData) {
        const formattedUsers = userData.map(u => {
          const groupObj = Array.isArray(u.groups) ? u.groups[0] : u.groups;
          return {
            ...u,
            email: u.username, // UI uses .email field, keep map for compatibility
            roleDisplay: u.is_super_admin ? 'Super Admin' : (groupObj?.group_name || 'Unassigned'),
            created_at: 'N/A' 
          };
        });
        setUsers(formattedUsers);
      }
      
      if (groupData) setGroups(groupData);
      if (moduleData) setModules(moduleData.filter(mod => mod.module_name.toLowerCase() !== 'payment'));
      
      setIsLoading(false);
    };

    fetchData();
  }, [supabase, router]);

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.username?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'All' || u.roleDisplay.toLowerCase() === roleFilter.toLowerCase();
    return matchesSearch && matchesRole;
  });

  const handleOpenModal = (user: any = null) => {
    setPasswordError('');
    setShowPassword(false);
    if (user) {
      setEditingUser(user);
      setFormData({ username: user.username, password: '', is_super_admin: user.is_super_admin, group_id: user.group_id || '' });
    } else {
      setEditingUser(null);
      setFormData({ username: '', password: '', is_super_admin: false, group_id: groups.length > 0 ? groups[0].id.toString() : '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.is_super_admin) { showAlert("Unauthorized: Only Super Admins can manage users.", "error"); return; }

    // Only validate the password if we are creating a new user OR if they typed a new password during an edit
    if (!editingUser || formData.password) {
      const isValidUsername = /^[a-zA-Z0-9_]+$/.test(formData.username);
      if (!isValidUsername && !editingUser) { showAlert("Usernames can only contain letters, numbers, and underscores (no spaces).", "error"); return; }
      const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
      if (!passwordRegex.test(formData.password)) { setPasswordError("Password must be at least 8 characters long and contain at least one uppercase letter, one number, and one special character."); return; }
    }

    try {
      if (!editingUser) {
        const result = await createUserAction(formData);
        if (!result.success) throw new Error(result.error);
        setIsModalOpen(false);
        showAlert("User created successfully!", "success", () => window.location.reload());
      } else {
        // USE THE NEW SECURE UPDATE ACTION
        const result = await updateUserAction({ id: editingUser.id, ...formData });
        if (!result.success) throw new Error(result.error);
        setIsModalOpen(false);
        showAlert("User updated successfully!", "success", () => window.location.reload());
      }
    } catch (error: any) { showAlert(error.message, "error"); }
  };

  const handleOpenGroupModal = async (group: any) => {
    setSelectedGroup(group);
    const { data: accessData } = await supabase.from('module_access').select('*').eq('group_id', group.id);
    const initialPermissions: Record<number, any> = {};
    modules.forEach(mod => {
      const existingAccess = accessData?.find((a: any) => a.module_id === mod.id);
      initialPermissions[mod.id] = { can_view: existingAccess?.can_view || false, can_create: existingAccess?.can_create || false, can_edit: existingAccess?.can_edit || false, can_delete: existingAccess?.can_delete || false };
    });
    setGroupPermissions(initialPermissions);
    setIsGroupModalOpen(true);
  };

  const handleTogglePermission = (moduleId: number, field: string, value: boolean) => setGroupPermissions(prev => ({ ...prev, [moduleId]: { ...prev[moduleId], [field]: value } }));

  // Make sure to import it at the top: import { savePermissionsAction } from '@/app/actions/permissions';

  const handleSavePermissions = async () => {
    if (!selectedGroup) return;
    const upsertData = modules.map(mod => ({ 
      group_id: selectedGroup.id, 
      module_id: mod.id, 
      ...groupPermissions[mod.id], 
      updated_at: new Date().toISOString() 
    }));
    
    // THIS HAPPENS ON YOUR SECURE BACKEND
    const result = await savePermissionsAction(upsertData);
    
    if (!result.success) {
      showAlert(`Failed to save permissions: ${result.error}`, "error");
    } else { 
      setIsGroupModalOpen(false); 
      showAlert("Permissions updated successfully!", "success"); 
    }
  };

  const handleAddGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.is_super_admin) { showAlert("Unauthorized: Only Super Admins can create groups.", "error"); return; }
    
    try {
      const accessData = modules.map(mod => ({ module_id: mod.id, ...groupPermissions[mod.id], updated_at: new Date().toISOString() }));
      
      // ✅ USE SECURE SERVER ACTION
      const result = await createGroupAction(groupFormData.group_name, groupFormData.description, accessData);
      
      if (!result.success) throw new Error(result.error);
      
      setIsAddGroupModalOpen(false); 
      setGroupFormData({ group_name: '', description: '' }); 
      showAlert("Department created successfully!", "success", () => window.location.reload());
    } catch (error: any) {
      showAlert(`Failed to add group: ${error.message}`, "error");
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    if (!currentUser?.is_super_admin) { showAlert("Unauthorized: Only Super Admins can modify user status.", "error"); return; }
    const newStatus = !currentStatus; 
    const confirmMessage = newStatus ? "Are you sure you want to re-activate this user's account?" : "Are you sure you want to disable this user? They will instantly lose access to the dashboard.";
    
    showConfirm(confirmMessage, async () => {
      try {
        // ✅ USE SECURE SERVER ACTION
        const result = await toggleUserStatusAction(userId, newStatus);
        if (!result.success) throw new Error(result.error);
        
        setUsers(users.map(u => u.id === userId ? { ...u, is_active: newStatus } : u));
      } catch (error: any) { 
        showAlert(`Failed to update user status: ${error.message}`, "error"); 
      }
    });
  };

  const handleToggleGroupStatus = async (groupId: string | number, currentStatus: boolean) => {
    if (!currentUser?.is_super_admin) { showAlert("Unauthorized: Only Super Admins can modify department status.", "error"); return; }
    const newStatus = !currentStatus; 
    const confirmMessage = newStatus ? "Are you sure you want to re-activate this department?" : "Are you sure you want to disable this department? All users inside it will instantly lose access.";
    
    showConfirm(confirmMessage, async () => {
      try {
        // ✅ USE SECURE SERVER ACTION
        const result = await toggleGroupStatusAction(groupId, newStatus);
        if (!result.success) throw new Error(result.error);
        
        setGroups(groups.map(g => g.id === groupId ? { ...g, is_active: newStatus } : g));
      } catch (error: any) { 
        showAlert(`Failed to update department status: ${error.message}`, "error"); 
      }
    });
  };

  return (
    <div className="flex h-screen bg-white text-gray-900 font-sans selection:bg-[var(--color-brand-gold)] selection:text-white flex-col overflow-hidden relative">
      
      <header className="h-20 flex items-center justify-between px-8 lg:px-16 shrink-0 border-b border-gray-100">
        <div className="flex items-center gap-6">
          <button onClick={() => router.replace('/admin/dashboard')} className="text-gray-400 hover:text-[var(--color-brand-blue)] transition-colors outline-none"><ArrowLeft size={24} strokeWidth={1.5} /></button>
          <h1 className="text-2xl font-serif text-[var(--color-brand-blue)] font-light tracking-wide">User Management</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-8 lg:px-16 pt-10 pb-24">
        <div className="w-full max-w-[100rem] mx-auto flex flex-col min-h-full">

          <div className="flex gap-8 border-b border-gray-100 mb-8">
            <button onClick={() => setActiveTab('users')} className={`pb-4 text-sm font-semibold tracking-wide capitalize transition-colors outline-none border-b-2 ${activeTab === 'users' ? 'border-[var(--color-brand-blue)] text-[var(--color-brand-blue)]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>User Management</button>
            <button onClick={() => setActiveTab('groups')} className={`pb-4 text-sm font-semibold tracking-wide capitalize transition-colors outline-none border-b-2 ${activeTab === 'groups' ? 'border-[var(--color-brand-blue)] text-[var(--color-brand-blue)]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>Group Permissions</button>
          </div>

          {isLoading ? (
             <div className="py-16 text-center text-gray-400 text-sm">Loading data...</div>
          ) : activeTab === 'users' ? (
            <>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 py-8">
                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                  <div className="relative w-full sm:w-80 group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Search size={16} strokeWidth={2} className="text-gray-400 group-focus-within:text-[var(--color-brand-blue)] transition-colors" /></div>
                    <input type="text" placeholder="Search by username..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-gray-50 hover:bg-gray-100 focus:bg-white border border-transparent focus:border-[var(--color-brand-blue)]/20 focus:ring-4 focus:ring-[var(--color-brand-blue)]/5 rounded-full pl-11 pr-4 py-2.5 text-sm text-[var(--color-brand-blue)] outline-none transition-all placeholder:text-gray-400" />
                  </div>

                  <div className="relative w-full sm:w-48 group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Filter size={16} strokeWidth={2} className="text-gray-400 group-focus-within:text-[var(--color-brand-blue)] transition-colors" /></div>
                    <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-full bg-gray-50 hover:bg-gray-100 focus:bg-white border border-transparent focus:border-[var(--color-brand-blue)]/20 focus:ring-4 focus:ring-[var(--color-brand-blue)]/5 rounded-full pl-11 pr-4 py-2.5 text-sm text-[var(--color-brand-blue)] outline-none appearance-none transition-all cursor-pointer font-medium">
                      <option value="All">All Roles</option>
                      <option value="Super Admin">Super Admin</option>
                      {groups.map(g => <option key={g.id} value={g.group_name}>{g.group_name}</option>)}
                    </select>
                  </div>
                </div>
                
                {currentUser?.is_super_admin && (
                  <button onClick={() => handleOpenModal()} className="flex items-center gap-2 text-[var(--color-brand-blue)] hover:text-[var(--color-brand-gold)] text-[11px] font-bold uppercase tracking-widest transition-colors outline-none"><Plus size={18} strokeWidth={1.5} /> Add New User</button>
                )}
              </div>

              <div className="w-full overflow-x-auto flex-1 mt-4">
                <div className="min-w-[900px] bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                  
                  <div className="grid grid-cols-12 gap-6 px-8 py-5 bg-gray-50/80 border-b border-gray-100 text-[10px] font-bold tracking-widest uppercase text-gray-400">
                    <div className="col-span-5">Username</div>
                    <div className="col-span-2">Role / Group</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2">Last Active</div>
                    <div className="col-span-1 text-right">Actions</div>
                  </div>

                  <div className="flex flex-col divide-y divide-gray-100">
                    {filteredUsers.length === 0 ? (
                      <div className="py-16 text-center text-gray-400 text-sm">No users match your search criteria.</div>
                    ) : (
                      filteredUsers.map((user) => (
                        <div key={user.id} className="grid grid-cols-12 gap-6 px-8 py-5 items-center hover:bg-[var(--color-brand-blue)]/[0.02] border-b border-gray-50 last:border-0 transition-colors group">
                          <div className="col-span-5 text-sm text-[var(--color-brand-blue)] truncate pr-4">{user.username}</div>
                          <div className="col-span-2"><span className="text-[11px] font-semibold tracking-wider uppercase text-gray-500">{user.roleDisplay}</span></div>
                          <div className="col-span-2 text-sm"><span className={`px-2 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{user.is_active ? 'Active' : 'Disabled'}</span></div>
                          <div className="col-span-2 text-sm text-gray-400">{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</div>
                          
                          <div className="col-span-1 flex justify-end gap-4 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            {currentUser?.is_super_admin && (
                              <>
                                <button onClick={() => handleOpenModal(user)} className="text-gray-400 hover:text-[var(--color-brand-blue)] transition-colors outline-none"><Edit2 size={16} strokeWidth={1.5} /></button>
                                <button onClick={() => handleToggleUserStatus(user.id, user.is_active)} className={`transition-colors outline-none ${user.is_active ? 'text-gray-400 hover:text-red-500' : 'text-red-500 hover:text-green-500'}`} title={user.is_active ? "Disable User" : "Activate User"}>
                                  {user.is_active ? <Trash2 size={16} strokeWidth={1.5} /> : <ShieldAlert size={16} strokeWidth={1.5} />}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* GROUPS TAB CONTENT */}
              <div className="flex justify-between items-center py-8 border-b border-gray-100">
                <h2 className="text-xl font-serif text-[var(--color-brand-blue)]">Department Groups</h2>
                {currentUser?.is_super_admin && (
                  <button onClick={() => {
                      const initialPerms: Record<number, any> = {};
                      modules.forEach(mod => { initialPerms[mod.id] = { can_view: false, can_create: false, can_edit: false, can_delete: false }; });
                      setGroupPermissions(initialPerms); setIsAddGroupModalOpen(true);
                    }}
                    className="flex items-center gap-2 text-[var(--color-brand-blue)] hover:text-[var(--color-brand-gold)] text-[11px] font-bold uppercase tracking-widest transition-colors outline-none"
                  >
                    <Plus size={18} strokeWidth={1.5} /> Add New Group
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-8">
               {groups.map(group => (
                  <div key={group.id} onClick={() => handleOpenGroupModal(group)} className="relative bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-[var(--color-brand-blue)]">{group.group_name}</h3>
                        <span className={`mt-2 inline-block px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase ${group.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{group.is_active !== false ? 'Active' : 'Disabled'}</span>
                      </div>
                      <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="text-gray-400 hover:text-[var(--color-brand-blue)] outline-none"><Edit2 size={16} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleToggleGroupStatus(group.id, group.is_active !== false); }} className={`outline-none transition-colors ${group.is_active !== false ? 'text-gray-400 hover:text-red-500' : 'text-red-500 hover:text-green-500'}`} title={group.is_active !== false ? "Disable Department" : "Activate Department"}>
                          {group.is_active !== false ? <Trash2 size={16} /> : <ShieldAlert size={16} />}
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mb-6">{group.description || 'No description provided.'}</p>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><ShieldAlert size={14} /> Click to manage access</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* GROUP PERMISSIONS MODAL */}
          {isGroupModalOpen && selectedGroup && (
            <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white border border-gray-200 shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-10 py-8 border-b border-gray-100 shrink-0">
                  <div>
                    <h3 className="text-2xl font-serif text-[var(--color-brand-blue)] font-light">{selectedGroup.group_name} Access</h3>
                    <p className="text-sm text-gray-500 mt-1">Configure module permissions for this department.</p>
                  </div>
                  <button onClick={() => setIsGroupModalOpen(false)} className="text-gray-400 hover:text-gray-900 transition-colors outline-none"><X size={24} strokeWidth={1.5} /></button>
                </div>

                <div className="px-10 py-6 overflow-y-auto">
                  <div className="flex flex-col divide-y divide-gray-100">
                    <div className="grid grid-cols-5 gap-4 pb-4 text-[10px] font-bold tracking-widest uppercase text-gray-400">
                      <div className="col-span-1">Modules</div><div className="text-center">View</div><div className="text-center">Create</div><div className="text-center">Edit</div><div className="text-center">Delete</div>
                    </div>

                    {modules.map(mod => {
                      const perms = groupPermissions[mod.id] || {};
                      return (
                        <div key={mod.id} className="grid grid-cols-5 gap-4 py-4 items-center hover:bg-gray-50/50 transition-colors">
                          <div className="col-span-1 text-sm font-semibold text-[var(--color-brand-blue)] capitalize">{mod.module_name}</div>
                          {['can_view', 'can_create', 'can_edit', 'can_delete'].map((action) => {
                            const modName = mod.module_name.toLowerCase();
                            const isViewOnlyModule = modName === 'notifications' || modName === 'audit log';
                            const hideCheckbox = isViewOnlyModule && action !== 'can_view';
                            return (
                              <div key={action} className="flex justify-center">
                                {!hideCheckbox ? (
                                  <label className="relative flex items-center cursor-pointer">
                                    <input type="checkbox" checked={!!perms[action]} onChange={(e) => handleTogglePermission(mod.id, action, e.target.checked)} className="peer sr-only" />
                                    <div className="w-5 h-5 border-2 border-gray-300 rounded peer-checked:bg-[var(--color-brand-blue)] peer-checked:border-[var(--color-brand-blue)] transition-colors flex items-center justify-center">
                                      <svg className={`w-3 h-3 text-white pointer-events-none ${perms[action] ? 'block' : 'hidden'}`} viewBox="0 0 14 10" fill="none"><path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    </div>
                                  </label>
                                ) : (<span className="text-gray-300 text-sm font-bold">-</span>)}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="px-10 py-6 border-t border-gray-100 shrink-0 flex justify-end gap-6 bg-gray-50/50">
                  <button onClick={() => setIsGroupModalOpen(false)} className="text-[11px] font-bold tracking-widest uppercase text-gray-400 hover:text-gray-800 transition-colors outline-none">Cancel</button>
                  <button onClick={handleSavePermissions} className="text-[11px] font-bold tracking-widest uppercase text-white bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-gold)] px-6 py-3 rounded transition-colors outline-none shadow-md">Save Permissions</button>
                </div>
              </div>
            </div>
          )}

          {/* ADD NEW GROUP MODAL */}
          {isAddGroupModalOpen && (
            <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white border border-gray-200 shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-10 py-8 border-b border-gray-100 shrink-0">
                  <h3 className="text-2xl font-serif text-[var(--color-brand-blue)] font-light">Create New Department</h3>
                  <button onClick={() => setIsAddGroupModalOpen(false)} className="text-gray-400 hover:text-gray-900 transition-colors outline-none"><X size={24} strokeWidth={1.5} /></button>
                </div>

                <form onSubmit={handleAddGroupSubmit} className="flex flex-col overflow-hidden">
                  <div className="px-10 py-8 flex flex-col gap-8 overflow-y-auto">
                    <div>
                    <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-4 block">
                      {editingUser ? 'New Password (Leave blank to keep current)' : 'Password'}
                    </label>
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        required={!editingUser} 
                        value={formData.password} 
                        onChange={(e) => { setFormData({...formData, password: e.target.value}); setPasswordError(''); }} 
                        className={`w-full bg-transparent border-b py-2 pr-10 text-base outline-none transition-colors placeholder:text-gray-300 ${passwordError ? 'border-red-500 text-red-500 focus:border-red-500' : 'border-gray-200 text-[var(--color-brand-blue)] focus:border-[var(--color-brand-blue)]'}`} 
                        placeholder={editingUser ? "Leave blank to keep unchanged" : "••••••••"} 
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-0 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[var(--color-brand-blue)] transition-colors outline-none">
                        {showPassword ? <Eye size={18} strokeWidth={1.5} /> : <EyeOff size={18} strokeWidth={1.5} />}
                      </button>
                    </div>
                    {passwordError ? (
                      <p className="text-red-500 text-[11px] mt-2 font-medium">{passwordError}</p>
                    ) : (
                      <p className="text-gray-400 text-[11px] mt-2">Must be at least 8 characters with 1 uppercase, 1 number, and 1 special character.</p>
                    )}
                  </div>

                    <div className="mt-4 border-t border-gray-100 pt-8">
                      <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-6 block">Initial Module Access</label>
                      <div className="flex flex-col divide-y divide-gray-100">
                        <div className="grid grid-cols-5 gap-4 pb-4 text-[10px] font-bold tracking-widest uppercase text-gray-400">
                          <div className="col-span-1">Module</div><div className="text-center">View</div><div className="text-center">Create</div><div className="text-center">Edit</div><div className="text-center">Delete</div>
                        </div>
                        {modules.map(mod => {
                          const perms = groupPermissions[mod.id] || {};
                          return (
                            <div key={mod.id} className="grid grid-cols-5 gap-4 py-4 items-center hover:bg-gray-50/50 transition-colors">
                              <div className="col-span-1 text-sm font-semibold text-[var(--color-brand-blue)] capitalize">{mod.module_name}</div>
                              {['can_view', 'can_create', 'can_edit', 'can_delete'].map((action) => (
                                <div key={action} className="flex justify-center">
                                  <label className="relative flex items-center cursor-pointer">
                                    <input type="checkbox" checked={!!perms[action]} onChange={(e) => handleTogglePermission(mod.id, action, e.target.checked)} className="peer sr-only" />
                                    <div className="w-5 h-5 border-2 border-gray-300 rounded peer-checked:bg-[var(--color-brand-blue)] peer-checked:border-[var(--color-brand-blue)] transition-colors flex items-center justify-center">
                                      <svg className={`w-3 h-3 text-white pointer-events-none ${perms[action] ? 'block' : 'hidden'}`} viewBox="0 0 14 10" fill="none"><path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    </div>
                                  </label>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="px-10 py-6 border-t border-gray-100 shrink-0 flex justify-end gap-6 bg-gray-50/50">
                    <button type="button" onClick={() => setIsAddGroupModalOpen(false)} className="text-[11px] font-bold tracking-widest uppercase text-gray-400 hover:text-gray-800 transition-colors outline-none">Cancel</button>
                    <button type="submit" className="text-[11px] font-bold tracking-widest uppercase text-white bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-gold)] px-6 py-3 rounded transition-colors outline-none shadow-md">Create Group & Save</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* USER MODAL */}
          {isModalOpen && (
            <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white border border-gray-200 shadow-2xl w-full max-w-xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-10 py-8 border-b border-gray-100">
                  <h3 className="text-2xl font-serif text-[var(--color-brand-blue)] font-light">{editingUser ? 'Edit User' : 'New User'}</h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900 transition-colors outline-none"><X size={24} strokeWidth={1.5} /></button>
                </div>

                <form onSubmit={handleSubmit} className="px-10 py-8 flex flex-col gap-8">
                  <div>
                    <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-4 block">Username</label>
                    <input type="text" required value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} className="w-full bg-transparent border-b border-gray-200 py-2 text-base text-[var(--color-brand-blue)] outline-none focus:border-[var(--color-brand-blue)] transition-colors placeholder:text-gray-300" placeholder="e.g. admin" disabled={!!editingUser} />
                  </div>

                  {!editingUser && (
                    <div>
                    <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-4 block">
                      {editingUser ? 'New Password (Leave blank to keep current)' : 'Password'}
                    </label>
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        required={!editingUser} 
                        value={formData.password} 
                        onChange={(e) => { setFormData({...formData, password: e.target.value}); setPasswordError(''); }} 
                        className={`w-full bg-transparent border-b py-2 pr-10 text-base outline-none transition-colors placeholder:text-gray-300 ${passwordError ? 'border-red-500 text-red-500 focus:border-red-500' : 'border-gray-200 text-[var(--color-brand-blue)] focus:border-[var(--color-brand-blue)]'}`} 
                        placeholder={editingUser ? "Leave blank to keep unchanged" : "••••••••"} 
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-0 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[var(--color-brand-blue)] transition-colors outline-none">
                        {showPassword ? <Eye size={18} strokeWidth={1.5} /> : <EyeOff size={18} strokeWidth={1.5} />}
                      </button>
                    </div>
                    {passwordError ? (
                      <p className="text-red-500 text-[11px] mt-2 font-medium">{passwordError}</p>
                    ) : (
                      <p className="text-gray-400 text-[11px] mt-2">Must be at least 8 characters with 1 uppercase, 1 number, and 1 special character.</p>
                    )}
                  </div>
                  )}

                  <div>
                    <label className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-4 block">Access Role</label>
                    <div className="flex items-center gap-4 mb-6">
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--color-brand-blue)]">
                        <input type="checkbox" checked={formData.is_super_admin} onChange={(e) => setFormData({...formData, is_super_admin: e.target.checked, group_id: ''})} className="accent-[var(--color-brand-gold)]" />
                        Grant Super Admin Privileges
                      </label>
                    </div>
                    {!formData.is_super_admin && (
                      <select value={formData.group_id} onChange={(e) => setFormData({...formData, group_id: e.target.value})} className="w-full bg-transparent border-b border-gray-200 py-2 text-base text-[var(--color-brand-blue)] outline-none focus:border-[var(--color-brand-blue)] transition-colors cursor-pointer" required={!formData.is_super_admin}>
                        <option value="" disabled>Select a department group...</option>
                        {groups.map(g => (
                          <option key={g.id} value={g.id} disabled={g.is_active === false}>{g.group_name} {g.is_active === false ? '(Disabled)' : ''}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="flex gap-6 pt-4 mt-2 border-t border-gray-100">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="text-[11px] font-bold tracking-widest uppercase text-gray-400 hover:text-gray-800 transition-colors outline-none">Cancel</button>
                    <button type="submit" className="text-[11px] font-bold tracking-widest uppercase text-[var(--color-brand-blue)] hover:text-[var(--color-brand-gold)] transition-colors outline-none">{editingUser ? 'Save Changes' : 'Create User'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* GLOBAL ALERTS */}
          {alertConfig.isOpen && (
            <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white border border-gray-200 shadow-2xl w-full max-w-sm flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <div className="px-8 py-6 text-center flex flex-col items-center">
                  {alertConfig.type === 'error' ? <ShieldAlert className="text-red-500 mb-4" size={40} strokeWidth={1.5} /> :
                   alertConfig.type === 'success' ? <CheckCircle className="text-green-500 mb-4" size={40} strokeWidth={1.5} /> :
                   alertConfig.type === 'warning' ? <AlertTriangle className="text-[var(--color-brand-gold)] mb-4" size={40} strokeWidth={1.5} /> :
                   <Info className="text-[var(--color-brand-blue)] mb-4" size={40} strokeWidth={1.5} />}
                  <h3 className="text-xl font-serif text-[var(--color-brand-blue)] mb-2">{alertConfig.type === 'error' ? 'Error' : alertConfig.type === 'success' ? 'Success' : alertConfig.type === 'warning' ? 'Warning' : 'Notice'}</h3>
                  <p className="text-sm text-gray-500 mb-6">{alertConfig.message}</p>
                  <button onClick={handleCloseAlert} className="w-full text-xs font-bold tracking-widest uppercase text-white bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-gold)] px-6 py-3 rounded transition-colors outline-none">Close</button>
                </div>
              </div>
            </div>
          )}

          {/* GLOBAL CONFIRMS */}
          {confirmConfig.isOpen && (
            <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white border border-gray-200 shadow-2xl w-full max-w-md flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <div className="px-8 py-6">
                  <div className="flex items-center gap-4 mb-4"><AlertTriangle className="text-[var(--color-brand-gold)]" size={28} strokeWidth={1.5} /><h3 className="text-xl font-serif text-[var(--color-brand-blue)]">Confirm Action</h3></div>
                  <p className="text-sm text-gray-500 mb-8">{confirmConfig.message}</p>
                  <div className="flex justify-end gap-4">
                    <button onClick={() => setConfirmConfig({ ...confirmConfig, isOpen: false })} className="text-[11px] font-bold tracking-widest uppercase text-gray-400 hover:text-gray-800 transition-colors outline-none">Cancel</button>
                    <button onClick={() => { setConfirmConfig({ ...confirmConfig, isOpen: false }); confirmConfig.onConfirm(); }} className="text-[11px] font-bold tracking-widest uppercase text-white bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-gold)] px-6 py-3 rounded transition-colors outline-none shadow-md">Confirm</button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-white text-[var(--color-brand-blue)] text-sm font-bold uppercase tracking-widest">Loading...</div>}>
      <PageTransition>
        <UsersManager />
      </PageTransition>
    </Suspense>
  );
}