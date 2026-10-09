// app/actions/admin_fetchers.ts
'use server';

import { createClient } from '@supabase/supabase-js';
import { getCustomSession, getCurrentUser, getRBACProfile } from './auth';
import {
  normalizeCustomerInbox,
  type CustomerInboxItem,
  type CustomerInboxItemType,
  type InquiryInboxRow,
  type SupportInboxRow,
  type LoanInboxRow,
} from '@/lib/customer-inbox';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

export async function fetchAdminVirtualToursList() {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");

  // The dashboard represents Virtual Tours at the PROJECT level.
  // Individual virtual_tours rows are units/models that belong to that project.
  const { data, error } = await supabaseAdmin
    .from('project_table')
    .select(`
      id,
      title,
      image,
      virtual_tours (
        id,
        tower_name,
        unit_name,
        status,
        view_areas
      )
    `)
    .is('deleted_at', null)
    .order('title', { ascending: true });

  if (error) {
    console.error("Fetch Virtual Tours Project List Error:", error);
    throw new Error(error.message);
  }

  const parseAreas = (rawAreas: any): any[] => {
    if (!rawAreas) return [];
    if (Array.isArray(rawAreas)) return rawAreas;

    if (typeof rawAreas === 'string') {
      try {
        const parsed = JSON.parse(rawAreas);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    return [];
  };

  // Return one summary row per project. Do not expose a project id as though
  // it were a virtual_tours row id; destructive/unit-level actions belong in
  // the project Virtual Tour editor instead.
  return (data || []).map((project: any) => {
    const tours = Array.isArray(project.virtual_tours)
      ? project.virtual_tours
      : [];

    const uniqueTowers = Array.from(
      new Set(
        tours
          .map((tour: any) => tour.tower_name?.trim())
          .filter(Boolean)
      )
    );

    const visibleUnits = tours.filter(
      (tour: any) => tour.status === 'Active'
    ).length;

    const hiddenUnits = Math.max(0, tours.length - visibleUnits);

    const areasByTour = tours.map((tour: any) =>
      parseAreas(tour.view_areas)
    );

    const totalViewAreas = areasByTour.reduce(
      (total: number, areas: any[]) => total + areas.length,
      0
    );

    const firstPanorama = areasByTour
      .flat()
      .find((area: any) => area?.image)?.image;

    return {
      project_id: project.id,
      title: `${project.title} Virtual Tours`,
      project_name: project.title,
      preview_image:
        firstPanorama ||
        project.image ||
        null,
      total_towers: uniqueTowers.length,
      total_units: tours.length,
      total_view_areas: totalViewAreas,
      visible_units: visibleUnits,
      hidden_units: hiddenUnits,
    };
  });
}

export async function fetchProjectsForDropdown() {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");

  const { data, error } = await supabaseAdmin
    .from('project_table')
    .select(`
      id,
      title,
      project_towers (
        id,
        name,
        sort_order
      ),
      unit_layout (
        tower_name
      )
    `)
    .is('deleted_at', null)
    .order('title', { ascending: true });

  if (error) throw error;

  return (data || []).map((project: any) => ({
    ...project,
    project_towers: [...(project.project_towers || [])].sort((a: any, b: any) => {
      const aOrder = a.sort_order ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.sort_order ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true });
    }),
  }));
}

export async function fetchVirtualTourForEdit(editId: string | number) {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");
  const { data, error } = await supabaseAdmin
    .from('virtual_tours')
    .select('*')
    .eq('id', editId)
    .limit(1)
    .single();
  if (error) throw error; 
  return data;
}

