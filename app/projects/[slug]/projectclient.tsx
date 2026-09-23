'use client';

import Navbar from "@/app/components/navbar";
import Image from "next/image";
import { Layers, Target, Key, MapPin, ArrowRight, ChevronLeft, ChevronRight, Move3d, X, ChevronDown } from 'lucide-react';
import Footer from '@/app/components/footer';
import { useEffect, useRef, useState, useMemo, Suspense } from 'react';
import { useRouter,useSearchParams } from 'next/navigation'; 
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import BackToTop from "@/app/components/backtotop";
import { motion } from 'framer-motion';
import dynamic from "next/dynamic";
import Link from 'next/link';
import PageTransition from '@/app/components/page-transitions';


interface Amenity {
  id: number;
  project_id: number;
  title: string;
  description: string;
  thumbnail: string;
  tower?: string | null;
}

interface UnitLayout {
  id: number;
  project_id: number;
  tower_name?: string | null;
  bg_color?: string | null;
  title: string;
  description: string;
  thumbnail: string;
  min_sqm: number | null;
  max_sqm: number | null;
  sort_order?: number | null;
}

interface ProjectTower {
  id: number;
  project_id: number;
  name: string;
  sort_order?: number | null;
}

interface ExtendedDescription {
  id: number;
  project_id: number;
  editorial_title: string;
  editorial_long: string;
  editorial_img: string;
  editorial_title_color?: string;
  editorial_desc_color?: string;
  editorial_bg_color?: string;
  amenities_title?: string;
  amenities_title_gold?: string;
  map_subtitle?: string; 
}

interface ProjectTag {
  tags: {
    tag_name: string;
  };
}

interface Project {
  id: number;
  title: string;
  slug: string;
  image: string;
  city: string;
  country: string;
  sqm: string;
  status: string; 
  unit_total: string;
  img_awards: string;
  amenities: Amenity[];
  unit_layout: UnitLayout[];
  extended_description: ExtendedDescription[];
  project_tag: ProjectTag[];
  project_towers?: ProjectTower[];
  virtual_tours?: any[];
}

const DynamicVirtualTour = dynamic(() => import('@/app/components/VirtualTour'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d1b3e]">
      <Move3d size={40} className="text-brand-gold animate-bounce mb-4" />
      <p className="text-brand-gold animate-pulse tracking-widest text-sm font-bold uppercase">Loading 360° Engine...</p>
    </div>
  ),
});

function parseViewAreas(tour: any): any[] {
  if (!tour) return [];
  let raw = tour.view_areas || tour.rooms;
  if (!raw) return [];
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { raw = []; }
  }
  return Array.isArray(raw) ? raw : [];
}

const UnifiedProjectMap = dynamic(() => import('@/app/components/unifiedprojectmap'), { 
  ssr: false 
});


function ModernMapSection({ projectSlug, subtitle }: { projectSlug: string; subtitle?: string }) {
  return (
    <section className="relative py-20 md:py-24 bg-[#0A1128] overflow-hidden flex items-center min-h-[720px] lg:min-h-[900px]">
      <div className="max-w-[90rem] mx-auto px-6 md:px-12 relative z-20 flex flex-col items-center w-full">
        <motion.div className="mb-12 text-center" initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.2 } } }}>
          <motion.h2 variants={{ hidden: { opacity: 0, y: 40, filter: "blur(10px)" }, visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 1.2, ease: [0.22, 1, 0.36, 1] } } }} className="text-5xl md:text-6xl lg:text-7xl font-serif font-light leading-tight mb-4 text-white">
            Points of <motion.span className="text-brand-gold">Interest</motion.span>
          </motion.h2>
          <motion.p 
          variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } } }} 
          className="text-center font-light leading-relaxed text-white/70 text-base md:text-lg max-w-2xl lg:max-w-3xl mx-auto"
        >
          {subtitle || "Everything you need, strategically positioned right around your sanctuary."}
        </motion.p>
        </motion.div>
        <div className="w-full p-2 md:p-4 rounded-sm bg-white/5 border border-white/10 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
         <UnifiedProjectMap projectSlug={projectSlug} />
        </div>
      </div>
    </section>
  );
}
if (typeof window !== 'undefined') {    
  gsap.registerPlugin(ScrollTrigger);
}

function formatTowerName(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const legacyMatch = trimmed.match(/^tower\s+(\d+)$/i);
  if (legacyMatch) {
    const num = parseInt(legacyMatch[1], 10);
    const letter = String.fromCharCode(64 + num);
    return `Tower ${letter}`;
  }
  return trimmed;
}

