'use server';

import { createClient } from '@supabase/supabase-js';
import { requireSuperAdmin } from './auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function savePermissionsAction(upsertData: any[]) {
  try {
    await requireSuperAdmin();

    const { error } = await supabaseAdmin
      .from('module_access')
      .upsert(upsertData, { onConflict: 'group_id,module_id' });

    if (error) throw new Error(error.message);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}