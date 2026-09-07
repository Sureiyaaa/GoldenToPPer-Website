'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import Lenis from 'lenis';
import Navbar from './components/navbar';
import Footer from './components/footer';
import BackToTop from './components/backtotop';
import PageTransition from './components/page-transitions';
import Homepage from './data/homepage.json';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export default function HomeClient({ initialNews }: { initialNews: any[] }) {
  const [activeHero, setActiveHero] = useState(0);
  const [activeArea, setActiveArea] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const topBtnRef = useRef<HTMLDivElement>(null);
  const progressCircleRef = useRef<SVGCircleElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const prevHeroRef = useRef(0);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const pinnedSectionRef = useRef<HTMLElement>(null);
  const massiveTextContainerRef = useRef<HTMLElement>(null);
  const massiveTextRef = useRef<HTMLHeadingElement>(null);

  // New refs for draggable marquee
  const marqueeTween = useRef<gsap.core.Tween | null>(null);
  const dragState = useRef({ isDragging: false, startX: 0, currentProgress: 0 });

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (topBtnRef.current) {
            if (window.scrollY > 400) {
              topBtnRef.current.style.opacity = '1';
              topBtnRef.current.style.transform = 'translateY(0)';
              topBtnRef.current.style.pointerEvents = 'auto';
            } else {
              topBtnRef.current.style.opacity = '0';
              topBtnRef.current.style.transform = 'translateY(40px)';
              topBtnRef.current.style.pointerEvents = 'none';
            }
          }
          if (progressCircleRef.current) {
            const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
            const progress = window.scrollY / totalHeight;
            const dashoffset = 289.03 - (progress * 289.03);
            progressCircleRef.current.style.strokeDashoffset = dashoffset.toString();
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    window.history.scrollRestoration = 'manual';

    const lenis = new Lenis({
      duration: 1.8,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      touchMultiplier: 2,
      syncTouch: false,
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

  useEffect(() => {
    const autoPlayTimer = setTimeout(() => {
      setActiveHero((prev) => (prev + 1) % Homepage.heroProjects.length);
    }, 5500);
    return () => clearTimeout(autoPlayTimer);
  }, [activeHero]);

  const nextHero = useCallback(() => setActiveHero((prev) => (prev + 1) % Homepage.heroProjects.length), []);
  const prevHero = useCallback(() => setActiveHero((prev) => (prev - 1 + Homepage.heroProjects.length) % Homepage.heroProjects.length), []);

  useGSAP(() => {
    let mm = gsap.matchMedia();

    marqueeTween.current = gsap.to(marqueeRef.current, {
      xPercent: -50,
      ease: 'none',
      duration: 35,
      repeat: -1,
    });

    mm.add("(min-width: 768px)", () => {
      const impactTl = gsap.timeline({
        scrollTrigger: {
          trigger: massiveTextContainerRef.current,
          start: 'top top',
          end: '+=150%',
          scrub: 1,
          pin: true,
        }
      });

      impactTl.fromTo(massiveTextRef.current,
        { scale: 15, opacity: 0 },
        { scale: 1, opacity: 1, duration: 2, ease: "power3.out" }
      )
        .fromTo('.impact-subtitle',
          { opacity: 0, y: 30, letterSpacing: "0.1em" },
          { opacity: 1, y: 0, letterSpacing: "0.4em", duration: 1, ease: "power2.out" },
          "-=1"
        )
        .to(['.impact-subtitle', massiveTextRef.current], {
          opacity: 0,
          y: -40,
          duration: 1,
          ease: "power2.inOut"
        })
        .fromTo('.impact-video-container',
          { scale: 0.7, opacity: 0, rotationX: -15, yPercent: 20 },
          { scale: 1, opacity: 1, rotationX: 0, yPercent: 0, duration: 2, ease: "power3.out" },
          "-=0.5"
        );
    });

    mm.add("(max-width: 767px)", () => {
      const mobileImpactTl = gsap.timeline({
        scrollTrigger: {
          trigger: massiveTextContainerRef.current,
          start: 'top top',
          end: '+=120%',
          scrub: 1,
          pin: true,
        }
      });

      mobileImpactTl.fromTo(massiveTextRef.current,
        { scale: 3, opacity: 0 },
        { scale: 1, opacity: 1, duration: 2, ease: "power2.out" }
      )
        .fromTo('.impact-subtitle',
          { opacity: 0, y: 15, letterSpacing: "0.1em" },
          { opacity: 1, y: 0, letterSpacing: "0.4em", duration: 1, ease: "power2.out" },
          "-=1"
        )
        .to(['.impact-subtitle', massiveTextRef.current], {
          opacity: 0,
          y: -20,
          duration: 1,
          ease: "power2.inOut"
        })
        .fromTo('.impact-video-container',
          { scale: 0.9, opacity: 0, yPercent: 10 },
          { scale: 1, opacity: 1, yPercent: 0, duration: 2 },
          "-=1"
        );
    });

    const revealElements = gsap.utils.toArray('.reveal-up') as HTMLElement[];
    revealElements.forEach((el) => {
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

    gsap.utils.toArray('.img-parallax-container').forEach((container: any) => {
      const img = container.querySelector('img');
      gsap.fromTo(img,
        { yPercent: -15, scale: 1.15 },
        {
          yPercent: 15,
          ease: "none",
          scrollTrigger: {
            trigger: container,
            start: "top bottom",
            end: "bottom top",
            scrub: true
          }
        }
      );
    });

    gsap.utils.toArray('.about-pop').forEach((el: any) => {
      gsap.from(el, {
        y: 40,
        opacity: 0,
        scale: 0.95,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play reverse play reverse',
        }
      });
    });

    gsap.utils.toArray('.stat-counter').forEach((el: any) => {
      const target = parseFloat(el.getAttribute('data-target'));
      const suffix = el.getAttribute('data-suffix');
      const counterObj = { val: 0 };

      gsap.to(counterObj, {
        val: target,
        duration: 2,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el.closest('.stat-container'),
          start: 'top 85%',
          toggleActions: 'play reverse play reverse',
        },
        onUpdate: () => {
          el.innerHTML = Math.ceil(counterObj.val) + suffix;
        }
      });
    });

    const textTl = gsap.timeline({ repeat: -1 });
    textTl.fromTo('.animate-better',
      { yPercent: -100, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }
    )
      .fromTo('.animate-lives',
        { yPercent: 100, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.5, ease: 'power3.out' },
        "<0.1"
      )
      .to('.animate-better', {
        yPercent: 100,
        opacity: 0,
        duration: 0.5,
        ease: 'power2.in',
        delay: 1.2
      })
      .to('.animate-lives', {
        yPercent: -100,
        opacity: 0,
        duration: 0.5,
        ease: 'power2.in'
      }, "<");

  }, { scope: mainRef });

  useGSAP(() => {
    const tl = gsap.timeline({
      onComplete: () => {
        prevHeroRef.current = activeHero;
      }
    });

    gsap.set('.hero-slide', { zIndex: 0, display: 'none' });
    if (activeHero !== prevHeroRef.current) {
      gsap.set(`.hero-slide-${prevHeroRef.current}`, { zIndex: 10, display: 'block', opacity: 1 });
    }
    gsap.set(`.hero-slide-${activeHero}`, { zIndex: 20, display: 'block', opacity: 0 });

    tl.to(`.hero-slide-${activeHero}`, { opacity: 1, duration: 1.5, ease: 'power2.inOut' });

    tl.fromTo(`.hero-slide-${activeHero} .hero-img`,
      { scale: 1.15 },
      { scale: 1, duration: 3, ease: 'power2.out' },
      "<"
    );

    tl.fromTo('.hero-text-update',
      { y: 30, opacity: 0, rotationX: -20 },
      { y: 0, opacity: 1, rotationX: 0, duration: 1.2, stagger: 0.15, ease: 'power3.out' },
      "-=1.8"
    );

    tl.fromTo('.location-char',
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.03, ease: 'power2.out' },
      "-=1.5"
    );

  }, [activeHero])

  // Marquee Drag Event Handlers
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!marqueeTween.current) return;
    dragState.current.isDragging = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    dragState.current.startX = clientX;
    dragState.current.currentProgress = marqueeTween.current.progress();
    marqueeTween.current.pause();
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragState.current.isDragging || !marqueeTween.current || !marqueeRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const deltaX = clientX - dragState.current.startX;

    // Calculate drag distance relative to the marquee total translation length
    const totalDistance = marqueeRef.current.offsetWidth * 0.5;
    let newProgress = dragState.current.currentProgress - (deltaX / totalDistance);

    // Make infinite wrapping smooth in both directions
    while (newProgress < 0) newProgress += 1;
    while (newProgress > 1) newProgress -= 1;

    marqueeTween.current.progress(newProgress);
  };

  const handleDragEnd = () => {
    if (!dragState.current.isDragging || !marqueeTween.current) return;
    dragState.current.isDragging = false;
    marqueeTween.current.play();
  };

  const currentProject = Homepage.heroProjects[activeHero];

  return (
    <PageTransition>
      <div className="flex flex-col min-h-screen bg-[#E7E7E7] text-gray-900 font-sans selection:bg-brand-gold selection:text-white relative">
        <div className="absolute top-0 left-0 w-full z-[100]">
          <Navbar />
        </div>

        <main ref={mainRef} className="flex-1">

          <section ref={heroRef} className="relative w-full h-screen min-h-[650px] flex flex-col justify-center items-center overflow-hidden bg-black perspective-[1000px]">
            {Homepage.heroProjects.map((proj, idx) => (
              <div key={proj.id} className={`absolute inset-0 w-full h-full hero-slide hero-slide-${idx}`}>
                <div className="absolute inset-0 bg-brand-blue/20 z-10 transition-colors duration-500"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40 z-10"></div>
                <Image
                  src={proj.img}
                  alt={proj.title}
                  fill
                  sizes="100vw"
                  priority={idx === 0}
                  className="object-cover hero-img"
                />
              </div>
            ))}

            <div key={`text-${activeHero}`} className="relative z-30 max-w-[90rem] mx-auto w-full px-6 md:px-12 flex flex-col items-center text-center pb-28 md:pb-36 lg:pb-20">
              <div className="flex flex-wrap justify-center text-[0.65rem] text-[12px] sm:text-xs md:text-[18px] tracking-[0.2em] md:tracking-[0.3em] uppercase text-white/80 font-medium mb-6 md:mb-8 gap-4 items-center">

                <p className="flex flex-wrap justify-center text-white font-bold">
                  {(`${Homepage.heroProjects[activeHero].location}, Philippines`).split('').map((char, index) => (
                    <span key={index} className="location-char inline-block">
                      {char === ' ' ? '\u00A0' : char}
                    </span>
                  ))}
                </p>

              </div>

              <h1 className="hero-text-update text-[36px] sm:text-6xl md:text-7xl lg:text-[5.5rem] font-serif font-normmal text-white leading-[1.1] md:leading-[1.15] tracking-tight mb-8 md:mb-10 max-w-auto drop-shadow-2xl shadow-black py-2">
                {Homepage.heroProjects[activeHero].headingLine1} <br />
                <motion.span
                  initial={{ backgroundPosition: "200% center" }}
                  animate={{ backgroundPosition: "-200% center" }}
                  transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                  className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-brand-gold via-[#fff2cd] to-brand-gold bg-[length:200%_auto] drop-shadow-[0_0_20px_rgba(197,160,113,0.4)] pr-4 pb-2 pt-1"
                >
                  {Homepage.heroProjects[activeHero].headingLine2}
                </motion.span>
              </h1>

              <div className="hero-text-update flex flex-col sm:flex-row gap-4 sm:gap-6 w-full sm:w-auto">
                <Link
                  href={`/projects/${currentProject.slug}`}
                  className="group relative flex items-center justify-center gap-6 w-full sm:w-auto bg-brand-blue px-8 py-4 overflow-hidden rounded-sm shadow-lg cursor-pointer outline-none"
                >
                  <span className="absolute inset-0 w-full h-full bg-brand-gold transform -translate-x-full transition-transform duration-[0.6s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0"></span>
                  <span className="relative z-10 text-[11px] tracking-[0.25em] font-normal text-white uppercase transition-colors duration-500">
                    View Project
                  </span>
                  <div className="relative z-10 overflow-hidden w-5 h-5 flex items-center justify-center shrink-0">
                    <ArrowRight size={16} className="absolute text-white transform translate-x-0 transition-transform duration-[0.6s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-[150%]" />
                    <ArrowRight size={16} className="absolute text-white transform -translate-x-[150%] transition-transform duration-[0.6s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0" />
                  </div>
                </Link>
              </div>
            </div>

            <div className="absolute bottom-4 sm:bottom-6 md:bottom-8 lg:bottom-12 w-full z-40 px-4 md:px-12 hidden sm:flex items-center justify-center gap-2 sm:gap-4 md:gap-8">
              <button onClick={prevHero} className="hidden md:flex w-12 h-12 md:w-14 md:h-14 rounded-full border border-white/30 bg-white/10 items-center justify-center text-white hover:bg-brand-gold hover:border-brand-gold backdrop-blur-md cursor-pointer shrink-0 transition-all duration-300 outline-none">
                <ChevronLeft size={24} />
              </button>

              <div className="flex gap-3 md:gap-4 overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] py-4 px-2 max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw] snap-x snap-mandatory">
                {Homepage.heroProjects.map((proj, idx) => (
                  <button key={proj.id} onClick={() => setActiveHero(idx)} className={`relative w-20 sm:w-28 md:w-36 lg:w-44 xl:w-52 aspect-[16/9] rounded-sm overflow-hidden cursor-pointer shrink-0 snap-center transition-all duration-500 outline-none ${activeHero === idx ? 'ring-2 md:ring-4 ring-brand-gold shadow-xl z-10 scale-100' : 'ring-1 ring-white/20 scale-95 opacity-60 hover:opacity-100'}`}>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10"></div>
                    <Image src={proj.img} alt={`Thumbnail for ${proj.title}`} fill sizes="(max-width: 768px) 30vw, 15vw" className="object-cover" />
                    <div className="absolute bottom-2 md:bottom-3 left-3 md:left-4 z-20">
                      <div className="text-white text-[0.65rem] md:text-sm font-serif font-bold text-left">{proj.title}</div>
                    </div>
                  </button>
                ))}
              </div>

              <button onClick={nextHero} className="hidden md:flex w-12 h-12 md:w-14 md:h-14 rounded-full border border-white/30 bg-white/10 items-center justify-center text-white hover:bg-brand-gold hover:border-brand-gold backdrop-blur-md cursor-pointer shrink-0 transition-all duration-300 outline-none">
                <ChevronRight size={24} />
              </button>
            </div>
          </section>

          <section className="py-20 md:py-24 lg:py-40 bg-white w-full flex items-center justify-center overflow-hidden">
            <div className="max-w-[90rem] mx-auto w-full px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="about-pop lg:col-span-7">
                <h4 className="text-brand-gold font-bold text-xs md:text-sm tracking-widest uppercase mb-4">About Us</h4>
                <h2 className="text-brand-blue text-3xl sm:text-5xl md:text-6xl lg:text-6xl font-serif mb-6 md:mb-8 leading-tight">
                  Better Cities,{' '}
                  <span className="inline-block overflow-hidden align-bottom">
                    <span className="inline-block animate-better text-brand-gold">Better</span>
                  </span>{' '}
                  <span className="inline-block overflow-hidden align-bottom">
                    <span className="inline-block animate-lives text-brand-gold">Lives</span>
                  </span>
                </h2>
                <div className="text-justify text-gray space-y-4 md:space-y-6 mb-8 md:mb-10 text-base md:text-xl font-light leading-relaxed">
                  <p>Golden Topper is a fast-emerging group of real estate companies working in collaboration to develop high quality prime branding real estate projects across the Philippines.</p>
                  <p>We believe that better cities lead to better lives. This belief drives our commitment to innovate world-class developments to elevate lifestyles and provide high-value investments.</p>
                </div>

                <Link href="/story" className="group relative flex items-center justify-center gap-6 w-full sm:w-auto bg-brand-blue px-8 py-4 overflow-hidden rounded-sm shadow-md cursor-pointer outline-none mt-4">
                  <span className="absolute inset-0 w-full h-full bg-brand-gold transform -translate-x-full transition-transform duration-[0.6s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0"></span>
                  <span className="relative z-10 text-[11px] tracking-[0.25em] font-bold text-white uppercase transition-colors duration-500">
                    Know More About Us
                  </span>
                  <div className="relative z-10 overflow-hidden w-5 h-5 flex items-center justify-center shrink-0">
                    <ArrowRight size={16} className="absolute text-white transform translate-x-0 transition-transform duration-[0.6s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-[150%]" />
                    <ArrowRight size={16} className="absolute text-white transform -translate-x-[150%] transition-transform duration-[0.6s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0" />
                  </div>
                </Link>

              </div>

              <div className="flex flex-col gap-8 sm:gap-12 lg:col-span-4 lg:col-start-9 about-pop stat-container">
                {[
                  { target: 10, suffix: "+", label: "Projects under Development" },
                  { target: 200, suffix: "+", label: "Professionals in Our Team" },
                  { target: 300, suffix: "K+", label: "Landbank Area Covered (sqm)" }
                ].map((stat, i) => (
                  <div key={i} className="flex flex-col">
                    <span className="stat-counter text-brand-gold text-4xl sm:text-5xl md:text-6xl font-serif mb-1 sm:mb-2" data-target={stat.target} data-suffix={stat.suffix}>
                      0{stat.suffix}
                    </span>
                    <span className="text-brand-blue text-sm sm:text-xl font-serif leading-snug">{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="relative w-full bg-[#E7E7E7] pb-10 md:pb-32">
            <div className="relative w-full h-[300px] md:h-[100vh] md:min-h-[450px] bg-black">
              <Image src="/images/landingpage/BDC_Goldentopper.jpg" alt="Golden Topper Best Developer Cebu" fill sizes="100vw" className="object-contain md:object-cover object-top md:object-center opacity-70" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#E7E7E7] md:from-[#E7E7E7]/90 via-transparent to-transparent"></div>
            </div>

            <div className="relative z-10 max-w-[85rem] mx-auto px-4 md:px-8 -mt-20 md:-mt-40">
              <div className="w-full bg-white rounded-sm shadow-[0_30px_60px_rgba(0,0,0,0.1)] flex flex-col lg:flex-row overflow-hidden md:min-h-[550px]">

                <div className="w-full lg:w-[30%] flex flex-col border-r border-gray-100 shrink-0 bg-white" role="tablist">
                  {Homepage.developmentAreas.map((area, index) => {
                    const isActive = activeArea === index;
                    return (
                      <button
                        key={area.id}
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveArea(index)}
                        className={`flex-1 flex text-left transition-all duration-500 border-b border-gray-200 last:border-none outline-none group ${isActive ? 'bg-white shadow-lg z-10 scale-[1.02]' : 'hover:bg-gray-50'}`}
                      >
                        <div className="w-14 md:w-20 flex items-center justify-center shrink-0">
                          <span className={`font-serif text-sm md:text-xl transition-colors duration-300 ${isActive ? 'text-brand-gold font-bold' : 'text-gray-300 group-hover:text-gray-400'}`}>
                            {area.id}
                          </span>
                        </div>
                        <div className="flex-1 px-4 py-4 md:px-6 md:py-0 flex justify-between items-center">
                          <span className={`text-sm md:text-base transition-colors duration-300 ${isActive ? 'text-brand-blue font-bold' : 'text-gray-500 font-medium'}`}>
                            {area.tabTitle}
                          </span>
                          <span className={`text-brand-gold transition-all duration-300 ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
                            <ArrowRight size={18} />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="w-full lg:w-[35%] h-52 md:h-64 lg:h-auto relative overflow-hidden shrink-0 bg-black">
                  {Homepage.developmentAreas.map((area, index) => (
                    <Image
                      key={`img-${area.id}`}
                      src={area.img}
                      alt={area.tabTitle}
                      fill
                      sizes="(max-width: 1024px) 100vw, 35vw"
                      className={`object-cover transition-all duration-[1200ms] ease-in-out ${activeArea === index ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-125 z-0'}`}
                    />
                  ))}
                </div>

                <div className="w-full lg:w-[35%] relative bg-white shrink-0 min-h-[300px] md:min-h-[350px] lg:min-h-full">
                  {Homepage.developmentAreas.map((area, index) => (
                    <div
                      key={`text-${area.id}`}
                      className={`absolute inset-0 p-8 md:p-14 flex flex-col justify-center transition-all duration-[800ms] ease-out ${activeArea === index ? 'opacity-100 translate-y-0 pointer-events-auto z-10 delay-200' : 'opacity-0 translate-y-12 pointer-events-none z-0'}`}
                    >
                      <h5 className="text-brand-gold text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase mb-4">
                        {area.subtitle}
                      </h5>
                      <h3 className="text-3xl md:text-4xl lg:text-5xl font-serif text-brand-blue mb-6 leading-[1.1] whitespace-pre-line">
                        {area.heading}
                      </h3>
                      <p className="text-gray text-sm md:text-base font-light leading-relaxed">
                        {area.desc}
                      </p>
                    </div>
                  ))}
                </div>

              </div>
            </div>
          </section>

          {/* DRAGGABLE MARQUEE SECTION */}
          <section
            className="py-6 md:py-10 bg-brand-blue text-white relative overflow-hidden flex items-center cursor-grab active:cursor-grabbing select-none"
            style={{ touchAction: 'pan-y' }}
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
          >
            <div className="absolute left-0 top-0 bottom-0 w-8 md:w-64 bg-gradient-to-r from-brand-blue to-transparent z-10 pointer-events-none"></div>
            <div className="absolute right-0 top-0 bottom-0 w-8 md:w-64 bg-gradient-to-l from-brand-blue to-transparent z-10 pointer-events-none"></div>

            <div ref={marqueeRef} className="flex w-max">
              {[...Array(4)].map((_, containerIndex) => (
                <div key={containerIndex} className="flex gap-8 md:gap-40 px-4 md:px-20 items-start shrink-0">
                  {Homepage.awardsData.map((award) => (
                    <div key={award.id} className="flex flex-col items-center w-32 md:w-80 text-center shrink-0">
                      <img src="/images/landingpage/award.svg" alt="Award Laurel" className="w-12 md:w-40 h-auto mb-3 md:mb-6 pointer-events-none" />
                      <h3 className="text-xs md:text-xl font-bold mb-1 md:mb-3 whitespace-pre-line leading-tight text-brand-gold">{award.title}</h3>
                      <div className="mt-auto flex flex-col gap-0 md:gap-1 text-gray-300">
                        <p className="text-[9px] md:text-sm font-light tracking-wide leading-tight">{award.subtitle1}</p>
                        {award.subtitle2 && <p className="text-[9px] md:text-sm font-light tracking-wide leading-tight">{award.subtitle2}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section ref={pinnedSectionRef} className="max-w-[90rem] mx-auto px-6 md:px-12 py-32 flex flex-col md:flex-row gap-20 relative items-start perspective-[1000px]">
            <div className="md:w-5/12 self-start md:sticky md:top-40 h-auto">
              <div className="w-full">
                <div className="text-xs md:text-sm tracking-widest uppercase text-brand-gold font-bold mb-8 flex items-center gap-4">
                  The Process
                </div>
                <h2 className="text-5xl md:text-7xl font-serif leading-[1.1] text-brand-blue tracking-tighter mb-8">
                  The Golden <br /><span className="text-brand-gold">Standard.</span>
                </h2>
                <p className="text-xl text-gray font-light leading-relaxed max-w-md">
                  We don't just build structures; we forge landmarks. Our meticulous three-step approach ensures your vision is executed with uncompromising precision.
                </p>
              </div>
            </div>

            <div className="md:w-7/12 flex flex-col gap-32 md:pb-[10vh]">
              {[
                { num: "01", title: "Creating Better Communities", desc: "Golden Topper is a fast-emerging group of real estate companies working in collaboration to develop prime real estate projects across the Philippines.", img: "/images/landingpage/communities.webp" },
                { num: "02", title: "Elevating lifestyles", desc: "Creating living spaces that are more than the ordinary, Golden Topper aims to deliver diverse living spaces catering to the needs of every homeowner.", img: "/images/landingpage/lifestyle.webp" },
                { num: "03", title: "Providing high-value investments", desc: "Creating living spaces that are more than the ordinary, Golden Topper aims to deliver diverse living spaces catering to the needs of every homeowner.", img: "/images/landingpage/investment.webp" }
              ].map((step, idx) => (
                <div key={idx} className="reveal-up group">
                  <div className="aspect-[4/3] bg-gray-200 overflow-hidden rounded-sm mb-8 relative cursor-pointer img-parallax-container">
                    <Image src={step.img} alt={step.title} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover parallax-img" />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-500"></div>
                  </div>
                  <div className="flex gap-8 items-start border-b border-gray-200 pb-8">
                    <div className="text-3xl font-serif text-brand-gold">{step.num}</div>
                    <div>
                      <h3 className="text-3xl font-serif mb-4 text-brand-blue">{step.title}</h3>
                      <p className="text-gray font-light leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section ref={massiveTextContainerRef} className="h-screen w-full bg-[#0a0a0a] text-white relative overflow-hidden flex flex-col items-center justify-center m-0">
            <div className="absolute inset-0 opacity-30">
              <Image src="/images/landingpage/el-sol-night.png" alt="Architecture Structure Background" fill sizes="100vw" className="object-cover" />
            </div>

            <div className="relative z-10 w-full h-full flex items-center justify-center px-4 md:px-12 perspective-[1000px]">
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="impact-subtitle text-xs md:text-[26px] tracking-[0.4em] uppercase text-white font-bold opacity-80 mb-4 z-20">BUILD YOUR</div>
                <h2 ref={massiveTextRef} className="text-[18vw] text-[40px] md:text-[10vw] font-serif leading-none tracking-tight text-brand-gold z-10 will-change-transform">
                  FUTURE HERE
                </h2>
              </div>

              <div className="impact-video-container absolute w-[90%] md:w-[70%] max-w-5xl aspect-video rounded-sm overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.8)] bg-black border border-white/10 z-30">
                {!isVideoPlaying ? (
                  <button
                    onClick={() => setIsVideoPlaying(true)}
                    className="absolute inset-0 w-full h-full flex items-center justify-center group focus-visible:ring-4 focus-visible:ring-brand-gold outline-none cursor-pointer"
                    aria-label="Play Golden Topper Impact Video"
                  >
                    <Image
                      src="https://img.youtube.com/vi/-MT4zfvcm3Q/maxresdefault.jpg"
                      alt="Video Thumbnail"
                      fill
                      sizes="(max-width: 768px) 90vw, 70vw"
                      className="object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-500 group-hover:scale-105"
                    />
                    <div className="w-20 h-20 md:w-28 md:h-28 bg-white/10 backdrop-blur-md rounded-full border border-white/20 flex items-center justify-center z-10 shadow-[0_0_30px_rgba(212,175,55,0.2)] group-hover:scale-110 group-hover:bg-brand-gold group-hover:border-brand-gold transition-all duration-500">
                      <Play className="text-white ml-2 fill-white w-8 h-8 md:w-10 md:h-10" />
                    </div>
                  </button>
                ) : (
                  <iframe
                    className="absolute inset-0 w-full h-full object-cover"
                    src="https://www.youtube.com/embed/-MT4zfvcm3Q?si=XLxESExPKSvBe9X6&autoplay=1&enablejsapi=1&mute=0&controls=1&rel=0"
                    title="Golden Topper Video"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                )}
              </div>
            </div>
          </section>

          <section className="max-w-[90rem] mx-auto px-6 md:px-12 pb-32 pt-32">

            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 md:mb-16 gap-6">
              <div>
                <div className="text-xs md:text-sm tracking-widest uppercase text-brand-gold font-bold mb-4 flex items-center gap-4">
                  News & Updates
                </div>
                <h2 className="text-brand-blue text-[26px] sm:text-4xl md:text-6xl lg:text-6xl font-serif leading-tight tracking-tighter md:tracking-normal">
                  The latest from <span className="text-brand-gold">Golden Topper.</span>
                </h2>
              </div>

              {/* Desktop View All Button */}
              <Link href="/news&updates" className="hidden md:flex items-center justify-center gap-4 border border-brand-blue px-8 py-4 rounded-sm text-[11px] font-bold tracking-[0.25em] text-brand-blue uppercase hover:bg-brand-blue hover:text-white transition-all duration-300 outline-none group shrink-0 shadow-sm hover:shadow-md">
                View All News
                <ArrowRight size={16} className="transform group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            </div>

            {initialNews && initialNews.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">

                {/* 1. FEATURED ARTICLE (Left Column) */}
                <Link
                  href={`/news&updates/${initialNews[0].slug}`}
                  className="lg:col-span-7 group cursor-pointer text-left outline-none flex flex-col"
                >
                  {/* Image Container */}
                  <div className="w-full aspect-[16/10] overflow-hidden rounded-sm mb-6 lg:mb-8 relative bg-gray-100 shadow-md">
                    <Image
                      src={initialNews[0].image || '/images/placeholder.jpg'}
                      alt={initialNews[0].title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 60vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                    <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md text-brand-blue px-4 py-2 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] rounded-sm shadow-sm">
                      {initialNews[0].category}
                    </div>
                  </div>

                  {/* Text Content */}
                  <div className="flex flex-col items-start pr-0 lg:pr-8">
                    <span className="text-[10px] tracking-[0.2em] font-bold text-brand-gold uppercase mb-3">
                      {initialNews[0].date}
                    </span>
                    <h3 className="text-2xl md:text-3xl lg:text-4xl font-serif text-brand-blue mb-4 group-hover:text-brand-gold transition-colors duration-300 leading-snug">
                      {initialNews[0].title}
                    </h3>
                    <p className="text-gray font-light leading-relaxed mb-6 text-sm md:text-base line-clamp-3">
                      {initialNews[0].excerpt}
                    </p>
                    <span className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 text-brand-blue group-hover:text-brand-gold transition-colors">
                      Read Full Story <ArrowRight size={14} className="transform group-hover:translate-x-2 transition-transform duration-300" />
                    </span>
                  </div>
                </Link>

                {/* 2. LIST ARTICLES (Right Column) */}
                <div className="lg:col-span-5 flex flex-col">
                  {initialNews.slice(1).map((news, idx) => (
                    <Link
                      key={news.id}
                      href={`/news&updates/${news.slug}`}
                      className={`group flex items-start gap-5 md:gap-6 py-6 cursor-pointer transition-colors duration-300 outline-none border-b border-gray-200 hover:border-brand-gold ${idx === 0 ? 'pt-0' : ''}`}
                    >
                      {/* Thumbnail */}
                      <div className="w-28 md:w-36 aspect-[4/3] rounded-sm overflow-hidden shrink-0 relative bg-gray-100 shadow-sm mt-1">
                        <Image
                          src={news.image || '/images/placeholder.jpg'}
                          alt={news.title}
                          fill
                          sizes="(max-width: 768px) 30vw, 15vw"
                          className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                        />
                      </div>

                      {/* Text Content */}
                      <div className="flex flex-col flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                          <span className="text-[8px] md:text-[9px] tracking-[0.2em] font-bold text-brand-gold uppercase">
                            {news.category}
                          </span>
                          <span className="hidden md:inline-block w-1 h-1 rounded-full bg-gray-300"></span>
                          <span className="text-[8px] md:text-[9px] tracking-[0.2em] font-bold text-gray-600 uppercase">
                            {news.date}
                          </span>
                        </div>

                        <h4 className="font-serif text-base md:text-lg text-brand-blue leading-snug group-hover:text-brand-gold transition-colors duration-300 line-clamp-2 mb-2">
                          {news.title}
                        </h4>

                        <p className="text-gray font-light text-xs md:text-sm line-clamp-2">
                          {news.excerpt}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>

              </div>
            ) : (
              <div className="text-gray-500 py-16 text-center w-full border border-gray-200 rounded-sm bg-white">
                No news updates available at the moment.
              </div>
            )}

            {/* Mobile View All Button (Only shows on small screens) */}
            <Link href="/news&updates" className="md:hidden mt-10 flex items-center justify-center gap-4 border border-brand-blue px-8 py-4 rounded-sm text-[11px] font-bold tracking-[0.25em] text-brand-blue uppercase hover:bg-brand-blue hover:text-white transition-all duration-300 outline-none group w-full shadow-sm hover:shadow-md">
              View All News
              <ArrowRight size={16} className="transform group-hover:translate-x-1 transition-transform duration-300" />
            </Link>

          </section>

        </main>
        <Footer />
        <BackToTop />
      </div>
    </PageTransition>
  );
}