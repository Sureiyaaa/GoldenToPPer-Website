
'use server';

import { createClient } from '@supabase/supabase-js';
import { getCustomSession } from '@/app/actions/auth';
import { createAuditLogAction } from '@/app/actions/admin_fetchers';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function fetchLiveHomepageAdminDataAction() {
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
  const session = await getCustomSession();
  if (!session) return { success: false, error: 'Unauthorized: Session expired.' };

  const supabase = getAdminClient();
  const { error } = await supabase
    .from('homepage_settings')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', 1);

  if (error) return { success: false, error: error.message };

  await createAuditLogAction('EDIT', 'Homepage', 'General Settings', 'Updated homepage editorial copy, stats, and video.');
  return { success: true };
}

export async function upsertHomepageRowAction(table: string, payload: Record<string, any>) {
  const session = await getCustomSession();
  if (!session) return { success: false, error: 'Unauthorized: Session expired.' };

  const supabase = getAdminClient();

  let res;
  if (payload.id) {
    
    const { id, ...updateFields } = payload;
    res = await supabase
      .from(table)
      .update(updateFields)
      .eq('id', id)
      .select();
  } else {
    
    res = await supabase
      .from(table)
      .insert(payload)
      .select();
  }

  if (res.error) return { success: false, error: res.error.message };

  await createAuditLogAction('EDIT', 'Homepage', table, `Saved record in ${table}.`);
  return { success: true, data: res.data };
}

export async function toggleHomepageRowStatusAction(table: string, id: number, currentStatus: boolean) {
  const session = await getCustomSession();
  if (!session) return { success: false, error: 'Unauthorized: Session expired.' };

  const supabase = getAdminClient();
  const { error } = await supabase.from(table).update({ is_active: !currentStatus }).eq('id', id);

  if (error) return { success: false, error: error.message };

  await createAuditLogAction('EDIT', 'Homepage', table, `Toggled active status for row ${id}.`);
  return { success: true };
}

export async function deleteHomepageRowAction(table: string, id: number, title?: string) {
  const session = await getCustomSession();
  if (!session) return { success: false, error: 'Unauthorized: Session expired.' };

  const supabase = getAdminClient();
  const { error } = await supabase.from(table).delete().eq('id', id);

  if (error) return { success: false, error: error.message };

  await createAuditLogAction('DELETE', 'Homepage', table, `Deleted ${title || `ID ${id}`} from ${table}.`);
  return { success: true };
}