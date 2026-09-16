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
      tower_name: item.tower_name || 'Tower A - Residential',
      bg_color: item.bg_color || '#051431',
      title: item.title,
      description: item.description || '',
      thumbnail: item.thumbnail || '',
      min_sqm: item.min_sqm ? parseFloat(item.min_sqm) : null,
      max_sqm: item.max_sqm ? parseFloat(item.max_sqm) : null,

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

// 6. Amenities (Handle Storage Cleanup server-side)
const amenities = Array.isArray(finalData.amenities)
  ? finalData.amenities
  : [];

const { data: oldAmenities } = await supabaseAdmin
  .from('amenities')
  .select('thumbnail')
  .eq('project_id', targetProjectId);

const newAmenityUrls = amenities
  .map((amenity: any) => amenity.thumbnail)
  .filter(Boolean);

if (oldAmenities) {
  for (const amenity of oldAmenities) {
    if (
      amenity.thumbnail &&
      !newAmenityUrls.includes(amenity.thumbnail) &&
      amenity.thumbnail.includes('/storage/v1/object/public/images/')
    ) {
      const oldStoragePath =
        amenity.thumbnail.split('/storage/v1/object/public/images/')[1];

      if (oldStoragePath) {
        const { error: deleteError } = await supabaseAdmin.storage
          .from('images')
          .remove([oldStoragePath]);

        if (deleteError) {
          console.warn(
            'Failed to delete old amenity image from storage:',
            deleteError
          );
        }
      }
    }
  }
}

await supabaseAdmin
  .from('amenities')
  .delete()
  .eq('project_id', targetProjectId);

if (amenities.length > 0) {
  const amenityRows = amenities.map((item: any) => ({
    project_id: targetProjectId,
    title: item.title,
    description: item.description || '',
    thumbnail: item.thumbnail || '',
    tower:
      typeof item.tower === 'string' && item.tower.trim()
        ? item.tower.trim()
        : null,
  }));

  const { error: amenityError } = await supabaseAdmin
    .from('amenities')
    .insert(amenityRows);

  if (amenityError) {
    throw new Error(`Amenity error: ${amenityError.message}`);
  }
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

    return { success: true };
  } catch (error: any) {
    console.error('Server Action Failed:', error);
    return { success: false, error: error.message };
  }
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
      .eq('project_id', editId),

    supabaseAdmin
      .from('amenities')
      .select('*')
      .eq('project_id', editId),

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
  if (parentRes.error) throw parentRes.error;
  if (markerRes.error) throw markerRes.error;
  if (tagRes.error) throw tagRes.error;

  return {
    projData: projRes.data?.[0] || null,
    extData: extRes.data?.[0] || null,
    layoutData: layoutRes.data || [],
    amenityData: amenityRes.data || [],
    parentData: parentRes.data?.[0] || null,
    markerData: markerRes.data || [],
    tagData: tagRes.data || [],
  };
}