function DynamicProjectContent({ 
  initialProjectData, 
  currentSlug,
  allProjects = []
}: { 
  initialProjectData: Project; 
  currentSlug: string;
  allProjects?: Array<{ id: number; title: string; slug: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams(); 
  const blueprintIdParam = searchParams.get('blueprint');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<any>(null);

  // Amenities carousel drag state
  const isDragging = useRef(false);
  const startX = useRef(0);
  const targetScroll = useRef(0);
  const currentScroll = useRef(0);
  const rafId = useRef<number | null>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);

  // Keep public-facing tower controls in the same sequence configured in the CMS.
  const availableTowers = useMemo<string[]>(() => {
    const amenityTowerNames = Array.from(
      new Set(
        (initialProjectData.amenities ?? [])
          .map((item) => item.tower?.trim())
          .filter((tower): tower is string => Boolean(tower))
      )
    );

    if (amenityTowerNames.length === 0) {
      return [];
    }

    const amenityTowerKeys = new Set(
      amenityTowerNames.map((tower) => tower.toLowerCase())
    );

    const registered = [...(initialProjectData.project_towers ?? [])]
      .sort(
        (a, b) =>
          (a.sort_order ?? Number.MAX_SAFE_INTEGER) -
            (b.sort_order ?? Number.MAX_SAFE_INTEGER) ||
          a.id - b.id
      )
      .map((tower) => tower.name.trim())
      .filter(
        (tower) => tower && amenityTowerKeys.has(tower.toLowerCase())
      );

    const registeredKeys = new Set(
      registered.map((tower) => tower.toLowerCase())
    );

    const legacyOrUnregistered = amenityTowerNames
      .filter((tower) => !registeredKeys.has(tower.toLowerCase()))
      .sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
      );

    return [...registered, ...legacyOrUnregistered];
  }, [initialProjectData.amenities, initialProjectData.project_towers]);

  const [selectedTower, setSelectedTower] = useState<string | null>(
    () => availableTowers[0] ?? null
  );

  

  useEffect(() => {
    if (availableTowers.length === 0) {
      setSelectedTower(null);
      return;
    }
    if (selectedTower && availableTowers.includes(selectedTower)) {
      return;
    }
    setSelectedTower(availableTowers[0]);
  }, [availableTowers, selectedTower]);

  const filteredAmenities = useMemo(() => {
    const amenities = initialProjectData.amenities ?? [];
    const sortByTitle = (items: Amenity[]) =>
      [...items].sort((a, b) =>
        a.title.trim().localeCompare(b.title.trim(), undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      );

    if (!selectedTower) {
      return sortByTitle(amenities);
    }

    return sortByTitle(
      amenities.filter(
        (item) => !item.tower || item.tower.trim().toLowerCase() === selectedTower.toLowerCase()
      )
    );
  }, [initialProjectData.amenities, selectedTower]);

  
  // Smooth carousel interpolation loop
  useEffect(() => {
    const smoothDrag = () => {
      if (scrollContainerRef.current) {
        // Interpolate between current scroll and the target scroll destination
        currentScroll.current += (targetScroll.current - currentScroll.current) * 0.08;
        scrollContainerRef.current.scrollLeft = currentScroll.current;
      }
      rafId.current = requestAnimationFrame(smoothDrag);
    };
    
    rafId.current = requestAnimationFrame(smoothDrag);
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  // Reset the carousel whenever the selected tower changes.
  useEffect(() => {
    targetScroll.current = 0;
    currentScroll.current = 0;

    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, [selectedTower]);

  // Preserve deep links to a specific blueprint.
  useEffect(() => {
    window.history.scrollRestoration = 'manual';
    if (!blueprintIdParam) window.scrollTo(0, 0);

    if (initialProjectData && initialProjectData.unit_layout?.length > 0) {
      if (blueprintIdParam) {
        const scrollTimer = setTimeout(() => {
          if (lenisRef.current) {
            lenisRef.current.scrollTo(`#blueprint-${blueprintIdParam}`, { offset: -80, duration: 1.5 });
          } else {
            const element = document.getElementById(`blueprint-${blueprintIdParam}`);
            if (element) {
              const y = element.getBoundingClientRect().top + window.scrollY - 80;
              window.scrollTo({ top: y, behavior: 'smooth' });
            }
          }
        }, 600);
        return () => clearTimeout(scrollTimer); 
      } else {
        if (lenisRef.current) lenisRef.current.scrollTo(0, { immediate: true });
      }
    }
  }, [blueprintIdParam, initialProjectData]); 

  // Page scrolling and blueprint stack animations.
  useEffect(() => {
    if (!initialProjectData) return;

    const lenis = new Lenis({
      duration: 1.8,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenisRef.current = lenis;
    if (!blueprintIdParam) lenis.scrollTo(0, { immediate: true });

    lenis.on('scroll', ScrollTrigger.update);

    const updateLenis = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(updateLenis);

    const ctx = gsap.context(() => {
      const towerGroups = gsap.utils.toArray('.tower-group');

      towerGroups.forEach((group: any) => {
        const cards = group.querySelectorAll('.blueprint-card');

        cards.forEach((card: any, index: number) => {
          if (index === cards.length - 1) return;

          gsap.to(card, {
            scale: 0.92,
            opacity: 0.4,
            filter: 'blur(4px)',
            scrollTrigger: {
              trigger: cards[index + 1] as HTMLElement,
              start: 'top 85%',
              end: 'top 20%',
              scrub: true,
            },
          });
        });
      });
    });

    return () => {
      gsap.ticker.remove(updateLenis);
      lenis.destroy();
      lenisRef.current = null;
      ctx.revert();
    };
  }, [initialProjectData, blueprintIdParam]); 

  // Amenities carousel interactions
  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!scrollContainerRef.current) return;
    isDragging.current = true;
    setIsGrabbing(true);
    
    const pageX = 'touches' in e ? e.touches[0].pageX : e.pageX;
    startX.current = pageX;
    
    // Sync current values so the container doesn't jump if clicked mid-glide
    targetScroll.current = scrollContainerRef.current.scrollLeft;
    currentScroll.current = scrollContainerRef.current.scrollLeft;
  };

  const onDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current || !scrollContainerRef.current) return;
    
    const pageX = 'touches' in e ? e.touches[0].pageX : e.pageX;
    const delta = (startX.current - pageX) * 2; // 2x speed multiplier
    
    targetScroll.current += delta;
    startX.current = pageX; // Reset start for continuous delta
    
    // Clamp the target so we can't drag it out of bounds
    const maxScroll = scrollContainerRef.current.scrollWidth - scrollContainerRef.current.clientWidth;
    targetScroll.current = Math.max(0, Math.min(targetScroll.current, maxScroll));
  };

  const onDragEnd = () => {
    isDragging.current = false;
    setIsGrabbing(false);
  };

  const scrollPrev = () => {
    if (!scrollContainerRef.current) return;
    const step = scrollContainerRef.current.clientWidth * 0.75; // Skips 75% of the visible container
    targetScroll.current = Math.max(0, targetScroll.current - step);
  };

  const scrollNext = () => {
    if (!scrollContainerRef.current) return;
    const step = scrollContainerRef.current.clientWidth * 0.75;
    const maxScroll = scrollContainerRef.current.scrollWidth - scrollContainerRef.current.clientWidth;
    targetScroll.current = Math.min(maxScroll, targetScroll.current + step);
  };

  const dbTags = initialProjectData.project_tag?.map((pt) => ({
    label: pt.tags?.tag_name || '', icon: <Layers size={16} /> 
  })).filter(tag => tag.label !== '') || [];

  const displayTags = [
    ...dbTags,
    { label: initialProjectData.sqm, icon: <Target size={16} /> },
    { label: initialProjectData.unit_total, icon: <Key size={16} /> },
  ].filter(tag => tag.label);

  const layoutGroups = useMemo(() => {
    const layouts = Array.isArray(initialProjectData.unit_layout)
      ? initialProjectData.unit_layout
      : [];

    if (layouts.length === 0) {
      return [] as Array<{ towerName: string; plans: UnitLayout[] }>;
    }

    const cleanName = (value?: string | null) =>
      String(value || '')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();

    const registeredTowers = [...(initialProjectData.project_towers ?? [])]
      .sort(
        (a, b) =>
          (a.sort_order ?? Number.MAX_SAFE_INTEGER) -
            (b.sort_order ?? Number.MAX_SAFE_INTEGER) ||
          a.id - b.id
      )
      .map((tower) => ({
        name: cleanName(tower.name),
        key: cleanName(tower.name).toLowerCase(),
      }))
      .filter((tower) => Boolean(tower.name));

    const towerNameByKey = new Map(
      registeredTowers.map((tower) => [tower.key, tower.name])
    );

    const towerOrderByKey = new Map(
      registeredTowers.map((tower, index) => [tower.key, index])
    );

    const defaultTower = registeredTowers[0]?.name || 'Tower A - Residential';
    const groups = new Map<string, { towerName: string; plans: UnitLayout[] }>();

    for (const layout of layouts) {
      const rawTower = cleanName(layout.tower_name) || defaultTower;
      const key = rawTower.toLowerCase();
      const canonicalTowerName = towerNameByKey.get(key) || rawTower;
      const canonicalKey = canonicalTowerName.toLowerCase();

      if (!groups.has(canonicalKey)) {
        groups.set(canonicalKey, {
          towerName: canonicalTowerName,
          plans: [],
        });
      }

      groups.get(canonicalKey)!.plans.push(layout);
    }

    const comparePlans = (a: UnitLayout, b: UnitLayout) =>
      (a.sort_order ?? Number.MAX_SAFE_INTEGER) -
        (b.sort_order ?? Number.MAX_SAFE_INTEGER) ||
      a.id - b.id ||
      a.title.localeCompare(b.title, undefined, {
        numeric: true,
        sensitivity: 'base',
      });

    return Array.from(groups.entries())
      .map(([key, group]) => ({
        key,
        towerName: group.towerName,
        plans: [...group.plans].sort(comparePlans),
      }))
      .sort((a, b) => {
        const aOrder = towerOrderByKey.get(a.key);
        const bOrder = towerOrderByKey.get(b.key);

        if (aOrder !== undefined || bOrder !== undefined) {
          return (aOrder ?? Number.MAX_SAFE_INTEGER) -
            (bOrder ?? Number.MAX_SAFE_INTEGER);
        }

        return a.towerName.localeCompare(b.towerName, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      })
      .map(({ towerName, plans }) => ({ towerName, plans }));
  }, [initialProjectData.project_towers, initialProjectData.unit_layout]);

  const formatSqmRange = (plan: UnitLayout) => {
    const min = Number(plan.min_sqm);
    const max = Number(plan.max_sqm);

    if (!Number.isFinite(min) || min <= 0) {
      return 'Floor area available on request';
    }

    if (!Number.isFinite(max) || max <= 0 || min === max) {
      return `± ${min} SQM`;
    }

    return `± ${min} - ${max} SQM`;
  };

  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [activeTourTower, setActiveTourTower] = useState<string | null>(null);
  const [activeTourUnit, setActiveTourUnit] = useState<any | null>(null);
  const [activeRoomIndex, setActiveRoomIndex] = useState(0);
  const [isTowerDropdownOpen, setIsTowerDropdownOpen] = useState(false);
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const [maxVisible, setMaxVisible] = useState(6);

  useEffect(() => {
    const handleResize = () => setMaxVisible(window.innerWidth < 768 ? 3 : 6);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isTourOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isTourOpen]);

 // 1. Filter active 4-tier virtual tours
  const validTours = useMemo(() => {
    const rawTours = initialProjectData.virtual_tours || [];
    return rawTours.filter((tour: any) => {
      const areas = parseViewAreas(tour);
      const isActive = !tour.status || tour.status.toLowerCase() === 'active';
      return isActive && (areas.length > 0 || Boolean(tour.image || tour.tour_url || tour.url));
    });
  }, [initialProjectData.virtual_tours]);

  // 2. Check for either modern 4-tier tours OR legacy tour link (matches /projects behavior)
  const legacyTourUrl = (initialProjectData as any).virtual_tour_url || (initialProjectData.virtual_tours?.[0] as any)?.tour_url;
  const hasVirtualTour = validTours.length > 0 || Boolean(legacyTourUrl);

  const handleOpenTour = () => {
    if (!hasVirtualTour) return;

    if (validTours.length > 0) {
      const uniqueTowers = Array.from(
        new Set(validTours.map((t: any) => t.tower_name?.trim()).filter(Boolean))
      ).sort((a: any, b: any) => a.localeCompare(b, undefined, { numeric: true }));

      const initialTower = (uniqueTowers[0] as string) || (initialProjectData.project_towers?.[0]?.name) || 'Tower A';
      setActiveTourTower(initialTower);

      const initialUnits = initialTower
        ? validTours.filter((t: any) => !t.tower_name || t.tower_name.trim().toLowerCase() === initialTower.toLowerCase())
        : validTours;

      const targetUnit = initialUnits[0] || validTours[0];
      
      // Auto-populate view area if it was flat
      const areas = parseViewAreas(targetUnit);
      if (areas.length === 0 && (targetUnit.image || targetUnit.url)) {
        targetUnit.view_areas = [{ title: 'Main Area', image: targetUnit.image || targetUnit.url }];
      }

      setActiveTourUnit(targetUnit);
    } else if (legacyTourUrl) {
      // Direct fallback matching Projects page
      setActiveTourTower('Tower A');
      setActiveTourUnit({
        id: 'legacy-unit',
        unit_name: 'Main View',
        title: 'Virtual Tour',
        view_areas: [{ title: 'Main Perspective', image: legacyTourUrl }]
      });
    }

    setActiveRoomIndex(0);
    setIsTourOpen(true);
  };

  return (
    <PageTransition> 
      <Navbar />
      <main>
        {/* --- HERO SECTION --- */}
        <section className="relative h-screen w-full overflow-hidden">
          <motion.div
            initial={{ scale: 1.15 }} animate={{ scale: 1 }} transition={{ duration: 3, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            <Image 
              src={initialProjectData.image || "/images/placeholder.webp"} alt={initialProjectData.title}
              fill sizes="100vw" priority className="object-cover"
            />
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} transition={{ duration: 2, delay: 0.5 }} className="absolute inset-0 bg-black" />

          <motion.div 
            initial="hidden" animate="visible"
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.3, delayChildren: 1 } } }}
            className="absolute inset-0 flex flex-col justify-end px-6 pb-16 md:px-12 md:pb-24 max-w-[90rem] mx-auto w-full"
          >
            <div className="flex flex-col md:flex-row justify-between items-end w-full">
              <div className="flex flex-col w-full md:w-auto">
                <motion.h1 
                  variants={{ hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
                  className="text-5xl md:text-8xl font-serif mb-5 drop-shadow-2xl py-2"
                >
                  <motion.span 
                    initial={{ backgroundPosition: "200% center" }} animate={{ backgroundPosition: "-200% center" }} transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                    className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-brand-gold via-[#fff2cd] to-brand-gold bg-[length:200%_auto] pr-4 pb-2 pt-1 overflow-visible"
                  >
                    {initialProjectData.title}
                  </motion.span>
                </motion.h1>

                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} className="flex items-center gap-2 mb-10 text-white/80">
                  <span className="text-brand-gold"><MapPin size={18} /></span>
                  <span className="text-xs md:text-sm font-bold uppercase tracking-[0.3em]">{initialProjectData.city}, {initialProjectData.country}</span>
                </motion.div>
              </div>

              {initialProjectData.img_awards && (
                <motion.div variants={{ hidden: { opacity: 0, x: 50 }, visible: { opacity: 1, x: 0 } }} transition={{ duration: 1.5, delay: 1.5, ease: [0.22, 1, 0.36, 1] }} className="hidden lg:block mb-10">
                  <Image 
                    src={initialProjectData.img_awards} alt="Project Award" width={350} height={120} loading="eager" priority
                    style={{ width: '100%', height: 'auto', maxWidth: '350px' }} className="object-contain drop-shadow-2xl"
                  />
                </motion.div>
              )}
            </div>

            <motion.div variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col gap-8">
              <div className="flex flex-wrap gap-4">
                {displayTags.map((tag, index) => (
                  <motion.span 
                    key={index} initial={{ backgroundColor: "rgba(0,0,0,0.3)" }} whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.2)" }}
                    className="flex items-center gap-3 px-6 py-3 rounded-sm border border-white/30 backdrop-blur-xl text-white text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] shadow-2xl cursor-default transition-colors"
                  >
                    <span className="text-brand-gold">{tag.icon}</span>{tag.label}
                  </motion.span>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full sm:w-auto">
                <Link href="/inquire" className="group relative flex items-center justify-center gap-6 w-full sm:w-auto bg-brand-blue px-8 py-4 overflow-hidden rounded-sm shadow-lg cursor-pointer outline-none">
                  <span className="absolute inset-0 w-full h-full bg-brand-gold transform -translate-x-full transition-transform duration-[0.6s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0"></span>
                  <span className="relative z-10 text-[11px] tracking-[0.25em] font-bold text-white uppercase transition-colors duration-500">Inquire Now</span>
                  <div className="relative z-10 overflow-hidden w-5 h-5 flex items-center justify-center shrink-0">
                    <ArrowRight size={16} className="absolute text-white transform translate-x-0 transition-transform duration-[0.6s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-[150%]" />
                    <ArrowRight size={16} className="absolute text-white transform -translate-x-[150%] transition-transform duration-[0.6s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0" />
                  </div>
                </Link>

              {hasVirtualTour ? (
                  <button
                    type="button"
                    onClick={handleOpenTour}
                    className="group relative flex items-center justify-center gap-3 w-full sm:w-auto bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/30 hover:border-brand-gold px-8 py-4 overflow-hidden rounded-sm shadow-lg cursor-pointer outline-none transition-all duration-300"
                  >
                    <Move3d size={16} className="text-brand-gold transition-transform duration-300 group-hover:scale-110" />
                    <span className="text-[11px] tracking-[0.25em] font-bold text-white uppercase group-hover:text-brand-gold transition-colors duration-300">
                      Virtual Tour
                    </span>
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-2.5 px-6 py-4 rounded-sm border border-white/15 bg-black/30 backdrop-blur-md cursor-default text-white/50">
                    <Move3d size={16} className="text-white/40" />
                    <span className="text-[11px] tracking-[0.25em] font-bold uppercase text-white/50">
                      Coming Soon
                    </span>
                  </div>
                )}
              </div>

            </motion.div>
          </motion.div>
        </section>

        {/* --- EDITORIAL SECTION --- */}
        {Array.isArray(initialProjectData?.extended_description) && initialProjectData.extended_description.length > 0 && (
  <section 
    className="relative min-h-screen py-24 flex items-center"
    style={{ 
      background: `linear-gradient(to bottom, #ffffff 0%, #ffffff 65%, ${
        initialProjectData.extended_description[0].editorial_bg_color && initialProjectData.extended_description[0].editorial_bg_color !== 'transparent'
          ? initialProjectData.extended_description[0].editorial_bg_color
          : '#ffffff'
      } 100%)` 
    }}
  >
    <div className="max-w-[90rem] mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <motion.div 
                initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
                className="relative h-[600px] w-full rounded-sm overflow-hidden shadow-2xl"
              >
                <Image 
                  src={initialProjectData.extended_description[0].editorial_img || '/images/placeholder.webp'} 
                  alt={initialProjectData.extended_description[0].editorial_title || 'Project Detail'} 
                  fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover"
                />
              </motion.div>

              <div className="flex flex-col gap-8 items-start">
                <motion.h2 
                  initial={{ opacity: 0, y: 30 }} 
                  whileInView={{ opacity: 1, y: 0 }} 
                  transition={{ duration: 0.45, delay: 0.2 }}
                  className="font-serif font-medium text-3xl sm:text-4xl lg:text-[40px] xl:text-[48px] leading-[1.18]"
                  style={{ color: initialProjectData.extended_description[0].editorial_title_color || '#132243' }}
                >
                  {(initialProjectData.extended_description[0].editorial_title || '').split('\n').map((line, idx) => (
                    <span key={idx} className="block whitespace-nowrap">
                      {line}
                    </span>
                  ))}
                </motion.h2>
                
                <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.4 }} className="space-y-6">
                  <p 
                    className="text-lg leading-relaxed text-justify whitespace-pre-line"
                    style={{ color: initialProjectData.extended_description[0].editorial_desc_color || '#4B5563' }}
                  >
                    {initialProjectData.extended_description[0].editorial_long}
                  </p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.6 }}>
                  <Link href={'/inquire'} className="group relative flex items-center justify-center gap-6 w-full sm:w-auto bg-brand-blue px-8 py-4 overflow-hidden rounded-sm shadow-md cursor-pointer outline-none mt-4">
                    <span className="absolute inset-0 w-full h-full bg-brand-gold transform -translate-x-full transition-transform duration-[0.6s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0"></span>
                    <span className="relative z-10 text-[11px] tracking-[0.25em] font-bold text-white uppercase transition-colors duration-500">Inquire Now</span>
                    <div className="relative z-10 overflow-hidden w-5 h-5 flex items-center justify-center shrink-0">
                      <ArrowRight size={16} className="absolute text-white transform translate-x-0 transition-transform duration-[0.6s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-[150%]" />
                      <ArrowRight size={16} className="absolute text-white transform -translate-x-[150%] transition-transform duration-[0.6s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0" />
                    </div>
                  </Link>
                </motion.div>
              </div>
            </div>
          </section>
        )}

        
        {/* --- AMENITIES DRAGGABLE CAROUSEL SECTION --- */}

{initialProjectData.amenities?.length > 0 && (
  <section className="relative w-full bg-[#132243] flex flex-col justify-center py-24 md:py-32 overflow-hidden group/amenities">

    {/* SECTION HEADER */}
    <div className="max-w-[90rem] px-6 md:px-12 w-full mx-auto mb-8 md:mb-10 shrink-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 w-full text-white">

        <div>
          <div className="text-xs tracking-[0.25em] uppercase text-brand-gold font-bold mb-2 md:mb-4 flex items-center gap-3">
            Amenities &amp; Facilities
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif leading-tight">
            <span className="inline-block whitespace-nowrap">
              {initialProjectData.extended_description?.[0]
                ?.amenities_title || 'Experience A Fresh'}
            </span>

            <br />

            <span className="text-brand-gold">
              {initialProjectData.extended_description?.[0]
                ?.amenities_title_gold ||
                `Way Of Living in ${initialProjectData.title}.`}
            </span>
          </h2>
        </div>

        <p className="text-white/70 font-light leading-relaxed max-w-sm text-justify md:text-right text-sm md:text-base hidden sm:block">
          Swipe, drag, or use the arrows to explore our expansive leisure
          amenities designed for your wellness.
        </p>

      </div>
    </div>


    {/* TOWER FILTER: only shown when more than one tower has amenities */}
    {availableTowers.length > 1 && (
      <div className="max-w-[90rem] px-6 md:px-12 w-full mx-auto mb-8 md:mb-10">
        <div className="flex flex-col gap-4">
          <span className="text-[10px] md:text-xs tracking-[0.25em] uppercase text-white/40 font-bold">
            Select Tower
          </span>

          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {availableTowers.map((tower) => {
              const isActive = selectedTower === tower;

              return (
                <button
                  key={tower}
                  type="button"
                  onClick={() => setSelectedTower(tower)}
                  aria-pressed={isActive}
                  className={`
                    px-5 md:px-7 py-3
                    rounded-full
                    border
                    text-xs md:text-sm
                    uppercase
                    tracking-[0.15em]
                    transition-all
                    duration-300
                    ${
                      isActive
                        ? 'bg-brand-gold border-brand-gold text-[#132243]'
                        : 'bg-transparent border-white/20 text-white/60 hover:text-white hover:border-brand-gold/70'
                    }
                  `}
                >
                  {formatTowerName(tower)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    )}


    {/* CAROUSEL */}
    <div className="relative w-full">

      {/* PREVIOUS */}
      <button
        type="button"
        onClick={scrollPrev}
        aria-label="Previous Amenities"
        className="absolute left-4 md:left-8 top-[36%] -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-[#132243]/80 hover:bg-brand-gold border border-brand-gold/100 hover:border-[#132243]/100 text-brand-gold hover:text-[#132243] backdrop-blur-xl flex items-center justify-center transition-all duration-300 shadow-[0_8px_30px_rgba(0,0,0,0.5)] cursor-pointer outline-none group active:scale-95"
      >
        <ChevronLeft
          size={24}
          strokeWidth={2.5}
          className="transition-transform duration-300 group-hover:-translate-x-0.5"
        />
      </button>


      {/* NEXT */}
      <button
        type="button"
        onClick={scrollNext}
        aria-label="Next Amenities"
        className="absolute right-4 md:right-8 top-[36%] -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-[#132243]/80 hover:bg-brand-gold border border-brand-gold/100 hover:border-[#132243]/100 text-brand-gold hover:text-[#132243] backdrop-blur-xl flex items-center justify-center transition-all duration-300 shadow-[0_8px_30px_rgba(0,0,0,0.5)] cursor-pointer outline-none group active:scale-95"
      >
        <ChevronRight
          size={24}
          strokeWidth={2.5}
          className="transition-transform duration-300 group-hover:translate-x-0.5"
        />
      </button>


      {/* CAROUSEL CONTAINER */}
      <div
        ref={scrollContainerRef}
        onMouseDown={onDragStart}
        onMouseLeave={onDragEnd}
        onMouseUp={onDragEnd}
        onMouseMove={onDragMove}
        onTouchStart={onDragStart}
        onTouchEnd={onDragEnd}
        onTouchMove={onDragMove}
        className={`
          flex gap-6 md:gap-8
          px-6 md:px-12
          2xl:pl-[calc((100vw-90rem)/2+3rem)]
          overflow-x-hidden
          w-full
          items-start
          pb-8
          ${isGrabbing ? 'cursor-grabbing' : 'cursor-grab'}
        `}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          touchAction: 'pan-y',
        }}
      >

        {filteredAmenities.map((item, index) => (
          <div
            key={item.id}
            className="shrink-0 w-[82vw] sm:w-[50vw] md:w-[40vw] lg:w-[30vw] flex flex-col group pointer-events-none select-none"
          >

            <div className="relative h-[38vh] min-h-[240px] max-h-[380px] w-full overflow-hidden rounded-xl bg-gray-800 shadow-2xl pointer-events-auto">

              <Image
                src={item.thumbnail || "/images/placeholder.webp"}
                alt={item.title}
                fill
                draggable="false"
                sizes="(max-width: 768px) 82vw, (max-width: 1024px) 40vw, 30vw"
                className="object-cover group-hover:scale-105 transition-transform duration-[1.5s] ease-out pointer-events-none select-none"
              />

              <div className="absolute inset-0 bg-black/15 group-hover:bg-transparent transition-colors duration-500 pointer-events-none" />

            </div>


            <div className="mt-5 flex flex-col gap-2 pr-4">

              <div className="flex items-center gap-3">

                <span className="text-brand-gold font-mono text-sm">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <h3 className="text-xl md:text-2xl font-serif text-white">
                  {item.title}
                </h3>

              </div>

              <p className="text-white/60 text-sm leading-relaxed pl-7 border-l border-white/10 line-clamp-3">
                {item.description}
              </p>

            </div>

          </div>
        ))}

        <div className="w-[5vw] md:w-[10vw] shrink-0 pointer-events-none" />

      </div>
    </div>

  </section>
)}

        {/* --- ROOM BLUEPRINTS SECTION (STACKED CARDS) --- */}
        {initialProjectData.unit_layout?.length > 0 && (
            <section id="blueprints" className="relative w-full py-24 md:py-32 bg-transparent z-10">
              <div className="max-w-[75rem] mx-auto px-6 md:px-12 relative">
                
                {/* Section Header */}
                <div className="mb-14 md:mb-20 text-center">
                  <div className="text-xs tracking-widest uppercase text-brand-blue font-bold mb-4 flex items-center justify-center gap-4">
                    Room Blueprints
                  </div>
                  <h2 className="text-4xl md:text-5xl lg:text-7xl font-serif text-brand-blue leading-tight">
                    Design Your <span className="text-brand-gold">Sanctuary</span>
                  </h2>
                  <p className="mt-5 mx-auto max-w-xl text-sm md:text-base text-gray-500 leading-relaxed">
                    Explore available floor plans and unit sizes by tower.
                  </p>
                </div>

                {/* Render each tower and its layouts in CMS order. */}
                {layoutGroups.map(({ towerName, plans }) => (
                  <div key={towerName} className="tower-group relative mb-32 last:mb-0">
                    
                    {/* STICKY TOWER HEADER: Sticks while scrolling this tower, moves up when tower ends */}
                    <div className="md:sticky md:top-24 z-20 pb-6 md:pb-8 pt-2 flex justify-center pointer-events-none">
                      <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-brand-blue backdrop-blur-md border border-brand-gold/40 shadow-xl pointer-events-auto">
                        <span className="w-2 h-2 rounded-full bg-brand-gold" />
                        <span className="text-xs md:text-sm uppercase tracking-[0.25em] font-serif text-white font-medium">
                          {formatTowerName(towerName)}
                        </span>
                      </div>
                    </div>

                    {/* Stacking Cards for this Tower */}
                    <div className="relative">
                      {plans.map((plan, index) => (
                        <div
                          key={plan.id}
                          id={`blueprint-${plan.id}`}
                          className="blueprint-card w-full lg:sticky lg:top-[22vh] lg:h-[65vh] bg-white rounded-xl shadow-[0_-10px_40px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden flex flex-col lg:flex-row mb-8 md:mb-12 origin-top"
                          style={{ zIndex: index + 1 }}
                        >
                          <div 
                              className="w-full lg:w-2/5 text-white p-8 md:p-12 lg:p-16 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-white/10 transition-colors"
                              style={{ backgroundColor: plan.bg_color || '#051431' }}
                            >
                            <div className="text-brand-gold font-mono text-sm mb-4">0{index + 1}</div>
                            <h3 className="text-3xl md:text-4xl lg:text-5xl font-serif text-white mb-4">{plan.title}</h3>
                            <p className="font-sans tracking-widest text-white/70 font-bold text-sm md:text-base mb-8 uppercase">
                              {formatSqmRange(plan)}
                            </p>
                            <p className="text-white/80 leading-relaxed text-sm md:text-base">{plan.description}</p>
                          </div>
                          
                          <div className="w-full lg:w-3/5 relative p-8 md:p-12 bg-white flex items-center justify-center group">
                            <div className="relative w-full h-full min-h-[350px] lg:min-h-full transition-transform duration-700 ease-out group-hover:scale-105">
                              <Image
                                src={plan.thumbnail || '/images/placeholder.webp'}
                                alt={plan.title}
                                fill
                                sizes="(max-width: 1024px) 100vw, 60vw"
                                className="object-contain drop-shadow-2xl"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                ))}

              </div>
            </section>
          )}

        <ModernMapSection 
          projectSlug={currentSlug} 
          subtitle={initialProjectData.extended_description?.[0]?.map_subtitle} 
        />

          {/* === 4-TIER FULLSCREEN VIRTUAL TOUR MODAL === */}
        {isTourOpen && activeTourUnit && (() => {
          const availableTowers = Array.from(
            new Set(
              validTours
                .map((t: any) => t.tower_name?.trim())
                .filter((name: any): name is string => Boolean(name))
            )
          ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

          const towerUnits = activeTourTower
            ? validTours.filter(
                (t: any) => !t.tower_name || t.tower_name.trim().toLowerCase() === activeTourTower.toLowerCase()
              )
            : validTours;

          const currentAreas = parseViewAreas(activeTourUnit);
          const activeScene = currentAreas[activeRoomIndex] || currentAreas[0];

          return (
            <div className="fixed inset-0 z-[9999] bg-black animate-in fade-in duration-500 flex flex-col overflow-hidden select-none">
              
              {/* Top Bar */}
              <div className="absolute top-0 left-0 w-full bg-gradient-to-b from-black/90 via-black/50 to-transparent z-50 p-3.5 sm:p-4 md:p-6 pointer-events-none flex flex-col gap-2.5">
                <div className="w-full flex items-center justify-between">
                  <div className="flex items-center gap-1.5 px-3 py-1 md:px-4 md:py-1.5 bg-black/80 backdrop-blur-md rounded-full border border-[#D4AF37]/30 shadow-lg pointer-events-auto">
                    <span className="text-[#D4AF37] font-serif text-[9px] sm:text-[10px] md:text-[11px] font-bold tracking-widest uppercase">
                      360° Virtual Tour
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsTourOpen(false);
                      setActiveTourUnit(null);
                      setActiveTourTower(null);
                      setActiveRoomIndex(0);
                    }}
                    className="pointer-events-auto group flex items-center gap-1.5 sm:gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-white/15 shadow-lg hover:bg-[#d0b370] transition-all duration-300 cursor-pointer outline-none shrink-0"
                  >
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-white group-hover:text-black">
                      Close
                    </span>
                    <X size={13} className="text-white group-hover:text-black" />
                  </button>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto w-full max-w-sm sm:max-w-xl">
                  
                  {/* 1. PROJECT DROPDOWN */}
                  <div className="relative flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProjectDropdownOpen(!isProjectDropdownOpen);
                        setIsTowerDropdownOpen(false);
                        setIsUnitDropdownOpen(false);
                      }}
                      className="w-full bg-black/60 hover:bg-black/75 backdrop-blur-xl rounded-xl md:rounded-2xl px-3 py-1.5 sm:px-4 sm:py-2 md:px-5 md:py-2.5 border border-white/15 flex flex-col justify-center text-left cursor-pointer transition-all outline-none"
                    >
                      <span className="text-[8px] sm:text-[9px] md:text-[10px] font-semibold tracking-[0.14em] text-[#d4b26f] uppercase font-sans">
                        Project
                      </span>
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <span className="text-xs sm:text-[13px] md:text-[14px] font-medium text-white font-sans truncate">
                          {initialProjectData.title}
                        </span>
                        <ChevronDown size={14} className={`text-white/80 transition-transform duration-300 ${isProjectDropdownOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {isProjectDropdownOpen && (
                      <div className="absolute top-[calc(100%+6px)] left-0 w-full min-w-[170px] max-h-60 overflow-y-auto bg-black/85 backdrop-blur-2xl rounded-xl border border-white/15 py-1 z-[70]">
                        {(allProjects.length > 0 ? allProjects : [{ id: initialProjectData.id, title: initialProjectData.title, slug: initialProjectData.slug }]).map((p) => {
                          const isSelected = p.id === initialProjectData.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setIsProjectDropdownOpen(false);
                                if (!isSelected) {
                                  const cleanSlug = p.slug.startsWith('/') ? p.slug.slice(1) : p.slug;
                                  router.push(`/projects/${cleanSlug}`);
                                }
                              }}
                              className={`w-full px-3 py-2 text-left text-xs font-medium font-sans flex items-center justify-between cursor-pointer ${
                                isSelected ? 'bg-white/15 text-[#d4b26f]' : 'text-white/85 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              <span className="truncate">{p.title}</span>
                              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#d4b26f] shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 2. TOWER DROPDOWN */}
                  {availableTowers.length > 0 && (
                    <div className="relative flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          setIsTowerDropdownOpen(!isTowerDropdownOpen);
                          setIsProjectDropdownOpen(false);
                          setIsUnitDropdownOpen(false);
                        }}
                        className="w-full bg-black/60 hover:bg-black/75 backdrop-blur-xl rounded-xl md:rounded-2xl px-3 py-1.5 sm:px-4 sm:py-2 md:px-5 md:py-2.5 border border-white/15 flex flex-col justify-center text-left cursor-pointer transition-all outline-none"
                      >
                        <span className="text-[8px] sm:text-[9px] md:text-[10px] font-semibold tracking-[0.14em] text-[#d4b26f] uppercase font-sans">
                          Tower
                        </span>
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <span className="text-xs sm:text-[13px] md:text-[14px] font-medium text-white font-sans truncate">
                            {activeTourTower || availableTowers[0]}
                          </span>
                          <ChevronDown size={14} className={`text-white/80 transition-transform duration-300 ${isTowerDropdownOpen ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {isTowerDropdownOpen && (
                        <div className="absolute top-[calc(100%+6px)] left-0 w-full min-w-[140px] max-h-60 overflow-y-auto bg-black/85 backdrop-blur-2xl rounded-xl border border-white/15 py-1 z-[70]">
                          {availableTowers.map((tower) => {
                            const isSelected = activeTourTower?.toLowerCase() === tower.toLowerCase();
                            return (
                              <button
                                key={tower}
                                type="button"
                                onClick={() => {
                                  setActiveTourTower(tower);
                                  const units = validTours.filter(
                                    (t: any) => !t.tower_name || t.tower_name.trim().toLowerCase() === tower.toLowerCase()
                                  );
                                  setActiveTourUnit(units[0] || null);
                                  setActiveRoomIndex(0);
                                  setIsTowerDropdownOpen(false);
                                }}
                                className={`w-full px-3 py-2 text-left text-xs font-medium font-sans flex items-center justify-between cursor-pointer ${
                                  isSelected ? 'bg-white/15 text-[#d4b26f]' : 'text-white/85 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <span className="truncate">{tower}</span>
                                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#d4b26f] shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Unit Dropdown */}
                  {towerUnits.length > 0 && (
                    <div className="relative flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          setIsUnitDropdownOpen(!isUnitDropdownOpen);
                          setIsTowerDropdownOpen(false);
                        }}
                        className="w-full bg-black/60 hover:bg-black/75 backdrop-blur-xl rounded-xl md:rounded-2xl px-3 py-1.5 sm:px-4 sm:py-2 md:px-5 md:py-2.5 border border-white/15 flex flex-col justify-center text-left cursor-pointer transition-all outline-none"
                      >
                        <span className="text-[8px] sm:text-[9px] md:text-[10px] font-semibold tracking-[0.14em] text-[#d4b26f] uppercase font-sans">
                          Unit
                        </span>
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <span className="text-xs sm:text-[13px] md:text-[14px] font-medium text-white font-sans truncate">
                            {activeTourUnit?.unit_name || activeTourUnit?.title || 'Standard Unit'}
                          </span>
                          <ChevronDown size={14} className={`text-white/80 transition-transform duration-300 ${isUnitDropdownOpen ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {isUnitDropdownOpen && (
                        <div className="absolute top-[calc(100%+6px)] left-0 w-full min-w-[170px] max-h-60 overflow-y-auto bg-black/85 backdrop-blur-2xl rounded-xl border border-white/15 py-1 z-[70]">
                          {towerUnits.map((u: any) => {
                            const isSelected = String(u.id) === String(activeTourUnit?.id);
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => {
                                  setActiveTourUnit(u);
                                  setActiveRoomIndex(0);
                                  setIsUnitDropdownOpen(false);
                                }}
                                className={`w-full px-3 py-2 text-left text-xs font-medium font-sans flex items-center justify-between cursor-pointer ${
                                  isSelected ? 'bg-white/15 text-[#d4b26f]' : 'text-white/85 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <span className="truncate">{u.unit_name || u.title || 'Standard Unit'}</span>
                                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#d4b26f] shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 360 Viewer */}
              <div className="flex-1 w-full h-full cursor-grab active:cursor-grabbing">
                {activeScene?.image ? (
                  <DynamicVirtualTour key={activeScene.image} image={activeScene.image} />
                ) : (
                  <div className="flex items-center justify-center h-full text-white/50 text-sm font-sans uppercase tracking-widest">
                    No panorama available for this area
                  </div>
                )}
              </div>

              {/* Carousel Strip */}
              {currentAreas.length > 1 && (() => {
                const startIndex = currentAreas.length <= maxVisible 
                  ? 0 
                  : Math.max(0, Math.min(activeRoomIndex - (maxVisible - 1), currentAreas.length - maxVisible));
                const visibleAreas = currentAreas.slice(startIndex, startIndex + maxVisible);

                return (
                  <div className="absolute bottom-16 md:bottom-8 left-1/2 -translate-x-1/2 z-40 pointer-events-auto flex items-center gap-1 sm:gap-2 bg-black/65 hover:bg-black/75 backdrop-blur-2xl px-2.5 py-2 sm:px-4 sm:py-3 rounded-[22px] md:rounded-[28px] border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.6)] max-w-[96vw]">
                    <button
                      type="button"
                      onClick={() => setActiveRoomIndex((prev) => (prev - 1 + currentAreas.length) % currentAreas.length)}
                      className="p-1 sm:p-1.5 text-white/70 hover:text-white transition-colors cursor-pointer shrink-0"
                    >
                      <ChevronLeft size={18} className="md:w-[22px] md:h-[22px]" strokeWidth={2.5} />
                    </button>

                    <div className="flex items-end gap-2 sm:gap-3 md:gap-4 py-0.5 px-0.5 sm:px-1">
                      {visibleAreas.map((area: any, offsetIdx: number) => {
                        const originalIndex = startIndex + offsetIdx;
                        const isSelected = activeRoomIndex === originalIndex;

                        return (
                          <button
                            key={originalIndex}
                            type="button"
                            onClick={() => setActiveRoomIndex(originalIndex)}
                            className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group outline-none transition-transform duration-200"
                          >
                            <span className={`text-center font-sans tracking-tight transition-all duration-200 max-w-[62px] sm:max-w-[72px] md:max-w-[85px] truncate ${
                              isSelected ? 'text-white text-[11px] sm:text-[13px] md:text-[15px] font-semibold scale-105' : 'text-white/65 text-[9px] sm:text-[11px] md:text-[12px] font-normal group-hover:text-white'
                            }`}>
                              {area.title || `Area ${originalIndex + 1}`}
                            </span>
                            <div className={`relative w-14 h-10 sm:w-16 sm:h-12 md:w-20 md:h-14 rounded-lg md:rounded-xl overflow-hidden transition-all duration-200 ${
                              isSelected ? 'border-2 border-[#d4b26f] shadow-[0_0_12px_rgba(212,178,111,0.5)] scale-105' : 'border border-white/20 opacity-70 group-hover:opacity-100 group-hover:border-white/50'
                            }`}>
                              <img src={area.image} alt={area.title || `Area ${originalIndex + 1}`} className="w-full h-full object-cover" />
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveRoomIndex((prev) => (prev + 1) % currentAreas.length)}
                      className="p-1 sm:p-1.5 text-white/70 hover:text-white transition-colors cursor-pointer shrink-0"
                    >
                      <ChevronRight size={18} className="md:w-[22px] md:h-[22px]" strokeWidth={2.5} />
                    </button>
                  </div>
                );
              })()}

            </div>
          );
        })()}

      </main>
      <Footer />
      <BackToTop />
    </PageTransition>
  );
}

export default function ProjectClient({ 
  initialProjectData, 
  currentSlug,
  allProjects = []
}: { 
  initialProjectData: Project; 
  currentSlug: string;
  allProjects?: Array<{ id: number; title: string; slug: string }>;
}) {
  return (
    <div className="min-h-screen bg-[#E7E7E7] font-sans">
      <Suspense fallback={<div className="min-h-screen bg-[#E7E7E7] flex items-center justify-center">Loading...</div>}>
        <DynamicProjectContent 
          initialProjectData={initialProjectData} 
          currentSlug={currentSlug} 
          allProjects={allProjects} 
        />
      </Suspense>
    </div>
  );
}