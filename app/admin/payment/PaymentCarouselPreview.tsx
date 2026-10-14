import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { PaymentCarouselSlide } from '@/app/actions/payment-carousel';

interface PaymentCarouselPreviewProps {
  context: string;
  slides: PaymentCarouselSlide[];
  projectHero: { image_url: string; title: string } | null;
  slidesLoading: boolean;
  migrationMissing: boolean;
  slidesError: string;
}

export default function PaymentCarouselPreview({
  context,
  slides,
  projectHero,
  slidesLoading,
  migrationMissing,
  slidesError,
}: PaymentCarouselPreviewProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Compose carousel: hero + custom slides (for project context)
  const isShowcase = context === 'showcase';
  const composedSlides: Array<{
    type: 'hero' | 'custom';
    data: PaymentCarouselSlide | { image_url: string; alt_text?: string };
  }> = [];

  if (!isShowcase && projectHero) {
    composedSlides.push({
      type: 'hero',
      data: {
        image_url: projectHero.image_url,
        alt_text: `${projectHero.title} Hero`,
      },
    });
  }

  slides.forEach((slide) => {
    composedSlides.push({
      type: 'custom',
      data: slide,
    });
  });

  const currentSlide = composedSlides[currentSlideIndex];
  const hasMultipleSlides = composedSlides.length > 1;

  const handlePrev = () => {
    setCurrentSlideIndex((prev) => (prev - 1 + composedSlides.length) % composedSlides.length);
  };

  const handleNext = () => {
    setCurrentSlideIndex((prev) => (prev + 1) % composedSlides.length);
  };

  // Reset slide index when context changes
  useEffect(() => {
    setCurrentSlideIndex(0);
  }, [context, composedSlides.length]);

  if (slidesLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 size={48} className="animate-spin text-brand-gold" />
      </div>
    );
  }

  if (slidesError) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-600" />
          <h3 className="text-lg font-bold text-white mb-2">Error Loading Slides</h3>
          <p className="text-sm text-gray-400">{slidesError}</p>
        </div>
      </div>
    );
  }

  // For project context, show hero even if migration is missing
  if (!isShowcase && projectHero && composedSlides.length > 0) {
    // Show carousel with hero + custom slides
    // Normal carousel rendering follows below
  } else if (!isShowcase && projectHero && (migrationMissing || composedSlides.length === 0)) {
    // Project hero exists but no custom slides and/or migration missing
    // Show hero only
    const heroSlide = {
      type: 'hero' as const,
      data: {
        image_url: projectHero.image_url,
        alt_text: `${projectHero.title} Hero`,
      },
    };

    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
          <div className="w-full max-w-4xl aspect-video rounded-2xl overflow-hidden shadow-2xl bg-gray-900 border border-gray-800 relative">
            <img
              src={heroSlide.data.image_url}
              alt={heroSlide.data.alt_text}
              className="w-full h-full object-cover"
              style={{
                objectPosition: '50% 50%',
              }}
              onError={(e) => {
                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22225%22%3E%3Crect fill=%22%231f2937%22 width=%22400%22 height=%22225%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2216%22 fill=%22%239ca3af%22%3EImage not found%3C/text%3E%3C/svg%3E';
              }}
            />
            <div className="absolute top-4 left-4 inline-flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
              <span className="inline-block w-2 h-2 rounded-full bg-brand-gold" />
              Hero
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-700 bg-gray-900/50">
          <div className="flex items-start justify-between gap-4 text-xs text-gray-300">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-1">
                Preview
              </p>
              <p className="text-sm">
                Project Carousel with Hero
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-1">
                Current Slide
              </p>
              <p className="text-sm">
                {heroSlide.data.alt_text}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  } else if (isShowcase && migrationMissing) {
    // Default showcase with missing migration
    return (
      <div className="w-full h-full flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="mb-4 inline-flex rounded-full bg-gray-800 p-4">
            <div className="text-3xl">⚙️</div>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Carousel Setup Required</h3>
          <p className="text-sm text-gray-400">
            Payment carousel storage has not been set up in this environment yet. Apply the database migration to begin managing carousel images.
          </p>
        </div>
      </div>
    );
  }

  if (composedSlides.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="mb-4 inline-flex rounded-full bg-gray-800 p-4">
            <div className="text-3xl">🖼️</div>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">No Carousel Images</h3>
          <p className="text-sm text-gray-400">
            {isShowcase
              ? 'The default showcase carousel is empty. Add images to display them on the Payment page.'
              : 'This project has no additional carousel slides. The project hero will be shown on the Payment page.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* CAROUSEL CONTAINER */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
        <div className="w-full max-w-4xl aspect-video rounded-2xl overflow-hidden shadow-2xl bg-gray-900 border border-gray-800 relative">
          {currentSlide && (
            <img
              key={currentSlide.data.image_url}
              src={currentSlide.data.image_url}
              alt={currentSlide.data.alt_text || 'Slide'}
              className="w-full h-full object-cover"
              style={{
                objectPosition: `${
                  'focal_x' in currentSlide.data
                    ? currentSlide.data.focal_x
                    : 50
                }% ${
                  'focal_y' in currentSlide.data
                    ? currentSlide.data.focal_y
                    : 50
                }%`,
              }}
              onError={(e) => {
                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22225%22%3E%3Crect fill=%22%231f2937%22 width=%22400%22 height=%22225%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2216%22 fill=%22%239ca3af%22%3EImage not found%3C/text%3E%3C/svg%3E';
              }}
            />
          )}

          {/* SLIDE TYPE BADGE */}
          {currentSlide && (
            <div className="absolute top-4 left-4 inline-flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  currentSlide.type === 'hero'
                    ? 'bg-brand-gold'
                    : 'bg-blue-400'
                }`}
              />
              {currentSlide.type === 'hero' ? 'Hero' : 'Custom'}
            </div>
          )}

          {/* NAVIGATION CONTROLS */}
          {hasMultipleSlides && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/40 backdrop-blur-sm p-2 text-white hover:bg-black/60 transition-colors"
                aria-label="Previous slide"
              >
                <ChevronLeft size={24} />
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/40 backdrop-blur-sm p-2 text-white hover:bg-black/60 transition-colors"
                aria-label="Next slide"
              >
                <ChevronRight size={24} />
              </button>

              {/* SLIDE INDICATOR */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/40 backdrop-blur-sm px-4 py-2">
                <span className="text-xs font-bold text-white">
                  {currentSlideIndex + 1} / {composedSlides.length}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* INFO PANEL */}
      <div className="px-6 py-4 border-t border-gray-700 bg-gray-900/50">
        <div className="flex items-start justify-between gap-4 text-xs text-gray-300">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-1">
              Preview
            </p>
            <p className="text-sm">
              {isShowcase
                ? 'Default Showcase Carousel'
                : 'Project Carousel with Hero + Additional Slides'}
            </p>
          </div>
          {currentSlide && (
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-1">
                Current Slide
              </p>
              <p className="text-sm">
                {currentSlide.data.alt_text || `Slide ${currentSlideIndex + 1}`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
