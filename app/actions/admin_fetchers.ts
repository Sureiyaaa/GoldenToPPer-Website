// app/actions/admin_fetchers.ts
'use server';

import { createClient } from '@supabase/supabase-js';
import { getCustomSession, getCurrentUser } from './auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

// ==========================================
// VIRTUAL TOURS ACTIONS
// ==========================================
export async function fetchAdminVirtualToursList() {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");
  const { data, error } = await supabaseAdmin.from('virtual_tours').select('*, project_table(title)').order('id', { ascending: false });
  if (error) throw error; return data;
}

export async function fetchVirtualTourForEdit(editId: string | number) {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");
  const { data, error } = await supabaseAdmin.from('virtual_tours').select('*').eq('id', editId).limit(1).single();
  if (error) throw error; return data;
}

export async function fetchProjectsForDropdown() {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");
  const { data, error } = await supabaseAdmin.from('project_table').select('id, title').is('deleted_at', null);
  if (error) throw error; return data;
}

export async function saveVirtualTourAction(payload: any, editId: number | null) {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");

  // Sanitize and align specifically to the table columns
  const cleanData: Record<string, any> = {
    title: payload.title || payload.unit_name || '',
    unit_name: payload.unit_name || payload.title || '',
    project_id: Number(payload.project_id),
    status: payload.status || 'Active',
    view_areas: payload.view_areas || payload.rooms || [],
  };

  if (editId) {
    const { error } = await supabaseAdmin
      .from('virtual_tours')
      .update(cleanData)
      .eq('id', editId);
    if (error) {
      console.error("Update Virtual Tour Error:", error);
      throw new Error(error.message);
    }
  } else {
    const { error } = await supabaseAdmin
      .from('virtual_tours')
      .insert([cleanData]);
    if (error) {
      console.error("Insert Virtual Tour Error:", error);
      throw new Error(error.message);
    }
  }
  return { success: true };
}

export async function deleteRecordAction(table: string, id: number | string) {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");
  const { error } = await supabaseAdmin.from(table).delete().eq('id', id);
  if (error) throw error;
  return { success: true };
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
    const { error } = await supabaseAdmin.from('promotions').update(payload).eq('id', editId);
    if (error) throw error;
  } else {
    // Force is_active to true on creation
    const { error } = await supabaseAdmin.from('promotions').insert([{ ...payload, is_active: true }]);
    if (error) throw error;
  }
  return { success: true };
}

export async function fetchBankForEdit(editId: string | number) {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");
  
  const { data, error } = await supabaseAdmin.from('banks').select('*').eq('id', editId).limit(1);
  if (error) throw error; 
  return data?.[0] || null;
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

export async function createAuditLogAction(action_type: string, entity_type: string, entity_name: string, details: string) {
  const session = await getCustomSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const user = await getCurrentUser();
  const user_email = user?.username || 'Unknown Admin';

  const { error } = await supabaseAdmin.from('audit_logs').insert({
    user_email,
    action_type,
    entity_type,
    entity_name,
    details
  });

  if (error) {
    console.error("Audit Log Error:", error.message);
    return { success: false, error: error.message };
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

export async function fetchNotificationsAction(userId: number | string) {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");

  const { data: inqData } = await supabaseAdmin
    .from('inquire')
    .select('id, created_at, client(first_name, last_name, email, phone_number), project_table(title), admin_inquire_reads(admin_id)')
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: contactData } = await supabaseAdmin
    .from('contact')
    .select('id, created_at, "type of inquiry", message, client(first_name, last_name, email, phone_number), admin_contact_reads(admin_id)')
    .order('created_at', { ascending: false })
    .limit(50);

  const combined = [
    ...(inqData || []).map((item: any) => {
      const clientObj = Array.isArray(item.client) ? item.client[0] : item.client;
      const projectObj = Array.isArray(item.project_table) ? item.project_table[0] : item.project_table;
      const hasRead = item.admin_inquire_reads?.some((read: any) => String(read.admin_id) === String(userId)) || false;

      return {
        ...item,
        type: 'inquiry',
        is_read: hasRead,
        title: `Inquiry: ${projectObj?.title || 'Unknown Property'}`,
        name: `${clientObj?.first_name || ''} ${clientObj?.last_name || ''}`.trim(),
        client_email: clientObj?.email,
        client_phone: clientObj?.phone_number
      };
    }),
    ...(contactData || []).map((item: any) => {
      const clientObj = Array.isArray(item.client) ? item.client[0] : item.client;
      const hasRead = item.admin_contact_reads?.some((read: any) => String(read.admin_id) === String(userId)) || false;

      return {
        ...item,
        type: 'contact',
        is_read: hasRead,
        title: item["type of inquiry"],
        name: `${clientObj?.first_name || ''} ${clientObj?.last_name || ''}`.trim(),
        client_email: clientObj?.email,
        client_phone: clientObj?.phone_number
      };
    })
  ];

  combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return combined;
}

export async function toggleNotificationReadAction(userId: number | string, notifId: number | string, type: string, newStatus: boolean) {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");

  if (type === 'inquiry') {
    if (newStatus) {
      await supabaseAdmin.from('admin_inquire_reads').insert({ admin_id: userId, inquire_id: notifId });
    } else {
      await supabaseAdmin.from('admin_inquire_reads').delete().match({ admin_id: userId, inquire_id: notifId });
    }
  } else {
    if (newStatus) {
      await supabaseAdmin.from('admin_contact_reads').insert({ admin_id: userId, contact_id: notifId });
    } else {
      await supabaseAdmin.from('admin_contact_reads').delete().match({ admin_id: userId, contact_id: notifId });
    }
  }
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