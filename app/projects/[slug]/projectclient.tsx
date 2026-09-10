'use client';

import Navbar from "@/app/components/navbar";
import Image from "next/image";
import { Layers, Building2, Target, Key, MapPin, ArrowRight, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import Footer from '@/app/components/footer';
import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation'; 
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
}

interface UnitLayout {
  id: number;
  project_id: number;
  title: string;
  description: string;
  thumbnail: string;
  min_sqm: number;
  max_sqm: number;
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
}

const UnifiedProjectMap = dynamic(() => import('@/app/components/unifiedprojectmap'), { 
  ssr: false 
});

function ModernMapSection({ projectSlug }: { projectSlug: string }) {
  return (
    <section className="relative py-24 bg-[#0A1128] overflow-hidden flex items-center min-h-[900px]">
      <div className="absolute inset-0 z-0 opacity-20" style={{ backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-brand-gold/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-brand-blue/30 rounded-full blur-[150px] pointer-events-none z-0" />
      <div className="max-w-[90rem] mx-auto px-6 md:px-12 relative z-20 flex flex-col items-center w-full">
        <motion.div className="mb-12 text-center" initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.2 } } }}>
          <motion.h2 variants={{ hidden: { opacity: 0, y: 40, filter: "blur(10px)" }, visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 1.2, ease: [0.22, 1, 0.36, 1] } } }} className="text-5xl md:text-6xl lg:text-7xl font-serif font-light leading-tight mb-4 text-white">
            Points of <motion.span className="text-brand-gold">Interest</motion.span>
          </motion.h2>
          <motion.p variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } } }} className="text-center font-light leading-relaxed text-white/70 text-base md:text-lg lg:text-xl max-w-4xl md:whitespace-nowrap mx-auto">
            Everything you need, strategically positioned right around your sanctuary.
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

