// app/admin/promotions/page.tsx
'use client';

import { getCurrentUser } from '@/app/actions/auth';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  ArrowLeft, Megaphone, Save, AlertCircle, CheckCircle2, Loader2, Edit2, PlusCircle, ChevronDown 
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { fetchPromotionForEdit, savePromotionAction, createAuditLogAction } from '@/app/actions/admin_fetchers';

const promoSchema = z.object({
  title: z.string().min(1, "Promotion title is required"),
  status: z.string().min(1, "Status tag is required"),
  validity_date: z.string().min(1, "Validity date is required"),
  description: z.string().min(1, "Description is required"),
});

type PromoFormData = z.infer<typeof promoSchema>;

function PromotionsFormManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit'); 
  const supabase = createClient();

  const [isFetching, setIsFetching] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<PromoFormData>({
    resolver: zodResolver(promoSchema),
    defaultValues: {
      title: "", status: "", validity_date: "", description: ""
    }
  });

  useEffect(() => {
    const initData = async () => {
      setIsFetching(true);
      try {
        if (editId) {
          // ✅ USE SERVER ACTION TO FETCH (Bypasses RLS & avoids JSON coerce error)
          const promoData = await fetchPromotionForEdit(editId);
          
          if (promoData) {
            reset({
              title: promoData.title || "",
              status: promoData.status || "",
              validity_date: promoData.validity_date || "",
              description: promoData.description || "",
            });
          }
        }
      } catch (error) {
        console.error("Error fetching initialization data:", error);
      } finally {
        setIsFetching(false);
      }
    };
    initData();
  }, [editId, reset]);

  const onSubmit = async (data: PromoFormData) => {
    try {
      await savePromotionAction(data, editId);

      // ✅ USE SERVER ACTION FOR AUDIT LOG (Bypasses RLS)
      await createAuditLogAction(
        editId ? 'EDIT' : 'CREATE',
        'Promotions',
        data.title,
        editId ? `Updated existing promotion details.` : `Added a new promotion.`
      );

      setSuccessMsg(editId ? 'Promotion updated successfully!' : 'Promotion created successfully!');
      setTimeout(() => router.replace(`/admin/dashboard`), 2000);

    } catch (error: any) {
      alert(`Action Failed: ${error.message}`);
    }
  };

  const inputStyles = "w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-brand-blue text-sm focus:border-brand-gold outline-none shadow-sm transition-all";
  const labelStyles = "text-brand-blue text-[10px] font-bold tracking-widest uppercase mb-2 block ml-1";
  const hasErrors = Object.keys(errors).length > 0;

  if (isFetching) return <div className="flex justify-center items-center h-screen bg-[#F8F9FA]"><Loader2 className="animate-spin text-brand-blue" size={40} /></div>;

  return (
    <div className="flex h-screen bg-[#F8F9FA] text-gray-900 font-sans selection:bg-brand-gold selection:text-white flex-col overflow-hidden">

      {/* === SUCCESS MODAL OVERLAY === */}
      {successMsg && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/60 backdrop-blur-sm animate-in fade-in duration-300 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-3 max-w-sm w-full animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-2 shadow-inner">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-2xl font-serif text-brand-blue text-center font-bold">Success!</h2>
            <p className="text-gray-600 text-center font-medium text-sm">{successMsg}</p>
          </div>
        </div>
      )}
      
      <header className="h-16 md:h-20 bg-white border-b border-gray-200 flex items-center px-4 sm:px-8 md:px-12 shrink-0 z-10 shadow-sm gap-2 sm:gap-4">
        <button 
          onClick={() => router.replace('/admin/dashboard')} 
          className="p-2 -ml-2 text-brand-blue hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2 group outline-none"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="hidden sm:block text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-brand-blue">Back</span>
        </button>
        <div className="w-px h-6 bg-gray-300 mx-2 hidden sm:block"></div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-serif text-brand-blue leading-tight truncate flex items-center gap-3">
          <Megaphone className="text-brand-gold" size={28} />
          {editId ? 'Edit Promotion' : 'Add Promotion'}
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto px-4 sm:px-8 md:px-12 pt-8 pb-24">
        <div className="w-full max-w-[90rem] mx-auto flex flex-col min-h-full">
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-12 flex-grow flex flex-col">
            
            <section>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <label className={labelStyles}>Promotion Title</label>
                  <input {...register("title")} className={inputStyles} placeholder="e.g. Summer Move-in Promo" />
                  {errors.title && <p className="text-red-500 text-xs mt-2 font-semibold">{errors.title.message}</p>}
                </div>

                <div className="relative">
                  <label className={labelStyles}>Status Tag</label>
                  <div className="relative">
                    <select 
                      {...register("status")} 
                      className={`${inputStyles} appearance-none cursor-pointer pr-10`}
                    >
                      <option value="" disabled>Select a status...</option>
                      <option value="Limited Offer">Limited Offer</option>
                      <option value="Special Offer">Special Offer</option>
                      <option value="Pre-Selling">Pre-Selling</option>
                      <option value="Ready For Occupancy">Ready For Occupancy</option>
                      <option value="Early Bird">Early Bird</option>
                      <option value="Year-End Promo">Year-End Promo</option>
                      <option value="Loyalty Program">Loyalty Program</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                  </div>
                  {errors.status && <p className="text-red-500 text-xs mt-2 font-semibold">{errors.status.message}</p>}
                </div>

                <div>
                  <label className={labelStyles}>Validity Date</label>
                  <input {...register("validity_date")} className={inputStyles} placeholder="e.g. December 31, 2026" />
                  {errors.validity_date && <p className="text-red-500 text-xs mt-2 font-semibold">{errors.validity_date.message}</p>}
                </div>
              </div>
            </section>

            <section>
               <h3 className="text-sm font-bold text-brand-gold uppercase tracking-widest mb-6 flex items-center gap-2">
                Content & Media
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col h-full">
                  <label className={labelStyles}>Promotion Description</label>
                  <textarea {...register("description")} rows={10} className={`${inputStyles} resize-none flex-grow`} placeholder="Describe the promotion mechanics, rules, and benefits..." />
                  {errors.description && <p className="text-red-500 text-xs mt-2 font-semibold">{errors.description.message}</p>}
                </div>
              </div>
            </section>

            <div className="pt-10 mt-12 mb-8 border-t border-gray-200">
              {hasErrors && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl flex items-center justify-center gap-3 text-sm font-bold animate-in fade-in">
                  <AlertCircle size={20} /> Please fill in all required fields.
                </div>
              )}
              <div className="flex justify-center">
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="w-full sm:w-2/3 md:w-1/2 lg:w-1/3 px-12 py-5 bg-brand-blue text-white font-bold tracking-widest uppercase text-sm rounded-xl hover:bg-brand-blue/90 transition-all flex items-center justify-center gap-3 disabled:opacity-70 shadow-md hover:shadow-lg hover:-translate-y-1"
                >
                  {isSubmitting ? (
                    <><Loader2 size={20} className="animate-spin"/> Processing...</>
                  ) : editId ? (
                    <><Edit2 size={20} /> Update Promotion</>
                  ) : (
                    <><PlusCircle size={20} /> Add Promotion</>
                  )}
                </button>
              </div>
            </div>

          </form>
        </div>
      </main>
    </div>
  );
}

export default function AdminPromotionsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen bg-[#F8F9FA]"><Loader2 className="animate-spin text-brand-blue" size={40} /></div>}>
      <PromotionsFormManager />
    </Suspense>
  );
}