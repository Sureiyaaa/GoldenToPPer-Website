'use server';

import { createClient } from '@supabase/supabase-js';
import { getCurrentUser, getRBACProfile } from '@/app/actions/auth';

export async function processBankServerActions(
  bankId: string,
  projectIds: string[],
  bankName: string,
  maxLoan: string,
  isEdit: boolean
) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const user = await getCurrentUser();

  if (!user || !user.username) {
    return { success: false, error: "Unauthorized: User session not found." };
  }

  try {
    // Phase 2.4A: Enforce RBAC authorization for project relinking
    const profile = await getRBACProfile();
    if (!profile) {
      throw new Error("Unauthorized: Session expired.");
    }

    if (profile.permissions !== 'SUPER_ADMIN') {
      const modulePerms = typeof profile.permissions === 'object' ? profile.permissions['edit_banks'] : null;
      if (!modulePerms || modulePerms['can_edit'] !== true) {
        throw new Error("Unauthorized: You don't have permission to modify bank project links.");
      }
    }

    // Phase 2.4A: Verify the bank exists
    const { data: existingBank, error: bankLookupError } = await supabaseAdmin
      .from('banks')
      .select('id')
      .eq('id', bankId)
      .maybeSingle();

    if (bankLookupError) {
      throw bankLookupError;
    }

    if (!existingBank) {
      throw new Error('Bank not found.');
    }

    // Phase 2.4A: Validate all submitted project IDs exist before making any changes
    if (projectIds && projectIds.length > 0) {
      const { data: projects, error: projectFetchError } = await supabaseAdmin
        .from('project_table')
        .select('id')
        .in('id', projectIds.map(pid => parseInt(pid, 10)));

      if (projectFetchError) {
        throw projectFetchError;
      }

      const validProjectIds = new Set((projects || []).map(p => p.id));
      const invalidIds = projectIds
        .map(pid => parseInt(pid, 10))
        .filter(pid => !validProjectIds.has(pid));

      if (invalidIds.length > 0) {
        throw new Error(`Invalid project IDs: ${invalidIds.join(', ')}`);
      }
    }

    // Phase 2.4A: Replace project-bank links (delete old, insert new)
    const parsedBankId = parseInt(bankId, 10);

    // Delete existing links
    const { error: deleteErr } = await supabaseAdmin
      .from('project_banks')
      .delete()
      .eq('banks_id', parsedBankId);

    if (deleteErr) {
      throw new Error(`Failed to clear existing project links: ${deleteErr.message}`);
    }

    // Insert new links if any projects selected
    if (projectIds && projectIds.length > 0) {
      const linksToInsert = projectIds.map(projId => ({
        banks_id: parsedBankId,
        project_id: parseInt(projId, 10)
      }));

      const { error: linkErr } = await supabaseAdmin
        .from('project_banks')
        .insert(linksToInsert);

      if (linkErr) {
        throw new Error(`Project Link Error: ${linkErr.message}`);
      }
    }

    // Audit logging
    const { error: auditErr } = await supabaseAdmin
      .from('audit_logs')
      .insert({
        user_email: user.username,
        action_type: isEdit ? 'EDIT' : 'CREATE',
        entity_type: 'Partner Banks',
        entity_name: bankName,
        details: isEdit
          ? `Updated partner bank project links.`
          : `Created new partner bank with max loan: ${maxLoan}%`
      });

    if (auditErr) {
      console.warn('Audit log warning:', auditErr);
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}