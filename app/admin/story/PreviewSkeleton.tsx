'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export default function PreviewSkeleton({ data }: { data: any }) {
  const timelineWrapperRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  // Only the current milestone being edited
  const previewMilestones = [
    { year: data.year, title: data.title, desc: data.description, img: data.image },
  ];

  useEffect(() => {
    let ctx = gsap.context(() => {
      // --- The Draw-on-Scroll Timeline Line ---
      gsap.fromTo(lineRef.current,
        { height: "0%" },
        {
          height: "100%",
          ease: "none",
          scrollTrigger: {
            trigger: timelineWrapperRef.current,
            scroller: "#preview-scroller", 
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
          scroller: "#preview-scroller",
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
            if (i === previewMilestones.length - 1) gsap.to('.ghost-year', { opacity: 0, scale: 0.9, duration: 0.5, overwrite: "auto" });
          }
        });

        // Masked Text Reveal
        gsap.fromTo(row.querySelectorAll('.reveal-text'),
          { y: "150%", rotate: 2 },
          {
            y: "0%", rotate: 0, duration: 1, stagger: 0.1, ease: "power4.out",
            scrollTrigger: {
              trigger: row,
              scroller: "#preview-scroller",
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
          scroller: "#preview-scroller",
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

    });

    return () => ctx.revert();
  }, [data]);

  return (
    <div className="relative bg-[#050B14] text-white font-sans selection:bg-brand-gold min-h-screen overflow-x-hidden">
      
      {/* ================= TIMELINE BACKGROUNDS (Sticky Fix) ================= */}
      <div className="sticky top-0 h-screen w-full pointer-events-none z-0 overflow-hidden">
        {previewMilestones.map((ms, idx) => (
          <div
            key={`bg-${idx}`}
            className={`bg-image bg-image-${idx} absolute inset-0 bg-cover bg-center opacity-0 will-change-[opacity]`}
            style={{ backgroundImage: `url(${ms.img})` }}
          />
        ))}

        <div className="absolute inset-0 bg-[#050B14]/40 z-0"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#050B14]/90 via-transparent to-[#050B14]/90 z-0"></div>

        <div className="absolute inset-0 flex items-center justify-center overflow-hidden z-0">
          {previewMilestones.map((ms, idx) => (
            <div
              key={`ghost-${idx}`}
              className={`ghost-year ghost-year-${idx} absolute text-[45vw] md:text-[25vw] font-serif font-black text-white tracking-tighter opacity-0 select-none whitespace-nowrap will-change-[opacity,transform]`}
            >
              {ms.year}
            </div>
          ))}
        </div>
      </div>

      {/* Pull the content back up over the sticky background */}
      <main className="relative z-10 w-full flex flex-col -mt-[100vh]">
        
        {/* Scroll buffer space so GSAP has room to trigger the single item */}
        <div className="w-full min-h-[40vh]"></div>

        {/* ================= TIMELINE SECTION (Live Data Only) ================= */}
        <section className="w-full bg-transparent relative z-10 text-white">
          <div className="max-w-[90rem] mx-auto px-6 md:px-12">
            <div ref={timelineWrapperRef} className="relative w-full flex flex-col">
              <div className="absolute left-6 lg:left-1/2 top-0 bottom-0 w-[2px] bg-white/20 -translate-x-1/2"></div>
              <div
                ref={lineRef}
                className="absolute left-6 lg:left-1/2 top-0 w-[2px] bg-gradient-to-b from-brand-gold to-[#e6c96b] -translate-x-1/2 shadow-[0_0_20px_rgba(208,179,112,1)] z-10"
                style={{ height: "0%" }}
              ></div>

              {previewMilestones.map((ms, idx) => {
                const isEven = idx % 2 === 0;

                return (
                  <div key={idx} className="milestone-row relative flex flex-col lg:flex-row items-center w-full min-h-[40vh] lg:min-h-[60vh] py-12 lg:py-20">

                    <div className="absolute left-6 lg:left-1/2 -translate-x-1/2 z-20 flex items-center justify-center">
                      <div className="milestone-pulse absolute w-10 h-10 rounded-full border border-brand-gold opacity-0" />
                      <div className="milestone-dot w-6 h-6 rounded-full border-2 border-brand-gold scale-0 bg-[#050B14]" style={{ '--color-brand-gold': '#D0B370' } as React.CSSProperties} />
                    </div>

                    {/* MOBILE TEXT CONTAINER */}
                    <div className="w-full pl-16 pr-4 lg:hidden flex flex-col justify-center">
                      <div className="overflow-hidden pb-4">
                        <h2 className="reveal-text text-5xl font-serif font-bold text-brand-gold drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">{ms.year}</h2>
                      </div>
                      <div className="overflow-hidden pb-3">
                        <h3 className="reveal-text text-2xl font-serif font-semibold text-white leading-tight mb-2 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">{ms.title}</h3>
                      </div>
                      <div className="overflow-hidden pb-2">
                        <p className="reveal-text text-white/90 text-sm font-light leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{ms.desc}</p>
                      </div>
                    </div>

                    {/* DESKTOP LEFT */}
                    <div className="hidden lg:flex w-1/2 pr-20 xl:pr-32 flex-col justify-center items-end text-right">
                      {isEven && (
                        <>
                          <div className="overflow-hidden pb-4">
                            <h2 className="reveal-text font-serif font-bold text-brand-gold drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] mb-2 text-6xl xl:text-7xl">{ms.year}</h2>
                          </div>
                          <div className="overflow-hidden pb-4">
                            <h3 className="reveal-text text-3xl xl:text-xl font-serif font-bold text-white leading-tight drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] mb-4">{ms.title}</h3>
                          </div>
                          <div className="overflow-hidden pb-4">
                            <p className="reveal-text text-white/90 text-lg xl:text-xl font-light leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] max-w-lg">{ms.desc}</p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* DESKTOP RIGHT */}
                    <div className="hidden lg:flex w-1/2 pl-20 xl:pl-32 flex-col justify-center items-start text-left">
                      {!isEven && (
                        <>
                          <div className="overflow-hidden pb-4">
                            <h2 className="reveal-text font-serif font-bold text-brand-gold drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] mb-2 text-6xl xl:text-7xl">{ms.year}</h2>
                          </div>
                          <div className="overflow-hidden pb-4">
                            <h3 className="reveal-text text-3xl xl:text-xl font-serif font-bold text-white leading-tight drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] mb-4">{ms.title}</h3>
                          </div>
                          <div className="overflow-hidden pb-4">
                            <p className="reveal-text text-white/90 text-lg xl:text-xl font-light leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] max-w-lg">{ms.desc}</p>
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

        {/* Scroll buffer space below to allow smooth scroll-out animations */}
        <div className="w-full min-h-[50vh]"></div>

      </main>
    </div>
  );
}