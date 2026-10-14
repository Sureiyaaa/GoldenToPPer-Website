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

function validateSlideInput(payload: any) {
  const errors: string[] = [];

  // project_id: optional, must be valid if provided
  if (payload.project_id !== undefined && payload.project_id !== null) {
    if (!Number.isInteger(payload.project_id) || payload.project_id < 1) {
      errors.push('project_id must be a positive integer');
    }
  }

  // image_url: required, non-empty string
  if (!payload.image_url || typeof payload.image_url !== 'string') {
    errors.push('image_url is required');
  } else if (payload.image_url.trim().length === 0) {
    errors.push('image_url cannot be empty');
  }

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

    // Validate input
    validateSlideInput(payload);

    // Filter to allowed fields
    const filtered = filterPayload(payload);

    // Validate project if specified
    if (filtered.project_id !== undefined && filtered.project_id !== null) {
      await validateProjectExists(filtered.project_id);
    }

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

    // Validate input
    validateSlideInput(payload);

    // Filter to allowed fields
    const filtered = filterPayload(payload);

    // Validate project if being changed
    if (filtered.project_id !== undefined && filtered.project_id !== null) {
      await validateProjectExists(filtered.project_id);
    }

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
