// app/admin/virtualtours/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Edit2, PlusCircle, CheckCircle2, Loader2, Trash2, Image as ImageIcon } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import PreviewSkeleton from './PreviewSkeleton';
import { fetchProjectsForDropdown, fetchVirtualTourForEdit, saveVirtualTourAction, createAuditLogAction } from '@/app/actions/admin_fetchers';

interface ViewAreaInput {
  id: string;
  title: string;
  file: File | null;
  url: string; 
}

function VirtualToursManager() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  
  const [projectsList, setProjectsList] = useState<any[]>([]);
  
  const [tourTitle, setTourTitle] = useState('');
  const [unitName, setUnitName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('Active');
  
  const [viewAreas, setViewAreas] = useState<ViewAreaInput[]>([
    { id: 'initial-area', title: '', file: null, url: '' }
  ]);

  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    return () => {
      viewAreas.forEach((area) => {
        if (area.file && area.url.startsWith('blob:')) URL.revokeObjectURL(area.url);
      });
    };
  }, [viewAreas]);

  useEffect(() => {
    const fetchInitData = async () => {
      setIsFetching(true);
      try {
        const projs = await fetchProjectsForDropdown();
        if (projs) setProjectsList(projs);

        const urlEditId = searchParams.get('edit');
        if (urlEditId) {
          const data = await fetchVirtualTourForEdit(urlEditId);
          if (data) {
            setEditId(data.id);
            setTourTitle(data.title || '');
            setUnitName(data.unit_name || data.title || '');
            setProjectId(data.project_id?.toString() || '');
            setStatus(data.status || 'Active');
            
            // Read from view_areas with fallback to rooms
            const rawAreas = data.view_areas || data.rooms;
            const parsedAreas = typeof rawAreas === 'string' ? JSON.parse(rawAreas) : rawAreas;

            if (Array.isArray(parsedAreas) && parsedAreas.length > 0) {
              setViewAreas(parsedAreas.map((r: any, i: number) => ({
                id: `db-area-${i}`,
                title: r.title || `Area ${i + 1}`,
                url: r.image || '', 
                file: null
              })));
            }
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsFetching(false);
      }
    };
    fetchInitData();
  }, [searchParams]);

  const addArea = () => setViewAreas([...viewAreas, { id: Date.now().toString(), title: '', file: null, url: '' }]);
  const removeArea = (id: string) => setViewAreas(viewAreas.filter((a) => a.id !== id));
  
  const updateAreaTitle = (id: string, title: string) => {
    setViewAreas(viewAreas.map((a) => (a.id === id ? { ...a, title } : a)));
  };

  const handleFileChange = (id: string, file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file); 
    setViewAreas(viewAreas.map((a) => (a.id === id ? { ...a, file, url } : a)));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitName || !projectId) return alert("Please fill in Unit Name and Linked Project.");
    if (viewAreas.length === 0 || viewAreas.some((a) => !a.title || !a.url)) {
      return alert("All view areas must have a name and an uploaded 360 panorama image.");
    }

    setIsSubmitting(true);
    try {
      const finalAreasData = [];

      for (const area of viewAreas) {
        let finalUrl = area.url;

        if (area.file) {
          const fileExt = area.file.name.split('.').pop();
          const filePath = `360_tours/${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage.from('images').upload(filePath, area.file);
          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(filePath);
          finalUrl = publicUrl;
        }
        finalAreasData.push({ title: area.title, image: finalUrl });
      }

      // Aligned payload containing unit_name and view_areas
      const payload = {
        title: tourTitle || unitName,
        unit_name: unitName,
        project_id: parseInt(projectId),
        status: status,
        view_areas: finalAreasData,
        rooms: finalAreasData // Kept for backwards compatibility
      };

      await saveVirtualTourAction(payload, editId);

      await createAuditLogAction(
        editId ? 'EDIT' : 'CREATE',
        'Virtual Tours',
        unitName,
        `Saved virtual tour for ${unitName} with ${finalAreasData.length} view area(s).`
      );

      setSuccessMsg(editId ? 'Virtual Tour updated successfully!' : 'Virtual Tour published successfully!');
      setTimeout(() => {
        setSuccessMsg('');
        router.replace('/admin/dashboard'); 
      }, 2000);

    } catch (error: any) { 
      alert(`Error: ${error.message}`); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const inputStyles = "w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:bg-white focus:border-brand-gold outline-none shadow-sm transition-all";
  const labelStyles = "text-brand-blue text-[10px] font-bold tracking-widest uppercase block mb-2 mt-4";

  if (isFetching) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#E7E7E7]">
        <Loader2 className="animate-spin text-brand-blue" size={40} />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#E7E7E7] font-sans text-gray-900 overflow-hidden relative">
      
      {/* SUCCESS MODAL */}
      {successMsg && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-3 max-w-sm w-full">
            <CheckCircle2 size={40} className="text-green-500 mb-2" />
            <h2 className="text-2xl font-serif text-brand-blue text-center font-bold">Success!</h2>
            <p className="text-gray-600 text-center font-medium text-sm">{successMsg}</p>
          </div>
        </div>
      )}
      
      {/* LEFT SIDE: ADMIN FORM (Split Screen) */}
      <div className="w-[500px] shrink-0 bg-white p-8 overflow-y-auto border-r border-gray-200 shadow-2xl z-20 flex flex-col relative custom-scrollbar">
        <button 
          onClick={() => router.push('/admin/dashboard')} 
          className="flex items-center gap-2 text-[10px] text-gray-500 hover:text-brand-blue mb-8 font-bold uppercase tracking-widest transition-colors w-fit outline-none"
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </button>

        <h2 className="text-3xl font-serif text-brand-blue mb-8">
          {editId ? 'Edit Virtual Tour' : 'Create Virtual Tour'}
        </h2>

        <form onSubmit={onSubmit} className="flex flex-col gap-6 flex-1 pb-10">
            
            {/* Base Settings */}
            <div>
              <h3 className="text-xs font-bold text-brand-gold uppercase tracking-widest border-b pb-2 mb-2">Unit & Project Info</h3>
              
              <label className={labelStyles}>Unit Name / Model Type</label>
              <input 
                required 
                value={unitName} 
                onChange={(e) => setUnitName(e.target.value)} 
                placeholder="e.g. 1 Bedroom, Studio Unit, Combined Unit" 
                className={inputStyles} 
              />

              <label className={labelStyles}>Gallery Label (Optional)</label>
              <input 
                value={tourTitle} 
                onChange={(e) => setTourTitle(e.target.value)} 
                placeholder="e.g. Tower B - 1BR Suite" 
                className={inputStyles} 
              />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelStyles}>Linked Project</label>
                  <select 
                    required 
                    value={projectId} 
                    onChange={(e) => setProjectId(e.target.value)} 
                    className={`${inputStyles} cursor-pointer`}
                  >
                    <option value="">Select Project...</option>
                    {projectsList.map((proj) => (
                      <option key={proj.id} value={proj.id}>{proj.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelStyles}>Status</label>
                  <select 
                    value={status} 
                    onChange={(e) => setStatus(e.target.value)} 
                    className={`${inputStyles} cursor-pointer`}
                  >
                    <option value="Active">Active</option>
                    <option value="Hidden">Hidden</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Dynamic View Areas Builder */}
            <div className="mt-4">
              <div className="flex justify-between items-end border-b pb-2 mb-4">
                <div>
                  <h3 className="text-xs font-bold text-brand-gold uppercase tracking-widest">View Areas / Perspectives</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">Places inside this unit (Kitchen, Toilet, Balcony, etc.)</p>
                </div>
                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">
                  {viewAreas.length} {viewAreas.length === 1 ? 'Area' : 'Areas'}
                </span>
              </div>
              
              <div className="space-y-4">
                {viewAreas.map((area, index) => (
                  <div key={area.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50 relative group">
                    
                    {viewAreas.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => removeArea(area.id)} 
                        className="absolute top-3 right-3 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}

                    <div className="mb-3 pr-6">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-brand-blue mb-1 block">
                        Area Name {index + 1}
                      </label>
                      <input 
                        required 
                        type="text" 
                        value={area.title} 
                        onChange={(e) => updateAreaTitle(area.id, e.target.value)} 
                        placeholder="e.g. Kitchen, Living Area, Toilet and Bath, Balcony" 
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-gold" 
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
                          required={!area.url}
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
                onClick={addArea} 
                className="mt-4 w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-xs font-bold text-gray-500 uppercase tracking-widest hover:border-brand-blue hover:text-brand-blue hover:bg-brand-blue/5 transition-all flex items-center justify-center gap-2 outline-none"
              >
                <PlusCircle size={16} /> Add Another View Area
              </button>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="flex items-center justify-center gap-2 bg-brand-blue text-white py-5 rounded-xl uppercase tracking-widest font-bold text-[11px] hover:bg-brand-gold transition-colors shadow-xl w-full disabled:opacity-70 mt-4 outline-none"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : editId ? <Edit2 size={16} /> : <PlusCircle size={16} />}
              {editId ? 'Save Unit Tour Updates' : 'Publish Unit Tour'}
            </button>

        </form>
      </div>

      {/* RIGHT SIDE: LIVE 360 PREVIEW */}
      <div id="preview-scroller" className="flex-1 overflow-hidden relative bg-black">
        <PreviewSkeleton data={{ title: unitName || tourTitle, rooms: viewAreas }} />
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