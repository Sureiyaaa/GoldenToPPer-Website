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
              
             {/* TOP BAR */}
              <div className="absolute top-0 left-0 w-full h-28 bg-gradient-to-b from-black/85 via-black/40 to-transparent z-50 flex items-start justify-between p-6 pointer-events-none">
                <div className="pointer-events-auto flex flex-col items-start gap-2.5">
                  
                  {/* Badge */}
                  <div className="flex items-center gap-1.5 px-4 py-1.5 bg-black/80 backdrop-blur-md rounded-full border border-[#D4AF37]/30 shadow-lg">
                    <span className="text-[#D4AF37] font-serif text-[11px] font-bold tracking-widest uppercase">
                      360° Virtual Tour
                    </span>
                  </div>

                  {/* Dropdown Selectors */}
                  <div className="flex items-center gap-3 relative">
                    
                    {/* 1. CUSTOM PROJECT DROPDOWN */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setIsProjectDropdownOpen(!isProjectDropdownOpen);
                          setIsUnitDropdownOpen(false);
                        }}
                        className="bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_10px_25px_rgba(0,0,0,0.25)] px-4 py-2 border border-white/80 flex flex-col justify-center min-w-[160px] text-left cursor-pointer transition-all duration-200 hover:bg-white active:scale-95 outline-none"
                      >
                        <span className="text-[9px] font-extrabold tracking-[0.15em] text-[#D4AF37] uppercase font-sans">
                          Project
                        </span>
                        <div className="flex items-center justify-between gap-3 mt-0.5">
                          <span className="text-[15px] font-bold text-[#142f72] font-sans tracking-tight truncate">
                            {activeTourProject.name || activeTourProject.title}
                          </span>
                          <ChevronDown 
                            size={17} 
                            strokeWidth={2.5} 
                            className={`text-[#142f72] shrink-0 transition-transform duration-300 ${isProjectDropdownOpen ? 'rotate-180' : ''}`} 
                          />
                        </div>
                      </button>

                      {/* Project Options Menu */}
                      {isProjectDropdownOpen && (
                        <div className="absolute top-[calc(100%+8px)] left-0 w-full min-w-[180px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_15px_35px_rgba(0,0,0,0.3)] border border-white/80 py-1.5 z-[70] animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
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
                                  className={`w-full px-4 py-2.5 text-left text-[14px] font-bold font-sans transition-colors flex items-center justify-between cursor-pointer ${
                                    isSelected 
                                      ? 'bg-[#142f72]/10 text-[#142f72]' 
                                      : 'text-gray-700 hover:bg-[#142f72]/5 hover:text-[#142f72]'
                                  }`}
                                >
                                  <span>{p.name || p.title}</span>
                                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />}
                                </button>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    {/* 2. CUSTOM UNIT DROPDOWN */}
                    {availableUnits.length > 0 && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setIsUnitDropdownOpen(!isUnitDropdownOpen);
                            setIsProjectDropdownOpen(false);
                          }}
                          className="bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_10px_25px_rgba(0,0,0,0.25)] px-4 py-2 border border-white/80 flex flex-col justify-center min-w-[160px] text-left cursor-pointer transition-all duration-200 hover:bg-white active:scale-95 outline-none"
                        >
                          <span className="text-[9px] font-extrabold tracking-[0.15em] text-[#D4AF37] uppercase font-sans">
                            Unit
                          </span>
                          <div className="flex items-center justify-between gap-3 mt-0.5">
                            <span className="text-[15px] font-bold text-[#142f72] font-sans tracking-tight truncate">
                              {activeTourUnit?.unit_name || activeTourUnit?.title || 'Standard Unit'}
                            </span>
                            <ChevronDown 
                              size={17} 
                              strokeWidth={2.5} 
                              className={`text-[#142f72] shrink-0 transition-transform duration-300 ${isUnitDropdownOpen ? 'rotate-180' : ''}`} 
                            />
                          </div>
                        </button>

                        {/* Unit Options Menu */}
                        {isUnitDropdownOpen && (
                          <div className="absolute top-[calc(100%+8px)] left-0 w-full min-w-[180px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_15px_35px_rgba(0,0,0,0.3)] border border-white/80 py-1.5 z-[70] animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
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
                                  className={`w-full px-4 py-2.5 text-left text-[14px] font-bold font-sans transition-colors flex items-center justify-between cursor-pointer ${
                                    isSelected 
                                      ? 'bg-[#142f72]/10 text-[#142f72]' 
                                      : 'text-gray-700 hover:bg-[#142f72]/5 hover:text-[#142f72]'
                                  }`}
                                >
                                  <span>{u.unit_name || u.title || 'Standard Unit'}</span>
                                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => {
                    setActiveTourProject(null);
                    setActiveTourUnit(null);
                    setActiveRoomIndex(0);
                    setIsProjectDropdownOpen(false);
                    setIsUnitDropdownOpen(false);
                  }}
                  className="pointer-events-auto group flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10 shadow-lg hover:bg-[#d0b370] transition-all duration-300 cursor-pointer outline-none"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white group-hover:text-black">
                    Close Tour
                  </span>
                  <X size={14} className="text-white group-hover:text-black" />
                </button>
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

              {/* 3. BOTTOM THUMBNAIL STRIP: VIEW AREAS (Kitchen, CR, Balcony) */}
              {currentAreas.length > 1 && (
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 pointer-events-auto flex flex-col items-center">
                  <div className="mb-2 px-3.5 py-1 bg-black/75 backdrop-blur-md rounded-md text-[11px] font-semibold text-white tracking-wide border border-white/10 shadow-md">
                    {activeScene?.title || `Area ${activeRoomIndex + 1}`}
                  </div>

                  <div className="flex items-center gap-2 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/15 shadow-2xl">
                    <button
                      onClick={() => setActiveRoomIndex((prev) => (prev - 1 + currentAreas.length) % currentAreas.length)}
                      className="p-1 text-white/70 hover:text-white transition-colors"
                    >
                      <ChevronLeft size={18} />
                    </button>

                    <div className="flex items-center gap-2.5 max-w-[70vw] overflow-x-auto py-1 px-1">
                      {currentAreas.map((area: any, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => setActiveRoomIndex(idx)}
                          className={`relative w-14 h-11 rounded-lg overflow-hidden shrink-0 border-2 transition-all duration-300 group cursor-pointer ${
                            activeRoomIndex === idx
                              ? 'border-[#D4AF37] scale-105 shadow-[0_0_12px_rgba(212,175,55,0.6)]'
                              : 'border-white/20 opacity-60 hover:opacity-100 hover:border-white/60'
                          }`}
                        >
                          <img src={area.image} alt={area.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/25 group-hover:bg-transparent transition-colors" />
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setActiveRoomIndex((prev) => (prev + 1) % currentAreas.length)}
                      className="p-1 text-white/70 hover:text-white transition-colors"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}

            </div>
          );
        })()}
      </div>
    </PageTransition>
  );
}