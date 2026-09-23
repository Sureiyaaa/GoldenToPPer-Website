'use client';

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  RotateCcw,
  Save,
  Tag,
  Type,
} from 'lucide-react';

import { createClient } from '@/utils/supabase/client';
import { saveArticleToDB, uploadImage } from '@/app/actions/news';
import { createAuditLogAction } from '@/app/actions/admin_fetchers';
import ImageDropzone from '@/app/components/imagedropzone';
import PreviewSkeleton, {
  NewsEditorRegion,
} from './PreviewSkeleton';

const NewsFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  category: z.string().min(1, 'Category is required'),
  date: z.string().min(1, 'Date is required'),
  slug: z.string().min(1, 'Slug is required'),
  excerpt: z.string().min(1, 'Article content is required'),
  image: z.string().optional(),
});

type NewsFormValues = z.infer<typeof NewsFormSchema>;

type InspectorRegion =
  | NewsEditorRegion
  | 'slug';

type EditorArticle = {
  id: string;
  title: string;
};

const EMPTY_FORM: NewsFormValues = {
  title: '',
  category: 'News',
  date: new Date().toISOString().split('T')[0],
  slug: '',
  excerpt: '',
  image: '',
};

function NewsManager() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get('edit');
  const supabase = useMemo(() => createClient(), []);

  const [isFetching, setIsFetching] = useState(true);
  const [isSwitchingArticle, setIsSwitchingArticle] =
    useState(false);
  const [loadedArticleId, setLoadedArticleId] =
    useState<string | null>(null);

  const [successMsg, setSuccessMsg] = useState('');
  const [saveError, setSaveError] = useState('');

  const [pendingFiles, setPendingFiles] = useState<
    Record<string, File>
  >({});
  const [previews, setPreviews] = useState<
    Record<string, string>
  >({});
  const previewsRef = useRef<Record<string, string>>({});

  const [initialValues, setInitialValues] =
    useState<NewsFormValues>(EMPTY_FORM);

  const [selectedRegion, setSelectedRegion] =
    useState<InspectorRegion>('title');

  const [editorArticles, setEditorArticles] = useState<
    EditorArticle[]
  >([]);

  const [showLeaveWarning, setShowLeaveWarning] =
    useState(false);
  const [pendingNavigation, setPendingNavigation] =
    useState<{
      url: string;
      mode: 'push' | 'replace';
    } | null>(null);

  const hasLoadedEditorRef = useRef(false);
  const activeLoadRef = useRef(0);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: {
      errors,
      isSubmitting,
      isDirty,
    },
  } = useForm<NewsFormValues>({
    resolver: zodResolver(NewsFormSchema),
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  useEffect(() => {
    return () => {
      Object.values(previewsRef.current).forEach((url) => {
        if (
          typeof url === 'string' &&
          url.startsWith('blob:')
        ) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []);

  const hasPendingFiles =
    Object.keys(pendingFiles).length > 0;

  const hasUnsavedChanges =
    isDirty || hasPendingFiles;

  const loadArticleNavigation = async () => {
    const { data, error } = await supabase
      .from('news_updates')
      .select('id, title')
      .is('is_archived', null)
      .order('date', { ascending: false });

    if (error) throw error;

    setEditorArticles(
      (data || []).map((article: any) => ({
        id: String(article.id),
        title: article.title || 'Untitled Article',
      }))
    );
  };

  useEffect(() => {
    loadArticleNavigation().catch((error) => {
      console.error(
        'Failed to load News & Updates navigation:',
        error
      );
    });
  }, [editId]);

  useEffect(() => {
    let cancelled = false;
    const loadToken = ++activeLoadRef.current;
    const isInitialLoad =
      !hasLoadedEditorRef.current;

    const fetchSingleArticle = async () => {
      if (isInitialLoad) {
        setIsFetching(true);
      } else {
        setIsSwitchingArticle(true);
      }

      setSaveError('');

      try {
        if (!editId) {
          if (
            cancelled ||
            loadToken !== activeLoadRef.current
          ) {
            return;
          }

          reset(EMPTY_FORM);
          setInitialValues(EMPTY_FORM);
          setPreviews({});
          setPendingFiles({});
          setLoadedArticleId(null);
          return;
        }

        const { data, error } = await supabase
          .from('news_updates')
          .select('*')
          .eq('id', editId)
          .single();

        if (error) throw error;
        if (!data) throw new Error('Article not found');

        if (
          cancelled ||
          loadToken !== activeLoadRef.current
        ) {
          return;
        }

        const values: NewsFormValues = {
          title: data.title || '',
          category: data.category || 'News',
          date: data.date || '',
          slug: data.slug || '',
          excerpt: data.excerpt || '',
          image: data.image || '',
        };

        reset(values);
        setInitialValues(values);
        setPendingFiles({});
        setPreviews(
          data.image
            ? { image: data.image }
            : {}
        );
        setLoadedArticleId(String(data.id));
      } catch (error: any) {
        if (
          cancelled ||
          loadToken !== activeLoadRef.current
        ) {
          return;
        }

        console.error(
          'Error fetching article:',
          error
        );
        setSaveError(
          error?.message ||
            'Failed to load article.'
        );
      } finally {
        if (
          !cancelled &&
          loadToken === activeLoadRef.current
        ) {
          hasLoadedEditorRef.current = true;
          setIsFetching(false);
          setIsSwitchingArticle(false);
        }
      }
    };

    fetchSingleArticle();

    return () => {
      cancelled = true;
    };
  }, [editId, reset, supabase]);

  useEffect(() => {
    const handleBeforeUnload = (
      event: BeforeUnloadEvent
    ) => {
      if (!hasUnsavedChanges) return;

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener(
      'beforeunload',
      handleBeforeUnload
    );

    return () =>
      window.removeEventListener(
        'beforeunload',
        handleBeforeUnload
      );
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
    requestNavigation(
      '/admin/dashboard?section=News%20%26%20Updates'
    );
  };

  const handleReset = () => {
    reset(initialValues);
    setPendingFiles({});
    setPreviews(
      initialValues.image
        ? { image: initialValues.image }
        : {}
    );
    setSaveError('');
  };

  const onSubmit = async (
    data: NewsFormValues
  ) => {
    setSaveError('');

    try {
      let finalImageUrl = data.image || '';

      if (pendingFiles.image) {
        const fileExt =
          pendingFiles.image.name
            .split('.')
            .pop() || 'png';

        const formData = new FormData();
        formData.append(
          'file',
          pendingFiles.image
        );
        formData.append(
          'fileName',
          `${Date.now()}-${Math.random()
            .toString(36)
            .substring(2)}.${fileExt}`
        );

        finalImageUrl =
          await uploadImage(formData);
      }

      const saveResult = (await saveArticleToDB(
        {
          ...data,
          image: finalImageUrl,
        },
        editId
      )) as any;

      await createAuditLogAction(
        editId ? 'EDIT' : 'CREATE',
        'News & Updates',
        data.title,
        editId
          ? 'Updated existing article content or image.'
          : `Created new article in category: ${data.category}`
      );

      const savedValues: NewsFormValues = {
        ...data,
        image: finalImageUrl,
      };

      reset(savedValues);
      setInitialValues(savedValues);
      setPendingFiles({});
      setPreviews(
        finalImageUrl
          ? { image: finalImageUrl }
          : {}
      );

      setSuccessMsg(
        editId
          ? 'Article updated.'
          : 'Article created.'
      );
      window.setTimeout(
        () => setSuccessMsg(''),
        2500
      );

      if (!editId) {
        let createdId =
          saveResult?.id != null
            ? String(saveResult.id)
            : '';

        if (!createdId) {
          const {
            data: createdRows,
            error: lookupError,
          } = await supabase
            .from('news_updates')
            .select('id')
            .eq('slug', data.slug)
            .is('is_archived', null)
            .limit(1);

          if (lookupError) {
            console.error(
              'Could not resolve created article ID:',
              lookupError
            );
          }

          if (createdRows?.[0]?.id != null) {
            createdId = String(
              createdRows[0].id
            );
          }
        }

        await loadArticleNavigation();

        if (createdId) {
          router.replace(
            `/admin/news?edit=${createdId}`
          );
        } else {
          setSaveError(
            'The article was saved, but the editor could not resolve its new record ID. Return to News & Updates and reopen it from the list.'
          );
        }
      } else {
        await loadArticleNavigation();
      }
    } catch (error: any) {
      setSaveError(
        error?.message ||
          'Failed to save article.'
      );
    }
  };

  const formData = watch();
  const hasErrors =
    Object.keys(errors).length > 0;

  const showFirstInvalidField = (invalidFields: typeof errors) => {
    const firstField = Object.keys(invalidFields)[0];
    if (firstField === 'category' || firstField === 'date') {
      setSelectedRegion('meta');
    } else if (firstField === 'slug') {
      setSelectedRegion('slug');
    } else if (firstField === 'excerpt' || firstField === 'image') {
      setSelectedRegion(firstField);
    } else {
      setSelectedRegion('title');
    }
  };

  const currentArticleIndex =
    loadedArticleId
      ? editorArticles.findIndex(
          (article) =>
            article.id === loadedArticleId
        )
      : -1;

  const canCycleArticles =
    currentArticleIndex >= 0 &&
    editorArticles.length > 1;

  const previousArticle =
    canCycleArticles
      ? editorArticles[
          (currentArticleIndex -
            1 +
            editorArticles.length) %
            editorArticles.length
        ]
      : null;

  const nextArticle =
    canCycleArticles
      ? editorArticles[
          (currentArticleIndex + 1) %
            editorArticles.length
        ]
      : null;

  const openAdjacentArticle = (
    article: EditorArticle | null
  ) => {
    if (!article) return;

    requestNavigation(
      `/admin/news?edit=${article.id}`,
      'replace'
    );
  };

  const previewData = {
    title:
      formData.title ||
      'Your Article Title Will Appear Here',
    category:
      formData.category || 'News',
    date:
      formData.date || 'YYYY-MM-DD',
    excerpt:
      formData.excerpt ||
      'Write your article content to see it rendered here.',
    image:
      previews.image ||
      formData.image ||
      '',
  };

  const inputStyles =
    'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-brand-blue outline-none transition-all placeholder:text-gray-300 focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10';

  const labelStyles =
    'mb-2 block text-[10px] font-bold uppercase tracking-widest text-brand-blue/70';

  const inspectorMeta: Record<
    InspectorRegion,
    {
      eyebrow: string;
      title: string;
      description: string;
    }
  > = {
    title: {
      eyebrow: 'Selected Content',
      title: 'Article Title',
      description:
        'Edit the main headline shown on the article.',
    },
    meta: {
      eyebrow: 'Selected Content',
      title: 'Article Details',
      description:
        'The date appears on the article and news listing. The category appears on the listing.',
    },
    slug: {
      eyebrow: 'Page Settings',
      title: 'Article URL',
      description:
        'Set the URL slug used to identify this article.',
    },
    excerpt: {
      eyebrow: 'Selected Content',
      title: 'Article Content',
      description:
        'Edit the article description or update shown below the headline.',
    },
    image: {
      eyebrow: 'Selected Content',
      title: 'Featured Image',
      description:
        'Upload or replace the cover image shown with this article.',
    },
  };

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
      aria-busy={isSwitchingArticle}
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
              You have edits that have not been
              saved yet. Leaving or switching
              articles now will discard them.
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
                  const target =
                    pendingNavigation;

                  setShowLeaveWarning(false);
                  setPendingNavigation(null);

                  if (!target) {
                    router.push(
                      '/admin/dashboard?section=News%20%26%20Updates'
                    );
                    return;
                  }

                  if (
                    target.mode === 'replace'
                  ) {
                    router.replace(
                      target.url
                    );
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

      <header className="z-40 flex h-[68px] shrink-0 items-center justify-between gap-6 border-b border-gray-200 bg-white px-6 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={goBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition-colors hover:border-brand-blue hover:text-brand-blue"
            aria-label="Back to News & Updates"
            title="Back to News & Updates"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">
              <span>News & Updates</span>
              <span className="text-gray-300">
                /
              </span>
              <span className="truncate text-gray-400">
                {editId
                  ? previewData.title
                  : 'New Article'}
              </span>
            </div>

            <div className="mt-0.5 flex items-center gap-3">
              <h1 className="truncate text-2xl font-serif text-brand-blue">
                {editId
                  ? 'Edit Article'
                  : 'Add Article'}
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
              isSwitchingArticle
            }
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 transition-colors hover:border-brand-blue hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw size={14} />
            Reset
          </button>

          <button
            type="button"
            onClick={handleSubmit(onSubmit, showFirstInvalidField)}
            disabled={
              !hasUnsavedChanges ||
              isSubmitting ||
              isSwitchingArticle
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

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="relative min-h-0 bg-[#eef1f5]">
          <div className="absolute left-6 top-5 z-30 lg:left-10 lg:top-7">
            <span className="inline-flex rounded-full border border-brand-gold/30 bg-white/90 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-brand-gold shadow-sm backdrop-blur-md">
              Live Preview
            </span>
          </div>

          <div className="h-full overflow-y-auto p-6 pt-16 pb-24 custom-scrollbar lg:p-10 lg:pt-20 lg:pb-28">
            <div className="mx-auto flex min-h-full w-full flex-col items-center justify-center">
              <PreviewSkeleton
                data={previewData}
                selectedRegion={selectedRegion}
                onSelectRegion={setSelectedRegion}
              />

              <p className="mt-5 text-[9px] font-bold uppercase tracking-[0.18em] text-gray-400">
                Select article content in the preview to edit it
              </p>
            </div>
          </div>

          {editId && editorArticles.length > 0 && (
            <nav aria-label="Article navigation" className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-5 bg-gradient-to-t from-[#eef1f5] via-[#eef1f5]/95 to-transparent px-6 pb-5 pt-8 lg:pb-7">
                  <button
                    type="button"
                    onClick={() =>
                      openAdjacentArticle(
                        previousArticle
                      )
                    }
                    disabled={
                      !canCycleArticles ||
                      isSubmitting ||
                      isSwitchingArticle
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-all hover:border-brand-gold hover:text-brand-blue hover:shadow-md disabled:cursor-not-allowed disabled:opacity-30"
                    title={
                      previousArticle
                        ? `Previous article: ${previousArticle.title}`
                        : 'No other article available'
                    }
                    aria-label={
                      previousArticle
                        ? `Edit previous article: ${previousArticle.title}`
                        : 'No other article available'
                    }
                  >
                    <ChevronLeft
                      size={18}
                    />
                  </button>

                  <div className="min-w-[58px] text-center">
                    <div className="text-xs font-bold tabular-nums text-brand-blue/70">
                      {currentArticleIndex >=
                      0
                        ? currentArticleIndex +
                          1
                        : '—'}
                      <span className="mx-1 text-gray-300">
                        /
                      </span>
                      {
                        editorArticles.length
                      }
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      openAdjacentArticle(
                        nextArticle
                      )
                    }
                    disabled={
                      !canCycleArticles ||
                      isSubmitting ||
                      isSwitchingArticle
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-all hover:border-brand-gold hover:text-brand-blue hover:shadow-md disabled:cursor-not-allowed disabled:opacity-30"
                    title={
                      nextArticle
                        ? `Next article: ${nextArticle.title}`
                        : 'No other article available'
                    }
                    aria-label={
                      nextArticle
                        ? `Edit next article: ${nextArticle.title}`
                        : 'No other article available'
                    }
                  >
                    <ChevronRight
                      size={18}
                    />
                  </button>
            </nav>
          )}
        </section>

        <aside className="min-h-0 overflow-y-auto border-l border-gray-200 bg-white custom-scrollbar">
          <div className="border-b border-gray-100 px-6 py-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">
              {
                inspectorMeta[
                  selectedRegion
                ].eyebrow
              }
            </p>

            <h2 className="mt-2 text-2xl font-serif text-brand-blue">
              {
                inspectorMeta[
                  selectedRegion
                ].title
              }
            </h2>

            <p className="mt-2 text-xs leading-relaxed text-gray-400">
              {
                inspectorMeta[
                  selectedRegion
                ].description
              }
            </p>
          </div>

          <div className="grid grid-cols-5 border-b border-gray-100 bg-gray-50/50 px-3 py-3">
            {(
              [
                [
                  'title',
                  Type,
                  'Title',
                ],
                [
                  'meta',
                  CalendarDays,
                  'Details',
                ],
                [
                  'slug',
                  Link2,
                  'URL',
                ],
                [
                  'excerpt',
                  FileText,
                  'Content',
                ],
                [
                  'image',
                  ImageIcon,
                  'Image',
                ],
              ] as const
            ).map(
              ([
                region,
                Icon,
                label,
              ]) => (
                <button
                  key={region}
                  type="button"
                  onClick={() =>
                    setSelectedRegion(
                      region
                    )
                  }
                  className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[8px] font-bold uppercase tracking-wider transition-colors ${
                    selectedRegion ===
                    region
                      ? 'bg-white text-brand-blue shadow-sm ring-1 ring-gray-200'
                      : 'text-gray-400 hover:text-brand-blue'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              )
            )}
          </div>

          <form
            onSubmit={handleSubmit(onSubmit, showFirstInvalidField)}
            className="p-6"
          >
            {selectedRegion ===
              'title' && (
              <div>
                <label
                  className={
                    labelStyles
                  }
                >
                  Article Title
                </label>

                <input
                  {...register('title')}
                  className={
                    inputStyles
                  }
                  placeholder="Enter article title"
                />

                {errors.title && (
                  <p className="mt-2 text-[10px] font-bold text-red-500">
                    {
                      errors.title
                        .message
                    }
                  </p>
                )}
              </div>
            )}

            {selectedRegion ===
              'meta' && (
              <div className="space-y-5">
                <div>
                  <label
                    className={
                      labelStyles
                    }
                  >
                    Category
                  </label>

                  <div className="relative">
                    <select
                      {...register(
                        'category'
                      )}
                      className={`${inputStyles} cursor-pointer appearance-none pr-10`}
                    >
                      <option value="News">
                        News
                      </option>
                      <option value="Updates">
                        Updates
                      </option>
                    </select>

                    <ChevronDown
                      size={16}
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                  </div>

                  {errors.category && (
                    <p className="mt-2 text-[10px] font-bold text-red-500">
                      {
                        errors.category
                          .message
                      }
                    </p>
                  )}
                </div>

                <div>
                  <label
                    className={
                      labelStyles
                    }
                  >
                    Publication Date
                  </label>

                  <input
                    type="date"
                    {...register('date')}
                    className={
                      inputStyles
                    }
                  />

                  {errors.date && (
                    <p className="mt-2 text-[10px] font-bold text-red-500">
                      {
                        errors.date
                          .message
                      }
                    </p>
                  )}
                </div>
              </div>
            )}

            {selectedRegion ===
              'slug' && (
              <div>
                <label
                  className={
                    labelStyles
                  }
                >
                  Slug URL
                </label>

                <input
                  {...register('slug')}
                  className={
                    inputStyles
                  }
                  placeholder="e.g. golden-topper-wins-award"
                />

                <p className="mt-3 text-[10px] leading-relaxed text-gray-400">
                  Use a concise,
                  lowercase,
                  hyphen-separated URL
                  identifier. Changing it
                  may affect existing
                  links.
                </p>

                {errors.slug && (
                  <p className="mt-2 text-[10px] font-bold text-red-500">
                    {
                      errors.slug
                        .message
                    }
                  </p>
                )}
              </div>
            )}

            {selectedRegion ===
              'excerpt' && (
              <div>
                <label
                  className={
                    labelStyles
                  }
                >
                  Article Content
                </label>

                <textarea
                  {...register(
                    'excerpt'
                  )}
                  rows={12}
                  className={`${inputStyles} resize-none leading-relaxed`}
                  placeholder="Write the article content or update..."
                />

                {errors.excerpt && (
                  <p className="mt-2 text-[10px] font-bold text-red-500">
                    {
                      errors.excerpt
                        .message
                    }
                  </p>
                )}
              </div>
            )}

            {selectedRegion ===
              'image' && (
              <div>
                <ImageDropzone
                  fieldPath="image"
                  label="Featured Image"
                  height="h-48"
                  watch={watch}
                  setValue={setValue}
                  errors={errors}
                  setPendingFiles={
                    setPendingFiles
                  }
                  setPreviews={
                    setPreviews
                  }
                  previews={previews}
                />

                <p className="mt-3 text-[10px] leading-relaxed text-gray-400">
                  Use a landscape image
                  with a clear focal point
                  so it works well as the
                  article cover.
                </p>
              </div>
            )}

            {hasErrors && (
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-medium text-red-600">
                <AlertCircle
                  size={16}
                  className="mt-0.5 shrink-0"
                />
                <span>
                  Please complete all
                  required article fields
                  before saving.
                </span>
              </div>
            )}

            {saveError && (
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-medium text-red-600">
                <AlertCircle
                  size={16}
                  className="mt-0.5 shrink-0"
                />
                <span>
                  {saveError}
                </span>
              </div>
            )}

            <div className="mt-6 rounded-xl border border-brand-blue/10 bg-brand-blue/[0.03] p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-blue/60">
                Editor behavior
              </p>

              <p className="mt-1 text-[10px] leading-relaxed text-gray-500">
                Changes stay staged
                until Save Changes is
                pressed. Website
                visibility is managed
                from the News & Updates
                list.
              </p>
            </div>
          </form>
        </aside>
      </main>
    </div>
  );
}

export default function AdminNewsDashboard() {
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
      <NewsManager />
    </Suspense>
  );
}
