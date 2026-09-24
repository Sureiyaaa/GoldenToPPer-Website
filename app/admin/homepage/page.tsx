'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { 
  ArrowLeft, Save, Loader2, PlusCircle, Trash2, CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import ImageDropzone from '@/app/components/imagedropzone';
import { 
  fetchLiveHomepageAdminDataAction,
  saveHomepageSettingsAction,
  upsertHomepageRowAction,
  deleteHomepageRowAction
} from '@/app/actions/homepage';
import HomePreviewSkeleton, { HomepageEditorRegion } from './HomePreviewSkeleton';

export default function AdminHomepageVisualEditor() {
  const router = useRouter();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<HomepageEditorRegion>('hero-section');
  const [projectsList, setProjectsList] = useState<any[]>([]);

 
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const { register, control, watch, setValue, reset, formState: { isDirty } } = useForm<any>({
    defaultValues: {
      settings: {},
      heroSlides: [],
      developmentAreas: [],
      processSteps: [],
      awards: []
    }
  });

  const { fields: heroFields, append: appendHero, remove: removeHero } = useFieldArray({ control, name: 'heroSlides' });
  const { fields: devFields, append: appendDev, remove: removeDev } = useFieldArray({ control, name: 'developmentAreas' });
  const { fields: processFields, append: appendProcess, remove: removeProcess } = useFieldArray({ control, name: 'processSteps' });
  const { fields: awardFields, append: appendAward, remove: removeAward } = useFieldArray({ control, name: 'awards' });
  const { fields: newsFields, append: appendNews, remove: removeNews } = useFieldArray({ control, name: 'newsArticles' });

  const handleUploadImage = async (file: File, fieldPath: string) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `homepage/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);

      setPreviews((prev: Record<string, string>) => ({ ...prev, [fieldPath]: publicUrl }));
      setValue(fieldPath, publicUrl, { shouldDirty: true, shouldValidate: true });
      setFeedback({ type: 'success', message: 'Image uploaded successfully!' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Upload failed: ${err.message}` });
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await fetchLiveHomepageAdminDataAction();
      reset({
        settings: res.settings || {},
        heroSlides: res.heroSlides || [],
        developmentAreas: res.developmentAreas || [],
        processSteps: res.processSteps || [],
        awards: res.awards || [],
        newsArticles: res.newsArticles || []
      });

      setProjectsList(res.projects || []);

      // 1. Declare dictionary FIRST
      const currentPreviews: Record<string, string> = {};

      // 2. Populate all image previews
      if (res.settings?.video_thumbnail) {
        currentPreviews['settings.video_thumbnail'] = res.settings.video_thumbnail;
      }
      res.heroSlides?.forEach((s: any, idx: number) => {
        if (s.image) currentPreviews[`heroSlides.${idx}.image`] = s.image;
      });
      res.developmentAreas?.forEach((d: any, idx: number) => {
        if (d.image) currentPreviews[`developmentAreas.${idx}.image`] = d.image;
      });
      res.processSteps?.forEach((p: any, idx: number) => {
        if (p.image) currentPreviews[`processSteps.${idx}.image`] = p.image;
      });
      res.awards?.forEach((a: any, idx: number) => {
        if (a.icon_image) currentPreviews[`awards.${idx}.icon_image`] = a.icon_image;
      });
      res.newsArticles?.forEach((n: any, idx: number) => {
        if (n.image) currentPreviews[`newsArticles.${idx}.image`] = n.image;
      });

      setPreviews(currentPreviews);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formData = watch();

  const handleSaveAll = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const settingsRes = await saveHomepageSettingsAction(formData.settings);
      if (!settingsRes.success) throw new Error(settingsRes.error);

      for (const [index, slide] of (formData.heroSlides || []).entries()) {
        const { project_table, ...cleanSlide } = slide;
        await upsertHomepageRowAction('homepage_hero_slides', { ...cleanSlide, sort_order: index + 1 });
      }

      for (const [index, dev] of (formData.developmentAreas || []).entries()) {
        await upsertHomepageRowAction('homepage_development_areas', { ...dev, sort_order: index + 1 });
      }

      for (const [index, proc] of (formData.processSteps || []).entries()) {
        await upsertHomepageRowAction('homepage_process_steps', { ...proc, sort_order: index + 1 });
      }

      for (const [index, aw] of (formData.awards || []).entries()) {
        await upsertHomepageRowAction('homepage_awards', { ...aw, sort_order: index + 1 });
      }

      for (const article of (formData.newsArticles || [])) {
        if (article.id) {
            await upsertHomepageRowAction('news_updates', article);
        }
        }

      setFeedback({ type: 'success', message: 'Homepage changes saved successfully!' });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedIndex = typeof selectedRegion === 'string' && selectedRegion.includes(':') 
    ? Number(selectedRegion.split(':')[1]) 
    : null;

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#E7E7E7]">
        <Loader2 size={40} className="animate-spin text-brand-blue" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#0B1220] font-sans">
      
      {feedback && (
        <div className={`fixed top-24 right-6 z-[100] flex items-center gap-2.5 rounded-xl border bg-white px-4 py-3 shadow-xl ${
          feedback.type === 'error' ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-600'
        }`}>
          {feedback.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span className="text-xs font-bold">{feedback.message}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 h-20 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between gap-6 px-6 z-40">
        <div className="flex items-center gap-4 min-w-0">
          <button 
            type="button" 
            onClick={() => router.push('/admin/dashboard?section=Homepage+Content')}
            className="p-2 rounded-lg text-gray-400 hover:text-brand-blue hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <span>Admin</span>
              <span>/</span>
              <span className="text-brand-blue">Homepage Content</span>
            </div>
            <h1 className="text-lg font-bold text-brand-blue">Homepage Live Editor</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isDirty && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-amber-600">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Unsaved changes
            </span>
          )}
          <button
            type="button"
            onClick={loadData}
            disabled={isSaving}
            className="px-3 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="min-w-[130px] inline-flex items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-xs font-bold text-white hover:bg-brand-blue/90 disabled:opacity-40 transition-colors"
          >
            {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        
        {/* Canvas Screen */}
        <div id="homepage-preview-scroller" className="flex-1 min-w-0 overflow-y-auto relative scroll-smooth bg-black custom-scrollbar">
          <HomePreviewSkeleton 
            data={formData} 
            selectedRegion={selectedRegion}
            onSelectRegion={setSelectedRegion}
          />
        </div>

        {/* Inspector Sidebar */}
        <aside className="w-[380px] xl:w-[420px] shrink-0 bg-white border-l border-gray-200 shadow-2xl flex flex-col z-30">
          <div className="px-6 py-5 border-b border-gray-100">
            <p className="text-[10px] uppercase tracking-widest font-bold text-brand-gold mb-1">Inspector</p>
            <h2 className="text-xl font-serif text-brand-blue font-bold">
              {selectedRegion === 'hero-section' ? 'Hero Slides & Carousel'
              : selectedRegion?.startsWith('slide:') ? `Hero Slide #${(selectedIndex ?? 0) + 1}`
              : selectedRegion === 'about-section' ? 'About Us & Statistics'
              : selectedRegion === 'dev-areas' ? 'Development Areas'
              : selectedRegion?.startsWith('dev-item:') ? `Area Tab #${(selectedIndex ?? 0) + 1}`
              : selectedRegion === 'process-section' ? 'The Golden Standard'
              : selectedRegion?.startsWith('process-step:') ? `Process Step #${(selectedIndex ?? 0) + 1}`
              : selectedRegion === 'video-section' ? 'Featured Video & Banner'
              : selectedRegion === 'awards-section' ? 'Awards Strip'
              : 'Select Content in Preview'}
            </h2>
            <p className="text-xs text-gray-400 mt-1">Click any section on the left to edit its live parameters.</p>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            
            {/* HERO SLIDES */}
            {(selectedRegion === 'hero-section' || selectedRegion?.startsWith('slide:')) && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-blue">Carousel Slides</span>
                  <button
                    type="button"
                    onClick={() => {
                      appendHero({
                        heading_line_1: 'NEW RESIDENCE',
                        heading_line_2: 'LIFESTYLE',
                        location: 'Pasay City',
                        image: '/images/landingpage/lavidapic.webp',
                        is_active: true,
                        sort_order: heroFields.length + 1
                      });
                      setSelectedRegion(`slide:${heroFields.length}`);
                    }}
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-brand-gold hover:text-brand-blue"
                  >
                    <PlusCircle size={14} /> Add Slide
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pb-2 border-b border-gray-100">
                  {formData.heroSlides?.map((item: any, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedRegion(`slide:${idx}`)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedIndex === idx
                          ? 'bg-brand-blue text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      #{idx + 1} {item.heading_line_1?.slice(0, 10) || 'Slide'}
                    </button>
                  ))}
                </div>

                {selectedIndex !== null && formData.heroSlides?.[selectedIndex] ? (
                  <div key={selectedIndex} className="space-y-4 bg-gray-50/70 p-4 rounded-xl border border-gray-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Slide #{selectedIndex + 1}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          const slide = formData.heroSlides[selectedIndex];
                          if (slide.id) await deleteHomepageRowAction('homepage_hero_slides', slide.id);
                          removeHero(selectedIndex);
                          setSelectedRegion('hero-section');
                        }}
                        className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1 font-bold"
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Linked Project</label>
                      <select 
                        {...register(`heroSlides.${selectedIndex}.project_id`)}
                        className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs text-brand-blue outline-none"
                      >
                        <option value="">None (Independent Slide)</option>
                        {projectsList.map((p) => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Heading Line 1</label>
                      <input {...register(`heroSlides.${selectedIndex}.heading_line_1`)} className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs text-brand-blue font-bold outline-none" />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Heading Line 2 (Gold)</label>
                      <input {...register(`heroSlides.${selectedIndex}.heading_line_2`)} className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs text-brand-gold font-bold outline-none" />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Location Label</label>
                      <input {...register(`heroSlides.${selectedIndex}.location`)} className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs text-brand-blue outline-none" />
                    </div>

                    <div>
                      <ImageDropzone
                        fieldPath={`heroSlides.${selectedIndex}.image`}
                        label="Hero Slide Background Image"
                        height="h-44"
                        watch={watch}
                        setValue={setValue}
                        errors={{}}
                        setPendingFiles={setPendingFiles}
                        setPreviews={setPreviews}
                        previews={previews}
                      />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id={`upload-hero-${selectedIndex}`}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadImage(file, `heroSlides.${selectedIndex}.image`);
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Click any slide in the preview on the left to edit its parameters.</p>
                )}
              </div>
            )}

            {/* ABOUT US & STATS */}
            {selectedRegion === 'about-section' && (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Eyebrow Tagline</label>
                  <input {...register('settings.about_tagline')} className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-brand-blue" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Heading Text</label>
                  <input {...register('settings.about_heading')} className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-brand-blue" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Paragraph 1</label>
                  <textarea rows={3} {...register('settings.about_description_1')} className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-brand-blue" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Paragraph 2</label>
                  <textarea rows={3} {...register('settings.about_description_2')} className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-brand-blue" />
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <span className="text-[10px] font-bold uppercase text-gray-400 mb-2 block">Counter 1 (Projects)</span>
                  <div className="flex gap-2">
                    <input type="number" {...register('settings.stat_projects_val')} className="w-20 border rounded-xl p-2 text-xs" />
                    <input type="text" {...register('settings.stat_projects_suffix')} className="w-14 border rounded-xl p-2 text-xs" />
                    <input type="text" {...register('settings.stat_projects_label')} className="flex-1 border rounded-xl p-2 text-xs" />
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-[10px] font-bold uppercase text-gray-400 mb-2 block">Counter 2 (Team)</span>
                  <div className="flex gap-2">
                    <input type="number" {...register('settings.stat_team_val')} className="w-20 border rounded-xl p-2 text-xs" />
                    <input type="text" {...register('settings.stat_team_suffix')} className="w-14 border rounded-xl p-2 text-xs" />
                    <input type="text" {...register('settings.stat_team_label')} className="flex-1 border rounded-xl p-2 text-xs" />
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-[10px] font-bold uppercase text-gray-400 mb-2 block">Counter 3 (Landbank)</span>
                  <div className="flex gap-2">
                    <input type="number" {...register('settings.stat_landbank_val')} className="w-20 border rounded-xl p-2 text-xs" />
                    <input type="text" {...register('settings.stat_landbank_suffix')} className="w-14 border rounded-xl p-2 text-xs" />
                    <input type="text" {...register('settings.stat_landbank_label')} className="flex-1 border rounded-xl p-2 text-xs" />
                  </div>
                </div>
              </div>
            )}

            {/* DEVELOPMENT AREAS */}
            {(selectedRegion === 'dev-areas' || selectedRegion?.startsWith('dev-item:')) && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-blue">Development Tabs</span>
                  <button
                    type="button"
                    onClick={() => {
                      appendDev({
                        tab_number: `0${devFields.length + 1}`,
                        tab_title: 'New Area',
                        subtitle: 'Prime Location',
                        heading: 'Designed for Living',
                        description: 'Description here...',
                        image: '/images/landingpage/BDC_Goldentopper.jpg',
                        is_active: true,
                        sort_order: devFields.length + 1
                      });
                      setSelectedRegion(`dev-item:${devFields.length}`);
                    }}
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-brand-gold hover:text-brand-blue"
                  >
                    <PlusCircle size={14} /> Add Area Tab
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pb-2 border-b border-gray-100">
                  {formData.developmentAreas?.map((item: any, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedRegion(`dev-item:${idx}`)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedIndex === idx
                          ? 'bg-brand-blue text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {item.tab_number || `0${idx + 1}`} {item.tab_title || 'Tab'}
                    </button>
                  ))}
                </div>

                {selectedIndex !== null && formData.developmentAreas?.[selectedIndex] ? (
                  <div key={selectedIndex} className="space-y-4 bg-gray-50/70 p-4 rounded-xl border border-gray-100">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Tab #{selectedIndex + 1}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          const item = formData.developmentAreas[selectedIndex];
                          if (item.id) await deleteHomepageRowAction('homepage_development_areas', item.id);
                          removeDev(selectedIndex);
                          setSelectedRegion('dev-areas');
                        }}
                        className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1 font-bold"
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Number</label>
                        <input {...register(`developmentAreas.${selectedIndex}.tab_number`)} className="w-full border rounded-xl p-2 text-xs text-brand-gold font-bold bg-white" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Tab Title</label>
                        <input {...register(`developmentAreas.${selectedIndex}.tab_title`)} className="w-full border rounded-xl p-2 text-xs text-brand-blue font-bold bg-white" />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Subtitle</label>
                      <input {...register(`developmentAreas.${selectedIndex}.subtitle`)} className="w-full border rounded-xl p-2 text-xs text-brand-gold bg-white" />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Heading</label>
                      <input {...register(`developmentAreas.${selectedIndex}.heading`)} className="w-full border rounded-xl p-2 text-xs text-brand-blue font-serif font-bold bg-white" />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Description</label>
                      <textarea rows={3} {...register(`developmentAreas.${selectedIndex}.description`)} className="w-full border rounded-xl p-2 text-xs text-gray-600 bg-white" />
                    </div>

                    <div>
                      <ImageDropzone
                        fieldPath={`developmentAreas.${selectedIndex}.image`}
                        label="Development Area Photo"
                        height="h-44"
                        watch={watch}
                        setValue={setValue}
                        errors={{}}
                        setPendingFiles={setPendingFiles}
                        setPreviews={setPreviews}
                        previews={previews}
                      />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id={`upload-dev-${selectedIndex}`}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadImage(file, `developmentAreas.${selectedIndex}.image`);
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Click any tab above or in the preview to edit it.</p>
                )}
              </div>
            )}

            {/* PROCESS STEPS */}
            {(selectedRegion === 'process-section' || selectedRegion?.startsWith('process-step:')) && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-blue">Process Steps</span>
                  <button
                    type="button"
                    onClick={() => {
                      appendProcess({
                        step_number: `0${processFields.length + 1}`,
                        title: 'New Step',
                        description: 'Description here...',
                        image: '/images/landingpage/communities.webp',
                        is_active: true,
                        sort_order: processFields.length + 1
                      });
                      setSelectedRegion(`process-step:${processFields.length}`);
                    }}
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-brand-gold hover:text-brand-blue"
                  >
                    <PlusCircle size={14} /> Add Step
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pb-2 border-b border-gray-100">
                  {formData.processSteps?.map((item: any, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedRegion(`process-step:${idx}`)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedIndex === idx
                          ? 'bg-brand-blue text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Step #{item.step_number || idx + 1}
                    </button>
                  ))}
                </div>

                {selectedIndex !== null && formData.processSteps?.[selectedIndex] ? (
                  <div key={selectedIndex} className="space-y-4 bg-gray-50/70 p-4 rounded-xl border border-gray-100">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Step #{selectedIndex + 1}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          const item = formData.processSteps[selectedIndex];
                          if (item.id) await deleteHomepageRowAction('homepage_process_steps', item.id);
                          removeProcess(selectedIndex);
                          setSelectedRegion('process-section');
                        }}
                        className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1 font-bold"
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Step #</label>
                        <input {...register(`processSteps.${selectedIndex}.step_number`)} className="w-full border rounded-xl p-2 text-xs text-brand-gold font-bold bg-white" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Title</label>
                        <input {...register(`processSteps.${selectedIndex}.title`)} className="w-full border rounded-xl p-2 text-xs text-brand-blue font-bold bg-white" />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Description</label>
                      <textarea rows={3} {...register(`processSteps.${selectedIndex}.description`)} className="w-full border rounded-xl p-2 text-xs text-gray-600 bg-white" />
                    </div>

                    <div>
                      <ImageDropzone
                        fieldPath={`processSteps.${selectedIndex}.image`}
                        label="Process Step Image"
                        height="h-44"
                        watch={watch}
                        setValue={setValue}
                        errors={{}}
                        setPendingFiles={setPendingFiles}
                        setPreviews={setPreviews}
                        previews={previews}
                      />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id={`upload-proc-${selectedIndex}`}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadImage(file, `processSteps.${selectedIndex}.image`);
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Click any process step to edit its details.</p>
                )}
              </div>
            )}

            {/* AWARDS */}
            {(selectedRegion === 'awards-section' || selectedRegion?.startsWith('award:')) && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-blue">Awards Marquee</span>
                  <button
                    type="button"
                    onClick={() => {
                      appendAward({
                        title: 'New Award Title',
                        subtitle_1: 'Property Awards',
                        subtitle_2: '2026',
                        icon_image: '/images/landingpage/award.svg',
                        is_active: true,
                        sort_order: (formData.awards?.length || 0) + 1
                      });
                      setSelectedRegion(`award:${formData.awards?.length || 0}`);
                    }}
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-brand-gold hover:text-brand-blue transition-colors"
                  >
                    <PlusCircle size={14} /> Add Award
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pb-2 border-b border-gray-100">
                  {formData.awards?.map((aw: any, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedRegion(`award:${idx}`)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        (selectedIndex === idx || (selectedIndex === null && idx === 0))
                          ? 'bg-brand-blue text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      #{idx + 1} {aw.title ? aw.title.split('\n')[0].slice(0, 14) : 'Award'}...
                    </button>
                  ))}
                </div>

                {(() => {
                  const targetIndex = selectedIndex !== null ? selectedIndex : 0;
                  const currentAward = formData.awards?.[targetIndex];

                  if (!currentAward) {
                    return (
                      <p className="text-xs text-gray-400">
                        No awards found. Click &quot;Add Award&quot; above to create one.
                      </p>
                    );
                  }

                  return (
                    <div key={targetIndex} className="bg-gray-50/70 p-4 rounded-xl border border-gray-100 space-y-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Award #{targetIndex + 1}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            if (currentAward.id) {
                              await deleteHomepageRowAction('homepage_awards', currentAward.id);
                            }
                            removeAward(targetIndex);
                            setSelectedRegion('awards-section');
                          }}
                          className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1"
                        >
                          <Trash2 size={13} /> Remove
                        </button>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                          Award Title (Supports Line Breaks)
                        </label>
                        <textarea
                          rows={2}
                          {...register(`awards.${targetIndex}.title`)}
                          className="w-full border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-brand-gold bg-white outline-none focus:border-brand-gold"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Subtitle 1 (Organization / Category)</label>
                        <input
                          {...register(`awards.${targetIndex}.subtitle_1`)}
                          className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-brand-blue bg-white outline-none focus:border-brand-gold"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Subtitle 2 (Year / Sub-text)</label>
                        <input
                          {...register(`awards.${targetIndex}.subtitle_2`)}
                          className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-brand-blue bg-white outline-none focus:border-brand-gold"
                        />
                      </div>

                      <div>
                        <ImageDropzone
                          fieldPath={`awards.${targetIndex}.icon_image`}
                          label="Award Badge / Laurel SVG"
                          height="h-32"
                          watch={watch}
                          setValue={setValue}
                          errors={{}}
                          setPendingFiles={setPendingFiles}
                          setPreviews={setPreviews}
                          previews={previews}
                        />
                        <input
                          type="file"
                          accept="image/svg+xml,image/png"
                          className="hidden"
                          id={`upload-award-${targetIndex}`}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadImage(file, `awards.${targetIndex}.icon_image`);
                          }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* VIDEO SECTION */}
            {selectedRegion === 'video-section' && (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Headline Subtitle</label>
                  <input {...register('settings.video_subtitle')} className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-brand-blue" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Massive Heading (Gold)</label>
                  <input {...register('settings.video_heading')} className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-brand-gold font-serif font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">YouTube Embed Link</label>
                  <input {...register('settings.video_url')} className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-brand-blue" />
                </div>
                <div>
                  <ImageDropzone
                    fieldPath="settings.video_thumbnail"
                    label="Video Poster / Thumbnail"
                    height="h-44"
                    watch={watch}
                    setValue={setValue}
                    errors={{}}
                    setPendingFiles={setPendingFiles}
                    setPreviews={setPreviews}
                    previews={previews}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="upload-video-thumb"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadImage(file, "settings.video_thumbnail");
                    }}
                  />
                </div>
              </div>
            )}

            {/* NEWS & UPDATES INSPECTOR */}
            {(selectedRegion === 'news-section' || selectedRegion?.startsWith('news-item:')) && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-blue">Featured Articles</span>
                  <button
                    type="button"
                    onClick={() => {
                      appendNews({
                        title: 'New Announcement',
                        category: 'News',
                        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                        slug: `news-${Date.now()}`,
                        excerpt: 'Write a short preview...',
                        image: '/images/placeholder.jpg',
                        is_active: true
                      });
                      setSelectedRegion(`news-item:${formData.newsArticles?.length || 0}`);
                    }}
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-brand-gold hover:text-brand-blue transition-colors"
                  >
                    <PlusCircle size={14} /> Add Article
                  </button>
                </div>

                {/* Quick Switch Buttons */}
                <div className="flex flex-wrap gap-2 pb-2 border-b border-gray-100">
                  {formData.newsArticles?.map((item: any, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedRegion(`news-item:${idx}`)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        (selectedIndex === idx || (selectedIndex === null && idx === 0))
                          ? 'bg-brand-blue text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      #{idx + 1} {item.title?.slice(0, 12)}...
                    </button>
                  ))}
                </div>

                {(() => {
                  const targetIndex = selectedIndex !== null ? selectedIndex : 0;
                  const currentArticle = formData.newsArticles?.[targetIndex];

                  if (!currentArticle) {
                    return <p className="text-xs text-gray-400">No news articles found. Click &quot;Add Article&quot; to create one.</p>;
                  }

                  return (
                    <div key={targetIndex} className="bg-gray-50/70 p-4 rounded-xl border border-gray-100 space-y-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Article #{targetIndex + 1}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            if (currentArticle.id) {
                              await deleteHomepageRowAction('news_updates', currentArticle.id);
                            }
                            removeNews(targetIndex);
                            setSelectedRegion('news-section');
                          }}
                          className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1"
                        >
                          <Trash2 size={13} /> Remove
                        </button>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Article Title</label>
                        <input {...register(`newsArticles.${targetIndex}.title`)} className="w-full border rounded-xl p-2.5 text-xs text-brand-blue font-bold bg-white outline-none focus:border-brand-gold" />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Category</label>
                          <select {...register(`newsArticles.${targetIndex}.category`)} className="w-full border rounded-xl p-2.5 text-xs text-brand-blue bg-white outline-none focus:border-brand-gold">
                            <option value="News">News</option>
                            <option value="Updates">Updates</option>
                            <option value="Events">Events</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Date</label>
                          <input {...register(`newsArticles.${targetIndex}.date`)} className="w-full border rounded-xl p-2.5 text-xs text-brand-blue bg-white outline-none focus:border-brand-gold" />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">URL Slug</label>
                        <input {...register(`newsArticles.${targetIndex}.slug`)} className="w-full border rounded-xl p-2.5 text-xs text-brand-blue bg-white outline-none focus:border-brand-gold" />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Short Excerpt</label>
                        <textarea rows={3} {...register(`newsArticles.${targetIndex}.excerpt`)} className="w-full border rounded-xl p-2.5 text-xs text-gray-600 bg-white outline-none focus:border-brand-gold" />
                      </div>

                      <div>
                        <ImageDropzone
                          fieldPath={`newsArticles.${targetIndex}.image`}
                          label="Article Cover Image"
                          height="h-36"
                          watch={watch}
                          setValue={setValue}
                          errors={{}}
                          setPendingFiles={setPendingFiles}
                          setPreviews={setPreviews}
                          previews={previews}
                        />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          id={`upload-news-${targetIndex}`}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadImage(file, `newsArticles.${targetIndex}.image`);
                          }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

          </div>
        </aside>
      </div>
    </div>
  );
}