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
  if (!session) throw new Error("Unauthorized");

  // This grabs ALL projects (bypassing RLS) as long as they aren't soft-deleted
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
      throw new Error("Unauthorized: Please log in.");
    }

    let { targetProjectId, cleanProjectData, finalData } = payload;

    // 2. Base Project Table
    if (targetProjectId) {
      const { error } = await supabaseAdmin.from('project_table').update(cleanProjectData).eq('id', targetProjectId);
      if (error) throw error;
    } else {
      const { data, error } = await supabaseAdmin.from('project_table').insert(cleanProjectData).select('id').single();
      if (error) throw error;
      if (!data) throw new Error("Failed to create project");
      targetProjectId = data.id;
    }

    // 3. Extended Description
    await supabaseAdmin.from('extended_description').upsert({ 
      project_id: targetProjectId, 
      editorial_title: finalData.editorial_title, 
      editorial_long: finalData.editorial_long, 
      editorial_img: finalData.editorial_img,
      editorial_title_color: finalData.editorial_title_color,
      editorial_desc_color: finalData.editorial_desc_color,
      editorial_bg_color: finalData.editorial_bg_color,
      amenities_title: finalData.amenities_title,
      amenities_title_gold: finalData.amenities_title_gold
    }, { onConflict: 'project_id' });

    // 4. Tags
    await supabaseAdmin.from('project_tag').delete().eq('project_id', targetProjectId);
    if (finalData.tags && finalData.tags.length > 0) {
      for (const tagObj of finalData.tags) {
        const tagName = tagObj.tag_name.trim();
        if (!tagName) continue;
        let { data: existingTag } = await supabaseAdmin.from('tags').select('id').ilike('tag_name', tagName).maybeSingle();
        let tagId = existingTag ? existingTag.id : (await supabaseAdmin.from('tags').insert({ tag_name: tagName }).select('id').single()).data?.id;
        if (tagId) await supabaseAdmin.from('project_tag').insert({ project_id: targetProjectId, tag_id: tagId });
      }
    }

    // 5. Unit Layouts (Handle Storage Cleanup server-side for safety)
    const { data: oldLayouts } = await supabaseAdmin.from('unit_layout').select('thumbnail').eq('project_id', targetProjectId);
    const newLayoutUrls = finalData.unit_layouts.map((l: any) => l.thumbnail).filter(Boolean);
    if (oldLayouts) {
      for (const layout of oldLayouts) {
        if (layout.thumbnail && !newLayoutUrls.includes(layout.thumbnail) && layout.thumbnail.includes('/storage/v1/object/public/images/')) {
          const oldStoragePath = layout.thumbnail.split('/storage/v1/object/public/images/')[1];
          await supabaseAdmin.storage.from('images').remove([oldStoragePath]);
        }
      }
    }
    await supabaseAdmin.from('unit_layout').delete().eq('project_id', targetProjectId);
    if (finalData.unit_layouts.length > 0) {
      const cleanedLayouts = finalData.unit_layouts.map((l: any) => {
        const { id, ...rest } = l; 
        return { ...rest, project_id: targetProjectId, min_sqm: l.min_sqm || null, max_sqm: l.max_sqm || null };
      });
      const { error: layoutErr } = await supabaseAdmin.from('unit_layout').insert(cleanedLayouts);
      if (layoutErr) throw layoutErr; 
    }

    // 6. Amenities (Handle Storage Cleanup server-side)
    const { data: oldAmenities } = await supabaseAdmin.from('amenities').select('thumbnail').eq('project_id', targetProjectId);
    const newAmenityUrls = finalData.amenities.map((a: any) => a.thumbnail).filter(Boolean);
    if (oldAmenities) {
      for (const amenity of oldAmenities) {
        if (amenity.thumbnail && !newAmenityUrls.includes(amenity.thumbnail) && amenity.thumbnail.includes('/storage/v1/object/public/images/')) {
          const oldStoragePath = amenity.thumbnail.split('/storage/v1/object/public/images/')[1];
          await supabaseAdmin.storage.from('images').remove([oldStoragePath]);
        }
      }
    }
    await supabaseAdmin.from('amenities').delete().eq('project_id', targetProjectId);
    if (finalData.amenities.length > 0) {
      const cleanedAmenities = finalData.amenities.map((a: any) => {
        const { id, ...rest } = a; 
        return { ...rest, project_id: targetProjectId };
      });
      const { error: amenityErr } = await supabaseAdmin.from('amenities').insert(cleanedAmenities);
      if (amenityErr) throw amenityErr; 
    }

    // 7. Map Markers
    if (finalData.map_latitude && finalData.map_longitude) {
       await supabaseAdmin.from('parent_marker').upsert({ project_id: targetProjectId, latitude: finalData.map_latitude, longitude: finalData.map_longitude }, { onConflict: 'project_id' });
    }

    const { data: oldMarkers } = await supabaseAdmin.from('child_marker_table').select('id').eq('project_id', targetProjectId);
    if (oldMarkers && oldMarkers.length > 0) {
      const oldIds = oldMarkers.map((m: any) => m.id);
      await supabaseAdmin.from('marker_type_table').delete().in('child_marker_id', oldIds);
      await supabaseAdmin.from('child_marker_table').delete().in('id', oldIds);
    }

    if (finalData.child_markers.length > 0) {
      for (const marker of finalData.child_markers) {
        const { data: newMarker, error: markerErr } = await supabaseAdmin.from('child_marker_table').insert({
          project_id: targetProjectId, interest_name: marker.interest_name || "Landmark", 
          address: marker.address || "", phrase: marker.phrase || "", distance_km: marker.distance_km || null,
          distance_drive: marker.distance_drive || null, distance_walk: marker.distance_walk || null,
          latitude: marker.latitude || null, longitude: marker.longitude || null, thumbnail: marker.thumbnail
        }).select('id').single();

        if (markerErr) throw markerErr;
        if (!newMarker) throw new Error("Failed to create marker");

        if (marker.marker_icon && marker.marker_type) {
           await supabaseAdmin.from('marker_type_table').insert({ child_marker_id: newMarker.id, icon: marker.marker_icon, name: marker.marker_type });
        }
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error("Server Action Failed:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches all related project data for the Edit Page, bypassing RLS.
 * This prevents hidden (is_active = false) projects from returning empty data.
 */
export async function fetchProjectForEdit(editId: string | number) {
  const session = await getCustomSession();
  if (!session) throw new Error("Unauthorized");

  // Run all queries simultaneously using the master key (bypasses RLS)
  const [projRes, extRes, layoutRes, amenityRes, parentRes, markerRes, tagRes] = await Promise.all([
    supabaseAdmin.from('project_table').select('*').eq('id', editId).limit(1),
    supabaseAdmin.from('extended_description').select('*').eq('project_id', editId).limit(1),
    supabaseAdmin.from('unit_layout').select('*').eq('project_id', editId),
    supabaseAdmin.from('amenities').select('*').eq('project_id', editId),
    supabaseAdmin.from('parent_marker').select('*').eq('project_id', editId).limit(1),
    supabaseAdmin.from('child_marker_table').select('*, marker_type_table(*)').eq('project_id', editId),
    supabaseAdmin.from('project_tag').select('tags(tag_name)').eq('project_id', editId)
  ]);

  if (projRes.error) throw projRes.error;

  return {
    projData: projRes.data?.[0] || null,
    extData: extRes.data?.[0] || null,
    layoutData: layoutRes.data || [],
    amenityData: amenityRes.data || [],
    parentData: parentRes.data?.[0] || null,
    markerData: markerRes.data || [],
    tagData: tagRes.data || []
  };
}