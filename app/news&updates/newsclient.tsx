'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
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

export default function NewsClient({ initialNews }: { initialNews: any[] }) {
  const cardsRef = useRef<(HTMLAnchorElement | null)[]>([]);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<any>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  // Clear cardsRef on every render to avoid stale references from previous pages
  cardsRef.current = [];

  useIsomorphicLayoutEffect(() => {
    window.history.scrollRestoration = 'manual';
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  // 1. Initialize Lenis (Only runs once on mount)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    const lenis = new Lenis({
      duration: 1.8,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,
    });

    lenisRef.current = lenis;
    lenis.scrollTo(0, { immediate: true });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => { lenis.raf(time * 1000); });

    return () => {
      lenis.destroy();
      gsap.ticker.remove((time) => lenis.raf(time * 1000));
    };
  }, []); 

  // 2. Initialize GSAP Animations (Re-runs when page changes)
  useEffect(() => {
    let ctx = gsap.context(() => {
      // Small timeout ensures DOM is fully updated with new mapped articles
      setTimeout(() => {
        ScrollTrigger.refresh();

        cardsRef.current.forEach((el) => {
          if (!el) return;
          gsap.fromTo(
            el,
            { opacity: 0, y: 60 },
            {
              opacity: 1,
              y: 0,
              duration: 1.2,
              ease: "power3.out",
              scrollTrigger: {
                trigger: el,
                start: "top 85%",
                toggleActions: "play none none reverse",
              },
            }
          );
        });
      }, 50);
    });

    return () => ctx.revert();
  }, [currentPage, initialNews]);

  // Empty state rendering.
  if (!initialNews || initialNews.length === 0) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-[#FDFBF7] font-sans text-gray-900 flex flex-col" style={{ overflowAnchor: 'none' }}>
          <div className="absolute top-0 left-0 w-full z-[100]"><Navbar /></div>
          <div className="flex-grow flex flex-col items-center justify-center pt-32 text-center px-6">
            <h2 className="text-3xl font-serif text-brand-blue mb-4">No news published yet.</h2>
            <p className="text-gray-500">Check back later for updates.</p>
          </div>
          <Footer />
        </div>
      </PageTransition>
    );
  }

  // Populated state slicing.
  const featuredArticle = initialNews[0];
  const gridArticles = initialNews.slice(1);

  // Pagination Logic
  const totalPages = Math.ceil(gridArticles.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentArticles = gridArticles.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    if (gridContainerRef.current && lenisRef.current) {
      // Smoothly scroll back to the top of the grid with an offset for the header
      lenisRef.current.scrollTo(gridContainerRef.current, { offset: -120, duration: 0.5 });
    }
  };

  return (
    <PageTransition>
      <div className="relative min-h-screen bg-[#FDFBF7] font-sans text-gray-900" style={{ overflowAnchor: 'none' }}>
        <div className="absolute top-0 left-0 w-full z-[100]"><Navbar /></div>

        <section className="relative w-full h-screen min-h-[650px] flex flex-col justify-center z-10 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/news-updates/news_updates_bg.png')" }}>
          <div className="absolute inset-0 bg-black/60 z-0"></div>
          <div className="max-w-[90rem] mx-auto w-full px-6 md:px-12 relative z-10 flex flex-col items-center text-center">
            <div className="flex flex-wrap justify-center text-[0.65rem] text-[12px] sm:text-xs md:text-[18px] tracking-[0.2em] md:tracking-[0.3em] uppercase text-white font-medium mb-6 md:mb-8 gap-4 items-center">
               Press & Media 
            </div>
            <h1 className="hero-text-update text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-serif font-normal text-white leading-[1.1] md:leading-[1.15] tracking-tight mb-8 md:mb-10 max-w-auto drop-shadow-2xl shadow-black py-2">
                <motion.span 
                  initial={{ backgroundPosition: "200% center" }}
                  animate={{ backgroundPosition: "-200% center" }}
                  transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                  className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-brand-gold via-[#fff2cd] to-brand-gold bg-[length:200%_auto] drop-shadow-[0_0_20px_rgba(208,179,112,0.4)] px-4 py-2 overflow-visible"
                >
                News & Updates
              </motion.span>
            </h1>
            <p className="text-[12px] sm:text-base md:text-lg lg:text-xl text-white/90 font-normal leading-relaxed max-w-3xl mx-auto drop-shadow-md mb-10 md:mb-12">
              Discover our latest announcements and exclusive property launches. <br></br>Be the first to know how Golden Topper continues to set the gold standard.
            </p>
          </div>
        </section>

        <main className="w-full pb-24 md:pb-32 relative z-20">
          <div className="max-w-[90rem] mx-auto px-6 md:px-12 flex flex-col gap-20 -mt-16 md:-mt-24">
            
            {/* Featured article section */}
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.4 }} className="w-full flex flex-col lg:flex-row bg-white rounded-sm shadow-2xl overflow-hidden border border-gray-100 relative z-30">
              <div className="relative w-full lg:w-[60%] h-[350px] md:h-[500px] lg:h-auto overflow-hidden group bg-black cursor-pointer">
                <Link href={`/news&updates/${featuredArticle.slug}`} className="absolute inset-0 z-20"></Link>
                <Image 
                  src={featuredArticle.image} 
                  alt={featuredArticle.title}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-[1.5s] ease-out opacity-90 group-hover:opacity-100"
                />
              </div>

              <div className="w-full lg:w-[40%] flex flex-col justify-center p-8 md:p-12 lg:p-16">
                <div className="flex items-center gap-3 mb-6">
                  <span className="bg-brand-gold/90 text-brand-blue px-3 py-1 text-[9px] md:text-[10px] font-semibold uppercase tracking-[0.2em] border border-brand-gold/90 rounded-sm">
                    {featuredArticle.category}
                  </span>
                  <span className="text-[10px] md:text-xs tracking-[0.2em] font-semibold text-gray-800 uppercase">
                    {featuredArticle.date}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-2.5xl lg:text-3xl font-serif text-brand-blue mb-6 leading-[1.15]">
                  {featuredArticle.title}
                </h2>
                <p className="text-gray-600 font-light leading-relaxed mb-10 text-sm md:text-base whitespace-pre-wrap line-clamp-4">
                  {featuredArticle.excerpt}
                </p>

                <Link href={`/news&updates/${featuredArticle.slug}`} className="group relative flex items-center justify-center gap-6 w-full sm:w-fit bg-brand-blue px-8 py-4 overflow-hidden rounded-sm shadow-md">
                  <span className="absolute inset-0 w-full h-full bg-brand-gold transform -translate-x-full transition-transform duration-[0.6s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0"></span>
                  <span className="relative z-10 text-[11px] tracking-[0.25em] font-normal text-white uppercase transition-colors duration-500">Read Full Story</span>
                  <div className="relative z-10 overflow-hidden w-5 h-5 flex items-center justify-center shrink-0">
                    <ArrowRight size={16} className="absolute text-white transform translate-x-0 transition-transform duration-[0.6s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-[150%]" />
                    <ArrowRight size={16} className="absolute text-white transform -translate-x-[150%] transition-transform duration-[0.6s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0" />
                  </div>
                </Link>
              </div>
            </motion.div>

            {/* List articles section with Pagination Reference Wrapper */}
            {gridArticles.length > 0 && (
              <div ref={gridContainerRef} className="scroll-mt-32">
                <div className="text-xs tracking-widest uppercase text-gray-600 font-semibold mb-8 flex items-center gap-4">
                  Recent Stories
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {currentArticles.map((article, index) => (
                    <Link 
                      href={`/news&updates/${article.slug}`}
                      key={article.id}
                      ref={(el) => { 
                        // @ts-ignore
                        if (el) cardsRef.current[index] = el; 
                      }}
                      className="group flex flex-col bg-white rounded-sm overflow-hidden border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 outline-none"
                    >
                      <div className="relative w-full aspect-[4/3] overflow-hidden bg-gray-100">
                        <Image 
                          src={article.image} 
                          alt={article.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-[1.5s] ease-out opacity-90 group-hover:opacity-100"
                        />
                        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm text-brand-blue px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] rounded-sm shadow-sm">
                          {article.category}
                        </div>
                      </div>

                      <div className="p-6 md:p-8 flex flex-col flex-grow">
                        <span className="text-[9px] md:text-[10px] tracking-[0.2em] font-semibold text-gray-800 uppercase mb-3 transition-colors duration-300">
                          {article.date}
                        </span>
                        
                        <h3 className="font-serif text-2xl md:text-3xl text-brand-blue leading-snug mb-4 group-hover:text-brand-gold transition-colors duration-300">
                          {article.title}
                        </h3>
                        
                        <p className="text-gray-600 font-light text-sm line-clamp-3 mb-8 flex-grow leading-relaxed whitespace-pre-wrap">
                          {article.excerpt}
                        </p>
                        
                        <div className="flex items-center gap-4 w-full pt-4 border-t border-gray-100 mt-auto">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-300 group-hover:border-brand-gold transition-colors duration-500 bg-white shadow-sm shrink-0">
                            <ArrowRight size={12} className="text-gray-400 group-hover:text-brand-gold transform group-hover:translate-x-0.5 transition-all duration-500" />
                          </div>
                          <span className="relative text-[10px] tracking-[0.2em] font-bold text-gray-500 uppercase transition-colors duration-500 group-hover:text-brand-blue pb-1">
                            Read Story
                            <span className="absolute left-0 bottom-0 w-0 h-[1px] bg-brand-blue transition-all duration-[0.4s] ease-out group-hover:w-full"></span>
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center mt-20 gap-3">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      aria-label="Previous Page"
                      className="w-12 h-12 flex items-center justify-center border border-gray-200 text-brand-blue rounded-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-brand-blue hover:text-white transition-colors duration-400 ease-out"
                    >
                      <ChevronLeft size={18} strokeWidth={2.5} />
                    </button>

                    <div className="flex items-center gap-2">
                      {[...Array(totalPages)].map((_, index) => {
                        const page = index + 1;
                        return (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`w-12 h-12 flex items-center justify-center text-xs font-bold tracking-widest rounded-sm transition-all duration-400 ease-out ${
                              currentPage === page
                                ? 'bg-brand-blue text-white shadow-md'
                                : 'bg-transparent text-gray-500 border border-transparent hover:border-gray-200 hover:text-brand-gold'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      aria-label="Next Page"
                      className="w-12 h-12 flex items-center justify-center border border-gray-200 text-brand-blue rounded-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-brand-blue hover:text-white transition-colors duration-400 ease-out"
                    >
                      <ChevronRight size={18} strokeWidth={2.5} />
                    </button>
                  </div>
                )}
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