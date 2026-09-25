// app/admin/users/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Search, UsersRound, ShieldCheck, UserRoundCheck,
  UserRoundX, Pencil, X, CheckCircle2, AlertTriangle, Loader2, Eye,
  EyeOff,
} from 'lucide-react';
import PageTransition from '@/app/components/page-transitions';
import { createClient } from '@/utils/supabase/client';
import {
  createUserAction, updateUserAction, toggleUserStatusAction,
  toggleGroupStatusAction, createGroupAction,
} from '@/app/actions/user';
import { getCurrentUser } from '@/app/actions/auth';
import { savePermissionsAction } from '@/app/actions/permissions';

type PermissionKey = 'can_view' | 'can_create' | 'can_edit' | 'can_delete';
type Permission = Record<PermissionKey, boolean>;
type PermissionMap = Record<number, Permission>;
type Notice = { type: 'success' | 'error'; message: string };
type Confirm = { title: string; message: string; label: string; onConfirm: () => Promise<void> };
type AdminUser = {
  id: string | number; username: string; is_super_admin: boolean;
  group_id: number | string | null; is_active: boolean; last_login?: string | null;
  groups?: { group_name: string } | { group_name: string }[] | null;
};
type Department = { id: number | string; group_name: string; description?: string | null; is_active?: boolean | null };
type Module = { id: number; module_name: string };

const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-brand-blue outline-none transition-colors focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/15';
const labelClass = 'mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500';
const primaryClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-gold disabled:cursor-not-allowed disabled:opacity-50';
const secondaryClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-brand-blue transition-colors hover:border-brand-blue/30 disabled:opacity-50';
const emptyPermission = (): Permission => ({ can_view: false, can_create: false, can_edit: false, can_delete: false });
const groupName = (user: AdminUser) => {
  const group = Array.isArray(user.groups) ? user.groups[0] : user.groups;
  return user.is_super_admin ? 'Super Admin' : (group?.group_name || 'No department');
};
const displayDate = (date?: string | null) => date ? new Date(date).toLocaleDateString() : 'Never signed in';
const viewOnlyModule = (name: string) => ['notifications', 'audit log', 'audit logs'].includes(name.toLowerCase());

