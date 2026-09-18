// app/admin/projects/page.tsx
'use client';

import { getCurrentUser } from '@/app/actions/auth';
import { useState, useEffect, Suspense } from 'react';
import {
  saveProjectAction,
  fetchProjectForEdit,
  createBasicProjectAction,
  getProjectTowerUsageAction,
  deleteProjectTowerAction,
} from '@/app/actions/projects';
import {
  createAuditLogAction
} from '@/app/actions/admin_fetchers';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Save, Loader2, PlusCircle, Trash2, CheckCircle2, AlertCircle, GripVertical } from 'lucide-react';
import PreviewSkeleton, {
  ProjectEditorRegion
} from './PreviewSkeleton';
import ImageDropzone from '@/app/components/imagedropzone';
import { createClient } from '@/utils/supabase/client';

const projectSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required").startsWith("/", "Must start with a forward slash (/)"),
  status: z.string().min(1, "Status is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  country: z.string().min(1, "Country is required"), 
  sqm: z.string().min(1, "Total SQM is required"),
  unit_total: z.string().min(1, "Total Units is required"),
 
  image: z.string(), 
  img_awards: z.string(), 
  editorial_title: z.string(),
  editorial_long: z.string(),
  editorial_img: z.string(),
  editorial_title_color: z.string().optional(),
  editorial_desc_color: z.string().optional(),
  editorial_bg_color: z.string().optional(),
  amenities_title: z.string().optional(),
  amenities_title_gold: z.string().optional(),
  tags: z.array(z.object({ tag_name: z.string().min(1, "Tag cannot be empty") })),
      towers: z.array(
      z.object({
        id: z
          .union([
            z.number(),
            z.string()
          ])
          .optional()
          .nullable(),

        name: z
          .string()
          .trim()
          .min(
            1,
            'Tower name is required'
          ),

        sort_order: z
          .union([
            z.number(),
            z.string()
          ])
          .optional()
          .nullable(),
      })
    ),
  unit_layouts: z.array(z.object({
    id: z.union([z.number(), z.string()]).optional().nullable(),
    title: z.string().min(1, "Title required"), 
    tower_name: z.string().min(1, "Tower required"),
    bg_color: z.string().optional(), // Add this
    description: z.string(), 
    min_sqm: z.string().min(1, "Required"), 
    max_sqm: z.string().min(1, "Required"), 
    thumbnail: z.string(),
    show_on_map_card: z.boolean().optional(),
    map_card_order: z.string().optional(),
    show_on_project_page: z.boolean().optional(),
    project_page_order: z.string().optional(),
    sort_order: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
  })),
  amenities: z.array(z.object({
    id: z.union([z.number(), z.string()]).optional().nullable(),
    title: z.string().min(1, "Title required"),
    description: z.string(),
    thumbnail: z.string(),
    tower: z.string().nullable().optional()
  })),
  map_latitude: z.string(),
  map_longitude: z.string(),
  map_icon: z.string().optional(), // NEW: Main project map pin
   map_subtitle: z.string().optional(),
  child_markers: z.array(z.object({
    interest_name: z.string().min(1, "Name required"), address: z.string(), phrase: z.string(), 
    distance_km: z.string().min(1, "Required"), 
    distance_drive: z.string().min(1, "Required"), 
    distance_walk: z.string().min(1, "Required"), 
    latitude: z.string().min(1, "Required"), 
    longitude: z.string().min(1, "Required"), 
   
    thumbnail: z.string(), marker_icon: z.string(), marker_type: z.string() // marker_icon is now a string URL
  })),
});

type ProjectFormData = z.infer<typeof projectSchema>;
const basicProjectSchema = z.object({
  title: z
    .string()
    .min(1, 'Project title is required'),

  slug: z
    .string()
    .min(1, 'URL slug is required')
    .startsWith('/', 'URL slug must start with /'),

  status: z
    .string()
    .min(1, 'Project status is required'),

  address: z
    .string()
    .min(1, 'Street address is required'),

  city: z
    .string()
    .min(1, 'City is required'),

  country: z
    .string()
    .min(1, 'Country is required'),

  sqm: z
    .string()
    .min(1, 'Total SQM is required'),

  unit_total: z
    .string()
    .min(1, 'Total units is required'),
});

type BasicProjectFormData =
  z.infer<typeof basicProjectSchema>;

const BLANK_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

const ColorInputSync = ({ 
  label, 
  fieldName, 
  register, 
  watch, 
  setValue, 
  inputStyles, 
  labelStyles 
}: any) => {
  const currentColor = watch(fieldName);
  const [textValue, setTextValue] = useState(currentColor || '#000000');

  useEffect(() => {
    setTextValue(currentColor || '#000000');
  }, [currentColor]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setTextValue(newVal);
    if (/^#[0-9A-F]{6}$/i.test(newVal)) {
      setValue(fieldName, newVal, { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setTextValue(newVal);
    setValue(fieldName, newVal, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <div>
      <label className={labelStyles}>{label}</label>
      <div className="flex items-center gap-3">

        {/* COLOR SWATCH */}
        <input
          type="color"
          value={currentColor || '#000000'}
          onChange={handleColorPickerChange}
          className="
            h-11
            w-12
            shrink-0
            cursor-pointer
            rounded-xl
            border
            border-gray-200
            bg-white
            p-1
            shadow-sm
          "
        />

        {/* HEX VALUE */}
        <input
          type="text"
          value={textValue}
          onChange={handleTextChange}
          placeholder="#FFFFFF"
          className="
            flex-1
            h-11
            rounded-xl
            border
            border-gray-200
            bg-white
            px-3
            text-sm
            font-mono
            font-medium
            uppercase
            text-brand-blue
            outline-none
            transition-all
            focus:border-brand-gold
            focus:ring-2
            focus:ring-brand-gold/10
          "
        />

        <input
          type="hidden"
          {...register(fieldName)}
        />
      </div>
    </div>
  );
};

function formatTowerToLetter(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const match = trimmed.match(/^tower\s+(\d+)$/i);
  if (match) {
    const letter = String.fromCharCode(64 + parseInt(match[1], 10)); // 1 -> A, 2 -> B, 3 -> C, 4 -> D
    return `Tower ${letter}`;
  }
  return trimmed;
}

function ProjectManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit'); 
  const supabase = createClient();
  
  const [isFetching, setIsFetching] = useState(!!editId); 
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [createError, setCreateError] = useState('');

  const [newTowerName, setNewTowerName] =
  useState('');

  const [towerError, setTowerError] =
    useState('');

    const [
  towerToDelete,
  setTowerToDelete
] = useState<{
  index: number;
  id: number;
  name: string;
} | null>(null);


const [
  towerUsage,
  setTowerUsage
] = useState<{
  amenityCount: number;
  layoutCount: number;

  otherTowers: Array<{
    id: number;
    name: string;
    sort_order:
      | number
      | null;
  }>;
} | null>(null);


const [
  deleteAmenityTarget,
  setDeleteAmenityTarget
] = useState('');


const [
  deleteLayoutTarget,
  setDeleteLayoutTarget
] = useState('');


const [
  isCheckingTowerUsage,
  setIsCheckingTowerUsage
] = useState(false);


const [
  isDeletingTower,
  setIsDeletingTower
] = useState(false);


const [
  towerDeleteError,
  setTowerDeleteError
] = useState('');

  const [
    editingTowerIndex,
    setEditingTowerIndex
  ] =
    useState<number | null>(
      null
    );

  const [
    editingTowerName,
    setEditingTowerName
  ] =
    useState('');

  const [
    towerRenameError,
    setTowerRenameError
  ] =
    useState('');  

  const [
    amenityToRemove,
    setAmenityToRemove
  ] = useState<{
    index: number;
    title: string;
  } | null>(null);

  const [
    layoutToRemove,
    setLayoutToRemove
  ] = useState<{
    index: number;
    title: string;
  } | null>(null);

  const [
    layoutEditorError,
    setLayoutEditorError
  ] = useState('');

  const [
    dragState,
    setDragState
  ] = useState<{
    type:
      | 'tower'
      | 'tower-layout'
      | 'map-card'
      | 'projects-page';
    index: number;
  } | null>(null);

  type EditorSelection =
  | ProjectEditorRegion
  | 'page-settings'
  | null;

const [
  selectedEditorRegion,
  setSelectedEditorRegion
] = useState<EditorSelection>(
  'project-title'
);

const [
  useLegacyEditor,
  setUseLegacyEditor
] = useState(false);
  
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});

  // Helper to remove an item from previews and pendingFiles, shifting higher indices down
  const removeNestedFieldFiles = (fieldPrefix: string, removeIndex: number) => {
    const shiftDictionary = (prevDict: Record<string, any>) => {
      const updated: Record<string, any> = {};

      Object.entries(prevDict).forEach(([key, val]) => {
        // Only target keys matching the field prefix (e.g., "amenities.", "unit_layouts.")
        if (key.startsWith(`${fieldPrefix}.`)) {
          const rest = key.slice(fieldPrefix.length + 1); // e.g., "0.thumbnail"
          const dotPos = rest.indexOf('.');
          const idxStr = dotPos !== -1 ? rest.substring(0, dotPos) : rest;
          const subKey = dotPos !== -1 ? rest.substring(dotPos) : '';
          const idx = parseInt(idxStr, 10);

          if (!isNaN(idx)) {
            if (idx === removeIndex) {
              // Clean up Object URLs to prevent memory leaks
              if (typeof val === 'string' && val.startsWith('blob:')) {
                URL.revokeObjectURL(val);
              }
              return; // Drop the deleted item's preview/file
            }
            if (idx > removeIndex) {
              // Shift the index down by 1
              updated[`${fieldPrefix}.${idx - 1}${subKey}`] = val;
              return;
            }
          }
        }
        // Retain any other unrelated keys unchanged
        updated[key] = val;
      });

      return updated;
    };

    setPreviews(shiftDictionary);
    setPendingFiles(shiftDictionary);
  };

  useEffect(() => {
    return () => Object.values(previews).forEach(url => URL.revokeObjectURL(url));
  }, [previews]);

  const { register, control, watch, handleSubmit, setValue, reset, getValues, formState: {
      errors,
      isSubmitting,
      isDirty
    } } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      title: "", slug: "", status: "", address: "", city: "", country: "Philippines",
      sqm: "", unit_total: "", image: "", img_awards: "", 
      editorial_title: "", editorial_long: "", editorial_img: "",
      editorial_title_color: "#132243", editorial_desc_color: "#4B5563", editorial_bg_color: "transparent",
      amenities_title: "Experience A Fresh", amenities_title_gold: "Way Of Living in this project.",
      tags: [], towers: [], unit_layouts: [], amenities: [], map_latitude: "", map_longitude: "", map_icon: "", child_markers: [], map_subtitle: "Everything you need, strategically positioned right around your sanctuary.", 
     
    }
  });

  const {
  register: registerBasic,
  handleSubmit: handleBasicSubmit,
  formState: {
    errors: basicErrors,
    isSubmitting: isCreatingBasic,
  },
} = useForm<BasicProjectFormData>({
  resolver: zodResolver(basicProjectSchema),

  defaultValues: {
    title: '',
    slug: '',
    status: '',
    address: '',
    city: '',
    country: 'Philippines',
    sqm: '',
    unit_total: '',
  },
});

  const { fields: tagFields, append: appendTag, remove: removeTag } = useFieldArray({ control, name: "tags" });
  const {
    fields: amenityFields,
    append: appendAmenity,
    remove: removeAmenity
  } = useFieldArray({
    control,
    name: "amenities",
    keyName: "fieldKey"
  });
  const {
      fields: towerFields,
      append: appendTower,
      remove: removeTower,
      move: moveTower,
      update: updateTower,
    } = useFieldArray({
      control,
      name: 'towers',
      keyName: 'fieldKey',
    });
  const {
    fields: layoutFields,
    append: appendLayout,
    remove: removeLayout
  } = useFieldArray({
    control,
    name: "unit_layouts",
    keyName: "fieldKey"
  });
  const { fields: markerFields, append: appendMarker, remove: removeMarker } = useFieldArray({ control, name: "child_markers" });

  useEffect(() => {
    const loadData = async () => {
      if (!editId) return; 

      try {
        setIsFetching(true);

        // ✅ USE THE SERVER ACTION TO BYPASS RLS AND FETCH HIDDEN PROJECTS
        const data = await fetchProjectForEdit(editId);

        if (!data.projData) throw new Error("Project not found or blocked.");

        const currentTags = data.tagData.map((pt: any) => ({ tag_name: pt.tags?.tag_name || "" }));

        reset({
          ...data.projData,
          country: data.projData.country || "Philippines",
          sqm: data.projData.sqm ? String(data.projData.sqm) : "",
          unit_total: data.projData.unit_total ? String(data.projData.unit_total) : "",
          map_latitude: data.parentData?.latitude ? String(data.parentData.latitude) : "",
          map_longitude: data.parentData?.longitude ? String(data.parentData.longitude) : "",
          map_icon: data.projData.map_icon || "", map_subtitle: data.extData?.map_subtitle || "Everything you need, strategically positioned right around your sanctuary.",
          
          // ✅ PREVENTS "EXPECTED STRING, RECEIVED NULL" ERRORS
          image: data.projData.image || "",
          img_awards: data.projData.img_awards || "",

          editorial_title: data.extData?.editorial_title || "",
          editorial_long: data.extData?.editorial_long || "",
          editorial_img: data.extData?.editorial_img || "",
          editorial_title_color: data.extData?.editorial_title_color || "#132243",
          editorial_desc_color: data.extData?.editorial_desc_color || "#4B5563",
          editorial_bg_color: data.extData?.editorial_bg_color || "transparent",
          amenities_title: data.extData?.amenities_title || "Experience A Fresh",
          amenities_title_gold: data.extData?.amenities_title_gold || `Way Of Living in ${data.projData.title || ''}.`,
          tags: currentTags,
                  towers: (data.towerData || []).map(
          (tower: any) => ({
            id: tower.id,
            name: tower.name,
            sort_order:
              tower.sort_order ?? null,
          })
        ),
          unit_layouts: data.layoutData.map((l: any) => ({ 
            ...l, 
            tower_name:
            typeof l.tower_name === 'string'
              ? l.tower_name.trim()
              : '',
            bg_color: l.bg_color || "#051431",
            min_sqm: l.min_sqm ? String(l.min_sqm) : "", 
            max_sqm: l.max_sqm ? String(l.max_sqm) : "",
            show_on_map_card: Boolean(l.show_on_map_card),
            map_card_order: l.map_card_order != null ? String(l.map_card_order) : "",
            show_on_project_page: Boolean(l.show_on_project_page),
            project_page_order: l.project_page_order != null ? String(l.project_page_order) : "",
            sort_order: l.sort_order ?? null
          })),

          amenities: data.amenityData.map((a: any) => ({
            ...a,
            tower:
        a.tower
          ? formatTowerToLetter(
              a.tower.trim()
            )
          : null
          })),
          
          child_markers: data.markerData.map((m: any) => ({
            ...m,
            
            distance_km: m.distance_km ? String(m.distance_km) : "",
            distance_drive: m.distance_drive ? String(m.distance_drive) : "",
            distance_walk: m.distance_walk ? String(m.distance_walk) : "",
            latitude: m.latitude ? String(m.latitude) : "",
            longitude: m.longitude ? String(m.longitude) : "",
            marker_icon: m.marker_type_table?.[0]?.icon || "", 
            marker_type: m.marker_type_table?.[0]?.name || "general",
            
          }))
        });

        const existingPreviews: Record<string, string> = {};
        if (data.projData.image) existingPreviews['image'] = data.projData.image;
        if (data.projData.img_awards) existingPreviews['img_awards'] = data.projData.img_awards;
        if (data.projData.map_icon) existingPreviews['map_icon'] = data.projData.map_icon;
        if (data.extData?.editorial_img) existingPreviews['editorial_img'] = data.extData.editorial_img;
        
        data.amenityData.forEach((a: any, i: number) => { if (a.thumbnail) existingPreviews[`amenities.${i}.thumbnail`] = a.thumbnail; });
        data.layoutData.forEach((l: any, i: number) => { if (l.thumbnail) existingPreviews[`unit_layouts.${i}.thumbnail`] = l.thumbnail; });
        data.markerData.forEach((m: any, i: number) => { 
          if (m.thumbnail) existingPreviews[`child_markers.${i}.thumbnail`] = m.thumbnail; 
          if (m.marker_type_table?.[0]?.icon && m.marker_type_table[0].icon.startsWith('http')) {
             existingPreviews[`child_markers.${i}.marker_icon`] = m.marker_type_table[0].icon;
          }
        });
        
        setPreviews(existingPreviews);

      } catch (error: any) {
        console.error("Fetch failed:", error.message);
      } finally {
        setIsFetching(false);
      }
    };

    loadData();
  }, [editId, reset]);

  const formData = watch();

  const availableTowerOptions =
    (formData.towers || [])
      .map((tower) => tower.name?.trim())
      .filter(
        (name): name is string =>
          Boolean(name)
      );

      const validTowerNames =
      new Set(
        availableTowerOptions.map(
          (tower) =>
            tower.toLowerCase()
        )
      );

      const isValidTowerAssignment = (
      tower?: string | null
    ) => {
      if (!tower) return true;

      return availableTowerOptions.some(
        (option) =>
          option.toLowerCase() ===
          tower.trim().toLowerCase()
      );
    };
  
  const hasErrors = Object.keys(errors).length > 0;
  
  const mapCardLayoutCount =
    formData.unit_layouts?.filter((layout) => layout.show_on_map_card).length || 0;

  const projectPageLayoutCount =
    formData.unit_layouts?.filter((layout) => layout.show_on_project_page).length || 0;

const onCreateBasicProject = async (
  data: BasicProjectFormData
) => {
  setCreateError('');

  try {
    const result =
      await createBasicProjectAction(data);

    if (
      !result.success ||
      !result.projectId
    ) {
      throw new Error(
        result.error ||
        'Failed to create project.'
      );
    }

    // Log the creation without blocking the project
    // if the audit log itself encounters a problem.
    try {
      await createAuditLogAction(
        'CREATE',
        'Projects',
        data.title,
        'Created new project. Hidden from website until enabled.'
      );
    } catch (auditError) {
      console.warn(
        'Project created, but audit log failed:',
        auditError
      );
    }

    // Continue directly into the editor.
    router.replace(
      `/admin/projects?edit=${result.projectId}`
    );
  } catch (error: any) {
    setCreateError(
      error?.message ||
      'Failed to create project.'
    );
  }
};

