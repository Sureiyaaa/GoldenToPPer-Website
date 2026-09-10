'use client';

import { useEffect, useRef, useState } from 'react';
import Image from "next/image";
import { Layers, Target, Key, MapPin, ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// Transparent 1x1 Pixel Base64
const BLANK_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

function DummyMapSection() {
  return (
    <section className="relative py-24 bg-[#0A1128] overflow-hidden flex items-center min-h-[900px]">
      <div className="absolute inset-0 z-0 opacity-20" style={{ backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-brand-gold/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-brand-blue/30 rounded-full blur-[150px] pointer-events-none z-0" />
      <div className="max-w-[90rem] mx-auto px-6 md:px-12 relative z-20 flex flex-col items-center w-full">
        <div className="mb-12 text-center">
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-serif font-light leading-tight mb-4 text-white">
            Points of <span className="text-brand-gold">Interest</span>
          </h2>
          <p className="text-center font-light leading-relaxed text-white/70 text-lg md:text-xl max-w-2xl mx-auto">
            Everything you need, strategically positioned right around your sanctuary.
          </p>
        </div>
        <div className="w-full h-[500px] p-2 md:p-4 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
           <span className="text-brand-gold font-bold uppercase tracking-widest text-sm">Interactive Map disabled in Live Preview</span>
        </div>
      </div>
    </section>
  );
}

export default function PreviewSkeleton({ data }: { data: any }) {
  const blueprintSectionRef = useRef<HTMLElement>(null);
  
  // --- DRAG TO SCROLL STATE ---
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const targetScroll = useRef(0);
  const currentScroll = useRef(0);
  const rafId = useRef<number | null>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);

  // 1. SMOOTH LERP LOOP
  useEffect(() => {
    const smoothDrag = () => {
      if (scrollContainerRef.current) {
        currentScroll.current += (targetScroll.current - currentScroll.current) * 0.08;
        scrollContainerRef.current.scrollLeft = currentScroll.current;
      }
      rafId.current = requestAnimationFrame(smoothDrag);
    };
    rafId.current = requestAnimationFrame(smoothDrag);
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
  }, []);

  // 2. DRAG HANDLERS
  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!scrollContainerRef.current) return;
    isDragging.current = true; setIsGrabbing(true);
    const pageX = 'touches' in e ? e.touches[0].pageX : e.pageX;
    startX.current = pageX;
    targetScroll.current = scrollContainerRef.current.scrollLeft;
    currentScroll.current = scrollContainerRef.current.scrollLeft;
  };

  const onDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current || !scrollContainerRef.current) return;
    const pageX = 'touches' in e ? e.touches[0].pageX : e.pageX;
    const delta = (startX.current - pageX) * 2;
    targetScroll.current += delta;
    startX.current = pageX;
    const maxScroll = scrollContainerRef.current.scrollWidth - scrollContainerRef.current.clientWidth;
    targetScroll.current = Math.max(0, Math.min(targetScroll.current, maxScroll));
  };

  const onDragEnd = () => { isDragging.current = false; setIsGrabbing(false); };

  // GSAP Animations scoped to the right-side split screen container
  useEffect(() => {
    let ctx = gsap.context(() => {
      // Stacking Cards for Blueprints
      if (data.unit_layout?.length > 0) {
        const blueprintCards = gsap.utils.toArray('.blueprint-card');
        blueprintCards.forEach((card: any, i) => {
          if (i !== blueprintCards.length - 1) {
            gsap.to(card, {
              scale: 0.92,
              opacity: 0.4,
              filter: "blur(4px)",
              scrollTrigger: {
                trigger: blueprintCards[i + 1] as HTMLElement,
                scroller: "#preview-scroller", // <--- IMPORTANT FOR SPLIT SCREEN
                start: "top 85%",
                end: "top 20%",
                scrub: true,
              }
            });
          }
        });
      }
    });

    return () => ctx.revert();
  }, [data]); 

  // Format Tags
  const dbTags = data.project_tag?.map((pt: any) => ({
    label: pt.tags?.tag_name || '',
    icon: <Layers size={16} /> 
  })).filter((tag: any) => tag.label !== '') || [];

  const displayTags = [
    ...dbTags,
    { label: data.sqm, icon: <Target size={16} /> },
    { label: data.unit_total, icon: <Key size={16} /> },
  ].filter(tag => tag.label && tag.label !== '0-0 SQM' && tag.label !== '0 Units');

  return (
    <div className="relative font-sans text-gray-900 bg-[#E7E7E7] overflow-x-hidden">
      
      {/* --- HERO SECTION --- */}
      <section className="relative h-[85vh] w-full overflow-hidden pointer-events-none bg-gray-900">
        <div className="absolute inset-0">
          <Image 
            src={data.image || BLANK_IMAGE}
            alt={data.title} fill sizes="100vw" priority className="object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-black/40" />

        <div className="absolute inset-0 flex flex-col justify-end px-6 pb-16 md:px-12 md:pb-24 max-w-[90rem] mx-auto w-full">
          <div className="flex flex-col md:flex-row justify-between items-end w-full">
            <div className="flex flex-col w-full md:w-auto">
              <h1 className="text-5xl md:text-8xl font-serif mb-5 drop-shadow-2xl py-2">
                <span className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-brand-gold via-[#fff2cd] to-brand-gold pr-4 pb-2 pt-1">
                  {data.title || 'Project Title'}
                </span>
              </h1>
              <div className="flex items-center gap-2 mb-10 text-white/80">
                <span className="text-brand-gold"><MapPin size={18} /></span>
                <span className="text-xs md:text-sm font-bold uppercase tracking-[0.3em]">
                  {data.city || 'City'}, {data.country || 'Country'}
                </span>
              </div>
            </div>

            {/* LIVE DOT PROPERTY AWARDS BADGE RENDERING */}
            {data.img_awards && data.img_awards !== '' && (
              <div className="hidden lg:block mb-10">
                <Image 
                  src={data.img_awards} alt="Award" width={350} height={120}
                  className="object-contain drop-shadow-2xl"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-8">
            <div className="flex flex-wrap gap-4">
              {displayTags.map((tag, index) => (
                <span key={index} className="flex items-center gap-3 px-6 py-3 rounded-sm border border-white/30 bg-black/30 backdrop-blur-xl text-white text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] shadow-2xl">
                  <span className="text-brand-gold">{tag.icon}</span>
                  {tag.label}
                </span>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full sm:w-auto">
              <div className="group relative flex items-center justify-center gap-6 w-fit bg-brand-blue px-8 py-4 overflow-hidden rounded-sm shadow-lg">
                <span className="relative z-10 text-[11px] tracking-[0.25em] font-bold text-white uppercase">Inquire Now</span>
                <ArrowRight size={16} className="relative z-10 text-white" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- EDITORIAL SECTION --- */}
      {data.extended_description?.length > 0 && (
  <section 
    className="relative min-h-screen py-24 flex items-center pointer-events-none"
    style={{ 
      background: `linear-gradient(to bottom, #ffffff 0%, #ffffff 65%, ${
        data.extended_description[0]?.editorial_bg_color && data.extended_description[0]?.editorial_bg_color !== 'transparent'
          ? data.extended_description[0].editorial_bg_color
          : '#ffffff'
      } 100%)` 
    }}
  >
          {/* THE FIX: Added `lg:h-[600px]` to lock the grid's height. This stops the wrapper from re-centering on every keystroke. */}
          <div className="max-w-[90rem] mx-auto px-6 md:px-12 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center lg:h-[600px]">
            
            {/* IMAGE CONTAINER: Changed to h-full so it perfectly matches the 600px grid height on desktop */}
            <div className="relative w-full h-[400px] lg:h-full rounded-sm overflow-hidden shadow-2xl bg-gray-200 border border-gray-300">
              <Image 
                src={data.extended_description[0]?.editorial_img || BLANK_IMAGE} 
                alt="Editorial" 
                fill 
                className="object-cover"
              />
            </div>

            {/* TEXT CONTAINER: Added h-full and justify-center to stay vertically centered within the locked box */}
            <div className="flex flex-col gap-8 items-start justify-center h-full overflow-hidden">
              
              <h2 
                className="font-serif text-2xl sm:text-3xl lg:text-[36px] xl:text-[44px] leading-[1.18] transition-colors duration-300 shrink-0"
                style={{ color: data.extended_description[0]?.editorial_title_color || '#132243' }}
              >
                {(data.extended_description[0]?.editorial_title || 'Editorial Headline').split('\n').map((line: string, idx: number) => (
                  <span key={idx} className="block whitespace-nowrap">
                    {line}
                  </span>
                ))}
              </h2>
              <div className="space-y-6 overflow-y-auto w-full pr-2" style={{ scrollbarWidth: 'thin' }}>
                <p 
                  className="text-lg leading-relaxed text-justify whitespace-pre-line transition-colors duration-300"
                  style={{ color: data.extended_description[0]?.editorial_desc_color || '#4B5563' }}
                >
                  {data.extended_description[0]?.editorial_long || 'Write your description here...'}
                </p>
              </div>
            </div>

          </div>
        </section>
      )}
      
      {/* --- AMENITIES HORIZONTAL SCROLL SECTION --- */}
      {data.amenities?.length > 0 && (
        <section className="relative w-full h-screen bg-[#132243] flex flex-col justify-center overflow-hidden py-16 md:py-20">
          <div className="max-w-[90rem] px-6 md:px-12 w-full mx-auto mb-6 md:mb-10 shrink-0 pointer-events-none">
            <div className="text-xs tracking-widest uppercase text-brand-gold font-bold mb-2 md:mb-4 flex items-center gap-4">
              Amenities & Facilities
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif leading-tight text-white">
              {data.extended_description[0]?.amenities_title} <br />
              <span className="text-brand-gold">{data.extended_description[0]?.amenities_title_gold}</span>
            </h2>
          </div>

          <div 
            ref={scrollContainerRef}
            onMouseDown={onDragStart} onMouseLeave={onDragEnd} onMouseUp={onDragEnd} onMouseMove={onDragMove}
            onTouchStart={onDragStart} onTouchEnd={onDragEnd} onTouchMove={onDragMove}
            className={`flex gap-8 md:gap-10 px-6 md:px-12 w-full overflow-x-hidden items-start ${isGrabbing ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', touchAction: 'pan-y' }}
          >
            <style dangerouslySetInnerHTML={{ __html: `::-webkit-scrollbar { display: none; }` }} />
            
            {data.amenities.map((item: any, index: number) => (
              <div key={item.id || index} className="shrink-0 w-[80vw] md:w-[45vw] lg:w-[32vw] flex flex-col group pointer-events-none select-none">
                <div className="relative h-[40vh] min-h-[220px] max-h-[380px] w-full overflow-hidden rounded-sm bg-gray-800 border border-white/10 shadow-2xl pointer-events-auto">
                  <Image src={item.thumbnail || BLANK_IMAGE} alt={item.title} fill draggable="false" className="object-cover pointer-events-none select-none" />
                  <div className="absolute inset-0 bg-black/10 pointer-events-none"></div>
                </div>
                <div className="mt-5 flex flex-col gap-2 pr-4 pointer-events-none select-none">
                  <div className="flex items-center gap-3">
                    <span className="text-brand-gold font-mono text-sm">0{index + 1}</span>
                    <h3 className="text-xl md:text-2xl font-serif text-white">{item.title || 'Amenity Title'}</h3>
                  </div>
                  <p className="text-white/60 text-xs md:text-sm leading-relaxed pl-7 border-l border-white/10 line-clamp-3">
                    {item.description || 'Amenity description...'}
                  </p>
                </div>
              </div>
            ))}
            <div className="w-[10vw] shrink-0 pointer-events-none"></div>
          </div>
        </section>
      )}

      {/* --- ROOM BLUEPRINTS SECTION --- */}
      {data.unit_layout?.length > 0 && (
        <section id="blueprints" ref={blueprintSectionRef} className="relative w-full py-32 bg-transparent z-10 pointer-events-none">
          <div className="max-w-[75rem] mx-auto px-6 md:px-12 relative">
            <div className="mb-24 text-center">
              <div className="text-xs tracking-widest uppercase text-brand-blue font-bold mb-4 flex items-center justify-center gap-4">
                Room Blueprints
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-7xl font-serif text-brand-blue leading-tight">
                Design Your <span className=" text-brand-gold">Sanctuary</span>
              </h2>
            </div>

            <div className="relative pb-[10vh]">
              {data.unit_layout.map((plan: any, index: number) => (
                <div key={plan.id || index} className="blueprint-card sticky top-[15vh] w-full min-h-[60vh] lg:h-[65vh] bg-white rounded-xl shadow-[0_-10px_40px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden flex flex-col lg:flex-row mb-12 origin-top" style={{ zIndex: index + 1 }}>
                  <div className="w-full lg:w-2/5 bg-[#F9F9FA] p-8 md:p-12 lg:p-16 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-gray-200">
                    <div className="text-brand-gold font-mono text-sm mb-4">0{index + 1}</div>
                    <h3 className="text-3xl md:text-4xl lg:text-5xl font-serif text-brand-blue mb-4">{plan.title || 'Layout Title'}</h3>
                    <p className="font-sans tracking-widest text-brand-blue/80 font-bold text-sm md:text-base mb-8 uppercase">
                      {plan.min_sqm || '0'} - {plan.max_sqm || '0'} SQM
                    </p>
                    <p className="text-gray-600 leading-relaxed text-sm md:text-base">{plan.description || 'Description...'}</p>
                  </div>
                  <div className="w-full lg:w-3/5 relative p-8 md:p-12 bg-white flex items-center justify-center border-l border-gray-100">
                    <div className="relative w-full h-full min-h-[350px] lg:min-h-full">
                      <Image src={plan.thumbnail || BLANK_IMAGE} alt={plan.title} fill className="object-contain drop-shadow-2xl" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* --- MAP SECTION --- */}
      <DummyMapSection />
    </div>
  );
}