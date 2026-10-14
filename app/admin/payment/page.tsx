'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, RotateCcw, Save, Plus, Trash2, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';
import { getRBACProfile } from '@/app/actions/auth';
import { fetchAdminProjectsList } from '@/app/actions/projects';
import {
  fetchCarouselSlidesForAdminAction,
  PaymentCarouselSlide,
  createPaymentCarouselSlideAction,
  updatePaymentCarouselSlideAction,
  deletePaymentCarouselSlideAction,
  reorderPaymentCarouselSlidesAction,
  preparePaymentCarouselUploadAction,
  finalizePaymentCarouselUploadAction,
} from '@/app/actions/payment-carousel';
import { createClient } from '@/utils/supabase/client';
import PaymentCarouselPreview from './PaymentCarouselPreview';
import FocalPointEditor from './FocalPointEditor';

type CarouselContext = 'showcase' | `project-${number}`;

interface DraftSlide extends Partial<PaymentCarouselSlide> {
  _isNew?: boolean;
  _isDeleted?: boolean;
  _pendingFile?: File;
  _pendingPreview?: string;
  _pendingStoragePath?: string;
  _isDirty?: boolean;
  _tempId?: number;
}

export default function AdminPaymentEditor() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [rbacProfile, setRbacProfile] = useState<any>(null);
  const [unauthorizedMessage, setUnauthorizedMessage] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Projects list
  const [projects, setProjects] = useState<any[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  // Carousel context selection
  const [context, setContext] = useState<CarouselContext>('showcase');
  const pendingContextRef = useRef<CarouselContext | null>(null);

  // Carousel slides (persisted state)
  const [slides, setSlides] = useState<PaymentCarouselSlide[]>([]);
  const [slidesLoading, setSlidesLoading] = useState<boolean>(false);
  const [slidesError, setSlidesError] = useState('');
  const [migrationMissing, setMigrationMissing] = useState(false);

  // Draft state (local edits)
  const [draftSlides, setDraftSlides] = useState<DraftSlide[]>([]);
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [pendingPreviews, setPendingPreviews] = useState<Record<string, string>>({});
  const [isDraftDirty, setIsDraftDirty] = useState(false);
  const [isOrderDirty, setIsOrderDirty] = useState(false);

  // Selected slide
  const [selectedSlideId, setSelectedSlideId] = useState<number | null>(null);
  const selectedDraft = draftSlides.find(s => s.id === selectedSlideId || (s._isNew && s.id === selectedSlideId));

  // Project hero (for project context)
  const [projectHero, setProjectHero] = useState<{ image_url: string; title: string } | null>(null);
  const [projectHeroLoading, setProjectHeroLoading] = useState(false);

  // Permissions
  const canCreate = rbacProfile?.permissions === 'SUPER_ADMIN' || rbacProfile?.permissions?.['payment_carousel']?.can_create;
  const canEdit = rbacProfile?.permissions === 'SUPER_ADMIN' || rbacProfile?.permissions?.['payment_carousel']?.can_edit;
  const canDelete = rbacProfile?.permissions === 'SUPER_ADMIN' || rbacProfile?.permissions?.['payment_carousel']?.can_delete;

  // Object URL lifecycle management (Ref-based to avoid stale closure issues)
  const objectUrlsRef = useRef<Set<string>>(new Set());

  // Track object URL creation
  const trackObjectUrl = (url: string) => {
    objectUrlsRef.current.add(url);
  };

  // Revoke and remove specific object URL
  const revokeObjectUrl = (url: string) => {
    if (objectUrlsRef.current.has(url)) {
      try {
        URL.revokeObjectURL(url);
      } catch (err) {
        // Ignore if already revoked
      }
      objectUrlsRef.current.delete(url);
    }
  };

  // Revoke all tracked object URLs
  const revokeAllObjectUrls = () => {
    for (const url of objectUrlsRef.current) {
      try {
        URL.revokeObjectURL(url);
      } catch (err) {
        // Ignore
      }
    }
    objectUrlsRef.current.clear();
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      revokeAllObjectUrls();
    };
  }, []);

  // Authorization check
  useEffect(() => {
    (async () => {
      const profile = await getRBACProfile();
      setRbacProfile(profile);

      if (!profile) {
        setUnauthorizedMessage('Session expired. Please log in again.');
        return;
      }

      if (profile.permissions === 'SUPER_ADMIN') {
        return;
      }

      const modulePerms = typeof profile.permissions === 'object'
        ? profile.permissions['payment_carousel']
        : null;
      if (!modulePerms?.can_view) {
        setUnauthorizedMessage('You do not have permission to manage the Payment carousel.');
        return;
      }
    })();
  }, []);

  // Load projects on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchAdminProjectsList();
        setProjects(data || []);
      } catch (err) {
        console.error('[PAYMENT_ADMIN] Error loading projects:', err);
      } finally {
        setProjectsLoading(false);
      }
    })();
  }, []);

  // Load carousel slides when context changes
  useEffect(() => {
    if (!rbacProfile) return;

    let cancelled = false;

    (async () => {
      // Clean up object URLs before switching context
      revokeAllObjectUrls();

      setSlides([]);
      setDraftSlides([]);
      setSelectedSlideId(null);
      setSlidesError('');
      setMigrationMissing(false);
      setSlidesLoading(false);
      setIsDraftDirty(false);
      setPendingFiles({});
      setPendingPreviews({});
      setFeedback(null);

      setProjectHero(null);
      setProjectHeroLoading(false);

      const isShowcase = context === 'showcase';
      const projectId = isShowcase ? null : parseInt(context.replace('project-', ''));

      // Load project hero if in project context
      if (!isShowcase && projectId) {
        setProjectHeroLoading(true);
        try {
          const projectData = projects.find(p => p.id === projectId);
          if (projectData?.image) {
            setProjectHero({
              image_url: projectData.image,
              title: projectData.title,
            });
          }
        } catch (err) {
          console.error('[PAYMENT_ADMIN] Error loading project hero:', err);
        } finally {
          if (!cancelled) {
            setProjectHeroLoading(false);
          }
        }
      }

      // Load carousel slides
      setSlidesLoading(true);
      try {
        const result = await fetchCarouselSlidesForAdminAction(projectId);
        if (cancelled) return;

        if (!result.success) {
          if (
            result.error?.includes('not available')
            || result.error?.includes('does not exist')
            || result.error?.includes('schema cache')
          ) {
            setMigrationMissing(true);
          } else {
            setSlidesError(result.error || 'Failed to load carousel slides');
          }
          setSlides([]);
        } else {
          const loadedSlides = result.data || [];
          setSlides(loadedSlides);
          setDraftSlides(loadedSlides.map(s => ({ ...s })));
        }
      } catch (err: any) {
        if (cancelled) return;

        if (
          err?.message?.includes('not available')
          || err?.message?.includes('schema cache')
        ) {
          setMigrationMissing(true);
        } else {
          setSlidesError('Failed to load carousel slides');
        }
        console.error('[PAYMENT_ADMIN] Error loading slides:', err);
      } finally {
        if (!cancelled) {
          setSlidesLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [context, rbacProfile, projects]);

  // Helper: Handle file selection for new/replacement
  const handleFileSelect = (file: File, slideId: number | 'new', isReplace = false) => {
    const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

    // Client-side validation
    if (!ALLOWED_TYPES.has(file.type)) {
      setFeedback({ type: 'error', message: 'Invalid image format. Please upload JPEG, PNG, or WebP.' });
      return;
    }

    if (file.size === 0) {
      setFeedback({ type: 'error', message: 'File is empty.' });
      return;
    }

    if (file.size > MAX_SIZE) {
      setFeedback({ type: 'error', message: `File too large. Maximum: 10 MB. Got: ${(file.size / 1024 / 1024).toFixed(1)} MB.` });
      return;
    }

    const fieldKey = `slide-${slideId}-${isReplace ? 'replace' : 'new'}`;
    setPendingFiles(prev => ({ ...prev, [fieldKey]: file }));

    // Revoke old preview if replacing
    const oldPreview = pendingPreviews[fieldKey];
    if (oldPreview) {
      revokeObjectUrl(oldPreview);
    }

    // Create new object URL and track it
    const objectUrl = URL.createObjectURL(file);
    trackObjectUrl(objectUrl);
    setPendingPreviews(prev => ({ ...prev, [fieldKey]: objectUrl }));

    // Update draft
    setDraftSlides(prev => prev.map(s => {
      if (s.id === slideId || (s._isNew && s.id === slideId)) {
        // Revoke old draft preview if it exists
        if (s._pendingPreview) {
          revokeObjectUrl(s._pendingPreview);
        }
        return {
          ...s,
          _pendingFile: file,
          _pendingPreview: objectUrl,
          _isDirty: true,
        };
      }
      return s;
    }));

    setIsDraftDirty(true);
  };

  // Helper: Add new slide
  const handleAddSlide = async () => {
    if (!canCreate) {
      setFeedback({ type: 'error', message: 'You don\'t have permission to add carousel slides.' });
      return;
    }

    const projectId = context === 'showcase' ? null : parseInt(context.replace('project-', ''));
    const newSlide: DraftSlide = {
      id: Math.random() * -1,
      project_id: projectId,
      image_url: '',
      sort_order: draftSlides.filter(s => !s._isDeleted).length,
      focal_x: 50,
      focal_y: 50,
      alt_text: '',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _isNew: true,
      _isDirty: true,
    };

    setDraftSlides(prev => [...prev, newSlide]);
    setSelectedSlideId(newSlide.id as number);
    setIsDraftDirty(true);
  };

  // Helper: Delete slide (mark for deletion)
  const handleDeleteSlide = (slideId: number) => {
    const slide = draftSlides.find(s => s.id === slideId);
    const isNew = slide?._isNew;

    // New unsaved slides can be removed without delete permission
    if (isNew) {
      if (!window.confirm('Remove this draft slide?')) return;
      setDraftSlides(prev => prev.filter(s => s.id !== slideId));

      // Clean up all object URLs for this slide
      if (slide._pendingPreview) {
        revokeObjectUrl(slide._pendingPreview);
      }

      // Clean up pending files/previews
      const newKey = `slide-${slideId}-new`;
      if (pendingPreviews[newKey]) {
        revokeObjectUrl(pendingPreviews[newKey]);
      }
      if (pendingFiles[newKey] || pendingPreviews[newKey]) {
        setPendingFiles(prev => {
          const copy = { ...prev };
          delete copy[newKey];
          return copy;
        });
        setPendingPreviews(prev => {
          const copy = { ...prev };
          delete copy[newKey];
          return copy;
        });
      }
    } else {
      // Existing slides require delete permission
      if (!canDelete) {
        setFeedback({ type: 'error', message: 'You don\'t have permission to delete carousel slides.' });
        return;
      }

      if (!window.confirm('Delete this slide permanently?')) return;
      setDraftSlides(prev => prev.map(s =>
        s.id === slideId ? { ...s, _isDeleted: true } : s
      ));
    }

    if (selectedSlideId === slideId) {
      setSelectedSlideId(null);
    }

    setIsDraftDirty(true);
  };

  // Helper: Update alt text
  const handleUpdateAltText = (slideId: number, altText: string) => {
    if (altText.length > 200) {
      setFeedback({ type: 'error', message: 'Alt text cannot exceed 200 characters.' });
      return;
    }

    setDraftSlides(prev => prev.map(s =>
      s.id === slideId ? { ...s, alt_text: altText, _isDirty: true } : s
    ));
    setIsDraftDirty(true);
  };

  // Helper: Update focal point
  const handleUpdateFocalPoint = (slideId: number, focalX: number, focalY: number) => {
    setDraftSlides(prev => prev.map(s =>
      s.id === slideId ? { ...s, focal_x: focalX, focal_y: focalY, _isDirty: true } : s
    ));
    setIsDraftDirty(true);
  };

  // Helper: Toggle visibility
  const handleToggleVisibility = (slideId: number) => {
    if (!canEdit) {
      setFeedback({ type: 'error', message: 'You don\'t have permission to edit carousel slides.' });
      return;
    }

    setDraftSlides(prev => prev.map(s =>
      s.id === slideId ? { ...s, is_active: !s.is_active, _isDirty: true } : s
    ));
    setIsDraftDirty(true);
  };

  // Helper: Move slide up/down
  const handleMoveSlide = (slideId: number, direction: 'up' | 'down') => {
    if (!canEdit) {
      setFeedback({ type: 'error', message: 'You don\'t have permission to reorder carousel slides.' });
      return;
    }

    const activeDrafts = draftSlides.filter(s => !s._isDeleted);
    const currentIdx = activeDrafts.findIndex(s => s.id === slideId);
    if (currentIdx === -1) return;

    const newIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
    if (newIdx < 0 || newIdx >= activeDrafts.length) return;

    const reordered = [...activeDrafts];
    [reordered[currentIdx], reordered[newIdx]] = [reordered[newIdx], reordered[currentIdx]];

    const updated = draftSlides.map(s => {
      const newSlide = reordered.find(r => r.id === s.id);
      return newSlide ? { ...newSlide, _isDirty: true } : s;
    });

    setDraftSlides(updated);
    setIsDraftDirty(true);

    // Mark that ordering has changed (requires can_edit permission on save)
    setIsOrderDirty(true);
  };

  // Helper: Reset to persisted state
  const handleReset = () => {
    if (!window.confirm('Discard all unsaved changes?')) return;

    // Clean up all tracked object URLs
    revokeAllObjectUrls();

    setDraftSlides(slides.map(s => ({ ...s })));
    setPendingFiles({});
    setPendingPreviews({});
    setIsDraftDirty(false);
    setIsOrderDirty(false);
    setFeedback(null);
    setSelectedSlideId(null);
  };

  // Helper: Save all changes
  // Note: NOT fully atomic - see comments for partial failure behavior
  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);

    try {
      const projectId = context === 'showcase' ? null : parseInt(context.replace('project-', ''));
      const uploadedUrls: Record<string, string> = {};
      const tempIdToRealId: Record<number, number> = {};

      // 1. Prepare and upload pending files
      for (const [fieldKey, file] of Object.entries(pendingFiles)) {
        const operation = fieldKey.includes('replace') ? 'replace' : 'create';

        // Step 1: Prepare upload (server validates RBAC, project, MIME, size, and creates signed token)
        const prepareResult = await preparePaymentCarouselUploadAction(
          operation,
          projectId,
          file.type,
          file.size
        );

        if (!prepareResult.success) {
          throw new Error(`Upload preparation failed: ${prepareResult.error}`);
        }

        const storagePath = prepareResult.storagePath!;
        const signedToken = prepareResult.token!;

        // Step 2: Upload file directly from browser using signed upload token
        // This bypasses serverless function payload limits - file bytes never touch the function
        // uploadToSignedUrl requires only the token, not authentication
        const { error: uploadError } = await supabase.storage
          .from('images')
          .uploadToSignedUrl(storagePath, signedToken, file, {
            cacheControl: '3600',
            contentType: file.type,
          });

        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        // Step 3: Finalize upload (re-authorize, verify file exists and is valid)
        const finalizeResult = await finalizePaymentCarouselUploadAction(
          operation,
          storagePath,
          projectId
        );

        if (!finalizeResult.success) {
          throw new Error(`Upload finalization failed: ${finalizeResult.error}`);
        }

        uploadedUrls[fieldKey] = finalizeResult.url!;
      }

      // 2. Create new slides (capture real IDs for later reorder)
      for (const slide of draftSlides.filter(s => s._isNew && !s._isDeleted)) {
        const imageUrl = uploadedUrls[`slide-${slide.id}-new`] || slide.image_url;
        if (!imageUrl) {
          throw new Error('New slides must have an image');
        }

        const result = await createPaymentCarouselSlideAction({
          project_id: projectId,
          image_url: imageUrl,
          alt_text: slide.alt_text || null,
          is_active: slide.is_active,
          focal_x: slide.focal_x,
          focal_y: slide.focal_y,
        });

        if (!result.success) throw new Error(result.error);

        // Map temporary client ID to real database ID and update draft
        const newSlideId = result.data?.id;
        if (!newSlideId) {
          throw new Error(`Create succeeded but no ID returned for temp ${slide.id}`);
        }

        tempIdToRealId[slide.id as number] = newSlideId;
        // Update local draft with real ID (prevents duplicate creates on retry)
        setDraftSlides(prev => prev.map(s =>
          s.id === slide.id
            ? {
                ...s,
                id: newSlideId,
                _isNew: false,
                image_url: imageUrl,
              }
            : s
        ));
      }

      // 3. Update existing slides
      for (const slide of draftSlides.filter(s => !s._isNew && !s._isDeleted && s._isDirty)) {
        const imageUrl = uploadedUrls[`slide-${slide.id}-replace`] || slide.image_url;

        const result = await updatePaymentCarouselSlideAction(slide.id!, {
          image_url: imageUrl,
          alt_text: slide.alt_text,
          is_active: slide.is_active,
          focal_x: slide.focal_x,
          focal_y: slide.focal_y,
        });

        if (!result.success) throw new Error(result.error);
      }

      // 4. Delete marked slides
      for (const slide of draftSlides.filter(s => s._isDeleted && !s._isNew)) {
        const result = await deletePaymentCarouselSlideAction(slide.id!);
        if (!result.success) throw new Error(result.error);
      }

      // 5. Reorder active slides only if ordering actually changed
      // This respects can_edit permission - users with can_create but not can_edit
      // can still add slides, but cannot reorder existing ones
      if (isOrderDirty) {
        if (!canEdit) {
          throw new Error('Reordering slides requires edit permission');
        }

        const activeSlideIds = draftSlides
          .filter(s => !s._isDeleted)
          .map(s => {
            const tempId = s.id as number;
            return tempId < 0 && tempIdToRealId[tempId]
              ? tempIdToRealId[tempId]
              : tempId;
          })
          .filter(id => id > 0);

        if (activeSlideIds.length > 0) {
          const reorderResult = await reorderPaymentCarouselSlidesAction(projectId, activeSlideIds);
          if (!reorderResult.success) {
            console.warn('[PAYMENT_ADMIN] Reorder failed after successful mutations:', reorderResult.error);
            setFeedback({
              type: 'error',
              message: `Slides saved but order not persisted: ${reorderResult.error}`,
            });
          }
        }
      }

      setFeedback(prevFeedback =>
        prevFeedback?.type === 'error'
          ? prevFeedback
          : { type: 'success', message: 'Carousel changes saved successfully!' }
      );

      // Reload slides
      const result = await fetchCarouselSlidesForAdminAction(projectId);
      if (result.success) {
        setSlides(result.data || []);
        setDraftSlides((result.data || []).map(s => ({ ...s })));
      }

      setIsDraftDirty(false);
      setIsOrderDirty(false);
      setSelectedSlideId(null);

      // Clean up pending files and object URLs
      setPendingFiles({});
      revokeAllObjectUrls();
      setPendingPreviews({});
    } catch (err: any) {
      // Partial failure: retain draft state for retry or reset
      setFeedback({ type: 'error', message: err.message });
      console.error('[PAYMENT_ADMIN] Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!rbacProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={32} className="animate-spin text-brand-blue" />
      </div>
    );
  }

  if (unauthorizedMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 max-w-md text-center">
          <h1 className="text-lg font-bold text-brand-blue mb-2">Unauthorized</h1>
          <p className="text-sm text-gray-600">{unauthorizedMessage}</p>
        </div>
      </div>
    );
  }

  const currentProject = projects.find(p => p.id === parseInt(context.replace('project-', '')));

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#0B1220] font-sans">
      {/* FEEDBACK MESSAGE */}
      {feedback && (
        <div className={`fixed top-20 right-6 z-[100] flex items-center gap-2.5 rounded-xl border px-4 py-3 shadow-xl ${
          feedback.type === 'success'
            ? 'border-green-200 bg-green-50 text-green-800'
            : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          <span className="text-sm font-medium">{feedback.message}</span>
        </div>
      )}

      {/* EDITOR TOP BAR */}
      <header className="sticky top-0 z-40 flex h-[68px] shrink-0 items-center justify-between gap-6 border-b border-gray-200 bg-white px-6 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={() => {
              if (isDraftDirty && !window.confirm('Leave without saving changes?')) return;
              router.push('/admin/dashboard');
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition-colors hover:border-brand-blue hover:text-brand-blue"
            aria-label="Back to Dashboard"
            title="Back to Dashboard"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">
              <span>Payment</span>
              {isDraftDirty && <span className="ml-auto text-red-600">Unsaved Changes</span>}
            </div>

            <div className="mt-0.5 flex items-center gap-3">
              <h1 className="truncate text-2xl font-serif text-brand-blue">
                Manage Payment Carousel
              </h1>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden xl:inline-flex items-center rounded-full bg-gray-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Desktop Preview
          </span>

          <button
            type="button"
            onClick={handleReset}
            disabled={!isDraftDirty || isSaving || migrationMissing}
            title={!isDraftDirty ? 'No unsaved changes' : 'Discard all unsaved changes'}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:border-brand-blue hover:text-brand-blue"
          >
            <RotateCcw size={14} />
            Reset
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!isDraftDirty || isSaving || migrationMissing}
            title={!isDraftDirty ? 'No unsaved changes' : 'Save all changes to carousel'}
            className="inline-flex items-center justify-center gap-2 min-w-[190px] rounded-lg bg-brand-blue px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors disabled:bg-gray-300 disabled:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </header>

      {/* EDITOR BODY */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* WEBSITE CANVAS */}
        <div
          id="preview-scroller"
          className="flex-1 min-w-0 overflow-y-auto relative scroll-smooth bg-black custom-scrollbar"
        >
          <PaymentCarouselPreview
            context={context}
            slides={draftSlides.filter(s => !s._isDeleted) as PaymentCarouselSlide[]}
            projectHero={projectHero}
            slidesLoading={slidesLoading || projectHeroLoading}
            migrationMissing={migrationMissing}
            slidesError={slidesError}
          />
        </div>

        {/* INSPECTOR */}
        <aside className="w-[380px] xl:w-[420px] shrink-0 bg-white border-l border-gray-200 shadow-2xl flex flex-col z-30 overflow-hidden">
          {/* INSPECTOR HEADER */}
          <div className="px-6 py-5 border-b border-gray-100">
            <p className="text-[10px] uppercase tracking-widest font-bold text-brand-gold mb-1">
              Carousel Content
            </p>

            <h2 className="text-xl font-serif text-brand-blue">
              {context === 'showcase' ? 'Default Showcase' : currentProject?.title}
            </h2>
          </div>

          {/* INSPECTOR CONTENT */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Context Selector */}
            <div className="px-6 py-5 border-b border-gray-100">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-blue mb-2">
                Context
              </label>
              <select
                value={context}
                onChange={(e) => {
                  const newContext = e.target.value as CarouselContext;
                  if (isDraftDirty) {
                    if (window.confirm('You have unsaved changes. Discard them and switch carousel?')) {
                      setContext(newContext);
                    } else {
                      e.target.value = context;
                    }
                  } else {
                    setContext(newContext);
                  }
                }}
                disabled={projectsLoading || slidesLoading}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 disabled:bg-gray-50 disabled:cursor-wait"
              >
                <option value="showcase">Default Showcase</option>
                {projects.map((p) => (
                  <option key={p.id} value={`project-${p.id}`}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Project Hero (if in project context) */}
            {context !== 'showcase' && (
              <div className="px-6 py-5 border-b border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold">
                    Project Hero
                  </p>
                </div>

                {projectHeroLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 size={18} className="animate-spin text-brand-blue" />
                  </div>
                ) : projectHero ? (
                  <div className="space-y-3">
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                      <img
                        src={projectHero.image_url}
                        alt={projectHero.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%2256%22%3E%3Crect fill=%22%23f3f4f6%22 width=%22100%22 height=%2256%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2212%22 fill=%22%23d1d5db%22%3EImage not found%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    </div>
                    <div className="text-xs text-gray-600">
                      <p className="font-semibold text-gray-900">Managed in Projects</p>
                      <button
                        type="button"
                        onClick={() => router.push(`/admin/projects?edit=${currentProject?.id}`)}
                        className="mt-1 text-brand-gold hover:text-brand-blue transition-colors font-semibold"
                      >
                        Open Projects Editor ↗
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No project hero image</p>
                )}
              </div>
            )}

            {/* Additional Slides / Setup Required */}
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  {context !== 'showcase' && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold">
                      Additional Slides
                    </p>
                  )}
                </div>
                {!migrationMissing && !slidesError && (
                  <button
                    type="button"
                    onClick={handleAddSlide}
                    disabled={!canCreate || migrationMissing}
                    title={canCreate ? 'Add new carousel slide' : 'No permission'}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-gold hover:bg-brand-gold/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus size={12} />
                    Add
                  </button>
                )}
              </div>

              {migrationMissing ? (
                <div className="p-4 rounded-lg border border-amber-200 bg-amber-50">
                  <p className="text-xs text-amber-800">
                    <span className="font-semibold">Carousel setup required</span>
                    <br />
                    Payment carousel storage has not been set up in this environment yet. Apply the Payment Carousel database migration before managing carousel images.
                  </p>
                </div>
              ) : slidesError ? (
                <div className="p-4 rounded-lg border border-red-200 bg-red-50">
                  <p className="text-xs text-red-800">{slidesError}</p>
                </div>
              ) : slidesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-brand-blue" />
                </div>
              ) : draftSlides.filter(s => !s._isDeleted).length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-8">
                  {context === 'showcase'
                    ? 'No default showcase images configured yet.'
                    : 'No additional Payment slides configured.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {draftSlides
                    .filter(s => !s._isDeleted)
                    .map((slide, idx) => (
                      <button
                        key={slide.id}
                        type="button"
                        onClick={() => setSelectedSlideId(slide.id as number)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedSlideId === slide.id
                            ? 'border-brand-gold bg-brand-gold/5 ring-1 ring-brand-gold/30'
                            : 'border-gray-200 bg-white hover:border-brand-gold/50'
                        } ${slide._isNew ? 'opacity-75' : ''}`}
                      >
                        <div className="flex gap-3">
                          <div className="relative w-12 h-12 rounded flex-shrink-0 bg-gray-100 border border-gray-200 overflow-hidden">
                            <img
                              src={slide._pendingPreview || slide.image_url}
                              alt={slide.alt_text || 'Slide'}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2256%22 height=%2256%22%3E%3Crect fill=%22%23f3f4f6%22 width=%2256%22 height=%2256%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2210%22 fill=%22%23d1d5db%22%3E%3F%3C/text%3E%3C/svg%3E';
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900 truncate">
                              {slide.alt_text || `Slide ${idx + 1}`}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {slide._isNew ? 'New • ' : ''}{slide.is_active ? 'Active' : 'Hidden'}{slide._isDirty ? ' • edited' : ''}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* SELECTED SLIDE DETAILS (Editable) */}
          {selectedDraft && (
            <div className="px-6 py-5 border-t border-gray-100 space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-3">
                  {selectedDraft._isNew ? 'New Slide' : 'Slide Details'}
                </p>
              </div>

              {/* Image */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-2">Image</label>
                <div className="space-y-2">
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                    <img
                      src={selectedDraft._pendingPreview || selectedDraft.image_url}
                      alt={selectedDraft.alt_text || 'Slide'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%2256%22%3E%3Crect fill=%22%23f3f4f6%22 width=%22100%22 height=%2256%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2212%22 fill=%22%23d1d5db%22%3EImage not found%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  </div>
                  {!selectedDraft._isNew && (
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e: any) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect(file, selectedDraft.id as number, true);
                        };
                        input.click();
                      }}
                      disabled={!canEdit}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 bg-white hover:border-brand-gold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Replace Image
                    </button>
                  )}
                  {selectedDraft._isNew && (
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e: any) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect(file, selectedDraft.id as number, false);
                        };
                        input.click();
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 bg-white hover:border-brand-gold transition-colors"
                    >
                      Choose Image
                    </button>
                  )}
                </div>
              </div>

              {/* Alt Text */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-1">Alt Text</label>
                <input
                  type="text"
                  value={selectedDraft.alt_text || ''}
                  onChange={(e) => handleUpdateAltText(selectedDraft.id as number, e.target.value)}
                  placeholder="Describe this carousel image..."
                  maxLength={200}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  {(selectedDraft.alt_text || '').length}/200
                </p>
              </div>

              {/* Focal Point Editor */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-3">
                  Image Focus
                </p>
                <FocalPointEditor
                  imageUrl={selectedDraft._pendingPreview || selectedDraft.image_url}
                  focalX={selectedDraft.focal_x ?? 50}
                  focalY={selectedDraft.focal_y ?? 50}
                  onFocalChange={(x, y) => handleUpdateFocalPoint(selectedDraft.id as number, x, y)}
                  isHidden={!selectedDraft.is_active}
                  canEdit={canEdit}
                />
              </div>

              {/* Visibility Toggle */}
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
                <label className="text-[10px] font-semibold text-gray-600">Show on carousel</label>
                <button
                  type="button"
                  onClick={() => handleToggleVisibility(selectedDraft.id as number)}
                  disabled={!canEdit}
                  className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
                    selectedDraft.is_active ? 'bg-brand-gold' : 'bg-gray-300'
                  } ${!canEdit ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      selectedDraft.is_active ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Reorder Controls */}
              {draftSlides.filter(s => !s._isDeleted).length > 1 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleMoveSlide(selectedDraft.id as number, 'up')}
                    disabled={!canEdit || draftSlides.filter(s => !s._isDeleted)[0].id === selectedDraft.id}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 bg-white hover:border-brand-gold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronUp size={14} />
                    Move Up
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveSlide(selectedDraft.id as number, 'down')}
                    disabled={!canEdit || draftSlides.filter(s => !s._isDeleted)[draftSlides.filter(s => !s._isDeleted).length - 1].id === selectedDraft.id}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 bg-white hover:border-brand-gold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronDown size={14} />
                    Move Down
                  </button>
                </div>
              )}

              {/* Delete Button */}
              {!selectedDraft._isNew && (
                <button
                  type="button"
                  onClick={() => handleDeleteSlide(selectedDraft.id as number)}
                  disabled={!canDelete}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-red-300 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 size={14} />
                  Delete Slide
                </button>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
