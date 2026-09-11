'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowDownRight, MoveRight, Sparkles } from 'lucide-react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Navbar from '@/app/components/navbar';
import Footer from '@/app/components/footer';
import BackToTop from '@/app/components/backtotop';
import PageTransition from '@/app/components/page-transitions';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface Promotion {
  id: number;
  title: string;
  slug: string;
  tag: string;
  validUntil: string;
  image: string;
  excerpt: string;
  project_id: number | null;
}

export default function PromotionsClient({ initialPromotions }: { initialPromotions: Promotion[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroTextRef = useRef<HTMLHeadingElement>(null);
  const listItemsRef = useRef<(HTMLDivElement | null)[]>([]);

  // 1. SMOOTH SCROLLING (LENIS)
  useIsomorphicLayoutEffect(() => {
    window.history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);

    const lenis = new Lenis({
      duration: 1.5,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,
    });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove((time) => lenis.raf(time * 1000));
    };
  }, []);

  // 2. MAIN GSAP ANIMATIONS
  useIsomorphicLayoutEffect(() => {
    if (!containerRef.current) return;

    let ctx = gsap.context(() => {
      // --- A. Cinematic Hero Reveal ---
      const tl = gsap.timeline({ defaults: { ease: 'power4.out', duration: 1.2 } });
      
      tl.fromTo('.hero-badge', { opacity: 0, y: 20 }, { opacity: 1, y: 0, delay: 0.2 })
        .fromTo('.hero-word', { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.1 }, "-=0.8")
        .fromTo('.hero-desc', { opacity: 0, x: -20 }, { opacity: 1, x: 0 }, "-=0.8");

      // --- B. Scroll Reveal for List Items ---
      listItemsRef.current.forEach((item) => {
        if (!item) return;
        
        gsap.fromTo(item, 
          { opacity: 0, y: 40 },
          {
            opacity: 1, 
            y: 0, 
            duration: 1, 
            ease: "expo.out",
            scrollTrigger: {
              trigger: item,
              start: "top 90%",
            }
          }
        );
      });
    }, containerRef);

    return () => {
      ctx.revert();
    };
  }, [initialPromotions]);

  return (
    <PageTransition>
      <div ref={containerRef} className="relative min-h-screen bg-[#E7E7E7] font-sans text-brand-blue selection:bg-brand-gold selection:text-[#E7E7E7] overflow-hidden">
        <div className="absolute top-0 left-0 w-full z-[100]"><Navbar /></div>

        {/* --- HERO SECTION --- */}
        <section className="relative w-full min-h-screen flex flex-col justify-center z-10 pt-32 pb-20 overflow-hidden">
          
          {/* Background Video & Overlay */}
          <div className="absolute inset-0 w-full h-full z-0">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            >
              <source src="/images/promotions/" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-[#E7E7E7]/40 backdrop-blur-[2px]"></div>
          </div>

          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-brand-gold/20 rounded-full blur-[120px] pointer-events-none z-0" />
          
          <div className="max-w-[90rem] mx-auto w-full px-6 md:px-12 relative z-10">
            <div className="hero-badge inline-flex items-center gap-3 text-xs tracking-[0.3em] uppercase text-[#E7E7E7]/70 font-medium mb-12 border border-brand-blue/20 rounded-full px-5 py-2 bg-white/30 backdrop-blur-md">
              Exclusive Promotions
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
              <div className="lg:col-span-8 overflow-hidden" ref={heroTextRef}>
                <h1 className="text-6xl sm:text-7xl lg:text-[8.5rem] font-serif font-normal leading-[0.95] tracking-tight">
                  <div className="overflow-hidden pb-2"><div className="hero-word text-brand-blue">Golden</div></div>
                  <div className="overflow-hidden pb-4">
                    <div className="hero-word text-transparent bg-clip-text bg-gradient-to-r from-brand-gold to-[#b8952b]">Opportunities</div>
                  </div>
                </h1>
              </div>

              <div className="hero-desc lg:col-span-4 lg:pb-6 flex flex-col items-start gap-8">
                <p className="text-lg text-[#E7E7E7]/80 font-medium leading-relaxed">
                  Strategic investments designed for the discerning buyer. Unlock exclusive promotional terms, priority selections, and unmatched value across our premium portfolio.
                </p>
                <Link href="#promotions-list" className="group flex items-center gap-4 text-xs font-bold tracking-[0.2em] uppercase text-[#E7E7E7] hover:text-brand-gold transition-colors">
                  Explore Promotions
                  <span className="w-10 h-10 rounded-full border border-brand-blue/30 flex items-center justify-center group-hover:border-brand-gold transition-colors bg-white/20 backdrop-blur-sm">
                    <ArrowDownRight size={16} className="group-hover:translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* --- LIST SECTION --- */}
        <main id="promotions-list" className="w-full relative z-20 pt-32 pb-40">
          
          <div className="max-w-[90rem] mx-auto px-6 md:px-12">
            {!initialPromotions?.length ? (
              <div className="w-full py-32 text-center flex flex-col items-center border border-brand-blue/10 rounded-3xl bg-white/50 backdrop-blur-sm">
                <Sparkles size={48} className="text-brand-blue/30 mb-6" />
                <h2 className="text-4xl font-serif text-brand-blue mb-4 font-light">The Vault is Closed.</h2>
                <p className="text-brand-blue/60 text-lg">All current allocations have been claimed. Return soon.</p>
              </div>
            ) : (
              <div className="flex flex-col w-full border-t border-brand-blue/10">
                {initialPromotions.map((promo, index) => (
                  <div 
                    key={promo.id}
                    ref={(el: HTMLDivElement | null) => { if (el) listItemsRef.current[index] = el; }}
                    className="group relative border-b border-brand-blue/10 hover:border-brand-blue/40 transition-colors duration-500"
                  >
                    <Link href={`/inquire?project=${promo.project_id}`} className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between py-12 md:py-16 px-4 gap-8 outline-none">
                      
                      {/* Mobile Image */}
                      <div className="block lg:hidden relative w-full aspect-video rounded-md overflow-hidden mb-4">
                        <img src={promo.image} alt={promo.title} className="absolute inset-0 w-full h-full object-cover" />
                      </div>

                      <div className="flex items-center gap-12 flex-1">
                        <span className="hidden md:block text-2xl font-mono text-brand-blue/30 group-hover:text-brand-gold transition-colors">
                          {(index + 1).toString().padStart(2, '0')}
                        </span>
                        
                        <div>
                          <h3 className="text-4xl md:text-5xl lg:text-6xl font-serif text-brand-blue font-extralight tracking-tight group-hover:italic group-hover:translate-x-4 transition-all duration-500">
                            {promo.title}
                          </h3>
                          {/* Description properly sized and un-hidden on mobile */}
                          <p className="text-sm md:text-base text-brand-blue/60 font-light mt-3 md:mt-4 max-w-xl group-hover:translate-x-4 transition-transform duration-500 delay-75">
                            {promo.excerpt}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-8 md:gap-16 mt-2 md:mt-0">
                        <div className="flex flex-col items-start md:items-end gap-2">
                          <span className="text-[10px] tracking-[0.2em] font-medium text-brand-blue/50 uppercase">
                            {promo.tag}
                          </span>
                          <span className="text-sm font-semibold text-brand-gold">
                            Valid until {promo.validUntil}
                          </span>
                        </div>
                        
                        <div className="hidden md:flex items-center justify-center w-16 h-16 rounded-full border border-brand-blue/20 group-hover:bg-brand-blue group-hover:border-brand-blue transition-all duration-500">
                          <MoveRight size={24} className="text-brand-blue group-hover:text-[#E7E7E7] group-hover:-rotate-45 transition-all duration-500" />
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        <Footer />
        <BackToTop />
      </div>
    </PageTransition>
  );
}