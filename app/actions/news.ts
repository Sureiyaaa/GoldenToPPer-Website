'use server';

import { createClient } from '@supabase/supabase-js';
import { getCustomSession, getRBACProfile } from './auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false }
  }
);

// Allowed fields per operation (prevents arbitrary column modification)
const NEWS_FIELD_ALLOWLISTS: Record<string, Record<'create' | 'edit', Set<string>>> = {
  'news_updates': {
    'create': new Set(['title', 'category', 'date', 'slug', 'excerpt', 'image']),
    'edit': new Set(['title', 'category', 'date', 'slug', 'excerpt', 'image']),
  }
};

// Storage validation
const STORAGE_CONFIG = {
  bucket: 'news_images',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
};

async function authorizeNewsOperation(operation: 'create' | 'edit' | 'delete') {
  const profile = await getRBACProfile();
  if (!profile) {
    throw new Error("Unauthorized: Session expired.");
  }

  if (profile.permissions === 'SUPER_ADMIN') {
    return;
  }

  const modulePerms = typeof profile.permissions === 'object' ? profile.permissions['edit_news'] : null;
  const requiredPermission = `can_${operation}`;

  if (!modulePerms || modulePerms[requiredPermission] !== true) {
    throw new Error(`Unauthorized: You don't have permission to ${operation} articles.`);
  }
}

// Upload image with authorization and validation
export async function uploadImage(formData: FormData) {
  try {
    const session = await getCustomSession();
    if (!session) throw new Error("Unauthorized: Session expired.");

    // Both create and edit operations can upload images; check either permission
    const profile = await getRBACProfile();
    if (!profile) {
      throw new Error("Unauthorized: Session expired.");
    }

    let hasPermission = false;
    if (profile.permissions === 'SUPER_ADMIN') {
      hasPermission = true;
    } else {
      const modulePerms = typeof profile.permissions === 'object' ? profile.permissions['edit_news'] : null;
      // Allow upload if user can create or edit (covers both article creation and editing workflows)
      hasPermission = modulePerms && (modulePerms.can_create === true || modulePerms.can_edit === true);
    }

    if (!hasPermission) {
      throw new Error("Unauthorized: You don't have permission to upload images.");
    }

    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string;

    if (!file) throw new Error("No file provided");

    // Validate file type
    if (!STORAGE_CONFIG.allowedMimeTypes.includes(file.type)) {
      throw new Error(`Invalid file type. Allowed types: ${STORAGE_CONFIG.allowedExtensions.join(', ')}`);
    }

    // Validate file extension
    const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
    if (!STORAGE_CONFIG.allowedExtensions.includes(fileExt)) {
      throw new Error(`Invalid file extension. Allowed types: ${STORAGE_CONFIG.allowedExtensions.join(', ')}`);
    }

    // Validate file size
    if (file.size > STORAGE_CONFIG.maxFileSize) {
      throw new Error(`File too large. Maximum size: ${STORAGE_CONFIG.maxFileSize / (1024 * 1024)}MB`);
    }

    // Validate fileName (prevent path traversal)
    if (fileName.includes('..') || fileName.includes('/')) {
      throw new Error("Invalid file name");
    }

    const { error } = await supabaseAdmin.storage
      .from(STORAGE_CONFIG.bucket)
      .upload(fileName, file);

    if (error) throw new Error(`Storage Error: ${error.message}`);

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(STORAGE_CONFIG.bucket)
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error: any) {
    throw new Error(error.message || "Failed to upload image.");
  }
}

export async function saveArticleToDB(payload: any, editId: string | null) {
  try {
    const supabase = supabaseAdmin;
    const allowedFields = editId
      ? NEWS_FIELD_ALLOWLISTS['news_updates']['edit']
      : NEWS_FIELD_ALLOWLISTS['news_updates']['create'];

    // Filter payload to only allowed fields
    const filteredPayload: Record<string, any> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (allowedFields.has(key)) {
        filteredPayload[key] = value;
      }
    }

    // Determine create vs edit using server-side record verification
    let isCreate = true;
    let recordId: any = null;

    if (editId) {
      recordId = editId;
      // Query database to verify record exists (don't trust client-supplied ID)
      const { data: existingRecord, error: lookupError } = await supabase
        .from('news_updates')
        .select('id')
        .eq('id', recordId)
        .single();

      if (lookupError) {
        throw new Error(`Failed to verify record: ${lookupError.message}`);
      }

      isCreate = !existingRecord;
    }

    const operation = isCreate ? 'create' : 'edit';
    await authorizeNewsOperation(operation as 'create' | 'edit');

    let res;
    if (isCreate) {
      res = await supabase
        .from('news_updates')
        .insert([filteredPayload])
        .select();
    } else {
      res = await supabase
        .from('news_updates')
        .update(filteredPayload)
        .eq('id', recordId)
        .select();
    }

    if (res.error) throw new Error(res.error.message);

    return { success: true, data: res.data };
  } catch (error: any) {
    throw new Error(error.message || "Failed to save article.");
  }
}

export async function deleteArticleFromDB(id: string) {
  try {
    await authorizeNewsOperation('delete');

    const supabase = supabaseAdmin;
    const { error } = await supabase
      .from('news_updates')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);

    return { success: true };
  } catch (error: any) {
    throw new Error(error.message || "Failed to delete article.");
  }
}