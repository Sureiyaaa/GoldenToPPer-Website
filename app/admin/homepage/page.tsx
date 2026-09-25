'use client';

import { useState, useEffect, useRef } from 'react';

import { useRouter } from 'next/navigation';

import { useForm, useFieldArray } from 'react-hook-form';

import { 

  ArrowLeft, Save, Loader2, PlusCircle, Trash2, CheckCircle2, ChevronLeft, ChevronRight, 

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

  const [supabase] = useState(() => createClient());

  const [isLoading, setIsLoading] = useState(true);

  const [isSaving, setIsSaving] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [selectedRegion, setSelectedRegion] = useState<HomepageEditorRegion>('hero-section');
  const inspectorContentRef = useRef<HTMLDivElement>(null);
  const inspectorHeadingRef = useRef<HTMLHeadingElement>(null);
  const selectContent = (region: HomepageEditorRegion) => {
    setSelectedRegion(region);
    inspectorContentRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    requestAnimationFrame(() => inspectorHeadingRef.current?.focus({ preventScroll: true }));
  };

  const [projectsList, setProjectsList] = useState<any[]>([]);

  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});

  const [previews, setPreviews] = useState<Record<string, string>>({});

  const { register, control, watch, setValue, reset, formState: { isDirty } } = useForm<any>({

    defaultValues: {

      settings: {},

      heroSlides: [],

      developmentAreas: [],

      processSteps: [],

      awards: [],
      newsArticles: []

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

    // 1. Upload any pending dropped files and track their public URLs

    const uploadedUrls: Record<string, string> = {};

    for (const [fieldPath, file] of Object.entries(pendingFiles)) {

      const fileExt = file.name.split('.').pop();

      const fileName = `homepage/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage

        .from('images')

        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage

        .from('images')

        .getPublicUrl(fileName);

      uploadedUrls[fieldPath] = publicUrl;

      setValue(fieldPath, publicUrl, { shouldDirty: true });

    }

    setPendingFiles({});

    // 2. Clone current form values and merge freshly uploaded URLs

    const currentData = JSON.parse(JSON.stringify(watch()));

    // Apply any uploaded URLs to the save payload

    Object.entries(uploadedUrls).forEach(([path, url]) => {

      const parts = path.split('.');

      if (parts.length === 2) {

        currentData[parts[0]][parts[1]] = url;

      } else if (parts.length === 3) {

        currentData[parts[0]][Number(parts[1])][parts[2]] = url;

      }

    });

    // 3. Persist settings

    const settingsRes = await saveHomepageSettingsAction(currentData.settings);

    if (!settingsRes.success) throw new Error(settingsRes.error);

    // 4. Persist Hero Slides

    for (const [index, slide] of (currentData.heroSlides || []).entries()) {

      const { project_table, ...cleanSlide } = slide;

      await upsertHomepageRowAction('homepage_hero_slides', { ...cleanSlide, sort_order: index + 1 });

    }

    // 5. Persist Development Areas

    for (const [index, dev] of (currentData.developmentAreas || []).entries()) {

      await upsertHomepageRowAction('homepage_development_areas', { ...dev, sort_order: index + 1 });

    }

    // 6. Persist Process Steps

    for (const [index, proc] of (currentData.processSteps || []).entries()) {

      await upsertHomepageRowAction('homepage_process_steps', { ...proc, sort_order: index + 1 });

    }

    // 7. Persist Awards

    for (const [index, aw] of (currentData.awards || []).entries()) {

      await upsertHomepageRowAction('homepage_awards', { ...aw, sort_order: index + 1 });

    }

    // 8. Persist News

    for (const article of (currentData.newsArticles || [])) {

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

  const previewSections: { label: string; region: HomepageEditorRegion }[] = [
    { label: 'Hero', region: 'hero-section' },
    { label: 'About Us', region: 'about-section' },
    { label: 'Development Areas', region: 'dev-areas' },
    { label: 'Awards', region: 'awards-section' },
    { label: 'Process', region: 'process-section' },
    { label: 'Video', region: 'video-section' },
    { label: 'News', region: 'news-section' },
  ];
  const currentSection = selectedRegion.startsWith('slide:') ? 'hero-section'
    : selectedRegion.startsWith('dev-item:') ? 'dev-areas'
    : selectedRegion.startsWith('award:') ? 'awards-section'
    : selectedRegion.startsWith('process-step:') ? 'process-section'
    : selectedRegion.startsWith('news-item:') ? 'news-section' : selectedRegion;
  const sectionIndex = Math.max(0, previewSections.findIndex(item => item.region === currentSection));
  const movePreview = (nextIndex: number) => {
    const section = previewSections[nextIndex];
    if (!section) return;
    selectContent(section.region);
    document.getElementById(`homepage-preview-${section.region}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const leaveEditor = () => {
    if ((isDirty || Object.keys(pendingFiles).length) && !window.confirm('Leave the Homepage editor? Unsaved changes will be lost.')) return;
    router.push('/admin/dashboard?section=Homepage');
  };

  if (isLoading) {

    return (

      <div className="flex h-screen w-full items-center justify-center bg-[#E7E7E7]">

        <Loader2 size={40} className="animate-spin text-brand-blue" />

      </div>

    );

  }

  return (

    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#F8F9FA] font-sans text-brand-blue">

      {feedback && (

        <div className={`fixed top-24 right-6 z-[100] flex items-center gap-2.5 rounded-xl border bg-white px-4 py-3 shadow-xl ${

          feedback.type === 'error' ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-600'

        }`}>

          {feedback.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}

          <span className="text-xs font-bold">{feedback.message}</span>

        </div>

      )}

      {/* Top Header */}

      <header className="sticky top-0 z-40 flex h-[68px] shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 shadow-sm">

        <div className="flex items-center gap-4 min-w-0">

          <button 

            type="button" 

            onClick={leaveEditor}

            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition-colors hover:border-brand-blue hover:text-brand-blue"
            aria-label="Back to Homepage"

          >

            <ArrowLeft size={18} />

          </button>

          <div>

            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">

              <span>Homepage</span>

              <span className="text-gray-300">/</span>

              <span className="text-gray-400">Editor</span>

            </div>

            <h1 className="mt-0.5 truncate font-serif text-2xl text-brand-blue">Edit Homepage</h1>

          </div>

        </div>

        <div className="flex items-center gap-3">

          {(isDirty || Object.keys(pendingFiles).length > 0) && (
            <span className="hidden rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-amber-700 sm:inline-flex">Unsaved Changes</span>
          )}

          <button

            type="button"

            onClick={() => { if ((!isDirty && !Object.keys(pendingFiles).length) || window.confirm('Discard unsaved Homepage changes?')) { setPendingFiles({}); loadData(); } }}

            disabled={isSaving}

            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 transition-colors hover:border-brand-blue hover:text-brand-blue"

          >

            Reset

          </button>

          <button

            type="button"

            onClick={handleSaveAll}

            disabled={isSaving}

            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-gold hover:text-brand-blue disabled:opacity-40"

          >

            {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}

            {isSaving ? 'Saving...' : 'Save Changes'}

          </button>

        </div>

      </header>

      {/* Main Body */}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">

        {/* WEBSITE CANVAS */}
        <section id="homepage-preview-scroller" aria-label="Homepage preview" className="relative min-h-[48vh] min-w-0 flex-1 overflow-y-auto scroll-smooth bg-black lg:min-h-0">
          <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-[#0f1d40]/90 px-5 py-2 text-white backdrop-blur-sm">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">Live Preview</span>
            <nav className="flex items-center gap-2" aria-label="Preview sections">
              <button type="button" aria-label="Previous preview section" disabled={sectionIndex === 0} onClick={() => movePreview(sectionIndex - 1)} className="rounded-md p-1.5 text-white/80 transition-colors hover:bg-white/10 disabled:opacity-30"><ChevronLeft size={16} /></button>
              <span aria-live="polite" className="min-w-12 text-center text-[10px] font-bold tracking-widest">{sectionIndex + 1} / {previewSections.length}</span>
              <button type="button" aria-label="Next preview section" disabled={sectionIndex === previewSections.length - 1} onClick={() => movePreview(sectionIndex + 1)} className="rounded-md p-1.5 text-white/80 transition-colors hover:bg-white/10 disabled:opacity-30"><ChevronRight size={16} /></button>
            </nav>
          </div>
          <HomePreviewSkeleton data={formData} selectedRegion={selectedRegion} onSelectRegion={selectContent} />
        </section>

        {/* Inspector Sidebar */}

        <aside className="z-30 flex max-h-[48vh] w-full shrink-0 flex-col border-t border-gray-200 bg-white shadow-sm lg:max-h-none lg:w-[420px] lg:border-l lg:border-t-0">

          <div className="px-6 py-5 border-b border-gray-100">

            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">Selected Content</p>

            <h2 ref={inspectorHeadingRef} tabIndex={-1} className="text-xl font-serif text-brand-blue outline-none">

              {selectedRegion === 'hero-section' ? 'Hero Slides & Carousel'

              : selectedRegion?.startsWith('slide:') ? `Hero Slide #${(selectedIndex ?? 0) + 1}`

              : selectedRegion === 'about-section' ? 'About Us & Statistics'

              : selectedRegion === 'dev-areas' ? 'Development Areas'

              : selectedRegion?.startsWith('dev-item:') ? `Area Tab #${(selectedIndex ?? 0) + 1}`

              : selectedRegion === 'process-section' ? 'The Golden Standard'

              : selectedRegion?.startsWith('process-step:') ? `Process Step #${(selectedIndex ?? 0) + 1}`

              : selectedRegion === 'video-section' ? 'Featured Video & Banner'

              : selectedRegion === 'awards-section' ? 'Awards Strip'

              : selectedRegion?.startsWith('award:') ? `Award #${(selectedIndex ?? 0) + 1}`

              : selectedRegion === 'news-section' ? 'News & Updates'

              : selectedRegion?.startsWith('news-item:') ? `News Article #${(selectedIndex ?? 0) + 1}`

              : 'Select Content in Preview'}

            </h2>

            <p className="text-xs text-gray-400 mt-1">Select content in the preview to edit it here.</p>

          </div>

          <div ref={inspectorContentRef} className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">

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

                      selectContent(`slide:${heroFields.length}`);

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

                      onClick={() => selectContent(`slide:${idx}`)}

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

                          selectContent('hero-section');

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

                        className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs text-brand-blue outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors"

                      >

                        <option value="">None (Independent Slide)</option>

                        {projectsList.map((p) => (

                          <option key={p.id} value={p.id}>{p.title}</option>

                        ))}

                      </select>

                    </div>

                    <div>

                      <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Heading Line 1</label>

                      <input {...register(`heroSlides.${selectedIndex}.heading_line_1`)} className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs text-brand-blue font-bold outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                    </div>

                    <div>

                      <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Heading Line 2 (Gold)</label>

                      <input {...register(`heroSlides.${selectedIndex}.heading_line_2`)} className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs text-brand-gold font-bold outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                    </div>

                    <div>

                      <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Location Label</label>

                      <input {...register(`heroSlides.${selectedIndex}.location`)} className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs text-brand-blue outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

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

                  <input {...register('settings.about_tagline')} className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-brand-blue outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                </div>

                <div>

                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Heading Text</label>

                  <input {...register('settings.about_heading')} className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-brand-blue outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                </div>

                <div>

                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Paragraph 1</label>

                  <textarea rows={3} {...register('settings.about_description_1')} className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-brand-blue outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                </div>

                <div>

                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Paragraph 2</label>

                  <textarea rows={3} {...register('settings.about_description_2')} className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-brand-blue outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                </div>

                <div className="pt-2 border-t border-gray-100">

                  <span className="text-[10px] font-bold uppercase text-gray-400 mb-2 block">Counter 1 (Projects)</span>

                  <div className="flex gap-2">

                    <input type="number" {...register('settings.stat_projects_val')} className="w-20 border rounded-xl p-2 text-xs border-gray-200 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                    <input type="text" {...register('settings.stat_projects_suffix')} className="w-14 border rounded-xl p-2 text-xs border-gray-200 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                    <input type="text" {...register('settings.stat_projects_label')} className="flex-1 border rounded-xl p-2 text-xs border-gray-200 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                  </div>

                </div>

                <div className="pt-2">

                  <span className="text-[10px] font-bold uppercase text-gray-400 mb-2 block">Counter 2 (Team)</span>

                  <div className="flex gap-2">

                    <input type="number" {...register('settings.stat_team_val')} className="w-20 border rounded-xl p-2 text-xs border-gray-200 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                    <input type="text" {...register('settings.stat_team_suffix')} className="w-14 border rounded-xl p-2 text-xs border-gray-200 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                    <input type="text" {...register('settings.stat_team_label')} className="flex-1 border rounded-xl p-2 text-xs border-gray-200 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                  </div>

                </div>

                <div className="pt-2">

                  <span className="text-[10px] font-bold uppercase text-gray-400 mb-2 block">Counter 3 (Landbank)</span>

                  <div className="flex gap-2">

                    <input type="number" {...register('settings.stat_landbank_val')} className="w-20 border rounded-xl p-2 text-xs border-gray-200 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                    <input type="text" {...register('settings.stat_landbank_suffix')} className="w-14 border rounded-xl p-2 text-xs border-gray-200 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                    <input type="text" {...register('settings.stat_landbank_label')} className="flex-1 border rounded-xl p-2 text-xs border-gray-200 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

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

                      selectContent(`dev-item:${devFields.length}`);

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

                      onClick={() => selectContent(`dev-item:${idx}`)}

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

                          selectContent('dev-areas');

                        }}

                        className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1 font-bold"

                      >

                        <Trash2 size={13} /> Remove

                      </button>

                    </div>

                    <div className="grid grid-cols-3 gap-2">

                      <div>

                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Number</label>

                        <input {...register(`developmentAreas.${selectedIndex}.tab_number`)} className="w-full border rounded-xl p-2 text-xs text-brand-gold font-bold bg-white border-gray-200 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                      </div>

                      <div className="col-span-2">

                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Tab Title</label>

                        <input {...register(`developmentAreas.${selectedIndex}.tab_title`)} className="w-full border rounded-xl p-2 text-xs text-brand-blue font-bold bg-white border-gray-200 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                      </div>

                    </div>

                    <div>

                      <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Subtitle</label>

                      <input {...register(`developmentAreas.${selectedIndex}.subtitle`)} className="w-full border rounded-xl p-2 text-xs text-brand-gold bg-white border-gray-200 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                    </div>

                    <div>

                      <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Heading</label>

                      <input {...register(`developmentAreas.${selectedIndex}.heading`)} className="w-full border rounded-xl p-2 text-xs text-brand-blue font-serif font-bold bg-white border-gray-200 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                    </div>

                    <div>

                      <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Description</label>

                      <textarea rows={3} {...register(`developmentAreas.${selectedIndex}.description`)} className="w-full border rounded-xl p-2 text-xs text-gray-600 bg-white border-gray-200 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

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

                      selectContent(`process-step:${processFields.length}`);

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

                      onClick={() => selectContent(`process-step:${idx}`)}

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

                          selectContent('process-section');

                        }}

                        className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1 font-bold"

                      >

                        <Trash2 size={13} /> Remove

                      </button>

                    </div>

                    <div className="grid grid-cols-3 gap-2">

                      <div>

                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Step #</label>

                        <input {...register(`processSteps.${selectedIndex}.step_number`)} className="w-full border rounded-xl p-2 text-xs text-brand-gold font-bold bg-white border-gray-200 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                      </div>

                      <div className="col-span-2">

                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Title</label>

                        <input {...register(`processSteps.${selectedIndex}.title`)} className="w-full border rounded-xl p-2 text-xs text-brand-blue font-bold bg-white border-gray-200 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                      </div>

                    </div>

                    <div>

                      <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Description</label>

                      <textarea rows={3} {...register(`processSteps.${selectedIndex}.description`)} className="w-full border rounded-xl p-2 text-xs text-gray-600 bg-white border-gray-200 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

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

                      selectContent(`award:${formData.awards?.length || 0}`);

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

                      onClick={() => selectContent(`award:${idx}`)}

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

                        No awards found. Click "Add Award" above to create one.

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

                            selectContent('awards-section');

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

                          className="w-full border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-brand-gold bg-white outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors"

                        />

                      </div>

                      <div>

                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Subtitle 1 (Organization / Category)</label>

                        <input

                          {...register(`awards.${targetIndex}.subtitle_1`)}

                          className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-brand-blue bg-white outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors"

                        />

                      </div>

                      <div>

                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Subtitle 2 (Year / Sub-text)</label>

                        <input

                          {...register(`awards.${targetIndex}.subtitle_2`)}

                          className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-brand-blue bg-white outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors"

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

                  <input {...register('settings.video_subtitle')} className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-brand-blue outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                </div>

                <div>

                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Massive Heading (Gold)</label>

                  <input {...register('settings.video_heading')} className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-brand-gold font-serif font-bold outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                </div>

                <div>

                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">YouTube Embed Link</label>

                  <input {...register('settings.video_url')} className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-brand-blue outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

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

                      selectContent(`news-item:${formData.newsArticles?.length || 0}`);

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

                      onClick={() => selectContent(`news-item:${idx}`)}

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

                    return <p className="text-xs text-gray-400">No news articles found. Click "Add Article" to create one.</p>;

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

                            selectContent('news-section');

                          }}

                          className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1"

                        >

                          <Trash2 size={13} /> Remove

                        </button>

                      </div>

                      <div>

                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Article Title</label>

                        <input {...register(`newsArticles.${targetIndex}.title`)} className="w-full border rounded-xl p-2.5 text-xs text-brand-blue font-bold bg-white outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                      </div>

                      <div className="grid grid-cols-2 gap-3">

                        <div>

                          <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Category</label>

                          <select {...register(`newsArticles.${targetIndex}.category`)} className="w-full border rounded-xl p-2.5 text-xs text-brand-blue bg-white outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors">

                            <option value="News">News</option>

                            <option value="Updates">Updates</option>

                            <option value="Events">Events</option>

                          </select>

                        </div>

                        <div>

                          <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Date</label>

                          <input {...register(`newsArticles.${targetIndex}.date`)} className="w-full border rounded-xl p-2.5 text-xs text-brand-blue bg-white outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                        </div>

                      </div>

                      <div>

                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">URL Slug</label>

                        <input {...register(`newsArticles.${targetIndex}.slug`)} className="w-full border rounded-xl p-2.5 text-xs text-brand-blue bg-white outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

                      </div>

                      <div>

                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Short Excerpt</label>

                        <textarea rows={3} {...register(`newsArticles.${targetIndex}.excerpt`)} className="w-full border rounded-xl p-2.5 text-xs text-gray-600 bg-white outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10 transition-colors" />

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
