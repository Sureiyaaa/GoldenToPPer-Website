'use client';

import { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Edit2, PlusCircle, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { saveArticleToDB, uploadImage } from '@/app/actions/news';
import { createAuditLogAction } from '@/app/actions/admin_fetchers';
import ImageDropzone from '@/app/components/imagedropzone';
import PreviewSkeleton from './PreviewSkeleton';
import { getCurrentUser } from '@/app/actions/auth';

const NewsFormSchema = z.object({ 
  title: z.string().min(1, "Required"), 
  category: z.string().min(1, "Required"), 
  date: z.string().min(1, "Required"), 
  slug: z.string().min(1, "Required"), 
  excerpt: z.string().min(1, "Required"), 
  image: z.string().optional() 
});
type NewsFormValues = z.infer<typeof NewsFormSchema>;

function NewsManager() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [isFetching, setIsFetching] = useState(false);
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<NewsFormValues>({ 
    resolver: zodResolver(NewsFormSchema),
    defaultValues: {
      title: "", category: "News", date: new Date().toISOString().split('T')[0], slug: "", excerpt: "", image: ""
    }
  });

  useEffect(() => {
    return () => Object.values(previews).forEach(url => URL.revokeObjectURL(url));
  }, [previews]);

  useEffect(() => {
    const fetchSingleArticle = async () => {
      const urlEditId = searchParams.get('edit');
      if (!urlEditId) return; 
      
      setIsFetching(true);
      const { data } = await supabase.from('news_updates').select('*').eq('id', urlEditId).single();
      if (data) {
        setEditId(data.id);
        reset({ title: data.title, category: data.category, date: data.date, slug: data.slug, excerpt: data.excerpt, image: data.image });
        if (data.image) setPreviews({ image: data.image });
      }
      setIsFetching(false);
    };
    fetchSingleArticle();
  }, [searchParams, supabase, reset]);

  const onSubmit = async (data: NewsFormValues) => {
    setIsSubmitting(true);
    try {
      let finalImageUrl = data.image || ''; 
      if (pendingFiles['image']) {
        const fileExt = pendingFiles['image'].name.split('.').pop();
        const formData = new FormData();
        formData.append('file', pendingFiles['image']);
        formData.append('fileName', `${Math.random()}.${fileExt}`);
        finalImageUrl = await uploadImage(formData);
      }
      
      await saveArticleToDB({ ...data, image: finalImageUrl }, editId);

      // ✅ USE SERVER ACTION FOR AUDIT LOG (Bypasses RLS)
      await createAuditLogAction(
        editId ? 'EDIT' : 'CREATE',
        'News & Updates',
        data.title,
        editId ? `Updated existing article content or image.` : `Created new article in category: ${data.category}`
      );

      setSuccessMsg(editId ? 'Article updated successfully!' : 'Article published successfully!');

      setTimeout(() => {
        setSuccessMsg('');
        router.replace('/admin/dashboard');
      }, 2000);

    } catch (error: any) { alert(`Error: ${error.message}`); } 
    finally { setIsSubmitting(false); }
  };

  const formData = watch();
  const hasErrors = Object.keys(errors).length > 0;

  // LIVE PREVIEW DATA MAPPER
  const previewData = {
    title: formData.title || 'Your Article Title Will Appear Here',
    category: formData.category || 'News',
    date: formData.date || 'YYYY-MM-DD',
    excerpt: formData.excerpt || 'Write your article description/excerpt to see it rendered live here...',
    image: previews['image'] || formData.image || ''
  };

  const inputStyles = "w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:bg-white focus:border-brand-gold outline-none shadow-sm transition-all";
  const labelStyles = "text-brand-blue text-[10px] font-bold tracking-widest uppercase block mb-2 mt-4";

  if (isFetching) return <div className="flex justify-center items-center h-screen bg-[#E7E7E7]"><Loader2 className="animate-spin text-brand-blue" size={40} /></div>;

  return (
    <div className="flex h-screen w-full bg-[#E7E7E7] font-sans text-gray-900 overflow-hidden relative">
      
      {/* === SUCCESS MODAL OVERLAY === */}
      {successMsg && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-3 max-w-sm w-full">
            <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-2 shadow-inner">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-2xl font-serif text-brand-blue text-center font-bold">Success!</h2>
            <p className="text-gray-600 text-center font-medium text-sm">{successMsg}</p>
            <div className="mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
              <Loader2 size={14} className="animate-spin text-brand-gold" /> 
              {editId ? 'Redirecting...' : 'Clearing form...'}
            </div>
          </div>
        </div>
      )}
      
      {/* LEFT SIDE: ADMIN FORM ENTRY */}
      <div className="w-[500px] shrink-0 bg-white p-8 overflow-y-auto border-r border-gray-200 shadow-2xl z-20 flex flex-col relative custom-scrollbar">
        <button onClick={() => router.push('/admin/dashboard')} className="flex items-center gap-2 text-[10px] text-gray-500 hover:text-brand-blue mb-8 font-bold uppercase tracking-widest transition-colors w-fit outline-none">
          <ArrowLeft size={14} /> Back to Dashboard
        </button>

        <h2 className="text-3xl font-serif text-brand-blue mb-8">{editId ? 'Edit Article' : 'Publish Content'}</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 flex-1 pb-10">
            
            <div>
              <h3 className="text-xs font-bold text-brand-gold uppercase tracking-widest border-b pb-2 mb-2">Article Details</h3>
              
              <label className={labelStyles}>Title</label>
              <input {...register('title')} placeholder="Enter article title" className={inputStyles} />
              {errors.title && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.title.message}</p>}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelStyles}>Category</label>
                  <select {...register('category')} className={`${inputStyles} cursor-pointer`}>
                    <option value="News">News</option>
                    <option value="Updates">Updates</option>
                  </select>
                  {errors.category && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.category.message}</p>}
                </div>
                <div>
                  <label className={labelStyles}>Date</label>
                  <input type="date" {...register('date')} className={inputStyles} />
                  {errors.date && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.date.message}</p>}
                </div>
              </div>
              
              <label className={labelStyles}>Slug URL</label>
              <input {...register('slug')} placeholder="e.g. golden-topper-wins-award" className={inputStyles} />
              {errors.slug && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.slug.message}</p>}

              <label className={labelStyles}>Description</label>
              <textarea {...register('excerpt')} rows={10} placeholder="Write your content here..." className={`${inputStyles} resize-none`} />
              {errors.excerpt && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.excerpt.message}</p>}
            </div>

            <div className="mt-2">
              <ImageDropzone 
                fieldPath="image" 
                label="Featured Image" 
                height="min-h-[250px]" 
                watch={watch} setValue={setValue} errors={errors} 
                setPendingFiles={setPendingFiles} setPreviews={setPreviews} previews={previews} 
              />
            </div>

            {hasErrors && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl flex items-center gap-3 text-xs font-bold mt-2">
                <AlertCircle size={16} /> Please fill in all required fields.
              </div>
            )}

            <button 
              type="submit" disabled={isSubmitting} 
              className="flex items-center justify-center gap-2 bg-brand-blue text-white py-5 rounded-xl uppercase tracking-widest font-bold text-[11px] hover:bg-brand-gold transition-colors shadow-xl w-full disabled:opacity-70 mt-4"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : editId ? <Edit2 size={16} /> : <PlusCircle size={16} />}
              {editId ? 'Update Article' : 'Publish Article'}
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

export default function AdminNewsDashboard() { 
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen bg-[#E7E7E7]"><Loader2 className="animate-spin text-brand-blue" size={40} /></div>}>
      <NewsManager />
    </Suspense>
  ); 
}