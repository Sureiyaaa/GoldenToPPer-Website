'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import PageTransition from '@/app/components/page-transitions';
import HeroCarousel from '@/app/components/hero-carousel';
import Navbar from '@/app/components/navbar';
import Footer from '@/app/components/footer';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import BackToTop from '../components/backtotop';
import { ArrowRight, Move3d, X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const DynamicProjectMap = dynamic(() => import('@/app/components/projectmap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] flex items-center justify-center bg-brand-blue rounded-sm border border-brand-blue shadow-inner">
      <p className="text-brand-gold animate-pulse tracking-widest text-sm font-bold uppercase">Loading Map...</p>
    </div>
  ),
});

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
  // Supports both the new column 'view_areas' and legacy 'rooms'
  let raw = tour.view_areas || tour.rooms;
  if (!raw) return [];
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { raw = []; }
  }
  return Array.isArray(raw) ? raw : [];
}

export default function ProjectsClient({ initialProjects }: { initialProjects: any[] }) {
  const projectsRefs = useRef<(HTMLDivElement | null)[]>([]);

  // === 3-TIER HIERARCHY STATE ===
  const [activeTourProject, setActiveTourProject] = useState<any | null>(null);
  const [activeTourUnit, setActiveTourUnit] = useState<any | null>(null);
  const [activeRoomIndex, setActiveRoomIndex] = useState(0);

  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  
  // Responsive thumbnail count (3 on mobile, 6 on desktop)
  const [maxVisible, setMaxVisible] = useState(6);

  useEffect(() => {
    const handleResize = () => {
      setMaxVisible(window.innerWidth < 768 ? 3 : 6);
    };
    handleResize(); // set initial value on mount
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (activeTourUnit) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [activeTourUnit]);

  // Smooth Scroll Setup
  useEffect(() => {
    window.history.scrollRestoration = 'manual';

    const lenis = new Lenis({
      duration: 1.8,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,
    });

    setTimeout(() => {
      window.scrollTo(0, 0);
      lenis.scrollTo(0, { immediate: true });
      ScrollTrigger.refresh();
    }, 50);

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => { lenis.raf(time * 1000); });

    return () => {
      lenis.destroy();
      gsap.ticker.remove((time) => lenis.raf(time * 1000));
    };
  }, []);

  // GSAP Animation for Project Cards
  useEffect(() => {
    if (!initialProjects || initialProjects.length === 0) return;

    const ctx = gsap.context(() => {
      projectsRefs.current.forEach((el) => {
        if (!el) return;
        gsap.fromTo(el, { opacity: 0, y: 80 }, {
          opacity: 1,
          y: 0,
          duration: 1.2,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        });
      });
    });

    return () => ctx.revert();
  }, [initialProjects]);

  return (
    <PageTransition>
      <div className="relative min-h-screen bg-[#E7E7E7] font-sans text-gray-900" style={{ overflowAnchor: 'none' }}>
        <div className="absolute top-0 left-0 w-full z-50"><Navbar /></div>

        <section className="relative w-full h-screen overflow-hidden bg-black">
          <HeroCarousel />
        </section>

        {/* Locations Map */}
        <section className="relative w-full pt-10 pb-12 md:pt-16 md:pb-32 overflow-hidden px-6 md:px-12 max-w-[90rem] mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-5xl md:text-7xl font-serif text-brand-blue mb-4">
              Our <span className="text-brand-gold">Locations</span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg font-light text-gray-600">
              Explore the map to view our premium developments across the Philippines.
            </p>
          </div>
          <div className="shadow-xl rounded-sm overflow-hidden border border-gray-200 relative z-10">
            <DynamicProjectMap />
          </div>
        </section>

        {/* Project List Content */}
        <main className="w-full py-24 md:py-32">
          <div className="max-w-[90rem] mx-auto px-6 md:px-12">
            {initialProjects && initialProjects.length > 0 ? (
              <div className="flex flex-col gap-24 md:gap-40">
                {initialProjects.map((project, index) => {
                  const hasTour = (project.virtual_tours && project.virtual_tours.length > 0) || project.virtual_tour_url;

                  return (
                    <div
                      key={project.id}
                      ref={(el) => { projectsRefs.current[index] = el; }}
                      className={`flex flex-col gap-8 md:gap-0 ${index % 2 !== 0 ? 'md:flex-row-reverse' : 'md:flex-row'}`}
                    >
                      {/* Image */}
                      <div className="relative h-[450px] md:h-[600px] w-full md:w-3/5 overflow-hidden rounded-sm shadow-xl group bg-black shrink-0">
                        <Image
                          src={project.image}
                          alt={project.name || project.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 60vw"
                          priority={index === 0}
                          className="object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out"
                        />
                      </div>

                      {/* Content */}
                      <div className={`flex w-full flex-col justify-center px-4 py-10 md:py-0 md:w-2/5 ${index % 2 !== 0 ? 'md:pr-12 lg:pr-24' : 'md:pl-12 lg:pl-24'}`}>
                        <div className="mb-6 flex flex-wrap gap-2">
                          <span className="bg-brand-gold text-brand-blue px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] border border-brand-gold">
                            {project.statusText || project.status}
                          </span>
                          {project.tags?.map((tagName: string, i: number) => (
                            <span key={i} className="bg-white text-gray-500 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] border border-gray-100 shadow-sm">
                              {tagName}
                            </span>
                          ))}
                        </div>

                        <h2 className="mb-2 text-4xl lg:text-5xl font-serif text-brand-blue leading-[1.1]">{project.name || project.title}</h2>

                        <div className="mb-8">
                          <p className="text-sm md:text-base text-gray-500 uppercase tracking-widest">
                            {project.address ? `${project.address}, ` : ''}{project.city}
                          </p>
                        </div>

                        {/* Units */}
                        <div className="mb-12 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-gray-600">
                          {project.units?.map((unitTitle: string, i: number) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-brand-gold"></span>
                              {unitTitle}
                            </div>
                          ))}
                        </div>

                        {/* Buttons */}
                        <div className="flex flex-col gap-3 w-full md:w-[90%]">
                          {/* 1. Primary Action */}
                          <Link href={'/inquire'} className="group relative flex items-center justify-center gap-4 w-full bg-brand-blue text-white px-8 py-4 rounded-sm shadow-md overflow-hidden transition-all hover:shadow-xl outline-none">
                            <span className="absolute inset-0 w-full h-full bg-brand-gold transform -translate-x-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0"></span>
                            <span className="relative z-10 text-[11px] tracking-[0.25em] font-bold uppercase group-hover:text-brand-blue transition-colors duration-500">Inquire Now</span>
                            <ArrowRight size={16} className="relative z-10 group-hover:text-brand-blue transition-colors duration-500" />
                          </Link>

                          <div className="flex flex-col sm:flex-row gap-3 w-full">
                            {/* 2. SECONDARY ACTION (360 Tour Button) */}
                              {hasTour && (
                                <button
                                  onClick={() => {
                                    setActiveTourProject(project);
                                    const tours = project.virtual_tours || [];
                                    if (tours.length > 0) {
                                      setActiveTourUnit(tours[0]);
                                    } else if (project.virtual_tour_url) {
                                      setActiveTourUnit({
                                        id: 'legacy',
                                        unit_name: 'Main Unit',
                                        view_areas: [{ title: 'Main View', image: project.virtual_tour_url }]
                                      });
                                    }
                                    setActiveRoomIndex(0);
                                  }}
                                  className="group flex-1 flex items-center justify-center gap-3 bg-transparent border border-gray-300 px-4 py-3.5 rounded-sm hover:border-brand-gold hover:bg-brand-gold/5 transition-all duration-300 outline-none cursor-pointer"
                                >
                                  <Move3d size={14} className="text-brand-blue group-hover:text-brand-gold transition-colors" />
                                  <span className="text-[10px] tracking-[0.2em] font-bold text-brand-blue uppercase group-hover:text-brand-gold transition-colors">
                                    360° Tour
                                  </span>
                                </button>
                              )}

                            {/* 3. Tertiary Action (Details) */}
                            <Link
                              href={`/projects/${project.slug?.replace(/^\//, '')}`}
                              className="group flex-1 flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 px-4 py-3.5 rounded-sm transition-all duration-300 outline-none"
                            >
                              <span className="text-[10px] tracking-[0.2em] font-bold text-gray-500 uppercase group-hover:text-brand-blue transition-colors">Details</span>
                              <ArrowRight size={14} className="text-gray-400 group-hover:text-brand-blue transform group-hover:translate-x-1 transition-all duration-300" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20 text-gray-500">No projects available at the moment.</div>
            )}
          </div>
        </main>

        <Footer />
        <BackToTop />

        {/* === 3-TIER FULLSCREEN VIRTUAL TOUR MODAL === */}
        {activeTourProject && activeTourUnit && (() => {
          const availableUnits: any[] = activeTourProject.virtual_tours?.length > 0
            ? activeTourProject.virtual_tours
            : [activeTourUnit];

          const currentAreas = parseViewAreas(activeTourUnit);
          const activeScene = currentAreas[activeRoomIndex] || currentAreas[0];

          return (
            <div className="fixed inset-0 z-[9999] bg-black animate-in fade-in duration-500 flex flex-col overflow-hidden select-none">
              
             {/* TOP BAR: RESPONSIVE TWO-ROW HEADER ON MOBILE, SINGLE ROW ON DESKTOP */}
              <div className="absolute top-0 left-0 w-full bg-gradient-to-b from-black/90 via-black/50 to-transparent z-50 p-3.5 sm:p-4 md:p-6 pointer-events-none flex flex-col gap-2.5">
                
                {/* Row 1: Badge + Close Button */}
                <div className="w-full flex items-center justify-between">
                  <div className="flex items-center gap-1.5 px-3 py-1 md:px-4 md:py-1.5 bg-black/80 backdrop-blur-md rounded-full border border-[#D4AF37]/30 shadow-lg pointer-events-auto">
                    <span className="text-[#D4AF37] font-serif text-[9px] sm:text-[10px] md:text-[11px] font-bold tracking-widest uppercase">
                      360° Virtual Tour
                    </span>
                  </div>

                  {/* Close Button (Always visible on all screen sizes) */}
                  <button
                    onClick={() => {
                      setActiveTourProject(null);
                      setActiveTourUnit(null);
                      setActiveRoomIndex(0);
                      setIsProjectDropdownOpen(false);
                      setIsUnitDropdownOpen(false);
                    }}
                    className="pointer-events-auto group flex items-center gap-1.5 sm:gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-white/15 shadow-lg hover:bg-[#d0b370] transition-all duration-300 cursor-pointer outline-none shrink-0"
                    aria-label="Close Tour"
                  >
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-white group-hover:text-black">
                      Close
                    </span>
                    <X size={13} className="text-white group-hover:text-black" />
                  </button>
                </div>

                {/* Row 2: Responsive Project & Unit Dropdowns */}
                <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto w-full max-w-sm sm:max-w-md">
                  
                  {/* 1. PROJECT DROPDOWN */}
                  <div className="relative flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProjectDropdownOpen(!isProjectDropdownOpen);
                        setIsUnitDropdownOpen(false);
                      }}
                      className="w-full bg-black/60 hover:bg-black/75 backdrop-blur-xl rounded-xl md:rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.37)] px-3 py-1.5 sm:px-4 sm:py-2 md:px-5 md:py-2.5 border border-white/15 flex flex-col justify-center text-left cursor-pointer transition-all duration-200 active:scale-95 outline-none"
                    >
                      <span className="text-[8px] sm:text-[9px] md:text-[10px] font-semibold tracking-[0.14em] text-[#d4b26f] uppercase font-sans">
                        Project
                      </span>
                      <div className="flex items-center justify-between gap-1.5 mt-0.5">
                        <span className="text-xs sm:text-[13px] md:text-[15px] font-medium text-white font-sans tracking-tight truncate">
                          {activeTourProject.name || activeTourProject.title}
                        </span>
                        <ChevronDown 
                          size={14} 
                          strokeWidth={2.2} 
                          className={`text-white/80 shrink-0 transition-transform duration-300 ${isProjectDropdownOpen ? 'rotate-180' : ''}`} 
                        />
                      </div>
                    </button>

                    {/* Project Options Menu */}
                    {isProjectDropdownOpen && (
                      <div className="absolute top-[calc(100%+6px)] left-0 w-full min-w-[170px] max-h-60 overflow-y-auto bg-black/85 backdrop-blur-2xl rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.5)] border border-white/15 py-1 z-[70] animate-in fade-in zoom-in-95 duration-150">
                        {initialProjects
                          .filter((p) => (p.virtual_tours && p.virtual_tours.length > 0) || p.virtual_tour_url)
                          .map((p) => {
                            const isSelected = p.id === activeTourProject.id;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setActiveTourProject(p);
                                  const units = p.virtual_tours || [];
                                  if (units.length > 0) {
                                    setActiveTourUnit(units[0]);
                                  } else if (p.virtual_tour_url) {
                                    setActiveTourUnit({
                                      id: 'legacy',
                                      unit_name: 'Main Unit',
                                      view_areas: [{ title: 'Main View', image: p.virtual_tour_url }]
                                    });
                                  } else {
                                    setActiveTourUnit(null);
                                  }
                                  setActiveRoomIndex(0);
                                  setIsProjectDropdownOpen(false);
                                }}
                                className={`w-full px-3 py-2 text-left text-xs sm:text-[13px] font-medium font-sans transition-colors flex items-center justify-between cursor-pointer ${
                                  isSelected 
                                    ? 'bg-white/15 text-[#d4b26f]' 
                                    : 'text-white/85 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <span className="truncate">{p.name || p.title}</span>
                                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#d4b26f] shrink-0" />}
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>

                  {/* 2. UNIT DROPDOWN */}
                  {availableUnits.length > 0 && (
                    <div className="relative flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          setIsUnitDropdownOpen(!isUnitDropdownOpen);
                          setIsProjectDropdownOpen(false);
                        }}
                        className="w-full bg-black/60 hover:bg-black/75 backdrop-blur-xl rounded-xl md:rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.37)] px-3 py-1.5 sm:px-4 sm:py-2 md:px-5 md:py-2.5 border border-white/15 flex flex-col justify-center text-left cursor-pointer transition-all duration-200 active:scale-95 outline-none"
                      >
                        <span className="text-[8px] sm:text-[9px] md:text-[10px] font-semibold tracking-[0.14em] text-[#d4b26f] uppercase font-sans">
                          Unit
                        </span>
                        <div className="flex items-center justify-between gap-1.5 mt-0.5">
                          <span className="text-xs sm:text-[13px] md:text-[15px] font-medium text-white font-sans tracking-tight truncate">
                            {activeTourUnit?.unit_name || activeTourUnit?.title || 'Standard Unit'}
                          </span>
                          <ChevronDown 
                            size={14} 
                            strokeWidth={2.2} 
                            className={`text-white/80 shrink-0 transition-transform duration-300 ${isUnitDropdownOpen ? 'rotate-180' : ''}`} 
                          />
                        </div>
                      </button>

                      {/* Unit Options Menu */}
                      {isUnitDropdownOpen && (
                        <div className="absolute top-[calc(100%+6px)] left-0 w-full min-w-[170px] max-h-60 overflow-y-auto bg-black/85 backdrop-blur-2xl rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.5)] border border-white/15 py-1 z-[70] animate-in fade-in zoom-in-95 duration-150">
                          {availableUnits.map((u: any) => {
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
                                className={`w-full px-3 py-2 text-left text-xs sm:text-[13px] font-medium font-sans transition-colors flex items-center justify-between cursor-pointer ${
                                  isSelected 
                                    ? 'bg-white/15 text-[#d4b26f]' 
                                    : 'text-white/85 hover:bg-white/10 hover:text-white'
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
  
            {/* 360 VIEWER */}
              <div className="flex-1 w-full h-full cursor-grab active:cursor-grabbing">
                {activeScene?.image ? (
                  <DynamicVirtualTour
                    key={activeScene.image}
                    image={activeScene.image}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-white/50 text-sm font-sans uppercase tracking-widest">
                    No panorama available for this area
                  </div>
                )}
              </div>
              
              {/* 3. BOTTOM THUMBNAIL STRIP: POSITIONED ABOVE PANNELLUM CONTROLS */}
              {currentAreas.length > 1 && (() => {
                const startIndex = currentAreas.length <= maxVisible 
                  ? 0 
                  : Math.max(0, Math.min(activeRoomIndex - (maxVisible - 1), currentAreas.length - maxVisible));
                
                const visibleAreas = currentAreas.slice(startIndex, startIndex + maxVisible);

                return (
                  // Uses bottom-16 on mobile (64px) to clear Pannellum's control bar comfortably, and bottom-8 on desktop
                  <div className="absolute bottom-16 md:bottom-8 left-1/2 -translate-x-1/2 z-40 pointer-events-auto flex items-center gap-1 sm:gap-2 bg-black/65 hover:bg-black/75 backdrop-blur-2xl px-2.5 py-2 sm:px-4 sm:py-3 rounded-[22px] md:rounded-[28px] border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.6)] max-w-[96vw]">
                    
                    {/* Left Arrow */}
                    <button
                      type="button"
                      onClick={() => setActiveRoomIndex((prev) => (prev - 1 + currentAreas.length) % currentAreas.length)}
                      className="p-1 sm:p-1.5 text-white/70 hover:text-white transition-colors cursor-pointer shrink-0"
                      aria-label="Previous view area"
                    >
                      <ChevronLeft size={18} className="md:w-[22px] md:h-[22px]" strokeWidth={2.5} />
                    </button>

                    {/* Sliding Thumbnails: 3 on mobile, 6 on desktop */}
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
                            {/* Area Title */}
                            <span
                              className={`text-center font-sans tracking-tight transition-all duration-200 max-w-[62px] sm:max-w-[72px] md:max-w-[85px] truncate ${
                                isSelected
                                  ? 'text-white text-[11px] sm:text-[13px] md:text-[15px] font-semibold scale-105'
                                  : 'text-white/65 text-[9px] sm:text-[11px] md:text-[12px] font-normal group-hover:text-white'
                              }`}
                            >
                              {area.title || `Area ${originalIndex + 1}`}
                            </span>

                            {/* Thumbnail */}
                            <div
                              className={`relative w-14 h-10 sm:w-16 sm:h-12 md:w-20 md:h-14 rounded-lg md:rounded-xl overflow-hidden transition-all duration-200 ${
                                isSelected
                                  ? 'border-2 border-[#d4b26f] shadow-[0_0_12px_rgba(212,178,111,0.5)] scale-105'
                                  : 'border border-white/20 opacity-70 group-hover:opacity-100 group-hover:border-white/50'
                              }`}
                            >
                              <img
                                src={area.image}
                                alt={area.title || `Area ${originalIndex + 1}`}
                                className="w-full h-full object-cover"
                              />
                              {!isSelected && (
                                <div className="absolute inset-0 bg-black/25 group-hover:bg-transparent transition-colors" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Right Arrow */}
                    <button
                      type="button"
                      onClick={() => setActiveRoomIndex((prev) => (prev + 1) % currentAreas.length)}
                      className="p-1 sm:p-1.5 text-white/70 hover:text-white transition-colors cursor-pointer shrink-0"
                      aria-label="Next view area"
                    >
                      <ChevronRight size={18} className="md:w-[22px] md:h-[22px]" strokeWidth={2.5} />
                    </button>

                </div>
                );
              })()}

            </div>
          );
        })()}

      </div>
    </PageTransition>
  );
}