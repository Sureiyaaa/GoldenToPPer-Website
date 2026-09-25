// app/admin/promotions/page.tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  Save,
} from 'lucide-react';

import {
  createAuditLogAction,
  fetchAdminPromotionsList,
  fetchPromotionForEdit,
  savePromotionAction,
} from '@/app/actions/admin_fetchers';

const promoSchema = z.object({
  title: z.string().min(1, 'Promotion title is required'),
  status: z.string().min(1, 'Status tag is required'),
  validity_date: z.string().min(1, 'Validity date is required'),
  description: z.string().min(1, 'Description is required'),
});

type PromoFormData = z.infer<typeof promoSchema>;

type EditorPromotion = {
  id: number;
  title: string;
};

const EMPTY_FORM: PromoFormData = {
  title: '',
  status: '',
  validity_date: '',
  description: '',
};

function PromotionsFormManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [isFetching, setIsFetching] = useState(true);
  const [isSwitchingPromotion, setIsSwitchingPromotion] = useState(false);
  const [loadedPromotionId, setLoadedPromotionId] = useState<string | null>(null);

  const [successMsg, setSuccessMsg] = useState('');
  const [saveError, setSaveError] = useState('');

  const [initialValues, setInitialValues] =
    useState<PromoFormData>(EMPTY_FORM);

  const [editorPromotions, setEditorPromotions] = useState<
    EditorPromotion[]
  >([]);

  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{
    url: string;
    mode: 'push' | 'replace';
  } | null>(null);

  const [hasLoadedEditor, setHasLoadedEditor] = useState(false);
  const [activeLoadToken, setActiveLoadToken] = useState(0);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PromoFormData>({
    resolver: zodResolver(promoSchema),
    defaultValues: EMPTY_FORM,
  });

  const hasUnsavedChanges = isDirty;

  useEffect(() => {
    const loadPromotionNavigation = async () => {
      try {
        const rows = (await fetchAdminPromotionsList()) || [];

        setEditorPromotions(
          rows.map((promotion: any) => ({
            id: Number(promotion.id),
            title: promotion.title || 'Untitled Promotion',
          }))
        );
      } catch (error) {
        console.error('Failed to load promotion navigation:', error);
      }
    };

    loadPromotionNavigation();
  }, [editId]);

  useEffect(() => {
    let cancelled = false;
    const nextToken = activeLoadToken + 1;
    setActiveLoadToken(nextToken);

    const initData = async () => {
      if (!hasLoadedEditor) {
        setIsFetching(true);
      } else {
        setIsSwitchingPromotion(true);
      }

      setSaveError('');

      try {
        if (editId) {
          const promoData = await fetchPromotionForEdit(editId);

          if (!promoData) {
            throw new Error('Promotion not found');
          }

          if (cancelled) return;

          const values: PromoFormData = {
            title: promoData.title || '',
            status: promoData.status || '',
            validity_date: promoData.validity_date || '',
            description: promoData.description || '',
          };

          reset(values);
          setInitialValues(values);
          setLoadedPromotionId(String(editId));
        } else {
          if (cancelled) return;

          reset(EMPTY_FORM);
          setInitialValues(EMPTY_FORM);
          setLoadedPromotionId(null);
        }
      } catch (error: any) {
        if (cancelled) return;

        console.error('Error fetching promotion editor data:', error);
        setSaveError(
          error?.message || 'Failed to load promotion data.'
        );
      } finally {
        if (!cancelled) {
          setHasLoadedEditor(true);
          setIsFetching(false);
          setIsSwitchingPromotion(false);
        }
      }
    };

    initData();

    return () => {
      cancelled = true;
    };
  }, [editId, reset]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () =>
      window.removeEventListener('beforeunload', handleBeforeUnload);
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
    requestNavigation('/admin/dashboard?section=Promotions');
  };

  const handleReset = () => {
    reset(initialValues);
    setSaveError('');
  };

  const refreshPromotionNavigation = async () => {
    const rows = (await fetchAdminPromotionsList()) || [];

    setEditorPromotions(
      rows.map((promotion: any) => ({
        id: Number(promotion.id),
        title: promotion.title || 'Untitled Promotion',
      }))
    );
  };

  const onSubmit = async (data: PromoFormData) => {
    setSaveError('');

    try {
      const saveResult = await savePromotionAction(
        {
          title: data.title,
          status: data.status,
          validity_date: data.validity_date,
          description: data.description,
        },
        editId
      );

      if (!saveResult?.success) {
        throw new Error('Failed to save promotion');
      }

      await createAuditLogAction(
        editId ? 'EDIT' : 'CREATE',
        'Promotions',
        data.title,
        editId
          ? 'Updated existing promotion details.'
          : 'Added a new promotion.'
      );

      reset(data);
      setInitialValues(data);

      setSuccessMsg(
        editId ? 'Promotion updated.' : 'Promotion created.'
      );

      window.setTimeout(() => setSuccessMsg(''), 2500);

      if (!editId && saveResult.id) {
        router.replace(`/admin/promotions?edit=${saveResult.id}`);
      } else {
        await refreshPromotionNavigation();
      }
    } catch (error: any) {
      setSaveError(
        error?.message || 'Failed to save promotion.'
      );
    }
  };

  const formData = watch();
  const hasErrors = Object.keys(errors).length > 0;

  const currentPromotionIndex = loadedPromotionId
    ? editorPromotions.findIndex(
        (promotion) =>
          String(promotion.id) === loadedPromotionId
      )
    : -1;

  const canCyclePromotions =
    currentPromotionIndex >= 0 &&
    editorPromotions.length > 1;

  const previousPromotion = canCyclePromotions
    ? editorPromotions[
        (currentPromotionIndex -
          1 +
          editorPromotions.length) %
          editorPromotions.length
      ]
    : null;

  const nextPromotion = canCyclePromotions
    ? editorPromotions[
        (currentPromotionIndex + 1) %
          editorPromotions.length
      ]
    : null;

  const openAdjacentPromotion = (
    promotion: EditorPromotion | null
  ) => {
    if (!promotion) return;

    requestNavigation(
      `/admin/promotions?edit=${promotion.id}`,
      'replace'
    );
  };

  const inputStyles =
    'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-brand-blue outline-none transition-all placeholder:text-gray-300 focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10';

  const labelStyles =
    'mb-2 block text-[10px] font-bold uppercase tracking-widest text-brand-blue/70';

  if (isFetching) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f6f8]">
        <Loader2
          className="animate-spin text-brand-blue"
          size={40}
        />
      </div>
    );
  }

  return (
    <div
      className="flex h-screen w-full flex-col overflow-hidden bg-[#f5f6f8] font-sans text-gray-900"
      aria-busy={isSwitchingPromotion}
    >
      {successMsg && (
        <div className="fixed right-6 top-20 z-[120] flex items-center gap-3 rounded-xl border border-green-100 bg-white px-4 py-3 shadow-xl">
          <CheckCircle2
            size={18}
            className="text-green-500"
          />

          <div>
            <p className="text-xs font-bold text-brand-blue">
              Saved
            </p>
            <p className="text-[11px] text-gray-500">
              {successMsg}
            </p>
          </div>
        </div>
      )}

      {showLeaveWarning && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-brand-blue/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <AlertCircle size={24} />
            </div>

            <h2 className="text-2xl font-serif text-brand-blue">
              Unsaved changes
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              You have edits that have not been saved yet.
              Leaving or switching promotions now will discard
              them.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowLeaveWarning(false);
                  setPendingNavigation(null);
                }}
                className="flex-1 rounded-xl bg-gray-100 px-4 py-3 text-xs font-bold uppercase tracking-widest text-gray-600 transition-colors hover:bg-gray-200"
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
                    router.push(
                      '/admin/dashboard?section=Promotions'
                    );
                    return;
                  }

                  if (target.mode === 'replace') {
                    router.replace(target.url);
                  } else {
                    router.push(target.url);
                  }
                }}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-red-700"
              >
                Discard & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="z-40 flex h-[68px] shrink-0 items-center justify-between gap-6 border-b border-gray-200 bg-white px-6 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={goBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition-colors hover:border-brand-blue hover:text-brand-blue"
            aria-label="Back to Promotions"
            title="Back to Promotions"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">
              <span>Promotions</span>
              <span className="text-gray-300">/</span>
              <span className="truncate text-gray-400">
                {editId
                  ? formData.title || 'Promotion'
                  : 'New Promotion'}
              </span>
            </div>

            <div className="mt-0.5 flex items-center gap-3">
              <h1 className="truncate text-2xl font-serif text-brand-blue">
                {editId
                  ? 'Edit Promotion'
                  : 'Add Promotion'}
              </h1>

              {hasUnsavedChanges && (
                <span className="hidden rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-amber-700 sm:inline-flex">
                  Unsaved Changes
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={
              !hasUnsavedChanges ||
              isSubmitting ||
              isSwitchingPromotion
            }
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 transition-colors hover:border-brand-blue hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw size={14} />
            Reset
          </button>

          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={
              !hasUnsavedChanges ||
              isSubmitting ||
              isSwitchingPromotion
            }
            className="inline-flex min-w-[150px] items-center justify-center gap-2 rounded-xl bg-brand-blue px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-sm transition-colors hover:bg-brand-gold disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? (
              <Loader2
                size={14}
                className="animate-spin"
              />
            ) : (
              <Save size={14} />
            )}

            {isSubmitting
              ? 'Saving...'
              : 'Save Changes'}
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto flex w-full max-w-3xl flex-col">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm"
          >
            <div className="border-b border-gray-100 px-6 py-5 sm:px-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">
                Promotion Details
              </p>

              <h2 className="mt-1 text-xl font-serif text-brand-blue">
                {editId
                  ? formData.title || 'Edit Promotion'
                  : 'Create Promotion'}
              </h2>

              <p className="mt-2 text-xs leading-relaxed text-gray-400">
                Update the visitor-facing promotion content below.
                Changes remain staged until Save Changes is
                pressed.
              </p>
            </div>

            <div className="space-y-6 px-6 py-6 sm:px-7">
              <div>
                <label className={labelStyles}>
                  Promotion Title
                </label>

                <input
                  {...register('title')}
                  className={inputStyles}
                  placeholder="e.g. Summer Move-in Promo"
                />

                {errors.title && (
                  <p className="mt-2 text-[10px] font-bold text-red-500">
                    {errors.title.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className={labelStyles}>
                    Status Tag
                  </label>

                  <div className="relative">
                    <select
                      {...register('status')}
                      className={`${inputStyles} cursor-pointer appearance-none pr-10`}
                    >
                      <option value="" disabled>
                        Select a status...
                      </option>
                      <option value="Limited Offer">
                        Limited Offer
                      </option>
                      <option value="Special Offer">
                        Special Offer
                      </option>
                      <option value="Pre-Selling">
                        Pre-Selling
                      </option>
                      <option value="Ready For Occupancy">
                        Ready For Occupancy
                      </option>
                      <option value="Early Bird">
                        Early Bird
                      </option>
                      <option value="Year-End Promo">
                        Year-End Promo
                      </option>
                      <option value="Loyalty Program">
                        Loyalty Program
                      </option>
                    </select>

                    <ChevronDown
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                      size={16}
                    />
                  </div>

                  {errors.status && (
                    <p className="mt-2 text-[10px] font-bold text-red-500">
                      {errors.status.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelStyles}>
                    Validity Date
                  </label>

                  <input
                    {...register('validity_date')}
                    className={inputStyles}
                    placeholder="e.g. December 31, 2026"
                  />

                  {errors.validity_date && (
                    <p className="mt-2 text-[10px] font-bold text-red-500">
                      {errors.validity_date.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className={labelStyles}>
                  Promotion Description
                </label>

                <textarea
                  {...register('description')}
                  rows={8}
                  className={`${inputStyles} resize-none leading-relaxed`}
                  placeholder="Describe the promotion mechanics, rules, and benefits..."
                />

                {errors.description && (
                  <p className="mt-2 text-[10px] font-bold text-red-500">
                    {errors.description.message}
                  </p>
                )}
              </div>

              {hasErrors && (
                <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-medium text-red-600">
                  <AlertCircle
                    size={16}
                    className="mt-0.5 shrink-0"
                  />
                  <span>
                    Please complete all required promotion fields
                    before saving.
                  </span>
                </div>
              )}

              {saveError && (
                <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-medium text-red-600">
                  <AlertCircle
                    size={16}
                    className="mt-0.5 shrink-0"
                  />
                  <span>{saveError}</span>
                </div>
              )}

              <div className="rounded-2xl border border-brand-blue/10 bg-brand-blue/[0.03] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-blue/60">
                  Website content
                </p>

                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  The title, status, validity, and description are
                  used by the public Promotions section. Website
                  visibility is managed from the Promotions list.
                </p>
              </div>
            </div>
          </form>

          {editId && editorPromotions.length > 0 && (
            <div className="mt-7 flex items-center justify-center gap-5">
              <button
                type="button"
                onClick={() =>
                  openAdjacentPromotion(previousPromotion)
                }
                disabled={
                  !canCyclePromotions ||
                  isSubmitting ||
                  isSwitchingPromotion
                }
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-all hover:border-brand-gold hover:text-brand-blue hover:shadow-md disabled:cursor-not-allowed disabled:opacity-30"
                title={
                  previousPromotion
                    ? `Previous promotion: ${previousPromotion.title}`
                    : 'No other promotion available'
                }
                aria-label={
                  previousPromotion
                    ? `Edit previous promotion: ${previousPromotion.title}`
                    : 'No other promotion available'
                }
              >
                <ChevronLeft size={18} />
              </button>

              <div className="min-w-[58px] text-center">
                <div className="text-xs font-bold tabular-nums text-brand-blue/70">
                  {currentPromotionIndex >= 0
                    ? currentPromotionIndex + 1
                    : '—'}
                  <span className="mx-1 text-gray-300">
                    /
                  </span>
                  {editorPromotions.length}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  openAdjacentPromotion(nextPromotion)
                }
                disabled={
                  !canCyclePromotions ||
                  isSubmitting ||
                  isSwitchingPromotion
                }
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-all hover:border-brand-gold hover:text-brand-blue hover:shadow-md disabled:cursor-not-allowed disabled:opacity-30"
                title={
                  nextPromotion
                    ? `Next promotion: ${nextPromotion.title}`
                    : 'No other promotion available'
                }
                aria-label={
                  nextPromotion
                    ? `Edit next promotion: ${nextPromotion.title}`
                    : 'No other promotion available'
                }
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AdminPromotionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#f5f6f8]">
          <Loader2
            className="animate-spin text-brand-blue"
            size={40}
          />
        </div>
      }
    >
      <PromotionsFormManager />
    </Suspense>
  );
}
