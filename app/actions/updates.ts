// app/actions/updates.ts
'use server'

import { createClient } from '@supabase/supabase-js'
import { getCustomSession } from '@/app/actions/auth'

// 1. Toggles the Eye Icon (is_active)
export async function toggleActiveStatus(table: string, id: string | number, currentStatus: boolean) {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");

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
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");

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