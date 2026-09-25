'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle, ArrowLeft, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  FileText, Image as ImageIcon, Loader2, RotateCcw, Save, Type,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import ImageDropzone from '@/app/components/imagedropzone';
import {
  createAuditLogAction, fetchAdminStoryList, fetchStoryForEdit, saveStoryAction,
} from '@/app/actions/admin_fetchers';
import PreviewSkeleton, { StoryEditorRegion } from './PreviewSkeleton';

const storySchema = z.object({
  year: z.string().trim().min(1, 'Year is required'),
  title: z.string().trim().min(1, 'Milestone title is required'),
  description: z.string().trim().min(1, 'Description is required'),
  image: z.string().optional(),
});

type StoryFormData = z.infer<typeof storySchema>;
type EditorMilestone = { id: string; title: string; year: string };
const EMPTY_FORM: StoryFormData = { year: '', title: '', description: '', image: '' };
const DASHBOARD_URL = '/admin/dashboard?section=our%20story';

function StoryFormManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const supabase = useMemo(() => createClient(), []);

  const [isFetching, setIsFetching] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<EditorMilestone[]>([]);
  const [initialValues, setInitialValues] = useState<StoryFormData>(EMPTY_FORM);
  const [selectedRegion, setSelectedRegion] = useState<StoryEditorRegion>('year');
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const previewsRef = useRef(previews);
  const [saveError, setSaveError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [pendingNavigation, setPendingNavigation] = useState<{
    url: string; mode: 'push' | 'replace';
  } | null>(null);
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const loadedOnceRef = useRef(false);
  const loadTokenRef = useRef(0);

  const {
    register, watch, setValue, handleSubmit, reset, setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<StoryFormData>({ resolver: zodResolver(storySchema), defaultValues: EMPTY_FORM });

  useEffect(() => { previewsRef.current = previews; }, [previews]);
  useEffect(() => () => {
    Object.values(previewsRef.current).forEach(url => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
  }, []);

  const hasUnsavedChanges = isDirty || Object.keys(pendingFiles).length > 0;

  const loadNavigation = useCallback(async () => {
    const rows = await fetchAdminStoryList();
    const usable = (rows || []).filter((row: any) => !row.is_archived);
    const next = usable.map((row: any) => ({
      id: String(row.id), title: row.title || 'Untitled Milestone', year: String(row.year ?? ''),
    }));
    setMilestones(next);
    return usable;
  }, []);

  useEffect(() => {
    loadNavigation().catch(error => console.error('Could not load milestone navigation:', error));
  }, [editId, loadNavigation]);

  useEffect(() => {
    let cancelled = false;
    const token = ++loadTokenRef.current;
    const initialLoad = !loadedOnceRef.current;
    if (initialLoad) setIsFetching(true);
    else setIsSwitching(true);
    setSaveError('');

    const load = async () => {
      try {
        if (!editId) {
          if (cancelled || token !== loadTokenRef.current) return;
          reset(EMPTY_FORM);
          setInitialValues(EMPTY_FORM);
          setPendingFiles({});
          setPreviews({});
          setLoadedId(null);
          return;
        }
        const record = await fetchStoryForEdit(editId);
        if (!record) throw new Error('Milestone not found.');
        if (cancelled || token !== loadTokenRef.current) return;
        const values: StoryFormData = {
          year: String(record.year ?? ''), title: record.title || '',
          description: record.description || '', image: record.image || '',
        };
        reset(values);
        setInitialValues(values);
        setPendingFiles({});
        setPreviews(values.image ? { image: values.image } : {});
        setLoadedId(String(record.id ?? editId));
      } catch (error: any) {
        if (!cancelled && token === loadTokenRef.current) {
          setSaveError(error?.message || 'Could not load milestone.');
        }
      } finally {
        if (!cancelled && token === loadTokenRef.current) {
          loadedOnceRef.current = true;
          setIsFetching(false);
          setIsSwitching(false);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [editId, reset]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedChanges]);

  const requestNavigation = (url: string, mode: 'push' | 'replace' = 'push') => {
    if (isSubmitting || isSwitching) return;
    if (hasUnsavedChanges) {
      setPendingNavigation({ url, mode });
      setShowLeaveWarning(true);
    } else {
      if (mode === 'replace') router.replace(url);
      else router.push(url);
    }
  };

  const handleReset = () => {
    reset(initialValues);
    setPendingFiles({});
    setPreviews(initialValues.image ? { image: initialValues.image } : {});
    setSaveError('');
  };

  const onSubmit = async (data: StoryFormData) => {
    setSaveError('');
    try {
      let image = data.image || '';
      if (pendingFiles.image) {
        const file = pendingFiles.image;
        const extension = file.name.split('.').pop() || 'png';
        const path = `story/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
        const { error } = await supabase.storage.from('images').upload(path, file);
        if (error) throw error;
        image = supabase.storage.from('images').getPublicUrl(path).data.publicUrl;
      }
      if (!image || image.startsWith('blob:')) {
        setSelectedRegion('image');
        setError('image', { type: 'manual', message: 'Milestone image is required' });
        return;
      }

      const savedValues: StoryFormData = { ...data, image };
      const result = (await saveStoryAction(savedValues, editId)) as any;
      reset(savedValues);
      setInitialValues(savedValues);
      setPendingFiles({});
      setPreviews({ image });
      try {
        await createAuditLogAction(
          editId ? 'EDIT' : 'CREATE', 'Our Story', data.title,
          editId ? `Updated milestone for year ${data.year}` : `Added milestone for year ${data.year}`,
        );
      } catch (auditError) {
        console.error('Milestone saved, but its audit log failed:', auditError);
      }
      setSuccessMsg(editId ? 'Milestone updated.' : 'Milestone created.');
      window.setTimeout(() => setSuccessMsg(''), 2500);

      let rows: any[] = [];
      try {
        rows = await loadNavigation();
      } catch (navigationError) {
        console.error('Milestone saved, but navigation could not refresh:', navigationError);
      }
      if (!editId) {
        const returnedId = result?.id ?? (typeof result === 'number' || typeof result === 'string' ? result : null);
        const matches = rows.filter((row: any) =>
          String(row.year ?? '') === data.year && row.title === data.title && row.image === image,
        );
        const newId = returnedId ?? (matches.length === 1 ? matches[0].id : null);
        if (newId != null) router.replace(`/admin/story?edit=${newId}`);
        else {
          setSuccessMsg('Milestone saved. Reopen it from the Our Story list.');
          router.replace(DASHBOARD_URL);
        }
      }
    } catch (error: any) {
      setSaveError(error?.message || 'Could not save milestone.');
    }
  };

  const currentIndex = loadedId ? milestones.findIndex(item => item.id === loadedId) : -1;
  const canCycle = currentIndex >= 0 && milestones.length > 1;
  const openAdjacent = (delta: number) => {
    if (!canCycle || isSwitching || isSubmitting) return;
    const next = milestones[(currentIndex + delta + milestones.length) % milestones.length];
    requestNavigation(`/admin/story?edit=${next.id}`, 'replace');
  };

  const formData = watch();
  const previewData = {
    year: formData.year || 'Year', title: formData.title || 'Milestone Title',
    description: formData.description || 'Your milestone description appears here.',
    image: previews.image || formData.image || '',
  };
  const labelStyle = 'mb-2 block text-[10px] font-bold uppercase tracking-widest text-brand-blue/70';
  const inputStyle = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-brand-blue outline-none transition-all placeholder:text-gray-300 focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10';
  const showFirstInvalidField = (invalidFields: typeof errors) => {
    const first = Object.keys(invalidFields)[0];
    if (first === 'year' || first === 'title' || first === 'description' || first === 'image') {
      setSelectedRegion(first);
    }
  };
  const inspectorMeta: Record<StoryEditorRegion, { title: string; description: string }> = {
    year: { title: 'Milestone Year', description: 'Set the year displayed beside this timeline entry.' },
    title: { title: 'Milestone Title', description: 'Edit the headline for this moment in Our Story.' },
    description: { title: 'Milestone Description', description: 'Describe what happened at this milestone.' },
    image: { title: 'Milestone Image', description: 'Choose the image shown behind this timeline entry.' },
  };

  if (isFetching) return <div className="flex h-screen items-center justify-center bg-[#f5f6f8]"><Loader2 size={40} className="animate-spin text-brand-blue" /></div>;

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#f5f6f8] font-sans text-gray-900" aria-busy={isSwitching}>
      {successMsg && (
        <div role="status" className="fixed right-6 top-20 z-[120] flex items-center gap-3 rounded-xl border border-green-100 bg-white px-4 py-3 shadow-xl">
          <CheckCircle2 size={18} className="text-green-500" />
          <span className="text-xs font-medium text-brand-blue">{successMsg}</span>
        </div>
      )}
      {showLeaveWarning && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-brand-blue/55 p-4 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" aria-labelledby="leave-title" className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><AlertCircle size={24} /></div>
            <h2 id="leave-title" className="font-serif text-2xl text-brand-blue">Unsaved changes</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">Your edits have not been saved. Leaving now will discard them.</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => { setShowLeaveWarning(false); setPendingNavigation(null); }} className="flex-1 rounded-xl bg-gray-100 px-4 py-3 text-xs font-bold uppercase tracking-widest text-gray-600 hover:bg-gray-200">Keep Editing</button>
              <button type="button" onClick={() => { const target = pendingNavigation; setShowLeaveWarning(false); setPendingNavigation(null); if (target) { if (target.mode === 'replace') router.replace(target.url); else router.push(target.url); } }} className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-red-700">Discard & Continue</button>
            </div>
          </div>
        </div>
      )}

      <header className="z-40 flex h-[68px] shrink-0 items-center justify-between gap-6 border-b border-gray-200 bg-white px-6 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          <button type="button" onClick={() => requestNavigation(DASHBOARD_URL)} disabled={isSubmitting || isSwitching} aria-label="Back to Our Story" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition-colors hover:border-brand-blue hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-40"><ArrowLeft size={18} /></button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold"><span>Our Story</span><span className="text-gray-300">/</span><span className="truncate text-gray-400">{editId ? previewData.title : 'New Milestone'}</span></div>
            <div className="mt-0.5 flex items-center gap-3">
              <h1 className="truncate font-serif text-2xl text-brand-blue">{editId ? 'Edit Milestone' : 'Add Milestone'}</h1>
              {hasUnsavedChanges && <span className="hidden rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-amber-700 sm:inline-flex">Unsaved Changes</span>}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={handleReset} disabled={!hasUnsavedChanges || isSubmitting || isSwitching} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:border-brand-blue hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-40"><RotateCcw size={14} />Reset</button>
          <button type="button" onClick={handleSubmit(onSubmit, showFirstInvalidField)} disabled={!hasUnsavedChanges || isSubmitting || isSwitching} className="inline-flex min-w-[150px] items-center justify-center gap-2 rounded-xl bg-brand-blue px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-sm hover:bg-brand-gold disabled:cursor-not-allowed disabled:opacity-40">{isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{isSubmitting ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="relative min-h-0 bg-[#101827]">
          <div className="absolute left-6 top-5 z-30 rounded-full border border-brand-gold/30 bg-[#050B14]/80 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-brand-gold shadow-sm backdrop-blur-md lg:left-10 lg:top-7">
            Live Timeline Preview
          </div>
          <div className="h-full overflow-y-auto p-6 pb-24 pt-16 custom-scrollbar lg:p-10 lg:pb-28 lg:pt-20">
            <div className="mx-auto flex min-h-full w-full flex-col items-center justify-center">
              <PreviewSkeleton data={previewData} selectedRegion={selectedRegion} onSelectRegion={setSelectedRegion} />
              <p className="mt-5 text-center text-[9px] font-bold uppercase tracking-[0.18em] text-white/50">Select the image, year, title, or description to edit it</p>
            </div>
          </div>
          {editId && milestones.length > 0 && (
            <nav aria-label="Milestone navigation" className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-5 bg-gradient-to-t from-[#101827] via-[#101827]/95 to-transparent px-6 pb-5 pt-8 lg:pb-7">
              <button type="button" onClick={() => openAdjacent(-1)} disabled={!canCycle || isSubmitting || isSwitching} aria-label="Previous milestone" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:border-brand-gold disabled:cursor-not-allowed disabled:opacity-30"><ChevronLeft size={18} /></button>
              <span className="min-w-[58px] text-center text-xs font-bold tabular-nums text-white/80">{currentIndex >= 0 ? currentIndex + 1 : '—'} <span className="text-white/40">/</span> {milestones.length}</span>
              <button type="button" onClick={() => openAdjacent(1)} disabled={!canCycle || isSubmitting || isSwitching} aria-label="Next milestone" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:border-brand-gold disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight size={18} /></button>
            </nav>
          )}
        </section>

        <aside className="min-h-0 overflow-y-auto border-l border-gray-200 bg-white custom-scrollbar">
          <div className="border-b border-gray-100 px-6 py-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">Selected Content</p>
            <h2 className="mt-2 font-serif text-2xl text-brand-blue">{inspectorMeta[selectedRegion].title}</h2>
            <p className="mt-2 text-xs leading-relaxed text-gray-400">{inspectorMeta[selectedRegion].description}</p>
          </div>
          <div className="grid grid-cols-4 border-b border-gray-100 bg-gray-50/50 px-3 py-3">
            {([
              ['year', CalendarDays, 'Year'],
              ['title', Type, 'Title'],
              ['description', FileText, 'Story'],
              ['image', ImageIcon, 'Image'],
            ] as const).map(([region, Icon, label]) => (
              <button key={region} type="button" onClick={() => setSelectedRegion(region)} aria-pressed={selectedRegion === region} className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[8px] font-bold uppercase tracking-wider transition-colors ${selectedRegion === region ? 'bg-white text-brand-blue shadow-sm ring-1 ring-gray-200' : 'text-gray-400 hover:text-brand-blue'}`}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit(onSubmit, showFirstInvalidField)} className="p-6">
            {selectedRegion === 'year' && (
              <div><label htmlFor="story-year" className={labelStyle}>Year</label><input id="story-year" {...register('year')} placeholder="e.g. 2024" className={inputStyle} />{errors.year && <p className="mt-2 text-xs text-red-600">{errors.year.message}</p>}</div>
            )}
            {selectedRegion === 'title' && (
              <div><label htmlFor="story-title" className={labelStyle}>Milestone Title</label><input id="story-title" {...register('title')} placeholder="e.g. The brand was founded" className={inputStyle} />{errors.title && <p className="mt-2 text-xs text-red-600">{errors.title.message}</p>}</div>
            )}
            {selectedRegion === 'description' && (
              <div><label htmlFor="story-description" className={labelStyle}>Description</label><textarea id="story-description" {...register('description')} rows={12} className={`${inputStyle} resize-y leading-relaxed`} placeholder="Tell the story behind this milestone..." />{errors.description && <p className="mt-2 text-xs text-red-600">{errors.description.message}</p>}</div>
            )}
            {selectedRegion === 'image' && (
              <div><ImageDropzone fieldPath="image" label="Milestone Cover Image" height="h-48" watch={watch} setValue={setValue} errors={errors} setPendingFiles={setPendingFiles} setPreviews={setPreviews} previews={previews} /><p className="mt-3 text-[10px] leading-relaxed text-gray-400">Choose a landscape image with a clear focal point for the timeline.</p></div>
            )}
            {Object.keys(errors).length > 0 && <div role="alert" className="mt-6 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-600"><AlertCircle size={16} className="shrink-0" />Complete the required milestone fields before saving.</div>}
            {saveError && <div role="alert" className="mt-6 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-600"><AlertCircle size={16} className="shrink-0" />{saveError}</div>}
            <div className="mt-6 rounded-xl border border-brand-blue/10 bg-brand-blue/[0.03] p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-brand-blue/60">Website Visibility</p><p className="mt-1 text-xs leading-relaxed text-gray-500">Changes stay staged until Save Changes is pressed. Show or hide a milestone from the Our Story list.</p></div>
          </form>
        </aside>
      </main>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#f5f6f8]"><Loader2 size={40} className="animate-spin text-brand-blue" /></div>}><StoryFormManager /></Suspense>;
}
