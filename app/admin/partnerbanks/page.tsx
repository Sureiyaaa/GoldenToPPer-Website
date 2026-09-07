'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  ArrowLeft, AlertCircle, CheckCircle2, Loader2, Edit2, PlusCircle
} from 'lucide-react';

import { createClient } from '@/utils/supabase/client';
import ImageDropzone from '@/app/components/imagedropzone';
import PreviewSkeleton from './PreviewSkeleton'; 
import { processBankServerActions } from '@/app/actions/banks'; 
import { fetchBankForEdit, saveBankAction } from '@/app/actions/admin_fetchers';

// --- 1. SCHEMA ---
const bankSchema = z.object({
  bank_name: z.string().min(1, "Bank name is required"),
  max_loan: z.string().min(1, "Max loan percentage is required"),
  terms: z.string().min(1, "Terms description is required"),
  short_description: z.string().min(1, "Short description is required"),
  image: z.string().min(1, "Bank logo is required"),
  projects: z.array(z.string()).optional(),
});

type BankFormData = z.infer<typeof bankSchema>;
const BLANK_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

function PartnerBanksManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const supabase = createClient();

  const [isFetching, setIsFetching] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [availableProjects, setAvailableProjects] = useState<{ id: number; title: string }[]>([]);

  const {
    register, handleSubmit, setValue, watch, reset,
    formState: { errors, isSubmitting },
  } = useForm<BankFormData>({
    resolver: zodResolver(bankSchema),
    defaultValues: {
      bank_name: "", max_loan: "", terms: "", short_description: "", image: "", projects: []
    }
  });

  // Memory Leak Cleanup
  useEffect(() => {
    return () => {
      Object.values(previews).forEach(url => URL.revokeObjectURL(url));
    };
  }, [previews]);

  // --- FETCH DATA ---
  // --- FETCH DATA ---
  useEffect(() => {
    const initData = async () => {
      setIsFetching(true);
      try {
        const { data: projectsData } = await supabase.from('project_table').select('id, title').is('deleted_at', null).order('title', { ascending: true });
        if (projectsData) setAvailableProjects(projectsData);

        if (editId) {
          // ✅ USE SERVER ACTION TO FETCH (Bypasses RLS & JSON Coerce errors)
          const bankData = await fetchBankForEdit(editId);
          if (!bankData) throw new Error("Bank not found");

          const { data: linkedProjects } = await supabase.from('project_banks').select('project_id').eq('banks_id', editId);
          const currentProjectIds = linkedProjects ? linkedProjects.map(lp => lp.project_id.toString()) : [];

          reset({
            bank_name: bankData.bank_name || "",
            max_loan: bankData.max_loan?.toString() || "",
            terms: bankData.terms || "",
            short_description: bankData.short_description || "",
            image: bankData.image || "",
            projects: currentProjectIds,
          });

          if (bankData.image) {
            setPreviews({ image: bankData.image });
          }
        }
      } catch (error) {
        console.error("Error fetching initialization data:", error);
      } finally {
        setIsFetching(false);
      }
    };
    initData();
  }, [editId, supabase, reset]);

  const onSubmit = async (data: BankFormData) => {
    try {
      let finalData = { ...data };

      // 1. UPLOAD IMAGES
      for (const [path, file] of Object.entries(pendingFiles)) {
        const fileExt = file.name.split('.').pop();
        const uniqueFileName = `banks/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('images').upload(uniqueFileName, file);
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('images').getPublicUrl(uniqueFileName);
        finalData.image = publicUrlData.publicUrl;
      }

      // 2. EXECUTE SERVER ACTION FOR BASE BANK DATA (Bypasses RLS Block)
      const saveResult = await saveBankAction({
         bank_name: finalData.bank_name, max_loan: finalData.max_loan, terms: finalData.terms,
         short_description: finalData.short_description, image: finalData.image
      }, editId);

      if (!saveResult.success) throw new Error("Failed to save base bank details");

      // 3. EXECUTE EXISTING SERVER ACTION FOR SECURE PROJECT LINKING
      const serverResult = await processBankServerActions(
        saveResult.id.toString(),
        finalData.projects || [],
        finalData.bank_name,
        finalData.max_loan,
        !!editId
      );

      if (!serverResult.success) {
        throw new Error(`Server Linking Failed: ${serverResult.error}`);
      }

      // 4. SUCCESS STATE
      setSuccessMsg(editId ? 'Bank updated successfully!' : 'Bank created successfully!');
      setTimeout(() => router.replace(`/admin/dashboard`), 2000);

    } catch (error: any) {
      alert(`Action Failed: ${error.message}`);
    }
  };

  const formData = watch();
  const hasErrors = Object.keys(errors).length > 0;

  // Live Data mapping for the skeleton
  const previewData = {
    bank_name: formData.bank_name || 'Bank Name',
    max_loan: formData.max_loan || '80',
    terms: formData.terms || 'Up to 20 years',
    short_description: formData.short_description || 'Write a brief description of the bank\'s financing offers to see it rendered live here...',
    image: previews['image'] || formData.image || BLANK_IMAGE,
  };

  const inputStyles = "w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:bg-white focus:border-brand-gold outline-none shadow-sm transition-all";
  const labelStyles = "text-brand-blue text-[10px] font-bold tracking-widest uppercase block mb-2";

  if (isFetching) return <div className="flex justify-center items-center h-screen bg-[#E7E7E7]"><Loader2 className="animate-spin text-brand-blue" size={40} /></div>;

  return (
    <div className="flex h-screen w-full bg-[#E7E7E7] font-sans text-gray-900 overflow-hidden relative">
      
      {/* SUCCESS MODAL */}
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

        <h2 className="text-3xl font-serif text-brand-blue mb-8">{editId ? 'Edit Partner Bank' : 'Add Partner Bank'}</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-10 flex-1 pb-10">
            
            <div>
              <h3 className="text-xs font-bold text-brand-gold uppercase tracking-widest border-b pb-2 mb-4">Bank Details</h3>
              <div className="space-y-4">
                <div>
                  <label className={labelStyles}>Bank Name</label>
                  <input {...register("bank_name")} className={inputStyles} placeholder="e.g. BDO Unibank" />
                  {errors.bank_name && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.bank_name.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelStyles}>Max Loan (%)</label>
                    <input {...register("max_loan")} className={inputStyles} placeholder="e.g. 80" />
                    {errors.max_loan && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.max_loan.message}</p>}
                  </div>
                  <div>
                    <label className={labelStyles}>Terms</label>
                    <input {...register("terms")} className={inputStyles} placeholder="e.g. Up to 20 years" />
                    {errors.terms && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.terms.message}</p>}
                  </div>
                </div>
                <div>
                  <label className={labelStyles}>Short Description</label>
                  <textarea {...register("short_description")} rows={4} className={`${inputStyles} resize-none`} placeholder="Write a brief description..." />
                  {errors.short_description && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.short_description.message}</p>}
                </div>
                <div className="pt-2">
                  <ImageDropzone
                    fieldPath="image"
                    label="Bank Logo"
                    height="h-32"
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

            <div>
              <h3 className="text-xs font-bold text-brand-gold uppercase tracking-widest border-b pb-2 mb-4">Accredited Projects</h3>
              <div className="grid grid-cols-2 gap-3">
                {availableProjects.map(project => (
                  <label key={project.id} className="flex items-center gap-3 p-3 border border-gray-200 bg-gray-50 rounded-lg cursor-pointer hover:border-brand-gold transition-all">
                    <input
                      type="checkbox"
                      value={project.id.toString()}
                      {...register("projects")}
                      className="w-4 h-4 text-brand-blue rounded border-gray-300 focus:ring-brand-gold shrink-0"
                    />
                    <span className="text-[11px] font-bold text-brand-blue uppercase truncate">{project.title}</span>
                  </label>
                ))}
              </div>
            </div>

            {hasErrors && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl flex items-center gap-3 text-xs font-bold">
                <AlertCircle size={16} /> Please fill in all required fields.
              </div>
            )}

            <button
              type="submit" disabled={isSubmitting}
              className="flex items-center justify-center gap-2 bg-brand-blue text-white py-5 rounded-xl uppercase tracking-widest font-bold text-[11px] hover:bg-brand-gold transition-colors shadow-xl w-full disabled:opacity-70 mt-4"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : editId ? <Edit2 size={16} /> : <PlusCircle size={16} />}
              {editId ? 'Update Bank' : 'Publish Bank'}
            </button>

        </form>
      </div>

      {/* RIGHT SIDE: LIVE GSAP SKELETON PREVIEW */}
      <div id="preview-scroller" className="flex-1 overflow-y-auto relative scroll-smooth bg-[#F4F4F4] custom-scrollbar flex items-center justify-center p-12">
        <div className="absolute top-6 right-8 z-50 pointer-events-none">
          <span className="px-4 py-2 bg-white/90 backdrop-blur-md border border-brand-gold/50 text-[10px] font-bold text-brand-blue uppercase tracking-widest rounded-full shadow-lg">
            Live Component Preview
          </span>
        </div>
        <PreviewSkeleton data={previewData} />
      </div>

    </div>
  );
}

export default function AdminPartnerBanksPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen bg-[#E7E7E7]"><Loader2 className="animate-spin text-brand-blue" size={40} /></div>}>
      <PartnerBanksManager />
    </Suspense>
  );
}