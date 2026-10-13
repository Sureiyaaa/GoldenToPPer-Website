
'use server';

import { createClient } from '@supabase/supabase-js';
import { getCustomSession, getRBACProfile } from '@/app/actions/auth';
import { createAuditLogAction } from '@/app/actions/admin_fetchers';

// Approved Homepage table configurations
const HOMEPAGE_ALLOWED_TABLES: Record<string, { moduleCode: string; operations: string[] }> = {
  'homepage_settings': { moduleCode: 'homepage_manage', operations: ['edit'] },
  'homepage_hero_slides': { moduleCode: 'homepage_manage', operations: ['create', 'edit', 'delete'] },
  'homepage_development_areas': { moduleCode: 'homepage_manage', operations: ['create', 'edit', 'delete'] },
  'homepage_process_steps': { moduleCode: 'homepage_manage', operations: ['create', 'edit', 'delete'] },
  'homepage_awards': { moduleCode: 'homepage_manage', operations: ['create', 'edit', 'delete'] },
  'news_updates': { moduleCode: 'edit_news', operations: ['edit', 'delete'] }, // News table, news module permissions
};

// Allowed fields per table (prevents arbitrary column modification)
const HOMEPAGE_FIELD_ALLOWLISTS: Record<string, Set<string>> = {
  'homepage_settings': new Set(['about_tagline', 'about_heading', 'about_description_1', 'about_description_2', 'stat_projects_val', 'stat_projects_suffix', 'stat_projects_label', 'stat_team_val', 'stat_team_suffix', 'stat_team_label', 'stat_landbank_val', 'stat_landbank_suffix', 'stat_landbank_label', 'video_thumbnail']),
  'homepage_hero_slides': new Set(['project_id', 'heading_line_1', 'heading_line_2', 'location', 'image', 'sort_order', 'is_active']),
  'homepage_development_areas': new Set(['tab_number', 'tab_title', 'subtitle', 'heading', 'description', 'image', 'is_active', 'sort_order']),
  'homepage_process_steps': new Set(['step_number', 'title', 'description', 'image', 'is_active', 'sort_order']),
  'homepage_awards': new Set(['title', 'subtitle_1', 'subtitle_2', 'icon_image', 'is_active', 'sort_order']),
  'news_updates': new Set(['title', 'date', 'slug', 'excerpt', 'category']), // Fields editable through homepage (not via news.ts create)
};

async function authorizeHomepageOperation(table: string, operation: 'create' | 'edit' | 'delete') {
  const config = HOMEPAGE_ALLOWED_TABLES[table];
  if (!config) {
    throw new Error(`Unauthorized: Cannot modify table "${table}".`);
  }

  if (!config.operations.includes(operation)) {
    throw new Error(`Unauthorized: Cannot ${operation} records in table "${table}".`);
  }

  const profile = await getRBACProfile();
  if (!profile) {
    throw new Error("Unauthorized: Session expired.");
  }

  if (profile.permissions === 'SUPER_ADMIN') {
    return;
  }

  const modulePerms = typeof profile.permissions === 'object' ? profile.permissions[config.moduleCode] : null;
  const requiredPermission = operation === 'create' ? 'can_create' : operation === 'delete' ? 'can_delete' : 'can_edit';

  if (!modulePerms || modulePerms[requiredPermission] !== true) {
    throw new Error(`Unauthorized: You don't have permission to ${operation} records in this section.`);
  }
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function fetchLiveHomepageAdminDataAction() {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized: Session expired.");

  const supabase = getAdminClient();

  const [settingsRes, heroRes, devRes, processRes, awardsRes, projectsRes, newsRes] = await Promise.all([
    supabase.from('homepage_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('homepage_hero_slides').select('*, project_table(id, title, slug)').order('sort_order', { ascending: true }),
    supabase.from('homepage_development_areas').select('*').order('sort_order', { ascending: true }),
    supabase.from('homepage_process_steps').select('*').order('sort_order', { ascending: true }),
    supabase.from('homepage_awards').select('*').order('sort_order', { ascending: true }),
    supabase.from('project_table').select('id, title, slug').is('deleted_at', null).eq('is_active', true),
    supabase.from('news_updates').select('*').is('is_archived', null).order('date', { ascending: false }).limit(4),
  ]);

  return {
    settings: settingsRes.data || null,
    heroSlides: heroRes.data || [],
    developmentAreas: devRes.data || [],
    processSteps: processRes.data || [],
    awards: awardsRes.data || [],
    projects: projectsRes.data || [],
    newsArticles: newsRes.data || [],
  };
}

export async function saveHomepageSettingsAction(payload: Record<string, any>) {
  try {
    await authorizeHomepageOperation('homepage_settings', 'edit');

    const allowedFields = HOMEPAGE_FIELD_ALLOWLISTS['homepage_settings'];
    const filteredPayload: Record<string, any> = {};

    // Filter payload to only allowed fields
    for (const [key, value] of Object.entries(payload)) {
      if (allowedFields?.has(key)) {
        filteredPayload[key] = value;
      }
    }

    const supabase = getAdminClient();
    const { error } = await supabase
      .from('homepage_settings')
      .update({ ...filteredPayload, updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (error) throw new Error(error.message);

    await createAuditLogAction('EDIT', 'Homepage', 'General Settings', 'Updated homepage editorial copy, stats, and video.');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function upsertHomepageRowAction(table: string, payload: Record<string, any>) {
  try {
    const supabase = getAdminClient();
    const allowedFields = HOMEPAGE_FIELD_ALLOWLISTS[table];

    if (!allowedFields) {
      throw new Error(`Unauthorized: Cannot modify table "${table}".`);
    }

    // Filter payload to only allowed fields
    const filteredPayload: Record<string, any> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (allowedFields.has(key)) {
        filteredPayload[key] = value;
      }
    }

    // Determine create vs edit using server-side record verification
    let isCreate = true;
    let recordId: any = null;

    if (payload.id) {
      recordId = payload.id;
      // Query database to verify record exists (don't trust client-supplied ID)
      const { data: existingRecord } = await supabase
        .from(table)
        .select('id')
        .eq('id', recordId)
        .single();

      isCreate = !existingRecord;
    }

    const operation = isCreate ? 'create' : 'edit';
    await authorizeHomepageOperation(table, operation as 'create' | 'edit');

    let res;
    if (isCreate) {
      res = await supabase
        .from(table)
        .insert(filteredPayload)
        .select();
    } else {
      // For updates, exclude id from payload
      res = await supabase
        .from(table)
        .update(filteredPayload)
        .eq('id', recordId)
        .select();
    }

    if (res.error) throw new Error(res.error.message);

    await createAuditLogAction('EDIT', 'Homepage', table, `Saved record in ${table}.`);
    return { success: true, data: res.data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function toggleHomepageRowStatusAction(table: string, id: number, currentStatus: boolean) {
  try {
    await authorizeHomepageOperation(table, 'edit');

    const supabase = getAdminClient();
    const { error } = await supabase.from(table).update({ is_active: !currentStatus }).eq('id', id);

    if (error) throw new Error(error.message);

    await createAuditLogAction('EDIT', 'Homepage', table, `Toggled active status for row ${id}.`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteHomepageRowAction(table: string, id: number, title?: string) {
  try {
    await authorizeHomepageOperation(table, 'delete');

    const supabase = getAdminClient();
    const { error } = await supabase.from(table).delete().eq('id', id);

    if (error) throw new Error(error.message);

    await createAuditLogAction('DELETE', 'Homepage', table, `Deleted ${title || `ID ${id}`} from ${table}.`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}