// app/actions/user.ts
'use server';

import { createClient } from '@supabase/supabase-js';

// Look Ma, no bcrypt!

export async function createUserAction(formData: any) {
  try {
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // Call the database function to handle the creation and hashing
    const { error } = await supabaseAdmin.rpc('create_admin_user', {
      new_username: formData.username,
      plain_password: formData.password,
      is_super: formData.is_super_admin,
      new_group_id: formData.is_super_admin ? null : parseInt(formData.group_id)
    });

    if (error) throw new Error(error.message);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateUserAction(formData: any) {
  try {
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // Call the database function to handle the update and optional password hashing
    const { error } = await supabaseAdmin.rpc('update_admin_user', {
      target_user_id: formData.id,
      new_is_super: formData.is_super_admin,
      new_group_id: formData.is_super_admin ? null : parseInt(formData.group_id),
      new_plain_password: formData.password && formData.password.trim() !== '' ? formData.password : null
    });

    if (error) throw new Error(error.message);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function toggleUserStatusAction(userId: string, newStatus: boolean) {
  try {
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { error } = await supabaseAdmin.from('admin_users').update({ is_active: newStatus }).eq('id', userId);
    if (error) throw new Error(error.message);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function toggleGroupStatusAction(groupId: string | number, newStatus: boolean) {
  try {
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { error } = await supabaseAdmin.from('groups').update({ is_active: newStatus }).eq('id', groupId);
    if (error) throw new Error(error.message);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createGroupAction(groupName: string, description: string, accessData: any[]) {
  try {
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const { data: newGroup, error: groupError } = await supabaseAdmin.from('groups').insert([{ group_name: groupName, description }]).select().single();
    if (groupError) throw new Error(groupError.message);

    if (newGroup && accessData.length > 0) {
      const finalAccessData = accessData.map(a => ({ ...a, group_id: newGroup.id }));
      const { error: accessError } = await supabaseAdmin.from('module_access').insert(finalAccessData);
      if (accessError) throw new Error(`Group created, but permissions failed: ${accessError.message}`);
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}