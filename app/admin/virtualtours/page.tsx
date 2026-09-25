// app/admin/virtualtours/page.tsx
'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, PlusCircle, CheckCircle2, Loader2, Trash2, Image as ImageIcon, Layers, Home, RotateCcw, ExternalLink, AlertTriangle, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import PreviewSkeleton from './PreviewSkeleton';
import { 
  fetchProjectsForDropdown, 
  fetchProjectVirtualTours, 
  saveProjectVirtualToursAction, 
  createAuditLogAction 
} from '@/app/actions/admin_fetchers';

interface ViewArea {
  id: string;
  title: string;
  file: File | null;
  url: string;
}

interface UnitTour {
  id: string | number;
  unit_name: string;
  title: string;
  tower_name: string;
  status: string;
  view_areas: ViewArea[];
}

interface ProjectTowerOption {
  id?: number;
  name: string;
  sort_order?: number | null;
}

interface ProjectOption {
  id: number;
  title: string;
  project_towers?: ProjectTowerOption[];
  unit_layout?: Array<{ tower_name?: string | null }>;
}

function parseTourRows(rawTours: any[]): UnitTour[] {
  return (rawTours || []).map((tour: any) => {
    let areas = tour.view_areas || tour.rooms || [];

    if (typeof areas === 'string') {
      try {
        areas = JSON.parse(areas);
      } catch {
        areas = [];
      }
    }

    return {
      id: tour.id,
      unit_name: tour.unit_name || tour.title || 'Standard Unit',
      title: tour.title || tour.unit_name || 'Standard Unit',
      tower_name: tour.tower_name || 'Tower A',
      status: tour.status || 'Active',
      view_areas: (Array.isArray(areas) ? areas : []).map((area: any, index: number) => ({
        id: `db-${tour.id}-${index}`,
        title: area.title || `Area ${index + 1}`,
        url: area.image || '',
        file: null,
      })),
    };
  });
}

function cloneTours(tours: UnitTour[]): UnitTour[] {
  return tours.map((tour) => ({
    ...tour,
    view_areas: tour.view_areas.map((area) => ({ ...area, file: null })),
  }));
}

function getToursFingerprint(tours: UnitTour[], deletedIds: number[]) {
  return JSON.stringify({
    tours: tours.map((tour) => ({
      id: tour.id,
      unit_name: tour.unit_name,
      title: tour.title,
      tower_name: tour.tower_name,
      status: tour.status,
      view_areas: tour.view_areas.map((area) => ({
        id: area.id,
        title: area.title,
        url: area.url,
        file: area.file
          ? {
              name: area.file.name,
              size: area.file.size,
              lastModified: area.file.lastModified,
            }
          : null,
      })),
    })),
    deletedIds: [...deletedIds].sort((a, b) => a - b),
  });
}

function VirtualToursManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [isFetchingProjects, setIsFetchingProjects] = useState(true);
  const [isFetchingTours, setIsFetchingTours] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [projectsList, setProjectsList] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const [tours, setTours] = useState<UnitTour[]>([]);
  const [deletedTourIds, setDeletedTourIds] = useState<number[]>([]);
  const [baselineTours, setBaselineTours] = useState<UnitTour[]>([]);
  const [baselineFingerprint, setBaselineFingerprint] = useState('');

  const [selectedTower, setSelectedTower] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string | number | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedInspector, setSelectedInspector] = useState<'project' | 'tower' | 'unit' | 'area'>('unit');

  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [unitPendingDelete, setUnitPendingDelete] = useState<UnitTour | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [pendingLeaveUrl, setPendingLeaveUrl] = useState<string | null>(null);
  const [pendingProjectId, setPendingProjectId] = useState<number | null>(null);

  const selectedProject = useMemo(
    () => projectsList.find((project) => project.id === selectedProjectId) || null,
    [projectsList, selectedProjectId]
  );

  const projectTowerNames = useMemo(() => {
    const registry = [...(selectedProject?.project_towers || [])]
      .sort((a, b) => {
        const aOrder = a.sort_order ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.sort_order ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      })
      .map((tower) => tower.name?.trim())
      .filter((name): name is string => Boolean(name));

    const layoutFallback = (selectedProject?.unit_layout || [])
      .map((layout) => layout.tower_name?.trim())
      .filter((name): name is string => Boolean(name));

    const legacyTourTowers = tours
      .map((tour) => tour.tower_name?.trim())
      .filter((name): name is string => Boolean(name));

    return Array.from(new Set([...registry, ...layoutFallback, ...legacyTourTowers]));
  }, [selectedProject, tours]);

  const registryTowerNames = useMemo(
    () => (selectedProject?.project_towers || [])
      .map((tower) => tower.name?.trim())
      .filter((name): name is string => Boolean(name)),
    [selectedProject]
  );

  const availableTowers = projectTowerNames;

  const unitsInSelectedTower = useMemo(() => {
    if (!selectedTower) return [];
    return tours.filter(
      (tour) => tour.tower_name.trim().toLowerCase() === selectedTower.toLowerCase()
    );
  }, [tours, selectedTower]);

  const currentUnit = useMemo(() => {
    return (
      tours.find((tour) => String(tour.id) === String(selectedUnitId)) ||
      unitsInSelectedTower[0] ||
      null
    );
  }, [tours, selectedUnitId, unitsInSelectedTower]);

  const currentArea = useMemo(() => {
    if (!currentUnit) return null;
    return (
      currentUnit.view_areas.find((area) => area.id === selectedAreaId) ||
      currentUnit.view_areas[0] ||
      null
    );
  }, [currentUnit, selectedAreaId]);

  const currentFingerprint = useMemo(
    () => getToursFingerprint(tours, deletedTourIds),
    [tours, deletedTourIds]
  );

  const isDirty = Boolean(baselineFingerprint) && currentFingerprint !== baselineFingerprint;
  const currentUnitVisible = currentUnit?.status === 'Active';
  const activeProjectTitle = selectedProject?.title || 'Selected Project';

  useEffect(() => {
    async function loadProjects() {
      try {
        const projects = await fetchProjectsForDropdown();
        setProjectsList(projects || []);

        const queryProjectId = searchParams.get('project');
        if (queryProjectId && projects?.some((project: ProjectOption) => project.id === Number(queryProjectId))) {
          setSelectedProjectId(Number(queryProjectId));
        } else if (projects && projects.length > 0) {
          setSelectedProjectId(projects[0].id);
        }
      } catch (error) {
        console.error(error);
        setErrorMsg('Unable to load projects for Virtual Tours.');
      } finally {
        setIsFetchingProjects(false);
      }
    }

    loadProjects();
  }, [searchParams]);

  useEffect(() => {
    if (!selectedProjectId) return;

    async function loadTours() {
      setIsFetchingTours(true);
      setErrorMsg('');

      try {
        const rawTours = await fetchProjectVirtualTours(selectedProjectId!);
        const parsed = parseTourRows(rawTours || []);

        setTours(parsed);
        setBaselineTours(cloneTours(parsed));
        setDeletedTourIds([]);
        setBaselineFingerprint(getToursFingerprint(parsed, []));

        const project = projectsList.find((item) => item.id === selectedProjectId);
        const registry = [...(project?.project_towers || [])]
          .sort((a, b) => {
            const aOrder = a.sort_order ?? Number.MAX_SAFE_INTEGER;
            const bOrder = b.sort_order ?? Number.MAX_SAFE_INTEGER;
            return aOrder - bOrder;
          })
          .map((tower) => tower.name?.trim())
          .filter((name): name is string => Boolean(name));

        const legacy = Array.from(
          new Set(parsed.map((tour) => tour.tower_name?.trim()).filter(Boolean))
        ) as string[];

        const initialTower = registry[0] || legacy[0] || '';
        setSelectedTower(initialTower);

        const firstUnit = parsed.find(
          (tour) => initialTower && tour.tower_name.toLowerCase() === initialTower.toLowerCase()
        ) || parsed[0] || null;

        setSelectedUnitId(firstUnit?.id ?? null);
        setSelectedAreaId(firstUnit?.view_areas[0]?.id ?? null);
        setSelectedInspector(firstUnit ? 'unit' : 'tower');
      } catch (error) {
        console.error(error);
        setErrorMsg('Unable to load this project’s virtual tours.');
      } finally {
        setIsFetchingTours(false);
      }
    }

    loadTours();
  }, [selectedProjectId, projectsList]);

  useEffect(() => {
    if (!selectedTower && availableTowers.length > 0) {
      setSelectedTower(availableTowers[0]);
      return;
    }

    if (
      selectedTower &&
      availableTowers.length > 0 &&
      !availableTowers.some((tower) => tower.toLowerCase() === selectedTower.toLowerCase())
    ) {
      setSelectedTower(availableTowers[0]);
    }
  }, [availableTowers, selectedTower]);

  useEffect(() => {
    if (unitsInSelectedTower.length === 0) {
      setSelectedUnitId(null);
      setSelectedAreaId(null);
      return;
    }

    if (!unitsInSelectedTower.some((unit) => String(unit.id) === String(selectedUnitId))) {
      setSelectedUnitId(unitsInSelectedTower[0].id);
      setSelectedAreaId(unitsInSelectedTower[0].view_areas[0]?.id ?? null);
    }
  }, [unitsInSelectedTower, selectedUnitId]);

  useEffect(() => {
    if (!currentUnit) {
      setSelectedAreaId(null);
      return;
    }

    if (!currentUnit.view_areas.some((area) => area.id === selectedAreaId)) {
      setSelectedAreaId(currentUnit.view_areas[0]?.id ?? null);
    }
  }, [currentUnit, selectedAreaId]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    return () => {
      tours.forEach((tour) => {
        tour.view_areas.forEach((area) => {
          if (area.file && area.url.startsWith('blob:')) {
            URL.revokeObjectURL(area.url);
          }
        });
      });
    };
  }, []);

  const updateCurrentUnitField = (field: keyof UnitTour, value: any) => {
    if (!currentUnit) return;

    setTours((previous) =>
      previous.map((tour) =>
        tour.id === currentUnit.id ? { ...tour, [field]: value } : tour
      )
    );
  };

  const handleTowerChange = (tower: string) => {
    setSelectedTower(tower);
    setSelectedInspector('tower');
    const firstUnit = tours.find(
      (tour) => tour.tower_name.trim().toLowerCase() === tower.toLowerCase()
    );
    setSelectedUnitId(firstUnit?.id ?? null);
    setSelectedAreaId(firstUnit?.view_areas[0]?.id ?? null);
  };

  const handleUnitChange = (unitId: string | number) => {
    const unit = tours.find((tour) => String(tour.id) === String(unitId)) || null;

    if (unit?.tower_name) {
      setSelectedTower(unit.tower_name);
    }

    setSelectedInspector('unit');
    setSelectedUnitId(unitId);
    setSelectedAreaId(unit?.view_areas[0]?.id ?? null);
  };

  const openAddUnit = () => {
    if (!selectedTower) return;
    setNewUnitName('');
    setIsAddUnitOpen(true);
  };

  const confirmAddUnit = () => {
    const cleanName = newUnitName.trim();
    if (!cleanName || !selectedTower) return;

    const duplicate = unitsInSelectedTower.some(
      (unit) => unit.unit_name.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (duplicate) {
      setErrorMsg(`A unit named “${cleanName}” already exists in ${selectedTower}.`);
      return;
    }

    const timestamp = Date.now();
    const newUnit: UnitTour = {
      id: `temp-${timestamp}`,
      unit_name: cleanName,
      title: cleanName,
      tower_name: selectedTower,
      status: 'Active',
      view_areas: [
        {
          id: `area-${timestamp}`,
          title: 'Living Room',
          file: null,
          url: '',
        },
      ],
    };

    setTours((previous) => [...previous, newUnit]);
    setSelectedUnitId(newUnit.id);
    setSelectedAreaId(newUnit.view_areas[0].id);
    setSelectedInspector('unit');
    setIsAddUnitOpen(false);
    setNewUnitName('');
    setErrorMsg('');
  };

  const requestDeleteUnit = () => {
    if (currentUnit) setUnitPendingDelete(currentUnit);
  };

  const confirmDeleteUnit = () => {
    if (!unitPendingDelete) return;

    const target = unitPendingDelete;
    const remainingTours = tours.filter((tour) => tour.id !== target.id);

    if (typeof target.id === 'number') {
      setDeletedTourIds((previous) =>
        previous.includes(target.id as number)
          ? previous
          : [...previous, target.id as number]
      );
    }

    setTours(remainingTours);

    const remainingInTower = remainingTours.filter(
      (tour) => tour.tower_name.toLowerCase() === selectedTower.toLowerCase()
    );

    const nextUnit = remainingInTower[0] || remainingTours[0] || null;

    if (nextUnit && nextUnit.tower_name !== selectedTower) {
      setSelectedTower(nextUnit.tower_name);
    }

    setSelectedUnitId(nextUnit?.id ?? null);
    setSelectedAreaId(nextUnit?.view_areas[0]?.id ?? null);
    setUnitPendingDelete(null);
  };

  const addViewArea = () => {
    if (!currentUnit) return;

    const newArea: ViewArea = {
      id: `area-${Date.now()}`,
      title: '',
      file: null,
      url: '',
    };

    updateCurrentUnitField('view_areas', [...currentUnit.view_areas, newArea]);
    setSelectedAreaId(newArea.id);
    setSelectedInspector('area');
  };

  const removeViewArea = (areaId: string) => {
    if (!currentUnit || currentUnit.view_areas.length <= 1) return;

    const target = currentUnit.view_areas.find((area) => area.id === areaId);
    if (target?.file && target.url.startsWith('blob:')) {
      URL.revokeObjectURL(target.url);
    }

    const nextAreas = currentUnit.view_areas.filter((area) => area.id !== areaId);
    updateCurrentUnitField('view_areas', nextAreas);

    if (selectedAreaId === areaId) {
      setSelectedAreaId(nextAreas[0]?.id ?? null);
    }
  };

  const updateViewAreaTitle = (areaId: string, title: string) => {
    if (!currentUnit) return;

    updateCurrentUnitField(
      'view_areas',
      currentUnit.view_areas.map((area) =>
        area.id === areaId ? { ...area, title } : area
      )
    );
  };

  const handleFileChange = (areaId: string, file: File | null) => {
    if (!currentUnit || !file) return;

    const current = currentUnit.view_areas.find((area) => area.id === areaId);
    if (current?.file && current.url.startsWith('blob:')) {
      URL.revokeObjectURL(current.url);
    }

    const url = URL.createObjectURL(file);

    updateCurrentUnitField(
      'view_areas',
      currentUnit.view_areas.map((area) =>
        area.id === areaId ? { ...area, file, url } : area
      )
    );
    setSelectedAreaId(areaId);
    setSelectedInspector('area');
  };

  const validateBeforeSave = () => {
    if (!selectedProjectId) return 'Select a project before saving.';
    for (const tour of tours) {
      if (!tour.tower_name.trim()) return 'Every unit must belong to a tower.';
      if (!tour.unit_name.trim()) return 'Every virtual tour unit needs a name.';
      if (tour.view_areas.length === 0) return `${tour.unit_name} needs at least one view area.`;

      for (const area of tour.view_areas) {
        if (!area.title.trim()) return `${tour.unit_name} has a view area without a name.`;
        if (!area.url && !area.file) return `${area.title || 'A view area'} needs a panorama image.`;
      }
    }

    return '';
  };

  const handleSaveAll = async (leaveUrl?: string) => {
    const validationError = validateBeforeSave();
    if (validationError) {
      setErrorMsg(validationError);
      return false;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const preparedTours = [];

      for (const tour of tours) {
        const finalAreas = [];

        for (const area of tour.view_areas) {
          let finalUrl = area.url;

          if (area.file) {
            const fileExt = area.file.name.split('.').pop();
            const filePath = `360_tours/${Date.now()}-${Math.random()
              .toString(36)
              .substring(2, 9)}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from('images')
              .upload(filePath, area.file);

            if (uploadError) throw uploadError;

            const {
              data: { publicUrl },
            } = supabase.storage.from('images').getPublicUrl(filePath);

            finalUrl = publicUrl;
          }

          finalAreas.push({
            title: area.title.trim() || 'Perspective',
            image: finalUrl,
          });
        }

        preparedTours.push({
          id: tour.id,
          tower_name: tour.tower_name,
          unit_name: tour.unit_name.trim(),
          title: tour.title?.trim() || tour.unit_name.trim(),
          status: tour.status,
          view_areas: finalAreas,
        });
      }

      const result = await saveProjectVirtualToursAction(
        selectedProjectId!,
        preparedTours,
        deletedTourIds
      );

      const savedTours = parseTourRows(result.tours || []);

      tours.forEach((tour) => {
        tour.view_areas.forEach((area) => {
          if (area.file && area.url.startsWith('blob:')) {
            URL.revokeObjectURL(area.url);
          }
        });
      });

      setTours(savedTours);
      setBaselineTours(cloneTours(savedTours));
      setDeletedTourIds([]);
      setBaselineFingerprint(getToursFingerprint(savedTours, []));

      const matchingTower = savedTours.some(
        (tour) => tour.tower_name.toLowerCase() === selectedTower.toLowerCase()
      )
        ? selectedTower
        : savedTours[0]?.tower_name || availableTowers[0] || '';

      setSelectedTower(matchingTower);

      const nextUnit = savedTours.find(
        (tour) =>
          tour.tower_name.toLowerCase() === matchingTower.toLowerCase() &&
          tour.unit_name.toLowerCase() === currentUnit?.unit_name.toLowerCase()
      ) || savedTours.find(
        (tour) => tour.tower_name.toLowerCase() === matchingTower.toLowerCase()
      ) || savedTours[0] || null;

      setSelectedUnitId(nextUnit?.id ?? null);
      setSelectedAreaId(nextUnit?.view_areas[0]?.id ?? null);

      await createAuditLogAction(
        'EDIT',
        'Virtual Tours',
        activeProjectTitle,
        `Updated towers, units, and 360° view areas for ${activeProjectTitle}.`
      );

      setSuccessMsg('Changes saved successfully.');
      window.setTimeout(() => setSuccessMsg(''), 2200);

      if (leaveUrl) {
        router.push(leaveUrl);
      }

      return true;
    } catch (error: any) {
      setErrorMsg(error?.message || 'Unable to save Virtual Tour changes.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetChanges = () => {
    tours.forEach((tour) => {
      tour.view_areas.forEach((area) => {
        if (area.file && area.url.startsWith('blob:')) {
          URL.revokeObjectURL(area.url);
        }
      });
    });

    const restored = cloneTours(baselineTours);
    setTours(restored);
    setDeletedTourIds([]);

    const nextTower =
      availableTowers.find((tower) =>
        restored.some((tour) => tour.tower_name.toLowerCase() === tower.toLowerCase())
      ) || availableTowers[0] || '';

    setSelectedTower(nextTower);

    const nextUnit = restored.find(
      (tour) => nextTower && tour.tower_name.toLowerCase() === nextTower.toLowerCase()
    ) || restored[0] || null;

    setSelectedUnitId(nextUnit?.id ?? null);
    setSelectedAreaId(nextUnit?.view_areas[0]?.id ?? null);
    setShowResetConfirm(false);
    setErrorMsg('');
  };

  const requestLeave = (url: string) => {
    if (!isDirty) {
      router.push(url);
      return;
    }
    setPendingLeaveUrl(url);
  };

  const requestProjectChange = (projectId: number) => {
    if (projectId === selectedProjectId) return;

    if (!isDirty) {
      setSelectedInspector('project');
      setSelectedProjectId(projectId);
      router.replace(`/admin/virtualtours?project=${projectId}`);
      return;
    }

    setPendingProjectId(projectId);
  };

  const discardAndLeave = () => {
    const url = pendingLeaveUrl;
    setPendingLeaveUrl(null);
    if (url) router.push(url);
  };

  const discardAndSwitchProject = () => {
    const projectId = pendingProjectId;
    setPendingProjectId(null);
    if (projectId) {
      setSelectedInspector('project');
      setSelectedProjectId(projectId);
      router.replace(`/admin/virtualtours?project=${projectId}`);
    }
  };

  const inspectorMeta = {
    project: {
      eyebrow: 'Selected Content',
      title: 'Project',
      helper: 'Switch to another project Virtual Tour workspace or open its Project editor.',
    },
    tower: {
      eyebrow: 'Selected Content',
      title: selectedTower || 'Tower',
      helper: 'Choose which project tower and its Virtual Tour units you want to manage.',
    },
    unit: {
      eyebrow: 'Selected Content',
      title: currentUnit?.unit_name || 'Unit',
      helper: 'Manage this unit label, website visibility, and its view areas.',
    },
    area: {
      eyebrow: 'Selected Content',
      title: currentArea?.title || 'View Area',
      helper: 'Edit the selected room or perspective and replace its 360° panorama.',
    },
  }[selectedInspector];

  const inputStyles =
    'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-brand-blue outline-none transition-all focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10';
  const labelStyles =
    'mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500';

  if (isFetchingProjects) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F5F7]">
        <Loader2 className="animate-spin text-brand-blue" size={40} />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#F4F5F7] font-sans text-gray-900">
      {/* ADD UNIT MODAL */}
      {isAddUnitOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-brand-blue/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">{selectedTower}</p>
                <h2 className="mt-1 text-2xl font-serif text-brand-blue">Add Virtual Tour Unit</h2>
                <p className="mt-2 text-sm text-gray-500">Create a unit/model under this project tower.</p>
              </div>
              <button type="button" onClick={() => setIsAddUnitOpen(false)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5">
              <label className={labelStyles}>Unit Name / Model Type</label>
              <input
                autoFocus
                type="text"
                value={newUnitName}
                onChange={(event) => setNewUnitName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    confirmAddUnit();
                  }
                }}
                placeholder="e.g. 1 Bedroom, Studio, Penthouse"
                className={inputStyles}
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
              <button type="button" onClick={() => setIsAddUnitOpen(false)} className="rounded-xl px-4 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-100">
                Cancel
              </button>
              <button type="button" onClick={confirmAddUnit} disabled={!newUnitName.trim()} className="rounded-xl bg-brand-blue px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-gold disabled:cursor-not-allowed disabled:opacity-50">
                Add Unit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE UNIT MODAL */}
      {unitPendingDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-brand-blue/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
              <Trash2 size={28} />
            </div>
            <h2 className="mt-5 text-2xl font-serif text-brand-blue">Remove Unit?</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              <strong className="text-gray-700">{unitPendingDelete.unit_name}</strong> and all of its view areas will be removed when you save changes.
            </p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setUnitPendingDelete(null)} className="flex-1 rounded-xl bg-gray-100 py-3 text-xs font-bold text-gray-600 hover:bg-gray-200">Cancel</button>
              <button type="button" onClick={confirmDeleteUnit} className="flex-1 rounded-xl bg-red-600 py-3 text-xs font-bold text-white hover:bg-red-700">Remove Unit</button>
            </div>
          </div>
        </div>
      )}

      {/* RESET MODAL */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-brand-blue/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <RotateCcw size={27} />
            </div>
            <h2 className="mt-5 text-2xl font-serif text-brand-blue">Reset Changes?</h2>
            <p className="mt-2 text-sm text-gray-500">This restores the last saved Virtual Tour data for this project.</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setShowResetConfirm(false)} className="flex-1 rounded-xl bg-gray-100 py-3 text-xs font-bold text-gray-600 hover:bg-gray-200">Keep Editing</button>
              <button type="button" onClick={resetChanges} className="flex-1 rounded-xl bg-brand-blue py-3 text-xs font-bold text-white hover:bg-brand-gold">Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* UNSAVED LEAVE MODAL */}
      {pendingLeaveUrl && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-brand-blue/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
            <div className="px-7 py-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <AlertTriangle size={25} />
              </div>
              <h2 className="mt-5 text-2xl font-serif text-brand-blue">Unsaved Changes</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">You have changes that have not been saved yet.</p>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50 px-7 py-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setPendingLeaveUrl(null)} className="rounded-xl px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100">Keep Editing</button>
              <button type="button" onClick={discardAndLeave} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100">Discard & Leave</button>
              <button type="button" onClick={() => pendingLeaveUrl && handleSaveAll(pendingLeaveUrl)} disabled={isSubmitting} className="rounded-xl bg-brand-blue px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-gold disabled:opacity-50">Save & Leave</button>
            </div>
          </div>
        </div>
      )}

      {/* UNSAVED PROJECT SWITCH MODAL */}
      {pendingProjectId !== null && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-brand-blue/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600"><AlertTriangle size={27} /></div>
            <h2 className="mt-5 text-2xl font-serif text-brand-blue">Switch Project?</h2>
            <p className="mt-2 text-sm text-gray-500">Discard your unsaved Virtual Tour changes before opening another project.</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setPendingProjectId(null)} className="flex-1 rounded-xl bg-gray-100 py-3 text-xs font-bold text-gray-600 hover:bg-gray-200">Keep Editing</button>
              <button type="button" onClick={discardAndSwitchProject} className="flex-1 rounded-xl bg-brand-blue py-3 text-xs font-bold text-white hover:bg-brand-gold">Discard & Switch</button>
            </div>
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <header className="z-40 flex h-[68px] shrink-0 items-center justify-between gap-6 border-b border-gray-200 bg-white px-6 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={() => requestLeave('/admin/dashboard')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition-colors hover:border-brand-blue hover:text-brand-blue"
            aria-label="Back to Virtual Tours"
            title="Back to Virtual Tours"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">
              <span>Virtual Tours</span>
              <span className="text-gray-300">/</span>
              <span className="truncate text-gray-400">
                {activeProjectTitle}
              </span>
            </div>

            <div className="mt-0.5 flex items-center gap-3">
              <h1 className="truncate text-2xl font-serif text-brand-blue">
                Edit Virtual Tour
              </h1>

              {isDirty && (
                <span className="hidden rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-amber-700 sm:inline-flex">
                  Unsaved Changes
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            disabled={!isDirty || isSubmitting || isFetchingTours}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 transition-colors hover:border-brand-blue hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw size={14} />
            Reset
          </button>

          <button
            type="button"
            onClick={() => handleSaveAll()}
            disabled={isSubmitting || isFetchingTours || !isDirty}
            className="inline-flex min-w-[150px] items-center justify-center gap-2 rounded-xl bg-brand-blue px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-sm transition-colors hover:bg-brand-gold disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </header>

      {errorMsg && (
        <div className="absolute right-5 top-[88px] z-[90] max-w-md rounded-2xl border border-red-200 bg-white px-4 py-3 shadow-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-500" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-red-700">Unable to continue</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">{errorMsg}</p>
            </div>
            <button type="button" onClick={() => setErrorMsg('')} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={14} /></button>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="absolute right-5 top-[88px] z-[90] flex items-center gap-2 rounded-2xl border border-green-100 bg-white px-4 py-3 text-xs font-semibold text-green-700 shadow-xl">
          <CheckCircle2 size={16} />
          {successMsg}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* LIVE PREVIEW — LEFT */}
        <main className="relative min-w-0 flex-1 overflow-hidden bg-black">
          <PreviewSkeleton
            data={{
              projectName: activeProjectTitle,
              towerName: selectedTower || 'No Tower',
              unitName: currentUnit?.unit_name || 'No Unit',
              rooms: currentUnit?.view_areas || [],
            }}
            activeRoomId={selectedAreaId}
            selectedRegion={selectedInspector}
            onSelectProject={() => setSelectedInspector('project')}
            onSelectTower={() => setSelectedInspector('tower')}
            onSelectUnit={() => setSelectedInspector(currentUnit ? 'unit' : 'tower')}
            onRoomChange={(roomId) => {
              setSelectedAreaId(roomId);
              setSelectedInspector('area');
            }}
            onAddRoom={currentUnit ? addViewArea : undefined}
          />
        </main>

        {/* CONTEXTUAL INSPECTOR — RIGHT */}
        <aside className="z-20 flex w-[370px] shrink-0 flex-col border-l border-gray-200 bg-white xl:w-[410px]">
          <div className="border-b border-gray-100 px-6 py-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">
              {inspectorMeta.eyebrow}
            </p>
            <h2 className="mt-1 text-xl font-serif text-brand-blue">{inspectorMeta.title}</h2>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">{inspectorMeta.helper}</p>
          </div>

          <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-6">
            {isFetchingTours ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 py-14">
                <Loader2 className="animate-spin text-brand-blue" size={30} />
                <span className="text-xs font-medium text-gray-400">Loading virtual tour content...</span>
              </div>
            ) : (
              <>
                {selectedInspector === 'project' && (
                  <div className="space-y-5">
                    <section>
                      <label className={labelStyles}>Virtual Tour Project</label>
                      <select
                        value={selectedProjectId || ''}
                        onChange={(event) => requestProjectChange(Number(event.target.value))}
                        className={`${inputStyles} cursor-pointer font-semibold`}
                      >
                        {projectsList.map((project) => (
                          <option key={project.id} value={project.id}>{project.title}</option>
                        ))}
                      </select>
                      <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
                        Choosing another project opens that project's Virtual Tour workspace. Existing units are not relinked.
                      </p>
                    </section>

                    <section className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Project Tour Summary</p>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-white p-3 text-center shadow-sm">
                          <div className="text-lg font-bold text-brand-blue">{availableTowers.length}</div>
                          <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-gray-400">Towers</div>
                        </div>
                        <div className="rounded-xl bg-white p-3 text-center shadow-sm">
                          <div className="text-lg font-bold text-brand-blue">{tours.length}</div>
                          <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-gray-400">Units</div>
                        </div>
                        <div className="rounded-xl bg-white p-3 text-center shadow-sm">
                          <div className="text-lg font-bold text-brand-blue">{tours.reduce((sum, tour) => sum + tour.view_areas.length, 0)}</div>
                          <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-gray-400">Areas</div>
                        </div>
                      </div>
                    </section>

                    {selectedProjectId && (
                      <button
                        type="button"
                        onClick={() => requestLeave(`/admin/projects?edit=${selectedProjectId}`)}
                        className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-brand-blue/30 hover:bg-brand-blue/[0.02]"
                      >
                        <span>
                          <span className="block text-xs font-bold text-brand-blue">Open Project Editor</span>
                          <span className="mt-1 block text-[11px] text-gray-500">Edit project content and its tower registry.</span>
                        </span>
                        <ExternalLink size={16} className="text-gray-400" />
                      </button>
                    )}
                  </div>
                )}

                {selectedInspector === 'tower' && (
                  <div className="space-y-5">
                    <section>
                      <label className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        <Layers size={13} className="text-brand-gold" /> Tower
                      </label>

                      {availableTowers.length > 0 ? (
                        <select
                          value={selectedTower}
                          onChange={(event) => handleTowerChange(event.target.value)}
                          className={`${inputStyles} cursor-pointer font-semibold`}
                        >
                          {availableTowers.map((tower) => (
                            <option key={tower} value={tower}>
                              {tower}{registryTowerNames.length > 0 && !registryTowerNames.some((name) => name.toLowerCase() === tower.toLowerCase()) ? ' · Legacy' : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-4">
                          <p className="text-xs font-bold text-amber-800">No project towers configured</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-amber-700/80">
                            Add a tower in the Project editor before creating Virtual Tour units.
                          </p>
                        </div>
                      )}
                    </section>

                    {availableTowers.length > 0 && (
                      <section>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Units in {selectedTower}</p>
                            <p className="mt-1 text-[11px] text-gray-400">Select a unit or add another tour model.</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {unitsInSelectedTower.map((unit) => (
                            <button
                              key={unit.id}
                              type="button"
                              onClick={() => handleUnitChange(unit.id)}
                              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                                String(unit.id) === String(currentUnit?.id)
                                  ? 'border-brand-blue bg-brand-blue/[0.035] ring-2 ring-brand-blue/10'
                                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-bold text-brand-blue">{unit.unit_name}</span>
                                <span className="mt-1 block text-[10px] text-gray-400">{unit.view_areas.length} {unit.view_areas.length === 1 ? 'view area' : 'view areas'}</span>
                              </span>
                              <span className={`ml-3 h-2 w-2 shrink-0 rounded-full ${unit.status === 'Active' ? 'bg-green-500' : 'bg-gray-300'}`} />
                            </button>
                          ))}

                          <button
                            type="button"
                            onClick={openAddUnit}
                            disabled={!selectedTower}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 transition-all hover:border-brand-blue hover:bg-brand-blue/5 hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <PlusCircle size={14} /> Add Unit
                          </button>
                        </div>
                      </section>
                    )}

                    {selectedProjectId && (
                      <button
                        type="button"
                        onClick={() => requestLeave(`/admin/projects?edit=${selectedProjectId}`)}
                        className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left transition-colors hover:border-brand-blue/30"
                      >
                        <span>
                          <span className="block text-xs font-bold text-brand-blue">Manage Project Towers</span>
                          <span className="mt-1 block text-[11px] text-gray-500">Tower names are owned by the Project CMS.</span>
                        </span>
                        <ExternalLink size={16} className="text-gray-400" />
                      </button>
                    )}
                  </div>
                )}

                {selectedInspector === 'unit' && (
                  currentUnit ? (
                    <div className="space-y-5">
                      <section>
                        <label className={labelStyles}>Virtual Tour Unit</label>
                        <select
                          value={currentUnit.id}
                          onChange={(event) => handleUnitChange(event.target.value)}
                          className={`${inputStyles} cursor-pointer font-semibold`}
                        >
                          {availableTowers.map((tower) => {
                            const towerUnits = tours.filter(
                              (tour) => tour.tower_name.toLowerCase() === tower.toLowerCase()
                            );

                            if (towerUnits.length === 0) return null;

                            return (
                              <optgroup key={tower} label={tower}>
                                {towerUnits.map((unit) => (
                                  <option key={unit.id} value={unit.id}>
                                    {unit.unit_name || unit.title || 'Standard Unit'}
                                  </option>
                                ))}
                              </optgroup>
                            );
                          })}
                        </select>
                        <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
                          Switch directly to any Virtual Tour unit. Its tower is selected automatically.
                        </p>
                      </section>

                      <section>
                        <label className={labelStyles}>Unit Name / Model Type</label>
                        <input
                          type="text"
                          value={currentUnit.unit_name}
                          onChange={(event) => {
                            updateCurrentUnitField('unit_name', event.target.value);
                            updateCurrentUnitField('title', event.target.value);
                          }}
                          placeholder="e.g. 1 Bedroom"
                          className={inputStyles}
                        />
                      </section>

                      <section>
                        <label className={labelStyles}>Tower</label>
                        <div className="rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3 text-sm font-semibold text-brand-blue">
                          {currentUnit.tower_name}
                        </div>
                      </section>

                      <section className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3">
                        <div className="pr-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Website Visibility</p>
                          <p className="mt-1 text-xs text-gray-500">
                            {currentUnitVisible ? 'This unit can appear on the public virtual tour.' : 'This unit is hidden from visitors.'}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => updateCurrentUnitField('status', currentUnitVisible ? 'Hidden' : 'Active')}
                          className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider"
                          aria-pressed={currentUnitVisible}
                        >
                          <span className={currentUnitVisible ? 'text-green-700' : 'text-gray-500'}>{currentUnitVisible ? 'Visible' : 'Hidden'}</span>
                          <span className={`relative h-7 w-12 rounded-full transition-colors ${currentUnitVisible ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-300 hover:bg-gray-400'}`}>
                            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${currentUnitVisible ? 'left-6' : 'left-1'}`} />
                          </span>
                        </button>
                      </section>

                      <section>
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">View Areas</p>
                            <p className="mt-1 text-[11px] text-gray-400">Click a room in the live preview to edit it.</p>
                          </div>
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                            {currentUnit.view_areas.length}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={addViewArea}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 transition-all hover:border-brand-blue hover:bg-brand-blue/5 hover:text-brand-blue"
                        >
                          <PlusCircle size={14} /> Add View Area
                        </button>
                      </section>

                      <button
                        type="button"
                        onClick={requestDeleteUnit}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-red-600 transition-colors hover:bg-red-100"
                      >
                        <Trash2 size={14} /> Remove Unit
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 text-center">
                      <Home size={24} className="mx-auto text-gray-300" />
                      <p className="mt-3 text-xs font-bold text-brand-blue">No unit selected</p>
                      <button type="button" onClick={() => setSelectedInspector('tower')} className="mt-3 text-[10px] font-bold uppercase tracking-wider text-brand-gold">Choose a tower</button>
                    </div>
                  )
                )}

                {selectedInspector === 'area' && (
                  currentArea && currentUnit ? (
                    <div className="space-y-5">
                      <section>
                        <label className={labelStyles}>Area Name</label>
                        <input
                          type="text"
                          value={currentArea.title}
                          onChange={(event) => updateViewAreaTitle(currentArea.id, event.target.value)}
                          placeholder="e.g. Kitchen, Living Room, Balcony"
                          className={inputStyles}
                        />
                      </section>

                      <section>
                        <label className={labelStyles}>360° Panorama</label>
                        <label className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-200 bg-gray-50/60 transition-colors hover:border-brand-blue/30 hover:bg-white">
                          {currentArea.url ? (
                            <div className="aspect-[16/8] w-full overflow-hidden bg-gray-100">
                              <img src={currentArea.url} alt="" className="h-full w-full object-cover" />
                            </div>
                          ) : (
                            <div className="flex aspect-[16/8] w-full items-center justify-center bg-gray-100 text-gray-300">
                              <ImageIcon size={28} />
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-3 px-4 py-3">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-brand-blue">{currentArea.url ? 'Replace panorama' : 'Upload panorama'}</p>
                              <p className="mt-1 truncate text-[10px] text-gray-400">
                                {currentArea.file?.name || (currentArea.url ? 'Current panorama' : 'Choose an equirectangular image')}
                              </p>
                            </div>
                            <ImageIcon size={17} className="shrink-0 text-gray-400 group-hover:text-brand-blue" />
                          </div>
                          <input type="file" accept="image/*" onChange={(event) => handleFileChange(currentArea.id, event.target.files?.[0] || null)} className="hidden" />
                        </label>
                      </section>

                      {currentUnit.view_areas.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeViewArea(currentArea.id)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-red-600 transition-colors hover:bg-red-100"
                        >
                          <Trash2 size={14} /> Remove View Area
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 text-center">
                      <ImageIcon size={24} className="mx-auto text-gray-300" />
                      <p className="mt-3 text-xs font-bold text-brand-blue">No view area selected</p>
                    </div>
                  )
                )}
              </>
            )}
          </div>

        </aside>
      </div>
    </div>
  );
}

export default function AdminVirtualToursDashboard() { 
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center h-screen bg-[#E7E7E7]">
        <Loader2 className="animate-spin text-brand-blue" size={40} />
      </div>
    }>
      <VirtualToursManager />
    </Suspense>
  ); 
}