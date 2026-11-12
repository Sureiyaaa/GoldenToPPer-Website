'use server';

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getCurrentUser, getRBACProfile, requireSuperAdmin } from './auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function requirePermission(moduleCode: string, permission: 'can_view' | 'can_edit') {
  // getRBACProfile verifies the signed custom session and active account/group.
  const profile = await getRBACProfile();
  if (!profile) throw new Error('Unauthorized: Session expired.');
  if (profile.permissions === 'SUPER_ADMIN') return;
  if (typeof profile.permissions !== 'object' || profile.permissions?.[moduleCode]?.[permission] !== true) {
    throw new Error('You do not have permission to perform this operation.');
  }
}

const recordId = z.union([
  z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  z.string().regex(/^[1-9]\d*$/).refine(value => Number.isSafeInteger(Number(value))),
]).transform(String);

const imageUrl = z.string().trim().max(2048).refine(value => {
  if (value.startsWith('/') && !value.startsWith('//') && !/[\\\s]/.test(value)) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}, 'Use an HTTPS image URL or a local image path');

const navigationUpdate = z.object({
  nav_title: z.string().trim().min(1).max(200),
  tagline: z.string().trim().max(2000),
  nav_image_url: imageUrl.nullable(),
  is_active: z.boolean(),
}).strict();

export async function fetchUsersAccessAction() {
  await requirePermission('admin_manage', 'can_view');
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error('Unauthorized');
  const [users, departments, modules] = await Promise.all([
    supabaseAdmin.from('admin_users').select('id, username, is_super_admin, group_id, is_active, last_login, groups(group_name)'),
    supabaseAdmin.from('groups').select('id, group_name, description, is_active'),
    supabaseAdmin.from('modules').select('id, module_name'),
  ]);
  if (users.error || departments.error || modules.error) throw new Error('Unable to load user access.');
  return {
    currentUser: { id: currentUser.id, is_super_admin: currentUser.is_super_admin },
    users: users.data ?? [], departments: departments.data ?? [], modules: modules.data ?? [],
  };
}

export async function fetchDepartmentPermissionsAction(groupId: unknown) {
  await requirePermission('admin_manage', 'can_view');
  const id = recordId.parse(groupId);
  const { data, error } = await supabaseAdmin.from('module_access')
    .select('module_id, can_view, can_create, can_edit, can_delete').eq('group_id', id);
  if (error) throw new Error('Unable to load department access.');
  return data ?? [];
}

export async function fetchAdminNavigationAction() {
  await requirePermission('edit_project', 'can_view');
  const { data, error } = await supabaseAdmin.from('navbar_projects')
    .select('id, project_id, nav_title, tagline, nav_image_url, display_order, is_active, project_table(title, is_active, deleted_at)')
    .order('display_order', { ascending: true });
  if (error) throw new Error('Unable to load navigation items.');
  return (data ?? []).filter(item => {
    const project = Array.isArray(item.project_table) ? item.project_table[0] : item.project_table;
    return project && !project.deleted_at;
  });
}

export async function saveNavigationAction(id: unknown, payload: unknown) {
  await requirePermission('edit_project', 'can_edit');
  const navigationId = recordId.parse(id);
  const values = navigationUpdate.parse(payload);
  const { data, error } = await supabaseAdmin.from('navbar_projects')
    .update(values).eq('id', navigationId).select('id').single();
  if (error || !data) throw new Error('Unable to save navigation item. Reload and try again.');
  return { success: true };
}

export async function saveNavigationOrderAction(ids: unknown) {
  await requirePermission('edit_project', 'can_edit');
  const orderedIds = z.array(recordId).min(1).max(1000)
    .refine(values => new Set(values).size === values.length, 'Duplicate navigation IDs').parse(ids);
  // Validate the complete submitted set before making any writes. Do not upsert:
  // callers must not create navigation records through the ordering operation.
  const { data: rows, error: lookupError } = await supabaseAdmin.from('navbar_projects')
    .select('id').in('id', orderedIds);
  if (lookupError || !rows || rows.length !== orderedIds.length) throw new Error('Navigation changed. Reload before reordering.');
  for (const [index, id] of orderedIds.entries()) {
    const { data, error } = await supabaseAdmin.from('navbar_projects')
      .update({ display_order: index + 1 }).eq('id', id).select('id').single();
    if (error || !data) throw new Error('Navigation order could not be fully saved. Reload before retrying.');
  }
  return { success: true };
}

export async function fetchModulesManagementAction() {
  await requireSuperAdmin();
  const { data, error } = await supabaseAdmin.from('modules')
    .select('id, module_name, module_code, description, is_active')
    .not('module_code', 'in', '(audit_log,admin_manage,notifications_code,navbar_setup)').order('id');
  if (error) throw new Error('Unable to load module management.');
  return data ?? [];
}

export async function setModuleVisibilityAction(id: unknown, isActive: unknown) {
  await requireSuperAdmin();
  const moduleId = recordId.parse(id);
  const active = z.boolean().parse(isActive);
  const { data, error } = await supabaseAdmin.from('modules').update({ is_active: active })
    .eq('id', moduleId).not('module_code', 'in', '(audit_log,admin_manage,notifications_code,navbar_setup)')
    .select('id').single();
  if (error || !data) throw new Error('Unable to update module visibility.');
  return { success: true };
}

export async function fetchAdminNewsAction(id?: unknown) {
  await requirePermission('edit_news', 'can_view');
  let query = supabaseAdmin.from('news_updates')
    .select('id, title, date, category, image, excerpt, slug, created_at, is_active, is_archived, article_content, article_layout, article_sections, show_cover_on_article');
  if (id !== undefined) query = query.eq('id', z.string().uuid().parse(id));
  else query = query.is('is_archived', null);
  const { data, error } = await query.order('date', { ascending: false });
  if (error) throw new Error('Unable to load articles.');
  return data ?? [];
}
