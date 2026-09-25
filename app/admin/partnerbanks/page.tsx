'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Landmark,
  Loader2,
  Percent,
  RotateCcw,
  Save,
} from 'lucide-react';

import { createClient } from '@/utils/supabase/client';
import ImageDropzone from '@/app/components/imagedropzone';
import PreviewSkeleton from './PreviewSkeleton';
import { processBankServerActions } from '@/app/actions/banks';
import { fetchAdminProjectsList } from '@/app/actions/projects';
import {
  fetchAdminBanksList,
  fetchBankForEdit,
  fetchBankProjectLinksAction,
  saveBankAction,
} from '@/app/actions/admin_fetchers';

const bankSchema = z.object({
  bank_name: z.string().min(1, 'Bank name is required'),
  max_loan: z.string().min(1, 'Max loan percentage is required'),
  terms: z.string().min(1, 'Terms description is required'),
  short_description: z.string().min(1, 'Short description is required'),
  image: z.string().min(1, 'Bank logo is required'),
  projects: z.array(z.string()).optional(),
});

type BankFormData = z.infer<typeof bankSchema>;
type InspectorRegion = 'details' | 'financing' | 'description' | 'logo' | 'projects';

type AvailableProject = {
  id: number;
  title: string;
  is_active: boolean;
};

type EditorBank = {
  id: number;
  bank_name: string;
};

const BLANK_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

const EMPTY_FORM: BankFormData = {
  bank_name: '',
  max_loan: '',
  terms: '',
  short_description: '',
  image: '',
  projects: [],
};

function PartnerBanksManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const supabase = useMemo(() => createClient(), []);

  const [isFetching, setIsFetching] = useState(true);
  const [isSwitchingBank, setIsSwitchingBank] = useState(false);
  const [loadedBankId, setLoadedBankId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [saveError, setSaveError] = useState('');
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const previewsRef = useRef<Record<string, string>>({});
  const hasLoadedEditorRef = useRef(false);
  const activeLoadRef = useRef(0);
  const [availableProjects, setAvailableProjects] = useState<AvailableProject[]>([]);
  const [editorBanks, setEditorBanks] = useState<EditorBank[]>([]);
  const [initialValues, setInitialValues] = useState<BankFormData>(EMPTY_FORM);
  const [selectedRegion, setSelectedRegion] = useState<InspectorRegion>('details');
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{
    url: string;
    mode: 'push' | 'replace';
  } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<BankFormData>({
    resolver: zodResolver(bankSchema),
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  useEffect(() => {
    return () => {
      Object.values(previewsRef.current).forEach((url) => {
        if (typeof url === 'string' && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []);

  const hasPendingFiles = Object.keys(pendingFiles).length > 0;
  const hasUnsavedChanges = isDirty || hasPendingFiles;

  const sanitizeProjectIds = (
    ids: Array<string | number> | undefined,
    projects: AvailableProject[] = availableProjects
  ) => {
    const validIds = new Set(projects.map((project) => String(project.id)));
    return (ids || []).map(String).filter((id) => validIds.has(id));
  };

  const refreshProjects = async (preserveSelections = true) => {
    const projects = (await fetchAdminProjectsList()) || [];
    const normalized: AvailableProject[] = projects.map((project: any) => ({
      id: Number(project.id),
      title: project.title || 'Untitled Project',
      is_active: project.is_active !== false,
    }));

    setAvailableProjects(normalized);

    if (preserveSelections) {
      const currentSelections = getValues('projects') || [];
      const cleanedSelections = sanitizeProjectIds(currentSelections, normalized);
      if (cleanedSelections.length !== currentSelections.length) {
        setValue('projects', cleanedSelections, { shouldDirty: true });
      }
    }

    return normalized;
  };

  useEffect(() => {
    const loadEditorBanks = async () => {
      try {
        const rows = (await fetchAdminBanksList()) || [];
        setEditorBanks(
          rows.map((bank: any) => ({
            id: Number(bank.id),
            bank_name: bank.bank_name || 'Untitled Bank',
          }))
        );
      } catch (error) {
        console.error('Failed to load partner bank navigation:', error);
      }
    };

    loadEditorBanks();
  }, [editId]);

  useEffect(() => {
    let cancelled = false;
    const loadToken = ++activeLoadRef.current;
    const isInitialLoad = !hasLoadedEditorRef.current;

    const initData = async () => {
      if (isInitialLoad) {
        setIsFetching(true);
      } else {
        setIsSwitchingBank(true);
      }

      setSaveError('');

      try {
        const projects = await refreshProjects(false);

        if (editId) {
          const [bankData, linkedProjectIds] = await Promise.all([
            fetchBankForEdit(editId),
            fetchBankProjectLinksAction(editId),
          ]);

          if (!bankData) throw new Error('Bank not found');

          if (cancelled || loadToken !== activeLoadRef.current) return;

          const values: BankFormData = {
            bank_name: bankData.bank_name || '',
            max_loan: bankData.max_loan?.toString() || '',
            terms: bankData.terms || '',
            short_description: bankData.short_description || '',
            image: bankData.image || '',
            projects: sanitizeProjectIds(linkedProjectIds || [], projects),
          };

          reset(values);
          setInitialValues(values);
          setPreviews(bankData.image ? { image: bankData.image } : {});
          setLoadedBankId(String(editId));
        } else {
          if (cancelled || loadToken !== activeLoadRef.current) return;

          reset(EMPTY_FORM);
          setInitialValues(EMPTY_FORM);
          setPreviews({});
          setLoadedBankId(null);
        }
      } catch (error: any) {
        if (cancelled || loadToken !== activeLoadRef.current) return;

        console.error('Error fetching partner bank editor data:', error);
        setSaveError(error?.message || 'Failed to load partner bank data.');
      } finally {
        if (!cancelled && loadToken === activeLoadRef.current) {
          hasLoadedEditorRef.current = true;
          setIsFetching(false);
          setIsSwitchingBank(false);
        }
      }
    };

    initData();

    return () => {
      cancelled = true;
    };
  }, [editId]);

  useEffect(() => {
    const handleFocus = () => {
      refreshProjects(true).catch((error) => {
        console.error('Failed to refresh accredited project options:', error);
      });
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [availableProjects.length]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const requestNavigation = (
    url: string,
    mode: 'push' | 'replace' = 'push'
  ) => {
    if (hasUnsavedChanges) {
      setPendingNavigation({ url, mode });
      setShowLeaveWarning(true);
      return;
    }

    if (mode === 'replace') {
      router.replace(url);
    } else {
      router.push(url);
    }
  };

  const goBack = () => {
    requestNavigation('/admin/dashboard?section=Partner%20Banks');
  };

  const handleReset = () => {
    reset(initialValues);
    setPendingFiles({});
    setPreviews(initialValues.image ? { image: initialValues.image } : {});
    setSaveError('');
  };

  const onSubmit = async (data: BankFormData) => {
    setSaveError('');

    try {
      let finalData: BankFormData = {
        ...data,
        projects: sanitizeProjectIds(data.projects),
      };

      for (const file of Object.values(pendingFiles)) {
        const fileExt = file.name.split('.').pop() || 'png';
        const uniqueFileName = `banks/${Date.now()}-${Math.random()
          .toString(36)
          .substring(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(uniqueFileName, file);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from('images').getPublicUrl(uniqueFileName);

        finalData.image = publicUrl;
      }

      const saveResult = await saveBankAction(
        {
          bank_name: finalData.bank_name,
          max_loan: finalData.max_loan,
          terms: finalData.terms,
          short_description: finalData.short_description,
          image: finalData.image,
        },
        editId
      );

      if (!saveResult.success || !saveResult.id) {
        throw new Error('Failed to save base bank details');
      }

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

      const savedValues: BankFormData = {
        ...finalData,
        projects: sanitizeProjectIds(finalData.projects),
      };

      reset(savedValues);
      setInitialValues(savedValues);
      setPendingFiles({});
      setPreviews(savedValues.image ? { image: savedValues.image } : {});
      setSuccessMsg(editId ? 'Partner bank updated.' : 'Partner bank created.');
      setTimeout(() => setSuccessMsg(''), 2500);

      if (!editId) {
        router.replace(`/admin/partnerbanks?edit=${saveResult.id}`);
      }
    } catch (error: any) {
      setSaveError(error?.message || 'Failed to save partner bank.');
    }
  };

  const formData = watch();
  const selectedProjects = formData.projects || [];
  const hasErrors = Object.keys(errors).length > 0;

  const currentBankIndex = loadedBankId
    ? editorBanks.findIndex((bank) => String(bank.id) === loadedBankId)
    : -1;

  const canCycleBanks = currentBankIndex >= 0 && editorBanks.length > 1;

  const previousBank = canCycleBanks
    ? editorBanks[
        (currentBankIndex - 1 + editorBanks.length) % editorBanks.length
      ]
    : null;

  const nextBank = canCycleBanks
    ? editorBanks[(currentBankIndex + 1) % editorBanks.length]
    : null;

  const openAdjacentBank = (bank: EditorBank | null) => {
    if (!bank) return;
    requestNavigation(`/admin/partnerbanks?edit=${bank.id}`, 'replace');
  };

  const previewData = {
    bank_name: formData.bank_name || 'Bank Name',
    max_loan: formData.max_loan || '80',
    terms: formData.terms || 'Up to 20 years',
    short_description:
      formData.short_description ||
      "Write a brief description of the bank's financing offers to see it rendered live here...",
    image: previews.image || formData.image || BLANK_IMAGE,
  };

  const inputStyles =
    'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-brand-blue outline-none transition-all placeholder:text-gray-300 focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10';
  const labelStyles =
    'mb-2 block text-[10px] font-bold uppercase tracking-widest text-brand-blue/70';

  const inspectorMeta: Record<InspectorRegion, { eyebrow: string; title: string; description: string }> = {
    details: {
      eyebrow: 'Selected Content',
      title: previewData.bank_name,
      description: 'Edit the partner bank name shown on the public financing card.',
    },
    financing: {
      eyebrow: 'Selected Content',
      title: 'Financing Details',
      description: 'Manage the maximum loan percentage and displayed loan term.',
    },
    description: {
      eyebrow: 'Selected Content',
      title: 'Bank Description',
      description: 'Edit the short supporting copy displayed on the bank card.',
    },
    logo: {
      eyebrow: 'Selected Content',
      title: 'Bank Logo',
      description: 'Upload or replace the logo used on the Partner Banks page.',
    },
    projects: {
      eyebrow: 'Bank Settings',
      title: 'Accredited Projects',
      description: 'Choose which current projects this bank is accredited for.',
    },
  };

  if (isFetching) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f6f8]">
        <Loader2 className="animate-spin text-brand-blue" size={40} />
      </div>
    );
  }

  return (
    <div
      className="flex h-screen w-full flex-col overflow-hidden bg-[#f5f6f8] font-sans text-gray-900"
      aria-busy={isSwitchingBank}
    >
      {successMsg && (
        <div className="fixed right-6 top-20 z-[120] flex items-center gap-3 rounded-xl border border-green-100 bg-white px-4 py-3 shadow-xl">
          <CheckCircle2 size={18} className="text-green-500" />
          <div>
            <p className="text-xs font-bold text-brand-blue">Saved</p>
            <p className="text-[11px] text-gray-500">{successMsg}</p>
          </div>
        </div>
      )}

      {showLeaveWarning && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-brand-blue/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <AlertCircle size={24} />
            </div>
            <h2 className="text-2xl font-serif text-brand-blue">Unsaved changes</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              You have edits that have not been saved yet. Leaving or switching banks now will discard them.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowLeaveWarning(false);
                  setPendingNavigation(null);
                }}
                className="flex-1 rounded-xl bg-gray-100 px-4 py-3 text-xs font-bold uppercase tracking-widest text-gray-600 hover:bg-gray-200"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = pendingNavigation;
                  setShowLeaveWarning(false);
                  setPendingNavigation(null);

                  if (!target) {
                    router.push('/admin/dashboard?section=Partner%20Banks');
                    return;
                  }

                  if (target.mode === 'replace') {
                    router.replace(target.url);
                  } else {
                    router.push(target.url);
                  }
                }}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-red-700"
              >
                Discard & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="z-40 flex h-[68px] shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={goBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition-colors hover:border-brand-blue hover:text-brand-blue"
            aria-label="Back to Partner Banks"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">
              Partner Banks
              <span className="text-gray-300">/</span>
              <span className="truncate text-gray-400">
                {editId ? previewData.bank_name : 'New Bank'}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-3">
              <h1 className="truncate text-2xl font-serif text-brand-blue">
                {editId ? 'Edit Partner Bank' : 'Add Partner Bank'}
              </h1>
              {hasUnsavedChanges && (
                <span className="hidden rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-amber-700 sm:inline-flex">
                  Unsaved Changes
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={!hasUnsavedChanges || isSubmitting || isSwitchingBank}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 transition-colors hover:border-brand-blue hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw size={14} />
            Reset
          </button>

          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={!hasUnsavedChanges || isSubmitting || isSwitchingBank}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-sm transition-colors hover:bg-brand-gold disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="relative min-h-0 overflow-auto bg-[#eef1f5] p-6 lg:p-10">
          <div className="absolute left-6 top-5 z-20 lg:left-10 lg:top-7">
            <span className="inline-flex rounded-full border border-brand-gold/30 bg-white/90 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-brand-gold shadow-sm backdrop-blur-md">
              Live Preview
            </span>
          </div>

          <div className="flex min-h-full flex-col items-center justify-center pt-10">
            <PreviewSkeleton
              data={previewData}
              selectedRegion={selectedRegion}
              onSelectRegion={(region) => setSelectedRegion(region)}
            />

            {editId && editorBanks.length > 0 && (
              <div className="mt-8 flex items-center justify-center gap-5">
                <button
                  type="button"
                  onClick={() => openAdjacentBank(previousBank)}
                  disabled={!canCycleBanks || isSubmitting || isSwitchingBank}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-all hover:border-brand-gold hover:text-brand-blue hover:shadow-md disabled:cursor-not-allowed disabled:opacity-30"
                  title={
                    previousBank
                      ? `Previous bank: ${previousBank.bank_name}`
                      : 'No other bank available'
                  }
                  aria-label={
                    previousBank
                      ? `Edit previous bank: ${previousBank.bank_name}`
                      : 'No other bank available'
                  }
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="min-w-[58px] text-center">
                  <div className="text-xs font-bold tabular-nums text-brand-blue/70">
                    {currentBankIndex >= 0 ? currentBankIndex + 1 : '—'}
                    <span className="mx-1 text-gray-300">/</span>
                    {editorBanks.length}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openAdjacentBank(nextBank)}
                  disabled={!canCycleBanks || isSubmitting || isSwitchingBank}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-all hover:border-brand-gold hover:text-brand-blue hover:shadow-md disabled:cursor-not-allowed disabled:opacity-30"
                  title={
                    nextBank
                      ? `Next bank: ${nextBank.bank_name}`
                      : 'No other bank available'
                  }
                  aria-label={
                    nextBank
                      ? `Edit next bank: ${nextBank.bank_name}`
                      : 'No other bank available'
                  }
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
        </section>

        <aside className="min-h-0 overflow-y-auto border-l border-gray-200 bg-white custom-scrollbar">
          <div className="border-b border-gray-100 px-6 py-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">
              {inspectorMeta[selectedRegion].eyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-serif text-brand-blue">
              {inspectorMeta[selectedRegion].title}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-gray-400">
              {inspectorMeta[selectedRegion].description}
            </p>
          </div>

          <div className="grid grid-cols-5 border-b border-gray-100 bg-gray-50/50 px-3 py-3">
            {([
              ['details', Building2, 'Bank'],
              ['financing', Percent, 'Finance'],
              ['description', FileText, 'Copy'],
              ['logo', ImageIcon, 'Logo'],
              ['projects', Landmark, 'Projects'],
            ] as const).map(([region, Icon, label]) => (
              <button
                key={region}
                type="button"
                onClick={() => setSelectedRegion(region)}
                className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[8px] font-bold uppercase tracking-wider transition-colors ${
                  selectedRegion === region
                    ? 'bg-white text-brand-blue shadow-sm ring-1 ring-gray-200'
                    : 'text-gray-400 hover:text-brand-blue'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-6">
            {selectedRegion === 'details' && (
              <div>
                <label className={labelStyles}>Bank Name</label>
                <input
                  {...register('bank_name')}
                  className={inputStyles}
                  placeholder="e.g. BDO Unibank"
                />
                {errors.bank_name && (
                  <p className="mt-2 text-[10px] font-bold text-red-500">
                    {errors.bank_name.message}
                  </p>
                )}
              </div>
            )}

            {selectedRegion === 'financing' && (
              <div className="space-y-5">
                <div>
                  <label className={labelStyles}>Max Loan (%)</label>
                  <div className="relative">
                    <input
                      {...register('max_loan')}
                      className={`${inputStyles} pr-10`}
                      placeholder="e.g. 80"
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-300">
                      %
                    </span>
                  </div>
                  {errors.max_loan && (
                    <p className="mt-2 text-[10px] font-bold text-red-500">
                      {errors.max_loan.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelStyles}>Terms</label>
                  <input
                    {...register('terms')}
                    className={inputStyles}
                    placeholder="e.g. Up to 20 years"
                  />
                  {errors.terms && (
                    <p className="mt-2 text-[10px] font-bold text-red-500">
                      {errors.terms.message}
                    </p>
                  )}
                </div>
              </div>
            )}

            {selectedRegion === 'description' && (
              <div>
                <label className={labelStyles}>Short Description</label>
                <textarea
                  {...register('short_description')}
                  rows={7}
                  className={`${inputStyles} resize-none leading-relaxed`}
                  placeholder="Write a brief description of this bank's financing offer..."
                />
                {errors.short_description && (
                  <p className="mt-2 text-[10px] font-bold text-red-500">
                    {errors.short_description.message}
                  </p>
                )}
              </div>
            )}

            {selectedRegion === 'logo' && (
              <div>
                <ImageDropzone
                  fieldPath="image"
                  label="Bank Logo"
                  height="h-40"
                  watch={watch}
                  setValue={setValue}
                  errors={errors}
                  setPendingFiles={setPendingFiles}
                  setPreviews={setPreviews}
                  previews={previews}
                />
                <p className="mt-3 text-[10px] leading-relaxed text-gray-400">
                  Use a clean logo with enough transparent or white space so it remains legible inside the public bank card.
                </p>
              </div>
            )}

            {selectedRegion === 'projects' && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-brand-blue">
                      {selectedProjects.length} selected
                    </p>
                    <p className="mt-1 text-[10px] text-gray-400">
                      All current non-archived projects are available here.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => refreshProjects(true)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-brand-blue hover:border-brand-blue"
                  >
                    Refresh
                  </button>
                </div>

                {availableProjects.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center">
                    <p className="text-xs font-bold text-brand-blue">No projects available</p>
                    <p className="mt-1 text-[10px] text-gray-400">
                      Create a project first, then return here to assign bank accreditation.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableProjects.map((project) => (
                      <label
                        key={project.id}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition-colors hover:border-brand-gold hover:bg-brand-gold/[0.03]"
                      >
                        <input
                          type="checkbox"
                          value={project.id.toString()}
                          {...register('projects')}
                          className="h-4 w-4 shrink-0 rounded border-gray-300 text-brand-blue focus:ring-brand-gold"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-brand-blue">
                            {project.title}
                          </p>
                          <p className="mt-0.5 text-[9px] uppercase tracking-wider text-gray-400">
                            Project #{project.id}
                          </p>
                        </div>
                        {!project.is_active && (
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-gray-500">
                            Hidden
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}

                <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700">
                    Project source
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-blue-700/70">
                    This list comes from the main project registry. New projects appear automatically; archived projects are excluded.
                  </p>
                </div>
              </div>
            )}

            {hasErrors && (
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-medium text-red-600">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>Please complete all required bank fields before saving.</span>
              </div>
            )}

            {saveError && (
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-medium text-red-600">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}
          </form>
        </aside>
      </main>
    </div>
  );
}

export default function AdminPartnerBanksPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#f5f6f8]">
          <Loader2 className="animate-spin text-brand-blue" size={40} />
        </div>
      }
    >
      <PartnerBanksManager />
    </Suspense>
  );
}
