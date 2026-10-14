'use server';

import { createClient } from '@supabase/supabase-js';
import { getCustomSession, getRBACProfile } from '@/app/actions/auth';
import { createAuditLogAction } from '@/app/actions/admin_fetchers';
import { revalidatePath } from 'next/cache';

// ============================================================
// TYPES
// ============================================================

export interface PaymentCarouselSlide {
  id: number;
  project_id: number | null;
  image_url: string;
  sort_order: number;
  focal_x: number;
  focal_y: number;
  alt_text: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// MIME type to extension mapping
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// ============================================================
// FIELD ALLOWLIST
// ============================================================

const PAYMENT_CAROUSEL_FIELD_ALLOWLIST = new Set([
  'project_id',
  'image_url',
  'sort_order',
  'focal_x',
  'focal_y',
  'alt_text',
  'is_active',
]);

// ============================================================
// ADMIN CLIENT
// ============================================================

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ============================================================
// AUTHORIZATION
// ============================================================

async function authorizePaymentCarouselOperation(operation: 'create' | 'edit' | 'delete' | 'view') {
  const profile = await getRBACProfile();
  if (!profile) {
    throw new Error('Unauthorized: Session expired.');
  }

  if (profile.permissions === 'SUPER_ADMIN') {
    return;
  }

  const modulePerms = typeof profile.permissions === 'object'
    ? profile.permissions['payment_carousel']
    : null;

  const permissionMap: Record<string, string> = {
    create: 'can_create',
    edit: 'can_edit',
    delete: 'can_delete',
    view: 'can_view',
  };

  const requiredPermission = permissionMap[operation];

  if (!modulePerms || modulePerms[requiredPermission] !== true) {
    throw new Error(`Unauthorized: You don't have permission to ${operation} carousel slides.`);
  }
}

// ============================================================
// VALIDATION
// ============================================================

function filterPayload(payload: any): Record<string, any> {
  const filtered: Record<string, any> = {};
  if (payload && typeof payload === 'object') {
    for (const [key, value] of Object.entries(payload)) {
      if (PAYMENT_CAROUSEL_FIELD_ALLOWLIST.has(key)) {
        filtered[key] = value;
      }
    }
  }
  return filtered;
}

/**
 * Validate that image_url is either a Supabase carousel URL matching the project context
 * or a local /images/ path for migration assets.
 *
 * Supabase URL validation:
 * - Parse with new URL() to validate structure
 * - Require origin matches process.env.NEXT_PUBLIC_SUPABASE_URL exactly
 * - Require pathname starts with /storage/v1/object/public/images/carousel/{folder}/
 * - Require folder matches project context (carousel/default/ or carousel/project-N/)
 * - Require actual filename after folder prefix (not just the folder path)
 * - Reject query params or fragments
 *
 * Local path validation:
 * - Must start exactly with /images/
 * - Must have content after /images/
 * - No protocol or scheme
 * - No path traversal (after URL decoding)
 */
function validateImageUrl(imageUrl: string, projectId: number | null): string[] {
  const errors: string[] = [];

  if (!imageUrl || typeof imageUrl !== 'string') {
    errors.push('image_url is required');
    return errors;
  }

  imageUrl = imageUrl.trim();

  if (imageUrl.length === 0) {
    errors.push('image_url cannot be empty');
    return errors;
  }

  // Check if local migration path
  if (imageUrl.startsWith('/images/')) {
    // Validate local paths conservatively
    // Must start exactly with /images/ and have content after it
    if (imageUrl.length <= '/images/'.length) {
      errors.push('Local image path must have a filename after /images/');
      return errors;
    }
    // No protocol or scheme
    if (imageUrl.includes('://') || imageUrl.startsWith('//')) {
      errors.push('image_url cannot contain protocol or be protocol-relative');
      return errors;
    }
    // No query string or fragments
    if (imageUrl.includes('?') || imageUrl.includes('#')) {
      errors.push('Local image path cannot contain query strings or fragments');
      return errors;
    }
    // Reject path traversal (after decoding to catch encoded sequences)
    try {
      const decodedPath = decodeURIComponent(imageUrl);
      if (decodedPath.includes('..')) {
        errors.push('image_url cannot contain path traversal sequences');
        return errors;
      }
    } catch (decodeErr) {
      // If decoding fails, reject it
      errors.push('image_url contains invalid encoding');
      return errors;
    }
    // Valid local path for migration
    return errors;
  }

  // Otherwise, must be Supabase carousel URL
  try {
    const url = new URL(imageUrl);

    // Validate origin matches Supabase instance exactly
    const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
    if (url.origin !== supabaseOrigin) {
      errors.push('image_url must be from the configured Supabase instance');
      return errors;
    }

    // Reject query params or fragments
    if (url.search || url.hash) {
      errors.push('image_url cannot contain query parameters or fragments');
      return errors;
    }

    // Validate pathname matches project context with exact prefix check
    const expectedFolder = projectId === null ? 'default' : `project-${projectId}`;
    const expectedPrefix = `/storage/v1/object/public/images/carousel/${expectedFolder}/`;

    if (!url.pathname.startsWith(expectedPrefix)) {
      errors.push(
        `image_url must belong to carousel folder: carousel/${expectedFolder}/ (current: ${url.pathname})`
      );
      return errors;
    }

    // Ensure there's actually a filename after the folder prefix
    const afterPrefix = url.pathname.slice(expectedPrefix.length);
    if (afterPrefix.length === 0) {
      errors.push('image_url must include a filename, not just the folder path');
      return errors;
    }

    return errors;
  } catch (parseError) {
    errors.push('image_url is not a valid URL');
    return errors;
  }
}

function validateSlideInput(payload: any, projectId?: number | null) {
  const errors: string[] = [];

  // project_id: optional, must be valid if provided
  if (payload.project_id !== undefined && payload.project_id !== null) {
    if (!Number.isInteger(payload.project_id) || payload.project_id < 1) {
      errors.push('project_id must be a positive integer');
    }
  }

  // image_url: required, validate with context binding
  const imageUrlErrors = validateImageUrl(payload.image_url, projectId ?? payload.project_id ?? null);
  errors.push(...imageUrlErrors);

  // sort_order: optional, must be >= 0
  if (payload.sort_order !== undefined) {
    if (!Number.isInteger(payload.sort_order) || payload.sort_order < 0) {
      errors.push('sort_order must be a non-negative integer');
    }
  }

  // focal_x: optional, must be 0-100
  if (payload.focal_x !== undefined) {
    const x = Number(payload.focal_x);
    if (isNaN(x) || x < 0 || x > 100) {
      errors.push('focal_x must be between 0 and 100');
    }
  }

  // focal_y: optional, must be 0-100
  if (payload.focal_y !== undefined) {
    const y = Number(payload.focal_y);
    if (isNaN(y) || y < 0 || y > 100) {
      errors.push('focal_y must be between 0 and 100');
    }
  }

  // alt_text: optional, max 200 chars if provided
  if (payload.alt_text !== undefined && payload.alt_text !== null) {
    if (typeof payload.alt_text !== 'string') {
      errors.push('alt_text must be a string');
    } else if (payload.alt_text.trim().length > 200) {
      errors.push('alt_text cannot exceed 200 characters');
    }
  }

  // is_active: optional, must be boolean if provided
  if (payload.is_active !== undefined) {
    if (typeof payload.is_active !== 'boolean') {
      errors.push('is_active must be a boolean');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join('; ')}`);
  }
}

async function validateProjectExists(projectId: number | null) {
  if (projectId === null) {
    return; // Default showcase, no project validation needed
  }

  const supabase = getAdminClient();
  const { data: project, error } = await supabase
    .from('project_table')
    .select('id')
    .eq('id', projectId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single();

  if (error || !project) {
    throw new Error('Project not found or is inactive');
  }
}

// ============================================================
// ADMIN UPLOAD PREPARATION (METADATA + PATH GENERATION)
// ============================================================

/**
 * Prepare upload: validate RBAC, project, metadata, and generate signed upload token
 * Returns signed upload URL token for browser direct upload using uploadToSignedUrl
 *
 * The browser then uploads directly to Supabase Storage using the signed token,
 * bypassing serverless function payload limits for files up to 10 MB.
 */
export async function preparePaymentCarouselUploadAction(
  operation: 'create' | 'replace',
  projectId: number | null,
  mimeType: string,
  fileSize: number
): Promise<{ success: boolean; storagePath?: string; token?: string; error?: string }> {
  try {
    // Authorize based on operation
    if (operation === 'create') {
      await authorizePaymentCarouselOperation('create');
    } else {
      await authorizePaymentCarouselOperation('edit');
    }

    // Validate MIME type
    const ALLOWED_TYPES = new Set(Object.keys(MIME_TO_EXT));
    if (!ALLOWED_TYPES.has(mimeType)) {
      throw new Error(`Invalid image format. Allowed: JPEG, PNG, WebP. Got: ${mimeType || 'unknown'}`);
    }

    // Validate file size (metadata check, actual file validated during browser upload)
    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    if (fileSize <= 0) {
      throw new Error('File size must be greater than 0');
    }

    if (fileSize > MAX_SIZE) {
      throw new Error(`File too large. Maximum: 10 MB. Got: ${(fileSize / 1024 / 1024).toFixed(1)} MB`);
    }

    // Validate project exists if specified
    if (projectId !== null) {
      await validateProjectExists(projectId);
    }

    // Generate safe storage path on server
    const ext = MIME_TO_EXT[mimeType];
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const safeFilename = `${timestamp}-${random}.${ext}`;
    const folder = projectId === null ? 'default' : `project-${projectId}`;
    const storagePath = `carousel/${folder}/${safeFilename}`;

    // Create signed upload URL using service-role client
    // This gives the browser an authorization token valid for 2 hours
    const supabase = getAdminClient();
    const { data: signedUploadData, error: signError } = await supabase.storage
      .from('images')
      .createSignedUploadUrl(storagePath, { upsert: false });

    if (signError || !signedUploadData?.token) {
      throw new Error(`Failed to generate signed upload URL: ${signError?.message || 'unknown error'}`);
    }

    return {
      success: true,
      storagePath,
      token: signedUploadData.token,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Upload preparation failed',
    };
  }
}

// ============================================================
// ADMIN UPLOAD FINALIZATION (VERIFY + GET PUBLIC URL)
// ============================================================

/**
 * After browser uploads with signed token, verify upload exists and is valid
 * Returns canonical public URL for slide persistence
 *
 * Must verify authorization again to prevent unauthorized slides from being persisted
 */
export async function finalizePaymentCarouselUploadAction(
  operation: 'create' | 'replace',
  storagePath: string,
  projectId: number | null
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Re-authorize on finalize to ensure authorization not just on prepare
    if (operation === 'create') {
      await authorizePaymentCarouselOperation('create');
    } else {
      await authorizePaymentCarouselOperation('edit');
    }

    // Validate storage path format (prevent path traversal)
    const folder = projectId === null ? 'default' : `project-${projectId}`;
    const expectedPrefix = `carousel/${folder}/`;

    if (!storagePath.startsWith(expectedPrefix)) {
      throw new Error('Invalid storage path: does not match expected carousel context');
    }

    // Verify project if specified
    if (projectId !== null) {
      await validateProjectExists(projectId);
    }

    // Verify upload exists in storage
    const supabase = getAdminClient();
    const { data: fileList, error: listError } = await supabase.storage
      .from('images')
      .list(folder, { limit: 1, search: storagePath.split('/').pop() });

    if (listError || !fileList || fileList.length === 0) {
      throw new Error('Uploaded file not found in storage');
    }

    const uploadedFile = fileList.find(f => `${folder}/${f.name}` === storagePath);
    if (!uploadedFile) {
      throw new Error('Uploaded file verification failed: path mismatch');
    }

    // Verify file size REQUIRED and within limits (fail-closed)
    const MAX_SIZE = 10 * 1024 * 1024;
    const uploadedSize = uploadedFile.metadata?.size;
    if (typeof uploadedSize !== 'number' || uploadedSize <= 0 || uploadedSize > MAX_SIZE) {
      // Delete the file if size validation fails
      await supabase.storage.from('images').remove([storagePath]);
      throw new Error(
        uploadedSize === undefined
          ? 'Uploaded file size metadata missing'
          : `Uploaded file exceeds 10 MB limit: ${(uploadedSize / 1024 / 1024).toFixed(1)} MB`
      );
    }

    // Verify MIME type REQUIRED and in allowlist (fail-closed)
    const uploadedMimeType = uploadedFile.metadata?.mimetype;
    const ALLOWED_TYPES = new Set(Object.keys(MIME_TO_EXT));
    if (typeof uploadedMimeType !== 'string' || !ALLOWED_TYPES.has(uploadedMimeType)) {
      // Delete the file if MIME validation fails
      await supabase.storage.from('images').remove([storagePath]);
      throw new Error(
        uploadedMimeType === undefined
          ? 'Uploaded file MIME type metadata missing'
          : `Invalid image content-type: ${uploadedMimeType}. Only JPEG, PNG, WebP allowed.`
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(storagePath);

    if (!publicUrl) {
      throw new Error('Failed to generate public URL');
    }

    return {
      success: true,
      url: publicUrl,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Upload finalization failed',
    };
  }
}

// ============================================================
// PUBLIC READ ACTIONS
// ============================================================

/**
 * Fetch default showcase slides (project_id IS NULL) that are active
 * Used by public Payment page for carousel
 */
export async function fetchDefaultCarouselSlidesAction(): Promise<PaymentCarouselSlide[]> {
  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('payment_carousel_slides')
      .select('*')
      .is('project_id', null)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[PAYMENT_CAROUSEL] Error fetching default slides:', error.message);
      return [];
    }

    return (data || []) as PaymentCarouselSlide[];
  } catch (err: any) {
    console.error('[PAYMENT_CAROUSEL] Unexpected error fetching default slides:', err);
    return [];
  }
}

/**
 * Fetch project-specific additional carousel slides (project_id = X) that are active
 * Used by public Payment page when project is selected
 */
export async function fetchProjectCarouselSlidesAction(projectId: number): Promise<PaymentCarouselSlide[]> {
  try {
    // Validate project exists and is active/not deleted
    await validateProjectExists(projectId);

    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('payment_carousel_slides')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[PAYMENT_CAROUSEL] Error fetching project slides:', error.message);
      return [];
    }

    return (data || []) as PaymentCarouselSlide[];
  } catch (err: any) {
    console.error('[PAYMENT_CAROUSEL] Error fetching project slides:', err);
    return [];
  }
}

// ============================================================
// ADMIN READ ACTIONS
// ============================================================

/**
 * Fetch all slides (active and inactive) for a context for admin editing
 * project_id = null → Default Showcase
 * project_id = X → Project-specific slides
 */
export async function fetchCarouselSlidesForAdminAction(
  projectId: number | null
): Promise<{ success: boolean; data?: PaymentCarouselSlide[]; error?: string }> {
  try {
    await authorizePaymentCarouselOperation('view');

    // Validate project if specified
    if (projectId !== null) {
      await validateProjectExists(projectId);
    }

    const supabase = getAdminClient();

    let query = supabase
      .from('payment_carousel_slides')
      .select('*')
      .order('sort_order', { ascending: true });

    if (projectId === null) {
      query = query.is('project_id', null);
    } else {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      data: (data || []) as PaymentCarouselSlide[],
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to fetch carousel slides',
    };
  }
}

// ============================================================
// ADMIN MUTATIONS
// ============================================================

/**
 * Create a new carousel slide
 */
export async function createPaymentCarouselSlideAction(
  payload: Record<string, any>
): Promise<{ success: boolean; data?: PaymentCarouselSlide; error?: string }> {
  try {
    await authorizePaymentCarouselOperation('create');

    // Validate project first (for context binding in URL validation)
    const projectId = payload.project_id ?? null;
    if (projectId !== null) {
      await validateProjectExists(projectId);
    }

    // Validate input with project context for URL binding
    validateSlideInput(payload, projectId);

    // Filter to allowed fields
    const filtered = filterPayload(payload);

    // Ensure required fields
    if (!filtered.image_url) {
      throw new Error('image_url is required');
    }

    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('payment_carousel_slides')
      .insert([filtered])
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Audit log
    const projectName = filtered.project_id ? `Project ${filtered.project_id}` : 'Default Showcase';
    await createAuditLogAction(
      'CREATE',
      'Payment Carousel',
      projectName,
      `Added slide: ${filtered.alt_text || '(no alt text)'}`
    );

    // Revalidate payment page cache after successful persistence
    try {
      revalidatePath('/payment');
    } catch (err) {
      console.warn('[PAYMENT_CAROUSEL] Could not revalidate payment page:', err);
    }

    return {
      success: true,
      data: data as PaymentCarouselSlide,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to create carousel slide',
    };
  }
}

/**
 * Update an existing carousel slide
 */
export async function updatePaymentCarouselSlideAction(
  slideId: number,
  payload: Record<string, any>
): Promise<{ success: boolean; data?: PaymentCarouselSlide; error?: string }> {
  try {
    await authorizePaymentCarouselOperation('edit');

    if (!Number.isInteger(slideId) || slideId < 1) {
      throw new Error('Invalid slide ID');
    }

    // Determine project context for URL validation
    const projectId = payload.project_id ?? null;
    if (projectId !== null) {
      await validateProjectExists(projectId);
    }

    // Validate input with project context for URL binding
    validateSlideInput(payload, projectId);

    // Filter to allowed fields
    const filtered = filterPayload(payload);

    // Add updated_at timestamp
    filtered.updated_at = new Date().toISOString();

    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('payment_carousel_slides')
      .update(filtered)
      .eq('id', slideId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error('Slide not found');
    }

    // Audit log
    const projectName = data.project_id ? `Project ${data.project_id}` : 'Default Showcase';
    await createAuditLogAction(
      'EDIT',
      'Payment Carousel',
      projectName,
      `Updated slide ${slideId} properties`
    );

    // Revalidate payment page cache after successful persistence
    try {
      revalidatePath('/payment');
    } catch (err) {
      console.warn('[PAYMENT_CAROUSEL] Could not revalidate payment page:', err);
    }

    return {
      success: true,
      data: data as PaymentCarouselSlide,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to update carousel slide',
    };
  }
}

/**
 * Toggle slide active status (visibility)
 */
export async function togglePaymentCarouselSlideStatusAction(
  slideId: number,
  currentStatus: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await authorizePaymentCarouselOperation('edit');

    if (!Number.isInteger(slideId) || slideId < 1) {
      throw new Error('Invalid slide ID');
    }

    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('payment_carousel_slides')
      .update({
        is_active: !currentStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', slideId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error('Slide not found');
    }

    // Audit log
    const projectName = data.project_id ? `Project ${data.project_id}` : 'Default Showcase';
    const action = !currentStatus ? 'shown' : 'hidden';
    await createAuditLogAction(
      'VISIBILITY',
      'Payment Carousel',
      projectName,
      `Slide ${slideId} ${action} on carousel`
    );

    // Revalidate payment page cache after successful persistence
    try {
      revalidatePath('/payment');
    } catch (err) {
      console.warn('[PAYMENT_CAROUSEL] Could not revalidate payment page:', err);
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to toggle slide status',
    };
  }
}

/**
 * Delete a carousel slide
 */
export async function deletePaymentCarouselSlideAction(slideId: number): Promise<{ success: boolean; error?: string }> {
  try {
    await authorizePaymentCarouselOperation('delete');

    if (!Number.isInteger(slideId) || slideId < 1) {
      throw new Error('Invalid slide ID');
    }

    const supabase = getAdminClient();

    // Fetch before delete for audit context
    const { data: slideData } = await supabase
      .from('payment_carousel_slides')
      .select('*')
      .eq('id', slideId)
      .single();

    // Delete
    const { error } = await supabase
      .from('payment_carousel_slides')
      .delete()
      .eq('id', slideId);

    if (error) {
      throw new Error(error.message);
    }

    // Audit log
    const projectName = slideData?.project_id ? `Project ${slideData.project_id}` : 'Default Showcase';
    await createAuditLogAction(
      'DELETE',
      'Payment Carousel',
      projectName,
      `Deleted slide ${slideId}: ${slideData?.alt_text || '(no alt text)'}`
    );

    // Revalidate payment page cache after successful persistence
    try {
      revalidatePath('/payment');
    } catch (err) {
      console.warn('[PAYMENT_CAROUSEL] Could not revalidate payment page:', err);
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to delete carousel slide',
    };
  }
}

/**
 * Reorder slides within a context (all for default showcase or all for one project)
 * Accepts array of slide IDs in desired order
 * Validates all IDs belong to the same context (project_id)
 * Normalizes sort_order to 0, 1, 2, ...
 */
export async function reorderPaymentCarouselSlidesAction(
  projectId: number | null,
  orderedSlideIds: number[]
): Promise<{ success: boolean; error?: string }> {
  try {
    await authorizePaymentCarouselOperation('edit');

    if (!Array.isArray(orderedSlideIds) || orderedSlideIds.length === 0) {
      throw new Error('orderedSlideIds must be a non-empty array');
    }

    // Validate project if specified
    if (projectId !== null) {
      await validateProjectExists(projectId);
    }

    const supabase = getAdminClient();

    // Verify all slides belong to the same context
    let query = supabase
      .from('payment_carousel_slides')
      .select('id')
      .in('id', orderedSlideIds);

    if (projectId === null) {
      query = query.is('project_id', null);
    } else {
      query = query.eq('project_id', projectId);
    }

    const { data: slides, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    if (!slides || slides.length !== orderedSlideIds.length) {
      throw new Error('One or more slide IDs not found in the specified context');
    }

    // Update sort_order for each slide
    const now = new Date().toISOString();
    for (let i = 0; i < orderedSlideIds.length; i++) {
      const { error: updateError } = await supabase
        .from('payment_carousel_slides')
        .update({
          sort_order: i,
          updated_at: now,
        })
        .eq('id', orderedSlideIds[i]);

      if (updateError) {
        throw new Error(`Failed to reorder slide ${orderedSlideIds[i]}: ${updateError.message}`);
      }
    }

    // Audit log
    const projectName = projectId === null ? 'Default Showcase' : `Project ${projectId}`;
    await createAuditLogAction(
      'REORDERED',
      'Payment Carousel',
      projectName,
      `Reordered ${orderedSlideIds.length} slides in carousel`
    );

    // Revalidate payment page cache after successful persistence
    try {
      revalidatePath('/payment');
    } catch (err) {
      console.warn('[PAYMENT_CAROUSEL] Could not revalidate payment page:', err);
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to reorder carousel slides',
    };
  }
}
