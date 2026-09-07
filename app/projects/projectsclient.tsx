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
import { ArrowRight, Move3d, X, ChevronLeft, ChevronRight } from 'lucide-react';

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

// Dynamic import for the 360 viewer to prevent server-side errors
const DynamicVirtualTour = dynamic(() => import('@/app/components/VirtualTour'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d1b3e]">
      <Move3d size={40} className="text-brand-gold animate-bounce mb-4" />
      <p className="text-brand-gold animate-pulse tracking-widest text-sm font-bold uppercase">Loading 360° Engine...</p>
    </div>
  ),
});

export default function ProjectsClient({ initialProjects }: { initialProjects: any[] }) {
  const projectsRefs = useRef<(HTMLDivElement | null)[]>([]);

  // === STATE FOR FULLSCREEN VIRTUAL TOUR GALLERY ===
  const [activeTourRooms, setActiveTourRooms] = useState<any[] | null>(null);
  const [activeRoomIndex, setActiveRoomIndex] = useState(0);

  // Lock body scroll when the 360 modal is open
  useEffect(() => {
    if (activeTourRooms) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [activeTourRooms]);

  // ==========================================
  // BULLETPROOF SCROLL REFRESH & GSAP SYNC
  // ==========================================
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

  // ==========================================
  // GSAP Animation for Project Cards
  // ==========================================
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

                  // === NEW GALLERY EXTRACTION ===
                  let tourRooms: any[] | null = null;
                  let legacyFallbackImage = project.virtual_tour_url || null;

                  if (project.virtual_tours && project.virtual_tours.length > 0) {
                    let roomsData = project.virtual_tours[0].rooms;
                    
                    if (typeof roomsData === 'string') {
                      try { roomsData = JSON.parse(roomsData); } catch (e) { console.error(e); }
                    }

                    // If we have an array of rooms with actual images, save the whole array!
                    if (Array.isArray(roomsData) && roomsData.length > 0 && roomsData[0]?.image) {
                      tourRooms = roomsData;
                    }
                  }
                  // ===================================

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

                        {/* Normalized Units List */}
                        <div className="mb-12 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-gray-600">
                          {project.units?.map((unitTitle: string, i: number) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-brand-gold"></span>
                              {unitTitle}
                            </div>
                          ))}
                        </div>

                        {/* --- HIERARCHICAL BUTTON GROUP --- */}
                        <div className="flex flex-col gap-3 w-full md:w-[90%]">

                          {/* 1. PRIMARY ACTION (Solid & Heavy) */}
                          <Link href={'/inquire'} className="group relative flex items-center justify-center gap-4 w-full bg-brand-blue text-white px-8 py-4 rounded-sm shadow-md overflow-hidden transition-all hover:shadow-xl outline-none">
                            <span className="absolute inset-0 w-full h-full bg-brand-gold transform -translate-x-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0"></span>
                            <span className="relative z-10 text-[11px] tracking-[0.25em] font-bold uppercase group-hover:text-brand-blue transition-colors duration-500">Inquire Now</span>
                            <ArrowRight size={16} className="relative z-10 group-hover:text-brand-blue transition-colors duration-500" />
                          </Link>

                          <div className="flex flex-col sm:flex-row gap-3 w-full">

                            {/* 2. SECONDARY ACTION (360 Tour Trigger) */}
                            {(tourRooms || legacyFallbackImage) && (
                              <button
                                onClick={() => {
                                  if (tourRooms) {
                                    setActiveTourRooms(tourRooms);
                                    setActiveRoomIndex(0);
                                  } else if (legacyFallbackImage) {
                                    setActiveTourRooms([{ title: 'Virtual Tour', image: legacyFallbackImage }]);
                                    setActiveRoomIndex(0);
                                  }
                                }}
                                className="group flex-1 flex items-center justify-center gap-3 bg-transparent border border-gray-300 px-4 py-3.5 rounded-sm hover:border-brand-gold hover:bg-brand-gold/5 transition-all duration-300 outline-none cursor-pointer"
                              >
                                <Move3d size={14} className="text-brand-blue group-hover:text-brand-gold transition-colors" />
                                <span className="text-[10px] tracking-[0.2em] font-bold text-brand-blue uppercase group-hover:text-brand-gold transition-colors">
                                  {tourRooms && tourRooms.length > 1 ? '360° Gallery' : '360° Tour'}
                                </span>
                              </button>
                            )}

                            {/* 3. TERTIARY ACTION (View Details) */}
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
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-20 text-gray-500">No projects available at the moment.</div>
            )}
          </div>
        </main>

        <Footer />
        <BackToTop />

        {/* === FULLSCREEN VIRTUAL TOUR GALLERY MODAL === */}
        {activeTourRooms && (
          <div className="fixed inset-0 z-[9999] bg-black animate-in fade-in duration-500 flex flex-col">
            
            {/* Top Bar / Close Button */}
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black/80 to-transparent z-50 flex justify-between items-start p-6 md:p-8 pointer-events-none">
              <div className="pointer-events-auto flex flex-col items-start gap-2">
                <span className="text-brand-gold text-[10px] font-bold uppercase tracking-[0.2em] bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
                  360° Virtual Tour
                </span>
                {/* Dynamic Room Title */}
                <h3 className="text-white font-serif text-xl md:text-2xl ml-2 drop-shadow-md">
                  {activeTourRooms[activeRoomIndex]?.title || 'Virtual Tour'}
                </h3>
              </div>

              <button
                onClick={() => { setActiveTourRooms(null); setActiveRoomIndex(0); }}
                className="pointer-events-auto group flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-3 rounded-full border border-white/10 shadow-lg hover:bg-brand-gold transition-all duration-300 cursor-pointer outline-none"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-white group-hover:text-brand-blue hidden sm:block">Close Tour</span>
                <X size={16} className="text-white group-hover:text-brand-blue" />
              </button>
            </div>

            {/* The 360 Viewer */}
            <div className="flex-1 w-full h-full cursor-grab active:cursor-grabbing">
              <DynamicVirtualTour 
                key={activeTourRooms[activeRoomIndex]?.image} 
                image={activeTourRooms[activeRoomIndex]?.image} 
              />
            </div>

            {/* Navigation Controls (Only show if there is more than 1 room) */}
            {activeTourRooms.length > 1 && (
              <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-6 bg-black/60 backdrop-blur-lg px-6 py-3 rounded-full border border-white/10 shadow-2xl pointer-events-auto">
                <button 
                  onClick={() => setActiveRoomIndex((prev) => (prev - 1 + activeTourRooms.length) % activeTourRooms.length)} 
                  className="p-2 text-white hover:text-brand-gold transition-colors outline-none cursor-pointer"
                >
                  <ChevronLeft size={24} />
                </button>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Room</span>
                  <span className="text-brand-gold text-xs font-bold tracking-[0.2em]">
                    {activeRoomIndex + 1} / {activeTourRooms.length}
                  </span>
                </div>
                <button 
                  onClick={() => setActiveRoomIndex((prev) => (prev + 1) % activeTourRooms.length)} 
                  className="p-2 text-white hover:text-brand-gold transition-colors outline-none cursor-pointer"
                >
                  <ChevronRight size={24} />
                </button>
              </div>
            )}

          </div>
        )}

      </div>
    </PageTransition>
  );
}