export async function saveVirtualTourAction(payload: any, editId: number | null) {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");

  const cleanData: Record<string, any> = {
    title: payload.title || payload.unit_name || '',
    unit_name: payload.unit_name || payload.title || '',
    tower_name: payload.tower_name || 'Tower A',
    project_id: Number(payload.project_id),
    status: payload.status || 'Active',
    view_areas: payload.view_areas || payload.rooms || [],
  };

  if (editId) {
    const { error } = await supabaseAdmin
      .from('virtual_tours')
      .update(cleanData)
      .eq('id', editId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseAdmin
      .from('virtual_tours')
      .insert([cleanData]);
    if (error) throw new Error(error.message);
  }
  return { success: true };
}

export async function fetchProjectVirtualTours(projectId: number | string) {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");

  const { data, error } = await supabaseAdmin
    .from('virtual_tours')
    .select('*')
    .eq('project_id', Number(projectId))
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function saveProjectVirtualToursAction(
  projectId: number,
  tours: any[],
  deletedTourIds: number[]
) {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");

  // 1. Delete removed records
  if (deletedTourIds.length > 0) {
    const { error: delError } = await supabaseAdmin
      .from('virtual_tours')
      .delete()
      .in('id', deletedTourIds);
    if (delError) throw new Error(delError.message);
  }

  // 2. Insert or update units
  for (const tour of tours) {
    const cleanData = {
      project_id: projectId,
      tower_name: tour.tower_name?.trim() || 'Tower A',
      unit_name: tour.unit_name?.trim() || 'Standard Unit',
      title: tour.title?.trim() || tour.unit_name?.trim() || 'Standard Unit',
      status: tour.status || 'Active',
      view_areas: tour.view_areas || [],
    };

    if (tour.id && typeof tour.id === 'number') {
      const { error: updError } = await supabaseAdmin
        .from('virtual_tours')
        .update(cleanData)
        .eq('id', tour.id);
      if (updError) throw new Error(updError.message);
    } else {
      const { error: insError } = await supabaseAdmin
        .from('virtual_tours')
        .insert([cleanData]);
      if (insError) throw new Error(insError.message);
    }
  }

  const { data: savedTours, error: refreshError } = await supabaseAdmin
    .from('virtual_tours')
    .select('*')
    .eq('project_id', projectId)
    .order('id', { ascending: true });

  if (refreshError) throw new Error(refreshError.message);

  return { success: true, tours: savedTours || [] };
}

export async function deleteRecordAction(_table: string, _id: number | string) {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");
  throw new Error('Permanent deletion is disabled. Archive the record instead.');
}

// ==========================================
// DASHBOARD BYPASS FETCHERS
// ==========================================
export async function fetchAdminPromotionsList() {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");
  const { data, error } = await supabaseAdmin.from('promotions').select('*').is('is_archived', null).order('id', { ascending: false });
  if (error) throw error; return data;
}

export async function fetchAdminBanksList() {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");
  const { data, error } = await supabaseAdmin.from('banks').select('*').is('is_archived', null).order('id', { ascending: true });
  if (error) throw error; return data;
}

export async function fetchAdminStoryList() {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");
  const { data, error } = await supabaseAdmin.from('our story').select('*').is('is_archived', null).order('year', { ascending: true });
  if (error) throw error; return data;
}

const archivedCmsModules = {
  promotions: 'promotion_code',
  banks: 'edit_banks',
  news_updates: 'edit_news',
  'our story': 'our_story',
} as const;

type ArchivedCmsTable = keyof typeof archivedCmsModules;

async function requireArchivePermission(table: ArchivedCmsTable, permission: 'can_view' | 'can_edit') {
  const session = await getCustomSession();
  if (!session) throw new Error('Unauthorized');

  const profile = await getRBACProfile();
  if (profile?.permissions === 'SUPER_ADMIN') return;

  const permissions = profile?.permissions as Record<string, Record<string, boolean>> | undefined;
  if (!permissions?.[archivedCmsModules[table]]?.[permission]) {
    throw new Error('You do not have permission to access this archive.');
  }
}

export async function fetchArchivedCmsRecordsAction(table: ArchivedCmsTable) {
  if (!Object.prototype.hasOwnProperty.call(archivedCmsModules, table)) {
    throw new Error('Invalid archive section.');
  }
  await requireArchivePermission(table, 'can_view');

  const { data, error } = await supabaseAdmin
    .from(table)
    .select('*')
    .not('is_archived', 'is', null)
    .order('id', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function restoreArchivedCmsRecordAction(table: ArchivedCmsTable, id: number | string) {
  if (!Object.prototype.hasOwnProperty.call(archivedCmsModules, table)) {
    throw new Error('Invalid archive section.');
  }
  await requireArchivePermission(table, 'can_edit');

  // Restore into the CMS without publishing to the public website.
  const { data, error } = await supabaseAdmin
    .from(table)
    .update({ is_archived: null, is_active: false })
    .eq('id', id)
    .not('is_archived', 'is', null)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('This record is no longer archived. Refresh the archive and try again.');
  return { success: true };
}

export async function toggleVirtualTourStatus(id: number | string, newStatus: string) {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");
  
  const { error } = await supabaseAdmin.from('virtual_tours').update({ status: newStatus }).eq('id', id);
  if (error) throw error;
  
  return { success: true };
}

export async function fetchPromotionForEdit(editId: string | number) {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");
  
  const { data, error } = await supabaseAdmin.from('promotions').select('*').eq('id', editId).limit(1).single();
  if (error) throw error; 
  return data;
}

export async function savePromotionAction(payload: any, editId: string | null) {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");

  if (editId) {
    const { error } = await supabaseAdmin
      .from('promotions')
      .update(payload)
      .eq('id', editId);

    if (error) throw error;

    return {
      success: true,
      id: Number(editId),
    };
  }

  const { data, error } = await supabaseAdmin
    .from('promotions')
    .insert([{ ...payload, is_active: true }])
    .select('id')
    .limit(1);

  if (error) throw error;

  return {
    success: true,
    id: data?.[0]?.id ? Number(data[0].id) : null,
  };
}

export async function fetchBankForEdit(editId: string | number) {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");
  
  const { data, error } = await supabaseAdmin.from('banks').select('*').eq('id', editId).limit(1);
  if (error) throw error; 
  return data?.[0] || null;
}

export async function fetchBankProjectLinksAction(bankId: string | number) {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");

  const normalizedBankId = Number(bankId);
  if (!Number.isFinite(normalizedBankId)) {
    throw new Error('Invalid bank ID.');
  }

  const { data, error } = await supabaseAdmin
    .from('project_banks')
    .select('project_id')
    .eq('banks_id', normalizedBankId);

  if (error) throw error;

  return (data || [])
    .map((row: any) => row.project_id)
    .filter((projectId: any) => projectId !== null && projectId !== undefined);
}

export async function saveBankAction(payload: any, editId: string | null) {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");

  if (editId) {
    const { error } = await supabaseAdmin.from('banks').update(payload).eq('id', editId);
    if (error) throw error;
    return { success: true, id: editId };
  } else {
    // Force is_active to true on creation, use limit(1) to avoid JSON coerce errors
    const { data, error } = await supabaseAdmin.from('banks').insert([{ ...payload, is_active: true }]).select('id').limit(1);
    if (error) throw error;
    return { success: true, id: data?.[0]?.id };
  }
}

export async function fetchStoryForEdit(editId: string | number) {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");
  
  const { data, error } = await supabaseAdmin.from('our story').select('*').eq('id', editId).limit(1);
  if (error) throw error; 
  return data?.[0] || null;
}

export async function saveStoryAction(payload: any, editId: string | null) {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");

  if (editId) {
    const { error } = await supabaseAdmin.from('our story').update(payload).eq('id', editId);
    if (error) throw error;
  } else {
    // Force is_active to true on creation
    const { error } = await supabaseAdmin.from('our story').insert([{ ...payload, is_active: true }]);
    if (error) throw error;
  }
  return { success: true };
}

type AuditContext = {
  entityId?: number | string;
  fieldKey?: string;
  oldValue?: unknown;
  newValue?: unknown;
  parentEntityId?: number | string;
};

const auditRoutes: Record<string, { editor: string; archive: string }> = {
  Projects: { editor: '/admin/projects', archive: 'Archived Projects' },
  Promotions: { editor: '/admin/promotions', archive: 'Archived Promotions' },
  'Partner Banks': { editor: '/admin/partnerbanks', archive: 'Archived Partner Banks' },
  'News & Updates': { editor: '/admin/news', archive: 'Archived News & Updates' },
  'Our Story': { editor: '/admin/story', archive: 'Archived Our Story' },
};

export async function createAuditLogAction(action_type: string, entity_type: string, entity_name: string, details: string, context?: AuditContext) {
  const session = await getCustomSession();
  if (!session) throw new Error('Unauthorized');
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  // Older dashboard callers still pass DELETE for Archive. Preserve their API,
  // but never show an irreversible label for a reversible operation.
  const action = action_type === 'DELETE' && /^archiv/i.test(details.trim()) ? 'ARCHIVED'
    : /^restor/i.test(details.trim()) ? 'RESTORED'
    : /^reorder/i.test(details.trim()) ? 'REORDERED'
    : /^changed .*visibility/i.test(details.trim()) ? 'VISIBILITY'
    : action_type;
  const route = auditRoutes[entity_type];
  const entityId = context?.entityId != null ? String(context.entityId) : null;
  const focus = context?.fieldKey;
  const targetUrl = entity_type === 'Navigation Setup'
    ? '/admin/dashboard?section=Navbar%20Setup'
    : route && entityId
      ? action === 'ARCHIVED'
        ? `/admin/dashboard?section=${encodeURIComponent(route.archive)}`
        : `${route.editor}?edit=${encodeURIComponent(entityId)}${focus ? `&focus=${encodeURIComponent(focus)}` : ''}`
      : null;

  const { error } = await supabaseAdmin.from('audit_logs').insert({
    user_email: user.username, actor_id: String(user.id),
    action_type: action, entity_type, entity_name, details,
    entity_id: entityId, parent_entity_id: context?.parentEntityId != null ? String(context.parentEntityId) : null,
    field_key: focus || null, old_value: context?.oldValue ?? null,
    new_value: context?.newValue ?? null, target_url: targetUrl,
  });
  if (error) {
    console.error('Audit Log Error:', error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function fetchDetailedAuditLogsAction(sortOrder: 'asc' | 'desc' = 'desc', offset: number = 0) {
  const session = await getCustomSession();
  if (!session) throw new Error('Unauthorized');
  const profile = await getRBACProfile();
  const allowed = profile?.permissions === 'SUPER_ADMIN' ||
    (typeof profile?.permissions === 'object' && profile.permissions?.audit_log?.can_view === true);
  if (!allowed) throw new Error('You do not have permission to view audit history.');
  const safeOffset = Number.isInteger(offset) && offset >= 0 ? Math.min(offset, 100000) : 0;
  // Fetch one extra row to tell the client whether a next page exists.
  const { data, error } = await supabaseAdmin.from('audit_logs').select('*')
    .order('created_at', { ascending: sortOrder === 'asc' })
    .order('id', { ascending: sortOrder === 'asc' })
    .range(safeOffset, safeOffset + 50);
  if (error) throw error;
  return data || [];
}

export async function deleteAuditLogAction(id: number) {
  const session = await getCustomSession();
  const user = await getCurrentUser();
  if (!session || !user?.is_super_admin) throw new Error('Only a super admin can remove audit entries.');
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid audit entry ID.');
  const { error } = await supabaseAdmin.rpc('remove_audit_log_entry', {
    p_id: id,
    p_actor_id: String(user.id),
    p_actor_name: user.username,
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function fetchRecentAuditLogsAction(limit: number = 5) {
  const session = await getCustomSession();

  if (!session) {
    throw new Error("Unauthorized");
  }
  const profile = await getRBACProfile();
  if (!(profile?.permissions === 'SUPER_ADMIN' ||
    (typeof profile?.permissions === 'object' && profile.permissions?.audit_log?.can_view === true))) {
    throw new Error('You do not have permission to view audit history.');
  }

  // Keep the dashboard compact even if a bigger number is accidentally passed.
  const safeLimit = Math.min(Math.max(limit, 1), 10);

  const { data, error } = await supabaseAdmin
    .from('audit_logs')
    .select(`
      id,
      created_at,
      user_email,
      action_type,
      entity_type,
      entity_name,
      details
    `)
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function fetchWebsiteSectionStatesAction() {
  const session = await getCustomSession();

  if (!session) {
    throw new Error('Unauthorized');
  }

  const { data, error } = await supabaseAdmin
    .from('modules')
    .select('id, module_name, module_code, is_active')
    .order('id');

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function saveWebsiteSectionStatesAction(
  changes: Array<{
    id: number;
    is_active: boolean;
    module_name: string;
    display_name: string;
  }>
) {
  const session = await getCustomSession();

  if (!session) {
    throw new Error('Unauthorized');
  }

  if (!Array.isArray(changes) || changes.length === 0) {
    return { success: true };
  }

  for (const change of changes) {
    const { error } = await supabaseAdmin
      .from('modules')
      .update({
        is_active: change.is_active,
      })
      .eq('id', change.id);

    if (error) {
      throw error;
    }

    await createAuditLogAction(
      'EDIT',
      change.display_name,
      'Website visibility',
      change.is_active
        ? 'Shown on website.'
        : 'Hidden from website.'
    );
  }

  return { success: true };
}

export async function submitInquiryAction(data: any) {
  try {
    let currentClientId = null;

    // 1. Check if the client already exists by email
    const { data: existingClient, error: fetchErr } = await supabaseAdmin
      .from('client')
      .select('id')
      .eq('email', data.email)
      .maybeSingle(); 

    if (fetchErr) throw fetchErr;

    if (existingClient) {
      currentClientId = existingClient.id;
      // Update phone number
      await supabaseAdmin.from('client').update({ phone_number: data.phone }).eq('id', currentClientId);
    } else {
      // Insert new client
      const { data: newClient, error: insertErr } = await supabaseAdmin
        .from('client')
        .insert({
          first_name: data.firstName,
          last_name: data.lastName,
          email: data.email,
          phone_number: data.phone
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;
      currentClientId = newClient.id;
    }

    // 2. Insert into 'inquire' table
    const { error: inquireErr } = await supabaseAdmin
      .from('inquire')
      .insert({
        client_id: currentClientId,
        project_id: parseInt(data.project)
      });

    if (inquireErr) throw inquireErr;

    return { success: true };
  } catch (error: any) {
    console.error("Submission error:", error);
    return { success: false, error: error.message };
  }
}

async function requireNotificationAccess() {
  const adminId = await getCustomSession();
  if (!adminId) throw new Error('Unauthorized');
  const profile = await getRBACProfile();
  const allowed = profile?.permissions === 'SUPER_ADMIN' ||
    (typeof profile?.permissions === 'object' && profile.permissions?.notifications_code?.can_view === true);
  if (!allowed) throw new Error('You do not have permission to view customer messages.');
  // Read state always belongs to the authenticated admin, never a browser-supplied ID.
  return adminId;
}

async function fetchInboxSource<T extends { id: number | string }>(
  table: 'inquire' | 'contact' | 'loan_preapp', selection: string,
  adminId: string, readRelation?: 'admin_inquire_reads' | 'admin_contact_reads' | 'admin_loan_preapp_reads',
): Promise<T[]> {
  const pageSize = 500;
  const rows = new Map<string, T>();
  let offset = 0;
  let total: number | null = null;
  // Page each joined source instead of silently truncating the full inbox to the
  // bell's old 50-row limit or PostgREST's default response limit. No per-row queries.
  while (true) {
    let query = supabaseAdmin.from(table)
      .select(selection, offset === 0 ? { count: 'exact' } : {})
      .order('created_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (readRelation) query = query.eq(`${readRelation}.admin_id`, adminId);
    const { data, error, count } = await query.returns<T[]>();
    if (error) throw new Error(`Could not load ${table} customer messages.`);
    if (offset === 0) total = count;
    const batch = data ?? [];
    for (const row of batch) rows.set(String(row.id), row);
    offset += batch.length;
    if (!batch.length || (total !== null ? offset >= total : batch.length < pageSize)) break;
  }
  return [...rows.values()];
}

export async function fetchNotificationsAction(): Promise<CustomerInboxItem[]> {
  const adminId = await requireNotificationAccess();
  // Foreign-key hints match the inspected loan_preapp metadata: client_id,
  // project_id and banks_id. Reads are left joins scoped to this admin.
  const [inquiries, support, loans] = await Promise.all([
    fetchInboxSource<InquiryInboxRow>('inquire',
      'id, created_at, client!client_id(first_name, last_name, email, phone_number), project_table!project_id(title), admin_inquire_reads(admin_id)',
      adminId, 'admin_inquire_reads'),
    fetchInboxSource<SupportInboxRow>('contact',
      'id, created_at, "type of inquiry", message, client!client_id(first_name, last_name, email, phone_number), admin_contact_reads(admin_id)',
      adminId, 'admin_contact_reads'),
    fetchInboxSource<LoanInboxRow>('loan_preapp',
      'id, created_at, tower, unit_no, floor_no, co_buyer_name, is_agreed, client!client_id(first_name, last_name, email, phone_number), project_table!project_id(title), banks!banks_id(bank_name), admin_loan_preapp_reads(admin_id)',
      adminId, 'admin_loan_preapp_reads'),
  ]);
  return normalizeCustomerInbox(inquiries, support, loans, adminId);
}

export async function toggleNotificationReadAction(
  notifId: number | string, type: CustomerInboxItemType, newStatus: boolean,
) {
  const adminId = await requireNotificationAccess();
  if ((typeof notifId !== 'number' && typeof notifId !== 'string') ||
      !Number.isSafeInteger(Number(notifId)) || Number(notifId) <= 0 ||
      typeof newStatus !== 'boolean') throw new Error('Invalid read-status request.');

  let table: 'admin_inquire_reads' | 'admin_contact_reads' | 'admin_loan_preapp_reads';
  let column: 'inquire_id' | 'contact_id' | 'loan_preapp_id';
  switch (type) {
    case 'inquiry': table = 'admin_inquire_reads'; column = 'inquire_id'; break;
    case 'customer_support': table = 'admin_contact_reads'; column = 'contact_id'; break;
    case 'loan_application': table = 'admin_loan_preapp_reads'; column = 'loan_preapp_id'; break;
    default: throw new Error('Unsupported customer message type.');
  }
  const values = { admin_id: adminId, [column]: Number(notifId) };
  const { error } = newStatus
    ? await supabaseAdmin.from(table).upsert(values, { onConflict: `admin_id,${column}`, ignoreDuplicates: true })
    : await supabaseAdmin.from(table).delete().match(values);
  if (error) throw new Error('Could not save notification read status.');
  return { success: true };
}

// ==========================================
// PUBLIC CONTACT US ACTION
// ==========================================
export async function submitContactAction(data: any) {
  try {
    let currentClientId = null;

    // 1. Check if the client already exists by email
    const { data: existingClient, error: fetchErr } = await supabaseAdmin
      .from('client')
      .select('id')
      .eq('email', data.email)
      .maybeSingle(); 

    if (fetchErr) throw fetchErr;

    if (existingClient) {
      currentClientId = existingClient.id;
      // Update phone number if provided
      if (data.phone) {
        await supabaseAdmin.from('client').update({ phone_number: data.phone }).eq('id', currentClientId);
      }
    } else {
      // Insert new client
      const { data: newClient, error: insertErr } = await supabaseAdmin
        .from('client')
        .insert({
          first_name: data.firstName,
          last_name: data.lastName,
          email: data.email,
          phone_number: data.phone || null
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;
      currentClientId = newClient.id;
    }

    // 2. Insert into 'contact' table
    const { error: contactError } = await supabaseAdmin
      .from('contact')
      .insert({
        client_id: currentClientId,
        "type of inquiry": data.typeOfInquiry,
        message: data.message || ''
      });

    if (contactError) throw contactError;

    return { success: true };
  } catch (error: any) {
    console.error("Contact submission error:", error);
    return { success: false, error: error.message };
  }
}
