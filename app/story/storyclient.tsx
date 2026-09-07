'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import Lenis from 'lenis';
import { motion } from 'framer-motion'; 

import Navbar from '../components/navbar';
import Footer from '../components/footer';
import BackToTop from '../components/backtotop';
import PageTransition from '../components/page-transitions'; 

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

// We now accept the data dynamically via props!
export default function StoryClient({ milestones }: { milestones: any[] }) {
  const pageRef = useRef<HTMLDivElement>(null);
  const timelineWrapperRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  // Hardcoded stats 
  const companyStats = [
    { value: 10, suffix: "+", label: "Projects under Development" },
    { value: 200, suffix: "+", label: "Professionals in Our Team" },
    { value: 300, suffix: "K+", label: "Landbank Area Covered (sqm)" }
  ];

  useEffect(() => {
    window.history.scrollRestoration = 'manual';

    const lenis = new Lenis({
      duration: 1.5,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
      touchMultiplier: 2,
      syncTouch: false, // <-- Added this so mobile scrolling is native and smooth!
    });

    setTimeout(() => {
      window.scrollTo(0, 0);
      lenis.scrollTo(0, { immediate: true });
      ScrollTrigger.refresh(); 
    }, 50);

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove((time) => lenis.raf(time * 1000));
    };
  }, []);

  useGSAP(() => {
    // --- Animated Counters ---
    gsap.utils.toArray('.stat-num').forEach((el: any) => {
      const targetVal = parseFloat(el.getAttribute('data-target'));
      gsap.to(el, {
        innerHTML: targetVal,
        duration: 2.5,
        snap: { innerHTML: 1 },
        ease: "power2.out",
        scrollTrigger: {
          trigger: '.stats-section',
          start: "top 85%",
        }
      });
    });

    // --- The Draw-on-Scroll Timeline Line ---
    gsap.fromTo(lineRef.current,
      { height: "0%" },
      {
        height: "100%",
        ease: "none",
        scrollTrigger: {
          trigger: timelineWrapperRef.current,
          start: "top 35%",
          end: "bottom 50%",
          scrub: true,
        }
      }
    );

    // --- Timeline Nodes & Text Animations ---
    gsap.utils.toArray('.milestone-row').forEach((row: any, i: number) => {
      
      // Background & Ghost Year Crossfade
      ScrollTrigger.create({
        trigger: row,
        start: "top 50%",
        end: "bottom 50%",
        onToggle: (self) => {
          if (self.isActive) {
            gsap.to('.bg-image', { opacity: 0, duration: 1, ease: "power2.inOut", overwrite: "auto" });
            gsap.to(`.bg-image-${i}`, { opacity: 0.5, duration: 1, ease: "power2.inOut", overwrite: "auto" });

            gsap.to('.ghost-year', { opacity: 0, scale: 0.9, duration: 0.5, overwrite: "auto" });
            gsap.to(`.ghost-year-${i}`, { opacity: 0.05, scale: 1, duration: 1, ease: "power3.out", overwrite: "auto" });
          }
        },
        onLeaveBack: () => {
          if (i === 0) gsap.to('.ghost-year', { opacity: 0, scale: 0.9, duration: 0.5, overwrite: "auto" });
        },
        onLeave: () => {
          if (i === milestones.length - 1) gsap.to('.ghost-year', { opacity: 0, scale: 0.9, duration: 0.5, overwrite: "auto" });
        }
      });

      // Masked Text Reveal
      gsap.fromTo(row.querySelectorAll('.reveal-text'),
        { y: "150%", rotate: 2 },
        {
          y: "0%", rotate: 0, duration: 1, stagger: 0.1, ease: "power4.out",
          scrollTrigger: {
            trigger: row,
            start: "top 65%",
            toggleActions: "play reverse play reverse",
          }
        }
      );

      // Pulsing Dot Activation
      const dot = row.querySelector('.milestone-dot');
      const pulse = row.querySelector('.milestone-pulse');

      ScrollTrigger.create({
        trigger: row,
        start: "top 50%",
        toggleActions: "play reverse play reverse",
        onEnter: () => {
          gsap.to(dot, { scale: 1, backgroundColor: "var(--color-brand-gold)", duration: 0.4, ease: "back.out(2)", overwrite: "auto" });
          gsap.fromTo(pulse,
            { scale: 0.8, opacity: 1 },
            { scale: 2.5, opacity: 0, duration: 1.5, repeat: -1, ease: "power2.out", overwrite: "auto" }
          );
        },
        onLeaveBack: () => {
          gsap.to(dot, { scale: 0, backgroundColor: "transparent", duration: 0.3, overwrite: "auto" });
          gsap.killTweensOf(pulse);
          gsap.set(pulse, { opacity: 0 });
        }
      });
    });

    // --- General 3D Reveals ---
    gsap.utils.toArray('.reveal-up').forEach((el: any) => {
      gsap.from(el, {
        y: 80,
        opacity: 0,
        rotationX: 10,
        transformOrigin: "top center",
        duration: 1.4,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
        },
      });
    });

  }, { scope: pageRef, dependencies: [milestones] }); // Added dependencies for safety

  return (
    <PageTransition> 
      <div ref={pageRef} className="relative bg-[#050B14] text-white font-sans selection:bg-brand-gold selection:text-white flex flex-col min-h-screen" style={{ overflowAnchor: 'none' }}>

        {/* ================= NAVBAR ================= */}
        <div className="absolute top-0 left-0 w-full z-[100]">
          <Navbar />
        </div>

        {/* ================= FIXED TIMELINE BACKGROUNDS ================= */}
        <div className="fixed inset-0 w-full h-full z-0 pointer-events-none bg-[#050B14]">
          {milestones.map((ms, idx) => (
            <div
              key={`bg-${idx}`}
              className={`bg-image bg-image-${idx} absolute inset-0 bg-cover bg-center ${idx === 0 ? 'opacity-50' : 'opacity-0'} will-change-[opacity]`}
              style={{ backgroundImage: `url(${ms.img})` }}
            />
          ))}

          <div className="absolute inset-0 bg-[#050B14]/40 z-0"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-[#050B14]/90 via-transparent to-[#050B14]/90 z-0"></div>

          <div className="absolute inset-0 flex items-center justify-center overflow-hidden z-0">
            {milestones.map((ms, idx) => (
              <div
                key={`ghost-${idx}`}
                className={`ghost-year ghost-year-${idx} absolute text-[45vw] md:text-[25vw] font-serif font-black text-white tracking-tighter opacity-0 select-none whitespace-nowrap will-change-[opacity,transform]`}
              >
                {ms.year}
              </div>
            ))}
          </div>
        </div>

        <main className="relative z-10 w-full flex flex-col">

          {/* ================= 1. HERO STORY SECTION ================= */}
          <section
            className="relative w-full h-[100vh] md:h-screen min-h-[500px] md:min-h-[650px] flex flex-col justify-center z-10 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/images/story/story_bg.png')" }}
          >
            <div className="absolute inset-0 bg-black/65 z-0"></div>

            <div className="max-w-[90rem] mx-auto w-full px-6 md:px-12 reveal-up relative z-10 flex flex-col items-center text-center">
              
              <div className="flex flex-wrap justify-center text-[0.65rem] text-[12px] sm:text-xs md:text-[18px] tracking-[0.2em] md:tracking-[0.3em] uppercase text-white font-medium mb-6 md:mb-8 gap-4 items-center">
                Our Story 
              </div>
              
              <h1 className="hero-text-update text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-serif font-normal text-white leading-[1.1] md:leading-[1.15] tracking-tight mb-8 md:mb-10 max-w-auto drop-shadow-2xl shadow-black py-2">
                <motion.span 
                  initial={{ backgroundPosition: "200% center" }}
                  animate={{ backgroundPosition: "-200% center" }}
                  transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                  className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-brand-gold via-[#fff2cd] to-brand-gold bg-[length:200%_auto] drop-shadow-[0_0_20px_rgba(208,179,112,0.4)] px-4 py-2 overflow-visible"
                >
                  Better Cities, Better Lives.
                </motion.span>
              </h1>
              
              <p className="text-sm sm:text-base md:text-lg lg:text-xl text-white/90 font-normal leading-relaxed max-w-3xl mx-auto drop-shadow-md mb-10 md:mb-12">
                We don't just build structures; we curate lifestyles. Elevating the standard of living, one iconic project at a time.
              </p>

            </div>
          </section>

          {/* ================= 2. COMPANY INFO & STATS ================= */}
          <section className="w-full bg-white relative z-20 py-16 md:py-32">
            <div className="max-w-[85rem] mx-auto px-6 md:px-12">
              
              <div className="reveal-up mb-10 md:mb-14">
                <h4 className="text-brand-gold font-bold text-xs md:text-sm tracking-widest uppercase mb-4 text-center">
                  About Us
                </h4>
                <h2 className="text-brand-blue text-[34px] sm:text-4xl md:text-6xl lg:text-7xl font-serif md:mb-8 leading-tight md:tracking-normal mb-4 text-center">
                  Better Cities, Better Lives
                </h2>
                <div className="text-gray-900 space-y-6 text-sm md:text-lg font-light leading-relaxed max-w-auto text-justify text-center">
                  <p>
                    Golden Topper is a fast-emerging real estate developer aiming to innovate cities across the Philippines with prime real estate projects. Its brand name “Golden Topper” reflects its core objective of striving for gold and reaching the top.
                  </p>
                  <p>
                    Committed to become the top developer in the Philippine real estate industry, Golden Topper Investments, Inc. sets its sights on the country’s two regions – Luzon and Visayas. Currently, Golden Topper has expanded its portfolio with seven (7) properties in the prime cities of Makati, Pasay, Las Piñas, Cebu, Lapu-Lapu, and Punta Engaño, and plans on reaching more cities across the country.
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row justify-between gap-10 md:gap-0 reveal-up stats-section pt-8 md:pt-10 border-t border-gray-100">
  {companyStats.map((stat, idx) => (
    <div 
      key={idx} 
      className={`flex flex-col ${
        idx === 0 ? 'items-start md:text-left' : 
        idx === 1 ? 'items-start md:items-center md:text-center' : 
        'items-start md:items-end md:text-right'
      }`}
    >
      <div className="text-4xl md:text-6xl lg:text-[4.5rem] font-serif font-medium text-brand-gold mb-2 flex leading-none tracking-tighter">
        <span className="stat-num" data-target={stat.value}>0</span>
        <span>{stat.suffix}</span>
      </div>
      <span className="text-brand-blue text-[10px] md:text-[11px] tracking-[0.2em] uppercase font-bold mt-1">
        {stat.label}
      </span>
    </div>
  ))}
</div>

            </div>
          </section>

          {/* ================= 3. MISSION & VISION SECTION ================= */}
          <section className="w-full bg-[#F9F9F7] relative z-20 py-20 md:py-32 border-t border-gray-200">
            <div className="max-w-[85rem] mx-auto px-6 md:px-12 flex flex-col gap-24 md:gap-32">
              
              {/* ---------------- OUR MISSION ROW ---------------- */}
              <div className="reveal-up flex flex-col md:flex-row items-center gap-10 md:gap-16 lg:gap-24">
                
                {/* Left: Overlapping Images */}
                <div className="w-full md:w-1/2 relative h-[350px] sm:h-[450px] lg:h-[500px]">
                  {/* Main Background Image */}
                  <div className="absolute top-0 left-0 w-[75%] h-[80%] bg-gray-200 rounded-[2rem] overflow-hidden shadow-lg">
                    <img 
                      src="/images/story/mission-1.jpg" 
                      alt="Golden Topper Architecture" 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  {/* Overlapping Foreground Image */}
                  <div className="absolute bottom-0 right-0 w-[65%] h-[65%] bg-gray-300 rounded-[2rem] overflow-hidden shadow-2xl border-[8px] lg:border-[12px] border-[#F9F9F7] z-10">
                    <img 
                      src="/images/story/mission-2.jpg" 
                      alt="Golden Topper Engineers" 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                </div>

                {/* Right: Text Content */}
                <div className="w-full md:w-1/2">
                  <h2 className="text-brand-gold text-4xl lg:text-5xl font-serif mb-6 leading-tight">
                    Our Mission
                  </h2>
                  <p className="text-gray-900 text-sm md:text-base lg:text-lg font-light leading-relaxed mb-8">
                    To redefine city skylines across the Philippines and innovate the real estate landscape by delivering world-class residences, sustainable developments, and high-value properties that elevate the standard of living for every homeowner.
                  </p>
                  
                  {/* Checkmark Bullets */}
                  <div className="flex flex-col gap-5">
                    {[
                      "Delivering World-Class Residences",
                      "Innovating Sustainable Developments",
                      "Creating High-Value Properties",
                      "Elevating the Standard of Living"
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <svg className="w-5 h-5 lg:w-6 lg:h-6 text-brand-gold flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <span className="text-gray-700 text-sm md:text-base font-medium">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* ---------------- OUR VISION ROW ---------------- */}
              <div className="reveal-up flex flex-col md:flex-row-reverse items-center gap-10 md:gap-16 lg:gap-24 mt-8 md:mt-0">
                
                {/* Right: Overlapping Images (Reversed Layout) */}
                <div className="w-full md:w-1/2 relative h-[350px] sm:h-[450px] lg:h-[500px]">
                  {/* Main Background Image */}
                  <div className="absolute bottom-0 right-0 w-[75%] h-[80%] bg-gray-200 rounded-[2rem] overflow-hidden shadow-lg">
                    <img 
                      src="/images/story/vision-1.jpg" 
                      alt="Golden Topper Community" 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  {/* Overlapping Foreground Image */}
                  <div className="absolute top-0 left-0 w-[65%] h-[65%] bg-gray-300 rounded-[2rem] overflow-hidden shadow-2xl border-[8px] lg:border-[12px] border-[#F9F9F7] z-10">
                    <img 
                      src="/images/story/vision-2.jpg" 
                      alt="Golden Topper Development" 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                </div>

                {/* Left: Text Content */}
                <div className="w-full md:w-1/2">
                  <h2 className="text-brand-gold text-4xl lg:text-5xl font-serif mb-6 leading-tight">
                    Our Vision
                  </h2>
                  <p className="text-gray-900 text-sm md:text-base lg:text-lg font-light leading-relaxed mb-8 text-justify">
                    To be the leading real estate developer in the Philippines, driven by the belief of creating "Better Cities, Better Lives" by transforming strategic locations into vibrant, complete communities that offer an unparalleled way of life.
                  </p>
                  
                  {/* Checkmark Bullets */}
                  <div className="flex flex-col gap-5">
                    {[
                      "Leading the Real Estate Industry",
                      "Creating Better Cities, Better Lives",
                      "Transforming Strategic Locations",
                      "Building Vibrant Communities"
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <svg className="w-5 h-5 lg:w-6 lg:h-6 text-brand-gold flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <span className="text-gray-700 text-sm md:text-base font-medium">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          </section>

          {/* ================= 4. TIMELINE SECTION ================= */}
          <section className="w-full bg-transparent relative z-10 pt-16 md:pt-20 pb-20 md:pb-40 text-white">
            <div className="max-w-[90rem] mx-auto px-6 md:px-12">

              <div className="text-center mb-20 md:mb-32 reveal-up">
                <div className="text-xs tracking-widest uppercase text-white/60 font-bold mb-6 flex items-center justify-center gap-4">
                  Our History
                </div>
                <h2 className="text-5xl sm:text-6xl md:text-7xl font-serif leading-[1.1] tracking-tighter pb-4 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
                  A Legacy <br /><span className="text-brand-gold">Built in Time.</span>
                </h2>
              </div>

              <div ref={timelineWrapperRef} className="relative w-full flex flex-col">
                <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-[2px] bg-white/20 -translate-x-1/2"></div>
                <div
                  ref={lineRef}
                  className="absolute left-6 md:left-1/2 top-0 w-[2px] bg-gradient-to-b from-brand-gold to-[#e6c96b] -translate-x-1/2 shadow-[0_0_20px_rgba(208,179,112,1)] z-10"
                  style={{ height: "0%" }}
                ></div>

                {milestones.map((ms, idx) => {
                  const isEven = idx % 2 === 0;
                  const isLast = idx === milestones.length - 1;

                  return (
                    <div key={idx} className="milestone-row relative flex flex-col md:flex-row items-center w-full min-h-[40vh] md:min-h-[60vh] py-12 md:py-20">

                      <div className="absolute left-6 md:left-1/2 -translate-x-1/2 z-20 flex items-center justify-center">
                        <div className="milestone-pulse absolute w-10 h-10 rounded-full border border-brand-gold opacity-0" />
                        <div className={`milestone-dot w-6 h-6 rounded-full border-2 border-brand-gold scale-0 bg-[#050B14] ${isLast ? '' : 'shadow-[0_0_20px_rgba(208,179,112,1)]'}`} />
                      </div>

                      {/* MOBILE TEXT CONTAINER */}
                      <div className="w-full pl-16 pr-4 md:hidden flex flex-col justify-center">
                        <div className="overflow-hidden pb-4">
                          <h2 className="reveal-text text-5xl sm:text-6xl font-serif font-bold text-brand-gold drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">{ms.year}</h2>
                        </div>
                        <div className="overflow-hidden pb-3">
                          <h3 className="reveal-text text-2xl sm:text-3xl font-serif font-semibold text-white leading-tight mb-2 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">{ms.title}</h3>
                        </div>
                        <div className="overflow-hidden pb-2">
                          <p className="reveal-text text-white/90 text-sm sm:text-base font-light leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{ms.desc}</p>
                        </div>
                      </div>

                      {/* DESKTOP LEFT */}
                      <div className="hidden md:flex w-1/2 pr-20 lg:pr-32 flex-col justify-center items-end text-right">
                        {isEven && (
                          <>
                            <div className="overflow-hidden pb-4">
                              <h2 className={`reveal-text font-serif font-bold text-brand-gold drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] mb-2 ${isLast ? 'text-6xl lg:text-7xl' : 'text-7xl lg:text-9xl'}`}>{ms.year}</h2>
                            </div>
                            <div className="overflow-hidden pb-4">
                              <h3 className="reveal-text text-3xl lg:text-xl font-serif font-bold text-white leading-tight drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] mb-4">{ms.title}</h3>
                            </div>
                            <div className="overflow-hidden pb-4">
                              <p className="reveal-text text-white/90 text-lg lg:text-xl font-light leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{ms.desc}</p>
                            </div>
                          </>
                        )}
                      </div>

                      {/* DESKTOP RIGHT */}
                      <div className="hidden md:flex w-1/2 pl-20 lg:pl-32 flex-col justify-center items-start text-left">
                        {!isEven && (
                          <>
                            <div className="overflow-hidden pb-4">
                              <h2 className={`reveal-text font-serif font-bold text-brand-gold drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] mb-2 ${isLast ? 'text-6xl lg:text-7xl' : 'text-7xl lg:text-9xl'}`}>{ms.year}</h2>
                            </div>
                            <div className="overflow-hidden pb-4">
                              <h3 className="reveal-text text-3xl lg:text-xl font-serif font-bold text-white leading-tight drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] mb-4">{ms.title}</h3>
                            </div>
                            <div className="overflow-hidden pb-4">
                              <p className="reveal-text text-white/90 text-lg lg:text-xl font-light leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{ms.desc}</p>
                            </div>
                          </>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </main>

        {/* ================= FOOTER ================= */}
        <div className="relative z-50 bg-[#F9F9F7]">
          <Footer />
          <BackToTop />
        </div>

      </div>
    </PageTransition>
  );
}