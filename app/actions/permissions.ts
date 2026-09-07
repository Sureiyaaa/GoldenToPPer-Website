'use server';

import { createClient } from '@supabase/supabase-js';
import { getCustomSession } from './auth';

// Initialize with Service Role Key (Safely bypasses RLS from the server)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function savePermissionsAction(upsertData: any[]) {
  try {
    // 1. Check if they have a valid custom session
    const userId = await getCustomSession();
    if (!userId) {
      throw new Error("Unauthorized: Please log in.");
    }

    // 2. Perform the DB update using the Admin client
    const { error } = await supabaseAdmin
      .from('module_access')
      .upsert(upsertData, { onConflict: 'group_id,module_id' });

    if (error) throw new Error(error.message);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}