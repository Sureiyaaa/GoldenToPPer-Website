'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false }
  }
);

// NEW: Securely bypass Storage RLS to upload the image
export async function uploadImage(formData: FormData) {
  const file = formData.get('file') as File;
  const fileName = formData.get('fileName') as string;

  if (!file) throw new Error("No file provided");

  const { error } = await supabaseAdmin.storage
    .from('news_images')
    .upload(fileName, file);

  if (error) throw new Error(`Storage Error: ${error.message}`);

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('news_images')
    .getPublicUrl(fileName);

  return publicUrl;
}

export async function saveArticleToDB(payload: any, editId: string | null) {
  if (editId) {
    const { error } = await supabaseAdmin.from('news_updates').update(payload).eq('id', editId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseAdmin.from('news_updates').insert([payload]);
    if (error) throw new Error(error.message);
  }
  return { success: true };
}

export async function deleteArticleFromDB(id: string) {
  const { error } = await supabaseAdmin.from('news_updates').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { success: true };
}