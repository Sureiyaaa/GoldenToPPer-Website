// app/actions/projects.ts
'use server';

import { createClient } from '@supabase/supabase-js';
import { getCustomSession } from './auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Fetches all projects for the admin dashboard, bypassing RLS to ensure
 * inactive (hidden) projects remain manageable by admins.
 */
export async function fetchAdminProjectsList() {
  const session = await getCustomSession();

  if (!session) throw new Error('Unauthorized');

  const { data, error } = await supabaseAdmin
    .from('project_table')
    .select('id, title, city, status, is_active, image')
    .is('deleted_at', null)
    .order('id', { ascending: true });

  if (error) throw error;

  return data;
}

export async function fetchArchivedProjectsList() {
  const session = await getCustomSession();

  if (!session) {
    throw new Error('Unauthorized');
  }

  const { data, error } = await supabaseAdmin
    .from('project_table')
    .select('id, title, slug, city, status, is_active, image, deleted_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function archiveProjectAction(projectId: number | string) {
  const session = await getCustomSession();

  if (!session) {
    throw new Error('Unauthorized');
  }

  const normalizedProjectId = Number(projectId);
  if (!Number.isFinite(normalizedProjectId)) {
    throw new Error('Invalid project ID.');
  }

  const { data: project, error: projectReadError } = await supabaseAdmin
    .from('project_table')
    .select('id, title, deleted_at')
    .eq('id', normalizedProjectId)
    .maybeSingle();

  if (projectReadError) {
    throw projectReadError;
  }

  if (!project) {
    throw new Error('Project not found.');
  }

  if (project.deleted_at) {
    return { success: true, alreadyArchived: true };
  }

  const { data: navRows, error: navReadError } = await supabaseAdmin
    .from('navbar_projects')
    .select('id, is_active')
    .eq('project_id', normalizedProjectId);

  if (navReadError) {
    throw navReadError;
  }

  const previousNavigationState = (navRows || []).map((row: any) => ({
    id: row.id,
    is_active: Boolean(row.is_active),
  }));

  if (previousNavigationState.length > 0) {
    const { error: navHideError } = await supabaseAdmin
      .from('navbar_projects')
      .update({ is_active: false })
      .eq('project_id', normalizedProjectId);

    if (navHideError) {
      throw navHideError;
    }
  }

  const { error: archiveError } = await supabaseAdmin
    .from('project_table')
    .update({
      deleted_at: new Date().toISOString(),
      is_active: false,
    })
    .eq('id', normalizedProjectId);

  if (archiveError) {
    for (const navRow of previousNavigationState) {
      await supabaseAdmin
        .from('navbar_projects')
        .update({ is_active: navRow.is_active })
        .eq('id', navRow.id);
    }

    throw archiveError;
  }

  return { success: true };
}

export async function restoreArchivedProjectAction(projectId: number | string) {
  const session = await getCustomSession();

  if (!session) {
    throw new Error('Unauthorized');
  }

  const normalizedProjectId = Number(projectId);
  if (!Number.isFinite(normalizedProjectId)) {
    throw new Error('Invalid project ID.');
  }

  const { data: project, error: projectReadError } = await supabaseAdmin
    .from('project_table')
    .select('id, title, slug, deleted_at')
    .eq('id', normalizedProjectId)
    .maybeSingle();

  if (projectReadError) {
    throw projectReadError;
  }

  if (!project) {
    throw new Error('Project not found.');
  }

  if (!project.deleted_at) {
    return { success: true, alreadyRestored: true };
  }

  if (project.slug) {
    const { data: conflictingProject, error: slugCheckError } =
      await supabaseAdmin
        .from('project_table')
        .select('id, title')
        .eq('slug', project.slug)
        .is('deleted_at', null)
        .neq('id', normalizedProjectId)
        .maybeSingle();

    if (slugCheckError) {
      throw slugCheckError;
    }

    if (conflictingProject) {
      throw new Error(
        `This project cannot be restored because the URL slug "${project.slug}" is already used by ${conflictingProject.title || 'another active project'}.`
      );
    }
  }

  const { error: restoreError } = await supabaseAdmin
    .from('project_table')
    .update({
      deleted_at: null,
      // Restored content returns safely as Hidden until an admin republishes it.
      is_active: false,
    })
    .eq('id', normalizedProjectId);

  if (restoreError) {
    throw restoreError;
  }

  // Keep or recreate the linked navigation item, but never republish it
  // automatically as part of a restore.
  await ensureProjectNavigationEntriesAction();
  await hideProjectNavigationEntryAction(normalizedProjectId);

  return { success: true };
}

export async function permanentlyDeleteArchivedProjectAction(
  projectId: number | string,
  confirmationTitle: string
) {
  const session = await getCustomSession();

  if (!session) {
    throw new Error('Unauthorized');
  }

  const normalizedProjectId = Number(projectId);

  if (!Number.isFinite(normalizedProjectId)) {
    throw new Error('Invalid project ID.');
  }

  const { data: project, error: projectReadError } = await supabaseAdmin
    .from('project_table')
    .select('id, title, deleted_at')
    .eq('id', normalizedProjectId)
    .maybeSingle();

  if (projectReadError) {
    throw projectReadError;
  }

  if (!project) {
    throw new Error('Project not found.');
  }

  if (!project.deleted_at) {
    return {
      success: false,
      blocked: true,
      error: 'Only archived projects can be permanently deleted.',
    };
  }

  const normalizedConfirmation = String(confirmationTitle || '')
    .trim()
    .toLocaleLowerCase();

  const normalizedProjectTitle = String(project.title || '')
    .trim()
    .toLocaleLowerCase();

  if (normalizedConfirmation !== normalizedProjectTitle) {
    return {
      success: false,
      blocked: true,
      error: `Type "${project.title}" to confirm permanent deletion.`,
    };
  }

  // Historical customer records intentionally block hard deletion.
  // The database migration also enforces these relationships as RESTRICT,
  // but these checks let us show a human-readable message before PostgreSQL
  // has to reject the delete.
  const [inquiryResult, loanResult] = await Promise.all([
    supabaseAdmin
      .from('inquire')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', normalizedProjectId),

    supabaseAdmin
      .from('loan_preapp')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', normalizedProjectId),
  ]);

  if (inquiryResult.error) {
    throw inquiryResult.error;
  }

  if (loanResult.error) {
    throw loanResult.error;
  }

  const inquiryCount = inquiryResult.count || 0;
  const loanCount = loanResult.count || 0;

  if (inquiryCount > 0 || loanCount > 0) {
    const parts: string[] = [];

    if (inquiryCount > 0) {
      parts.push(
        `${inquiryCount} inquiry record${inquiryCount === 1 ? '' : 's'}`
      );
    }

    if (loanCount > 0) {
      parts.push(
        `${loanCount} loan pre-application${loanCount === 1 ? '' : 's'}`
      );
    }

    return {
      success: false,
      blocked: true,
      error:
        `Permanent deletion is blocked because this project has ${parts.join(
          ' and '
        )}. Keep the project archived so historical customer records remain intact.`,
      inquiryCount,
      loanCount,
    };
  }

  // With the project relationship migration applied:
  // - CMS-owned rows cascade automatically.
  // - promotions.project_id is set to NULL so promotions are preserved.
  // - inquiry / loan_preapp block deletion.
  //
  // This keeps the database as the source of truth for referential integrity
  // instead of manually deleting child tables in application code.
  const { error: deleteError } = await supabaseAdmin
    .from('project_table')
    .delete()
    .eq('id', normalizedProjectId);

  if (deleteError) {
    return {
      success: false,
      blocked: true,
      error:
        `The database still blocked permanent deletion. The project remains archived. ${deleteError.message}`,
    };
  }

  return {
    success: true,
    deletedProjectId: normalizedProjectId,
    deletedProjectTitle: project.title,
  };
}

async function getNextNavigationDisplayOrder() {
  const { data, error } = await supabaseAdmin
    .from('navbar_projects')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to determine navigation order: ${error.message}`
    );
  }

  const currentMax = Number(data?.display_order);

  return Number.isFinite(currentMax) && currentMax > 0
    ? currentMax + 1
    : 1;
}

export async function createBasicProjectAction(input: {
  title: string;
  slug: string;
  status: string;
  address: string;
  city: string;
  country: string;
  sqm: string;
  unit_total: string;
}) {
  try {
    const session = await getCustomSession();

    if (!session) {
      throw new Error('Unauthorized: Please log in.');
    }

    const title = input.title.trim();
    const slug = input.slug.trim();
    const status = input.status.trim();
    const address = input.address.trim();
    const city = input.city.trim();
    const country = input.country.trim() || 'Philippines';

    if (!title) {
      throw new Error('Project title is required.');
    }

    if (!slug || !slug.startsWith('/')) {
      throw new Error('URL slug must start with "/".');
    }

    if (!status) {
      throw new Error('Project status is required.');
    }

    if (!address || !city || !country) {
      throw new Error('Project location is required.');
    }

    // Prevent duplicate public URLs.
    const { data: existingSlug, error: slugCheckError } =
      await supabaseAdmin
        .from('project_table')
        .select('id')
        .eq('slug', slug)
        .is('deleted_at', null)
        .maybeSingle();

    if (slugCheckError) {
      throw slugCheckError;
    }

    if (existingSlug) {
      throw new Error(
        'That URL slug is already being used by another project.'
      );
    }

    const { data, error } = await supabaseAdmin
      .from('project_table')
      .insert({
        title,
        slug,
        status,
        address,
        city,
        country,

        sqm: input.sqm || null,
        unit_total: input.unit_total || null,

        // Website/media content will be completed in the editor.
        image: '',
        img_awards: null,
        map_icon: null,

        // New projects remain hidden until intentionally enabled.
        is_active: false,
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    if (!data?.id) {
      throw new Error('Project was created but no project ID was returned.');
    }

    // Every project owns one navigation item.
    // Keep it hidden until the project/navigation content is ready.
    try {
      const displayOrder = await getNextNavigationDisplayOrder();

      const { error: navigationError } = await supabaseAdmin
        .from('navbar_projects')
        .insert({
          project_id: data.id,
          nav_title: title,
          tagline: '',
          nav_image_url: null,
          display_order: displayOrder,
          // This stores the admin's navigation preference.
          // The public navbar still remains hidden while the project itself
          // is hidden, so a brand-new project is not published prematurely.
          is_active: true,
        });

      if (navigationError) {
        throw navigationError;
      }
    } catch (navigationError: any) {
      // Avoid leaving behind an orphan project if its required navigation
      // item could not be created.
      const { error: cleanupError } = await supabaseAdmin
        .from('project_table')
        .delete()
        .eq('id', data.id);

      if (cleanupError) {
        console.error(
          '[createBasicProjectAction] Navigation creation failed and project cleanup also failed:',
          cleanupError
        );
      }

      throw new Error(
        `Project could not be created with its navigation item: ${
          navigationError?.message || 'Unknown navigation error.'
        }`
      );
    }

    return {
      success: true,
      projectId: data.id,
    };
  } catch (error: any) {
    console.error('[createBasicProjectAction]', error);

    return {
      success: false,
      error: error?.message || 'Failed to create project.',
    };
  }
}

function getNavigationRowRichness(row: any) {
  let score = 0;

  if (String(row?.nav_title || '').trim()) score += 1;
  if (String(row?.tagline || '').trim()) score += 3;
  if (String(row?.nav_image_url || '').trim()) score += 4;

  return score;
}

async function repairDuplicateProjectNavigationRows() {
  const { data: navigationRows, error } = await supabaseAdmin
    .from('navbar_projects')
    .select(
      'id, project_id, nav_title, tagline, nav_image_url, display_order, is_active'
    )
    .order('display_order', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    throw error;
  }

  const rowsByProject = new Map<number, any[]>();

  for (const row of navigationRows || []) {
    const projectId = Number(row.project_id);
    if (!Number.isFinite(projectId)) continue;

    const currentRows = rowsByProject.get(projectId) || [];
    currentRows.push(row);
    rowsByProject.set(projectId, currentRows);
  }

  let removedCount = 0;

  for (const rows of rowsByProject.values()) {
    if (rows.length <= 1) continue;

    const sortedRows = [...rows].sort((a, b) => {
      const richnessDifference =
        getNavigationRowRichness(b) - getNavigationRowRichness(a);

      if (richnessDifference !== 0) {
        return richnessDifference;
      }

      const aOrder = Number(a.display_order);
      const bOrder = Number(b.display_order);
      const normalizedAOrder = Number.isFinite(aOrder)
        ? aOrder
        : Number.MAX_SAFE_INTEGER;
      const normalizedBOrder = Number.isFinite(bOrder)
        ? bOrder
        : Number.MAX_SAFE_INTEGER;

      if (normalizedAOrder !== normalizedBOrder) {
        return normalizedAOrder - normalizedBOrder;
      }

      return Number(a.id) - Number(b.id);
    });

    const primary = sortedRows[0];
    const duplicates = sortedRows.slice(1);

    // Preserve the richest/customized navigation content before removing
    // duplicates. This favors an existing logo/tagline over a newly generated
    // blank fallback row.
    const firstTitleRow = sortedRows.find((row) =>
      String(row.nav_title || '').trim()
    );
    const firstTaglineRow = sortedRows.find((row) =>
      String(row.tagline || '').trim()
    );
    const firstImageRow = sortedRows.find((row) =>
      String(row.nav_image_url || '').trim()
    );

    const validOrders = sortedRows
      .map((row) => Number(row.display_order))
      .filter((value) => Number.isFinite(value));

    const mergedDisplayOrder =
      validOrders.length > 0
        ? Math.min(...validOrders)
        : primary.display_order;

    const { error: updateError } = await supabaseAdmin
      .from('navbar_projects')
      .update({
        nav_title:
          firstTitleRow?.nav_title ||
          primary.nav_title ||
          'Untitled Project',
        tagline:
          firstTaglineRow?.tagline ||
          primary.tagline ||
          '',
        nav_image_url:
          firstImageRow?.nav_image_url ||
          primary.nav_image_url ||
          null,
        display_order: mergedDisplayOrder,
        // Preserve the selected canonical row's saved visibility preference.
        is_active: Boolean(primary.is_active),
      })
      .eq('id', primary.id);

    if (updateError) {
      throw updateError;
    }

    const duplicateIds = duplicates
      .map((row) => Number(row.id))
      .filter((id) => Number.isFinite(id));

    if (duplicateIds.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from('navbar_projects')
        .delete()
        .in('id', duplicateIds);

      if (deleteError) {
        throw deleteError;
      }

      removedCount += duplicateIds.length;
    }
  }

  return removedCount;
}

export async function ensureProjectNavigationEntriesAction() {
  const session = await getCustomSession();

  if (!session) {
    throw new Error('Unauthorized');
  }

  // Repair any legacy or race-created duplicates before checking which
  // projects are missing a navigation row.
  const duplicatesRemovedBeforeInsert =
    await repairDuplicateProjectNavigationRows();

  const [projectResult, navigationResult] = await Promise.all([
    supabaseAdmin
      .from('project_table')
      .select('id, title')
      .is('deleted_at', null)
      .order('id', { ascending: true }),

    supabaseAdmin
      .from('navbar_projects')
      .select('id, project_id, display_order')
      .order('display_order', { ascending: true }),
  ]);

  if (projectResult.error) {
    throw projectResult.error;
  }

  if (navigationResult.error) {
    throw navigationResult.error;
  }

  const existingProjectIds = new Set(
    (navigationResult.data || [])
      .map((item: any) => Number(item.project_id))
      .filter((projectId: number) => Number.isFinite(projectId))
  );

  let nextOrder = (navigationResult.data || []).reduce(
    (max: number, item: any) => {
      const value = Number(item.display_order);
      return Number.isFinite(value) && value > max ? value : max;
    },
    0
  );

  const missingRows = (projectResult.data || [])
    .filter((project: any) => !existingProjectIds.has(Number(project.id)))
    .map((project: any) => {
      nextOrder += 1;

      return {
        project_id: project.id,
        nav_title: project.title || 'Untitled Project',
        tagline: '',
        nav_image_url: null,
        display_order: nextOrder,
        // New/repaired entries keep their saved navigation preference on,
        // while effective visibility still depends on project.is_active.
        is_active: true,
      };
    });

  if (missingRows.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from('navbar_projects')
      .upsert(missingRows, {
        onConflict: 'project_id',
        ignoreDuplicates: true,
      });

    if (insertError) {
      throw insertError;
    }
  }

  // A second repair closes the small race window where two concurrent sync
  // calls could both decide the same project was missing and insert a row.
  const duplicatesRemovedAfterInsert =
    await repairDuplicateProjectNavigationRows();

  return {
    success: true,
    createdCount: missingRows.length,
    duplicateRowsRemoved:
      duplicatesRemovedBeforeInsert + duplicatesRemovedAfterInsert,
  };
}

export async function hideProjectNavigationEntryAction(
  projectId: number | string
) {
  const session = await getCustomSession();

  if (!session) {
    throw new Error('Unauthorized');
  }

  const { error } = await supabaseAdmin
    .from('navbar_projects')
    .update({ is_active: false })
    .eq('project_id', Number(projectId));

  if (error) {
    throw error;
  }

  return { success: true };
}

/**
 * Updates the project's public visibility without overwriting the admin's
 * navigation preference.
 *
 * navbar_projects.is_active is treated as the user's explicit preference:
 * - true  => show the nav item whenever the project itself is visible
 * - false => keep the nav item hidden even when the project is visible
 *
 * Effective navigation visibility is therefore:
 * project_table.is_active && navbar_projects.is_active
 *
 * This lets hiding/showing a project automatically flip the Navigation Setup
 * switch visually while preserving an intentionally hidden navbar item.
 */
export async function setProjectWebsiteVisibilityAction(
  projectId: number | string,
  visible: boolean
) {
  const session = await getCustomSession();

  if (!session) {
    throw new Error('Unauthorized');
  }

  const normalizedProjectId = Number(projectId);

  if (!Number.isFinite(normalizedProjectId)) {
    throw new Error('Invalid project ID.');
  }

  const { data: currentProject, error: projectReadError } =
    await supabaseAdmin
      .from('project_table')
      .select('id')
      .eq('id', normalizedProjectId)
      .is('deleted_at', null)
      .single();

  if (projectReadError || !currentProject) {
    throw new Error(
      projectReadError?.message || 'Project not found.'
    );
  }

  const { error: projectUpdateError } = await supabaseAdmin
    .from('project_table')
    .update({ is_active: visible })
    .eq('id', normalizedProjectId);

  if (projectUpdateError) {
    throw projectUpdateError;
  }

  return {
    success: true,
    is_active: visible,
  };
}

export async function saveProjectAction(payload: any) {
  try {
    // 1. Verify custom session
    const userId = await getCustomSession();

    if (!userId) {
      throw new Error('Unauthorized: Please log in.');
    }

    let { targetProjectId, cleanProjectData, finalData } = payload;

    console.log('[saveProjectAction] payload insights', {
      hasTargetProjectId: Boolean(targetProjectId),
      hasCleanProjectData: !!cleanProjectData,
      hasFinalData: !!finalData,
      unitLayoutsType: Array.isArray(finalData?.unit_layouts)
        ? 'array'
        : typeof finalData?.unit_layouts,
      amenitiesType: Array.isArray(finalData?.amenities)
        ? 'array'
        : typeof finalData?.amenities,
      childMarkersType: Array.isArray(finalData?.child_markers)
        ? 'array'
        : typeof finalData?.child_markers,
      tagsType: Array.isArray(finalData?.tags)
        ? 'array'
        : typeof finalData?.tags,
    });

    // 2. Base Project Table
    if (targetProjectId) {
      const { error } = await supabaseAdmin
        .from('project_table')
        .update(cleanProjectData)
        .eq('id', targetProjectId);

      if (error) throw error;
    } else {
      const { data, error } = await supabaseAdmin
        .from('project_table')
        .insert(cleanProjectData)
        .select('id')
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to create project');

      targetProjectId = data.id;
    }

    // 3. Extended Description
    await supabaseAdmin.from('extended_description').upsert(
      {
        project_id: targetProjectId,
        editorial_title: finalData.editorial_title,
        editorial_long: finalData.editorial_long,
        editorial_img: finalData.editorial_img,
        editorial_title_color: finalData.editorial_title_color,
        editorial_desc_color: finalData.editorial_desc_color,
        editorial_bg_color: finalData.editorial_bg_color,
        amenities_title: finalData.amenities_title,
        amenities_title_gold: finalData.amenities_title_gold,
        map_subtitle: finalData.map_subtitle || null,
      },
      { onConflict: 'project_id' }
    );

    // 4. Tags
    await supabaseAdmin
      .from('project_tag')
      .delete()
      .eq('project_id', targetProjectId);

    if (finalData.tags && finalData.tags.length > 0) {
      for (const tagObj of finalData.tags) {
        const tagName = tagObj.tag_name.trim();
        if (!tagName) continue;

        const { data: existingTag } = await supabaseAdmin
          .from('tags')
          .select('id')
          .ilike('tag_name', tagName)
          .maybeSingle();

        const tagId = existingTag
          ? existingTag.id
          : (
              await supabaseAdmin
                .from('tags')
                .insert({ tag_name: tagName })
                .select('id')
                .single()
            ).data?.id;

        if (tagId) {
          await supabaseAdmin.from('project_tag').insert({
            project_id: targetProjectId,
            tag_id: tagId,
          });
        }
      }
    }

    // 5. Unit Layouts
    // Preserve existing unit_layout IDs instead of deleting/recreating every row.
    //
    // Existing row with a valid ID -> UPDATE
    // New form row without an ID     -> INSERT
    // Existing DB row removed in UI  -> DELETE
    //
    // This keeps blueprint URLs such as ?blueprint=546 stable across normal edits.
    const unitLayouts = Array.isArray(finalData.unit_layouts)
      ? finalData.unit_layouts
      : [];

    const { data: oldLayouts, error: oldLayoutsError } = await supabaseAdmin
      .from('unit_layout')
      .select('id, thumbnail')
      .eq('project_id', targetProjectId);

    if (oldLayoutsError) {
      throw new Error(`Layout fetch error: ${oldLayoutsError.message}`);
    }

    const existingLayoutIds = new Set(
      (oldLayouts || []).map((layout: any) => Number(layout.id))
    );

    const retainedLayoutIds = new Set<number>();
    const newLayoutRows: any[] = [];

    const buildLayoutValues = (item: any) => ({
      tower_name:
      typeof item.tower_name === 'string' && item.tower_name.trim()
        ? item.tower_name.trim()
        : 'Tower A - Residential',
      bg_color: item.bg_color || '#051431',
      title: item.title,
      description: item.description || '',
      thumbnail: item.thumbnail || '',
      min_sqm: item.min_sqm ? parseFloat(item.min_sqm) : null,
      max_sqm: item.max_sqm ? parseFloat(item.max_sqm) : null,

      // Order inside the project's tower blueprint group
      sort_order:
        item.sort_order !== undefined &&
        item.sort_order !== null &&
        item.sort_order !== ''
          ? parseInt(String(item.sort_order), 10)
          : null,

      // Map popup placement
      show_on_map_card: Boolean(item.show_on_map_card),
      map_card_order:
        item.show_on_map_card && item.map_card_order
          ? parseInt(String(item.map_card_order), 10)
          : null,

      // /projects listing placement
      show_on_project_page: Boolean(item.show_on_project_page),
      project_page_order:
        item.show_on_project_page && item.project_page_order
          ? parseInt(String(item.project_page_order), 10)
          : null,
    });

    for (const item of unitLayouts) {
      const parsedId =
        item.id !== undefined && item.id !== null && item.id !== ''
          ? Number(item.id)
          : null;

      const isExistingLayout =
        parsedId !== null &&
        Number.isInteger(parsedId) &&
        existingLayoutIds.has(parsedId);

      if (isExistingLayout) {
        const { error: updateLayoutError } = await supabaseAdmin
          .from('unit_layout')
          .update(buildLayoutValues(item))
          .eq('project_id', targetProjectId)
          .eq('id', parsedId);

        if (updateLayoutError) {
          throw new Error(
            `Layout update error (${parsedId}): ${updateLayoutError.message}`
          );
        }

        retainedLayoutIds.add(parsedId);
      } else {
        newLayoutRows.push({
          project_id: targetProjectId,
          ...buildLayoutValues(item),
        });
      }
    }

    // Insert layouts that were newly added in the admin form.
    if (newLayoutRows.length > 0) {
      const { error: insertLayoutError } = await supabaseAdmin
        .from('unit_layout')
        .insert(newLayoutRows);

      if (insertLayoutError) {
        throw new Error(`Layout insert error: ${insertLayoutError.message}`);
      }
    }

    // Delete only layouts that existed before but were removed from the admin form.
    const removedLayoutIds = (oldLayouts || [])
      .map((layout: any) => Number(layout.id))
      .filter((id: number) => !retainedLayoutIds.has(id));

    if (removedLayoutIds.length > 0) {
      const { error: deleteLayoutError } = await supabaseAdmin
        .from('unit_layout')
        .delete()
        .eq('project_id', targetProjectId)
        .in('id', removedLayoutIds);

      if (deleteLayoutError) {
        throw new Error(`Layout delete error: ${deleteLayoutError.message}`);
      }
    }

    // Clean up old layout images only after the DB mutations succeeded.
    // This covers both removed layouts and images replaced on an existing layout.
    const newLayoutUrls = unitLayouts
      .map((layout: any) => layout.thumbnail)
      .filter(Boolean);

    for (const oldLayout of oldLayouts || []) {
      if (
        oldLayout.thumbnail &&
        !newLayoutUrls.includes(oldLayout.thumbnail) &&
        oldLayout.thumbnail.includes('/storage/v1/object/public/images/')
      ) {
        const oldStoragePath =
          oldLayout.thumbnail.split('/storage/v1/object/public/images/')[1];

        if (oldStoragePath) {
          const { error: storageCleanupError } = await supabaseAdmin.storage
            .from('images')
            .remove([oldStoragePath]);

          // A storage cleanup problem should not undo an otherwise valid project save.
          if (storageCleanupError) {
            console.warn(
              `Failed to clean up old layout image for layout ${oldLayout.id}:`,
              storageCleanupError
            );
          }
        }
      }
    }

// 6. Amenities
// Preserve existing amenity IDs instead of deleting/recreating every row.
//
// Existing row with a valid ID -> UPDATE
// New form row without an ID     -> INSERT
// Existing DB row removed in UI  -> DELETE
//
// This keeps amenity identity stable and makes visual-editor deletes predictable.
const amenities = Array.isArray(finalData.amenities)
  ? finalData.amenities
  : [];

const {
  data: oldAmenities,
  error: oldAmenitiesError,
} = await supabaseAdmin
  .from('amenities')
  .select('id, thumbnail')
  .eq('project_id', targetProjectId);

if (oldAmenitiesError) {
  throw new Error(
    `Amenity fetch error: ${oldAmenitiesError.message}`
  );
}

const existingAmenityIds = new Set(
  (oldAmenities || []).map(
    (amenity: any) =>
      Number(amenity.id)
  )
);

const retainedAmenityIds =
  new Set<number>();

const savedAmenityData: any[] = [];

const buildAmenityValues = (
  item: any
) => ({
  title:
    typeof item.title === 'string'
      ? item.title.trim()
      : '',

  description:
    item.description || '',

  thumbnail:
    item.thumbnail || '',

  tower:
    typeof item.tower === 'string' &&
    item.tower.trim()
      ? item.tower.trim()
      : null,
});

for (const item of amenities) {
  const parsedId =
    item.id !== undefined &&
    item.id !== null &&
    item.id !== ''
      ? Number(item.id)
      : null;

  const isExistingAmenity =
    parsedId !== null &&
    Number.isInteger(parsedId) &&
    existingAmenityIds.has(parsedId);

  const amenityValues =
    buildAmenityValues(item);

  if (isExistingAmenity) {
    const {
      data: updatedAmenity,
      error: updateAmenityError,
    } = await supabaseAdmin
      .from('amenities')
      .update(amenityValues)
      .eq(
        'project_id',
        targetProjectId
      )
      .eq(
        'id',
        parsedId
      )
      .select(
        'id, project_id, title, description, thumbnail, tower'
      )
      .single();

    if (updateAmenityError) {
      throw new Error(
        `Amenity update error (${parsedId}): ${updateAmenityError.message}`
      );
    }

    retainedAmenityIds.add(
      parsedId
    );

    if (updatedAmenity) {
      savedAmenityData.push(
        updatedAmenity
      );
    }
  } else {
    const {
      data: insertedAmenity,
      error: insertAmenityError,
    } = await supabaseAdmin
      .from('amenities')
      .insert({
        project_id:
          targetProjectId,
        ...amenityValues,
      })
      .select(
        'id, project_id, title, description, thumbnail, tower'
      )
      .single();

    if (insertAmenityError) {
      throw new Error(
        `Amenity insert error: ${insertAmenityError.message}`
      );
    }

    if (insertedAmenity) {
      savedAmenityData.push(
        insertedAmenity
      );
    }
  }
}

// Delete only amenities that existed before but were removed in the editor.
const removedAmenityIds =
  (oldAmenities || [])
    .map(
      (amenity: any) =>
        Number(amenity.id)
    )
    .filter(
      (id: number) =>
        !retainedAmenityIds.has(id)
    );

if (removedAmenityIds.length > 0) {
  const {
    error: deleteAmenityError,
  } = await supabaseAdmin
    .from('amenities')
    .delete()
    .eq(
      'project_id',
      targetProjectId
    )
    .in(
      'id',
      removedAmenityIds
    );

  if (deleteAmenityError) {
    throw new Error(
      `Amenity delete error: ${deleteAmenityError.message}`
    );
  }
}

// Clean up replaced or removed amenity images only after DB mutations succeed.
const newAmenityUrls = amenities
  .map(
    (amenity: any) =>
      amenity.thumbnail
  )
  .filter(Boolean);

for (
  const oldAmenity of
    oldAmenities || []
) {
  if (
    oldAmenity.thumbnail &&
    !newAmenityUrls.includes(
      oldAmenity.thumbnail
    ) &&
    oldAmenity.thumbnail.includes(
      '/storage/v1/object/public/images/'
    )
  ) {
    const oldStoragePath =
      oldAmenity.thumbnail.split(
        '/storage/v1/object/public/images/'
      )[1];

    if (oldStoragePath) {
      const {
        error:
          storageCleanupError,
      } =
        await supabaseAdmin.storage
          .from('images')
          .remove([
            oldStoragePath
          ]);

      if (storageCleanupError) {
        console.warn(
          `Failed to clean up old amenity image for amenity ${oldAmenity.id}:`,
          storageCleanupError
        );
      }
    }
  }
}

        // ==========================================
        // PROJECT TOWERS
        // ==========================================

        if (Array.isArray(finalData.towers)) {
          const cleanTowers = finalData.towers
            .map(
              (
                tower: any,
                index: number
              ) => ({
                id:
                  tower?.id !== null &&
                  tower?.id !== undefined &&
                  !Number.isNaN(
                    Number(tower.id)
                  )
                    ? Number(tower.id)
                    : null,

                name:
                  typeof tower?.name ===
                  'string'
                    ? tower.name.trim()
                    : '',

                sort_order: index + 1,
              })
            )
            .filter(
              (tower: any) =>
                tower.name.length > 0
            );


          // ------------------------------------------
          // SERVER-SIDE DUPLICATE PROTECTION
          // ------------------------------------------

          const normalizedNames =
            cleanTowers.map(
              (tower: any) =>
                tower.name.toLowerCase()
            );

          const hasDuplicate =
            normalizedNames.some(
              (
                name: string,
                index: number
              ) =>
                normalizedNames.indexOf(
                  name
                ) !== index
            );

          if (hasDuplicate) {
            throw new Error(
              'Tower names must be unique within a project.'
            );
          }


          // ------------------------------------------
          // CURRENT DATABASE TOWERS
          // ------------------------------------------

          const {
            data: existingTowers,
            error: existingTowersError,
          } = await supabaseAdmin
            .from('project_towers')
            .select(
              'id, project_id, name, sort_order'
            )
            .eq(
              'project_id',
              targetProjectId
            );

          if (existingTowersError) {
            throw new Error(
              `Tower fetch error: ${existingTowersError.message}`
            );
          }


          const existingTowerMap =
            new Map(
              (existingTowers || []).map(
                (tower: any) => [
                  Number(tower.id),
                  tower,
                ]
              )
            );


          // ------------------------------------------
          // UPDATE / RENAME EXISTING TOWERS
          // ------------------------------------------

          for (const tower of cleanTowers) {
            if (!tower.id) continue;

            const existingTower =
              existingTowerMap.get(
                tower.id
              );

            if (!existingTower) {
              continue;
            }

            const oldName =
              String(
                existingTower.name
              ).trim();

            const newName =
              tower.name.trim();


            // If the tower was renamed,
            // synchronize all existing content.
            if (oldName !== newName) {
              const {
                error:
                  amenityRenameError,
              } = await supabaseAdmin
                .from('amenities')
                .update({
                  tower: newName,
                })
                .eq(
                  'project_id',
                  targetProjectId
                )
                .eq(
                  'tower',
                  oldName
                );

              if (amenityRenameError) {
                throw new Error(
                  `Amenity tower rename failed: ${amenityRenameError.message}`
                );
              }


              const {
                error:
                  layoutRenameError,
              } = await supabaseAdmin
                .from('unit_layout')
                .update({
                  tower_name:
                    newName,
                })
                .eq(
                  'project_id',
                  targetProjectId
                )
                .eq(
                  'tower_name',
                  oldName
                );

              if (layoutRenameError) {
                throw new Error(
                  `Unit layout tower rename failed: ${layoutRenameError.message}`
                );
              }
            }


            // Update the tower registry itself.
            const {
              error: towerUpdateError,
            } = await supabaseAdmin
              .from('project_towers')
              .update({
                name: newName,

                sort_order:
                  tower.sort_order,

                updated_at:
                  new Date()
                    .toISOString(),
              })
              .eq(
                'id',
                tower.id
              )
              .eq(
                'project_id',
                targetProjectId
              );

            if (towerUpdateError) {
              throw new Error(
                `Tower update error: ${towerUpdateError.message}`
              );
            }
          }


          // ------------------------------------------
          // INSERT NEW TOWERS
          // ------------------------------------------

          const newTowers =
            cleanTowers.filter(
              (tower: any) =>
                !tower.id
            );

          if (newTowers.length > 0) {
            const {
              error: towerInsertError,
            } = await supabaseAdmin
              .from('project_towers')
              .upsert(
                newTowers.map(
                  (tower: any) => ({
                    project_id:
                      targetProjectId,

                    name:
                      tower.name,

                    sort_order:
                      tower.sort_order,

                    updated_at:
                      new Date()
                        .toISOString(),
                  })
                ),
                {
                  onConflict:
                    'project_id,name',
                }
              );

            if (towerInsertError) {
              throw new Error(
                `Tower insert error: ${towerInsertError.message}`
              );
            }
          }


          /*
          * IMPORTANT:
          *
          * Do NOT automatically delete missing
          * project_towers here.
          *
          * Tower deletion will be handled by a
          * dedicated safe-delete workflow because
          * amenities and unit layouts may still
          * depend on that tower.
          */
        }

// 7. Map Markers
if (finalData.map_latitude && finalData.map_longitude) {
      await supabaseAdmin.from('parent_marker').upsert(
        {
          project_id: targetProjectId,
          latitude: finalData.map_latitude,
          longitude: finalData.map_longitude,
        },
        { onConflict: 'project_id' }
      );
    }

    const { data: oldMarkers } = await supabaseAdmin
      .from('child_marker_table')
      .select('id')
      .eq('project_id', targetProjectId);

    if (oldMarkers && oldMarkers.length > 0) {
      const oldIds = oldMarkers.map((marker: any) => marker.id);

      await supabaseAdmin
        .from('marker_type_table')
        .delete()
        .in('child_marker_id', oldIds);

      await supabaseAdmin
        .from('child_marker_table')
        .delete()
        .in('id', oldIds);
    }

    const childMarkers = Array.isArray(finalData.child_markers)
      ? finalData.child_markers
      : [];

    if (childMarkers.length > 0) {
      for (const marker of childMarkers) {
        const { data: newMarker, error: markerErr } = await supabaseAdmin
          .from('child_marker_table')
          .insert({
            project_id: targetProjectId,
            interest_name: marker.interest_name || 'Landmark',
            address: marker.address || '',
            phrase: marker.phrase || '',
            distance_km: marker.distance_km || null,
            distance_drive: marker.distance_drive || null,
            distance_walk: marker.distance_walk || null,
            latitude: marker.latitude || null,
            longitude: marker.longitude || null,
            thumbnail: marker.thumbnail,
          })
          .select('id')
          .single();

        if (markerErr) throw markerErr;
        if (!newMarker) throw new Error('Failed to create marker');

        if (marker.marker_icon && marker.marker_type) {
          await supabaseAdmin.from('marker_type_table').insert({
            child_marker_id: newMarker.id,
            icon: marker.marker_icon,
            name: marker.marker_type,
          });
        }
      }
    }

    const {
  data: savedTowerData,
  error: savedTowerFetchError,
} = await supabaseAdmin
  .from('project_towers')
  .select(
    'id, project_id, name, sort_order'
  )
  .eq(
    'project_id',
    targetProjectId
  )
  .order(
    'sort_order',
    {
      ascending: true
    }
  )
  .order(
    'id',
    {
      ascending: true
    }
  );

if (savedTowerFetchError) {
  throw new Error(
    `Tower refresh error: ${savedTowerFetchError.message}`
  );
}

const {
  data: savedLayoutData,
  error: savedLayoutFetchError,
} = await supabaseAdmin
  .from('unit_layout')
  .select('*')
  .eq(
    'project_id',
    targetProjectId
  )
  .order(
    'id',
    {
      ascending: true,
    }
  );

if (savedLayoutFetchError) {
  throw new Error(
    `Layout refresh error: ${savedLayoutFetchError.message}`
  );
}

const {
  data: savedMarkerData,
  error: savedMarkerFetchError,
} = await supabaseAdmin
  .from('child_marker_table')
  .select('*, marker_type_table(*)')
  .eq(
    'project_id',
    targetProjectId
  )
  .order(
    'id',
    {
      ascending: true,
    }
  );

if (savedMarkerFetchError) {
  throw new Error(
    `Marker refresh error: ${savedMarkerFetchError.message}`
  );
}

    return {
  success: true,
  towerData:
    savedTowerData || [],
  amenityData:
    savedAmenityData || [],
  layoutData:
    savedLayoutData || [],
  markerData:
    savedMarkerData || [],
};
  } catch (error: any) {
    console.error('Server Action Failed:', error);
    return { success: false, error: error.message };
  }
}

export async function getProjectTowerUsageAction(
  projectId: number,
  towerId: number
) {
  const session = await getCustomSession();

  if (!session) {
    throw new Error('Unauthorized');
  }

  const {
    data: tower,
    error: towerError,
  } = await supabaseAdmin
    .from('project_towers')
    .select('id, project_id, name, sort_order')
    .eq('id', towerId)
    .eq('project_id', projectId)
    .single();

  if (towerError || !tower) {
    throw new Error(
      towerError?.message ||
        'Tower not found.'
    );
  }

  const [
  amenityResult,
  layoutResult,
  otherTowersResult,
] = await Promise.all([
  supabaseAdmin
    .from('amenities')
    .select('id, tower')
    .eq('project_id', projectId),

  supabaseAdmin
    .from('unit_layout')
    .select('id, tower_name')
    .eq('project_id', projectId),

  supabaseAdmin
    .from('project_towers')
    .select(
      'id, name, sort_order'
    )
    .eq('project_id', projectId)
    .neq('id', towerId)
    .order(
      'sort_order',
      { ascending: true }
    ),
]);

if (amenityResult.error) {
  throw amenityResult.error;
}

if (layoutResult.error) {
  throw layoutResult.error;
}

if (otherTowersResult.error) {
  throw otherTowersResult.error;
}

const normalizedTowerName =
  tower.name
    .trim()
    .toLowerCase();
    
const matchingAmenities =
  (amenityResult.data || [])
    .filter((amenity: any) =>
      String(
        amenity.tower || ''
      )
        .trim()
        .toLowerCase() ===
      normalizedTowerName
    );


    const matchingLayouts =
      (layoutResult.data || [])
        .filter((layout: any) =>
          String(
            layout.tower_name || ''
          )
            .trim()
            .toLowerCase() ===
          normalizedTowerName
        );

    return {
      tower,

      amenityCount:
        matchingAmenities.length,

      layoutCount:
        matchingLayouts.length,

      otherTowers:
        otherTowersResult.data || [],
    };
}

export async function deleteProjectTowerAction({
  projectId,
  towerId,
  amenityTarget,
  layoutTarget,
}: {
  projectId: number;
  towerId: number;

  // null = All Towers / Shared
  amenityTarget:
    | string
    | null;

  // Required when layouts exist.
  layoutTarget:
    | string
    | null;
}) {
  const session =
    await getCustomSession();

  if (!session) {
    throw new Error(
      'Unauthorized'
    );
  }


  const {
    data: tower,
    error: towerError,
  } = await supabaseAdmin
    .from('project_towers')
    .select(
      'id, project_id, name'
    )
    .eq('id', towerId)
    .eq(
      'project_id',
      projectId
    )
    .single();


  if (
    towerError ||
    !tower
  ) {
    throw new Error(
      towerError?.message ||
        'Tower not found.'
    );
  }

// ----------------------------------
// CHECK CURRENT USAGE
// ----------------------------------

const [
  amenityUsage,
  layoutUsage,
] = await Promise.all([
  supabaseAdmin
    .from('amenities')
    .select('id, tower')
    .eq(
      'project_id',
      projectId
    ),

  supabaseAdmin
    .from('unit_layout')
    .select('id, tower_name')
    .eq(
      'project_id',
      projectId
    ),
]);


if (amenityUsage.error) {
  throw amenityUsage.error;
}

if (layoutUsage.error) {
  throw layoutUsage.error;
}


const normalizedTowerName =
  tower.name
    .trim()
    .toLowerCase();


const matchingAmenities =
  (amenityUsage.data || [])
    .filter((amenity: any) =>
      String(
        amenity.tower || ''
      )
        .trim()
        .toLowerCase() ===
      normalizedTowerName
    );


const matchingLayouts =
  (layoutUsage.data || [])
    .filter((layout: any) =>
      String(
        layout.tower_name || ''
      )
        .trim()
        .toLowerCase() ===
      normalizedTowerName
    );


const amenityCount =
  matchingAmenities.length;

const layoutCount =
  matchingLayouts.length;

  // Unit layouts cannot become
  // "shared", so they need another
  // real tower.
  if (
    layoutCount > 0 &&
    !layoutTarget
  ) {
    throw new Error(
      'Choose a replacement tower for the unit layouts before deleting this tower.'
    );
  }


  // Prevent assigning content back
  // to the tower being deleted.
  if (
    amenityTarget ===
      tower.name ||
    layoutTarget ===
      tower.name
  ) {
    throw new Error(
      'Replacement tower must be different from the tower being deleted.'
    );
  }


  // ----------------------------------
  // VALIDATE REPLACEMENT TOWERS
  // ----------------------------------

  const targets = [
    amenityTarget,
    layoutTarget,
  ].filter(
    (
      value
    ): value is string =>
      Boolean(value)
  );


  for (
    const targetName of targets
  ) {
    const {
      data: targetTower,
      error: targetError,
    } = await supabaseAdmin
      .from('project_towers')
      .select('id')
      .eq(
        'project_id',
        projectId
      )
      .eq(
        'name',
        targetName
      )
      .maybeSingle();


    if (
      targetError ||
      !targetTower
    ) {
      throw new Error(
        `Replacement tower "${targetName}" does not exist in this project.`
      );
    }
  }


        // ----------------------------------
        // REASSIGN AMENITIES
        // ----------------------------------

        if (matchingAmenities.length > 0) {
          const amenityIds =
            matchingAmenities.map(
              (amenity: any) =>
                amenity.id
            );

          const {
            error:
              amenityUpdateError,
          } = await supabaseAdmin
            .from('amenities')
            .update({
              tower:
                amenityTarget ||
                null,
            })
            .eq(
              'project_id',
              projectId
            )
            .in(
              'id',
              amenityIds
            );


          if (amenityUpdateError) {
            throw new Error(
              `Amenity reassignment failed: ${amenityUpdateError.message}`
            );
          }
        }

        // ----------------------------------
        // REASSIGN UNIT LAYOUTS
        // ----------------------------------

        if (matchingLayouts.length > 0) {
          const layoutIds =
            matchingLayouts.map(
              (layout: any) =>
                layout.id
            );

          const {
            error:
              layoutUpdateError,
          } = await supabaseAdmin
            .from('unit_layout')
            .update({
              tower_name:
                layoutTarget,
            })
            .eq(
              'project_id',
              projectId
            )
            .in(
              'id',
              layoutIds
            );


          if (layoutUpdateError) {
            throw new Error(
              `Unit layout reassignment failed: ${layoutUpdateError.message}`
            );
          }

          if (layoutTarget) {
            const {
              data: targetLayouts,
              error: targetLayoutsError,
            } = await supabaseAdmin
              .from('unit_layout')
              .select('id, sort_order')
              .eq('project_id', projectId)
              .eq('tower_name', layoutTarget)
              .order('sort_order', {
                ascending: true,
                nullsFirst: false,
              })
              .order('id', {
                ascending: true,
              });

            if (targetLayoutsError) {
              throw new Error(
                `Unit layout reorder fetch failed: ${targetLayoutsError.message}`
              );
            }

            for (
              let index = 0;
              index <
              (targetLayouts || []).length;
              index++
            ) {
              const row =
                targetLayouts![index];

              const {
                error:
                  layoutOrderError,
              } = await supabaseAdmin
                .from('unit_layout')
                .update({
                  sort_order:
                    index + 1,
                })
                .eq('project_id', projectId)
                .eq('id', row.id);

              if (layoutOrderError) {
                throw new Error(
                  `Unit layout reorder failed: ${layoutOrderError.message}`
                );
              }
            }
          }
        }

  // ----------------------------------
  // DELETE REGISTRY ENTRY
  // ----------------------------------

  const {
    error: deleteError,
  } = await supabaseAdmin
    .from('project_towers')
    .delete()
    .eq('id', towerId)
    .eq(
      'project_id',
      projectId
    );


if (deleteError) {
  throw new Error(
    `Tower delete failed: ${deleteError.message}`
  );
}


// ----------------------------------
// RE-SEQUENCE REMAINING TOWERS
// ----------------------------------

const {
  data: remainingTowers,
  error: remainingTowersError,
} = await supabaseAdmin
  .from('project_towers')
  .select(
    'id, project_id, name, sort_order'
  )
  .eq(
    'project_id',
    projectId
  )
  .order(
    'sort_order',
    { ascending: true }
  )
  .order(
    'id',
    { ascending: true }
  );

if (remainingTowersError) {
  throw new Error(
    `Tower refresh failed: ${remainingTowersError.message}`
  );
}


for (
  let index = 0;
  index < (remainingTowers || []).length;
  index++
) {
  const currentTower =
    remainingTowers![index];

  const newOrder =
    index + 1;

  if (
    currentTower.sort_order !==
    newOrder
  ) {
    const {
      error: orderError,
    } = await supabaseAdmin
      .from('project_towers')
      .update({
        sort_order: newOrder,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        currentTower.id
      );

    if (orderError) {
      throw new Error(
        `Tower reorder failed: ${orderError.message}`
      );
    }

    currentTower.sort_order =
      newOrder;
  }
}


return {
  success: true,

  deletedTower:
    tower.name,

  towerData:
    remainingTowers || [],
};
}
/**
 * Fetches all related project data for the Edit Page, bypassing RLS.
 * This prevents hidden (is_active = false) projects from returning empty data.
 */
export async function fetchProjectForEdit(editId: string | number) {
  const session = await getCustomSession();

  if (!session) throw new Error('Unauthorized');

      const [
      projRes,
      extRes,
      layoutRes,
      amenityRes,
      towerRes,
      parentRes,
      markerRes,
      tagRes,
    ] = await Promise.all([
    supabaseAdmin
      .from('project_table')
      .select('*')
      .eq('id', editId)
      .limit(1),

    supabaseAdmin
      .from('extended_description')
      .select('*')
      .eq('project_id', editId)
      .limit(1),

    // select('*') already includes the four new placement columns
    supabaseAdmin
      .from('unit_layout')
      .select('*')
      .eq('project_id', editId)
      .order('id', { ascending: true }),

    supabaseAdmin
      .from('amenities')
      .select('*')
      .eq('project_id', editId),

      supabaseAdmin
      .from('project_towers')
      .select('id, project_id, name, sort_order')
      .eq('project_id', editId)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true }),

    supabaseAdmin
      .from('parent_marker')
      .select('*')
      .eq('project_id', editId)
      .limit(1),

    supabaseAdmin
      .from('child_marker_table')
      .select('*, marker_type_table(*)')
      .eq('project_id', editId),

    supabaseAdmin
      .from('project_tag')
      .select('tags(tag_name)')
      .eq('project_id', editId),
  ]);

  if (projRes.error) throw projRes.error;
  if (extRes.error) throw extRes.error;
  if (layoutRes.error) throw layoutRes.error;
  if (amenityRes.error) throw amenityRes.error;
  if (towerRes.error) throw towerRes.error;
  if (parentRes.error) throw parentRes.error;
  if (markerRes.error) throw markerRes.error;
  if (tagRes.error) throw tagRes.error;

  return {
    projData: projRes.data?.[0] || null,
    extData: extRes.data?.[0] || null,
    layoutData: layoutRes.data || [],
    amenityData: amenityRes.data || [],
    towerData: towerRes.data || [],
    parentData: parentRes.data?.[0] || null,
    markerData: markerRes.data || [],
    tagData: tagRes.data || [],
  };
}