const normalizeTowerAssignments = (
  data: ProjectFormData
): ProjectFormData => {
  const invalidAmenity =
    (data.amenities || []).find((amenity) => {
      const tower = amenity.tower?.trim();
      return (
        Boolean(tower) &&
        !validTowerNames.has(
          String(tower).toLowerCase()
        )
      );
    });

  if (invalidAmenity?.tower) {
    throw new Error(
      `Amenity "${invalidAmenity.title || 'Untitled amenity'}" is assigned to "${invalidAmenity.tower}", which is no longer a valid project tower. Choose a valid tower or All Towers / Shared before saving.`
    );
  }

  const invalidLayout =
    (data.unit_layouts || []).find((layout) => {
      const tower = layout.tower_name?.trim();
      return (
        !tower ||
        !validTowerNames.has(
          tower.toLowerCase()
        )
      );
    });

  if (invalidLayout) {
    throw new Error(
      `Unit layout "${invalidLayout.title || 'Untitled layout'}" must be assigned to a valid project tower before saving.`
    );
  }

  const normalizedLayouts =
    (data.unit_layouts || []).map(
      (layout) => ({
        ...layout,
        tower_name:
          layout.tower_name.trim(),
      })
    );

  const parseOrder = (
    value: unknown
  ) => {
    const parsed = Number(value);

    return Number.isFinite(parsed) &&
      parsed > 0
      ? parsed
      : Number.MAX_SAFE_INTEGER;
  };

  (data.towers || []).forEach(
    (tower) => {
      const indices =
        normalizedLayouts
          .map(
            (
              layout,
              index
            ) => ({
              layout,
              index,
            })
          )
          .filter(
            ({ layout }) =>
              layout.tower_name
                .trim()
                .toLowerCase() ===
              tower.name
                .trim()
                .toLowerCase()
          )
          .sort((a, b) => {
            const orderDiff =
              parseOrder(
                a.layout.sort_order
              ) -
              parseOrder(
                b.layout.sort_order
              );

            if (
              orderDiff !== 0
            ) {
              return orderDiff;
            }

            return (
              a.index - b.index
            );
          })
          .map(
            ({ index }) =>
              index
          );

      indices.forEach(
        (
          layoutIndex,
          position
        ) => {
          normalizedLayouts[
            layoutIndex
          ] = {
            ...normalizedLayouts[
              layoutIndex
            ],
            sort_order:
              position + 1,
          };
        }
      );
    }
  );

  return {
    ...data,

    amenities:
      (data.amenities || []).map((amenity) => {
        const tower = amenity.tower?.trim();

        return {
          ...amenity,
          tower: tower || null,
        };
      }),

    unit_layouts:
      normalizedLayouts,
  };
};

  const onSubmit = async (data: ProjectFormData) => {
    setIsSaving(true);
    try {
      let finalData =
      normalizeTowerAssignments(
        data
      );

      // 1. UPLOAD IMAGES TO BUCKET (Kept on the client)
      for (const [path, file] of Object.entries(pendingFiles)) {
        const fileExt = file.name.split('.').pop();
        const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `projects/${uniqueFileName}`;
        
        const { error: uploadError } = await supabase.storage.from('images').upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('images').getPublicUrl(filePath);
        
        const keys = path.split('.');
        let current: any = finalData;
        for (let i = 0; i < keys.length - 1; i++) { current = current[keys[i]]; }

        // Clean up previously uploaded nested images inline if swapped before save
        const oldImageUrl = current[keys[keys.length - 1]];
        if (oldImageUrl && typeof oldImageUrl === 'string' && oldImageUrl.includes('/storage/v1/object/public/images/')) {
          const oldStoragePath = oldImageUrl.split('/storage/v1/object/public/images/')[1];
          if (oldStoragePath) {
            const { error: deleteError } = await supabase.storage.from('images').remove([oldStoragePath]);
            if (deleteError) console.warn("Failed to delete old image from storage:", deleteError);
          }
        }

        current[keys[keys.length - 1]] = publicUrlData.publicUrl;
      }

      // 2. PREPARE THE CLEAN DATA
      const cleanProjectData = {
        title: finalData.title, slug: finalData.slug, status: finalData.status, 
        address: finalData.address, city: finalData.city, country: finalData.country || "Philippines",
        sqm: finalData.sqm || null, unit_total: finalData.unit_total || null, 
        image: finalData.image, img_awards: finalData.img_awards || null,
        map_icon: finalData.map_icon || null
      };

      let targetProjectId = editId ? parseInt(editId) : null;

      // 3. CALL SERVER ACTION TO BYPASS RLS
      const result = await saveProjectAction({
        targetProjectId,
        cleanProjectData,
        finalData
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      const savedFormData = {
        ...finalData,

        towers:
          result.towerData?.map(
            (tower: any) => ({
              id: tower.id,
              name: tower.name,
              sort_order:
                tower.sort_order,
            })
          ) ??
          finalData.towers ??
          [],

        amenities:
          result.amenityData?.map(
            (amenity: any) => ({
              id: amenity.id,
              title: amenity.title || '',
              description:
                amenity.description || '',
              thumbnail:
                amenity.thumbnail || '',
              tower:
                amenity.tower || null,
            })
          ) ??
          finalData.amenities ??
          [],

        unit_layouts:
          result.layoutData?.map(
            (layout: any) => ({
              id: layout.id,
              title:
                layout.title || '',
              tower_name:
                typeof layout.tower_name ===
                'string'
                  ? layout.tower_name.trim()
                  : '',
              bg_color:
                layout.bg_color ||
                '#051431',
              description:
                layout.description || '',
              min_sqm:
                layout.min_sqm != null
                  ? String(
                      layout.min_sqm
                    )
                  : '',
              max_sqm:
                layout.max_sqm != null
                  ? String(
                      layout.max_sqm
                    )
                  : '',
              thumbnail:
                layout.thumbnail || '',
              show_on_map_card:
                Boolean(
                  layout.show_on_map_card
                ),
              map_card_order:
                layout.map_card_order != null
                  ? String(
                      layout.map_card_order
                    )
                  : '',
              show_on_project_page:
                Boolean(
                  layout.show_on_project_page
                ),
              project_page_order:
                layout.project_page_order != null
                  ? String(
                      layout.project_page_order
                    )
                  : '',
              sort_order:
                layout.sort_order ??
                null,
            })
          ) ??
          finalData.unit_layouts ??
          [],
      };

      reset(savedFormData);

      setPendingFiles({});
      setPreviews({});

      setSuccessMsg(
        editId
          ? 'Changes saved successfully.'
          : 'Project created successfully.'
      );

      setIsSaving(false);

      setTimeout(() => {
        setSuccessMsg('');
      }, 2000);

    } catch (error: any) {
      alert(`Action Failed: ${error.message}`);
      setIsSaving(false);
    }
  };

  const previewData = {
    title: formData.title || 'Project Title',
    city: formData.city || 'City',
    country: formData.country || 'Country',
    sqm: formData.sqm || '0-0 SQM', 
    unit_total: formData.unit_total || '0 Units', 
    image: previews['image'] || formData.image || BLANK_IMAGE,
    img_awards: previews['img_awards'] || formData.img_awards || '',
    project_tag: formData.tags?.map((t) => ({ tags: { tag_name: t.tag_name } })) || [],
    towers: formData.towers || [],
    extended_description: [{
      editorial_title: formData.editorial_title || 'Editorial Headline',
      editorial_long: formData.editorial_long || 'Write your project description here...',
      editorial_img: previews['editorial_img'] || formData.editorial_img || BLANK_IMAGE,
      editorial_title_color: formData.editorial_title_color,
      editorial_desc_color: formData.editorial_desc_color,
      editorial_bg_color: formData.editorial_bg_color,
      amenities_title: formData.amenities_title || 'Experience A Fresh',
      amenities_title_gold: formData.amenities_title_gold || `Way Of Living in ${formData.title || 'this project'}.`
    }],
    amenities: formData.amenities?.length > 0 ? formData.amenities.map((a, i) => ({
      id: a.id ?? i + 1,
      editorIndex: i,
      title: a.title || `Amenity ${i + 1}`,
      description: a.description || 'Description...',
      tower: a.tower || null,
      thumbnail: previews[`amenities.${i}.thumbnail`] || a.thumbnail || BLANK_IMAGE
    })) : [],
    unit_layout: formData.unit_layouts?.length > 0 ? formData.unit_layouts.map((l, i) => ({
    id: l.id ?? i + 1,
    editorIndex: i,
    title: l.title || `Layout ${i + 1}`, 
    tower_name:
    typeof l.tower_name === 'string'
      ? l.tower_name.trim()
      : '',
    bg_color: l.bg_color || "#051431",
    description: l.description || 'Description...', 
    min_sqm: l.min_sqm || '0', 
    max_sqm: l.max_sqm || '0', 
    thumbnail: previews[`unit_layouts.${i}.thumbnail`] || l.thumbnail || BLANK_IMAGE,
    show_on_map_card: l.show_on_map_card || false,
    map_card_order: l.map_card_order || "",
    show_on_project_page: l.show_on_project_page || false,
    project_page_order: l.project_page_order || "",
    sort_order: l.sort_order ?? null
  })) : []
  };

    const handleResetEditorChanges = () => {
    Object.values(previews).forEach((url) => {
      if (
        typeof url === 'string' &&
        url.startsWith('blob:')
      ) {
        URL.revokeObjectURL(url);
      }
    });

    setPreviews({});
    setPendingFiles({});

    reset();
  };

      const handleAddTower = () => {
      const name = newTowerName.trim();

      if (!name) {
        setTowerError(
          'Enter a tower name first.'
        );
        return;
      }

      
      const alreadyExists =
        (formData.towers || []).some(
          (tower) =>
            tower.name
              .trim()
              .toLowerCase() ===
            name.toLowerCase()
        );

      if (alreadyExists) {
        setTowerError(
          'That tower already exists in this project.'
        );
        return;
      }

      appendTower({
        id: null,
        name,
        sort_order:
          towerFields.length + 1,
      });

      setNewTowerName('');
      setTowerError('');
    };

    const handleStartRenameTower = (
  index: number
) => {
  const currentTower =
    formData.towers?.[index];

  if (!currentTower) return;

  setEditingTowerIndex(index);

  setEditingTowerName(
    currentTower.name
  );

  setTowerRenameError('');
};

const handleCancelRenameTower =
  () => {
    setEditingTowerIndex(null);
    setEditingTowerName('');
    setTowerRenameError('');
  };


const handleApplyRenameTower =
  () => {
    if (editingTowerIndex === null) {
      return;
    }

    const name = editingTowerName.trim();
    const currentTower =
      formData.towers?.[editingTowerIndex];
    const oldName = currentTower?.name?.trim();

    if (!name) {
      setTowerRenameError(
        'Tower name cannot be empty.'
      );
      return;
    }

    const duplicate =
      (formData.towers || []).some(
        (tower, index) =>
          index !== editingTowerIndex &&
          tower.name.trim().toLowerCase() ===
            name.toLowerCase()
      );

    if (duplicate) {
      setTowerRenameError(
        'That tower already exists in this project.'
      );
      return;
    }

    setValue(
      `towers.${editingTowerIndex}.name`,
      name,
      {
        shouldDirty: true,
        shouldValidate: true,
      }
    );

    // Keep local Amenity and Unit Layout assignments in sync
    // with the tower rename before the project is saved.
    if (
      oldName &&
      oldName.toLowerCase() !== name.toLowerCase()
    ) {
      (formData.amenities || []).forEach(
        (amenity, index) => {
          if (
            amenity.tower?.trim().toLowerCase() ===
            oldName.toLowerCase()
          ) {
            setValue(
              `amenities.${index}.tower`,
              name,
              {
                shouldDirty: true,
                shouldValidate: true,
              }
            );
          }
        }
      );

      (formData.unit_layouts || []).forEach(
        (layout, index) => {
          if (
            layout.tower_name?.trim().toLowerCase() ===
            oldName.toLowerCase()
          ) {
            setValue(
              `unit_layouts.${index}.tower_name`,
              name,
              {
                shouldDirty: true,
                shouldValidate: true,
              }
            );
          }
        }
      );
    }

    setEditingTowerIndex(null);
    setEditingTowerName('');
    setTowerRenameError('');
  };

    const handleConfirmDeleteTower =
  async () => {

    if (
      !towerToDelete ||
      !towerUsage ||
      !editId
    ) {
      return;
    }


    if (
      towerUsage.layoutCount > 0 &&
      !deleteLayoutTarget
    ) {
      setTowerDeleteError(
        'Choose where the unit layouts should move before deleting this tower.'
      );

      return;
    }


    const amenityTarget =
      towerUsage.amenityCount > 0
        ? deleteAmenityTarget ===
          '__shared__'
          ? null
          : deleteAmenityTarget ||
            null
        : null;


    const layoutTarget =
      towerUsage.layoutCount > 0
        ? deleteLayoutTarget
        : null;


    setIsDeletingTower(true);
    setTowerDeleteError('');


    try {
      const result =
        await deleteProjectTowerAction({
          projectId:
            Number(editId),

          towerId:
            towerToDelete.id,

          amenityTarget,

          layoutTarget,
        });


      /*
       * Update the local editor state
       * so a future Project Save cannot
       * accidentally restore the old
       * tower assignment.
       */

      const current =
        getValues();


      const deletedName =
        towerToDelete.name;


      const nextAmenities =
        current.amenities.map(
          (amenity) => {

            const matches =
              amenity.tower
                ?.trim() ===
              deletedName.trim();

            if (!matches) {
              return amenity;
            }

            return {
              ...amenity,

              tower:
                amenityTarget,
            };
          }
        );


      const nextLayouts =
        current.unit_layouts.map(
          (layout) => {

            const matches =
              layout.tower_name
                ?.trim() ===
              deletedName.trim();

            if (!matches) {
              return layout;
            }

            return {
              ...layout,

              tower_name:
                layoutTarget ||
                layout.tower_name,
            };
          }
        );


      const nextTowers =
        (result.towerData || [])
          .map(
            (tower: any) => ({
              id: tower.id,

              name:
                tower.name,

              sort_order:
                tower.sort_order,
            })
          );

      nextTowers.forEach(
        (tower: any) => {
          const matchingIndices =
            nextLayouts
              .map(
                (
                  layout,
                  index
                ) => ({
                  layout,
                  index,
                })
              )
              .filter(
                ({ layout }) =>
                  normalizeTowerName(
                    layout.tower_name
                  ) ===
                  normalizeTowerName(
                    tower.name
                  )
              )
              .sort((a, b) => {
                const orderDiff =
                  numericOrder(
                    a.layout.sort_order
                  ) -
                  numericOrder(
                    b.layout.sort_order
                  );

                if (
                  orderDiff !== 0
                ) {
                  return orderDiff;
                }

                return (
                  a.index -
                  b.index
                );
              });

          matchingIndices.forEach(
            (
              item,
              position
            ) => {
              nextLayouts[
                item.index
              ] = {
                ...nextLayouts[
                  item.index
                ],
                sort_order:
                  position + 1,
              };
            }
          );
        }
      );


      /*
       * We only allow persisted tower
       * deletion when there are no
       * unrelated unsaved changes,
       * therefore reset() is safe here.
       *
       * It establishes the updated DB
       * state as the new editor baseline.
       */
      reset({
        ...current,

        towers:
          nextTowers,

        amenities:
          nextAmenities,

        unit_layouts:
          nextLayouts,
      });


      setTowerToDelete(null);
      setTowerUsage(null);

      setDeleteAmenityTarget('');
      setDeleteLayoutTarget('');

    } catch (error: any) {

      setTowerDeleteError(
        error.message ||
        'Unable to delete tower.'
      );

    } finally {

      setIsDeletingTower(false);
    }
  };

  const handleRequestDeleteTower =
    async (index: number) => {

      const tower =
        formData.towers?.[index];

      if (!tower) return;


      // A brand-new tower that has not
      // been saved yet can simply be
      // removed locally.
      if (!tower.id) {
        removeTower(index);
        return;
      }


    /*
     * Existing towers are already
     * persisted database entities.
     *
     * Don't combine an immediate
     * destructive action with other
     * unsaved editor changes.
     */
    if (isDirty) {
      setTowerDeleteError(
        'Save or reset your current changes before deleting an existing tower.'
      );
      return;
    }


    if (!editId) return;


    setTowerDeleteError('');
    setIsCheckingTowerUsage(
      true
    );


    try {
      const usage =
        await getProjectTowerUsageAction(
          Number(editId),
          Number(tower.id)
        );


      setTowerToDelete({
        index,
        id: Number(tower.id),
        name: tower.name,
      });


      setTowerUsage({
        amenityCount:
          usage.amenityCount,

        layoutCount:
          usage.layoutCount,

        otherTowers:
          usage.otherTowers || [],
      });


      /*
       * Amenities may safely become
       * shared.
       */
      setDeleteAmenityTarget(
        usage.amenityCount > 0
          ? '__shared__'
          : ''
      );


      /*
       * Unit layouts require an
       * actual replacement tower.
       */
      setDeleteLayoutTarget(
        ''
      );

    } catch (error: any) {

      setTowerDeleteError(
        error.message ||
        'Unable to check tower usage.'
      );

    } finally {

      setIsCheckingTowerUsage(
        false
      );
    }
  };

    const handleCloseTowerDelete =
  () => {
    if (isDeletingTower) {
      return;
    }

    setTowerToDelete(null);
    setTowerUsage(null);

    setDeleteAmenityTarget('');
    setDeleteLayoutTarget('');

    setTowerDeleteError('');
  };

  const selectedAmenityIndex =
  typeof selectedEditorRegion ===
    'string' &&
  selectedEditorRegion.startsWith(
    'amenity:'
  )
    ? Number(
        selectedEditorRegion.split(
          ':'
        )[1]
      )
    : null;


const selectedAmenity =
  selectedAmenityIndex !== null &&
  Number.isInteger(
    selectedAmenityIndex
  )
    ? formData.amenities?.[
        selectedAmenityIndex
      ]
    : null;


const handleAddAmenity = () => {
  const newIndex = amenityFields.length;

  appendAmenity({
    id: null,
    title: '',
    description: '',
    thumbnail: '',
    tower: null,
  });

  setSelectedEditorRegion(
    `amenity:${newIndex}`
  );
};

const handleRequestRemoveAmenity = (
  index: number
) => {
  const amenity =
    formData.amenities?.[index];

  if (!amenity) return;

  setAmenityToRemove({
    index,
    title:
      amenity.title?.trim() ||
      `Amenity ${index + 1}`,
  });
};

const handleCancelRemoveAmenity = () => {
  setAmenityToRemove(null);
};

const handleConfirmRemoveAmenity = () => {
  if (!amenityToRemove) return;

  removeNestedFieldFiles(
    'amenities',
    amenityToRemove.index
  );

  removeAmenity(
    amenityToRemove.index
  );

  setAmenityToRemove(null);
  setSelectedEditorRegion(
    'amenities'
  );
};


const amenityRemoveModal =
  amenityToRemove ? (
    <div
      className="
        fixed inset-0 z-[260]
        flex items-center justify-center
        bg-brand-blue/55
        backdrop-blur-sm
        p-4
      "
      onMouseDown={
        handleCancelRemoveAmenity
      }
    >
      <div
        className="
          w-full max-w-md
          overflow-hidden
          rounded-2xl
          bg-white
          shadow-2xl
        "
        onMouseDown={(e) =>
          e.stopPropagation()
        }
      >
        <div
          className="
            border-b border-gray-100
            px-6 py-5
          "
        >
          <p
            className="
              text-[10px]
              font-bold uppercase
              tracking-widest
              text-red-500
            "
          >
            Remove Amenity
          </p>

          <h3
            className="
              mt-1
              text-xl
              font-semibold
              text-brand-blue
            "
          >
            Remove {amenityToRemove.title}?
          </h3>
        </div>

        <div className="px-6 py-5">
          <p
            className="
              text-sm
              leading-relaxed
              text-gray-500
            "
          >
            This amenity will be removed from
            the project when you save your
            changes. You can still use Reset
            before saving to restore it.
          </p>
        </div>

        <div
          className="
            flex justify-end gap-3
            border-t border-gray-100
            bg-gray-50
            px-6 py-4
          "
        >
          <button
            type="button"
            onClick={
              handleCancelRemoveAmenity
            }
            className="
              rounded-lg
              px-4 py-2.5
              text-xs font-bold
              text-gray-500
              hover:bg-gray-100
            "
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={
              handleConfirmRemoveAmenity
            }
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-lg
              bg-red-600
              px-4 py-2.5
              text-xs font-bold
              text-white
              hover:bg-red-700
            "
          >
            <Trash2 size={14} />
            Remove Amenity
          </button>
        </div>
      </div>
    </div>
  ) : null;


  const selectedLayoutIndex =
    typeof selectedEditorRegion === 'string' &&
    selectedEditorRegion.startsWith('unit-layout:')
      ? Number(
          selectedEditorRegion.split(':')[1]
        )
      : null;

  const selectedLayout =
    selectedLayoutIndex !== null &&
    Number.isInteger(selectedLayoutIndex)
      ? formData.unit_layouts?.[
          selectedLayoutIndex
        ]
      : null;

  const normalizeTowerName = (
    value?: string | null
  ) =>
    String(value || '')
      .trim()
      .toLowerCase();

  const numericOrder = (
    value: unknown
  ) => {
    const parsed = Number(value);

    return Number.isFinite(parsed) &&
      parsed > 0
      ? parsed
      : Number.MAX_SAFE_INTEGER;
  };

  const getOrderedLayoutIndicesForTower = (
    towerName: string
  ) =>
    (formData.unit_layouts || [])
      .map((layout, index) => ({
        layout,
        index,
      }))
      .filter(
        ({ layout }) =>
          normalizeTowerName(
            layout.tower_name
          ) ===
          normalizeTowerName(
            towerName
          )
      )
      .sort((a, b) => {
        const orderDiff =
          numericOrder(
            a.layout.sort_order
          ) -
          numericOrder(
            b.layout.sort_order
          );

        if (orderDiff !== 0) {
          return orderDiff;
        }

        return a.index - b.index;
      })
      .map(({ index }) => index);

  const getOrderedPlacementIndices = (
    type:
      | 'map-card'
      | 'projects-page'
  ) => {
    const enabledField =
      type === 'map-card'
        ? 'show_on_map_card'
        : 'show_on_project_page';

    const orderField =
      type === 'map-card'
        ? 'map_card_order'
        : 'project_page_order';

    return (formData.unit_layouts || [])
      .map((layout, index) => ({
        layout,
        index,
      }))
      .filter(
        ({ layout }) =>
          Boolean(
            layout[
              enabledField
            ]
          )
      )
      .sort((a, b) => {
        const orderDiff =
          numericOrder(
            a.layout[orderField]
          ) -
          numericOrder(
            b.layout[orderField]
          );

        if (orderDiff !== 0) {
          return orderDiff;
        }

        return a.index - b.index;
      })
      .map(({ index }) => index);
  };

  const handleAddLayout = () => {
    if (
      availableTowerOptions.length ===
      0
    ) {
      setLayoutEditorError(
        'Add a project tower in Page Settings before creating a unit layout.'
      );
      setSelectedEditorRegion(
        'unit-layouts'
      );
      return;
    }

    const defaultTower =
      availableTowerOptions[0];

    const existingCount =
      getOrderedLayoutIndicesForTower(
        defaultTower
      ).length;

    const newIndex =
      layoutFields.length;

    appendLayout({
      id: null,
      title: '',
      tower_name:
        defaultTower,
      bg_color: '#051431',
      description: '',
      min_sqm: '',
      max_sqm: '',
      thumbnail: '',
      show_on_map_card: false,
      map_card_order: '',
      show_on_project_page: false,
      project_page_order: '',
      sort_order:
        existingCount + 1,
    });

    setLayoutEditorError('');

    setSelectedEditorRegion(
      `unit-layout:${newIndex}`
    );
  };

  const handleRequestRemoveLayout = (
    index: number
  ) => {
    const layout =
      formData.unit_layouts?.[
        index
      ];

    if (!layout) return;

    setLayoutToRemove({
      index,
      title:
        layout.title?.trim() ||
        `Unit Layout ${index + 1}`,
    });
  };

  const handleCancelRemoveLayout =
    () => {
      setLayoutToRemove(null);
    };

  const handleConfirmRemoveLayout =
    () => {
      if (!layoutToRemove) {
        return;
      }

      removeNestedFieldFiles(
        'unit_layouts',
        layoutToRemove.index
      );

      removeLayout(
        layoutToRemove.index
      );

      setLayoutToRemove(null);
      setSelectedEditorRegion(
        'unit-layouts'
      );
    };

  const handleTowerDrop = (
    targetIndex: number
  ) => {
    if (
      dragState?.type !== 'tower'
    ) {
      return;
    }

    const sourceIndex =
      dragState.index;

    if (
      sourceIndex !== targetIndex
    ) {
      moveTower(
        sourceIndex,
        targetIndex
      );
    }

    setDragState(null);
  };

  const handleTowerLayoutDrop = (
    targetIndex: number
  ) => {
    if (
      dragState?.type !==
      'tower-layout'
    ) {
      return;
    }

    const sourceIndex =
      dragState.index;

    const source =
      formData.unit_layouts?.[
        sourceIndex
      ];

    const target =
      formData.unit_layouts?.[
        targetIndex
      ];

    if (
      !source ||
      !target ||
      normalizeTowerName(
        source.tower_name
      ) !==
        normalizeTowerName(
          target.tower_name
        )
    ) {
      setDragState(null);
      return;
    }

    const ordered =
      getOrderedLayoutIndicesForTower(
        source.tower_name
      );

    const fromPosition =
      ordered.indexOf(
        sourceIndex
      );

    const toPosition =
      ordered.indexOf(
        targetIndex
      );

    if (
      fromPosition === -1 ||
      toPosition === -1
    ) {
      setDragState(null);
      return;
    }

    const next = [
      ...ordered,
    ];

    const [moved] =
      next.splice(
        fromPosition,
        1
      );

    next.splice(
      toPosition,
      0,
      moved
    );

    next.forEach(
      (
        layoutIndex,
        position
      ) => {
        setValue(
          `unit_layouts.${layoutIndex}.sort_order`,
          position + 1,
          {
            shouldDirty: true,
          }
        );
      }
    );

    setDragState(null);
  };

  const handlePlacementDrop = (
    type:
      | 'map-card'
      | 'projects-page',
    targetIndex: number
  ) => {
    if (
      dragState?.type !== type
    ) {
      return;
    }

    const sourceIndex =
      dragState.index;

    const ordered =
      getOrderedPlacementIndices(
        type
      );

    const fromPosition =
      ordered.indexOf(
        sourceIndex
      );

    const toPosition =
      ordered.indexOf(
        targetIndex
      );

    if (
      fromPosition === -1 ||
      toPosition === -1
    ) {
      setDragState(null);
      return;
    }

    const next = [
      ...ordered,
    ];

    const [moved] =
      next.splice(
        fromPosition,
        1
      );

    next.splice(
      toPosition,
      0,
      moved
    );

    const orderField =
      type === 'map-card'
        ? 'map_card_order'
        : 'project_page_order';

    next.forEach(
      (
        layoutIndex,
        position
      ) => {
        setValue(
          `unit_layouts.${layoutIndex}.${orderField}` as any,
          String(position + 1),
          {
            shouldDirty: true,
          }
        );
      }
    );

    setDragState(null);
  };

  const handleLayoutTowerChange = (
    index: number,
    nextTower: string
  ) => {
    const currentLayout =
      formData.unit_layouts?.[
        index
      ];

    if (!currentLayout) {
      return;
    }

    const nextOrder =
      getOrderedLayoutIndicesForTower(
        nextTower
      ).filter(
        (layoutIndex) =>
          layoutIndex !== index
      ).length + 1;

    setValue(
      `unit_layouts.${index}.tower_name`,
      nextTower,
      {
        shouldDirty: true,
        shouldValidate: true,
      }
    );

    setValue(
      `unit_layouts.${index}.sort_order`,
      nextOrder,
      {
        shouldDirty: true,
      }
    );
  };

  const handleLayoutPlacementToggle = (
    index: number,
    type:
      | 'map-card'
      | 'projects-page'
  ) => {
    const layout =
      formData.unit_layouts?.[
        index
      ];

    if (!layout) return;

    const enabledField =
      type === 'map-card'
        ? 'show_on_map_card'
        : 'show_on_project_page';

    const orderField =
      type === 'map-card'
        ? 'map_card_order'
        : 'project_page_order';

    const isEnabled =
      Boolean(
        layout[
          enabledField
        ]
      );

    setValue(
      `unit_layouts.${index}.${enabledField}` as any,
      !isEnabled,
      {
        shouldDirty: true,
        shouldValidate: true,
      }
    );

    if (isEnabled) {
      setValue(
        `unit_layouts.${index}.${orderField}` as any,
        '',
        {
          shouldDirty: true,
        }
      );

      return;
    }

    const nextOrder =
      getOrderedPlacementIndices(
        type
      ).length + 1;

    setValue(
      `unit_layouts.${index}.${orderField}` as any,
      String(nextOrder),
      {
        shouldDirty: true,
      }
    );
  };

  const layoutRemoveModal =
    layoutToRemove ? (
      <div
        className="
          fixed inset-0 z-[260]
          flex items-center justify-center
          bg-brand-blue/55
          backdrop-blur-sm
          p-4
        "
        onMouseDown={
          handleCancelRemoveLayout
        }
      >
        <div
          className="
            w-full max-w-md
            overflow-hidden
            rounded-2xl
            bg-white
            shadow-2xl
          "
          onMouseDown={(e) =>
            e.stopPropagation()
          }
        >
          <div
            className="
              border-b border-gray-100
              px-6 py-5
            "
          >
            <p
              className="
                text-[10px]
                font-bold uppercase
                tracking-widest
                text-red-500
              "
            >
              Remove Unit Layout
            </p>

            <h3
              className="
                mt-1
                text-xl
                font-semibold
                text-brand-blue
              "
            >
              Remove {layoutToRemove.title}?
            </h3>
          </div>

          <div className="px-6 py-5">
            <p
              className="
                text-sm
                leading-relaxed
                text-gray-500
              "
            >
              This unit layout will be removed
              when you save your changes. Reset
              will restore it until then.
            </p>
          </div>

          <div
            className="
              flex justify-end gap-3
              border-t border-gray-100
              bg-gray-50
              px-6 py-4
            "
          >
            <button
              type="button"
              onClick={
                handleCancelRemoveLayout
              }
              className="
                rounded-lg
                px-4 py-2.5
                text-xs font-bold
                text-gray-500
                hover:bg-gray-100
              "
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={
                handleConfirmRemoveLayout
              }
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-lg
                bg-red-600
                px-4 py-2.5
                text-xs font-bold
                text-white
                hover:bg-red-700
              "
            >
              <Trash2 size={14} />
              Remove Layout
            </button>
          </div>
        </div>
      </div>
    ) : null;

  const labelStyles = "text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1 mt-4";
  const inputStyles = "w-full border border-gray-200 rounded-lg p-3 text-sm focus:border-brand-gold outline-none transition-colors bg-gray-50 focus:bg-white";

  if (isFetching) {
    return <div className="flex h-screen w-full items-center justify-center bg-[#E7E7E7]"><Loader2 size={40} className="animate-spin text-brand-blue" /></div>;
  }

  // ==========================================
// NEW PROJECT: BASIC SETUP ONLY
// ==========================================

if (!editId) {
  return ( 
    <div
      className="
        min-h-screen
        bg-[#F7F8FA]
        text-gray-900
        font-sans
        overflow-y-auto
      "
    >
      {/* TOP BAR */}
      <header
        className="
          h-20
          bg-white
          border-b border-gray-200
          flex items-center
          px-6 md:px-10
          sticky top-0
          z-30
        "
      >
        <button
          type="button"
          onClick={() =>
            router.push(
              '/admin/dashboard?section=Projects'
            )
          }
          className="
            flex items-center gap-2
            text-xs
            font-bold
            text-gray-500
            hover:text-brand-blue
            transition-colors
          "
        >
          <ArrowLeft size={16} />
          Back to Projects
        </button>
      </header>


      <main
        className="
          max-w-4xl
          mx-auto
          px-6
          py-10 md:py-14
        "
      >
        {/* PAGE INTRO */}
        <div className="mb-8">
          <p
            className="
              text-[10px]
              font-bold
              uppercase
              tracking-[0.2em]
              text-brand-gold
              mb-3
            "
          >
            Projects / New Project
          </p>

          <h1
            className="
              text-3xl md:text-4xl
              font-serif
              text-brand-blue
              mb-3
            "
          >
            Create a New Project
          </h1>

          <p
            className="
              text-sm
              text-gray-500
              max-w-xl
              leading-relaxed
            "
          >
            Enter the project basics first.
            Website content, images, amenities,
            layouts, and map information can be
            added after the project is created.
          </p>
        </div>


        {/* SAFETY MESSAGE */}
        <div
          className="
            mb-6
            flex items-start gap-3
            rounded-xl
            border border-blue-100
            bg-blue-50/60
            px-4 py-3
          "
        >
          <AlertCircle
            size={17}
            className="
              text-brand-blue
              shrink-0
              mt-0.5
            "
          />

          <div>
            <p
              className="
                text-xs
                font-bold
                text-brand-blue
              "
            >
              New projects start hidden from the website
            </p>

            <p
              className="
                text-xs
                text-gray-500
                mt-1
                leading-relaxed
              "
            >
              You can complete the project content
              before making it visible to website visitors.
            </p>
          </div>
        </div>


        {/* FORM */}
        <form
          onSubmit={
            handleBasicSubmit(
              onCreateBasicProject
            )
          }
          className="
            bg-white
            border border-gray-200
            rounded-2xl
            shadow-sm
            overflow-hidden
          "
        >

          {/* PROJECT IDENTITY */}
          <section className="p-6 md:p-8">
            <div className="mb-6">
              <h2
                className="
                  text-lg
                  font-bold
                  text-brand-blue
                "
              >
                Project Information
              </h2>

              <p
                className="
                  text-xs
                  text-gray-400
                  mt-1
                "
              >
                Basic information used to identify the project.
              </p>
            </div>


            {/* TITLE */}
            <div className="mb-5">
              <label
                className="
                  block
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-widest
                  text-gray-500
                  mb-2
                "
              >
                Project Title
              </label>

              <input
                {...registerBasic('title')}
                placeholder="e.g. City Clou"
                autoFocus
                className="
                  w-full
                  rounded-xl
                  border border-gray-200
                  bg-white
                  px-4 py-3
                  text-sm
                  text-brand-blue
                  outline-none
                  transition-all
                  focus:border-brand-gold
                  focus:ring-2
                  focus:ring-brand-gold/10
                "
              />

              {basicErrors.title && (
                <p className="text-red-500 text-xs mt-1.5">
                  {basicErrors.title.message}
                </p>
              )}
            </div>


            <div
              className="
                grid
                grid-cols-1 md:grid-cols-2
                gap-5
              "
            >
              {/* SLUG */}
              <div>
                <label
                  className="
                    block
                    text-[10px]
                    font-bold
                    uppercase
                    tracking-widest
                    text-gray-500
                    mb-2
                  "
                >
                  URL Slug
                </label>

                <input
                  {...registerBasic('slug')}
                  placeholder="/cityclou"
                  className="
                    w-full
                    rounded-xl
                    border border-gray-200
                    bg-white
                    px-4 py-3
                    text-sm
                    text-brand-blue
                    outline-none
                    transition-all
                    focus:border-brand-gold
                    focus:ring-2
                    focus:ring-brand-gold/10
                  "
                />

                <p className="text-[10px] text-gray-400 mt-1.5">
                  The page address on the public website.
                </p>

                {basicErrors.slug && (
                  <p className="text-red-500 text-xs mt-1">
                    {basicErrors.slug.message}
                  </p>
                )}
              </div>


              {/* STATUS */}
              <div>
                <label
                  className="
                    block
                    text-[10px]
                    font-bold
                    uppercase
                    tracking-widest
                    text-gray-500
                    mb-2
                  "
                >
                  Project Status
                </label>

                <select
                  {...registerBasic('status')}
                  className="
                    w-full
                    rounded-xl
                    border border-gray-200
                    bg-white
                    px-4 py-3
                    text-sm
                    text-brand-blue
                    outline-none
                    cursor-pointer
                    transition-all
                    focus:border-brand-gold
                    focus:ring-2
                    focus:ring-brand-gold/10
                  "
                >
                  <option value="">
                    Select project status
                  </option>

                  <option value="Pre-Selling">
                    Pre-Selling
                  </option>

                  <option value="Ready for Occupancy">
                    Ready for Occupancy
                  </option>
                </select>

                {basicErrors.status && (
                  <p className="text-red-500 text-xs mt-1.5">
                    {basicErrors.status.message}
                  </p>
                )}
              </div>
            </div>
          </section>


          <div className="border-t border-gray-100" />


          {/* LOCATION */}
          <section className="p-6 md:p-8">
            <div className="mb-6">
              <h2
                className="
                  text-lg
                  font-bold
                  text-brand-blue
                "
              >
                Location & Scale
              </h2>

              <p
                className="
                  text-xs
                  text-gray-400
                  mt-1
                "
              >
                Basic property location and project size.
              </p>
            </div>


            {/* ADDRESS */}
            <div className="mb-5">
              <label
                className="
                  block
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-widest
                  text-gray-500
                  mb-2
                "
              >
                Street Address
              </label>

              <input
                {...registerBasic('address')}
                placeholder="Enter street address"
                className="
                  w-full
                  rounded-xl
                  border border-gray-200
                  bg-white
                  px-4 py-3
                  text-sm
                  text-brand-blue
                  outline-none
                  transition-all
                  focus:border-brand-gold
                  focus:ring-2
                  focus:ring-brand-gold/10
                "
              />

              {basicErrors.address && (
                <p className="text-red-500 text-xs mt-1.5">
                  {basicErrors.address.message}
                </p>
              )}
            </div>


            <div
              className="
                grid
                grid-cols-1 md:grid-cols-2
                gap-5 mb-5
              "
            >
              {/* CITY */}
              <div>
                <label
                  className="
                    block
                    text-[10px]
                    font-bold
                    uppercase
                    tracking-widest
                    text-gray-500
                    mb-2
                  "
                >
                  City
                </label>

                <input
                  {...registerBasic('city')}
                  placeholder="e.g. Cebu City"
                  className="
                    w-full
                    rounded-xl
                    border border-gray-200
                    bg-white
                    px-4 py-3
                    text-sm
                    text-brand-blue
                    outline-none
                    transition-all
                    focus:border-brand-gold
                    focus:ring-2
                    focus:ring-brand-gold/10
                  "
                />

                {basicErrors.city && (
                  <p className="text-red-500 text-xs mt-1.5">
                    {basicErrors.city.message}
                  </p>
                )}
              </div>


              {/* COUNTRY */}
              <div>
                <label
                  className="
                    block
                    text-[10px]
                    font-bold
                    uppercase
                    tracking-widest
                    text-gray-500
                    mb-2
                  "
                >
                  Country
                </label>

                <input
                  {...registerBasic('country')}
                  className="
                    w-full
                    rounded-xl
                    border border-gray-200
                    bg-white
                    px-4 py-3
                    text-sm
                    text-brand-blue
                    outline-none
                    transition-all
                    focus:border-brand-gold
                    focus:ring-2
                    focus:ring-brand-gold/10
                  "
                />

                {basicErrors.country && (
                  <p className="text-red-500 text-xs mt-1.5">
                    {basicErrors.country.message}
                  </p>
                )}
              </div>
            </div>


            <div
              className="
                grid
                grid-cols-1 md:grid-cols-2
                gap-5
              "
            >
              {/* SQM */}
              <div>
                <label
                  className="
                    block
                    text-[10px]
                    font-bold
                    uppercase
                    tracking-widest
                    text-gray-500
                    mb-2
                  "
                >
                  Total SQM
                </label>

                <input
                  {...registerBasic('sqm')}
                  placeholder="e.g. 5280"
                  inputMode="decimal"
                  className="
                    w-full
                    rounded-xl
                    border border-gray-200
                    bg-white
                    px-4 py-3
                    text-sm
                    text-brand-blue
                    outline-none
                    transition-all
                    focus:border-brand-gold
                    focus:ring-2
                    focus:ring-brand-gold/10
                  "
                />

                {basicErrors.sqm && (
                  <p className="text-red-500 text-xs mt-1.5">
                    {basicErrors.sqm.message}
                  </p>
                )}
              </div>


              {/* UNITS */}
              <div>
                <label
                  className="
                    block
                    text-[10px]
                    font-bold
                    uppercase
                    tracking-widest
                    text-gray-500
                    mb-2
                  "
                >
                  Total Units
                </label>

                <input
                  {...registerBasic('unit_total')}
                  placeholder="e.g. 1622"
                  inputMode="numeric"
                  className="
                    w-full
                    rounded-xl
                    border border-gray-200
                    bg-white
                    px-4 py-3
                    text-sm
                    text-brand-blue
                    outline-none
                    transition-all
                    focus:border-brand-gold
                    focus:ring-2
                    focus:ring-brand-gold/10
                  "
                />

                {basicErrors.unit_total && (
                  <p className="text-red-500 text-xs mt-1.5">
                    {basicErrors.unit_total.message}
                  </p>
                )}
              </div>
            </div>
          </section>


          {/* SERVER ERROR */}
          {createError && (
            <div className="px-6 md:px-8 pb-5">
              <div
                className="
                  flex items-start gap-3
                  rounded-xl
                  border border-red-200
                  bg-red-50
                  px-4 py-3
                  text-sm
                  text-red-600
                "
              >
                <AlertCircle
                  size={17}
                  className="shrink-0 mt-0.5"
                />

                {createError}
              </div>
            </div>
          )}


          {/* ACTIONS */}
          <footer
            className="
              flex
              flex-col-reverse sm:flex-row
              sm:items-center
              sm:justify-between
              gap-3
              px-6 md:px-8
              py-5
              bg-gray-50/70
              border-t border-gray-100
            "
          >
            <button
              type="button"
              onClick={() =>
                router.push(
                  '/admin/dashboard?section=Projects'
                )
              }
              className="
                px-4 py-2.5
                text-xs
                font-bold
                text-gray-500
                hover:text-brand-blue
                transition-colors
              "
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isCreatingBasic}
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                min-w-[210px]
                rounded-xl
                bg-brand-blue
                px-5 py-3
                text-xs
                font-bold
                text-white
                uppercase
                tracking-wider
                shadow-md
                hover:bg-brand-blue/90
                transition-colors
                disabled:opacity-60
                disabled:cursor-not-allowed
              "
            >
              {isCreatingBasic ? (
                <>
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                  Creating...
                </>
              ) : (
                <>
                  <PlusCircle size={16} />
                  Create Project & Continue
                </>
              )}
            </button>
          </footer>

        </form>
      </main>
    </div>
  );
}

// ==========================================
// VISUAL PROJECT EDITOR
// ==========================================

if (
  editId &&
  !useLegacyEditor
) {
  return (
    <div
      className="
        h-screen
        w-full
        flex
        flex-col
        overflow-hidden
        bg-[#0B1220]
        font-sans
      "
    >
      {amenityRemoveModal}
      {layoutRemoveModal}

      {/* SUCCESS TOAST */}
      {successMsg && (
        <div
          className="
            fixed
            top-24
            left-1/2
            -translate-x-1/2
            z-[100]
            flex
            items-center
            gap-2
            rounded-xl
            border
            border-green-200
            bg-white
            px-4 py-3
            shadow-xl
          "
        >
          <CheckCircle2
            size={17}
            className="text-green-500"
          />

          <span
            className="
              text-xs
              font-bold
              text-brand-blue
            "
          >
            {successMsg}
          </span>
        </div>
      )}


      {/* EDITOR TOP BAR */}
      <header
        className="
          h-20
          shrink-0
          bg-white
          border-b
          border-gray-200
          flex
          items-center
          justify-between
          gap-6
          px-6
          z-40
        "
      >

        {/* LEFT */}
        <div
          className="
            flex
            items-center
            gap-4
            min-w-0
          "
        >
          <button
            type="button"
            onClick={() =>
              router.push(
                '/admin/dashboard?section=Projects'
              )
            }
            className="
              p-2
              rounded-lg
              text-gray-400
              hover:text-brand-blue
              hover:bg-gray-100
              transition-colors
              shrink-0
            "
            title="Back to Projects"
          >
            <ArrowLeft size={18} />
          </button>

          <div
            className="
              min-w-0
            "
          >
            <div
              className="
                flex
                items-center
                gap-2
                text-[10px]
                font-bold
                uppercase
                tracking-widest
                text-gray-400
                mb-1
              "
            >
              <span>Projects</span>
              <span>/</span>
              <span
                className="
                  text-brand-blue
                  truncate
                "
              >
                {formData.title ||
                  'Project'}
              </span>
            </div>

            <h1
              className="
                text-lg
                font-bold
                text-brand-blue
                truncate
              "
            >
              Edit Project
            </h1>
          </div>
        </div>


        {/* RIGHT */}
        <div
          className="
            flex
            items-center
            gap-3
            shrink-0
          "
        >

          {/* DESKTOP PREVIEW */}
          <span
            className="
              hidden xl:inline-flex
              items-center
              rounded-full
              bg-gray-100
              px-3 py-1.5
              text-[10px]
              font-bold
              uppercase
              tracking-wider
              text-gray-500
            "
          >
            Desktop Preview
          </span>

          {/* PAGE SETTINGS */}
          <button
            type="button"
            onClick={() =>
              setSelectedEditorRegion('page-settings')
            }
            className={`
              px-3 py-2.5
              rounded-lg
              border
              text-xs
              font-bold
              transition-colors

              ${
                selectedEditorRegion === 'page-settings'
                  ? 'border-brand-blue bg-brand-blue/5 text-brand-blue'
                  : 'border-gray-200 text-gray-500 hover:text-brand-blue'
              }
            `}
          >
            Page Settings
          </button>

          {/* DIVIDER */}
          <div className="hidden lg:block h-6 w-px bg-gray-200 mx-1" />

          {/* CHANGE STATUS */}
          {isDirty && (
            <span
              className="
                hidden lg:inline-flex
                items-center
                gap-1.5
                text-xs
                font-medium
                text-amber-600
                whitespace-nowrap
              "
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Unsaved changes
            </span>
          )}
          
          {/* RESET */}
          <button
            type="button"
            onClick={handleResetEditorChanges}
            disabled={
              !isDirty ||
              isSaving ||
              isSubmitting
            }
            className="
              px-3 py-2.5
              rounded-lg
              text-xs
              font-bold
              text-gray-500
              hover:bg-gray-100
              disabled:opacity-30
              disabled:cursor-not-allowed
              transition-colors
            "
          >
            Reset
          </button>

          {/* SAVE */}
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={
              !isDirty ||
              isSaving ||
              isSubmitting
            }
            className="
              min-w-[130px]
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-lg
              bg-brand-blue
              px-4 py-2.5
              text-xs
              font-bold
              text-white
              hover:bg-brand-blue/90
              disabled:opacity-40
              disabled:cursor-not-allowed
              transition-colors
            "
          >
            {(isSaving || isSubmitting) ? (
              <Loader2
                size={15}
                className="animate-spin"
              />
            ) : (
              <Save size={15} />
            )}

            Save Changes
          </button>

        </div>
      </header>


      {/* EDITOR BODY */}
      <div
        className="
          flex
          flex-1
          min-h-0
          overflow-hidden
        "
      >

        {/* WEBSITE CANVAS */}
        <div
          id="preview-scroller"
          className="
            flex-1
            min-w-0
            overflow-y-auto
            relative
            scroll-smooth
            bg-black
            custom-scrollbar
          "
        >
          <PreviewSkeleton
            data={previewData}
            editorMode
            selectedRegion={
              selectedEditorRegion ===
              'page-settings'
                ? null
                : selectedEditorRegion
            }
            onSelectRegion={
              setSelectedEditorRegion
            }
            onAddAmenity={
              handleAddAmenity
            }
            onAddLayout={
              handleAddLayout
            }
          />
        </div>


        {/* INSPECTOR */}
        <aside
          className="
            w-[380px]
            xl:w-[420px]
            shrink-0
            bg-white
            border-l
            border-gray-200
            shadow-2xl
            flex
            flex-col
            z-30
          "
        >

          {/* INSPECTOR HEADER */}
          <div
            className="
              px-6 py-5
              border-b
              border-gray-100
            "
          >
            <p
              className="
                text-[10px]
                uppercase
                tracking-widest
                font-bold
                text-brand-gold
                mb-1
              "
            >
              Selected Content
            </p>

            <h2
              className="
                text-xl
                font-serif
                text-brand-blue
              "
            >
              {selectedEditorRegion === 'hero-image'
              ? 'Hero Image'
              : selectedEditorRegion === 'project-title'
              ? 'Project Title'
              : selectedEditorRegion === 'location'
              ? 'Location'
              : selectedEditorRegion === 'awards'
              ? 'Awards Badge'
              : selectedEditorRegion === 'tags'
              ? 'Tags & Stats'
              : selectedEditorRegion === 'editorial'
              ? 'Editorial Section'
              : selectedEditorRegion ===
                'amenities'
              ? 'Amenities Section'
              : selectedEditorRegion?.startsWith(
                  'amenity:'
                )
              ? selectedAmenity?.title ||
                'Amenity'
              : selectedEditorRegion ===
                'unit-layouts'
              ? 'Unit Layouts'
              : selectedEditorRegion?.startsWith(
                  'unit-layout:'
                )
              ? selectedLayout?.title ||
                'Unit Layout'
              : selectedEditorRegion === 'page-settings'
              ? 'Page Settings'
              : 'Select Content'}
            </h2>

            <p
              className="
                text-xs
                text-gray-400
                mt-2
                leading-relaxed
              "
            >
              Click editable content in the
              preview to change it.
            </p>
          </div>


          {/* INSPECTOR CONTENT */}
          <div
            className="
              flex-1
              overflow-y-auto
              p-6
              custom-scrollbar
            "
          >

            {/* PROJECT TITLE */}
            {selectedEditorRegion ===
              'project-title' && (
              <div>
                <label
                  className="
                    block
                    text-[10px]
                    font-bold
                    uppercase
                    tracking-widest
                    text-gray-500
                    mb-2
                  "
                >
                  Project Title
                </label>

                <input
                  {...register('title')}
                  className="
                    w-full
                    border
                    border-gray-200
                    rounded-xl
                    px-4 py-3
                    text-sm
                    text-brand-blue
                    outline-none
                    focus:border-brand-gold
                    focus:ring-2
                    focus:ring-brand-gold/10
                  "
                />

                {errors.title && (
                  <p
                    className="
                      text-xs
                      text-red-500
                      mt-1.5
                    "
                  >
                    {errors.title.message}
                  </p>
                )}
              </div>
            )}


            {/* HERO IMAGE */}
            {selectedEditorRegion ===
              'hero-image' && (
              <div>
                <ImageDropzone
                  fieldPath="image"
                  label="Main Hero Image"
                  height="h-52"
                  watch={watch}
                  setValue={setValue}
                  errors={errors}
                  setPendingFiles={
                    setPendingFiles
                  }
                  setPreviews={
                    setPreviews
                  }
                  previews={previews}
                />

                <p
                  className="
                    text-[10px]
                    text-gray-400
                    leading-relaxed
                    mt-3
                  "
                >
                  This image fills the main
                  project hero area. Use a
                  high-resolution landscape
                  image.
                </p>
              </div>
            )}


            {/* LOCATION */}
            {selectedEditorRegion ===
              'location' && (
              <div className="space-y-4">

                <div>
                  <label
                    className="
                      block
                      text-[10px]
                      font-bold
                      uppercase
                      tracking-widest
                      text-gray-500
                      mb-2
                    "
                  >
                    City
                  </label>

                  <input
                    {...register('city')}
                    className="
                      w-full
                      border
                      border-gray-200
                      rounded-xl
                      px-4 py-3
                      text-sm
                      text-brand-blue
                      outline-none
                      focus:border-brand-gold
                    "
                  />
                </div>


                <div>
                  <label
                    className="
                      block
                      text-[10px]
                      font-bold
                      uppercase
                      tracking-widest
                      text-gray-500
                      mb-2
                    "
                  >
                    Country
                  </label>

                  <input
                    {...register(
                      'country'
                    )}
                    className="
                      w-full
                      border
                      border-gray-200
                      rounded-xl
                      px-4 py-3
                      text-sm
                      text-brand-blue
                      outline-none
                      focus:border-brand-gold
                    "
                  />
                </div>


                <div>
                  <label
                    className="
                      block
                      text-[10px]
                      font-bold
                      uppercase
                      tracking-widest
                      text-gray-500
                      mb-2
                    "
                  >
                    Street Address
                  </label>

                  <input
                    {...register(
                      'address'
                    )}
                    className="
                      w-full
                      border
                      border-gray-200
                      rounded-xl
                      px-4 py-3
                      text-sm
                      text-brand-blue
                      outline-none
                      focus:border-brand-gold
                    "
                  />
                </div>

              </div>
            )}


            {/* AWARDS */}
            {selectedEditorRegion ===
              'awards' && (
              <div>
                <ImageDropzone
                  fieldPath="img_awards"
                  label="Awards Badge"
                  height="h-52"
                  watch={watch}
                  setValue={setValue}
                  errors={errors}
                  setPendingFiles={
                    setPendingFiles
                  }
                  setPreviews={
                    setPreviews
                  }
                  previews={previews}
                />

                <p
                  className="
                    text-[10px]
                    text-gray-400
                    mt-3
                  "
                >
                  Optional. Remove the image
                  if this project does not
                  have an award badge.
                </p>
              </div>
            )}


            {/* TAGS AND STATS */}
            {selectedEditorRegion ===
              'tags' && (
              <div>

                <div
                  className="
                    flex
                    items-center
                    justify-between
                    mb-4
                  "
                >
                  <p
                    className="
                      text-xs
                      font-bold
                      text-brand-blue
                    "
                  >
                    Project Tags
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      appendTag({
                        tag_name: ''
                      })
                    }
                    className="
                      text-[10px]
                      font-bold
                      uppercase
                      text-brand-blue
                      hover:text-brand-gold
                    "
                  >
                    + Add Tag
                  </button>
                </div>


                <div
                  className="
                    space-y-3
                  "
                >
                  {tagFields.map(
                    (field, index) => (
                      <div
                        key={field.id}
                        className="
                          flex
                          items-center
                          gap-2
                        "
                      >
                        <input
                          {...register(
                            `tags.${index}.tag_name`
                          )}
                          placeholder="Tag name"
                          className="
                            flex-1
                            border
                            border-gray-200
                            rounded-xl
                            px-3 py-2.5
                            text-sm
                            text-brand-blue
                            outline-none
                            focus:border-brand-gold
                          "
                        />

                        <button
                          type="button"
                          onClick={() =>
                            removeTag(
                              index
                            )
                          }
                          className="
                            p-2
                            text-gray-300
                            hover:text-red-500
                          "
                        >
                          <Trash2
                            size={15}
                          />
                        </button>
                      </div>
                    )
                  )}
                </div>


                <div
                  className="
                    border-t
                    border-gray-100
                    mt-6 pt-6
                    grid
                    grid-cols-2
                    gap-4
                  "
                >
                  <div>
                    <label
                      className="
                        block
                        text-[10px]
                        font-bold
                        uppercase
                        tracking-widest
                        text-gray-500
                        mb-2
                      "
                    >
                      Total SQM
                    </label>

                    <input
                      {...register('sqm')}
                      className="
                        w-full
                        border
                        border-gray-200
                        rounded-xl
                        px-3 py-2.5
                        text-sm
                        text-brand-blue
                        outline-none
                        focus:border-brand-gold
                      "
                    />
                  </div>


                  <div>
                    <label
                      className="
                        block
                        text-[10px]
                        font-bold
                        uppercase
                        tracking-widest
                        text-gray-500
                        mb-2
                      "
                    >
                      Total Units
                    </label>

                    <input
                      {...register(
                        'unit_total'
                      )}
                      className="
                        w-full
                        border
                        border-gray-200
                        rounded-xl
                        px-3 py-2.5
                        text-sm
                        text-brand-blue
                        outline-none
                        focus:border-brand-gold
                      "
                    />
                  </div>
                </div>

              </div>
            )}

            {/* EDITORIAL */}
            {selectedEditorRegion ===
              'editorial' && (
              <div className="space-y-6">

                {/* IMAGE */}
                <div>
                  <ImageDropzone
                    fieldPath="editorial_img"
                    label="Editorial Image"
                    height="h-52"
                    watch={watch}
                    setValue={setValue}
                    errors={errors}
                    setPendingFiles={
                      setPendingFiles
                    }
                    setPreviews={
                      setPreviews
                    }
                    previews={previews}
                  />

                  <p
                    className="
                      mt-2
                      text-[10px]
                      leading-relaxed
                      text-gray-400
                    "
                  >
                    This image appears beside the
                    editorial headline and description.
                  </p>
                </div>


                <div
                  className="
                    border-t
                    border-gray-100
                    pt-6
                  "
                >
                  {/* HEADLINE */}
                  <label
                    className="
                      block
                      text-[10px]
                      font-bold
                      uppercase
                      tracking-widest
                      text-gray-500
                      mb-2
                    "
                  >
                    Headline
                  </label>

                  <textarea
                    {...register(
                      'editorial_title'
                    )}
                    rows={3}
                    placeholder="Editorial headline"
                    className="
                      w-full
                      resize-none
                      rounded-xl
                      border
                      border-gray-200
                      px-4 py-3
                      text-sm
                      text-brand-blue
                      outline-none
                      transition-all
                      focus:border-brand-gold
                      focus:ring-2
                      focus:ring-brand-gold/10
                    "
                  />

                  {errors.editorial_title && (
                    <p
                      className="
                        mt-1.5
                        text-xs
                        text-red-500
                      "
                    >
                      {
                        errors.editorial_title
                          .message
                      }
                    </p>
                  )}
                </div>


                {/* DESCRIPTION */}
                <div>
                  <label
                    className="
                      block
                      text-[10px]
                      font-bold
                      uppercase
                      tracking-widest
                      text-gray-500
                      mb-2
                    "
                  >
                    Description
                  </label>

                  <textarea
                    {...register(
                      'editorial_long'
                    )}
                    rows={8}
                    placeholder="Project description"
                    className="
                      w-full
                      resize-y
                      rounded-xl
                      border
                      border-gray-200
                      px-4 py-3
                      text-sm
                      leading-relaxed
                      text-brand-blue
                      outline-none
                      transition-all
                      focus:border-brand-gold
                      focus:ring-2
                      focus:ring-brand-gold/10
                    "
                  />
                </div>


                {/* COLORS */}
                <div
                  className="
                    border-t
                    border-gray-100
                    pt-6
                  "
                >
                  <div className="mb-4">
                    <p
                      className="
                        text-xs
                        font-bold
                        text-brand-blue
                      "
                    >
                      Appearance
                    </p>

                    <p
                      className="
                        mt-1
                        text-[10px]
                        leading-relaxed
                        text-gray-400
                      "
                    >
                      Adjust the colors used by this
                      editorial section.
                    </p>
                  </div>


                  <div
                    className="
                      grid
                      grid-cols-1
                      gap-4
                    "
                  >
                    <ColorInputSync
                      label="Headline Color"
                      fieldName="editorial_title_color"
                      register={register}
                      watch={watch}
                      setValue={setValue}
                      inputStyles={inputStyles}
                      labelStyles={labelStyles}
                    />

                    <ColorInputSync
                      label="Text Color"
                      fieldName="editorial_desc_color"
                      register={register}
                      watch={watch}
                      setValue={setValue}
                      inputStyles={inputStyles}
                      labelStyles={labelStyles}
                    />

                    <ColorInputSync
                      label="Background Color"
                      fieldName="editorial_bg_color"
                      register={register}
                      watch={watch}
                      setValue={setValue}
                      inputStyles={inputStyles}
                      labelStyles={labelStyles}
                    />
                  </div>
                </div>

              </div>
            )}

            {/* AMENITIES SECTION */}
            {selectedEditorRegion ===
              'amenities' && (
              <div className="space-y-6">

                <div>
                  <p
                    className="
                      text-xs
                      font-bold
                      text-brand-blue
                    "
                  >
                    Section Headline
                  </p>

                  <p
                    className="
                      mt-1
                      text-[10px]
                      leading-relaxed
                      text-gray-400
                    "
                  >
                    Edit the heading displayed
                    above the amenities carousel.
                  </p>
                </div>


                {/* WHITE HEADLINE */}
                <div>
                  <label
                    className="
                      block
                      text-[10px]
                      font-bold
                      uppercase
                      tracking-widest
                      text-gray-500
                      mb-2
                    "
                  >
                    Headline
                  </label>

                  <input
                    {...register(
                      'amenities_title'
                    )}
                    placeholder="Experience A Fresh"
                    className="
                      w-full
                      rounded-xl
                      border
                      border-gray-200
                      bg-white
                      px-4 py-3
                      text-sm
                      text-brand-blue
                      outline-none
                      transition-all
                      focus:border-brand-gold
                      focus:ring-2
                      focus:ring-brand-gold/10
                    "
                  />
                </div>


                {/* GOLD HEADLINE */}
                <div>
                  <label
                    className="
                      block
                      text-[10px]
                      font-bold
                      uppercase
                      tracking-widest
                      text-gray-500
                      mb-2
                    "
                  >
                    Highlighted Headline
                  </label>

                  <input
                    {...register(
                      'amenities_title_gold'
                    )}
                    placeholder="Way Of Living in City Clou."
                    className="
                      w-full
                      rounded-xl
                      border
                      border-gray-200
                      bg-white
                      px-4 py-3
                      text-sm
                      text-brand-blue
                      outline-none
                      transition-all
                      focus:border-brand-gold
                      focus:ring-2
                      focus:ring-brand-gold/10
                    "
                  />

                  <p
                    className="
                      mt-1.5
                      text-[10px]
                      text-gray-400
                    "
                  >
                    This portion appears in gold.
                  </p>
                </div>


                <div
                  className="
                    border-t
                    border-gray-100
                    pt-6
                  "
                >
                  <button
                    type="button"
                    onClick={
                      handleAddAmenity
                    }
                    className="
                      w-full
                      inline-flex
                      items-center
                      justify-center
                      gap-2
                      rounded-xl
                      bg-brand-blue
                      px-4 py-3
                      text-xs
                      font-bold
                      text-white
                      hover:bg-brand-blue/90
                      transition-colors
                    "
                  >
                    <PlusCircle size={15} />
                    Add Amenity
                  </button>
                </div>


                <p
                  className="
                    text-[10px]
                    text-gray-400
                    leading-relaxed
                  "
                >
                  Click an amenity card in the
                  preview to edit that specific
                  amenity.
                </p>

              </div>
            )}

            {/* INDIVIDUAL AMENITY */}
            {selectedAmenityIndex !== null &&
              selectedAmenity && (
              <div className="space-y-6">

                {/* NAME */}
                <div>
                  <label
                    className="
                      block
                      text-[10px]
                      font-bold
                      uppercase
                      tracking-widest
                      text-gray-500
                      mb-2
                    "
                  >
                    Amenity Name
                  </label>

                  <input
                    {...register(
                      `amenities.${selectedAmenityIndex}.title`
                    )}
                    className="
                      w-full
                      rounded-xl
                      border border-gray-200
                      px-4 py-3
                      text-sm
                      text-brand-blue
                      outline-none
                      focus:border-brand-gold
                      focus:ring-2
                      focus:ring-brand-gold/10
                    "
                  />

                  {errors?.amenities?.[
                    selectedAmenityIndex
                  ]?.title && (
                    <p
                      className="
                        mt-1.5
                        text-xs
                        text-red-500
                      "
                    >
                      {
                        errors.amenities[
                          selectedAmenityIndex
                        ]?.title?.message
                      }
                    </p>
                  )}
                </div>


                {/* TOWER */}
                <div>
                  <label
                    className="
                      block
                      text-[10px]
                      font-bold
                      uppercase
                      tracking-widest
                      text-gray-500
                      mb-2
                    "
                  >
                    Assigned Tower
                  </label>

                  <select
                    {...register(
                      `amenities.${selectedAmenityIndex}.tower`
                    )}
                    className="
                      w-full
                      rounded-xl
                      border border-gray-200
                      bg-white
                      px-4 py-3
                      text-sm
                      text-brand-blue
                      outline-none
                      cursor-pointer
                      focus:border-brand-gold
                    "
                  >
                    <option value="">
                      All Towers / Shared
                    </option>

                    {selectedAmenity?.tower &&
                      !isValidTowerAssignment(
                        selectedAmenity.tower
                      ) && (
                        <option
                          value={selectedAmenity.tower}
                          disabled
                        >
                          {selectedAmenity.tower} — no longer exists
                        </option>
                      )}

                    {availableTowerOptions.map(
                      (option) => (
                        <option
                          key={option}
                          value={option}
                        >
                          {option}
                        </option>
                      )
                    )}
                  </select>

                  {isValidTowerAssignment(
                    selectedAmenity?.tower
                  ) ? (
                    <p
                      className="
                        mt-1.5
                        text-[10px]
                        text-gray-400
                      "
                    >
                      Select a tower, or choose All Towers / Shared.
                    </p>
                  ) : (
                    <div
                      className="
                        mt-2
                        rounded-lg
                        border border-amber-200
                        bg-amber-50
                        px-3 py-2
                      "
                    >
                      <p
                        className="
                          text-[10px]
                          font-semibold
                          leading-relaxed
                          text-amber-700
                        "
                      >
                        This amenity is assigned to a tower that no
                        longer exists. Choose a valid tower or
                        All Towers / Shared before saving.
                      </p>
                    </div>
                  )}
                </div>


                {/* DESCRIPTION */}
                <div>
                  <label
                    className="
                      block
                      text-[10px]
                      font-bold
                      uppercase
                      tracking-widest
                      text-gray-500
                      mb-2
                    "
                  >
                    Description
                  </label>

                  <textarea
                    {...register(
                      `amenities.${selectedAmenityIndex}.description`
                    )}
                    rows={5}
                    className="
                      w-full
                      resize-y
                      rounded-xl
                      border border-gray-200
                      px-4 py-3
                      text-sm
                      leading-relaxed
                      text-brand-blue
                      outline-none
                      focus:border-brand-gold
                      focus:ring-2
                      focus:ring-brand-gold/10
                    "
                  />
                </div>


                {/* IMAGE */}
                <ImageDropzone
                  fieldPath={`amenities.${selectedAmenityIndex}.thumbnail`}
                  label="Amenity Image"
                  height="h-52"
                  watch={watch}
                  setValue={setValue}
                  errors={errors}
                  setPendingFiles={
                    setPendingFiles
                  }
                  setPreviews={
                    setPreviews
                  }
                  previews={previews}
                />


                {/* DELETE */}
                <div
                  className="
                    border-t
                    border-gray-100
                    pt-6
                  "
                >
                  <button
                    type="button"
                    onClick={() =>
                      handleRequestRemoveAmenity(
                        selectedAmenityIndex
                      )
                    }
                    className="
                      w-full
                      inline-flex
                      items-center
                      justify-center
                      gap-2
                      rounded-xl
                      border
                      border-red-200
                      bg-red-50
                      px-4 py-3
                      text-xs
                      font-bold
                      text-red-600
                      hover:bg-red-100
                      transition-colors
                    "
                  >
                    <Trash2 size={15} />
                    Remove Amenity
                  </button>
                </div>

              </div>
            )}


            {/* UNIT LAYOUTS SECTION */}
            {selectedEditorRegion ===
              'unit-layouts' && (
              <div className="space-y-6">

                <div>
                  <p className="text-xs font-bold text-brand-blue">
                    Blueprint display order
                  </p>

                  <p className="mt-1 text-[10px] leading-relaxed text-gray-400">
                    Drag towers to choose which tower appears first, then drag
                    layouts inside each tower to control their sequence.
                  </p>
                </div>

                {layoutEditorError && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-[10px] font-semibold leading-relaxed text-amber-700">
                      {layoutEditorError}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAddLayout}
                  disabled={availableTowerOptions.length === 0}
                  className="
                    w-full
                    inline-flex
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-brand-blue
                    px-4 py-3
                    text-xs
                    font-bold
                    text-white
                    hover:bg-brand-blue/90
                    disabled:cursor-not-allowed
                    disabled:opacity-40
                    transition-colors
                  "
                >
                  <PlusCircle size={15} />
                  Add Unit Layout
                </button>

                {/* TOWER ORDER */}
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-blue">
                      Tower Display Order
                    </p>
                    <p className="mt-1 text-[9px] leading-relaxed text-gray-400">
                      Drag a tower by its handle. This same order is used by the
                      blueprint section and tower filters.
                    </p>
                  </div>

                  <div className="p-3 space-y-2">
                    {(formData.towers || []).length === 0 ? (
                      <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-[10px] text-gray-400">
                        Add a tower from Page Settings first.
                      </p>
                    ) : (
                      (formData.towers || []).map(
                        (tower, index) => (
                          <div
                            key={
                              towerFields[index]?.fieldKey ||
                              tower.id ||
                              `${tower.name}-${index}`
                            }
                            draggable
                            onDragStart={() =>
                              setDragState({
                                type: 'tower',
                                index,
                              })
                            }
                            onDragEnd={() =>
                              setDragState(null)
                            }
                            onDragOver={(e) =>
                              e.preventDefault()
                            }
                            onDrop={() =>
                              handleTowerDrop(index)
                            }
                            className={`
                              flex items-center gap-3
                              rounded-xl
                              border
                              px-3 py-3
                              transition-all
                              ${
                                dragState?.type === 'tower' &&
                                dragState.index === index
                                  ? 'border-brand-gold bg-brand-gold/10 opacity-70'
                                  : 'border-gray-200 bg-gray-50 hover:border-brand-gold/50'
                              }
                            `}
                          >
                            <GripVertical
                              size={16}
                              className="shrink-0 cursor-grab text-gray-400 active:cursor-grabbing"
                            />

                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-blue">
                              {tower.name}
                            </span>
                          </div>
                        )
                      )
                    )}
                  </div>
                </div>

                {/* LAYOUT ORDER BY TOWER */}
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-blue">
                      Layout Sequence
                    </p>
                    <p className="mt-1 text-[9px] leading-relaxed text-gray-400">
                      Layouts can be reordered within their assigned tower.
                      Change the Assigned Tower inside a layout to move it to
                      another tower.
                    </p>
                  </div>

                  {availableTowerOptions.map(
                    (towerName) => {
                      const orderedIndices =
                        getOrderedLayoutIndicesForTower(
                          towerName
                        );

                      return (
                        <div
                          key={towerName}
                          className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                        >
                          <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/70 px-4 py-3">
                            <span className="truncate text-xs font-bold text-brand-blue">
                              {towerName}
                            </span>

                            <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[9px] font-bold text-gray-400 border border-gray-200">
                              {orderedIndices.length}{' '}
                              {orderedIndices.length === 1
                                ? 'layout'
                                : 'layouts'}
                            </span>
                          </div>

                          <div className="p-3 space-y-2">
                            {orderedIndices.length === 0 ? (
                              <p className="px-2 py-3 text-center text-[10px] text-gray-400">
                                No layouts assigned to this tower.
                              </p>
                            ) : (
                              orderedIndices.map(
                                (layoutIndex) => {
                                  const layout =
                                    formData.unit_layouts?.[
                                      layoutIndex
                                    ];

                                  if (!layout) {
                                    return null;
                                  }

                                  return (
                                    <div
                                      key={
                                        layoutFields[
                                          layoutIndex
                                        ]?.fieldKey ||
                                        layout.id ||
                                        layoutIndex
                                      }
                                      draggable
                                      onDragStart={() =>
                                        setDragState({
                                          type:
                                            'tower-layout',
                                          index:
                                            layoutIndex,
                                        })
                                      }
                                      onDragEnd={() =>
                                        setDragState(
                                          null
                                        )
                                      }
                                      onDragOver={(e) =>
                                        e.preventDefault()
                                      }
                                      onDrop={() =>
                                        handleTowerLayoutDrop(
                                          layoutIndex
                                        )
                                      }
                                      className={`
                                        flex items-center gap-3
                                        rounded-xl border
                                        px-3 py-3
                                        transition-all
                                        ${
                                          dragState?.type ===
                                            'tower-layout' &&
                                          dragState.index ===
                                            layoutIndex
                                            ? 'border-brand-gold bg-brand-gold/10 opacity-70'
                                            : 'border-gray-200 bg-gray-50 hover:border-brand-gold/50'
                                        }
                                      `}
                                    >
                                      <GripVertical
                                        size={16}
                                        className="shrink-0 cursor-grab text-gray-400 active:cursor-grabbing"
                                      />

                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSelectedEditorRegion(
                                            `unit-layout:${layoutIndex}`
                                          )
                                        }
                                        className="min-w-0 flex-1 text-left"
                                      >
                                        <span className="block truncate text-xs font-bold text-brand-blue">
                                          {layout.title ||
                                            `Untitled Layout`}
                                        </span>

                                        <span className="mt-0.5 block truncate text-[9px] text-gray-400">
                                          {layout.min_sqm ||
                                            '—'}
                                          {layout.max_sqm &&
                                          layout.max_sqm !==
                                            layout.min_sqm
                                            ? `–${layout.max_sqm}`
                                            : ''}{' '}
                                          SQM
                                        </span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSelectedEditorRegion(
                                            `unit-layout:${layoutIndex}`
                                          )
                                        }
                                        className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-gray-400 hover:text-brand-blue"
                                      >
                                        Edit
                                      </button>
                                    </div>
                                  );
                                }
                              )
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>

                {/* ADVANCED PLACEMENT ORDER */}
                <details className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <summary className="cursor-pointer select-none px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-brand-blue">
                    Other Display Placement Order
                  </summary>

                  <div className="space-y-5 border-t border-gray-100 p-4">
                    <div>
                      <p className="text-[10px] font-bold text-brand-blue">
                        Map Card
                      </p>
                      <p className="mt-1 text-[9px] leading-relaxed text-gray-400">
                        Drag layouts that are enabled for the project map card.
                      </p>

                      <div className="mt-3 space-y-2">
                        {getOrderedPlacementIndices(
                          'map-card'
                        ).length === 0 ? (
                          <p className="rounded-lg bg-gray-50 px-3 py-3 text-[10px] text-gray-400">
                            No layouts are currently shown on the map card.
                          </p>
                        ) : (
                          getOrderedPlacementIndices(
                            'map-card'
                          ).map(
                            (layoutIndex) => {
                              const layout =
                                formData.unit_layouts?.[
                                  layoutIndex
                                ];

                              if (!layout) {
                                return null;
                              }

                              return (
                                <div
                                  key={`map-${layout.id || layoutIndex}`}
                                  draggable
                                  onDragStart={() =>
                                    setDragState({
                                      type:
                                        'map-card',
                                      index:
                                        layoutIndex,
                                    })
                                  }
                                  onDragEnd={() =>
                                    setDragState(
                                      null
                                    )
                                  }
                                  onDragOver={(e) =>
                                    e.preventDefault()
                                  }
                                  onDrop={() =>
                                    handlePlacementDrop(
                                      'map-card',
                                      layoutIndex
                                    )
                                  }
                                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
                                >
                                  <GripVertical
                                    size={14}
                                    className="cursor-grab text-gray-400"
                                  />
                                  <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-brand-blue">
                                    {layout.title ||
                                      'Untitled Layout'}
                                  </span>
                                </div>
                              );
                            }
                          )
                        )}
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-5">
                      <p className="text-[10px] font-bold text-brand-blue">
                        Projects Page
                      </p>
                      <p className="mt-1 text-[9px] leading-relaxed text-gray-400">
                        Drag layouts that are enabled for the public projects listing.
                      </p>

                      <div className="mt-3 space-y-2">
                        {getOrderedPlacementIndices(
                          'projects-page'
                        ).length === 0 ? (
                          <p className="rounded-lg bg-gray-50 px-3 py-3 text-[10px] text-gray-400">
                            No layouts are currently shown on the Projects page.
                          </p>
                        ) : (
                          getOrderedPlacementIndices(
                            'projects-page'
                          ).map(
                            (layoutIndex) => {
                              const layout =
                                formData.unit_layouts?.[
                                  layoutIndex
                                ];

                              if (!layout) {
                                return null;
                              }

                              return (
                                <div
                                  key={`projects-${layout.id || layoutIndex}`}
                                  draggable
                                  onDragStart={() =>
                                    setDragState({
                                      type:
                                        'projects-page',
                                      index:
                                        layoutIndex,
                                    })
                                  }
                                  onDragEnd={() =>
                                    setDragState(
                                      null
                                    )
                                  }
                                  onDragOver={(e) =>
                                    e.preventDefault()
                                  }
                                  onDrop={() =>
                                    handlePlacementDrop(
                                      'projects-page',
                                      layoutIndex
                                    )
                                  }
                                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
                                >
                                  <GripVertical
                                    size={14}
                                    className="cursor-grab text-gray-400"
                                  />
                                  <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-brand-blue">
                                    {layout.title ||
                                      'Untitled Layout'}
                                  </span>
                                </div>
                              );
                            }
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </details>

                <p className="text-[10px] leading-relaxed text-gray-400">
                  All ordering changes are staged until Save Changes is pressed.
                  Reset restores the previously saved sequence.
                </p>
              </div>
            )}

            {/* INDIVIDUAL UNIT LAYOUT */}
            {selectedLayoutIndex !== null &&
              selectedLayout && (
              <div className="space-y-6">

                <button
                  type="button"
                  onClick={() =>
                    setSelectedEditorRegion(
                      'unit-layouts'
                    )
                  }
                  className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-brand-blue"
                >
                  <ArrowLeft size={13} />
                  Layout Order
                </button>

                {/* TOWER */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                    Assigned Tower
                  </label>

                  <select
                    value={
                      selectedLayout.tower_name ||
                      ''
                    }
                    onChange={(e) =>
                      handleLayoutTowerChange(
                        selectedLayoutIndex,
                        e.target.value
                      )
                    }
                    className="
                      w-full
                      rounded-xl
                      border border-gray-200
                      bg-white
                      px-4 py-3
                      text-sm
                      text-brand-blue
                      outline-none
                      cursor-pointer
                      focus:border-brand-gold
                    "
                  >
                    <option value="" disabled>
                      Select tower...
                    </option>

                    {selectedLayout.tower_name &&
                      !isValidTowerAssignment(
                        selectedLayout.tower_name
                      ) && (
                        <option
                          value={
                            selectedLayout.tower_name
                          }
                          disabled
                        >
                          {
                            selectedLayout.tower_name
                          }{' '}
                          — no longer exists
                        </option>
                      )}

                    {availableTowerOptions.map(
                      (tower) => (
                        <option
                          key={tower}
                          value={tower}
                        >
                          {tower}
                        </option>
                      )
                    )}
                  </select>

                  {!isValidTowerAssignment(
                    selectedLayout.tower_name
                  ) && (
                    <p className="mt-1.5 text-[10px] font-medium leading-relaxed text-amber-600">
                      Choose a valid tower before saving.
                    </p>
                  )}
                </div>

                {/* TITLE */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                    Layout Title
                  </label>

                  <input
                    {...register(
                      `unit_layouts.${selectedLayoutIndex}.title`
                    )}
                    placeholder="e.g. Studio Unit"
                    className="
                      w-full rounded-xl
                      border border-gray-200
                      px-4 py-3
                      text-sm text-brand-blue
                      outline-none
                      focus:border-brand-gold
                      focus:ring-2
                      focus:ring-brand-gold/10
                    "
                  />

                  {errors?.unit_layouts?.[
                    selectedLayoutIndex
                  ]?.title && (
                    <p className="mt-1.5 text-xs text-red-500">
                      {
                        errors.unit_layouts[
                          selectedLayoutIndex
                        ]?.title?.message
                      }
                    </p>
                  )}
                </div>

                {/* SIZE */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                      Min SQM
                    </label>

                    <input
                      {...register(
                        `unit_layouts.${selectedLayoutIndex}.min_sqm`
                      )}
                      inputMode="decimal"
                      className="
                        w-full rounded-xl
                        border border-gray-200
                        px-4 py-3
                        text-sm text-brand-blue
                        outline-none
                        focus:border-brand-gold
                      "
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                      Max SQM
                    </label>

                    <input
                      {...register(
                        `unit_layouts.${selectedLayoutIndex}.max_sqm`
                      )}
                      inputMode="decimal"
                      className="
                        w-full rounded-xl
                        border border-gray-200
                        px-4 py-3
                        text-sm text-brand-blue
                        outline-none
                        focus:border-brand-gold
                      "
                    />
                  </div>
                </div>

                {/* DESCRIPTION */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                    Description
                  </label>

                  <textarea
                    {...register(
                      `unit_layouts.${selectedLayoutIndex}.description`
                    )}
                    rows={5}
                    className="
                      w-full
                      resize-y
                      rounded-xl
                      border border-gray-200
                      px-4 py-3
                      text-sm
                      leading-relaxed
                      text-brand-blue
                      outline-none
                      focus:border-brand-gold
                      focus:ring-2
                      focus:ring-brand-gold/10
                    "
                  />
                </div>

                {/* COLOR */}
                <ColorInputSync
                  label="Card Background Color"
                  fieldName={`unit_layouts.${selectedLayoutIndex}.bg_color`}
                  register={register}
                  watch={watch}
                  setValue={setValue}
                  inputStyles={inputStyles}
                  labelStyles={labelStyles}
                />

                {/* IMAGE */}
                <ImageDropzone
                  fieldPath={`unit_layouts.${selectedLayoutIndex}.thumbnail`}
                  label="Floorplan Image"
                  height="h-52"
                  watch={watch}
                  setValue={setValue}
                  errors={errors}
                  setPendingFiles={
                    setPendingFiles
                  }
                  setPreviews={
                    setPreviews
                  }
                  previews={previews}
                />

                {/* DISPLAY PLACEMENT */}
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-blue">
                    Other Display Placements
                  </p>

                  <p className="mt-1 text-[9px] leading-relaxed text-gray-400">
                    Turn placements on or off here. Reorder enabled layouts from
                    the Unit Layouts inspector—no order numbers required.
                  </p>

                  <div className="mt-4 space-y-3">
                    <button
                      type="button"
                      onClick={() =>
                        handleLayoutPlacementToggle(
                          selectedLayoutIndex,
                          'map-card'
                        )
                      }
                      className={`
                        w-full
                        flex items-center
                        justify-between
                        gap-4
                        rounded-xl
                        border
                        px-4 py-3
                        text-left
                        transition-all
                        ${
                          selectedLayout.show_on_map_card
                            ? 'border-brand-gold/50 bg-brand-gold/10'
                            : 'border-gray-200 bg-white'
                        }
                      `}
                    >
                      <span>
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-brand-blue">
                          Show on Map Card
                        </span>
                        <span className="mt-0.5 block text-[9px] text-gray-400">
                          Makes this layout available on the project map popup.
                        </span>
                      </span>

                      <span
                        className={`
                          relative h-5 w-9 shrink-0 rounded-full transition-colors
                          ${
                            selectedLayout.show_on_map_card
                              ? 'bg-brand-gold'
                              : 'bg-gray-300'
                          }
                        `}
                      >
                        <span
                          className={`
                            absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform
                            ${
                              selectedLayout.show_on_map_card
                                ? 'translate-x-[18px]'
                                : 'translate-x-0.5'
                            }
                          `}
                        />
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleLayoutPlacementToggle(
                          selectedLayoutIndex,
                          'projects-page'
                        )
                      }
                      className={`
                        w-full
                        flex items-center
                        justify-between
                        gap-4
                        rounded-xl
                        border
                        px-4 py-3
                        text-left
                        transition-all
                        ${
                          selectedLayout.show_on_project_page
                            ? 'border-brand-gold/50 bg-brand-gold/10'
                            : 'border-gray-200 bg-white'
                        }
                      `}
                    >
                      <span>
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-brand-blue">
                          Show on Projects Page
                        </span>
                        <span className="mt-0.5 block text-[9px] text-gray-400">
                          Includes this layout in the public projects listing.
                        </span>
                      </span>

                      <span
                        className={`
                          relative h-5 w-9 shrink-0 rounded-full transition-colors
                          ${
                            selectedLayout.show_on_project_page
                              ? 'bg-brand-gold'
                              : 'bg-gray-300'
                          }
                        `}
                      >
                        <span
                          className={`
                            absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform
                            ${
                              selectedLayout.show_on_project_page
                                ? 'translate-x-[18px]'
                                : 'translate-x-0.5'
                            }
                          `}
                        />
                      </span>
                    </button>
                  </div>
                </div>

                {/* DELETE */}
                <div className="border-t border-gray-100 pt-6">
                  <button
                    type="button"
                    onClick={() =>
                      handleRequestRemoveLayout(
                        selectedLayoutIndex
                      )
                    }
                    className="
                      w-full
                      inline-flex
                      items-center
                      justify-center
                      gap-2
                      rounded-xl
                      border border-red-200
                      bg-red-50
                      px-4 py-3
                      text-xs
                      font-bold
                      text-red-600
                      hover:bg-red-100
                      transition-colors
                    "
                  >
                    <Trash2 size={15} />
                    Remove Unit Layout
                  </button>
                </div>
              </div>
            )}

            {/* PAGE SETTINGS */}
            {selectedEditorRegion ===
              'page-settings' && (
              <div className="space-y-5">

                <div
                  className="
                    rounded-xl
                    bg-amber-50
                    border
                    border-amber-100
                    p-4
                  "
                >
                  <p
                    className="
                      text-xs
                      font-bold
                      text-amber-700
                    "
                  >
                    Technical settings
                  </p>

                  <p
                    className="
                      text-[10px]
                      leading-relaxed
                      text-amber-700/70
                      mt-1
                    "
                  >
                    These values affect how
                    the project is identified
                    and addressed on the
                    website.
                  </p>
                </div>

                {/* PROJECT TOWERS */}
                <div
                  className="
                    rounded-xl
                    border
                    border-gray-200
                    bg-white
                    overflow-hidden
                  "
                >
                  <div
                    className="
                      px-4 py-4
                      border-b
                      border-gray-100
                    "
                  >
                    <div
                      className="
                        flex
                        items-start
                        justify-between
                        gap-4
                      "
                    >
                      <div>
                        <p
                          className="
                            text-sm
                            font-bold
                            text-brand-blue
                          "
                        >
                          Project Towers
                        </p>

                        <p
                          className="
                            mt-1
                            text-[10px]
                            leading-relaxed
                            text-gray-400
                          "
                        >
                          Towers available for amenities
                          and unit layouts.
                        </p>
                      </div>

                      <span
                        className="
                          shrink-0
                          rounded-full
                          bg-gray-100
                          px-2.5 py-1
                          text-[10px]
                          font-bold
                          text-gray-500
                        "
                      >
                        {towerFields.length}
                        {' '}
                        {towerFields.length === 1
                          ? 'tower'
                          : 'towers'}
                      </span>
                    </div>
                  </div>


                {/* EXISTING TOWERS */}
                <div>
                  {towerFields.length === 0 ? (
                    <div
                      className="
                        px-4 py-6
                        text-center
                      "
                    >
                      <p
                        className="
                          text-xs
                          font-medium
                          text-gray-400
                        "
                      >
                        No towers added yet.
                      </p>
                    </div>
                  ) : (
                    towerFields.map(
                    (tower, index) => (
                      <div
                        key={tower.fieldKey}
                        className="
                          flex
                          items-center
                          justify-between
                          gap-3
                          px-4 py-3
                          border-b
                          border-gray-100
                          last:border-b-0
                        "
                      >
                        {editingTowerIndex === index ? (
                          <div className="flex flex-1 items-center gap-2 min-w-0">
                            <input
                              type="text"
                              value={editingTowerName}
                              onChange={(e) => {
                                setEditingTowerName(e.target.value);

                                if (towerRenameError) {
                                  setTowerRenameError('');
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleApplyRenameTower();
                                }

                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  handleCancelRenameTower();
                                }
                              }}
                              autoFocus
                              className="
                                min-w-0
                                flex-1
                                rounded-lg
                                border
                                border-brand-gold
                                bg-white
                                px-3 py-2
                                text-sm
                                text-brand-blue
                                outline-none
                                ring-2
                                ring-brand-gold/10
                              "
                            />

                            <button
                              type="button"
                              onClick={handleApplyRenameTower}
                              className="
                                rounded-lg
                                bg-brand-blue
                                px-3 py-2
                                text-[10px]
                                font-bold
                                text-white
                              "
                            >
                              Apply
                            </button>

                            <button
                              type="button"
                              onClick={handleCancelRenameTower}
                              className="
                                rounded-lg
                                px-2 py-2
                                text-[10px]
                                font-bold
                                text-gray-400
                                hover:text-brand-blue
                              "
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div
                                className="
                                  flex
                                  h-8 w-8
                                  shrink-0
                                  items-center
                                  justify-center
                                  rounded-lg
                                  bg-brand-blue/5
                                  text-[10px]
                                  font-bold
                                  text-brand-blue
                                "
                              >
                                {index + 1}
                              </div>

                              <span
                                className="
                                  truncate
                                  text-sm
                                  font-medium
                                  text-brand-blue
                                "
                              >
                                {watch(`towers.${index}.name`)}
                              </span>
                            </div>

                            <div
  className="
    flex
    items-center
    gap-3
    shrink-0
  "
>
  <button
    type="button"
    onClick={() =>
      handleStartRenameTower(
        index
      )
    }
    className="
      text-[9px]
      font-bold
      uppercase
      tracking-wider
      text-gray-400
      hover:text-brand-blue
      transition-colors
    "
  >
    Rename
  </button>

  <button
    type="button"
    disabled={
      isCheckingTowerUsage
    }
    onClick={() =>
      handleRequestDeleteTower(
        index
      )
    }
    className="
      text-[9px]
      font-bold
      uppercase
      tracking-wider
      text-gray-300
      hover:text-red-500
      disabled:opacity-40
      transition-colors
    "
  >
    Delete
  </button>
</div>
                          </>
                        )}
                      </div>
                    )
                  )
                  )}
                </div>

                {towerRenameError && (
                <div
                  className="
                    border-t
                    border-red-100
                    bg-red-50
                    px-4 py-2
                  "
                >
                  <p className="text-[10px] font-medium text-red-500">
                    {towerRenameError}
                  </p>
                </div>
              )}

  {/* ADD TOWER */}
  <div
    className="
      border-t
      border-gray-100
      bg-gray-50/60
      p-4
    "
  >
    <label
      className="
        block
        text-[10px]
        font-bold
        uppercase
        tracking-widest
        text-gray-500
        mb-2
      "
    >
      Add New Tower
    </label>

    <div
      className="
        flex
        gap-2
      "
    >
      <input
        type="text"
        value={newTowerName}
        onChange={(e) => {
          setNewTowerName(
            e.target.value
          );

          if (towerError) {
            setTowerError('');
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTower();
          }
        }}
        placeholder="e.g. Tower D"
        className="
          min-w-0
          flex-1
          rounded-xl
          border
          border-gray-200
          bg-white
          px-3 py-2.5
          text-sm
          text-brand-blue
          outline-none
          transition-all
          focus:border-brand-gold
          focus:ring-2
          focus:ring-brand-gold/10
        "
      />

      <button
        type="button"
        onClick={
          handleAddTower
        }
        className="
          inline-flex
          shrink-0
          items-center
          justify-center
          gap-1.5
          rounded-xl
          bg-brand-blue
          px-3
          text-[10px]
          font-bold
          text-white
          transition-colors
          hover:bg-brand-blue/90
        "
      >
        <PlusCircle size={14} />
        Add
      </button>
    </div>

    {towerError && (
      <p
        className="
          mt-2
          text-[10px]
          font-medium
          text-red-500
        "
      >
        {towerError}
      </p>
    )}

    <p
      className="
        mt-2
        text-[10px]
        leading-relaxed
        text-gray-400
      "
    >
      New towers become available
      after you save the project.
    </p>
  </div>
</div>
{/* DELETE TOWER MODAL */}
{towerToDelete &&
  towerUsage && (

  <div
    className="
      fixed
      inset-0
      z-[200]
      flex
      items-center
      justify-center
      bg-brand-blue/55
      backdrop-blur-sm
      p-4
    "
    onMouseDown={
      handleCloseTowerDelete
    }
  >

    <div
      onMouseDown={(e) =>
        e.stopPropagation()
      }
      className="
        w-full
        max-w-md
        overflow-hidden
        rounded-2xl
        bg-white
        shadow-2xl
      "
    >

      {/* HEADER */}
      <div
        className="
          border-b
          border-gray-100
          px-6 py-5
        "
      >
        <p
          className="
            text-[10px]
            font-bold
            uppercase
            tracking-widest
            text-red-500
          "
        >
          Delete Tower
        </p>

        <h3
          className="
            mt-1
            text-xl
            font-semibold
            text-brand-blue
          "
        >
          Delete{' '}
          {towerToDelete.name}?
        </h3>
      </div>


      <div
        className="
          space-y-5
          px-6 py-5
        "
      >

        {/* USAGE SUMMARY */}
        {towerUsage.amenityCount ===
          0 &&
        towerUsage.layoutCount ===
          0 ? (

          <div
            className="
              rounded-xl
              bg-gray-50
              p-4
            "
          >
            <p
              className="
                text-sm
                leading-relaxed
                text-gray-500
              "
            >
              This tower is not
              currently used by any
              amenities or unit
              layouts.
            </p>
          </div>

        ) : (

          <div
            className="
              rounded-xl
              border
              border-amber-200
              bg-amber-50
              p-4
            "
          >
            <p
              className="
                text-xs
                font-bold
                text-amber-800
              "
            >
              This tower is currently
              in use.
            </p>

            <div
              className="
                mt-3
                space-y-1
                text-sm
                text-amber-700
              "
            >
              <p>
                {
                  towerUsage.amenityCount
                }{' '}
                {
                  towerUsage.amenityCount ===
                  1
                    ? 'amenity'
                    : 'amenities'
                }
              </p>

              <p>
                {
                  towerUsage.layoutCount
                }{' '}
                {
                  towerUsage.layoutCount ===
                  1
                    ? 'unit layout'
                    : 'unit layouts'
                }
              </p>
            </div>
          </div>
        )}


        {/* AMENITY REASSIGNMENT */}
        {towerUsage.amenityCount >
          0 && (

          <div>
            <label
              className="
                mb-2
                block
                text-[10px]
                font-bold
                uppercase
                tracking-widest
                text-gray-500
              "
            >
              Move Amenities To
            </label>

            <select
              value={
                deleteAmenityTarget
              }
              onChange={(e) =>
                setDeleteAmenityTarget(
                  e.target.value
                )
              }
              className="
                w-full
                rounded-xl
                border
                border-gray-200
                bg-white
                px-4 py-3
                text-sm
                text-brand-blue
                outline-none
                focus:border-brand-gold
              "
            >
              <option
                value="__shared__"
              >
                All Towers / Shared
              </option>

              {towerUsage.otherTowers.map(
                (tower) => (
                  <option
                    key={
                      tower.id
                    }
                    value={
                      tower.name
                    }
                  >
                    {
                      tower.name
                    }
                  </option>
                )
              )}
            </select>
          </div>
        )}


        {/* UNIT LAYOUT REASSIGNMENT */}
        {towerUsage.layoutCount >
          0 && (

          <div>
            <label
              className="
                mb-2
                block
                text-[10px]
                font-bold
                uppercase
                tracking-widest
                text-gray-500
              "
            >
              Move Unit Layouts To
            </label>

            {towerUsage.otherTowers
              .length > 0 ? (

              <select
                value={
                  deleteLayoutTarget
                }
                onChange={(e) =>
                  setDeleteLayoutTarget(
                    e.target.value
                  )
                }
                className="
                  w-full
                  rounded-xl
                  border
                  border-gray-200
                  bg-white
                  px-4 py-3
                  text-sm
                  text-brand-blue
                  outline-none
                  focus:border-brand-gold
                "
              >
                <option value="">
                  Select replacement tower
                </option>

                {towerUsage.otherTowers.map(
                  (tower) => (
                    <option
                      key={
                        tower.id
                      }
                      value={
                        tower.name
                      }
                    >
                      {
                        tower.name
                      }
                    </option>
                  )
                )}
              </select>

            ) : (

              <div
                className="
                  rounded-xl
                  border
                  border-red-200
                  bg-red-50
                  p-3
                "
              >
                <p
                  className="
                    text-xs
                    leading-relaxed
                    text-red-600
                  "
                >
                  This is the only
                  project tower.
                  Add another tower
                  before deleting it
                  because unit layouts
                  require a tower.
                </p>
              </div>
            )}
          </div>
        )}


        {towerDeleteError && (
          <p
            className="
              text-xs
              font-medium
              text-red-500
            "
          >
            {towerDeleteError}
          </p>
        )}

      </div>


      {/* ACTIONS */}
      <div
        className="
          flex
          justify-end
          gap-3
          border-t
          border-gray-100
          bg-gray-50
          px-6 py-4
        "
      >
        <button
          type="button"
          disabled={
            isDeletingTower
          }
          onClick={
            handleCloseTowerDelete
          }
          className="
            rounded-lg
            px-4 py-2.5
            text-xs
            font-bold
            text-gray-500
            hover:bg-gray-100
          "
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={
            isDeletingTower ||
            (
              towerUsage.layoutCount >
                0 &&
              (
                !deleteLayoutTarget ||
                towerUsage
                  .otherTowers
                  .length === 0
              )
            )
          }
          onClick={
            handleConfirmDeleteTower
          }
          className="
            inline-flex
            min-w-[120px]
            items-center
            justify-center
            gap-2
            rounded-lg
            bg-red-600
            px-4 py-2.5
            text-xs
            font-bold
            text-white
            hover:bg-red-700
            disabled:cursor-not-allowed
            disabled:opacity-40
          "
        >
          {isDeletingTower ? (
            <>
              <Loader2
                size={14}
                className="
                  animate-spin
                "
              />

              Deleting...
            </>
          ) : (
            <>
              <Trash2
                size={14}
              />

              {towerUsage.amenityCount >
                0 ||
              towerUsage.layoutCount >
                0
                ? 'Move & Delete'
                : 'Delete Tower'}
            </>
          )}
        </button>
      </div>

    </div>
  </div>
)}
                <div>
                  <label
                    className="
                      block
                      text-[10px]
                      font-bold
                      uppercase
                      tracking-widest
                      text-gray-500
                      mb-2
                    "
                  >
                    URL Slug
                  </label>

                  <input
                    {...register('slug')}
                    className="
                      w-full
                      border
                      border-gray-200
                      rounded-xl
                      px-4 py-3
                      text-sm
                      text-brand-blue
                      outline-none
                      focus:border-brand-gold
                    "
                  />

                  {errors.slug && (
                    <p
                      className="
                        text-xs
                        text-red-500
                        mt-1
                      "
                    >
                      {errors.slug.message}
                    </p>
                  )}
                </div>


                <div>
                  <label
                    className="
                      block
                      text-[10px]
                      font-bold
                      uppercase
                      tracking-widest
                      text-gray-500
                      mb-2
                    "
                  >
                    Project Status
                  </label>

                  <select
                    {...register(
                      'status'
                    )}
                    className="
                      w-full
                      border
                      border-gray-200
                      rounded-xl
                      bg-white
                      px-4 py-3
                      text-sm
                      text-brand-blue
                      outline-none
                      focus:border-brand-gold
                    "
                  >
                    <option value="">
                      Select status
                    </option>

                    <option
                      value="Pre-Selling"
                    >
                      Pre-Selling
                    </option>

                    <option
                      value="Ready for Occupancy"
                    >
                      Ready for Occupancy
                    </option>
                  </select>
                </div>

              </div>
            )}

            {/* NOTHING SELECTED */}
            {!selectedEditorRegion && (
              <div
                className="
                  py-12
                  text-center
                "
              >
                <p
                  className="
                    text-sm
                    font-bold
                    text-brand-blue
                  "
                >
                  Select something to edit
                </p>

                <p
                  className="
                    text-xs
                    text-gray-400
                    mt-2
                  "
                >
                  Hover over editable
                  content in the preview
                  and click it.
                </p>
              </div>
            )}

          </div>

          {/* TEMPORARY FALLBACK */}
          <div
            className="
              shrink-0
              border-t
              border-gray-100
              p-4
              bg-gray-50
            "
          >
            <p
              className="
                text-[10px]
                text-gray-400
                mb-3
                leading-relaxed
              "
            >
              Editorial, amenities, unit
              layouts, and map controls are
              still available in the existing
              editor while we migrate them.
            </p>

            <button
              type="button"
              onClick={() =>
                setUseLegacyEditor(true)
              }
              className="
                w-full
                rounded-xl
                border
                border-gray-200
                bg-white
                px-4 py-3
                text-xs
                font-bold
                text-brand-blue
                hover:border-brand-gold
                transition-colors
              "
            >
              Open All Content Controls
            </button>
          </div>

        </aside>
      </div>
    </div>
  );
}

  return (
    <div className="flex h-screen w-full bg-[#E7E7E7] font-sans text-gray-900 overflow-hidden relative">
      {amenityRemoveModal}
      {layoutRemoveModal}
      
      {successMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-3 max-w-sm w-full mx-4">
            <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-2 shadow-inner">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-2xl font-serif text-brand-blue text-center font-bold">Success!</h2>
            <p className="text-gray-600 text-center font-medium">{successMsg}</p>
          </div>
        </div>
      )}

      {/* LEFT SIDE: ADMIN FORM ENTRY */}
      <div className="w-[500px] shrink-0 bg-white p-8 overflow-y-auto border-r border-gray-200 shadow-2xl z-20 flex flex-col relative custom-scrollbar">
        <button
          type="button"
          onClick={() =>
            router.push('/admin/dashboard?section=Projects')
          }
          className="flex items-center gap-2 text-[10px] text-gray-500 hover:text-brand-blue mb-8 font-bold uppercase tracking-widest transition-colors w-fit outline-none"
        >
          <ArrowLeft size={14} />
          Back to Projects
        </button>

              <button
        type="button"
        onClick={() =>
          setUseLegacyEditor(false)
        }
        className="
          flex
          items-center
          gap-2
          text-[10px]
          text-brand-blue
          hover:text-brand-gold
          mb-6
          font-bold
          uppercase
          tracking-widest
          transition-colors
        "
      >
        ← Back to Visual Editor
      </button>

        <h2 className="text-3xl font-serif text-brand-blue mb-8">{editId ? 'Edit Project' : 'Add New Project'}</h2>
        
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-10 flex-1 pb-10">
          
          {/* Section 1: Basic Info */}
          <div>
            <h3 className="text-xs font-bold text-brand-gold uppercase tracking-widest border-b pb-2">Basic Info</h3>
            
            <label className={labelStyles}>Project Title</label>
            <input {...register("title")} placeholder="e.g. City Clou" className={inputStyles} />
            {errors.title && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.title.message}</p>}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelStyles}>URL Slug</label>
                <input {...register("slug")} placeholder="/cityclou" className={inputStyles} />
                {errors.slug && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.slug.message}</p>}
              </div>
              <div>
                <label className={labelStyles}>Status</label>
                <select {...register("status")} className={`${inputStyles} cursor-pointer`}>
                  <option value="">Select...</option>
                  <option value="Pre-Selling">Pre-Selling</option>
                  <option value="Ready for Occupancy">Ready for Occupancy</option>
                </select>
                {errors.status && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.status.message}</p>}
              </div>
            </div>

            <label className={labelStyles}>Street Address</label>
            <input {...register("address")} className={inputStyles} />
            {errors.address && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.address.message}</p>}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelStyles}>City</label>
                <input {...register("city")} className={inputStyles} />
                {errors.city && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.city.message}</p>}
              </div>
              <div>
                <label className={labelStyles}>Country</label>
                <input {...register("country")} className={inputStyles} />
                {errors.country && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.country.message}</p>}
              </div>
              <div>
                <label className={labelStyles}>Total SQM</label>
                <input type="text" {...register("sqm")} placeholder="e.g. 5000" className={inputStyles} />
                {errors.sqm && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.sqm.message}</p>}
              </div>
              <div>
                <label className={labelStyles}>Total Units</label>
                <input type="text" {...register("unit_total")} placeholder="e.g. 450" className={inputStyles} />
                {errors.unit_total && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.unit_total.message}</p>}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <ImageDropzone 
                fieldPath="image" label="Main Hero Image" height="h-32"
                watch={watch} setValue={setValue} errors={errors} 
                setPendingFiles={setPendingFiles} setPreviews={setPreviews} previews={previews} 
              />
              <ImageDropzone 
                fieldPath="img_awards" label="Awards Badge (Optional)" height="h-32"
                watch={watch} setValue={setValue} errors={errors} 
                setPendingFiles={setPendingFiles} setPreviews={setPreviews} previews={previews} 
              />
            </div>
          </div>

          {/* Section 2: Tags */}
          <div>
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-xs font-bold text-brand-gold uppercase tracking-widest">Tags</h3>
              <button type="button" onClick={() => appendTag({ tag_name: "" })} className="text-[10px] text-brand-blue font-bold uppercase flex items-center gap-1"><PlusCircle size={12}/> Add Tag</button>
            </div>
            {tagFields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-center mt-3">
                <div className="flex-1">
                   <input {...register(`tags.${index}.tag_name`)} placeholder="e.g. Mixed Use" className={inputStyles} />
                   {errors?.tags?.[index]?.tag_name && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.tags[index]?.tag_name?.message}</p>}
                </div>
                <button type="button" onClick={() => removeTag(index)} className="text-gray-300 hover:text-red-500"><Trash2 size={16}/></button>
              </div>
            ))}
          </div>

          {/* Section 3: Editorial */}
          <div>
            <h3 className="text-xs font-bold text-brand-gold uppercase tracking-widest border-b pb-2">Editorial Section</h3>
            
            <div className="grid grid-cols-3 gap-4 mt-4 mb-4">
              <ColorInputSync 
                label="Bg Color" 
                fieldName="editorial_bg_color" 
                register={register} watch={watch} setValue={setValue} 
                inputStyles={inputStyles} labelStyles={labelStyles} 
              />
              <ColorInputSync 
                label="Headline" 
                fieldName="editorial_title_color" 
                register={register} watch={watch} setValue={setValue} 
                inputStyles={inputStyles} labelStyles={labelStyles} 
              />
              <ColorInputSync 
                label="Text" 
                fieldName="editorial_desc_color" 
                register={register} watch={watch} setValue={setValue} 
                inputStyles={inputStyles} labelStyles={labelStyles} 
              />
            </div>

            <label className={labelStyles}>Headline</label>
            <textarea 
              {...register("editorial_title")} 
              rows={2} 
              className={`${inputStyles} resize-none`} 
            />
            {errors.editorial_title && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.editorial_title.message}</p>}
                        
            <label className={labelStyles}>Long Description</label>
            <textarea {...register("editorial_long")} rows={4} className={`${inputStyles} resize-none`} />
            {errors.editorial_long && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.editorial_long.message}</p>}
            
            <div className="mt-4">
               <ImageDropzone 
                fieldPath="editorial_img" label="Editorial Image" height="h-32"
                watch={watch} setValue={setValue} errors={errors} 
                setPendingFiles={setPendingFiles} setPreviews={setPreviews} previews={previews} 
              />
            </div>
          </div>

          {/* Section 4: Amenities */}
          <div>
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-xs font-bold text-brand-gold uppercase tracking-widest">Amenities</h3>
              <button type="button" onClick={() => appendAmenity({ id: null, title: "", description: "", thumbnail: "", tower: null })} className="text-[10px] text-brand-blue font-bold uppercase flex items-center gap-1"><PlusCircle size={12}/> Add Amenity</button>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4 mb-6 p-4 bg-brand-blue/5 rounded-xl border border-brand-blue/10">
              <div>
                <label className={labelStyles}>Headline (White Text)</label>
                <input {...register("amenities_title")} placeholder="Experience A Fresh" className={inputStyles} />
              </div>
              <div>
                <label className={labelStyles}>Headline (Gold Text)</label>
                <input {...register("amenities_title_gold")} placeholder="Way Of Living in City Clou." className={inputStyles} />
              </div>
            </div>
            
            {amenityFields.map((field, index) => (
              <div key={field.fieldKey} className="p-4 mt-4 bg-gray-50 border border-gray-100 rounded-lg relative group">
                <button 
                  type="button" 
                  onClick={() =>
                    handleRequestRemoveAmenity(
                      index
                    )
                  } 
                  className="absolute top-4 right-4 text-gray-300 hover:text-red-500"
                >
                  <Trash2 size={16} />
                </button>
                
                <label className={labelStyles}>
                  Assigned Tower
                </label>

                <select
                  {...register(`amenities.${index}.tower`)}
                  className={`${inputStyles} cursor-pointer`}
                >
                  <option value="">
                    All Towers / Shared
                  </option>

                  {watch(`amenities.${index}.tower`) &&
                    !isValidTowerAssignment(
                      watch(`amenities.${index}.tower`)
                    ) && (
                      <option
                        value={
                          watch(`amenities.${index}.tower`) || ''
                        }
                        disabled
                      >
                        {watch(`amenities.${index}.tower`)} — no longer exists
                      </option>
                    )}

                  {availableTowerOptions.map((tower) => (
                    <option
                      key={tower}
                      value={tower}
                    >
                      {tower}
                    </option>
                  ))}
                </select>

                {isValidTowerAssignment(
                  watch(`amenities.${index}.tower`)
                ) ? (
                  <p className="mt-1 text-[10px] text-gray-400">
                    Select a tower, or choose All Towers / Shared.
                    Manage project towers from Page Settings.
                  </p>
                ) : (
                  <p className="mt-1 text-[10px] font-medium text-amber-600">
                    This amenity is assigned to a tower that no longer exists.
                    Choose a valid tower or All Towers / Shared before saving.
                  </p>
                )}
                
                <label className={labelStyles}>Description</label>
                <textarea {...register(`amenities.${index}.description`)} rows={2} className={`${inputStyles} resize-none`} />
                
                <div className="mt-4">
                  <ImageDropzone 
                    fieldPath={`amenities.${index}.thumbnail`} label="Thumbnail" height="h-24"
                    watch={watch} setValue={setValue} errors={errors} 
                    setPendingFiles={setPendingFiles} setPreviews={setPreviews} previews={previews} 
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Section 5: Blueprints */}
          <div>
            <div className="flex justify-between items-center border-b pb-2">
              <div>
                <h3 className="text-xs font-bold text-brand-gold uppercase tracking-widest">Unit Layouts</h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-1 rounded-full bg-brand-blue/5 border border-brand-blue/10 text-[9px] font-bold uppercase tracking-wider text-brand-blue">
                    {mapCardLayoutCount} Map Card
                  </span>
                  <span className="px-2 py-1 rounded-full bg-brand-gold/10 border border-brand-gold/30 text-[9px] font-bold uppercase tracking-wider text-brand-blue">
                    {projectPageLayoutCount} Projects Page
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  appendLayout({
                    title: "",
                    tower_name: availableTowerOptions[0] || "",
                    bg_color: "#051431",
                    description: "",
                    min_sqm: "",
                    max_sqm: "",
                    thumbnail: "",
                    show_on_map_card: false,
                    map_card_order: "",
                    show_on_project_page: false,
                    project_page_order: "",
                    sort_order: null
                  })
                }
                className="text-[10px] text-brand-blue hover:text-brand-gold font-bold uppercase flex items-center gap-1 transition-colors"
              >
                <PlusCircle size={12} /> Add Layout
              </button>
            </div>

            <p className="mt-3 text-[10px] leading-relaxed text-gray-400">
              Add or remove floorplans here, then choose where each layout is promoted.
              Display order controls the sequence shown on the public site.
            </p>

            {layoutFields.map((field, index) => {
              const showOnMapCard = Boolean(watch(`unit_layouts.${index}.show_on_map_card`));
              const showOnProjectPage = Boolean(watch(`unit_layouts.${index}.show_on_project_page`));

              return (
                <div
                  key={field.fieldKey}
                  className="p-4 mt-4 bg-gray-50 border border-gray-100 rounded-xl relative group shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => {
                      removeNestedFieldFiles("unit_layouts", index);
                      removeLayout(index);
                    }}
                    className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors"
                    aria-label="Remove unit layout"
                  >
                    <Trash2 size={16} />
                  </button>

                  <div className="pr-8">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelStyles}>Tower Name</label>
                        <select
                          {...register(`unit_layouts.${index}.tower_name`)}
                          className={`${inputStyles} cursor-pointer`}
                        >
                          <option value="">
                            Select tower...
                          </option>

                          {watch(`unit_layouts.${index}.tower_name`) &&
                            !isValidTowerAssignment(
                              watch(`unit_layouts.${index}.tower_name`)
                            ) && (
                              <option
                                value={
                                  watch(`unit_layouts.${index}.tower_name`) || ''
                                }
                                disabled
                              >
                                {watch(`unit_layouts.${index}.tower_name`)} — no longer exists
                              </option>
                            )}

                          {availableTowerOptions.map((tower) => (
                            <option
                              key={tower}
                              value={tower}
                            >
                              {tower}
                            </option>
                          ))}
                        </select>

                        {!isValidTowerAssignment(
                          watch(`unit_layouts.${index}.tower_name`)
                        ) && (
                          <p className="text-amber-600 text-[10px] font-medium mt-1">
                            This layout is assigned to a tower that no longer exists.
                            Choose a valid tower before saving.
                          </p>
                        )}

                        {errors?.unit_layouts?.[index]?.tower_name && (
                          <p className="text-red-500 text-[10px] font-bold mt-1">
                            {errors.unit_layouts[index]?.tower_name?.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className={labelStyles}>Layout Title</label>
                        <input
                          {...register(`unit_layouts.${index}.title`)}
                          placeholder="e.g. Studio Unit"
                          className={inputStyles}
                        />
                        {errors?.unit_layouts?.[index]?.title && (
                          <p className="text-red-500 text-[10px] font-bold mt-1">
                            {errors.unit_layouts[index]?.title?.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Placement controls */}
                    <div className="mt-5 p-4 rounded-xl bg-white border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-[10px] font-bold text-brand-blue uppercase tracking-widest">
                            Display Placement
                          </p>
                          <p className="text-[9px] text-gray-400 mt-1">
                            Control where this layout appears outside the project detail page.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        {/* Map popup */}
                        <div
                          className={`flex items-center justify-between gap-3 rounded-lg border p-3 transition-all ${
                            showOnMapCard
                              ? "border-brand-gold/50 bg-brand-gold/10"
                              : "border-gray-200 bg-gray-50"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              const nextValue = !showOnMapCard;
                              setValue(`unit_layouts.${index}.show_on_map_card`, nextValue, {
                                shouldDirty: true,
                                shouldValidate: true
                              });

                              if (!nextValue) {
                                setValue(`unit_layouts.${index}.map_card_order`, "", {
                                  shouldDirty: true
                                });
                              }
                            }}
                            className="flex flex-1 items-center gap-3 text-left"
                          >
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                                showOnMapCard
                                  ? "border-brand-gold bg-brand-gold text-brand-blue"
                                  : "border-gray-300 bg-white"
                              }`}
                            >
                              {showOnMapCard && <CheckCircle2 size={13} />}
                            </span>

                            <span>
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-brand-blue">
                                Show on Map Card
                              </span>
                              <span className="block text-[9px] text-gray-400 mt-0.5">
                                Displays this layout as a tag in the map project popup.
                              </span>
                            </span>
                          </button>

                          <div className="w-20 shrink-0">
                            <label className="block text-[8px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                              Order
                            </label>
                            <input
                              type="number"
                              min="1"
                              inputMode="numeric"
                              disabled={!showOnMapCard}
                              {...register(`unit_layouts.${index}.map_card_order`)}
                              className={`${inputStyles} py-2 text-center disabled:opacity-40 disabled:cursor-not-allowed`}
                              placeholder="-"
                            />
                          </div>
                        </div>

                        {/* Projects listing */}
                        <div
                          className={`flex items-center justify-between gap-3 rounded-lg border p-3 transition-all ${
                            showOnProjectPage
                              ? "border-brand-blue/30 bg-brand-blue/5"
                              : "border-gray-200 bg-gray-50"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              const nextValue = !showOnProjectPage;
                              setValue(`unit_layouts.${index}.show_on_project_page`, nextValue, {
                                shouldDirty: true,
                                shouldValidate: true
                              });

                              if (!nextValue) {
                                setValue(`unit_layouts.${index}.project_page_order`, "", {
                                  shouldDirty: true
                                });
                              }
                            }}
                            className="flex flex-1 items-center gap-3 text-left"
                          >
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                                showOnProjectPage
                                  ? "border-brand-blue bg-brand-blue text-brand-gold"
                                  : "border-gray-300 bg-white"
                              }`}
                            >
                              {showOnProjectPage && <CheckCircle2 size={13} />}
                            </span>

                            <span>
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-brand-blue">
                                Show on Projects Page
                              </span>
                              <span className="block text-[9px] text-gray-400 mt-0.5">
                                Displays this layout in the public projects listing.
                              </span>
                            </span>
                          </button>

                          <div className="w-20 shrink-0">
                            <label className="block text-[8px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                              Order
                            </label>
                            <input
                              type="number"
                              min="1"
                              inputMode="numeric"
                              disabled={!showOnProjectPage}
                              {...register(`unit_layouts.${index}.project_page_order`)}
                              className={`${inputStyles} py-2 text-center disabled:opacity-40 disabled:cursor-not-allowed`}
                              placeholder="-"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 mb-2">
                      <ColorInputSync
                        label="Card Left Background Color"
                        fieldName={`unit_layouts.${index}.bg_color`}
                        register={register}
                        watch={watch}
                        setValue={setValue}
                        inputStyles={inputStyles}
                        labelStyles={labelStyles}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelStyles}>Min SQM</label>
                        <input
                          type="text"
                          {...register(`unit_layouts.${index}.min_sqm`)}
                          className={inputStyles}
                        />
                        {errors?.unit_layouts?.[index]?.min_sqm && (
                          <p className="text-red-500 text-[10px] font-bold mt-1">
                            {errors.unit_layouts[index]?.min_sqm?.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className={labelStyles}>Max SQM</label>
                        <input
                          type="text"
                          {...register(`unit_layouts.${index}.max_sqm`)}
                          className={inputStyles}
                        />
                        {errors?.unit_layouts?.[index]?.max_sqm && (
                          <p className="text-red-500 text-[10px] font-bold mt-1">
                            {errors.unit_layouts[index]?.max_sqm?.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <label className={labelStyles}>Description</label>
                    <textarea
                      {...register(`unit_layouts.${index}.description`)}
                      rows={2}
                      className={`${inputStyles} resize-none`}
                    />

                    <div className="mt-4">
                      <ImageDropzone
                        fieldPath={`unit_layouts.${index}.thumbnail`}
                        label="Floorplan Image"
                        height="h-24"
                        watch={watch}
                        setValue={setValue}
                        errors={errors}
                        setPendingFiles={setPendingFiles}
                        setPreviews={setPreviews}
                        previews={previews}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <label className={labelStyles}>Points of Interest Subtitle</label>
            <input 
              {...register("map_subtitle")} 
              placeholder="Everything you need, strategically positioned right around your sanctuary." 
              className={inputStyles} 
            />
          </div>

          {/* Section 6: Map Markers */}
          <div>
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-xs font-bold text-brand-gold uppercase tracking-widest">Map Landmarks</h3>
              <button type="button" onClick={() => appendMarker({ interest_name: "", address: "", phrase: "", distance_km: "", distance_drive: "", distance_walk: "", latitude: "", longitude: "", thumbnail: "", marker_icon: "", marker_type: "general" })} className="text-[10px] text-brand-blue font-bold uppercase flex items-center gap-1"><PlusCircle size={12}/> Add Landmark</button>
            </div>
            
            {/* 1. UPDATED LAT/LNG LABELS */}
            <div className="grid grid-cols-2 gap-4 mt-4 mb-4">
              <div>
                <label className={labelStyles}>Project Location (Building Lat)</label>
                <input type="text" {...register("map_latitude")} className={inputStyles} />
                {errors.map_latitude && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.map_latitude.message}</p>}
              </div>
              <div>
                <label className={labelStyles}>Project Location (Building Lng)</label>
                <input type="text" {...register("map_longitude")} className={inputStyles} />
                {errors.map_longitude && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.map_longitude.message}</p>}
              </div>
            </div>

            {/* 2. MAIN PROJECT PIN UPLOAD */}
            <div className="mt-4 mb-8 p-4 bg-brand-blue/5 rounded-xl border border-brand-blue/10">
              <label className={labelStyles}>Main Project Map Pin (Transparent PNG or SVG)</label>
              <ImageDropzone 
                fieldPath="map_icon" 
                label="Upload Custom Project Pin" 
                height="h-32"
                watch={watch} 
                setValue={setValue} 
                errors={errors} 
                setPendingFiles={setPendingFiles} 
                setPreviews={setPreviews} 
                previews={previews} 
              />
            </div>

            {markerFields.map((field, index) => (
              <div key={field.id} className="p-4 mt-4 bg-gray-50 border border-gray-100 rounded-lg relative group">
                <button 
                type="button" 
                onClick={() => {
                  removeNestedFieldFiles("child_markers", index);
                  removeMarker(index);
                }} 
                className="absolute top-4 right-4 text-gray-300 hover:text-red-500"
              >
                <Trash2 size={16} />
              </button>
                
                <label className={labelStyles}>Landmark Name</label>
                <input {...register(`child_markers.${index}.interest_name`)} className={inputStyles} />
                {errors?.child_markers?.[index]?.interest_name && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.child_markers[index]?.interest_name?.message}</p>}
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelStyles}>Address</label>
                    <input {...register(`child_markers.${index}.address`)} className={inputStyles} />
                  </div>
                  <div>
                    <label className={labelStyles}>Catchphrase</label>
                    <input {...register(`child_markers.${index}.phrase`)} className={inputStyles} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                   <div>
                      <label className={labelStyles}>KM</label>
                      <input type="text" {...register(`child_markers.${index}.distance_km`)} className={inputStyles} />
                      {errors?.child_markers?.[index]?.distance_km && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.child_markers[index]?.distance_km?.message}</p>}
                   </div>
                   <div>
                      <label className={labelStyles}>Drive (m)</label>
                      <input type="text" {...register(`child_markers.${index}.distance_drive`)} className={inputStyles} />
                      {errors?.child_markers?.[index]?.distance_drive && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.child_markers[index]?.distance_drive?.message}</p>}
                   </div>
                   <div>
                      <label className={labelStyles}>Walk (m)</label>
                      <input type="text" {...register(`child_markers.${index}.distance_walk`)} className={inputStyles} />
                      {errors?.child_markers?.[index]?.distance_walk && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.child_markers[index]?.distance_walk?.message}</p>}
                   </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                   <div>
                      <label className={labelStyles}>Lat</label>
                      <input type="text" {...register(`child_markers.${index}.latitude`)} className={inputStyles} />
                      {errors?.child_markers?.[index]?.latitude && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.child_markers[index]?.latitude?.message}</p>}
                   </div>
                   <div>
                      <label className={labelStyles}>Lng</label>
                      <input type="text" {...register(`child_markers.${index}.longitude`)} className={inputStyles} />
                      {errors?.child_markers?.[index]?.longitude && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.child_markers[index]?.longitude?.message}</p>}
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-2">
                   {/* 3. CHILD MARKER IMAGE DROPZONE (Replacing Select) */}
                   <div>
                      <label className={labelStyles}>Custom Map Icon</label>
                      <ImageDropzone 
                        fieldPath={`child_markers.${index}.marker_icon`} 
                        label="Upload Marker Icon" 
                        height="h-24"
                        watch={watch} 
                        setValue={setValue} 
                        errors={errors} 
                        setPendingFiles={setPendingFiles} 
                        setPreviews={setPreviews} 
                        previews={previews} 
                      />
                   </div>
                   <div>
                      <label className={labelStyles}>Tag (e.g. retail)</label>
                      <input {...register(`child_markers.${index}.marker_type`)} className={inputStyles} />
                   </div>
                </div>

                <div className="mt-4">
                  <ImageDropzone 
                    fieldPath={`child_markers.${index}.thumbnail`} label="Landmark Photo" height="h-24"
                    watch={watch} setValue={setValue} errors={errors} 
                    setPendingFiles={setPendingFiles} setPreviews={setPreviews} previews={previews} 
                  />
                </div>
              </div>
            ))}
          </div>

          {hasErrors && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl flex items-center gap-3 text-xs font-bold mt-4">
              <AlertCircle size={16} /> Please fill in all required fields marked in red above.
            </div>
          )}

          <button 
            type="submit" disabled={isSaving || isSubmitting}
            className="flex items-center justify-center gap-2 bg-brand-blue text-white py-5 rounded-xl uppercase tracking-widest font-bold text-[11px] hover:bg-brand-gold transition-colors shadow-xl w-full disabled:opacity-70 mt-6 mb-4"
          >
            {(isSaving || isSubmitting) ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {editId ? 'Update & Save Project' : 'Upload & Publish Project'}
          </button>

        </form>
      </div>

      {/* RIGHT SIDE: LIVE GSAP SKELETON PREVIEW */}
      <div id="preview-scroller" className="flex-1 overflow-y-auto relative scroll-smooth bg-black custom-scrollbar">
        <div className="fixed top-6 right-8 z-50 pointer-events-none">
          <span className="px-4 py-2 bg-white/90 backdrop-blur-md border border-brand-gold/50 text-[10px] font-bold text-brand-blue uppercase tracking-widest rounded-full shadow-2xl">
            Live Preview Mode
          </span>
        </div>
        <PreviewSkeleton data={previewData} />
      </div>

    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#E7E7E7]"><Loader2 size={40} className="animate-spin text-brand-blue" /></div>}>
      <ProjectManager />
    </Suspense>
  );
}