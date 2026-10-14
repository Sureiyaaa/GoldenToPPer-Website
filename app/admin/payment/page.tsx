'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, RotateCcw, Save } from 'lucide-react';
import { getRBACProfile } from '@/app/actions/auth';
import { fetchAdminProjectsList } from '@/app/actions/projects';
import {
  fetchCarouselSlidesForAdminAction,
  PaymentCarouselSlide,
} from '@/app/actions/payment-carousel';
import PaymentCarouselPreview from './PaymentCarouselPreview';

type CarouselContext = 'showcase' | `project-${number}`;

export default function AdminPaymentEditor() {
  const router = useRouter();
  const [rbacProfile, setRbacProfile] = useState<any>(null);
  const [unauthorizedMessage, setUnauthorizedMessage] = useState('');

  // Projects list
  const [projects, setProjects] = useState<any[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  // Carousel context selection
  const [context, setContext] = useState<CarouselContext>('showcase');

  // Carousel slides
  const [slides, setSlides] = useState<PaymentCarouselSlide[]>([]);
  const [slidesLoading, setSlidesLoading] = useState<boolean>(false);
  const [slidesError, setSlidesError] = useState('');
  const [migrationMissing, setMigrationMissing] = useState(false);

  // Selected slide (read-only preview)
  const [selectedSlideId, setSelectedSlideId] = useState<number | null>(null);
  const selectedSlide = slides.find(s => s.id === selectedSlideId);

  // Project hero (for project context)
  const [projectHero, setProjectHero] = useState<{ image_url: string; title: string } | null>(null);
  const [projectHeroLoading, setProjectHeroLoading] = useState(false);

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
      setSlides([]);
      setSelectedSlideId(null);
      setSlidesError('');
      setMigrationMissing(false);
      setSlidesLoading(false);

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
          setSlides(result.data || []);
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
      {/* EDITOR TOP BAR */}
      <header className="sticky top-0 z-40 flex h-[68px] shrink-0 items-center justify-between gap-6 border-b border-gray-200 bg-white px-6 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={() => router.push('/admin/dashboard')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition-colors hover:border-brand-blue hover:text-brand-blue"
            aria-label="Back to Dashboard"
            title="Back to Dashboard"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">
              <span>Payment</span>
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
            disabled
            title="Reset is not yet available for read-only preview"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw size={14} />
            Reset
          </button>

          <button
            type="button"
            disabled
            title="Save is not yet available for read-only preview"
            className="inline-flex items-center justify-center gap-2 min-w-[190px] rounded-lg bg-brand-blue px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors disabled:bg-gray-300 disabled:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={15} />
            Save Changes
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
            slides={slides}
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
                onChange={(e) => setContext(e.target.value as CarouselContext)}
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
            <div className="px-6 py-5">
              {context !== 'showcase' && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-3">
                  Additional Slides
                </p>
              )}

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
              ) : slides.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-8">
                  {context === 'showcase'
                    ? 'No default showcase images configured yet.'
                    : 'No additional Payment slides configured.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {slides.map((slide, idx) => (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => setSelectedSlideId(slide.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedSlideId === slide.id
                          ? 'border-brand-gold bg-brand-gold/5 ring-1 ring-brand-gold/30'
                          : 'border-gray-200 bg-white hover:border-brand-gold/50'
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="relative w-12 h-12 rounded flex-shrink-0 bg-gray-100 border border-gray-200 overflow-hidden">
                          <img
                            src={slide.image_url}
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
                            {slide.is_active ? 'Active' : 'Hidden'}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SELECTED SLIDE DETAILS (Read-only) */}
          {selectedSlide && (
            <div className="px-6 py-5 border-t border-gray-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-3">
                Slide Details
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-600 mb-1">Image</label>
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                    <img
                      src={selectedSlide.image_url}
                      alt={selectedSlide.alt_text || 'Slide'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%2256%22%3E%3Crect fill=%22%23f3f4f6%22 width=%22100%22 height=%2256%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2212%22 fill=%22%23d1d5db%22%3EImage not found%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-600 mb-1">Alt Text</label>
                  <p className="text-sm text-gray-900 break-words">
                    {selectedSlide.alt_text || '(no alt text)'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-600 mb-1">Focal X</label>
                    <p className="text-sm text-gray-900">{selectedSlide.focal_x.toFixed(1)}%</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-600 mb-1">Focal Y</label>
                    <p className="text-sm text-gray-900">{selectedSlide.focal_y.toFixed(1)}%</p>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-600 mb-1">Status</label>
                  <p className="text-sm text-gray-900">
                    {selectedSlide.is_active ? 'Active' : 'Hidden'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