function DynamicProjectContent({ initialProjectData, currentSlug }: { initialProjectData: Project, currentSlug: string }) {
  const searchParams = useSearchParams(); 
  const blueprintIdParam = searchParams.get('blueprint');

  const blueprintSectionRef = useRef<HTMLElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<any>(null);

  // --- SMOOTH LERP DRAG STATE ---
  const isDragging = useRef(false);
  const startX = useRef(0);
  const targetScroll = useRef(0);
  const currentScroll = useRef(0);
  const rafId = useRef<number | null>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);

  // 1. LERP ANIMATION LOOP (The magic that makes it smooth)
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

  // 2. URL PARAMETER SYNC
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

  // 3. GSAP & LENIS SETUP
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
    gsap.ticker.add((time) => lenis.raf(time * 1000));

    let ctx = gsap.context(() => {
      const blueprintCards = gsap.utils.toArray('.blueprint-card');
      blueprintCards.forEach((card: any, i) => {
        if (i !== blueprintCards.length - 1) {
          gsap.to(card, {
            scale: 0.92, opacity: 0.4, filter: "blur(4px)",
            scrollTrigger: { trigger: blueprintCards[i + 1] as HTMLElement, start: "top 85%", end: "top 20%", scrub: true }
          });
        }
      });
    });

    return () => {
      lenis.destroy();
      lenisRef.current = null; 
      ctx.revert();
    };
  }, [initialProjectData, blueprintIdParam]); 

  // --- DRAG EVENT HANDLERS ---
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

        {/* --- AMENITIES DRAGGABLE SCROLL SECTION --- */}
        {/* --- AMENITIES DRAGGABLE CAROUSEL SECTION --- */}
        {initialProjectData.amenities?.length > 0 && (
          <section className="relative w-full bg-[#132243] flex flex-col justify-center py-24 md:py-32 overflow-hidden group/amenities">
            
            {/* SECTION HEADER */}
            <div className="max-w-[90rem] px-6 md:px-12 w-full mx-auto mb-10 md:mb-14 shrink-0">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 w-full text-white">
                <div>
                  <div className="text-xs tracking-[0.25em] uppercase text-brand-gold font-bold mb-2 md:mb-4 flex items-center gap-3">
                    Amenities &amp; Facilities
                  </div>
                  <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif leading-tight">
                    <span className="inline-block whitespace-nowrap">
                      {initialProjectData.extended_description?.[0]?.amenities_title || 'Experience A Fresh'}
                    </span>
                    <br />
                    <span className="text-brand-gold">
                      {initialProjectData.extended_description?.[0]?.amenities_title_gold || `Way Of Living in ${initialProjectData.title}.`}
                    </span>
                  </h2>
                </div>
                <p className="text-white/70 font-light leading-relaxed max-w-sm text-justify md:text-right text-sm md:text-base hidden sm:block">
                  Swipe, drag, or use the arrows to explore our expansive leisure amenities designed for your wellness.
                </p>
              </div>
            </div>

            {/* CAROUSEL WRAPPER WITH END ARROWS */}
            <div className="relative w-full">
              
             {/* PREVIOUS BUTTON (Left Side) */}
              <button
                type="button"
                onClick={scrollPrev}
                aria-label="Previous Amenities"
                className="absolute left-4 md:left-8 top-[36%] -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-[#132243]/80 hover:bg-brand-gold border border-brand-gold/100 hover:border-[#132243]/100 text-brand-gold hover:text-[#132243] backdrop-blur-xl flex items-center justify-center transition-all duration-300 shadow-[0_8px_30px_rgba(0,0,0,0.5)] cursor-pointer outline-none group active:scale-95"
              >
                <ChevronLeft size={24} strokeWidth={2.5} className="transition-transform duration-300 group-hover:-translate-x-0.5" />
              </button>

              {/* NEXT BUTTON (Right Side) */}
              <button
                type="button"
                onClick={scrollNext}
                aria-label="Next Amenities"
                className="absolute right-4 md:right-8 top-[36%] -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-[#132243]/80 hover:bg-brand-gold border border-brand-gold/100 hover:border-[#132243]/100 text-brand-gold hover:text-[#132243] backdrop-blur-xl flex items-center justify-center transition-all duration-300 shadow-[0_8px_30px_rgba(0,0,0,0.5)] cursor-pointer outline-none group active:scale-95"
              >
                <ChevronRight size={24} strokeWidth={2.5} className="transition-transform duration-300 group-hover:translate-x-0.5" />
              </button>

              {/* SMOOTH DRAG/CAROUSEL CONTAINER */}
              <div 
                ref={scrollContainerRef}
                onMouseDown={onDragStart}
                onMouseLeave={onDragEnd}
                onMouseUp={onDragEnd}
                onMouseMove={onDragMove}
                onTouchStart={onDragStart}
                onTouchEnd={onDragEnd}
                onTouchMove={onDragMove}
                className={`flex gap-6 md:gap-8 px-6 md:px-12 2xl:pl-[calc((100vw-90rem)/2+3rem)] overflow-x-hidden w-full items-start pb-8 ${isGrabbing ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', touchAction: 'pan-y' }}
              >
                <style dangerouslySetInnerHTML={{ __html: `div::-webkit-scrollbar { display: none; }` }} />
                
                {initialProjectData.amenities.map((item, index) => (
                  <div key={item.id} className="shrink-0 w-[82vw] sm:w-[50vw] md:w-[40vw] lg:w-[30vw] flex flex-col group pointer-events-none select-none">
                    <div className="relative h-[38vh] min-h-[240px] max-h-[380px] w-full overflow-hidden rounded-xl bg-gray-800 shadow-2xl pointer-events-auto">
                      <Image
                        src={item.thumbnail} 
                        alt={item.title} 
                        fill 
                        draggable="false"
                        sizes="(max-width: 768px) 82vw, (max-width: 1024px) 40vw, 30vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-[1.5s] ease-out pointer-events-none select-none"
                      />
                      <div className="absolute inset-0 bg-black/15 group-hover:bg-transparent transition-colors duration-500 pointer-events-none"></div>
                    </div>
                    <div className="mt-5 flex flex-col gap-2 pr-4">
                      <div className="flex items-center gap-3">
                        <span className="text-brand-gold font-mono text-sm">0{index + 1}</span>
                        <h3 className="text-xl md:text-2xl font-serif text-white">{item.title}</h3>
                      </div>
                      <p className="text-white/60 text-sm leading-relaxed pl-7 border-l border-white/10 line-clamp-3">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="w-[5vw] md:w-[10vw] shrink-0 pointer-events-none"></div>
              </div>

            </div>
          </section>
        )}

        {/* --- ROOM BLUEPRINTS SECTION (STACKED CARDS) --- */}
        {initialProjectData.unit_layout?.length > 0 && (
          <section id="blueprints" ref={blueprintSectionRef} className="relative w-full py-32 bg-transparent z-10">
            <div className="max-w-[75rem] mx-auto px-6 md:px-12 relative">
              
              <div className="mb-24 text-center">
                <div className="text-xs tracking-widest uppercase text-brand-blue font-bold mb-4 flex items-center justify-center gap-4">
                  Room Blueprints
                </div>
                <h2 className="text-4xl md:text-5xl lg:text-7xl font-serif text-brand-blue leading-tight">
                  Design Your <span className=" text-brand-gold">Sanctuary</span>
                </h2>
              </div>

              {/* Stack Container */}
              <div className="relative pb-[10vh]">
                {initialProjectData.unit_layout.map((plan, index) => (
                  <div 
                    key={plan.id} id={`blueprint-${plan.id}`}
                    className="blueprint-card sticky top-[15vh] w-full min-h-[60vh] lg:h-[65vh] bg-white rounded-xl shadow-[0_-10px_40px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden flex flex-col lg:flex-row mb-12 origin-top"
                    style={{ zIndex: index + 1 }}
                  >
                    <div className="w-full lg:w-2/5 bg-[#F9F9FA] p-8 md:p-12 lg:p-16 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-gray-200">
                      <div className="text-brand-gold font-mono text-sm mb-4">0{index + 1}</div>
                      <h3 className="text-3xl md:text-4xl lg:text-5xl font-serif text-brand-blue mb-4">{plan.title}</h3>
                      <p className="font-sans tracking-widest text-brand-blue/80 font-bold text-sm md:text-base mb-8 uppercase">{plan.min_sqm} - {plan.max_sqm} SQM</p>
                      <p className="text-gray-600 leading-relaxed text-sm md:text-base">{plan.description}</p>
                    </div>
                    
                    <div className="w-full lg:w-3/5 relative p-8 md:p-12 bg-white flex items-center justify-center group">
                      <div className="relative w-full h-full min-h-[350px] lg:min-h-full transition-transform duration-700 ease-out group-hover:scale-105">
                        <Image src={plan.thumbnail} alt={plan.title} fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-contain drop-shadow-2xl" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </section>
        )}

        <ModernMapSection projectSlug={currentSlug} />
      </main>
      <Footer />
      <BackToTop />
    </PageTransition>
  );
}

export default function ProjectClient({ initialProjectData, currentSlug }: { initialProjectData: Project, currentSlug: string }) {
  return (
    <div className="min-h-screen bg-[#E7E7E7] font-sans">
      <Suspense fallback={<div className="min-h-screen bg-[#E7E7E7] flex items-center justify-center">Loading...</div>}>
        <DynamicProjectContent initialProjectData={initialProjectData} currentSlug={currentSlug} />
      </Suspense>
    </div>
  );
}