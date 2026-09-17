// app/admin/virtualtours/page.tsx
'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, PlusCircle, CheckCircle2, Loader2, Trash2, Image as ImageIcon, Building, Layers, Home } from 'lucide-react';
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

function VirtualToursManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [isFetchingProjects, setIsFetchingProjects] = useState(true);
  const [isFetchingTours, setIsFetchingTours] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  // All tours belonging to the selected project
  const [tours, setTours] = useState<UnitTour[]>([]);
  const [deletedTourIds, setDeletedTourIds] = useState<number[]>([]);

  // Selected dropdown filters
  const [selectedTower, setSelectedTower] = useState<string>('Tower A');
  const [selectedUnitId, setSelectedUnitId] = useState<string | number | null>(null);

  // 1. Initial Projects Load
  useEffect(() => {
    async function loadProjects() {
      try {
        const projs = await fetchProjectsForDropdown();
        setProjectsList(projs || []);
        
        const queryProjectId = searchParams.get('project');
        if (queryProjectId) {
          setSelectedProjectId(Number(queryProjectId));
        } else if (projs && projs.length > 0) {
          setSelectedProjectId(projs[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsFetchingProjects(false);
      }
    }
    loadProjects();
  }, [searchParams]);

  // 2. Fetch Project Tours on Project Change
  useEffect(() => {
    if (!selectedProjectId) return;

    async function loadTours() {
      setIsFetchingTours(true);
      try {
        const rawTours = await fetchProjectVirtualTours(selectedProjectId!);
        
        const parsed: UnitTour[] = (rawTours || []).map((t: any) => {
          let areas = t.view_areas || t.rooms || [];
          if (typeof areas === 'string') {
            try { areas = JSON.parse(areas); } catch { areas = []; }
          }
          return {
            id: t.id,
            unit_name: t.unit_name || t.title || 'Standard Unit',
            title: t.title || t.unit_name || 'Standard Unit',
            tower_name: t.tower_name || 'Tower A',
            status: t.status || 'Active',
            view_areas: (Array.isArray(areas) ? areas : []).map((a: any, idx: number) => ({
              id: `db-${idx}-${Date.now()}`,
              title: a.title || `Area ${idx + 1}`,
              url: a.image || '',
              file: null
            }))
          };
        });

        setTours(parsed);
        setDeletedTourIds([]);

        // Derive initial towers & units
        const uniqueTowers = Array.from(new Set(parsed.map((t) => t.tower_name.trim()).filter(Boolean))).sort(
          (a, b) => a.localeCompare(b, undefined, { numeric: true })
        );
        const initialTower = uniqueTowers[0] || 'Tower A';
        setSelectedTower(initialTower);

        const firstUnit = parsed.find((t) => t.tower_name.toLowerCase() === initialTower.toLowerCase());
        setSelectedUnitId(firstUnit ? firstUnit.id : null);
      } catch (err) {
        console.error(err);
      } finally {
        setIsFetchingTours(false);
      }
    }

    loadTours();
  }, [selectedProjectId]);

  // All unique towers currently in this project
  const availableTowers = useMemo(() => {
    const list = Array.from(new Set(tours.map((t) => t.tower_name?.trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
    return list.length > 0 ? list : ['Tower A'];
  }, [tours]);

  // Fallback to first available tower if the active selectedTower was deleted or no longer exists
  useEffect(() => {
    if (availableTowers.length > 0) {
      const towerExists = availableTowers.some(
        (t) => t.toLowerCase() === selectedTower.toLowerCase()
      );
      if (!towerExists) {
        setSelectedTower(availableTowers[0]);
      }
    }
  }, [availableTowers, selectedTower]);

  // Units under the active tower
  const unitsInSelectedTower = useMemo(() => {
    return tours.filter((t) => t.tower_name.toLowerCase() === selectedTower.toLowerCase());
  }, [tours, selectedTower]);

  // Currently Active Unit object being edited
  const currentUnit = useMemo(() => {
    return tours.find((t) => String(t.id) === String(selectedUnitId)) || unitsInSelectedTower[0] || null;
  }, [tours, selectedUnitId, unitsInSelectedTower]);

  // Automatically keep selectedUnitId valid when switching towers
  useEffect(() => {
    if (unitsInSelectedTower.length > 0) {
      if (!unitsInSelectedTower.some((u) => String(u.id) === String(selectedUnitId))) {
        setSelectedUnitId(unitsInSelectedTower[0].id);
      }
    } else {
      setSelectedUnitId(null);
    }
  }, [selectedTower, unitsInSelectedTower, selectedUnitId]);

  // Handler: Add a New Tower
  const handleAddTower = () => {
    const customTower = prompt("Enter new Tower Name (e.g. Tower B, Tower C):");
    if (!customTower || !customTower.trim()) return;

    let trimmed = customTower.trim();
    // Normalize "tower b" -> "Tower B"
    const match = trimmed.match(/^tower\s+([a-z0-9]+)$/i);
    if (match) {
      trimmed = `Tower ${match[1].toUpperCase()}`;
    }

    if (availableTowers.map((t) => t.toLowerCase()).includes(trimmed.toLowerCase())) {
      setSelectedTower(trimmed);
      return;
    }

    const tempUnitId = `temp-${Date.now()}`;
    const newUnit: UnitTour = {
      id: tempUnitId,
      unit_name: 'Studio Unit',
      title: 'Studio Unit',
      tower_name: trimmed,
      status: 'Active',
      view_areas: [{ id: `area-${Date.now()}`, title: 'Main Area', file: null, url: '' }]
    };

    setTours((prev) => [...prev, newUnit]);
    setSelectedTower(trimmed);
    setSelectedUnitId(tempUnitId);
  };

  // Handler: Delete Entire Tower
  const handleDeleteTower = () => {
    if (availableTowers.length <= 1) {
      alert("You cannot delete the only remaining tower.");
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedTower} and all of its units?`)) {
      return;
    }

    const towerUnitsToDelete = tours.filter(
      (t) => t.tower_name.toLowerCase() === selectedTower.toLowerCase()
    );

    const idsToDelete = towerUnitsToDelete
      .map((t) => t.id)
      .filter((id): id is number => typeof id === 'number');

    setDeletedTourIds((prev) => [...prev, ...idsToDelete]);

    const remainingTours = tours.filter(
      (t) => t.tower_name.toLowerCase() !== selectedTower.toLowerCase()
    );
    setTours(remainingTours);

    const remainingTowerNames = Array.from(
      new Set(remainingTours.map((t) => t.tower_name.trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const fallbackTower = remainingTowerNames[0] || 'Tower A';
    setSelectedTower(fallbackTower);

    const firstRemainingUnit = remainingTours.find(
      (t) => t.tower_name.toLowerCase() === fallbackTower.toLowerCase()
    );
    setSelectedUnitId(firstRemainingUnit ? firstRemainingUnit.id : null);
  };

  // Handler: Add a New Unit
  const handleAddUnit = () => {
    const unitTitle = prompt("Enter Unit Name (e.g. Studio, 1 Bedroom, 2 Bedroom Penthouse):", "Studio Unit");
    if (!unitTitle || !unitTitle.trim()) return;

    const tempUnitId = `temp-${Date.now()}`;
    const newUnit: UnitTour = {
      id: tempUnitId,
      unit_name: unitTitle.trim(),
      title: unitTitle.trim(),
      tower_name: selectedTower,
      status: 'Active',
      view_areas: [{ id: `area-${Date.now()}`, title: 'Living Room', file: null, url: '' }]
    };

    setTours((prev) => [...prev, newUnit]);
    setSelectedUnitId(tempUnitId);
  };

  // Handler: Delete Unit (with tower fallback if last unit in tower was removed)
  const handleDeleteUnit = () => {
    if (!currentUnit) return;
    if (!confirm(`Are you sure you want to delete "${currentUnit.unit_name}" from ${selectedTower}?`)) return;

    if (typeof currentUnit.id === 'number') {
      setDeletedTourIds((prev) => [...prev, currentUnit.id as number]);
    }

    const remainingTours = tours.filter((t) => t.id !== currentUnit.id);
    setTours(remainingTours);

    // Check if the current tower has any units remaining
    const remainingUnitsInTower = remainingTours.filter(
      (t) => t.tower_name.toLowerCase() === selectedTower.toLowerCase()
    );

    if (remainingUnitsInTower.length > 0) {
      setSelectedUnitId(remainingUnitsInTower[0].id);
    } else {
      // Fall back to first available tower with remaining units
      const remainingTowers = Array.from(
        new Set(remainingTours.map((t) => t.tower_name.trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      const fallbackTower = remainingTowers[0] || 'Tower A';
      setSelectedTower(fallbackTower);

      const nextUnit = remainingTours.find(
        (t) => t.tower_name.toLowerCase() === fallbackTower.toLowerCase()
      );
      setSelectedUnitId(nextUnit ? nextUnit.id : null);
    }
  };

  // Handler: Update Current Unit Field
  const updateCurrentUnitField = (field: keyof UnitTour, value: any) => {
    if (!currentUnit) return;
    setTours((prev) => prev.map((t) => (t.id === currentUnit.id ? { ...t, [field]: value } : t)));
  };

  // View Area Handlers
  const addViewArea = () => {
    if (!currentUnit) return;
    const newArea: ViewArea = { id: `area-${Date.now()}`, title: '', file: null, url: '' };
    updateCurrentUnitField('view_areas', [...currentUnit.view_areas, newArea]);
  };

  const removeViewArea = (areaId: string) => {
    if (!currentUnit) return;
    updateCurrentUnitField('view_areas', currentUnit.view_areas.filter((a) => a.id !== areaId));
  };

  const updateViewAreaTitle = (areaId: string, title: string) => {
    if (!currentUnit) return;
    updateCurrentUnitField('view_areas', currentUnit.view_areas.map((a) => (a.id === areaId ? { ...a, title } : a)));
  };

  const handleFileChange = (areaId: string, file: File | null) => {
    if (!currentUnit || !file) return;
    const url = URL.createObjectURL(file);
    updateCurrentUnitField('view_areas', currentUnit.view_areas.map((a) => (a.id === areaId ? { ...a, file, url } : a)));
  };

  // Save All
  const handleSaveAll = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedProjectId) return alert("Select a project.");
    if (tours.length === 0) return alert("Add at least one unit before saving.");

    setIsSubmitting(true);
    try {
      const preparedTours = [];

      for (const tour of tours) {
        const finalAreas = [];
        for (const area of tour.view_areas) {
          let finalUrl = area.url;
          if (area.file) {
            const fileExt = area.file.name.split('.').pop();
            const filePath = `360_tours/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('images').upload(filePath, area.file);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(filePath);
            finalUrl = publicUrl;
          }
          finalAreas.push({ title: area.title || 'Perspective', image: finalUrl });
        }

        preparedTours.push({
          id: tour.id,
          tower_name: tour.tower_name,
          unit_name: tour.unit_name,
          title: tour.title || tour.unit_name,
          status: tour.status,
          view_areas: finalAreas
        });
      }

      await saveProjectVirtualToursAction(selectedProjectId, preparedTours, deletedTourIds);

      const projName = projectsList.find((p) => p.id === selectedProjectId)?.title || 'Project';
      await createAuditLogAction('EDIT', 'Virtual Tours', projName, `Updated towers & units for ${projName}.`);

      setSuccessMsg('All towers, units, and view areas saved successfully!');
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyles = "w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:bg-white focus:border-brand-gold outline-none shadow-sm transition-all";
  const labelStyles = "text-brand-blue text-[10px] font-bold tracking-widest uppercase block mb-1.5 mt-3";

  const activeProjectTitle = projectsList.find((p) => p.id === selectedProjectId)?.title || 'Selected Project';

  if (isFetchingProjects) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#E7E7E7]">
        <Loader2 className="animate-spin text-brand-blue" size={40} />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#E7E7E7] font-sans text-gray-900 overflow-hidden relative">
      
      {/* Toast Notification */}
      {successMsg && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-3 max-w-sm w-full">
            <CheckCircle2 size={40} className="text-green-500 mb-1" />
            <h2 className="text-2xl font-serif text-brand-blue font-bold">Saved!</h2>
            <p className="text-gray-600 text-center text-xs">{successMsg}</p>
          </div>
        </div>
      )}

      {/* LEFT FORM PANE */}
      <div className="w-[520px] shrink-0 bg-white p-8 overflow-y-auto border-r border-gray-200 shadow-2xl z-20 flex flex-col custom-scrollbar">
        
        {/* Back Link */}
        <button 
          onClick={() => router.push('/admin/dashboard')} 
          className="flex items-center gap-2 text-[10px] text-gray-400 hover:text-brand-blue mb-6 font-bold uppercase tracking-widest transition-colors outline-none"
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </button>

        <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-100">
          <div>
            <span className="text-[10px] font-bold tracking-widest uppercase text-brand-gold">Virtual Tour Central</span>
            <h2 className="text-3xl font-serif text-brand-blue">Edit Virtual Tour</h2>
          </div>

          <button
            type="button"
            onClick={() => handleSaveAll()}
            disabled={isSubmitting || isFetchingTours}
            className="flex items-center gap-2 bg-brand-blue hover:bg-brand-gold text-white px-5 py-2.5 rounded-xl uppercase tracking-widest text-[11px] font-bold shadow-lg transition-all disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save All
          </button>
        </div>

        {/* 1. PROJECT SELECTOR */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-6">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
            <Building size={13} className="text-brand-gold" /> Linked Project
          </label>
          <select 
            value={selectedProjectId || ''} 
            onChange={(e) => setSelectedProjectId(Number(e.target.value))} 
            className={`${inputStyles} font-semibold text-brand-blue cursor-pointer`}
          >
            {projectsList.map((proj) => (
              <option key={proj.id} value={proj.id}>{proj.title}</option>
            ))}
          </select>
        </div>

        {isFetchingTours ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 gap-2">
            <Loader2 className="animate-spin text-brand-blue" size={32} />
            <span className="text-xs text-gray-400 font-medium">Loading tours...</span>
          </div>
        ) : (
          <div className="flex flex-col gap-6">

            {/* 2. TOWER & UNIT DROPDOWNS */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex flex-col gap-4">
              
              {/* TOWER SELECTOR */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold text-brand-blue uppercase tracking-widest flex items-center gap-1">
                    <Layers size={13} className="text-brand-gold" /> Select Tower
                  </label>
                  <div className="flex items-center gap-3">
                    {availableTowers.length > 1 && (
                      <button 
                        type="button" 
                        onClick={handleDeleteTower}
                        className="text-[10px] text-red-500 hover:text-red-700 font-bold uppercase flex items-center gap-1"
                      >
                        <Trash2 size={11} /> Delete Tower
                      </button>
                    )}
                    <button 
                      type="button" 
                      onClick={handleAddTower}
                      className="text-[10px] text-brand-blue hover:text-brand-gold font-bold uppercase flex items-center gap-1"
                    >
                      <PlusCircle size={12} /> Add Tower
                    </button>
                  </div>
                </div>
                <select
                  value={selectedTower}
                  onChange={(e) => setSelectedTower(e.target.value)}
                  className={`${inputStyles} cursor-pointer`}
                >
                  {availableTowers.map((tower) => (
                    <option key={tower} value={tower}>{tower}</option>
                  ))}
                </select>
              </div>

              {/* UNIT SELECTOR */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold text-brand-blue uppercase tracking-widest flex items-center gap-1">
                    <Home size={13} className="text-brand-gold" /> Select Unit (Under {selectedTower})
                  </label>
                  <button 
                    type="button" 
                    onClick={handleAddUnit}
                    className="text-[10px] text-brand-blue hover:text-brand-gold font-bold uppercase flex items-center gap-1"
                  >
                    <PlusCircle size={12} /> Add Unit
                  </button>
                </div>

                {unitsInSelectedTower.length > 0 ? (
                  <select
                    value={currentUnit?.id || ''}
                    onChange={(e) => setSelectedUnitId(e.target.value)}
                    className={`${inputStyles} cursor-pointer font-medium`}
                  >
                    {unitsInSelectedTower.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.unit_name} ({u.view_areas.length} View Areas)
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                    <span className="text-xs text-amber-800">No units in {selectedTower}</span>
                    <button 
                      type="button" 
                      onClick={handleAddUnit}
                      className="text-xs font-bold text-brand-blue underline uppercase"
                    >
                      Create Unit
                    </button>
                  </div>
                )}
              </div>

            </div>

            {/* 3. CURRENT UNIT DETAILS FORM */}
            {currentUnit && (
              <div className="flex flex-col gap-4">
                
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-bold text-brand-gold uppercase tracking-widest">
                    Unit Details
                  </span>
                  <button 
                    type="button"
                    onClick={handleDeleteUnit}
                    className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-bold"
                  >
                    <Trash2 size={13} /> Delete Unit
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelStyles}>Unit Name / Model Type</label>
                    <input 
                      type="text" 
                      value={currentUnit.unit_name}
                      onChange={(e) => updateCurrentUnitField('unit_name', e.target.value)}
                      placeholder="e.g. 1 Bedroom" 
                      className={inputStyles} 
                    />
                  </div>

                  <div>
                    <label className={labelStyles}>Status</label>
                    <select 
                      value={currentUnit.status} 
                      onChange={(e) => updateCurrentUnitField('status', e.target.value)} 
                      className={`${inputStyles} cursor-pointer`}
                    >
                      <option value="Active">Active</option>
                      <option value="Hidden">Hidden</option>
                    </select>
                  </div>
                </div>

                {/* 4. VIEW AREAS PERSPECTIVES BUILDER */}
                <div className="mt-2">
                  <div className="flex justify-between items-end border-b pb-2 mb-4">
                    <div>
                      <h3 className="text-xs font-bold text-brand-gold uppercase tracking-widest">View Areas / Perspectives</h3>
                      <p className="text-[11px] text-gray-500 mt-0.5">Places inside {currentUnit.unit_name} (Kitchen, Living Room, etc.)</p>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">
                      {currentUnit.view_areas.length} {currentUnit.view_areas.length === 1 ? 'Area' : 'Areas'}
                    </span>
                  </div>

                  <div className="space-y-4">
                    {currentUnit.view_areas.map((area, index) => (
                      <div key={area.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50 relative group">
                        {currentUnit.view_areas.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => removeViewArea(area.id)} 
                            className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}

                        <div className="mb-3 pr-6">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-brand-blue mb-1 block">
                            Area Name {index + 1}
                          </label>
                          <input 
                            type="text" 
                            value={area.title} 
                            onChange={(e) => updateViewAreaTitle(area.id, e.target.value)} 
                            placeholder="e.g. Kitchen, Living Area, Balcony" 
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-gold bg-white" 
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-brand-blue mb-1 block">
                            360 Panorama File
                          </label>
                          <div className="flex items-center gap-3">
                            {area.url ? (
                              <div className="relative w-16 h-10 rounded border border-gray-300 overflow-hidden shrink-0">
                                <img src={area.url} className="w-full h-full object-cover" alt="preview" />
                              </div>
                            ) : (
                              <div className="w-16 h-10 rounded border border-dashed border-gray-300 bg-white flex items-center justify-center shrink-0">
                                <ImageIcon size={16} className="text-gray-300" />
                              </div>
                            )}

                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={(e) => handleFileChange(area.id, e.target.files?.[0] || null)} 
                              className="text-xs w-full text-gray-500 file:cursor-pointer file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:uppercase file:bg-brand-blue/10 file:text-brand-blue hover:file:bg-brand-blue hover:file:text-white transition-all"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button 
                    type="button" 
                    onClick={addViewArea} 
                    className="mt-4 w-full py-3.5 border-2 border-dashed border-gray-300 rounded-xl text-xs font-bold text-gray-500 uppercase tracking-widest hover:border-brand-blue hover:text-brand-blue hover:bg-brand-blue/5 transition-all flex items-center justify-center gap-2 outline-none"
                  >
                    <PlusCircle size={15} /> Add Another View Area
                  </button>
                </div>

              </div>
            )}

            {/* Bottom Save Button */}
            <button 
              type="button"
              onClick={() => handleSaveAll()} 
              disabled={isSubmitting} 
              className="flex items-center justify-center gap-2 bg-brand-blue text-white py-4 rounded-xl uppercase tracking-widest font-bold text-[11px] hover:bg-brand-gold transition-colors shadow-xl w-full disabled:opacity-70 mt-4 outline-none"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : <Save size={16} />}
              Save All Changes ({activeProjectTitle})
            </button>

          </div>
        )}

      </div>

      {/* RIGHT PREVIEW PANE */}
      <div id="preview-scroller" className="flex-1 overflow-hidden relative bg-black">
        <PreviewSkeleton 
          data={{ 
            projectName: activeProjectTitle,
            towerName: selectedTower,
            unitName: currentUnit?.unit_name || 'No Unit Selected', 
            rooms: currentUnit?.view_areas || [] 
          }} 
        />
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