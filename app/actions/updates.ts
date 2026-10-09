// app/actions/updates.ts
'use server'

import { createClient } from '@supabase/supabase-js'
import { getRBACProfile } from '@/app/actions/auth'

// Approved table configurations for generic mutations
const ALLOWED_TABLES: Record<string, { moduleCode: string; archiveColumn: string; allowArchive: boolean }> = {
  'promotions': { moduleCode: 'promotion_code', archiveColumn: 'is_archived', allowArchive: true },
  'banks': { moduleCode: 'edit_banks', archiveColumn: 'is_archived', allowArchive: true },
  'our story': { moduleCode: 'our_story', archiveColumn: 'is_archived', allowArchive: true },
  'navbar_projects': { moduleCode: 'edit_project', archiveColumn: 'is_archived', allowArchive: false },
  'news_updates': { moduleCode: 'edit_news', archiveColumn: 'is_archived', allowArchive: true },
};

async function authorizeTableMutation(table: string, action: 'can_edit' | 'can_delete') {
  const config = ALLOWED_TABLES[table];
  if (!config) {
    throw new Error(`Unauthorized: Cannot modify table "${table}".`);
  }

  const profile = await getRBACProfile();
  if (!profile) {
    throw new Error("Unauthorized: Session expired.");
  }

  if (profile.permissions === 'SUPER_ADMIN') {
    return;
  }

  const modulePerms = typeof profile.permissions === 'object' ? profile.permissions[config.moduleCode] : null;
  if (!modulePerms || modulePerms[action] !== true) {
    throw new Error("Unauthorized: You don't have permission to perform this action.");
  }
}

// 1. Toggles the Eye Icon (is_active)
export async function toggleActiveStatus(table: string, id: string | number, currentStatus: boolean) {
  await authorizeTableMutation(table, 'can_edit');

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabaseAdmin
    .from(table)
    .update({ is_active: !currentStatus })
    .eq('id', id);

  if (error) throw error;
  return true;
}

// 2. Handles Soft Deleting / Archiving
export async function archiveRecord(table: string, id: string | number, archiveColumn: string = 'is_archived') {
  const config = ALLOWED_TABLES[table];
  if (!config) {
    throw new Error(`Unauthorized: Cannot archive records from table "${table}".`);
  }

  if (!config.allowArchive) {
    throw new Error(`Unauthorized: Cannot archive records from table "${table}".`);
  }

  if (archiveColumn !== config.archiveColumn) {
    throw new Error(`Unauthorized: Invalid archive column for table "${table}".`);
  }

  await authorizeTableMutation(table, 'can_delete');

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabaseAdmin
    .from(table)
    .update({ [archiveColumn]: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
  return true;
}