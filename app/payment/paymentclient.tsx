'use client';

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Navbar from "@/app/components/navbar";
import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight, Check, Edit2, Mail, Phone, Pause, Play } from "lucide-react";
import PageTransition from "../components/page-transitions";
import { submitPaymentAction, fetchProjectsForPayment, fetchTowersForProject, fetchUnitTypesForTower } from "@/app/actions/payment";
import { fetchDefaultCarouselSlidesAction, fetchProjectCarouselSlidesAction, PaymentCarouselSlide } from "@/app/actions/payment-carousel";

declare global {
  interface Window {
    turnstile: {
      render: (element: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
      getResponse: (widgetId?: string) => string;
    };
  }
}

// Full payment form schema - all steps combined
const paymentSchema = z.object({
  // Step 1: Payer Information
  firstName: z.string().min(1, "First name is required").regex(/^[a-zA-Z\s\-']+$/, "Invalid characters"),
  lastName: z.string().min(1, "Last name is required").regex(/^[a-zA-Z\s\-']+$/, "Invalid characters"),
  email: z.string().email("Enter a valid email address"),
  contactNumber: z.string()
    .min(11, "Contact number must be 11 digits")
    .max(11, "Contact number must be 11 digits")
    .regex(/^\d+$/, "Numbers only"),

  // Step 2: Property Details - use stable IDs
  projectId: z.string().min(1, "Please select a project").regex(/^\d+$/, "Invalid project"),
  towerId: z.string().min(1, "Tower is required").regex(/^\d+$/, "Invalid tower"),
  unitTypeId: z.string().min(1, "Unit type is required").regex(/^\d+$/, "Invalid unit type"),
  unitNumber: z.string()
    .min(1, "Unit number is required")
    .regex(/^\d+$/, "Must be digits only")
    .refine((val) => parseInt(val) > 0, "Must be a positive number"),

  // Step 3: Payment Details
  paymentPurpose: z.string().min(1, "Please select a payment purpose"),
  amount: z.string()
    .min(1, "Amount is required")
    .regex(/^\d+(\.\d{1,2})?$/, "Invalid format (e.g. 1000.00)")
    .refine((val) => parseFloat(val) > 0, "Amount must be greater than zero"),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

// Public carousel slide shape (CMS slide with focal point and alt text)
interface CarouselImage {
  imageUrl: string;
  altText?: string | null;
  focalX: number;
  focalY: number;
}

// Convert legacy fallback images to carousel format with centered focal point (no CMS alt text available)
function convertLegacyDefaultShowcase(): CarouselImage[] {
  return LEGACY_DEFAULT_SHOWCASE_FALLBACK.map(url => ({
    imageUrl: url,
    altText: null,
    focalX: 50,
    focalY: 50,
  }));
}

function convertLegacyProjectAmenities(projectId: number): CarouselImage[] {
  const amenities = LEGACY_PROJECT_AMENITY_FALLBACK[projectId] || [];
  return amenities.map(url => ({
    imageUrl: url,
    altText: null,
    focalX: 50,
    focalY: 50,
  }));
}

// Emergency fallback images for Default showcase (used only for CMS failure/empty)
// Component refs for building LEGACY_DEFAULT_SHOWCASE_FALLBACK array
const LEGACY_DEFAULT_CAROUSEL_IMAGES: Record<number, string> = {
  1: "/images/projects/City_Clou_image.png", // City Clou
  2: "/images/projects/el_sol_projects.webp", // El Sol
  3: "/images/projects/lavida-dedicated.webp", // La Vida (higher quality source)
  4: "/images/projects/park-one.webp", // Park One
};

// Emergency fallback for Default showcase when CMS is unavailable or empty.
// This is only used when fetchDefaultCarouselSlidesAction() fails or returns no slides.
// Introduces the portfolio before its supporting amenity highlights.
const LEGACY_DEFAULT_SHOWCASE_FALLBACK = [
  LEGACY_DEFAULT_CAROUSEL_IMAGES[1],
  LEGACY_DEFAULT_CAROUSEL_IMAGES[4],
  LEGACY_DEFAULT_CAROUSEL_IMAGES[3],
  LEGACY_DEFAULT_CAROUSEL_IMAGES[2],
  "/images/projects/city-clou-amenities/function_room_cityclou.webp",
  "/images/projects/park-one-amenities/gym_with_yoga_room_parkone.jpg",
  "/images/projects/la-vida-amenities/lap_pool_lavida.webp",
  "/images/projects/el-sol-amenities/lounge_and_bar.webp",
];

// Emergency fallback amenity images for projects when CMS is unavailable or fails.
// This is only used when fetchProjectCarouselSlidesAction() fails.
const LEGACY_PROJECT_AMENITY_FALLBACK: Record<number, string[]> = {
  1: [ // City Clou
    "/images/projects/city-clou-amenities/dedicated_retail_area_city-clou.webp",
    "/images/projects/city-clou-amenities/lap_pool_city-clou.webp",
    "/images/projects/city-clou-amenities/gameroom_cityclou.webp",
    "/images/projects/city-clou-amenities/playroom_cityclou.webp",
    "/images/projects/city-clou-amenities/lounge_cityclou.webp",
    "/images/projects/city-clou-amenities/library_cityclou.webp",
    "/images/projects/city-clou-amenities/function_room_cityclou.webp",
    "/images/projects/city-clou-amenities/gym_cityclou.webp",
    "/images/projects/city-clou-amenities/yoga_cityclou.webp",
  ],
  2: [ // El Sol
    "/images/projects/el-sol-amenities/lounge_and_bar.webp",
    "/images/projects/el-sol-amenities/swimming_pool_with_kiddie_pool.webp",
    "/images/projects/el-sol-amenities/function_rooms_el_sol.webp",
    "/images/projects/el-sol-amenities/outdoor_bar_and_lounge.webp",
    "/images/projects/el-sol-amenities/gym_with_yoga_room.webp",
    "/images/projects/el-sol-amenities/recreational_court.webp",
    "/images/projects/el-sol-amenities/childrens_playroom.webp",
  ],
  3: [ // La Vida
    "/images/projects/la-vida-amenities/dedicated_retail_area_lavida.webp",
    "/images/projects/la-vida-amenities/kids_playroom_lavida.webp",
    "/images/projects/la-vida-amenities/lap_pool_lavida.webp",
    "/images/projects/la-vida-amenities/function_rooms_lavida.webp",
    "/images/projects/la-vida-amenities/kiddie_pool_lavida.webp",
    "/images/projects/la-vida-amenities/jogging_trail_lavida.webp",
  ],
  4: [ // Park One
    "/images/projects/park-one-amenities/lap-pool-parkone.jpg",
    "/images/projects/park-one-amenities/gym_with_yoga_room_parkone.jpg",
    "/images/projects/park-one-amenities/function_rooms_parkone.jpg",
  ],
};

const CAROUSEL_DURATION_MS = 5000;

const STEPS = [
  { id: 1, label: 'Payer', title: 'Payer Information' },
  { id: 2, label: 'Property', title: 'Property Details' },
  { id: 3, label: 'Payment', title: 'Payment Details' },
  { id: 4, label: 'Review', title: 'Review & Confirm' },
];

// Navbar uses h-20, or h-16 + mt-4 when scrolled: both end at 5rem.
const NAVBAR_HEIGHT = '5rem';

// Stable component identity keeps wizard re-renders from restarting the slideshow.
function PaymentCarousel({ images, projectName }: { images: CarouselImage[]; projectName: string | null }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [loadedSlides, setLoadedSlides] = useState<number[]>([0]);
  const [isDesktop, setIsDesktop] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const [manualAnnouncement, setManualAnnouncement] = useState('');
  const activeProgressRef = useRef<HTMLSpanElement>(null);
  const currentSlideRef = useRef(0);
  const elapsedRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 768px)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMedia = () => {
      setIsDesktop(desktopQuery.matches);
      setReducedMotion(motionQuery.matches);
    };
    const updateVisibility = () => setPageHidden(document.hidden);
    updateMedia();
    updateVisibility();
    desktopQuery.addEventListener('change', updateMedia);
    motionQuery.addEventListener('change', updateMedia);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      desktopQuery.removeEventListener('change', updateMedia);
      motionQuery.removeEventListener('change', updateMedia);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  // Mount neighboring images ahead of navigation; retain visited nodes/cache on loops.
  useEffect(() => {
    if (!isDesktop) return;
    setLoadedSlides((loaded) => {
      const staged = new Set([
        ...loaded,
        slideIndex,
        (slideIndex + 1) % images.length,
        (slideIndex - 1 + images.length) % images.length,
      ]);
      return staged.size === loaded.length ? loaded : [...staged];
    });
  }, [isDesktop, slideIndex, images.length]);

  const showSlide = useCallback((index: number, manual = false) => {
    currentSlideRef.current = index;
    elapsedRef.current = 0;
    lastFrameRef.current = performance.now();
    if (manual && activeProgressRef.current) {
      activeProgressRef.current.style.transform = 'scaleX(0)';
    }
    setSlideIndex(index);
    if (manual) setManualAnnouncement(`Property image ${index + 1} of ${images.length}`);
  }, [images.length]);

  const paused = isHovered || isFocused || manuallyPaused || pageHidden;
  const autoplay = isDesktop && !reducedMotion && images.length > 1;

  // One clock owns both the visible fill and advancement, including pause/resume.
  useEffect(() => {
    if (!autoplay || paused) {
      lastFrameRef.current = null;
      return;
    }
    let frameId = 0;
    lastFrameRef.current = performance.now();
    const tick = (timestamp: number) => {
      elapsedRef.current += timestamp - (lastFrameRef.current ?? timestamp);
      lastFrameRef.current = timestamp;
      const progress = Math.min(elapsedRef.current / CAROUSEL_DURATION_MS, 1);
      if (activeProgressRef.current) {
        activeProgressRef.current.style.transform = `scaleX(${progress})`;
      }
      if (progress >= 1) {
        showSlide((currentSlideRef.current + 1) % images.length);
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameId);
      lastFrameRef.current = null;
    };
  }, [autoplay, paused, images.length, showSlide]);

  const navigate = (direction: number) => {
    showSlide((currentSlideRef.current + direction + images.length) % images.length, true);
  };
  const renderedSlides = [...new Set([...loadedSlides, slideIndex])];

  return (
    <section
      id="payment-property-carousel"
      aria-label={projectName ? `${projectName} property images` : 'Golden ToPPer property highlights'}
      aria-roledescription="carousel"
      className="hidden md:block w-full md:w-1/2 relative h-full z-0 group overflow-hidden bg-black"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false);
      }}
    >
      {renderedSlides.map((index) => {
        const slide = images[index];
        if (!slide) return null;
        return (
          <div
            key={`slide-${index}-${slide.imageUrl}`}
            data-carousel-slide={index}
            aria-hidden={index !== slideIndex}
            className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ease-in-out motion-reduce:transition-none motion-reduce:duration-0 ${index === slideIndex ? 'opacity-100' : 'opacity-0'}`}
          >
            <Image
              src={slide.imageUrl}
              alt={slide.altText || "Property image"}
              fill
              sizes="(max-width: 767px) 1px, 50vw"
              loading="eager"
              className="object-cover"
              style={{ objectPosition: `${slide.focalX}% ${slide.focalY}%` }}
            />
          </div>
        );
      })}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-blue/80 via-transparent to-black/20 mix-blend-multiply" />

      <button
        type="button"
        aria-label="Previous property image"
        onClick={() => navigate(-1)}
        className="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-brand-blue text-white hover:bg-brand-gold hover:text-brand-blue rounded-full transition-colors duration-200 shadow-lg z-10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold"
      >
        <ChevronLeft size={20} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        aria-label="Next property image"
        onClick={() => navigate(1)}
        className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-brand-blue text-white hover:bg-brand-gold hover:text-brand-blue rounded-full transition-colors duration-200 shadow-lg z-10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold"
      >
        <ChevronRight size={20} strokeWidth={1.5} />
      </button>

      <div className="absolute bottom-16 left-10 md:left-12 right-12 text-white z-10" aria-live="off">
        <p className="text-[11px] font-medium tracking-wide text-white mb-2 drop-shadow-md">
          {projectName ? `Property View ${slideIndex + 1} of ${images.length}` : 'Property Highlights'}
        </p>
        <h2 className="text-4xl lg:text-5xl font-serif font-normal leading-tight drop-shadow-xl">
          <span className="text-brand-gold">{projectName || 'Golden ToPPer'}</span>
        </h2>
        {!projectName && (
          <p className="mt-2 text-[11px] font-medium tracking-wide text-white/90 drop-shadow-md">
            Highlight {slideIndex + 1} of {images.length}
          </p>
        )}
      </div>

      <div className="absolute bottom-6 left-10 md:left-12 right-12 z-10 flex items-center gap-3">
        <div className="flex min-w-0 flex-1 gap-1.5" aria-hidden="true">
          {images.map((slide, index) => (
            <span key={`segment-${index}-${slide.imageUrl}`} data-carousel-segment={index} className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-white/20">
              <span
                key={index === slideIndex ? 'active' : 'inactive'}
                ref={index === slideIndex ? activeProgressRef : undefined}
                data-carousel-progress={index === slideIndex ? 'current' : index < slideIndex ? 'complete' : 'upcoming'}
                className="block h-full w-full origin-left rounded-full bg-brand-gold"
                style={{ transform: index < slideIndex ? 'scaleX(1)' : 'scaleX(0)' }}
              />
            </span>
          ))}
        </div>
        <button
          type="button"
          aria-label={manuallyPaused ? 'Resume property slideshow' : 'Pause property slideshow'}
          aria-pressed={manuallyPaused}
          disabled={reducedMotion}
          onClick={() => setManuallyPaused((value) => !value)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/20 text-white/80 transition-colors duration-200 hover:border-brand-gold/60 hover:text-brand-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold motion-reduce:hidden"
        >
          {manuallyPaused ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}
        </button>
      </div>
      <p className="sr-only" aria-live="polite">{manualAnnouncement}</p>
    </section>
  );
}

export default function PaymentClient() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Turnstile state
  const turnstileWidgetIdRef = useRef<string | undefined>(undefined);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const stepContentRef = useRef<HTMLDivElement>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState('');
  const [serverError, setServerError] = useState('');

  // Project/Tower/UnitType data loading state
  const [projects, setProjects] = useState<Array<{ id: number; title: string; image?: string }>>([]);
  const [towers, setTowers] = useState<Array<{ id: number; name: string }>>([]);
  const [unitTypes, setUnitTypes] = useState<Array<{ id: number; title: string }>>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingTowers, setLoadingTowers] = useState(false);
  const [loadingUnitTypes, setLoadingUnitTypes] = useState(false);

  // Carousel state - CMS-driven slides with focal point metadata
  const [carouselSlides, setCarouselSlides] = useState<CarouselImage[]>([]);
  const [carouselLoading, setCarouselLoading] = useState(false);
  const projectRequestIdRef = useRef<number>(0);
  const selectedProjectIdRef = useRef<number | null>(null);
  const resolvedDefaultSlidesRef = useRef<CarouselImage[] | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    mode: "onBlur",
    defaultValues: {
      firstName: '', lastName: '', email: '', contactNumber: '',
      projectId: '', towerId: '', unitTypeId: '', unitNumber: '',
      paymentPurpose: '', amount: '',
    }
  });

  const watchProjectId = watch("projectId");
  const watchTowerId = watch("towerId");

  // Load projects on mount
  useEffect(() => {
    const loadProjects = async () => {
      setLoadingProjects(true);
      try {
        const data = await fetchProjectsForPayment();
        setProjects(data);
      } catch (err) {
        console.error('Error loading projects:', err);
      } finally {
        setLoadingProjects(false);
      }
    };
    loadProjects();
  }, []);

  // Load default carousel slides on mount
  // Resolve CMS + fallback once, store in ref for reuse across no-project states
  // Only update carousel if no project is selected to prevent race with project selection
  useEffect(() => {
    const loadDefaultCarousel = async () => {
      setCarouselLoading(true);
      try {
        const result = await fetchDefaultCarouselSlidesAction();

        let resolved: CarouselImage[];
        if (result.success && result.slides.length > 0) {
          // Convert CMS slides to carousel image format with focal point
          resolved = result.slides.map(slide => ({
            imageUrl: slide.image_url,
            altText: slide.alt_text,
            focalX: slide.focal_x,
            focalY: slide.focal_y,
          }));
        } else {
          // Both success+empty and failure fall back to legacy
          resolved = convertLegacyDefaultShowcase();
        }

        // Always update the baseline ref for later fallback use
        resolvedDefaultSlidesRef.current = resolved;

        // Only update carousel display if no project selected (prevent race with project selection)
        if (!selectedProjectIdRef.current) {
          setCarouselSlides(resolved);
        }
      } catch (err) {
        console.error('[PAYMENT] Error loading default carousel:', err);
        const fallback = convertLegacyDefaultShowcase();
        resolvedDefaultSlidesRef.current = fallback;
        if (!selectedProjectIdRef.current) {
          setCarouselSlides(fallback);
        }
      } finally {
        setCarouselLoading(false);
      }
    };
    loadDefaultCarousel();
  }, []);

  // Load towers and carousel when project changes
  useEffect(() => {
    if (!watchProjectId) {
      // Protect deselection with request counter (project → no project)
      ++projectRequestIdRef.current;
      selectedProjectIdRef.current = null;
      setTowers([]);
      setUnitTypes([]);
      // Reset carousel to resolved default when no project selected
      if (resolvedDefaultSlidesRef.current) {
        setCarouselSlides(resolvedDefaultSlidesRef.current);
      } else {
        setCarouselSlides(convertLegacyDefaultShowcase());
      }
      setValue('towerId', '', { shouldValidate: false });
      setValue('unitTypeId', '', { shouldValidate: false });
      return;
    }

    const projectId = parseInt(watchProjectId);
    selectedProjectIdRef.current = projectId;
    const currentRequestId = ++projectRequestIdRef.current;

    const loadData = async () => {
      setLoadingTowers(true);
      setCarouselLoading(true);
      try {
        // Load towers
        const towerData = await fetchTowersForProject(projectId);
        setTowers(towerData);

        // Load project carousel slides
        const result = await fetchProjectCarouselSlidesAction(projectId);

        // Protect against stale responses
        if (currentRequestId !== projectRequestIdRef.current) {
          return;
        }

        // Get canonical hero from selected project
        const selectedProject = projects.find(p => p.id === projectId);
        const effectiveHero = selectedProject?.image
          ? {
              imageUrl: selectedProject.image,
              altText: `${selectedProject.title} project image`,
              focalX: 50,
              focalY: 50,
            }
          : null;

        if (result.success) {
          // CMS fetch succeeded
          const carouselImages = result.slides.map(slide => ({
            imageUrl: slide.image_url,
            altText: slide.alt_text,
            focalX: slide.focal_x,
            focalY: slide.focal_y,
          }));

          // Compose based on what we have
          if (effectiveHero && carouselImages.length > 0) {
            // Hero + custom slides
            setCarouselSlides([effectiveHero, ...carouselImages]);
          } else if (effectiveHero) {
            // Hero only (success + empty custom)
            setCarouselSlides([effectiveHero]);
          } else if (carouselImages.length > 0) {
            // Custom slides only (no hero)
            setCarouselSlides(carouselImages);
          } else {
            // Neither hero nor custom (success + empty) → use resolved default
            if (resolvedDefaultSlidesRef.current) {
              setCarouselSlides(resolvedDefaultSlidesRef.current);
            } else {
              setCarouselSlides(convertLegacyDefaultShowcase());
            }
          }
        } else {
          // CMS fetch failed → emergency legacy fallback
          const legacyAmenities = convertLegacyProjectAmenities(projectId);

          if (effectiveHero && legacyAmenities.length > 0) {
            // Hero + legacy amenities
            setCarouselSlides([effectiveHero, ...legacyAmenities]);
          } else if (effectiveHero) {
            // Hero only (no legacy amenities available)
            setCarouselSlides([effectiveHero]);
          } else if (legacyAmenities.length > 0) {
            // Legacy amenities only (no hero)
            setCarouselSlides(legacyAmenities);
          } else {
            // Nothing available → resolved default
            if (resolvedDefaultSlidesRef.current) {
              setCarouselSlides(resolvedDefaultSlidesRef.current);
            } else {
              setCarouselSlides(convertLegacyDefaultShowcase());
            }
          }
        }
      } catch (err) {
        console.error('Error loading project data:', err);
        // Network/unknown error → emergency legacy fallback
        const selectedProject = projects.find(p => p.id === projectId);
        const effectiveHero = selectedProject?.image
          ? {
              imageUrl: selectedProject.image,
              altText: `${selectedProject.title} project image`,
              focalX: 50,
              focalY: 50,
            }
          : null;
        const legacyAmenities = convertLegacyProjectAmenities(projectId);

        if (effectiveHero && legacyAmenities.length > 0) {
          setCarouselSlides([effectiveHero, ...legacyAmenities]);
        } else if (effectiveHero) {
          setCarouselSlides([effectiveHero]);
        } else if (legacyAmenities.length > 0) {
          setCarouselSlides(legacyAmenities);
        } else {
          if (resolvedDefaultSlidesRef.current) {
            setCarouselSlides(resolvedDefaultSlidesRef.current);
          } else {
            setCarouselSlides(convertLegacyDefaultShowcase());
          }
        }
      } finally {
        setLoadingTowers(false);
        setCarouselLoading(false);
      }
    };

    loadData();
  }, [watchProjectId, setValue, projects]);

  // Load unit types when tower changes
  useEffect(() => {
    if (!watchTowerId || !watchProjectId) {
      setUnitTypes([]);
      setValue('unitTypeId', '', { shouldValidate: false });
      return;
    }

    const loadUnitTypes = async () => {
      setLoadingUnitTypes(true);
      try {
        const projectId = parseInt(watchProjectId);
        const towerIdNum = parseInt(watchTowerId);
        const tower = towers.find(t => t.id === towerIdNum);
        if (!tower) {
          setUnitTypes([]);
          return;
        }
        const data = await fetchUnitTypesForTower(projectId, tower.name);
        setUnitTypes(data);
      } catch (err) {
        console.error('Error loading unit types:', err);
      } finally {
        setLoadingUnitTypes(false);
      }
    };

    loadUnitTypes();
  }, [watchTowerId, watchProjectId, towers, setValue]);

  // Get selected project name
  const getSelectedProjectName = (): string | null => {
    if (!watchProjectId) {
      return null;
    }
    const project = projects.find(p => p.id.toString() === watchProjectId);
    return project?.title || null;
  };

  const selectedProjectName = getSelectedProjectName();


  const inputStyles = "h-[50px] w-full min-w-0 rounded-md border border-stone-200 bg-[#FDFBF7] px-4 py-3 text-base md:text-sm text-gray-900 outline-none transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-stone-400 enabled:hover:border-stone-300 enabled:hover:bg-white enabled:focus:border-brand-blue enabled:focus:bg-white focus:ring-2 focus:ring-brand-blue/10 disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-100 disabled:text-stone-500";
  const selectStyles = `${inputStyles} appearance-none cursor-pointer pr-11`;
  const inputErrorStyles = "border-red-300! enabled:hover:border-red-400! focus:border-red-400! focus:ring-red-500/10!";
  const labelStyles = "mb-2 block text-xs font-medium tracking-wide text-stone-600";
  const errorStyles = "mt-1.5 flex items-start gap-1 text-xs leading-4 text-red-600";
  const primaryButtonStyles = "inline-flex h-12 min-w-[11rem] items-center justify-center gap-2 rounded-md border border-transparent bg-brand-blue px-4 text-sm font-medium text-white shadow-[0_2px_8px_rgba(20,47,114,0.08)] transition-[background-color,border-color,box-shadow,filter] duration-200 enabled:hover:border-brand-gold/60 enabled:hover:brightness-95 enabled:hover:shadow-[0_4px_14px_rgba(20,47,114,0.14)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue disabled:cursor-not-allowed disabled:bg-gray-400 disabled:shadow-none";

  // Step-specific field validation
  const step1Fields = ['firstName', 'lastName', 'email', 'contactNumber'] as const;
  const step2Fields = ['projectId', 'towerId', 'unitTypeId', 'unitNumber'] as const;
  const step3Fields = ['paymentPurpose', 'amount'] as const;

  const validateAndMoveNext = async () => {
    let fieldsToValidate: readonly string[] = [];

    if (currentStep === 1) {
      fieldsToValidate = step1Fields;
    } else if (currentStep === 2) {
      fieldsToValidate = step2Fields;
    } else if (currentStep === 3) {
      fieldsToValidate = step3Fields;
    }

    const isValid = await trigger(fieldsToValidate as any);
    if (isValid) {
      setCompletedSteps([...new Set([...completedSteps, currentStep])]);
      setCurrentStep(currentStep + 1);
      setCaptchaToken(null); // Clear token when leaving review
      setCaptchaError('');
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setCaptchaToken(null);
      setCaptchaError('');
    }
  };

  const goToStep = (step: number) => {
    if (step < currentStep || completedSteps.includes(step)) {
      setCurrentStep(step);
      setCaptchaToken(null);
      setCaptchaError('');
    }
  };

  const onSubmit = async (data: PaymentFormData) => {
    // Check CAPTCHA on final submission
    if (!captchaToken) {
      setCaptchaError('Please complete the verification.');
      return;
    }

    try {
      setServerError('');
      console.log('[PAYMENT] Submitting payment with CAPTCHA token');

      const result = await submitPaymentAction(data, captchaToken);

      if (result?.error) {
        console.log(`[PAYMENT] Server returned error: ${result.error}`);
        setServerError(result.error);

        // Reset CAPTCHA widget for retry
        if (turnstileWidgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.reset(turnstileWidgetIdRef.current);
          } catch (e) {
            console.error('[CAPTCHA] Failed to reset widget:', e);
          }
        }
        setCaptchaToken(null);
      } else if (result?.success) {
        console.log('[PAYMENT] Payment successful');
        alert('Payment processed successfully!');
      } else {
        setServerError('Unexpected response from server.');
        if (turnstileWidgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.reset(turnstileWidgetIdRef.current);
          } catch (e) {
            console.error('[CAPTCHA] Failed to reset widget:', e);
          }
        }
        setCaptchaToken(null);
      }
    } catch (error) {
      console.error('[PAYMENT] Submission error:', error);
      setServerError('An error occurred. Please try again.');
      if (turnstileWidgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(turnstileWidgetIdRef.current);
        } catch (e) {
          console.error('[CAPTCHA] Failed to reset widget:', e);
        }
      }
      setCaptchaToken(null);
    }
  };

  // CAPTCHA callbacks
  const handleCaptchaSuccess = useCallback((token: string) => {
    setCaptchaToken(token);
    setCaptchaError('');
    setServerError('');
  }, []);

  const handleCaptchaExpire = useCallback(() => {
    setCaptchaToken(null);
    setCaptchaError('');
  }, []);

  const handleCaptchaError = useCallback((errorCode: string) => {
    setCaptchaToken(null);
    setCaptchaError('Verification failed. Please try again.');
    console.warn(`[CAPTCHA] Error: ${errorCode}`);
  }, []);

  // Readiness is reactive so a script that loads after entering Review still renders.
  useEffect(() => {
    const scriptSrc = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    if (window.turnstile) {
      setTurnstileReady(true);
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${scriptSrc}"]`);
    const script = existingScript ?? document.createElement('script');
    const onLoad = () => setTurnstileReady(true);
    const onError = () => setCaptchaError('Verification could not load. Please refresh and try again.');
    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);

    if (!existingScript) {
      script.src = scriptSrc;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };
  }, []);

  useEffect(() => {
    stepContentRef.current?.scrollTo({ top: 0 });
  }, [currentStep]);

  // Each visit to Review owns a fresh widget and clears it on exit/unmount.
  useEffect(() => {
    if (currentStep !== 4 || !turnstileReady || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return;
    const container = document.getElementById('payment-captcha-container');
    if (!container || !window.turnstile) return;

    const widgetId = window.turnstile.render(container, {
      sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      theme: 'light',
      action: 'payment',
      callback: handleCaptchaSuccess,
      'expired-callback': handleCaptchaExpire,
      'error-callback': handleCaptchaError,
      size: 'normal',
    });
    turnstileWidgetIdRef.current = widgetId;

    return () => {
      try {
        window.turnstile?.remove(widgetId);
      } catch {
        // The provider may already have removed the widget.
      }
      turnstileWidgetIdRef.current = undefined;
      setCaptchaToken(null);
    };
  }, [currentStep, turnstileReady, handleCaptchaSuccess, handleCaptchaExpire, handleCaptchaError]);

  // Step renderer components
  const StepIndicator = () => (
    <nav aria-label="Payment progress" className="pt-10 md:pt-11">
      <ol className="grid grid-cols-4">
        {STEPS.map((step) => {
          const isCompleted = completedSteps.includes(step.id);
          const isActive = currentStep === step.id;

          return (
            <li key={step.id} className="relative flex min-w-0 flex-col items-center gap-3">
              {step.id < STEPS.length && (
                <span aria-hidden="true" className={`absolute left-1/2 top-4 h-0.5 w-full ${
                  currentStep > step.id ? 'bg-brand-gold' : 'bg-stone-200'
                }`} />
              )}
              <button
                type="button"
                aria-label={step.title}
                aria-current={isActive ? 'step' : undefined}
                onClick={() => goToStep(step.id)}
                disabled={!isCompleted && !isActive && step.id > currentStep}
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-[background-color,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue ${
                  isActive
                    ? 'bg-brand-blue text-white ring-2 ring-brand-blue ring-offset-2 ring-offset-[#F9F9F7]'
                    : isCompleted
                    ? 'bg-brand-gold text-white hover:bg-brand-gold/90 hover:ring-2 hover:ring-brand-gold/30 hover:ring-offset-2 hover:ring-offset-[#F9F9F7] cursor-pointer'
                    : 'bg-stone-200 text-stone-500 disabled:cursor-not-allowed'
                }`}
              >
                {isCompleted && !isActive ? <Check size={16} /> : step.id}
              </button>
              <span className={`text-[11px] sm:text-xs text-center ${
                isActive ? 'font-semibold text-brand-blue' : 'text-gray-600'
              }`}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );

  const EditButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-blue underline-offset-4 transition-colors duration-200 hover:text-brand-gold hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue"
    >
      <Edit2 size={14} />
      {label}
    </button>
  );

  // Step 1: Payer Information
  const Step1Content = () => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 @[28rem]:grid-cols-2 gap-7">
          <div className="flex flex-col">
            <label htmlFor="payment-first-name" className={labelStyles}>First Name</label>
            <input
              id="payment-first-name"
              {...register("firstName")}
              className={`${inputStyles} ${errors.firstName ? inputErrorStyles : ''}`}
              placeholder="John"
            />
            {errors.firstName && <span className={errorStyles}><AlertCircle size={12} />{errors.firstName.message}</span>}
          </div>

          <div className="flex flex-col">
            <label htmlFor="payment-last-name" className={labelStyles}>Last Name</label>
            <input
              id="payment-last-name"
              {...register("lastName")}
              className={`${inputStyles} ${errors.lastName ? inputErrorStyles : ''}`}
              placeholder="Doe"
            />
            {errors.lastName && <span className={errorStyles}><AlertCircle size={12} />{errors.lastName.message}</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 @[28rem]:grid-cols-2 gap-7">
          <div className="flex flex-col">
            <label htmlFor="payment-email" className={labelStyles}>Email Address</label>
            <div className="relative">
              <Mail size={16} strokeWidth={1.5} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                id="payment-email"
                {...register("email")}
                type="email"
                className={`${inputStyles} pl-11 ${errors.email ? inputErrorStyles : ''}`}
                placeholder="email@address.com"
              />
            </div>
            {errors.email && <span className={errorStyles}><AlertCircle size={12} />{errors.email.message}</span>}
          </div>

          <div className="flex flex-col">
            <label htmlFor="payment-contact" className={labelStyles}>Contact Number</label>
            <div className="relative">
              <Phone size={16} strokeWidth={1.5} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                id="payment-contact"
                {...register("contactNumber")}
                type="tel"
                inputMode="numeric"
                maxLength={11}
                className={`${inputStyles} pl-11 ${errors.contactNumber ? inputErrorStyles : ''}`}
                placeholder="09XXXXXXXXX"
              />
            </div>
            {errors.contactNumber && <span className={errorStyles}><AlertCircle size={12} />{errors.contactNumber.message}</span>}
          </div>
        </div>
    </div>
  );

  // Step 2: Property Details
  // Note: unitNumber is user-entered and not validated against inventory
  // (inventory source does not yet exist in the project database)
  const Step2Content = () => (
    <div className="space-y-6">
        <div className="flex flex-col">
          <label htmlFor="payment-project" className={labelStyles}>Project Name</label>
          <div className="relative">
            <select
              id="payment-project"
              {...register("projectId")}
              className={`${selectStyles} ${errors.projectId ? inputErrorStyles : ''}`}
              disabled={loadingProjects}
            >
              <option value="">Select Project</option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id.toString()}>
                  {proj.title}
                </option>
              ))}
            </select>
            <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-brand-blue/50" />
          </div>
          {errors.projectId && <span className={errorStyles}><AlertCircle size={12} />{errors.projectId.message}</span>}
        </div>

        <div className="grid grid-cols-1 @[28rem]:grid-cols-2 gap-7">
          <div className="flex flex-col">
            <label htmlFor="payment-tower" className={labelStyles}>Tower</label>
            <div className="relative">
              <select
                id="payment-tower"
                {...register("towerId")}
                className={`${selectStyles} ${errors.towerId ? inputErrorStyles : ''}`}
                disabled={!watchProjectId || loadingTowers}
              >
                <option value="">
                  {!watchProjectId ? 'Select project first' : 'Select Tower'}
                </option>
                {towers.map((tower) => (
                  <option key={tower.id} value={tower.id.toString()}>
                    {tower.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-brand-blue/50" />
            </div>
            {errors.towerId && <span className={errorStyles}><AlertCircle size={12} />{errors.towerId.message}</span>}
          </div>

          <div className="flex flex-col">
            <label htmlFor="payment-unit-type" className={labelStyles}>Unit Type</label>
            <div className="relative">
              <select
                id="payment-unit-type"
                {...register("unitTypeId")}
                className={`${selectStyles} ${errors.unitTypeId ? inputErrorStyles : ''}`}
                disabled={!watchTowerId || loadingUnitTypes}
              >
                <option value="">
                  {!watchTowerId ? 'Select tower first' : 'Select Unit Type'}
                </option>
                {unitTypes.map((unit) => (
                  <option key={unit.id} value={unit.id.toString()}>
                    {unit.title}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-brand-blue/50" />
            </div>
            {errors.unitTypeId && <span className={errorStyles}><AlertCircle size={12} />{errors.unitTypeId.message}</span>}
          </div>
        </div>

        <div className="flex flex-col">
          <label htmlFor="payment-unit-number" className={labelStyles}>Unit Number</label>
          <input
            id="payment-unit-number"
            {...register("unitNumber")}
            type="text"
            inputMode="numeric"
            className={`${inputStyles} ${errors.unitNumber ? inputErrorStyles : ''}`}
            placeholder="e.g. 1008"
          />
          {errors.unitNumber && <span className={errorStyles}><AlertCircle size={12} />{errors.unitNumber.message}</span>}
        </div>
    </div>
  );

  // Step 3: Payment Details
  const Step3Content = () => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 @[28rem]:grid-cols-2 gap-7">
          <div className="flex flex-col">
            <label htmlFor="payment-purpose" className={labelStyles}>Purpose</label>
            <div className="relative">
              <select
                id="payment-purpose"
                {...register("paymentPurpose")}
                className={`${selectStyles} ${errors.paymentPurpose ? inputErrorStyles : ''}`}
              >
                <option value="">Select Purpose</option>
                <option value="Downpayment">Downpayment</option>
                <option value="Monthly Due">Monthly Due</option>
                <option value="Reservation Fee">Reservation Fee</option>
                <option value="CTS Reprinting Fee">CTS Reprinting Fee</option>
              </select>
              <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-brand-blue/50" />
            </div>
            {errors.paymentPurpose && <span className={errorStyles}><AlertCircle size={12} />{errors.paymentPurpose.message}</span>}
          </div>

          <div className="flex flex-col">
            <label htmlFor="payment-amount" className={labelStyles}>Amount</label>
            <div className="relative">
              <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-stone-400">₱</span>
              <input
                id="payment-amount"
                type="number"
                step="0.01"
                {...register("amount")}
                className={`${inputStyles} pl-10 ${errors.amount ? inputErrorStyles : ''}`}
                placeholder="0.00"
              />
            </div>
            {errors.amount && <span className={errorStyles}><AlertCircle size={12} />{errors.amount.message}</span>}
          </div>
        </div>
    </div>
  );

  // Step 4: Review & Confirm
  const Step4Content = () => {
    const formData = watch();
    const selectedProject = projects.find(p => p.id.toString() === formData.projectId);
    const selectedTower = towers.find(t => t.id.toString() === formData.towerId);
    const selectedUnitType = unitTypes.find(u => u.id.toString() === formData.unitTypeId);
    const summaryCardStyles = "min-w-0 rounded-md border border-stone-200/70 bg-[#FDFBF7] p-4 transition-colors duration-200 hover:border-brand-gold/30";
    const summaryHeaderStyles = "mb-2.5 flex items-center justify-between gap-3 border-b border-stone-200/70 pb-1.5";
    const summaryLabelStyles = "text-xs leading-4 text-stone-500";
    const summaryValueStyles = "mt-0.5 min-w-0 text-[13px] sm:text-sm font-medium leading-[18px] text-gray-900 [overflow-wrap:anywhere]";

    return (
      <div>
        {/* Review Sections */}
        <div className="grid grid-cols-1 @[28rem]:grid-cols-2 gap-5">
          <section aria-label="Payer summary" className={summaryCardStyles}>
            <div className={summaryHeaderStyles}>
              <h3 className="font-semibold text-sm leading-5 text-brand-blue">Payer Information</h3>
              <EditButton onClick={() => goToStep(1)} label="Edit" />
            </div>
            <dl className="grid gap-2.5">
              <div>
                <dt className={summaryLabelStyles}>Name</dt>
                <dd className={summaryValueStyles}>{formData.firstName} {formData.lastName}</dd>
              </div>
              <div>
                <dt className={summaryLabelStyles}>Email</dt>
                <dd className={summaryValueStyles}>{formData.email}</dd>
              </div>
              <div>
                <dt className={summaryLabelStyles}>Contact</dt>
                <dd className={summaryValueStyles}>{formData.contactNumber}</dd>
              </div>
            </dl>
          </section>

          <section aria-label="Payment summary" className={summaryCardStyles}>
            <div className={summaryHeaderStyles}>
              <h3 className="font-semibold text-sm leading-5 text-brand-blue">Payment Details</h3>
              <EditButton onClick={() => goToStep(3)} label="Edit" />
            </div>
            <dl className="grid gap-2.5">
              <div>
                <dt className={summaryLabelStyles}>Purpose</dt>
                <dd className={summaryValueStyles}>{formData.paymentPurpose}</dd>
              </div>
              <div>
                <dt className={summaryLabelStyles}>Amount</dt>
                <dd className={summaryValueStyles}><strong className="font-semibold text-brand-blue">₱{parseFloat(formData.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></dd>
              </div>
            </dl>
          </section>

          <section aria-label="Property summary" className={`${summaryCardStyles} @[28rem]:col-span-2`}>
            <div className={summaryHeaderStyles}>
              <h3 className="font-semibold text-sm leading-5 text-brand-blue">Property Details</h3>
              <EditButton onClick={() => goToStep(2)} label="Edit" />
            </div>
            <dl className="grid grid-cols-1 @[28rem]:grid-cols-2 gap-x-6 gap-y-2.5 text-[13px] sm:text-sm leading-[18px] [&>div]:grid [&>div]:grid-cols-[5rem_minmax(0,1fr)] [&>div]:gap-x-3 [&_dt]:text-xs [&_dt]:text-stone-500 [&_dd]:min-w-0 [&_dd]:font-medium [&_dd]:text-gray-900 [&_dd]:[overflow-wrap:anywhere]">
              <div><dt>Project</dt><dd>{selectedProject?.title}</dd></div>
              <div><dt>Tower</dt><dd>{selectedTower?.name}</dd></div>
              <div><dt>Unit Type</dt><dd>{selectedUnitType?.title}</dd></div>
              <div><dt>Unit Number</dt><dd>{formData.unitNumber}</dd></div>
            </dl>
          </section>
        </div>

        {/* Server Error Alert */}
        {serverError && (
          <div role="alert" className="bg-red-50 p-3 rounded border border-red-200 flex gap-2 mt-6">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-red-700">Payment Error</p>
              <p className="text-red-600">{serverError}</p>
            </div>
          </div>
        )}

        {/* Turnstile Widget */}
        {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? (
          <div className="mt-6 flex flex-col items-center">
            <div className="flex justify-center w-full">
              <div id="payment-captcha-container" className="min-h-[65px]" />
            </div>
            {captchaError && (
              <p role="alert" className="text-xs text-red-600 flex items-center gap-1 mt-2">
                <AlertCircle size={12} />
                {captchaError}
              </p>
            )}
          </div>
        ) : (
          <div className="bg-yellow-50 p-3 rounded border border-yellow-200 mt-6">
            <p className="text-xs text-yellow-800">
              ⚠️ Payment verification not configured. Add <code className="font-mono text-[10px]">NEXT_PUBLIC_TURNSTILE_SITE_KEY</code> to .env.local
            </p>
          </div>
        )}

        {/* Terms */}
        <div className="mt-5">
          <p className="mx-auto max-w-md text-[11px] leading-[18px] text-stone-500 text-center">
            By providing this information, I agree to the Golden Topper <a href="/buyers-guide" className="text-brand-blue underline decoration-brand-gold/60 underline-offset-2 transition-colors duration-200 hover:text-brand-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue">Reservation Guidelines</a>, <a href="/privacy-policy" className="text-brand-blue underline decoration-brand-gold/60 underline-offset-2 transition-colors duration-200 hover:text-brand-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue">Privacy Policy</a>, and <a href="/terms-of-use" className="text-brand-blue underline decoration-brand-gold/60 underline-offset-2 transition-colors duration-200 hover:text-brand-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue">Terms of Service</a>.
          </p>
        </div>

      </div>
    );
  };

  return (
    <PageTransition>
      <div className="flex min-h-[100dvh] flex-col md:h-[100dvh] md:overflow-hidden font-sans bg-[#F9F9F7] selection:bg-brand-gold selection:text-white">

        <Navbar />

        <main className="relative flex min-h-0 flex-1 flex-col md:flex-row">

          {/* LEFT SIDE - Contextual property carousel */}
          <PaymentCarousel
            key={watchProjectId || 'showcase'}
            images={carouselSlides}
            projectName={selectedProjectName}
          />

          {/* RIGHT SIDE - Wizard Form */}
          <div
            ref={currentStep === 4 ? stepContentRef : undefined}
            className={`relative z-10 mt-[var(--payment-navbar-height)] w-full bg-[#F9F9F7] px-2 min-[360px]:px-6 pb-7 md:h-[calc(100dvh-var(--payment-navbar-height))] md:w-1/2 lg:px-8 xl:px-10 ${currentStep === 4 ? 'md:overflow-y-auto md:[overflow-anchor:none]' : ''}`}
            style={{ '--payment-navbar-height': NAVBAR_HEIGHT } as React.CSSProperties}
          >
            <form
              onSubmit={currentStep === 4 ? handleSubmit(onSubmit) : (event) => { event.preventDefault(); void validateAndMoveNext(); }}
              className={`@container mx-auto grid min-h-[calc(100dvh-var(--payment-navbar-height)-1.75rem)] w-full max-w-[640px] grid-rows-[auto_1fr_auto] ${currentStep === 4 ? 'md:grid-rows-[auto_minmax(min-content,1fr)_auto]' : 'md:h-full md:min-h-0 md:grid-rows-[auto_minmax(0,1fr)_auto]'}`}
            >
              {StepIndicator()}

              <div ref={currentStep === 4 ? undefined : stepContentRef} className={`min-h-0 pt-10 pb-5 ${currentStep === 4 ? '' : 'md:overflow-y-auto md:[scrollbar-gutter:stable] [scrollbar-width:thin]'}`}>
                <h2 className="mb-6 border-l-2 border-brand-gold pl-3 text-2xl font-semibold leading-8 tracking-tight text-brand-blue">{STEPS[currentStep - 1].title}</h2>
                {/* Render helpers directly so state updates preserve inputs and the CAPTCHA DOM. */}
                {currentStep === 1 && Step1Content()}
                {currentStep === 2 && Step2Content()}
                {currentStep === 3 && Step3Content()}
                {currentStep === 4 && Step4Content()}
              </div>

              <footer className="flex items-center justify-between gap-3 border-t border-stone-200 pt-4">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex h-12 min-w-20 sm:min-w-24 items-center justify-center gap-2 rounded-md border border-stone-300 px-4 text-sm font-medium text-brand-blue transition-[background-color,border-color] duration-200 hover:border-brand-gold/70 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue"
                  >
                    <ChevronLeft size={16} aria-hidden="true" /> Back
                  </button>
                ) : <span aria-hidden="true" className="h-12 min-w-20 sm:min-w-24" />}

                {currentStep === 4 ? (
                  <button
                    type="submit"
                    disabled={isSubmitting || !captchaToken || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                    className={primaryButtonStyles}
                  >
                    {isSubmitting ? 'Processing...' : 'Pay Now'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={validateAndMoveNext}
                    className={primaryButtonStyles}
                  >
                    {currentStep === 3 ? 'Review Payment' : 'Continue'}
                    <ChevronRight size={16} aria-hidden="true" className="text-brand-gold" />
                  </button>
                )}
              </footer>
            </form>
          </div>
        </main>

      </div>
    </PageTransition>
  );
}
