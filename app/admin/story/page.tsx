'use client';

import { getCurrentUser } from '@/app/actions/auth';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form'; 
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import ImageDropzone from '@/app/components/imagedropzone';
import PreviewSkeleton from './PreviewSkeleton'; 
import { fetchStoryForEdit, saveStoryAction, createAuditLogAction } from '@/app/actions/admin_fetchers';

// --- 1. SCHEMA ---
const storySchema = z.object({
  year: z.string().min(1, "Year is required"),
  title: z.string().min(1, "Milestone title is required"),
  description: z.string().min(1, "Description is required"),
  image: z.string().min(1, "Milestone image is required"),
});

type StoryFormData = z.infer<typeof storySchema>;
const BLANK_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

function StoryFormManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit'); 

  const [isFetching, setIsFetching] = useState(!!editId);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const supabase = createClient();

  const {
    register, watch, setValue, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<StoryFormData>({
    resolver: zodResolver(storySchema),
    defaultValues: {
      year: "", title: "", description: "", image: ""
    }
  });

  // Cleanup object URLs for image previews
  useEffect(() => {
    return () => {
      Object.values(previews).forEach(url => URL.revokeObjectURL(url));
    };
  }, [previews]);

  // Fetch Existing Data if in Edit Mode
  useEffect(() => {
    const fetchMilestone = async () => {
      if (!editId) return;

      setIsFetching(true);
      try {
        // ✅ USE SERVER ACTION TO BYPASS RLS & JSON COERCE ERRORS
        const data = await fetchStoryForEdit(editId);
          
        if (data) {
          reset({
            year: data.year?.toString() || "",
            title: data.title || "",
            description: data.description || "",
            image: data.image || ""
          });

          if (data.image) {
            setPreviews({ image: data.image });
          }
        }
      } catch (error) {
        console.error("Error fetching milestone:", error);
      } finally {
        setIsFetching(false);
      }
    };
    
    fetchMilestone();
  }, [editId, reset]);

  const onSubmit = async (data: StoryFormData) => {
    setIsSaving(true);
    try {
      let finalData = { ...data };

      if (pendingFiles['image']) {
        const file = pendingFiles['image'];
        const fileExt = file.name.split('.').pop();
        const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `story/${uniqueFileName}`;
        
        const { error: uploadError } = await supabase.storage.from('images').upload(filePath, file);
        if (uploadError) throw uploadError;
        
        const { data: publicUrlData } = supabase.storage.from('images').getPublicUrl(filePath);
        finalData.image = publicUrlData.publicUrl;
      }

      const cleanData = {
        year: finalData.year,
        title: finalData.title,
        description: finalData.description,
        image: finalData.image
      };

      await saveStoryAction(cleanData, editId);

      // ✅ USE SERVER ACTION FOR AUDIT LOG (Bypasses RLS)
      await createAuditLogAction(
        editId ? 'EDIT' : 'CREATE',
        'Our Story',
        finalData.title,
        editId ? `Updated milestone for year ${finalData.year}` : `Added new milestone for year ${finalData.year}`
      );

      setSuccessMsg(editId ? 'Milestone Updated Successfully!' : 'Milestone Published Successfully!');
      setTimeout(() => router.replace(`/admin/dashboard`), 2000);
      
    } catch (error: any) {
      alert(`Action Failed: ${error.message}`);
      setIsSaving(false);
    }
  };

  const formData = watch();
  const hasErrors = Object.keys(errors).length > 0;

  // Live Data mapping for the skeleton
  const previewData = {
    year: formData.year || '2024',
    title: formData.title || 'Milestone Title',
    description: formData.description || 'Provide the details for this milestone to see it updated live in the preview section on the right...',
    image: previews['image'] || formData.image || BLANK_IMAGE,
  };

  const labelStyles = "text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1 mt-4";
  const inputStyles = "w-full border border-gray-200 rounded-lg p-3 text-sm focus:border-brand-gold outline-none transition-colors bg-gray-50 focus:bg-white";

  if (isFetching) {
    return <div className="flex h-screen w-full items-center justify-center bg-[#E7E7E7]"><Loader2 size={40} className="animate-spin text-brand-blue" /></div>;
  }

  return (
    <div className="flex h-screen w-full bg-[#E7E7E7] font-sans text-gray-900 overflow-hidden relative">
      
      {/* SUCCESS MODAL OVERLAY */}
      {successMsg && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
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
        <button onClick={() => router.push('/admin/dashboard')} className="flex items-center gap-2 text-[10px] text-gray-500 hover:text-brand-blue mb-8 font-bold uppercase tracking-widest transition-colors w-fit outline-none">
          <ArrowLeft size={14} /> Back to Dashboard
        </button>

        <h2 className="text-3xl font-serif text-brand-blue mb-8">{editId ? 'Edit Milestone' : 'Add New Milestone'}</h2>
        
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-10 flex-1 pb-10">
          
          <div>
            <h3 className="text-xs font-bold text-brand-gold uppercase tracking-widest border-b pb-2">Milestone Details</h3>
            
            <label className={labelStyles}>Year</label>
            <input {...register("year")} placeholder="e.g. 2024" className={inputStyles} />
            {errors.year && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.year.message}</p>}
            
            <label className={labelStyles}>Title</label>
            <input {...register("title")} placeholder="e.g. The brand was founded" className={inputStyles} />
            {errors.title && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.title.message}</p>}
            
            <label className={labelStyles}>Description</label>
            <textarea {...register("description")} rows={5} className={`${inputStyles} resize-none`} placeholder="Provide the details for this milestone..." />
            {errors.description && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.description.message}</p>}

            <div className="mt-6">
              <ImageDropzone 
                fieldPath="image" label="Milestone Cover Image" height="h-48"
                watch={watch} setValue={setValue} errors={errors} 
                setPendingFiles={setPendingFiles} setPreviews={setPreviews} previews={previews} 
              />
            </div>
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
            {editId ? 'Update & Save Milestone' : 'Upload & Publish Milestone'}
          </button>

        </form>
      </div>

      {/* RIGHT SIDE: LIVE GSAP SKELETON PREVIEW */}
      <div id="preview-scroller" className="flex-1 overflow-y-auto relative scroll-smooth bg-[#050B14] custom-scrollbar">
        <div className="fixed top-6 right-8 z-50 pointer-events-none">
          <span className="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 text-[10px] font-bold text-white uppercase tracking-widest rounded-full shadow-2xl">
            Live Timeline Preview Mode
          </span>
        </div>
        {/* Pass the reactive form data */}
        <PreviewSkeleton data={previewData} />
      </div>

    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#E7E7E7]"><Loader2 size={40} className="animate-spin text-brand-blue" /></div>}>
      <StoryFormManager />
    </Suspense>
  );
}