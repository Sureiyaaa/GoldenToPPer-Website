'use server';

import { createClient } from '@supabase/supabase-js';
import { loanSchema, type LoanFormData } from '@/lib/validations/loan';

type LoanSubmissionResult = { success: true } | { success: false; error: string };

export async function submitLoanPreApplicationAction(
  input: LoanFormData,
): Promise<LoanSubmissionResult> {
  const parsed = loanSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Please check your application details and try again.' };
  }

  try {
    const data = parsed.data;
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Validate selectable records before creating/updating customer data.
    const [project, bank] = await Promise.all([
      supabaseAdmin.from('project_table').select('id')
        .eq('id', Number(data.condo)).eq('is_active', true).is('deleted_at', null).maybeSingle(),
      supabaseAdmin.from('banks').select('id')
        .eq('id', Number(data.bank)).eq('is_active', true).is('is_archived', null).maybeSingle(),
    ]);
    if (project.error) throw project.error;
    if (bank.error) throw bank.error;
    if (!project.data || !bank.data) {
      return { success: false, error: 'Please select an available project and bank.' };
    }

    const [firstName, ...lastNameParts] = data.buyerName.split(' ');
    const lastName = lastNameParts.join(' ') || 'N/A';
    // Legacy inquiry/contact emails may contain uppercase letters. Escape LIKE
    // wildcards so a literal email cannot match a different customer.
    const emailPattern = data.email.replace(/[\\%_]/g, '\\$&');
    const findClient = async () => {
      const { data: client, error } = await supabaseAdmin.from('client')
        .select('id, first_name, last_name')
        .ilike('email', emailPattern).order('id', { ascending: true }).limit(1).maybeSingle();
      if (error) throw error;
      return client;
    };

    let client = await findClient();
    let createdClient = false;
    if (!client) {
      const { data: newClient, error } = await supabaseAdmin.from('client')
        .insert({
          first_name: firstName,
          last_name: lastName,
          email: data.email,
          phone_number: data.phone,
        })
        .select('id, first_name, last_name').single();
      // Reuse the winner if an existing email uniqueness constraint catches a race.
      if (error?.code === '23505') client = await findClient();
      else if (error) throw error;
      else {
        client = newClient;
        createdClient = true;
      }
      if (!client) throw new Error('Could not resolve the application client.');
    }

    if (!createdClient) {
      const contactDetails: { phone_number: string; first_name?: string; last_name?: string } = {
        phone_number: data.phone,
      };
      if (!client.first_name?.trim()) contactDetails.first_name = firstName;
      if ((!client.last_name?.trim() || client.last_name.trim().toUpperCase() === 'N/A') &&
          lastNameParts.length > 0) contactDetails.last_name = lastName;
      const { error } = await supabaseAdmin.from('client')
        .update(contactDetails).eq('id', client.id);
      if (error) throw error;
    }

    const { error } = await supabaseAdmin.from('loan_preapp').insert({
      client_id: client.id,
      project_id: Number(data.condo),
      banks_id: Number(data.bank),
      tower: data.tower,
      unit_no: Number(data.unit),
      floor_no: Number(data.floor),
      co_buyer_name: data.coBuyerName,
      is_agreed: data.isAgreed,
    });
    if (error) throw error;

    return { success: true };
  } catch (error: unknown) {
    console.error('Loan pre-application submission error:', error);
    return { success: false, error: "We couldn't submit your application. Please try again." };
  }
}