function PermissionMatrix({ modules, values, onChange, readOnly = false }: {
  modules: Module[]; values: PermissionMap;
  onChange: (moduleId: number, key: PermissionKey, checked: boolean) => void;
  readOnly?: boolean;
}) {
  const columns: { key: PermissionKey; label: string }[] = [
    { key: 'can_view', label: 'View' }, { key: 'can_create', label: 'Add' },
    { key: 'can_edit', label: 'Edit' }, { key: 'can_delete', label: 'Archive' },
  ];
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full min-w-[540px] text-left">
        <thead className="bg-gray-50/80 text-[10px] font-bold uppercase tracking-widest text-gray-500">
          <tr><th scope="col" className="px-4 py-3">Section</th>{columns.map((column) => <th scope="col" className="px-3 py-3 text-center" key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {modules.map((module) => (
            <tr key={module.id}>
              <th scope="row" className="px-4 py-3 text-xs font-semibold capitalize text-brand-blue">{module.module_name}</th>
              {columns.map(({ key, label }) => {
                const unavailable = viewOnlyModule(module.module_name) && key !== 'can_view';
                return <td key={key} className="px-3 py-3 text-center">
                  {unavailable ? <span className="text-gray-300" aria-label={`${label} unavailable`}>—</span> : (
                    <input
                      type="checkbox"
                      disabled={readOnly}
                      checked={Boolean(values[module.id]?.[key])}
                      onChange={(event) => onChange(module.id, key, event.target.checked)}
                      aria-label={`${label} access for ${module.module_name}`}
                      className="h-4 w-4 cursor-pointer accent-brand-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
                    />
                  )}
                </td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsersManager() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [tab, setTab] = useState<'users' | 'departments'>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string | number; is_super_admin: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [userForm, setUserForm] = useState({ username: '', password: '', is_super_admin: false, group_id: '' });
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [newDepartmentOpen, setNewDepartmentOpen] = useState(false);
  const [departmentForm, setDepartmentForm] = useState({ group_name: '', description: '' });
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [permissions, setPermissions] = useState<PermissionMap>({});
  const [permissionsBaseline, setPermissionsBaseline] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const profile = await getCurrentUser();
      if (!profile) { router.replace('/admin'); return; }
      setCurrentUser(profile);
      const [usersResult, departmentsResult, modulesResult] = await Promise.all([
        supabase.from('admin_users').select('id, username, is_super_admin, group_id, is_active, last_login, groups ( group_name )'),
        supabase.from('groups').select('*'),
        supabase.from('modules').select('*'),
      ]);
      const error = usersResult.error || departmentsResult.error || modulesResult.error;
      if (error) throw error;
      setUsers((usersResult.data || []) as AdminUser[]);
      setDepartments((departmentsResult.data || []) as Department[]);
      setModules(((modulesResult.data || []) as Module[]).filter((module) => module.module_name?.toLowerCase() !== 'payment'));
    } catch (error) {
      setLoadFailed(true);
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to load user access. Try refreshing the page.' });
    } finally { setLoading(false); }
  }, [router, supabase]);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => {
    if (!notice || notice.type === 'error') return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const filteredUsers = useMemo(() => users.filter((user) => {
    const query = search.trim().toLowerCase();
    const matchesName = user.username?.toLowerCase().includes(query) || groupName(user).toLowerCase().includes(query);
    const matchesRole = role === 'all' || (role === 'super' ? user.is_super_admin : String(user.group_id) === role && !user.is_super_admin);
    return matchesName && matchesRole;
  }), [users, search, role]);
  const activeUsers = users.filter((user) => user.is_active !== false).length;
  const activeDepartments = departments.filter((department) => department.is_active !== false).length;
  const isSelf = (user: AdminUser) => String(user.id) === String(currentUser?.id);

  const openUser = (user: AdminUser | null = null) => {
    setEditingUser(user);
    setUserForm(user
      ? { username: user.username, password: '', is_super_admin: user.is_super_admin, group_id: String(user.group_id ?? '') }
      : { username: '', password: '', is_super_admin: false, group_id: String(departments.find((group) => group.is_active !== false)?.id ?? '') });
    setPasswordVisible(false);
    setPasswordError('');
    setUserModalOpen(true);
  };

  const saveUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser?.is_super_admin || saving) return;
    const username = userForm.username.trim();
    if (!editingUser && !/^[a-zA-Z0-9_]+$/.test(username)) {
      setNotice({ type: 'error', message: 'Use letters, numbers, or underscores for the username.' }); return;
    }
    if (!userForm.is_super_admin && !userForm.group_id) {
      setNotice({ type: 'error', message: 'Choose a department before saving this account.' }); return;
    }
    if (!editingUser || userForm.password) {
      if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(userForm.password)) {
        setPasswordError('Use 8 or more characters, including a capital letter, a number, and a symbol.'); return;
      }
    }
    if (editingUser && isSelf(editingUser) && !userForm.is_super_admin) {
      setNotice({ type: 'error', message: 'You cannot remove your own Super Admin access.' }); return;
    }
    setSaving(true);
    try {
      const payload = { ...userForm, username };
      const result = editingUser
        ? await updateUserAction({ id: editingUser.id, ...payload })
        : await createUserAction(payload);
      if (!result.success) throw new Error(result.error || 'Could not save the user.');
      setUserModalOpen(false);
      setNotice({ type: 'success', message: editingUser ? 'User updated.' : 'User created.' });
      await loadData();
    } catch (error) { setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to save the user.' }); }
    finally { setSaving(false); }
  };

  const toggleUser = (user: AdminUser) => {
    if (!currentUser?.is_super_admin || isSelf(user)) return;
    const enabling = user.is_active === false;
    setConfirm({
      title: enabling ? 'Enable this user?' : 'Disable this user?',
      message: enabling ? `${user.username} will be able to sign in again.` : `${user.username} will lose access to the admin dashboard. Their account and history will remain available.`,
      label: enabling ? 'Enable User' : 'Disable User',
      onConfirm: async () => {
        const result = await toggleUserStatusAction(String(user.id), enabling);
        if (!result.success) throw new Error(result.error || 'Unable to change user access.');
        setUsers((list) => list.map((entry) => String(entry.id) === String(user.id) ? { ...entry, is_active: enabling } : entry));
        setNotice({ type: 'success', message: `${user.username} ${enabling ? 'enabled' : 'disabled'}.` });
      },
    });
  };

  const toggleDepartment = (department: Department) => {
    if (!currentUser?.is_super_admin) return;
    const enabling = department.is_active === false;
    setConfirm({
      title: enabling ? 'Enable this department?' : 'Disable this department?',
      message: enabling ? `Members of ${department.group_name} will regain their department access.` : `Members of ${department.group_name} will lose their department access. Their accounts and permissions will be retained.`,
      label: enabling ? 'Enable Department' : 'Disable Department',
      onConfirm: async () => {
        const result = await toggleGroupStatusAction(department.id, enabling);
        if (!result.success) throw new Error(result.error || 'Unable to change department access.');
        setDepartments((list) => list.map((entry) => entry.id === department.id ? { ...entry, is_active: enabling } : entry));
        setNotice({ type: 'success', message: `${department.group_name} ${enabling ? 'enabled' : 'disabled'}.` });
      },
    });
  };

  const updatePermission = (moduleId: number, key: PermissionKey, checked: boolean) => {
    setPermissions((current) => {
      const next = { ...(current[moduleId] || emptyPermission()), [key]: checked };
      if (!checked && key === 'can_view') Object.assign(next, emptyPermission());
      if (checked && key !== 'can_view') next.can_view = true;
      return { ...current, [moduleId]: next };
    });
  };
  const blankPermissions = () => Object.fromEntries(modules.map((module) => [module.id, emptyPermission()])) as PermissionMap;
  const openNewDepartment = () => {
    setDepartmentForm({ group_name: '', description: '' });
    setPermissions(blankPermissions());
    setNewDepartmentOpen(true);
  };
  const openDepartment = async (department: Department) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.from('module_access').select('*').eq('group_id', department.id);
      if (error) throw error;
      const initial = blankPermissions();
      for (const row of data || []) initial[row.module_id] = {
        can_view: Boolean(row.can_view), can_create: Boolean(row.can_create),
        can_edit: Boolean(row.can_edit), can_delete: Boolean(row.can_delete),
      };
      setPermissions(initial);
      setPermissionsBaseline(JSON.stringify(initial));
      setEditingDepartment(department);
    } catch (error) { setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to load department access.' }); }
    finally { setSaving(false); }
  };

  const closeDepartment = () => {
    if (JSON.stringify(permissions) !== permissionsBaseline) {
      setConfirm({ title: 'Discard access changes?', message: 'The permission changes you made have not been saved.', label: 'Discard Changes', onConfirm: async () => { setEditingDepartment(null); } });
    } else setEditingDepartment(null);
  };
  const saveDepartmentPermissions = async () => {
    if (!editingDepartment || !currentUser?.is_super_admin || saving) return;
    setSaving(true);
    try {
      const rows = modules.map((module) => ({
        group_id: editingDepartment.id, module_id: module.id,
        ...(permissions[module.id] || emptyPermission()), updated_at: new Date().toISOString(),
      }));
      const result = await savePermissionsAction(rows);
      if (!result.success) throw new Error(result.error || 'Unable to save access.');
      setEditingDepartment(null);
      setNotice({ type: 'success', message: `${editingDepartment.group_name} access updated.` });
    } catch (error) { setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to save access.' }); }
    finally { setSaving(false); }
  };
  const saveNewDepartment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser?.is_super_admin || saving) return;
    const name = departmentForm.group_name.trim();
    if (!name) return;
    if (departments.some((department) => department.group_name.toLowerCase() === name.toLowerCase())) {
      setNotice({ type: 'error', message: 'A department with this name already exists.' }); return;
    }
    setSaving(true);
    try {
      const rows = modules.map((module) => ({ module_id: module.id, ...(permissions[module.id] || emptyPermission()), updated_at: new Date().toISOString() }));
      const result = await createGroupAction(name, departmentForm.description.trim(), rows);
      if (!result.success) throw new Error(result.error || 'Unable to create the department.');
      setNewDepartmentOpen(false);
      setNotice({ type: 'success', message: `${name} created.` });
      await loadData();
    } catch (error) { setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to create the department.' }); }
    finally { setSaving(false); }
  };
  const confirmAction = async () => {
    if (!confirm || saving) return;
    setSaving(true);
    try { await confirm.onConfirm(); setConfirm(null); }
    catch (error) { setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unable to complete this action.' }); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F8F9FC] font-sans text-gray-900">
      <header className="z-20 flex h-[68px] shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-5 md:px-8">
        <button type="button" onClick={() => router.push('/admin/dashboard')} aria-label="Back to dashboard" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:border-brand-blue hover:text-brand-blue"><ArrowLeft size={18} /></button>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">Administration / Access</p>
          <h1 className="font-serif text-2xl leading-tight text-brand-blue">Users &amp; Access</h1>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-5 pb-16 pt-8 md:px-8 md:pt-10">
        <div className="mx-auto w-full max-w-6xl">
          <div role="tablist" aria-label="Users and departments" className="flex gap-6 border-b border-gray-200">
            {([{ id: 'users', label: 'Users' }, { id: 'departments', label: 'Departments' }] as const).map(({ id, label }) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`border-b-2 pb-3 text-sm font-semibold transition-colors ${tab === id ? 'border-brand-blue text-brand-blue' : 'border-transparent text-gray-400 hover:text-brand-blue'}`}>{label}</button>
            ))}
          </div>

          <div className="mb-7 mt-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">Administration · {tab === 'users' ? 'Users' : 'Departments'}</p>
              <h2 className="mt-2 font-serif text-3xl text-brand-blue">{tab === 'users' ? 'User Accounts' : 'Department Access'}</h2>
              <p className="mt-2 text-sm text-gray-500">{tab === 'users' ? 'Manage who can sign in and which department they belong to.' : 'Set the sections each department can view and manage.'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-600">{tab === 'users' ? `${users.length} users` : `${departments.length} departments`}</span>
              <span className="rounded-full bg-green-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-green-700">{tab === 'users' ? `${activeUsers} active` : `${activeDepartments} active`}</span>
            </div>
          </div>

          {loading ? <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-gray-500"><Loader2 className="animate-spin text-brand-blue" size={20} /> Loading access...</div>
          : loadFailed ? <div className="rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center"><AlertTriangle size={27} className="mx-auto text-brand-gold" /><p className="mt-3 text-sm font-semibold text-brand-blue">Unable to load access settings</p><p className="mt-1 text-xs text-gray-500">Check your connection and try again.</p><button type="button" onClick={() => void loadData()} className={`${primaryClass} mt-5`}>Try Again</button></div>
          : tab === 'users' ? (
            <section aria-label="User accounts">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div><p className="text-xs font-semibold text-brand-blue">Showing {filteredUsers.length} of {users.length}</p><p className="mt-1 text-xs text-gray-500">Select Edit to change a user’s role or password.</p></div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <label className="relative min-w-[210px] flex-1 sm:w-64"><span className="sr-only">Search users</span><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users..." className={`${inputClass} py-2.5 pl-10`} /></label>
                  <label className="min-w-[160px] flex-1 sm:w-44"><span className="sr-only">Filter by role</span><select value={role} onChange={(event) => setRole(event.target.value)} className={`${inputClass} py-2.5`}><option value="all">All roles</option><option value="super">Super Admin</option>{departments.map((department) => <option key={department.id} value={String(department.id)}>{department.group_name}</option>)}</select></label>
                  {currentUser?.is_super_admin && <button type="button" onClick={() => openUser()} className={primaryClass}><Plus size={15} /> Add User</button>}
                </div>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="bg-gray-50/80 text-[10px] font-bold uppercase tracking-widest text-gray-500"><tr><th scope="col" className="px-5 py-4">User</th><th scope="col" className="px-5 py-4">Role / Department</th><th scope="col" className="px-5 py-4">Account</th><th scope="col" className="px-5 py-4">Last Sign In</th><th scope="col" className="px-5 py-4 text-right">Actions</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredUsers.length === 0 ? <tr><td colSpan={5} className="px-6 py-16 text-center"><UsersRound size={28} className="mx-auto text-gray-300" /><p className="mt-3 text-sm font-semibold text-brand-blue">{users.length ? 'No matching users' : 'No user accounts yet'}</p><p className="mt-1 text-xs text-gray-500">{users.length ? 'Try another name or role.' : 'Add a user to grant dashboard access.'}</p></td></tr> : filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-brand-blue/[0.02]">
                        <th scope="row" className="px-5 py-4 text-sm font-semibold text-brand-blue">{user.username}{isSelf(user) && <span className="ml-2 text-[10px] font-normal text-gray-400">You</span>}</th>
                        <td className="px-5 py-4 text-xs text-gray-600">{groupName(user)}</td>
                        <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${user.is_active !== false ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{user.is_active !== false ? 'Active' : 'Disabled'}</span></td>
                        <td className="px-5 py-4 text-xs text-gray-500">{displayDate(user.last_login)}</td>
                        <td className="px-5 py-4"><div className="flex justify-end gap-2">{currentUser?.is_super_admin && <><button type="button" onClick={() => openUser(user)} className={secondaryClass} aria-label={`Edit ${user.username}`}><Pencil size={13} /> Edit</button><button type="button" onClick={() => toggleUser(user)} disabled={isSelf(user)} title={isSelf(user) ? 'You cannot disable your own account' : undefined} className={secondaryClass} aria-label={`${user.is_active === false ? 'Enable' : 'Disable'} ${user.username}`}>{user.is_active === false ? <UserRoundCheck size={14} /> : <UserRoundX size={14} />}{user.is_active === false ? 'Enable' : 'Disable'}</button></>}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <section aria-label="Departments">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-gray-500">Select a department to review its access. Disabled departments retain their settings.</p>{currentUser?.is_super_admin && <button type="button" onClick={openNewDepartment} className={primaryClass}><Plus size={15} /> Add Department</button>}</div>
              {departments.length === 0 ? <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center"><ShieldCheck size={28} className="mx-auto text-gray-300" /><p className="mt-3 text-sm font-semibold text-brand-blue">No departments yet</p><p className="mt-1 text-xs text-gray-500">Create one to organize user access.</p></div> : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{departments.map((department) => (
                  <article key={department.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3"><div><h3 className="font-serif text-xl text-brand-blue">{department.group_name}</h3><span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${department.is_active !== false ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{department.is_active !== false ? 'Active' : 'Disabled'}</span></div><ShieldCheck size={19} className="text-brand-gold" /></div>
                    <p className="mt-4 min-h-12 text-sm leading-relaxed text-gray-500">{department.description || 'Access settings for this department.'}</p>
                    <p className="mt-3 text-xs text-gray-500">{users.filter((user) => String(user.group_id) === String(department.id) && !user.is_super_admin).length} members</p>
                    <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-4"><button type="button" onClick={() => void openDepartment(department)} className={secondaryClass}><Pencil size={14} /> {currentUser?.is_super_admin ? 'Manage Access' : 'View Access'}</button>{currentUser?.is_super_admin && <button type="button" onClick={() => toggleDepartment(department)} className={secondaryClass}>{department.is_active === false ? <UserRoundCheck size={14} /> : <UserRoundX size={14} />}{department.is_active === false ? 'Enable' : 'Disable'}</button>}</div>
                  </article>
                ))}</div>
              )}
            </section>
          )}
        </div>
      </main>

      {notice && <div role={notice.type === 'error' ? 'alert' : 'status'} className={`fixed right-5 top-5 z-[140] flex max-w-sm items-start gap-2 rounded-xl border bg-white p-4 text-xs shadow-xl ${notice.type === 'error' ? 'border-red-200 text-red-700' : 'border-green-200 text-green-700'}`}>{notice.type === 'error' ? <AlertTriangle size={16} className="shrink-0" /> : <CheckCircle2 size={16} className="shrink-0" />}<span className="flex-1">{notice.message}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message"><X size={15} /></button></div>}

      {userModalOpen && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-brand-blue/60 p-4 backdrop-blur-sm" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="user-dialog-title" className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-gray-100 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold">User Account</p><h2 id="user-dialog-title" className="mt-1 font-serif text-2xl text-brand-blue">{editingUser ? 'Edit User' : 'Add User'}</h2></div><button type="button" onClick={() => setUserModalOpen(false)} aria-label="Close user form" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X size={18} /></button></div>
        <form onSubmit={saveUser} className="max-h-[calc(90vh-90px)] overflow-y-auto"><div className="space-y-5 px-6 py-6"><div><label htmlFor="user-name" className={labelClass}>Username</label><input id="user-name" autoFocus required disabled={Boolean(editingUser)} autoComplete="username" value={userForm.username} onChange={(event) => setUserForm({ ...userForm, username: event.target.value })} placeholder="e.g. project_editor" className={inputClass} /><p className="mt-2 text-xs text-gray-500">Letters, numbers, and underscores. The username cannot be changed later.</p></div>
          <div><label htmlFor="user-password" className={labelClass}>{editingUser ? 'New Password' : 'Password'}</label><div className="relative"><input id="user-password" type={passwordVisible ? 'text' : 'password'} required={!editingUser} autoComplete="new-password" value={userForm.password} onChange={(event) => { setPasswordError(''); setUserForm({ ...userForm, password: event.target.value }); }} placeholder={editingUser ? 'Leave blank to keep the current password' : 'Create a password'} className={`${inputClass} pr-12`} /><button type="button" onClick={() => setPasswordVisible(!passwordVisible)} aria-label={passwordVisible ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">{passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><p className={`mt-2 text-xs ${passwordError ? 'text-red-600' : 'text-gray-500'}`}>{passwordError || (editingUser ? 'Leave blank unless you want to change the password.' : 'At least 8 characters, with a capital letter, number, and symbol.')}</p></div>
          <div><label htmlFor="user-department" className={labelClass}>Access Role</label><label className="mb-3 flex items-start gap-3 rounded-xl border border-gray-200 p-3 text-sm text-brand-blue"><input type="checkbox" checked={userForm.is_super_admin} onChange={(event) => setUserForm({ ...userForm, is_super_admin: event.target.checked, group_id: event.target.checked ? '' : String(departments.find((group) => group.is_active !== false)?.id ?? '') })} disabled={Boolean(editingUser && isSelf(editingUser))} className="mt-0.5 h-4 w-4 accent-brand-blue" /><span><strong>Super Admin</strong><small className="mt-1 block text-xs text-gray-500">Full access to administration and all sections.</small></span></label>{!userForm.is_super_admin && <select id="user-department" required value={userForm.group_id} onChange={(event) => setUserForm({ ...userForm, group_id: event.target.value })} className={inputClass}><option value="" disabled>Choose a department</option>{departments.map((group) => <option key={group.id} value={group.id} disabled={group.is_active === false}>{group.group_name}{group.is_active === false ? ' (Disabled)' : ''}</option>)}</select>}</div></div>
          <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4"><button type="button" onClick={() => setUserModalOpen(false)} className={secondaryClass}>Cancel</button><button type="submit" disabled={saving} className={primaryClass}>{saving && <Loader2 size={14} className="animate-spin" />}{editingUser ? 'Save Changes' : 'Create User'}</button></div>
        </form></section></div>}

      {(newDepartmentOpen || editingDepartment) && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-brand-blue/60 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="department-dialog-title" className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex shrink-0 items-start justify-between border-b border-gray-100 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold">Department Access</p><h2 id="department-dialog-title" className="mt-1 font-serif text-2xl text-brand-blue">{editingDepartment ? editingDepartment.group_name : 'Add Department'}</h2><p className="mt-1 text-xs text-gray-500">Choose what members of this department can do in each section.</p></div><button type="button" onClick={editingDepartment ? closeDepartment : () => setNewDepartmentOpen(false)} aria-label="Close department form" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X size={18} /></button></div>
        <form id="department-form" onSubmit={newDepartmentOpen ? saveNewDepartment : (event) => { event.preventDefault(); void saveDepartmentPermissions(); }} className="min-h-0 flex-1 overflow-y-auto px-6 py-5"><div className="space-y-5">{newDepartmentOpen && <><div><label htmlFor="department-name" className={labelClass}>Department Name</label><input id="department-name" autoFocus required value={departmentForm.group_name} onChange={(event) => setDepartmentForm({ ...departmentForm, group_name: event.target.value })} placeholder="e.g. Content Team" className={inputClass} /></div><div><label htmlFor="department-description" className={labelClass}>Description (optional)</label><textarea id="department-description" rows={2} value={departmentForm.description} onChange={(event) => setDepartmentForm({ ...departmentForm, description: event.target.value })} placeholder="What does this department manage?" className={inputClass} /></div></>}
          <div><p className={labelClass}>Section Permissions</p><p className="mb-3 text-xs leading-relaxed text-gray-500">View lets people open a section. Add, Edit, and Archive also enable View. Removing View clears the other options for that section.</p><PermissionMatrix modules={modules} values={permissions} onChange={updatePermission} readOnly={!currentUser?.is_super_admin} /></div></div></form>
        <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4"><button type="button" onClick={editingDepartment ? closeDepartment : () => setNewDepartmentOpen(false)} className={secondaryClass}>Cancel</button>{currentUser?.is_super_admin && <button type="submit" form="department-form" disabled={saving || (Boolean(editingDepartment) && JSON.stringify(permissions) === permissionsBaseline)} className={primaryClass}>{saving && <Loader2 size={14} className="animate-spin" />}{editingDepartment ? 'Save Access' : 'Create Department'}</button>}</div>
      </section></div>}

      {confirm && <div className="fixed inset-0 z-[130] flex items-center justify-center bg-brand-blue/60 p-4 backdrop-blur-sm"><section role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><AlertTriangle size={23} className="text-brand-gold" /><h2 id="confirm-title" className="mt-3 font-serif text-2xl text-brand-blue">{confirm.title}</h2><p id="confirm-description" className="mt-2 text-sm leading-relaxed text-gray-600">{confirm.message}</p><div className="mt-6 flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setConfirm(null)} className={secondaryClass}>Cancel</button><button type="button" disabled={saving} onClick={() => void confirmAction()} className={primaryClass}>{saving && <Loader2 size={14} className="animate-spin" />}{confirm.label}</button></div></section></div>}
    </div>
  );
}

export default function AdminUsersPage() {
  return <PageTransition><UsersManager /></PageTransition>;
}
