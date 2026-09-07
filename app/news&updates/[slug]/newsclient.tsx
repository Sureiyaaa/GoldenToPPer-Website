'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Navbar from '@/app/components/navbar';
import Footer from '@/app/components/footer';
import PageTransition from '@/app/components/page-transitions';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowRight } from 'lucide-react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import BackToTop from '@/app/components/backtotop';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface NewsArticle {
  id: number;
  title: string;
  slug: string;
  category: string;
  date: string;
  image: string;
  excerpt: string;
}

export default function SingleNewsClient({ 
  initialArticle 
}: { 
  initialArticle: NewsArticle | null;
}) {
  const [recommendations, setRecommendations] = useState<NewsArticle[]>([]);
  const lenisRef = useRef<any>(null);
  const cardsRef = useRef<(HTMLAnchorElement | null)[]>([]);

  cardsRef.current = [];

  // --- 1. Fetch Recommendations (WITH DEBUGGING) ---
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!initialArticle) return;
      
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('news_updates') 
        .select('*')
        .neq('id', initialArticle.id)
        .is('is_archived', null)
        .eq('is_active', true); 

      if (error) {
        console.error("SUPABASE ERROR FETCHING RECOMMENDATIONS:", error.message);
        return;
      }

      console.log("SUPABASE RETURNED:", data); // Check your F12 Console for this!

      if (data && data.length > 0) {
        const shuffled = data.sort(() => 0.5 - Math.random());
        setRecommendations(shuffled.slice(0, 3));
      }
    };

    fetchRecommendations();
  }, [initialArticle]);

  // --- Smooth Scrolling Setup ---
  useIsomorphicLayoutEffect(() => {
    window.history.scrollRestoration = 'manual';
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

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

  // --- Scroll Animations for Recommendations ---
  useEffect(() => {
    if (recommendations.length === 0) return;

    let ctx = gsap.context(() => {
      setTimeout(() => {
        ScrollTrigger.refresh();

        cardsRef.current.forEach((el) => {
          if (!el) return;
          gsap.fromTo(
            el,
            { opacity: 0, y: 50 },
            {
              opacity: 1,
              y: 0,
              duration: 1,
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
  }, [recommendations]);


  if (!initialArticle) {
    return (
      <div className="min-h-screen bg-[#ffffff] flex flex-col font-sans">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center text-center px-4">
          <AlertCircle size={48} className="text-red-500 mb-4" />
          <h1 className="text-4xl font-serif text-brand-blue mb-4">Article Not Found</h1>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="relative min-h-screen bg-white font-sans text-gray-900 selection:bg-brand-gold selection:text-white flex flex-col" style={{ overflowAnchor: 'none' }}>
        
        <div className="absolute top-0 left-0 w-full z-[100]"><Navbar /></div>
        
        {/* --- 100VH HERO COVER --- */}
        <section className="relative w-full h-screen z-10 bg-black">
          <Image 
            src={initialArticle.image || '/images/placeholder.webp'}
            alt={initialArticle.title}
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/20 z-10 pointer-events-none"></div>
        </section>

        {/* --- EDITORIAL ARTICLE CONTENT --- */}
        <main className="w-full relative z-20 bg-white py-20 md:py-32">
          {/* ALIGNMENT FIX: Changed max-w-[55rem] to max-w-[85rem] */}
          <div className="max-w-[85rem] mx-auto px-6 md:px-12">
            
            <motion.header 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="mb-12 max-w-[70rem]" 
            >
              <p className="text-brand-gold text-[11px] md:text-xs font-bold uppercase tracking-widest mb-4">
                {initialArticle.date}
              </p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-brand-blue leading-[1.15] font-normal">
                {initialArticle.title}
              </h1>
            </motion.header>

            <motion.article 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.2 }}
              className="prose prose-lg md:prose-xl max-w-[80rem]" /* ALIGNMENT FIX: Keeps reading width clean */
            >
              <div className="whitespace-pre-wrap text-base md:text-lg text-gray-600 leading-relaxed font-light">
                {initialArticle.excerpt}
              </div>
            </motion.article>

          </div>
        </main>

        {/* --- THE LATEST UPDATES (RECOMMENDATIONS) --- */}
        <section className="relative z-[30] w-full py-24 md:py-32">
          <div className="max-w-[85rem] mx-auto px-6 md:px-12">
            
            <h2 className="text-3xl md:text-4xl font-serif text-brand-blue text-center mb-16 font-normal">
              The Latest Updates
            </h2>

            {recommendations.length === 0 ? (
              <div className="w-full p-8 border-2 border-red-500 border-dashed rounded-lg bg-red-50 flex flex-col items-center justify-center text-center">
                <AlertCircle className="text-red-500 mb-4" size={32} />
                <h3 className="text-red-700 font-bold mb-2">No Recommendations Found</h3>
                <p className="text-red-600 text-sm max-w-lg">
                  The UI is rendering perfectly, but Supabase returned 0 articles. Press F12 and check your browser Console for the "SUPABASE ERROR" log to see why the fetch failed.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {recommendations.map((article, index) => (
                  <Link 
                    href={`/news&updates/${article.slug}`}
                    key={article.id}
                    ref={(el: HTMLAnchorElement | null) => { /* TS FIX: Added HTMLAnchorElement type */
                      if (el) cardsRef.current[index] = el; 
                    }}
                    className="group flex flex-col bg-white rounded-sm overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 outline-none"
                  >
                    <div className="relative w-full aspect-[4/3] overflow-hidden bg-gray-200">
                      <Image 
                        src={article.image} 
                        alt={article.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-[1.5s] ease-out"
                      />
                    </div>

                    <div className="p-6 md:p-8 flex flex-col flex-grow">
                      <span className="text-brand-gold text-xs font-bold mb-3 tracking-wide">
                        {article.date}
                      </span>
                      
                      <h3 className="font-serif text-xl md:text-2xl text-brand-blue font-normal leading-snug mb-4 group-hover:text-brand-gold transition-colors duration-300 line-clamp-2">
                        {article.title}
                      </h3>
                      
                      <p className="text-gray-500 font-light text-sm line-clamp-3 mb-8 flex-grow leading-relaxed">
                        {article.excerpt}
                      </p>
                      
                      <div className="mt-auto flex items-center gap-2 text-brand-gold text-[10px] md:text-[11px] font-bold uppercase tracking-widest">
                        READ MORE 
                        <ArrowRight size={14} className="transform group-hover:translate-x-1 transition-transform duration-300" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

          </div>
        </section>

        <Footer />
        <BackToTop />
      </div>
    </PageTransition>
  );
}