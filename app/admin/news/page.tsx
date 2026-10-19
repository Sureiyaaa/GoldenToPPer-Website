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
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  Save,
} from 'lucide-react';

import { createClient } from '@/utils/supabase/client';
import { saveArticleToDB, uploadImage } from '@/app/actions/news';
import { createAuditLogAction } from '@/app/actions/admin_fetchers';
import ImageDropzone from '@/app/components/imagedropzone';
import RichTextEditor from './RichTextEditor';
import PreviewSkeleton, {
  NewsEditorRegion,
} from './PreviewSkeleton';
import { useArticleEditor } from './useArticleEditor';
import { useSectionEditor, cleanupSectionEditor, resetAllSectionEditors, cleanupAllSectionEditors } from './useSectionEditor';
import type { Editor } from '@tiptap/core';
import { SectionEditor } from './SectionEditor';
import { SectionInspector } from './SectionInspector';
import { useSectionImageUploads, type SectionImageDraft } from './useSectionImageUploads';
import { validateNewsImageFile } from '@/lib/validations/news-image-upload';
import { adaptLegacyArticleToSections, isValidSectionsDocument, type ArticleSection, type ArticleSectionsDocument } from '@/app/types/article-sections';
import { parseArticleContent } from '@/lib/rendering/article-content';
import { Plus } from 'lucide-react';

const NewsFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  category: z.string().min(1, 'Category is required'),
  date: z.string().min(1, 'Date is required'),
  slug: z.string().min(1, 'Slug is required'),
  excerpt: z.string().min(1, 'Article content is required'),
  image: z.string().optional(),
  show_cover_on_article: z.boolean(),
  article_content: z.string().nullable().optional(),
  article_layout: z.enum(['image-above', 'title-above', 'image-contained', 'sidebar-image-right', 'sidebar-image-left']).default('image-above'),
  article_sections: z.any().nullable().optional(), // JSONB, validated server-side
});

type NewsFormValues = z.infer<typeof NewsFormSchema>;

