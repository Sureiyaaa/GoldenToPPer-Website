'use server';

import { createClient } from '@supabase/supabase-js'; // Using standard Supabase JS
import { getCurrentUser } from '@/app/actions/auth';

export async function processBankServerActions(
  bankId: string, 
  projectIds: string[], 
  bankName: string, 
  maxLoan: string, 
  isEdit: boolean
) {
  // Initialize Supabase with the SERVICE ROLE KEY to bypass RLS safely on the server
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const user = await getCurrentUser();

  if (!user || !user.username) {
    return { success: false, error: "Unauthorized: User session not found." };
  }

  try {
    // 1. Handle Project-Bank Links
    if (isEdit) {
      await supabase.from('project_banks').delete().eq('banks_id', bankId);
    }

    if (projectIds && projectIds.length > 0) {
      const linksToInsert = projectIds.map(projId => ({
        banks_id: parseInt(bankId),
        project_id: parseInt(projId)
      }));

      const { error: linkErr } = await supabase.from('project_banks').insert(linksToInsert);
      if (linkErr) throw new Error(`Project Link Error: ${linkErr.message}`);
    }

    // 2. Handle Audit Logs
    const { error: auditErr } = await supabase.from('audit_logs').insert({
      user_email: user.username,
      action_type: isEdit ? 'EDIT' : 'CREATE',
      entity_type: 'Partner Banks',
      entity_name: bankName,
      details: isEdit 
        ? `Updated existing partner bank details.` 
        : `Added a new partner bank with max loan: ${maxLoan}%`
    });

    if (auditErr) throw new Error(`Audit Log Error: ${auditErr.message}`);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}