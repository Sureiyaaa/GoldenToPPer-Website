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
    id: z.union([z.number(), z.string()]).optional().nullable(),
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
  const [projectTours, setProjectTours] = useState<any[]>([]);
  
  const [isFetching, setIsFetching] = useState(!!editId); 
  const [isSaving, setIsSaving] = useState(false);
  const [editorFeedback, setEditorFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [resetConfirmationOpen, setResetConfirmationOpen] = useState(false);
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
    markerToRemove,
    setMarkerToRemove
  ] = useState<{
    index: number;
    title: string;
  } | null>(null);

  // Persisted landmarks stay visible until Save. Their IDs are staged here
  // so Reset or Undo can cancel removal without reconstructing form rows.
  const [
    pendingMarkerRemovalIds,
    setPendingMarkerRemovalIds
  ] = useState<number[]>([]);

  // Navigation guard. Internal navigation gets a friendly confirmation modal,
  // while refresh/tab-close uses the browser's native unsaved-changes warning.
  const [
    pendingNavigationTarget,
    setPendingNavigationTarget
  ] = useState<string | null>(null);

  const [
    leaveAfterSaveTarget,
    setLeaveAfterSaveTarget
  ] = useState<string | null>(null);

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
    isDirty: isBasicDirty,
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
  const {
    fields: markerFields,
    append: appendMarker,
    remove: removeMarker
  } = useFieldArray({
    control,
    name: "child_markers",
    keyName: "fieldKey"
  });

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
          if (m.marker_type_table?.[0]?.icon) {
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

  const hasUnsavedChanges = editId
    ? isDirty ||
      pendingMarkerRemovalIds.length > 0
    : isBasicDirty;

  useEffect(() => {
    if (!hasUnsavedChanges) {
      setPendingNavigationTarget(null);
      return;
    }

    const handleBeforeUnload = (
      event: BeforeUnloadEvent
    ) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener(
      'beforeunload',
      handleBeforeUnload
    );

    return () => {
      window.removeEventListener(
        'beforeunload',
        handleBeforeUnload
      );
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!editorFeedback) return;

    const timeout = window.setTimeout(
      () => setEditorFeedback(null),
      editorFeedback.type === 'error'
        ? 5000
        : 3000
    );

    return () => window.clearTimeout(timeout);
  }, [editorFeedback]);

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
  
  
  const mapCardLayoutCount =
    formData.unit_layouts?.filter((layout) => layout.show_on_map_card).length || 0;

  const projectPageLayoutCount =
    formData.unit_layouts?.filter((layout) => layout.show_on_project_page).length || 0;

const handleBasicValidationError = () => {
  setCreateError(
    'Please complete the highlighted required fields before continuing.'
  );
};

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

  const handleProjectValidationError = () => {
    setEditorFeedback({
      type: 'error',
      message: 'Some fields need attention. Review the highlighted fields before saving.',
    });
  };

  const onSubmit = async (data: ProjectFormData) => {
    setIsSaving(true);
    setEditorFeedback(null);
    try {
      let finalData =
      normalizeTowerAssignments(
        data
      );

      const pendingMarkerIdSet =
        new Set(
          pendingMarkerRemovalIds.map(
            (id) => Number(id)
          )
        );

      const pendingMarkerIndexes =
        new Set(
          (finalData.child_markers || [])
            .map((marker, index) => {
              const parsedId =
                marker.id !== undefined &&
                marker.id !== null &&
                marker.id !== ''
                  ? Number(marker.id)
                  : null;

              return parsedId !== null &&
                pendingMarkerIdSet.has(parsedId)
                ? index
                : -1;
            })
            .filter((index) => index >= 0)
        );

      // 1. UPLOAD IMAGES TO BUCKET (Kept on the client)
      for (const [path, file] of Object.entries(pendingFiles)) {
        const markerPathMatch =
          path.match(
            /^child_markers\.(\d+)\./
          );

        if (
          markerPathMatch &&
          pendingMarkerIndexes.has(
            Number(markerPathMatch[1])
          )
        ) {
          // This landmark is waiting to be removed on Save.
          // Avoid uploading replacement assets that will immediately be discarded.
          continue;
        }
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

      // Apply staged landmark removals only at save time.
      // Until this point the rows stay in the form/preview so Reset or Undo works.
      finalData = {
        ...finalData,
        child_markers:
          (finalData.child_markers || []).filter(
            (marker) => {
              const parsedId =
                marker.id !== undefined &&
                marker.id !== null &&
                marker.id !== ''
                  ? Number(marker.id)
                  : null;

              return (
                parsedId === null ||
                !pendingMarkerIdSet.has(
                  parsedId
                )
              );
            }
          ),
      };

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

      const actionResult = result as any;

      const savedFormData = {
        ...finalData,

        towers:
          actionResult.towerData?.map(
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
          actionResult.amenityData?.map(
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
          actionResult.layoutData?.map(
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

        child_markers:
          actionResult.markerData?.map(
            (marker: any) => ({
              id: marker.id,
              interest_name:
                marker.interest_name || '',
              address:
                marker.address || '',
              phrase:
                marker.phrase || '',
              distance_km:
                marker.distance_km != null
                  ? String(
                      marker.distance_km
                    )
                  : '',
              distance_drive:
                marker.distance_drive != null
                  ? String(
                      marker.distance_drive
                    )
                  : '',
              distance_walk:
                marker.distance_walk != null
                  ? String(
                      marker.distance_walk
                    )
                  : '',
              latitude:
                marker.latitude != null
                  ? String(
                      marker.latitude
                    )
                  : '',
              longitude:
                marker.longitude != null
                  ? String(
                      marker.longitude
                    )
                  : '',
              thumbnail:
                marker.thumbnail || '',
              marker_icon:
                marker.marker_type_table?.[0]
                  ?.icon || '',
              marker_type:
                marker.marker_type_table?.[0]
                  ?.name || 'general',
            })
          ) ??
          finalData.child_markers ??
          [],
      };

      reset(savedFormData);

      setPendingFiles({});
      setPreviews({});
      setPendingMarkerRemovalIds([]);
      setMarkerToRemove(null);

      setEditorFeedback({
        type: 'success',
        message: editId
          ? 'Changes saved.'
          : 'Project created successfully.',
      });

      const destination =
        leaveAfterSaveTarget;

      setLeaveAfterSaveTarget(null);

      if (destination) {
        router.push(destination);
        return;
      }

    } catch (error: any) {
      setEditorFeedback({
        type: 'error',
        message:
          error?.message
            ? `Could not save changes: ${error.message}`
            : 'Could not save changes. Please try again.',
      });
      setLeaveAfterSaveTarget(null);
    } finally {
      setIsSaving(false);
    }
  };

  const requestNavigation = (
    target: string
  ) => {
    if (!hasUnsavedChanges) {
      router.push(target);
      return;
    }

    setPendingNavigationTarget(target);
  };

  const handleKeepEditing = () => {
    setPendingNavigationTarget(null);
  };

  const handleDiscardAndLeave = () => {
    const target = pendingNavigationTarget;

    if (!target) return;

    setPendingNavigationTarget(null);
    setLeaveAfterSaveTarget(null);
    router.push(target);
  };

  const handleSaveAndLeave = () => {
    if (!pendingNavigationTarget || !editId) {
      return;
    }

    const target = pendingNavigationTarget;

    setPendingNavigationTarget(null);
    setLeaveAfterSaveTarget(target);

    void handleSubmit(
      onSubmit,
      () => {
        setLeaveAfterSaveTarget(null);
        handleProjectValidationError();
      }
    )();
  };

  const previewData = {
    title: formData.title || 'Project Title',
    city: formData.city || 'City',
    country: formData.country || 'Country',
    virtual_tours: projectTours,
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
      amenities_title_gold: formData.amenities_title_gold || `Way Of Living in ${formData.title || 'this project'}.`,
      map_subtitle: formData.map_subtitle || 'Everything you need, strategically positioned right around your sanctuary.'
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
  })) : [],
    map_subtitle:
      formData.map_subtitle ||
      'Everything you need, strategically positioned right around your sanctuary.',
    map_latitude:
      formData.map_latitude || '',
    map_longitude:
      formData.map_longitude || '',
    map_icon:
      previews['map_icon'] ||
      formData.map_icon ||
      '',
    child_markers:
      formData.child_markers?.length > 0
        ? formData.child_markers.map(
            (marker, index) => ({
              id:
                marker.id ??
                index + 1,
              editorIndex:
                index,
              interest_name:
                marker.interest_name ||
                `Landmark ${index + 1}`,
              address:
                marker.address || '',
              phrase:
                marker.phrase || '',
              distance_km:
                marker.distance_km || '',
              distance_drive:
                marker.distance_drive || '',
              distance_walk:
                marker.distance_walk || '',
              latitude:
                marker.latitude || '',
              longitude:
                marker.longitude || '',
              thumbnail:
                previews[
                  `child_markers.${index}.thumbnail`
                ] ||
                marker.thumbnail ||
                '',
              marker_icon:
                previews[
                  `child_markers.${index}.marker_icon`
                ] ||
                marker.marker_icon ||
                '',
              marker_type:
                marker.marker_type ||
                'general',
            })
          )
        : [],
  };

    const applyResetEditorChanges = () => {
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
    setPendingMarkerRemovalIds([]);
    setMarkerToRemove(null);
    setAmenityToRemove(null);
    setLayoutToRemove(null);
    setLayoutEditorError('');
    setTowerError('');
    setTowerRenameError('');
    setTowerDeleteError('');

    reset();
    setResetConfirmationOpen(false);
    setEditorFeedback({
      type: 'info',
      message: 'Changes reset to the last saved version.',
    });
  };

  const handleRequestResetEditorChanges = () => {
    if (
      !hasUnsavedChanges ||
      isSaving ||
      isSubmitting
    ) {
      return;
    }

    setResetConfirmationOpen(true);
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


  const selectedMarkerIndex =
    typeof selectedEditorRegion ===
      'string' &&
    selectedEditorRegion.startsWith(
      'landmark:'
    )
      ? Number(
          selectedEditorRegion.split(
            ':'
          )[1]
        )
      : null;

  const selectedMarker =
    selectedMarkerIndex !== null &&
    Number.isInteger(
      selectedMarkerIndex
    )
      ? formData.child_markers?.[
          selectedMarkerIndex
        ]
      : null;

  const selectedMarkerId =
    selectedMarker?.id !== undefined &&
    selectedMarker?.id !== null &&
    selectedMarker?.id !== ''
      ? Number(selectedMarker.id)
      : null;

  const selectedMarkerPendingRemoval =
    selectedMarkerId !== null &&
    Number.isInteger(
      selectedMarkerId
    ) &&
    pendingMarkerRemovalIds.includes(
      selectedMarkerId
    );

  const markerTypeSuggestions =
    Array.from(
      new Set(
        (formData.child_markers || [])
          .map(
            (marker) =>
              marker.marker_type?.trim()
          )
          .filter(
            (value): value is string =>
              Boolean(value)
          )
      )
    );

  const handleAddLandmark = () => {
    const newIndex =
      markerFields.length;

    appendMarker({
      id: null,
      interest_name: '',
      address: '',
      phrase: '',
      distance_km: '',
      distance_drive: '',
      distance_walk: '',
      latitude: '',
      longitude: '',
      thumbnail: '',
      marker_icon: '',
      marker_type: 'general',
    });

    setSelectedEditorRegion(
      `landmark:${newIndex}`
    );
  };

  const handleRequestRemoveLandmark = (
    index: number
  ) => {
    const marker =
      formData.child_markers?.[index];

    if (!marker) return;

    setMarkerToRemove({
      index,
      title:
        marker.interest_name?.trim() ||
        `Landmark ${index + 1}`,
    });
  };

  const handleCancelRemoveLandmark = () => {
    setMarkerToRemove(null);
  };

  const handleConfirmRemoveLandmark = () => {
    if (!markerToRemove) return;

    const marker =
      formData.child_markers?.[
        markerToRemove.index
      ];

    if (!marker) {
      setMarkerToRemove(null);
      return;
    }

    const parsedId =
      marker.id !== undefined &&
      marker.id !== null &&
      marker.id !== ''
        ? Number(marker.id)
        : null;

    if (
      parsedId !== null &&
      Number.isInteger(parsedId)
    ) {
      // Existing DB landmark: keep it visible and stage its deletion.
      setPendingMarkerRemovalIds(
        (current) =>
          current.includes(parsedId)
            ? current
            : [...current, parsedId]
      );

      setMarkerToRemove(null);
      setSelectedEditorRegion(
        'points-of-interest'
      );
      return;
    }

    // New unsaved landmark: there is no DB row to stage.
    removeNestedFieldFiles(
      'child_markers',
      markerToRemove.index
    );

    removeMarker(
      markerToRemove.index
    );

    setMarkerToRemove(null);
    setSelectedEditorRegion(
      'points-of-interest'
    );
  };

  const handleUndoRemoveLandmark = (
    markerId: number
  ) => {
    setPendingMarkerRemovalIds(
      (current) =>
        current.filter(
          (id) => id !== markerId
        )
    );
  };

  const markerRemoveModal =
    markerToRemove ? (
      <div
        className="
          fixed inset-0 z-[260]
          flex items-center justify-center
          bg-brand-blue/55
          backdrop-blur-sm
          p-4
        "
        onMouseDown={
          handleCancelRemoveLandmark
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
              Remove Landmark
            </p>

            <h3
              className="
                mt-1
                text-xl
                font-semibold
                text-brand-blue
              "
            >
              Remove {
                markerToRemove.title
              }?
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
              Existing landmarks stay visible as
              pending removal until you save.
              Use Undo or Reset if you change
              your mind.
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
                handleCancelRemoveLandmark
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
                handleConfirmRemoveLandmark
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
              Remove Landmark
            </button>
          </div>
        </div>
      </div>
    ) : null;

  const resetConfirmationModal =
    resetConfirmationOpen ? (
      <div
        className="
          fixed inset-0 z-[290]
          flex items-center justify-center
          bg-brand-blue/55
          backdrop-blur-sm
          p-4
        "
        onMouseDown={() =>
          setResetConfirmationOpen(false)
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
          onMouseDown={(event) =>
            event.stopPropagation()
          }
        >
          <div className="border-b border-gray-100 px-6 py-5">
            <div
              className="
                flex items-center gap-2
                text-[10px]
                font-bold uppercase
                tracking-widest
                text-amber-600
              "
            >
              <AlertCircle size={14} />
              Unsaved Changes
            </div>

            <h3 className="mt-2 text-xl font-semibold text-brand-blue">
              Reset your changes?
            </h3>
          </div>

          <div className="px-6 py-5">
            <p className="text-sm leading-relaxed text-gray-500">
              This will discard the changes made since your last save and restore the saved project.
            </p>
          </div>

          <div
            className="
              flex justify-end gap-2
              border-t border-gray-100
              bg-gray-50
              px-6 py-4
            "
          >
            <button
              type="button"
              onClick={() =>
                setResetConfirmationOpen(false)
              }
              className="
                rounded-lg
                px-4 py-2.5
                text-xs font-bold
                text-gray-500
                hover:bg-gray-100
              "
            >
              Keep Editing
            </button>

            <button
              type="button"
              onClick={applyResetEditorChanges}
              className="
                rounded-lg
                border border-red-200
                bg-white
                px-4 py-2.5
                text-xs font-bold
                text-red-600
                hover:bg-red-50
              "
            >
              Reset Changes
            </button>
          </div>
        </div>
      </div>
    ) : null;

  const unsavedNavigationModal =
    pendingNavigationTarget ? (
      <div
        className="
          fixed inset-0 z-[280]
          flex items-center justify-center
          bg-brand-blue/55
          backdrop-blur-sm
          p-4
        "
        onMouseDown={handleKeepEditing}
      >
        <div
          className="
            w-full max-w-md
            overflow-hidden
            rounded-2xl
            bg-white
            shadow-2xl
          "
          onMouseDown={(event) =>
            event.stopPropagation()
          }
        >
          <div
            className="
              border-b border-gray-100
              px-6 py-5
            "
          >
            <div
              className="
                flex items-center gap-2
                text-[10px]
                font-bold uppercase
                tracking-widest
                text-amber-600
              "
            >
              <AlertCircle size={14} />
              Unsaved Changes
            </div>

            <h3
              className="
                mt-2
                text-xl
                font-semibold
                text-brand-blue
              "
            >
              Leave this project?
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
              You have changes that have not been saved yet.
              Keep editing, discard them, or save before leaving.
            </p>
          </div>

          <div
            className="
              flex flex-col-reverse
              sm:flex-row
              sm:justify-end
              gap-2
              border-t border-gray-100
              bg-gray-50
              px-6 py-4
            "
          >
            <button
              type="button"
              onClick={handleKeepEditing}
              className="
                rounded-lg
                px-4 py-2.5
                text-xs font-bold
                text-gray-500
                hover:bg-gray-100
              "
            >
              Keep Editing
            </button>

            <button
              type="button"
              onClick={handleDiscardAndLeave}
              className="
                rounded-lg
                border border-red-200
                bg-white
                px-4 py-2.5
                text-xs font-bold
                text-red-600
                hover:bg-red-50
              "
            >
              Discard &amp; Leave
            </button>

            {editId && (
              <button
                type="button"
                onClick={handleSaveAndLeave}
                disabled={
                  isSaving || isSubmitting
                }
                className="
                  inline-flex
                  items-center
                  justify-center
                  gap-2
                  rounded-lg
                  bg-brand-blue
                  px-4 py-2.5
                  text-xs font-bold
                  text-white
                  hover:bg-brand-blue/90
                  disabled:opacity-50
                  disabled:cursor-not-allowed
                "
              >
                {(isSaving || isSubmitting) ? (
                  <Loader2
                    size={14}
                    className="animate-spin"
                  />
                ) : (
                  <Save size={14} />
                )}
                Save &amp; Leave
              </button>
            )}
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
    <>
      {unsavedNavigationModal}
      <div
      className="
        min-h-screen
        bg-[#F7F8FA]
        text-gray-900
        font-sans
      "
    >
      {/* PERSISTENT TOP ACTION BAR */}
      <header
        className="
          fixed inset-x-0 top-0
          z-50
          h-20
          bg-white/95
          backdrop-blur-md
          border-b border-gray-200
          shadow-[0_1px_0_rgba(15,23,42,0.04)]
          flex items-center
          justify-between
          gap-4
          px-6 md:px-10
        "
      >
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() =>
              requestNavigation(
                '/admin/dashboard?section=Projects'
              )
            }
            className="
              inline-flex items-center gap-2
              rounded-lg
              px-2.5 py-2
              text-xs
              font-bold
              text-gray-500
              hover:text-brand-blue
              hover:bg-gray-100
              transition-colors
              shrink-0
            "
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back to Projects</span>
          </button>

          <div className="hidden md:block h-6 w-px bg-gray-200" />

          <div className="min-w-0 hidden md:block">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Projects / New Project
            </p>
            <p className="text-sm font-bold text-brand-blue truncate">
              Add New Project
            </p>
          </div>
        </div>

        <button
          type="submit"
          form="new-project-form"
          disabled={isCreatingBasic}
          className="
            inline-flex
            items-center
            justify-center
            gap-2
            min-w-[190px]
            rounded-lg
            bg-brand-blue
            px-4 py-2.5
            text-xs
            font-bold
            text-white
            shadow-sm
            hover:bg-brand-blue/90
            transition-colors
            disabled:opacity-60
            disabled:cursor-not-allowed
            shrink-0
          "
        >
          {isCreatingBasic ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <PlusCircle size={15} />
              Create &amp; Continue
            </>
          )}
        </button>
      </header>


      <main
        className="
          max-w-4xl
          mx-auto
          px-6
          pt-28 md:pt-32
          pb-10 md:pb-14
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
          id="new-project-form"
          onSubmit={
            handleBasicSubmit(
              onCreateBasicProject,
              handleBasicValidationError
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
                requestNavigation(
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
    </>
  );
}

// ==========================================
// PROJECT VISUAL EDITOR
// ==========================================

if (editId) {
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
      {markerRemoveModal}
      {resetConfirmationModal}
      {unsavedNavigationModal}

      {/* NON-BLOCKING EDITOR FEEDBACK */}
      {editorFeedback && (
        <div
          role={
            editorFeedback.type === 'error'
              ? 'alert'
              : 'status'
          }
          aria-live="polite"
          className={`
            fixed
            top-24
            left-4 right-4
            sm:left-auto sm:right-6
            sm:max-w-md
            z-[100]
            flex
            items-start
            gap-2.5
            rounded-xl
            border
            bg-white
            px-4 py-3
            shadow-xl
            ${
              editorFeedback.type === 'error'
                ? 'border-red-200'
                : editorFeedback.type === 'success'
                ? 'border-emerald-200'
                : 'border-blue-200'
            }
          `}
        >
          {editorFeedback.type === 'error' ? (
            <AlertCircle
              size={17}
              className="mt-0.5 shrink-0 text-red-500"
            />
          ) : (
            <CheckCircle2
              size={17}
              className={`
                mt-0.5 shrink-0
                ${
                  editorFeedback.type === 'success'
                    ? 'text-emerald-500'
                    : 'text-brand-blue'
                }
              `}
            />
          )}

          <span
            className={`
              text-xs
              font-bold
              leading-relaxed
              ${
                editorFeedback.type === 'error'
                  ? 'text-red-700'
                  : 'text-brand-blue'
              }
            `}
          >
            {editorFeedback.message}
          </span>
        </div>
      )}


      {/* EDITOR TOP BAR */}
      <header
        className="
          sticky top-0
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
              requestNavigation(
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

          {/* SAVE STATUS */}
          {(isSaving || isSubmitting) ? (
            <span
              className="
                hidden lg:inline-flex
                items-center gap-1.5
                text-xs font-medium
                text-brand-blue
                whitespace-nowrap
              "
            >
              <Loader2
                size={13}
                className="animate-spin"
              />
              Saving...
            </span>
          ) : editorFeedback?.type === 'success' &&
            !hasUnsavedChanges ? (
            <span
              className="
                hidden lg:inline-flex
                items-center gap-1.5
                text-xs font-medium
                text-emerald-600
                whitespace-nowrap
              "
            >
              <CheckCircle2 size={13} />
              Saved
            </span>
          ) : hasUnsavedChanges ? (
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
          ) : null}
          
          {/* RESET */}
          <button
            type="button"
            onClick={handleRequestResetEditorChanges}
            title="Restore the last saved version"
            disabled={
              !hasUnsavedChanges ||
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
            onClick={handleSubmit(
              onSubmit,
              handleProjectValidationError
            )}
            disabled={
              !hasUnsavedChanges ||
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

            {(isSaving || isSubmitting)
              ? 'Saving...'
              : 'Save Changes'}
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
            onAddLandmark={
              handleAddLandmark
            }
            pendingRemovedLandmarkIds={
              pendingMarkerRemovalIds
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
              : selectedEditorRegion === 'editorial-title'
              ? 'Editorial Headline'
              : selectedEditorRegion === 'editorial-description'
              ? 'Editorial Description'
              : selectedEditorRegion === 'editorial-visuals'
              ? 'Editorial Image & Background'
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
              : selectedEditorRegion ===
                'points-of-interest'
              ? 'Points of Interest'
              : selectedEditorRegion?.startsWith(
                  'landmark:'
                )
              ? selectedMarker?.interest_name ||
                'Landmark'
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

                <div
                  className="
                    rounded-xl
                    border border-brand-blue/10
                    bg-brand-blue/[0.03]
                    px-4 py-3
                  "
                >
                  <p className="text-[10px] leading-relaxed text-gray-500">
                    This is the public-facing location shown in the hero.
                    Exact map coordinates are managed separately under
                    Points of Interest.
                  </p>
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
                  {tagFields.length === 0 ? (
                    <div
                      className="
                        rounded-xl
                        border-2
                        border-dashed
                        border-gray-200
                        bg-gray-50/70
                        px-4 py-6
                        text-center
                      "
                    >
                      <p className="text-xs font-medium text-brand-blue">
                        No project tags yet
                      </p>

                      <p className="mx-auto mt-1 max-w-xs text-[10px] leading-relaxed text-gray-400">
                        Add short public-facing labels such as Pre-Selling,
                        Residential, or Ready for Occupancy.
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          appendTag({
                            tag_name: ''
                          })
                        }
                        className="
                          mt-4
                          inline-flex
                          items-center
                          justify-center
                          gap-2
                          rounded-lg
                          bg-brand-blue
                          px-3 py-2
                          text-[10px]
                          font-bold
                          text-white
                          transition-colors
                          hover:bg-brand-gold
                          hover:text-brand-blue
                        "
                      >
                        <PlusCircle size={13} />
                        Add First Tag
                      </button>
                    </div>
                  ) : (
                    tagFields.map(
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
                            aria-label="Remove tag"
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
                    )
                  )}
                </div>

                <p className="mt-3 text-[10px] leading-relaxed text-gray-400">
                  Tags are descriptive labels. Total SQM and Total Units below
                  are separate project statistics.
                </p>


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

            {/* EDITORIAL HEADLINE */}
            {selectedEditorRegion ===
              'editorial-title' && (
              <div className="space-y-6">
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

                  <textarea
                    {...register(
                      'editorial_title'
                    )}
                    rows={4}
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

                <div
                  className="
                    border-t
                    border-gray-100
                    pt-5
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

                  <p
                    className="
                      mt-2
                      text-[10px]
                      leading-relaxed
                      text-gray-400
                    "
                  >
                    Click the editorial headline
                    in the preview whenever you
                    want to return to these
                    controls.
                  </p>
                </div>
              </div>
            )}


            {/* EDITORIAL DESCRIPTION */}
            {selectedEditorRegion ===
              'editorial-description' && (
              <div className="space-y-6">
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
                    rows={10}
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

                <div
                  className="
                    border-t
                    border-gray-100
                    pt-5
                  "
                >
                  <ColorInputSync
                    label="Text Color"
                    fieldName="editorial_desc_color"
                    register={register}
                    watch={watch}
                    setValue={setValue}
                    inputStyles={inputStyles}
                    labelStyles={labelStyles}
                  />

                  <p
                    className="
                      mt-2
                      text-[10px]
                      leading-relaxed
                      text-gray-400
                    "
                  >
                    Text and color stay together
                    because they describe the same
                    visible element.
                  </p>
                </div>
              </div>
            )}


            {/* EDITORIAL IMAGE + BACKGROUND */}
            {selectedEditorRegion ===
              'editorial-visuals' && (
              <div className="space-y-6">
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
                    Click the image or the empty
                    background area of the
                    editorial section to open
                    these visual controls.
                  </p>
                </div>

                <div
                  className="
                    border-t
                    border-gray-100
                    pt-5
                  "
                >
                  <ColorInputSync
                    label="Section Background Color"
                    fieldName="editorial_bg_color"
                    register={register}
                    watch={watch}
                    setValue={setValue}
                    inputStyles={inputStyles}
                    labelStyles={labelStyles}
                  />

                  <p
                    className="
                      mt-2
                      text-[10px]
                      leading-relaxed
                      text-gray-400
                    "
                  >
                    The image and section
                    background share one inspector
                    because they define the
                    editorial section's visual
                    treatment.
                  </p>
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

                <p className="-mt-3 text-[10px] leading-relaxed text-gray-400">
                  This image appears in the amenities carousel. A landscape
                  image with the subject near the center works best.
                </p>


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

                <p className="-mt-3 text-[10px] leading-relaxed text-gray-400">
                  Transparent PNG or WebP floorplans work best so the drawing
                  stays clear on the white blueprint card.
                </p>

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


            {/* POINTS OF INTEREST SECTION */}
            {selectedEditorRegion ===
              'points-of-interest' && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-bold text-brand-blue">
                    Map Section
                  </p>

                  <p className="mt-1 text-[10px] leading-relaxed text-gray-400">
                    Edit the project map context and manage nearby landmarks.
                    The live public map remains interactive on the website;
                    this editor uses a simplified preview so map controls do
                    not compete with content editing.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                    Section Subtitle
                  </label>

                  <textarea
                    {...register(
                      'map_subtitle'
                    )}
                    rows={3}
                    placeholder="Everything you need, strategically positioned right around your sanctuary."
                    className="
                      w-full
                      resize-none
                      rounded-xl
                      border border-gray-200
                      bg-white
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

                <div
                  className="
                    overflow-hidden
                    rounded-xl
                    border border-gray-200
                    bg-white
                  "
                >
                  <div className="border-b border-gray-100 px-4 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-blue">
                      Project Map Location
                    </p>

                    <p className="mt-1 text-[9px] leading-relaxed text-gray-400">
                      These coordinates place the development itself on the
                      map. They are separate from nearby landmark coordinates.
                    </p>
                  </div>

                  <div className="space-y-4 p-4">
                    <details
                      className="
                        rounded-xl
                        border border-gray-200
                        bg-gray-50
                      "
                    >
                      <summary
                        className="
                          cursor-pointer
                          list-none
                          px-4 py-3
                          text-[10px]
                          font-bold
                          uppercase
                          tracking-wider
                          text-brand-blue
                        "
                      >
                        Location Coordinates
                      </summary>

                      <div className="grid grid-cols-2 gap-3 border-t border-gray-200 p-4">
                        <div>
                          <label className="mb-2 block text-[9px] font-bold uppercase tracking-wider text-gray-400">
                            Latitude
                          </label>

                          <input
                            type="text"
                            inputMode="decimal"
                            {...register(
                              'map_latitude'
                            )}
                            placeholder="14.5995"
                            className="
                              w-full rounded-lg
                              border border-gray-200
                              bg-white
                              px-3 py-2.5
                              text-xs
                              text-brand-blue
                              outline-none
                              focus:border-brand-gold
                            "
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-[9px] font-bold uppercase tracking-wider text-gray-400">
                            Longitude
                          </label>

                          <input
                            type="text"
                            inputMode="decimal"
                            {...register(
                              'map_longitude'
                            )}
                            placeholder="120.9842"
                            className="
                              w-full rounded-lg
                              border border-gray-200
                              bg-white
                              px-3 py-2.5
                              text-xs
                              text-brand-blue
                              outline-none
                              focus:border-brand-gold
                            "
                          />
                        </div>
                      </div>
                    </details>

                    <ImageDropzone
                      fieldPath="map_icon"
                      label="Project Map Pin"
                      height="h-32"
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

                    <p className="text-[9px] leading-relaxed text-gray-400">
                      A transparent PNG or SVG works best for the project pin.
                    </p>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-6">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-blue">
                        Nearby Landmarks
                      </p>

                      <p className="mt-1 text-[9px] leading-relaxed text-gray-400">
                        {markerFields.length}{' '}
                        {markerFields.length === 1
                          ? 'landmark'
                          : 'landmarks'}{' '}
                        configured
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={
                      handleAddLandmark
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
                      transition-colors
                      hover:bg-brand-gold
                      hover:text-brand-blue
                    "
                  >
                    <PlusCircle size={15} />
                    Add Landmark
                  </button>

                  <p className="mt-3 text-[10px] leading-relaxed text-gray-400">
                    Select any landmark card in the preview to edit its
                    details. New landmarks also appear as the last card in
                    the section.
                  </p>
                </div>
              </div>
            )}

            {/* INDIVIDUAL LANDMARK */}
            {selectedMarkerIndex !== null &&
              selectedMarker && (
              <div className="space-y-6">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedEditorRegion(
                      'points-of-interest'
                    )
                  }
                  className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-brand-blue"
                >
                  <ArrowLeft size={13} />
                  Points of Interest
                </button>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                    Landmark Name
                  </label>

                  <input
                    {...register(
                      `child_markers.${selectedMarkerIndex}.interest_name`
                    )}
                    placeholder="e.g. SM City"
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

                  {errors?.child_markers?.[
                    selectedMarkerIndex
                  ]?.interest_name && (
                    <p className="mt-1.5 text-[10px] font-medium text-red-500">
                      {
                        errors.child_markers[
                          selectedMarkerIndex
                        ]?.interest_name
                          ?.message
                      }
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                    Address
                  </label>

                  <input
                    {...register(
                      `child_markers.${selectedMarkerIndex}.address`
                    )}
                    placeholder="Street, city, or area"
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
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                    Short Description
                  </label>

                  <input
                    {...register(
                      `child_markers.${selectedMarkerIndex}.phrase`
                    )}
                    placeholder="e.g. Everyday essentials nearby"
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
                </div>

                <div
                  className="
                    rounded-xl
                    border border-gray-200
                    bg-gray-50
                    p-4
                  "
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-blue">
                    Distance &amp; Travel Time
                  </p>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div>
                      <label className="mb-2 block text-[9px] font-bold uppercase tracking-wider text-gray-400">
                        Distance
                      </label>

                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          {...register(
                            `child_markers.${selectedMarkerIndex}.distance_km`
                          )}
                          className="
                            w-full rounded-lg
                            border border-gray-200
                            bg-white
                            px-3 py-2.5 pr-8
                            text-xs
                            text-brand-blue
                            outline-none
                            focus:border-brand-gold
                          "
                        />

                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-300">
                          KM
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-[9px] font-bold uppercase tracking-wider text-gray-400">
                        Drive
                      </label>

                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          {...register(
                            `child_markers.${selectedMarkerIndex}.distance_drive`
                          )}
                          className="
                            w-full rounded-lg
                            border border-gray-200
                            bg-white
                            px-3 py-2.5 pr-9
                            text-xs
                            text-brand-blue
                            outline-none
                            focus:border-brand-gold
                          "
                        />

                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-300">
                          MIN
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-[9px] font-bold uppercase tracking-wider text-gray-400">
                        Walk
                      </label>

                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          {...register(
                            `child_markers.${selectedMarkerIndex}.distance_walk`
                          )}
                          className="
                            w-full rounded-lg
                            border border-gray-200
                            bg-white
                            px-3 py-2.5 pr-9
                            text-xs
                            text-brand-blue
                            outline-none
                            focus:border-brand-gold
                          "
                        />

                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-300">
                          MIN
                        </span>
                      </div>
                    </div>
                  </div>

                  {(errors?.child_markers?.[
                    selectedMarkerIndex
                  ]?.distance_km ||
                    errors?.child_markers?.[
                      selectedMarkerIndex
                    ]?.distance_drive ||
                    errors?.child_markers?.[
                      selectedMarkerIndex
                    ]?.distance_walk) && (
                    <p className="mt-2 text-[9px] font-medium text-red-500">
                      Distance, drive time, and walk time are required.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                    Category / Tag
                  </label>

                  <input
                    list="landmark-type-suggestions"
                    {...register(
                      `child_markers.${selectedMarkerIndex}.marker_type`
                    )}
                    placeholder="e.g. retail"
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

                  <datalist id="landmark-type-suggestions">
                    {!markerTypeSuggestions
                      .some(
                        (value) =>
                          value.toLowerCase() ===
                          'general'
                      ) && (
                      <option value="general" />
                    )}

                    {markerTypeSuggestions.map(
                      (value) => (
                        <option
                          key={value}
                          value={value}
                        />
                      )
                    )}
                  </datalist>

                  <p className="mt-1.5 text-[9px] leading-relaxed text-gray-400">
                    Keep category names short and consistent across landmarks.
                  </p>
                </div>

                <div>
                  <ImageDropzone
                    fieldPath={`child_markers.${selectedMarkerIndex}.marker_icon`}
                    label="Custom Map Icon"
                    height="h-28"
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

                  <p className="mt-2 text-[9px] leading-relaxed text-gray-400">
                    Optional. Use a small transparent icon if this landmark
                    needs a custom pin on the public map.
                  </p>
                </div>

                <div>
                  <ImageDropzone
                    fieldPath={`child_markers.${selectedMarkerIndex}.thumbnail`}
                    label="Landmark Photo"
                    height="h-36"
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

                  <p className="mt-2 text-[9px] leading-relaxed text-gray-400">
                    Used for the landmark preview/card. A simple landscape
                    photo is easiest to recognize at a glance.
                  </p>
                </div>

                <details
                  className="
                    overflow-hidden
                    rounded-xl
                    border border-gray-200
                    bg-white
                  "
                >
                  <summary
                    className="
                      cursor-pointer
                      list-none
                      px-4 py-3
                      text-[10px]
                      font-bold
                      uppercase
                      tracking-wider
                      text-brand-blue
                    "
                  >
                    Advanced Location Details
                  </summary>

                  <div className="border-t border-gray-100 p-4">
                    <p className="mb-3 text-[9px] leading-relaxed text-gray-400">
                      Required for exact map placement. Copy the latitude and
                      longitude from your mapping source.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-2 block text-[9px] font-bold uppercase tracking-wider text-gray-400">
                          Latitude
                        </label>

                        <input
                          type="text"
                          inputMode="decimal"
                          {...register(
                            `child_markers.${selectedMarkerIndex}.latitude`
                          )}
                          className="
                            w-full rounded-lg
                            border border-gray-200
                            bg-gray-50
                            px-3 py-2.5
                            text-xs
                            text-brand-blue
                            outline-none
                            focus:border-brand-gold
                            focus:bg-white
                          "
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-[9px] font-bold uppercase tracking-wider text-gray-400">
                          Longitude
                        </label>

                        <input
                          type="text"
                          inputMode="decimal"
                          {...register(
                            `child_markers.${selectedMarkerIndex}.longitude`
                          )}
                          className="
                            w-full rounded-lg
                            border border-gray-200
                            bg-gray-50
                            px-3 py-2.5
                            text-xs
                            text-brand-blue
                            outline-none
                            focus:border-brand-gold
                            focus:bg-white
                          "
                        />
                      </div>
                    </div>
                  </div>
                </details>

                {(errors?.child_markers?.[
                  selectedMarkerIndex
                ]?.latitude ||
                  errors?.child_markers?.[
                    selectedMarkerIndex
                  ]?.longitude) && (
                  <p className="-mt-3 text-[9px] font-medium leading-relaxed text-red-500">
                    Latitude and longitude are required before this landmark can
                    be saved.
                  </p>
                )}

                <div className="border-t border-gray-100 pt-6">
                  {selectedMarkerPendingRemoval &&
                  selectedMarkerId !== null ? (
                    <div
                      className="
                        rounded-xl
                        border border-amber-200
                        bg-amber-50
                        p-4
                      "
                    >
                      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">
                        Pending removal
                      </p>

                      <p className="mt-1.5 text-[10px] leading-relaxed text-amber-700/80">
                        This landmark is still on screen and in the database.
                        It will only be deleted when you save your changes.
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          handleUndoRemoveLandmark(
                            selectedMarkerId
                          )
                        }
                        className="
                          mt-3
                          w-full
                          rounded-lg
                          border border-amber-300
                          bg-white
                          px-3 py-2.5
                          text-xs font-bold
                          text-amber-700
                          hover:bg-amber-100
                          transition-colors
                        "
                      >
                        Undo Removal
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        handleRequestRemoveLandmark(
                          selectedMarkerIndex
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
                        transition-colors
                        hover:bg-red-100
                      "
                    >
                      <Trash2 size={15} />
                      Remove Landmark
                    </button>
                  )}
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

        </aside>
      </div>
    </div>
  );
}

  return null;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#E7E7E7]"><Loader2 size={40} className="animate-spin text-brand-blue" /></div>}>
      <ProjectManager />
    </Suspense>
  );
}