type InspectorRegion = Exclude<NewsEditorRegion, 'section-body'>;

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
  show_cover_on_article: true,
  article_content: null,
  article_layout: 'image-above',
  article_sections: null,
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
    useState<NewsEditorRegion>('overview');

  // Body selection keeps its preview/caret target while sharing Section Settings.
  const inspectorRegion: InspectorRegion = selectedRegion === 'section-body' ? 'sections' : selectedRegion;

  const [sections, setSectionsState] = useState<ArticleSectionsDocument | null>(null);
  const sectionsRef = useRef<ArticleSectionsDocument | null>(null);
  const setSections = (next: ArticleSectionsDocument | null) => {
    sectionsRef.current = next;
    setSectionsState(next);
  };
  const sectionImages = useSectionImageUploads();
  const saveRunRef = useRef(0);
  const [uploadingSectionId, setUploadingSectionId] = useState<string | null>(null);
  const [sectionUploadErrors, setSectionUploadErrors] = useState<Record<string, string>>({});
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

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
  const editorsRegistry = useRef<Map<string, Editor>>(new Map());
  const inspectorContentRef = useRef<HTMLFormElement>(null);
  const inspectorHeadingRef = useRef<HTMLHeadingElement>(null);

  const selectInspector = (region: NewsEditorRegion, sectionId?: string) => {
    setSelectedRegion(region);
    if (sectionId !== undefined) setSelectedSectionId(sectionId);
    inspectorContentRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    requestAnimationFrame(() => {
      inspectorContentRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      // Body clicks must retain the preview caret and text selection.
      if (region !== 'section-body') inspectorHeadingRef.current?.focus({ preventScroll: true });
    });
  };

  const {
    register,
    handleSubmit,
    getValues,
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

  const formData = watch();

  const editor = useArticleEditor({
    value: formData.article_content,
    excerpt: formData.excerpt,
    onChange: (value) =>
      setValue('article_content', value, {
        shouldDirty: true,
        shouldValidate: true,
      }),
  });

  // Get current selected section for editor
  const selectedSectionIndex = sections?.sections.findIndex((section) => section.id === selectedSectionId) ?? -1;
  const currentSection = sections?.sections[selectedSectionIndex] || null;
  const sectionIds = sections?.sections.map((section) => section.id) || [];

  const updateSections = (updated: ArticleSectionsDocument) => {
    setSections(updated);
    setValue('article_sections', updated, { shouldDirty: true });
  };

  const stageSectionImage = (id: string, file: File | null) => {
    const document = sectionsRef.current;
    if (!document?.sections.some((section) => section.id === id)) return;
    if (file) sectionImages.stageImage(id, file);
    else sectionImages.clearImage(id);
    setSectionUploadErrors((previous) => ({ ...previous, [id]: '' }));
    setSaveError('');
    updateSections({
      ...document,
      sections: document.sections.map((section) => section.id === id && !file ? { ...section, image: '' } : section),
      updatedAt: new Date().toISOString(),
    });
  };

  const previewSections = useMemo(() => sections ? {
    ...sections,
    sections: sections.sections.map((section) => ({
      ...section, image: sectionImages.drafts[section.id]?.previewUrl ?? section.image,
    })),
  } : null, [sections, sectionImages.drafts]);

  const reorderSections = (sourceId: string, targetId: string) => {
    if (!sections || sourceId === targetId) return;
    const from = sections.sections.findIndex((section) => section.id === sourceId);
    const to = sections.sections.findIndex((section) => section.id === targetId);
    if (from < 0 || to < 0) return;
    const reordered = [...sections.sections];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    updateSections({
      ...sections,
      sections: reordered.map((section, order) => ({ ...section, order })),
      updatedAt: new Date().toISOString(),
    });
  };

  const removeSection = (id: string) => {
    const document = sectionsRef.current;
    if (!document) return;
    const index = document.sections.findIndex((section) => section.id === id);
    if (index < 0) return;
    sectionImages.clearImage(id);
    cleanupSectionEditor(id, editorsRegistry);
    const remaining = document.sections.filter((section) => section.id !== id);
    updateSections({
      ...document,
      sections: remaining.map((section, order) => ({ ...section, order })),
      updatedAt: new Date().toISOString(),
    });
    if (selectedSectionId === id) {
      setSelectedSectionId(remaining[Math.min(index, remaining.length - 1)]?.id || null);
      selectInspector('overview');
    }
  };

  // Section editor for inline editing
  const sectionEditor = useSectionEditor({
    sectionId: currentSection?.id || '',
    content: currentSection?.body || null,
    onChange: (body, sectionId) => {
      // Update section body and mark form dirty
      if (sections) {
        const updatedSections = {
          ...sections,
          sections: sections.sections.map((s) =>
            s.id === sectionId ? { ...s, body } : s
          ),
          updatedAt: new Date().toISOString(),
        };
        setSections(updatedSections);
        setValue('article_sections', updatedSections, {
          shouldDirty: true,
        });
      }
    },
    editorsRegistry,
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
    Object.keys(pendingFiles).length > 0 || Object.keys(sectionImages.drafts).length > 0;

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
    sectionImages.clearAllImages();
    setSectionUploadErrors({});
    setUploadingSectionId(null);
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

          setSelectedRegion('overview');
          reset(EMPTY_FORM);
          setInitialValues(EMPTY_FORM);
          setSections(null);
          setSelectedSectionId(null);
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

        // Load sections if available, else adapt legacy content
        let loadedSections: ArticleSectionsDocument | null = null;
        if (data.article_sections && isValidSectionsDocument(data.article_sections)) {
          loadedSections = data.article_sections;
        } else {
          // Adapt legacy content to sections in-memory (for unified preview)
          loadedSections = adaptLegacyArticleToSections({
            title: data.title || '',
            excerpt: data.excerpt || '',
            article_content: data.article_content || null,
            image: data.image || null,
            article_layout: data.article_layout || 'image-above',
          });
        }

        const values: NewsFormValues = {
          title: data.title || '',
          category: data.category || 'News',
          date: data.date || '',
          slug: data.slug || '',
          excerpt: data.excerpt || '',
          image: data.image || '',
          show_cover_on_article: data.show_cover_on_article !== false,
          article_content: data.article_content
            ? typeof data.article_content === 'string'
              ? data.article_content
              : JSON.stringify(data.article_content)
            : null,
          article_layout: data.article_layout || 'image-above',
          article_sections: data.article_sections || null,
        };

        setSelectedRegion('overview');
        reset(values);
        setInitialValues(values);
        setSections(loadedSections);
        setSelectedSectionId(loadedSections?.sections[0]?.id || null);
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

  useEffect(() => () => { ++saveRunRef.current; }, []);

  // Cleanup editors when article changes or component unmounts
  useEffect(() => {
    return () => {
      cleanupAllSectionEditors(editorsRegistry);
    };
  }, [loadedArticleId, editorsRegistry]);

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
    ++saveRunRef.current;
    sectionImages.clearAllImages();
    setSectionUploadErrors({});
    setUploadingSectionId(null);
    reset(initialValues);
    // Regenerate sections from initial values (or adapted legacy content)
    const resetSections = initialValues.article_sections || (loadedArticleId ? adaptLegacyArticleToSections({
      title: initialValues.title,
      excerpt: initialValues.excerpt,
      article_content: initialValues.article_content ? parseArticleContent(initialValues.article_content) : null,
      image: initialValues.image,
      article_layout: initialValues.article_layout,
    }) : null);

    if (resetSections) {
      // Recreate editors with saved content and fresh history
      resetAllSectionEditors(editorsRegistry, resetSections.sections);
    } else {
      // No sections; just clear editors
      cleanupAllSectionEditors(editorsRegistry);
    }

    setSections(resetSections);
    setSelectedSectionId(resetSections?.sections[0]?.id || null);
    setPendingFiles({});
    setPreviews(
      initialValues.image
        ? { image: initialValues.image }
        : {}
    );
    setSaveError('');
    selectInspector('overview');
  };

  const onSubmit = async (
    data: NewsFormValues
  ) => {
    setSaveError('');
    setSectionUploadErrors({});
    const saveRun = ++saveRunRef.current;
    const loadToken = activeLoadRef.current;
    const isCurrentSave = () => saveRunRef.current === saveRun && activeLoadRef.current === loadToken;
    const uploadedSections = new Map<string, { draft: SectionImageDraft; url: string }>();
    const uploadFile = async (file: File) => {
      const request = new FormData();
      request.append('file', file);
      request.append('fileName', `${crypto.randomUUID()}.${file.name.split('.').pop()?.toLowerCase() || 'png'}`);
      return uploadImage(request);
    };

    try {
      let finalImageUrl = data.image || '';
      if (pendingFiles.image) {
        finalImageUrl = await uploadFile(pendingFiles.image);
        if (!isCurrentSave()) return;
      }

      // Resolve each file by stable ID, never by the selected card or array index.
      for (const [id, draft] of Object.entries(sectionImages.draftsRef.current)) {
        if (!sectionsRef.current?.sections.some((section) => section.id === id)) continue;
        setUploadingSectionId(id);
        try {
          const url = draft.uploadedUrl || await uploadFile(draft.file);
          if (!isCurrentSave()) return;
          if (sectionImages.draftsRef.current[id] === draft && sectionsRef.current?.sections.some((section) => section.id === id)) {
            draft.uploadedUrl = url; // Reuse a successful upload if the database save needs retrying.
            uploadedSections.set(id, { draft, url });
          }
        } catch (error: unknown) {
          if (!isCurrentSave()) return;
          if (!sectionsRef.current?.sections.some((section) => section.id === id) || sectionImages.draftsRef.current[id] !== draft) continue;
          const message = error instanceof Error ? error.message : 'Failed to upload section image.';
          setSectionUploadErrors((previous) => ({ ...previous, [id]: message }));
          selectInspector('section-image', id);
          throw new Error(message);
        }
      }
      if (!isCurrentSave()) return;
      setUploadingSectionId(null);
      const documentToSave = sectionsRef.current;
      if (Object.entries(sectionImages.draftsRef.current).some(([id, draft]) =>
        documentToSave?.sections.some((section) => section.id === id) && uploadedSections.get(id)?.draft !== draft
      )) throw new Error('Section images changed while saving. Save Changes again to upload the latest images.');

      const savedSections = documentToSave ? {
        ...documentToSave,
        sections: documentToSave.sections.map((section) => {
          const uploaded = uploadedSections.get(section.id);
          return uploaded && sectionImages.draftsRef.current[section.id] === uploaded.draft
            ? { ...section, image: uploaded.url } : section;
        }),
      } : null;
      const payloadToSave = { ...getValues(), image: finalImageUrl, article_sections: savedSections };
      const saveResult = await saveArticleToDB(payloadToSave, editId) as any;
      if (!isCurrentSave()) return;

      await createAuditLogAction(
        editId ? 'EDIT' : 'CREATE',
        'News & Updates',
        payloadToSave.title,
        editId
          ? 'Updated existing article content or image.'
          : `Created new article in category: ${payloadToSave.category}`
      );

      if (!isCurrentSave()) return;
      // Keep any changes made while the database request was in flight staged.
      const latestValues = getValues();
      const latestDocument = sectionsRef.current;
      const mergedSections = latestDocument === documentToSave ? savedSections : latestDocument ? {
        ...latestDocument,
        sections: latestDocument.sections.map((section) => {
          const uploaded = uploadedSections.get(section.id);
          const original = documentToSave?.sections.find((item) => item.id === section.id);
          return uploaded && sectionImages.draftsRef.current[section.id] === uploaded.draft && section.image === original?.image
            ? { ...section, image: uploaded.url } : section;
        }),
      } : null;
      const savedValues: NewsFormValues = payloadToSave;
      reset(savedValues);
      setInitialValues(savedValues);
      setSections(mergedSections);
      if (mergedSections !== savedSections) setValue('article_sections', mergedSections, { shouldDirty: true });
      for (const field of ['title', 'category', 'date', 'slug', 'excerpt', 'article_content', 'article_layout', 'show_cover_on_article'] as const) {
        if (latestValues[field] !== payloadToSave[field]) setValue(field, latestValues[field], { shouldDirty: true });
      }
      uploadedSections.forEach(({ draft }, id) => sectionImages.clearImage(id, draft));
      setSectionUploadErrors({});
      setPendingFiles({});
      setPreviews(finalImageUrl ? { image: finalImageUrl } : {});
      selectInspector('overview');

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
            .eq('slug', payloadToSave.slug)
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
      if (!isCurrentSave()) return;
      setSaveError(
        error?.message ||
          'Failed to save article.'
      );
    } finally {
      if (isCurrentSave()) setUploadingSectionId(null);
    }
  };

  const hasErrors =
    Object.keys(errors).length > 0;

  const showFirstInvalidField = (invalidFields: typeof errors) => {
    const firstField = Object.keys(invalidFields)[0];
    if (firstField === 'title' || firstField === 'date') selectInspector('header');
    else if (firstField === 'category') selectInspector('overview');
    else if (firstField === 'slug') selectInspector('slug');
    else if (firstField === 'excerpt' || firstField === 'article_content') selectInspector(currentSection ? 'section-body' : 'excerpt');
    else if (firstField === 'image') selectInspector('image');
    else selectInspector('header');
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
    article_content:
      formData.article_content || null,
    image:
      previews.image ||
      formData.image ||
      '',
    article_layout: formData.article_layout || 'image-above',
    show_cover_on_article: formData.show_cover_on_article,
    article_sections: previewSections,
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
    overview: {
      eyebrow: 'Page Settings',
      title: 'Article Settings',
      description: 'Edit the article details and sections. Select content in the preview for more controls.',
    },
    'section-image': {
      eyebrow: 'Selected Content', title: 'Section Image',
      description: 'Edit this section image independently of the article cover.',
    },
    'section-heading': {
      eyebrow: 'Selected Content', title: 'Section Heading',
      description: 'Edit the heading for this section.',
    },
    header: {
      eyebrow: 'Selected Content',
      title: 'Article Header',
      description: 'Edit the article title and publication date.',
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
    sections: {
      eyebrow: 'Article Sections',
      title: 'Section Settings',
      description: 'Edit section text, heading, and image.',
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
                onSelectRegion={selectInspector}
                selectedSectionId={selectedSectionId}
                sectionEditor={sectionEditor}
                onSelectSection={(id, target) => selectInspector(`section-${target}`, id)}
              />

              <p className="mt-5 text-[9px] font-bold uppercase tracking-[0.18em] text-gray-400">
                Click on the article body to edit. Use the toolbar for formatting.
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

        <aside className="flex min-h-0 flex-col border-l border-gray-200 bg-white">
          <div className="shrink-0 border-b border-gray-100 px-6 py-5">
            {selectedRegion !== 'overview' && (
              <button type="button" onClick={() => selectInspector('overview')} className="mb-4 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-brand-blue">
                <ArrowLeft size={13} /> Back to overview
              </button>
            )}
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">
              {
                inspectorMeta[
                  inspectorRegion
                ].eyebrow
              }
            </p>

            <h2 ref={inspectorHeadingRef} tabIndex={-1} className="mt-2 text-xl font-serif text-brand-blue outline-none">
              {
                inspectorMeta[
                  inspectorRegion
                ].title
              }
            </h2>

            <p className="mt-2 text-xs leading-relaxed text-gray-400">
              {
                inspectorMeta[
                  inspectorRegion
                ].description
              }
            </p>
          </div>

          <form
            ref={inspectorContentRef}
            onSubmit={handleSubmit(onSubmit, showFirstInvalidField)}
            className="min-h-0 flex-1 overflow-y-auto p-6 custom-scrollbar"
          >
            <div data-news-panel={inspectorRegion} className="space-y-6">
              {(selectedRegion === 'overview' || selectedRegion === 'header') && (
                <div>
                  <label htmlFor="news-title" className={labelStyles}>Article Title</label>
                  <input id="news-title" {...register('title')} className={inputStyles} placeholder="Enter article title" />
                  {errors.title && <p className="mt-2 text-[10px] font-bold text-red-500">{errors.title.message}</p>}
                </div>
              )}

              {selectedRegion === 'header' && (
                <div>
                  <label htmlFor="news-date" className={labelStyles}>Publication Date</label>
                  <input id="news-date" type="date" {...register('date')} className={inputStyles} />
                  {errors.date && <p className="mt-2 text-[10px] font-bold text-red-500">{errors.date.message}</p>}
                </div>
              )}

              {(selectedRegion === 'overview') && (
                <div>
                  <label htmlFor="news-category" className={labelStyles}>Category</label>
                  <div className="relative">
                    <select id="news-category" {...register('category')} className={inputStyles + ' cursor-pointer appearance-none pr-10'}>
                      <option value="News">News</option>
                      <option value="Updates">Update</option>
                    </select>
                    <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                  {errors.category && <p className="mt-2 text-[10px] font-bold text-red-500">{errors.category.message}</p>}
                </div>
              )}

              {(selectedRegion === 'overview' || selectedRegion === 'slug') && (
                <div>
                  <label htmlFor="news-slug" className={labelStyles}>URL Slug</label>
                  <input id="news-slug" {...register('slug')} className={inputStyles} placeholder="e.g. golden-topper-wins-award" />
                  <p className="mt-3 text-[10px] leading-relaxed text-gray-400">
                    Use a concise, lowercase, hyphen-separated URL identifier. Changing it may affect existing links.
                  </p>
                  {errors.slug && <p className="mt-2 text-[10px] font-bold text-red-500">{errors.slug.message}</p>}
                </div>
              )}

              {(selectedRegion === 'overview') && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-brand-blue">Sections ({sectionIds.length})</h3>
                    <button
                      type="button"
                      disabled={isSubmitting || isSwitchingArticle}
                      onClick={() => {
                        const now = new Date().toISOString();
                        const document: ArticleSectionsDocument = sections || { version: 1, sections: [], createdAt: now, updatedAt: now };
                        const newSection: ArticleSection = {
                          id: crypto.randomUUID(),
                          headingEnabled: true,
                          layout: 'image-above',
                          body: { type: 'doc', content: [] },
                          order: document.sections.length,
                        };
                        updateSections({ ...document, sections: [...document.sections, newSection], updatedAt: now });
                        selectInspector('sections', newSection.id);
                      }}
                      className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase text-brand-gold transition-colors hover:text-brand-blue disabled:opacity-40"
                    >
                      <Plus size={14} /> Add Section
                    </button>
                  </div>
                  <p id="news-section-drag-instructions" className="sr-only">
                    Drag a section by its handle to reorder. On the keyboard, press Space or Enter to pick up,
                    use Up and Down arrows, Home or End to choose a position, then Space or Enter to drop. Escape cancels.
                  </p>
                  <ul aria-label="Article sections" className="space-y-3">
                    {sections?.sections.map((section, index) => (
                      <SectionEditor
                        key={section.id}
                        section={previewSections?.sections[index] || section}
                        sectionIds={sectionIds}
                        index={index}
                        disabled={isSubmitting || isSwitchingArticle}
                        isSelected={selectedSectionId === section.id}
                        onSelect={() => selectInspector('sections', section.id)}
                        onReorder={reorderSections}
                        onRemove={() => removeSection(section.id)}
                      />
                    ))}
                  </ul>
                  {!sectionIds.length && <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-[10px] text-gray-400">Add a section to start writing.</p>}
                </div>
              )}

              <div className="space-y-6">
                {selectedRegion === 'excerpt' && (
                  <div className="space-y-4">
                    <label className={labelStyles}>Formatting</label>
                    <RichTextEditor editor={editor} />
                    <p className="text-[10px] leading-relaxed text-gray-400">Click in the article text on the left to edit. Select text and use the formatting buttons or Ctrl+B and Ctrl+I.</p>
                    {errors.article_content && <p className="text-[10px] font-bold text-red-500">{errors.article_content.message}</p>}
                    {errors.excerpt && <p className="text-[10px] font-bold text-red-500">{errors.excerpt.message}</p>}
                  </div>
                )}

                {['sections', 'section-heading', 'section-image'].includes(inspectorRegion) && currentSection && (
                  <div className="space-y-4">
                    <SectionInspector
                      section={currentSection}
                      formattingControl={
                        <>
                          <RichTextEditor editor={null} sectionEditor={sectionEditor} isEditingSection />
                          {errors.article_content && <p className="mt-2 text-[10px] font-bold text-red-500">{errors.article_content.message}</p>}
                          {errors.excerpt && <p className="mt-2 text-[10px] font-bold text-red-500">{errors.excerpt.message}</p>}
                        </>
                      }
                      hasImage={Boolean(currentSection.image || sectionImages.drafts[currentSection.id])}
                      imageControl={
                        <ImageDropzone
                          key={currentSection.id}
                          fieldPath={`section-image-${currentSection.id}`}
                          label="Section Image"
                          allowReplacement
                          height="h-52"
                          value={currentSection.image || ''}
                          previews={{ [`section-image-${currentSection.id}`]: sectionImages.drafts[currentSection.id]?.previewUrl || '' }}
                          errors={{ [`section-image-${currentSection.id}`]: sectionUploadErrors[currentSection.id] ? { message: sectionUploadErrors[currentSection.id] } : undefined }}
                          validateFile={validateNewsImageFile}
                          disabled={isSubmitting || isSwitchingArticle}
                          isUploading={uploadingSectionId === currentSection.id}
                          onFileSelect={(file) => stageSectionImage(currentSection.id, file)}
                          onImageRemove={() => stageSectionImage(currentSection.id, null)}
                        />
                      }
                      mode={selectedRegion === 'section-heading' ? 'heading' : selectedRegion === 'section-image' ? 'image' : 'settings'}
                      inputClassName={inputStyles}
                      labelClassName={labelStyles}
                      onUpdate={(updates) => {
                        if (!sections) return;
                        updateSections({
                          ...sections,
                          sections: sections.sections.map((section) => section.id === currentSection.id ? { ...section, ...updates } : section),
                          updatedAt: new Date().toISOString(),
                        });
                      }}
                    />
                  </div>
                )}

                {selectedRegion === 'image' && (
                  <div className="space-y-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData.show_cover_on_article}
                      aria-labelledby="news-cover-visibility-label"
                      aria-describedby="news-cover-visibility-description"
                      disabled={isSubmitting || isSwitchingArticle}
                      onClick={() => setValue('show_cover_on_article', !formData.show_cover_on_article, { shouldDirty: true, shouldValidate: true })}
                      className={`flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand-gold disabled:opacity-40 ${formData.show_cover_on_article ? 'border-brand-gold/50 bg-brand-gold/10' : 'border-gray-200 bg-white'}`}
                    >
                      <span>
                        <span id="news-cover-visibility-label" className="block text-[10px] font-bold uppercase tracking-wider text-brand-blue">Show cover on article page</span>
                        <span id="news-cover-visibility-description" className="mt-0.5 block text-[9px] text-gray-400">The featured image stays available for news cards and sharing.</span>
                      </span>
                      <span aria-hidden="true" className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${formData.show_cover_on_article ? 'bg-brand-gold' : 'bg-gray-300'}`}>
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${formData.show_cover_on_article ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                      </span>
                    </button>
                    <ImageDropzone disabled={isSubmitting || isSwitchingArticle} fieldPath="image" label="Featured Image" allowReplacement height="h-48" watch={watch} setValue={setValue} errors={errors} setPendingFiles={setPendingFiles} setPreviews={setPreviews} previews={previews} />
                    <p className="text-[10px] leading-relaxed text-gray-400">Use a landscape image with a clear focal point for the article cover.</p>
                  </div>
                )}

              </div>
            </div>

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

            {selectedRegion === 'overview' && (
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
            )}
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
