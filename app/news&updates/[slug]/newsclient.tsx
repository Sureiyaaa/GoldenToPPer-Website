'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/app/components/navbar';
import Footer from '@/app/components/footer';
import PageTransition from '@/app/components/page-transitions';
import Image from 'next/image';
import { AlertCircle, ArrowRight } from 'lucide-react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import BackToTop from '@/app/components/backtotop';
import { createClient } from '@/lib/supabase/client';
import { ArticleSections } from '@/app/components/news/ArticleSections';
import { adaptLegacyArticleToSections, isValidSectionsDocument, type ArticleSectionsDocument } from '@/app/types/article-sections';
import { parseArticleContent, type TiptapDoc } from '@/lib/rendering/article-content';
import Link from 'next/link';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface NewsArticle {
  id: string | number;
  title: string;
  slug: string;
  category: string;
  date: string;
  image: string | null;
  show_cover_on_article?: boolean | null;
  excerpt: string | null;
  article_content?: string | TiptapDoc | null; // Can be JSONB object or JSON string from Supabase
  article_layout?: string;
  article_sections?: Record<string, any> | null;
}

export default function SingleNewsClient({
  initialArticle
}: {
  initialArticle: NewsArticle | null;
}) {
  const params = useParams();
  const currentSlug = params?.slug as string | undefined;
  const [recommendations, setRecommendations] = useState<NewsArticle[]>([]);
  const lenisRef = useRef<any>(null);
  const lenisTickerCallbackRef = useRef<((time: number) => void) | null>(null);
  const cardsRef = useRef<(HTMLAnchorElement | null)[]>([]);

  cardsRef.current = [];

  useIsomorphicLayoutEffect(() => {
    window.history.scrollRestoration = 'manual';
  }, []);

  // Show the latest other visible articles below the current story.
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!initialArticle) return;
      
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('news_updates') 
        .select('*')
        .neq('id', initialArticle.id)
        .is('is_archived', null)
        .eq('is_active', true)
        .order('date', { ascending: false })
        .limit(3);

      if (error) {
        console.error('Could not load related articles:', error.message);
        return;
      }

      setRecommendations(data || []);
    };

    fetchRecommendations();
  }, [initialArticle]);

  // --- Smooth Scrolling Setup ---
  useIsomorphicLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentSlug]);

  useEffect(() => {
    if (lenisRef.current) {
      lenisRef.current.destroy();
    }
    if (lenisTickerCallbackRef.current) {
      gsap.ticker.remove(lenisTickerCallbackRef.current);
    }

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

    const tickerCallback = (time: number) => { lenis.raf(time * 1000); };
    lenisTickerCallbackRef.current = tickerCallback;
    gsap.ticker.add(tickerCallback);

    return () => {
      lenis.destroy();
      if (lenisTickerCallbackRef.current) {
        gsap.ticker.remove(lenisTickerCallbackRef.current);
        lenisTickerCallbackRef.current = null;
      }
    };
  }, [currentSlug]);

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

  // Check if article has sections (new model) or uses legacy layout (old model)
  const hasSections = initialArticle.article_sections && isValidSectionsDocument(initialArticle.article_sections);

  // If no sections, adapt legacy content to sections in-memory for unified rendering
  const sectionsDoc: ArticleSectionsDocument = hasSections
    ? (initialArticle.article_sections as ArticleSectionsDocument)
    : adaptLegacyArticleToSections({
        title: initialArticle.title,
        excerpt: initialArticle.excerpt || '',
        article_content: initialArticle.article_content ? parseArticleContent(initialArticle.article_content) : null,
        image: initialArticle.image,
        article_layout: initialArticle.article_layout,
      });

  const showCover = Boolean(initialArticle.image) && initialArticle.show_cover_on_article !== false;

  return (
    <PageTransition>
      <div className="relative min-h-screen bg-white font-sans text-gray-900 selection:bg-brand-gold selection:text-white flex flex-col" style={{ overflowAnchor: 'none' }}>

        {/* Article Header: Cover image, navbar, title, metadata */}
        {!showCover && <Navbar />}
        {showCover && (
          <div data-news-cover className="relative h-screen min-h-[400px] w-full overflow-hidden bg-black">
            <div className="pointer-events-none absolute top-0 left-0 w-full z-[100]"><Navbar /></div>
            <Image
              src={initialArticle.image!}
              alt={initialArticle.title}
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/20 z-10 pointer-events-none"></div>
          </div>
        )}

        {/* Title and Metadata */}
        <div className="news-article-header relative z-20 w-full bg-white pt-16 md:pt-24">
          <div className="mx-auto max-w-[85rem] px-6 md:px-12">
            <p className="text-brand-gold text-[11px] md:text-xs font-bold uppercase tracking-widest mb-4">
              {initialArticle.date}
            </p>
            <h1 className="news-article-title text-4xl md:text-5xl lg:text-6xl font-serif text-brand-blue leading-[1.15] font-normal">
              {initialArticle.title}
            </h1>
          </div>
        </div>

        {/* Article Sections */}
        <ArticleSections document={sectionsDoc} isEditing={false} />

        {/* --- THE LATEST UPDATES (RECOMMENDATIONS) --- */}
        {recommendations.length > 0 && (
          <section className="relative z-[30] w-full py-24 md:py-32 bg-white">
          <div className="max-w-[85rem] mx-auto px-6 md:px-12">

            <h2 className="text-3xl md:text-4xl font-serif text-brand-blue text-center mb-16 font-normal">
              The Latest Updates
            </h2>

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
                      {article.image ? (
                        <Image
                          src={article.image}
                          alt={article.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-[1.5s] ease-out"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-blue to-[#0d1b3e] px-6 text-center font-serif text-xl text-white/70">
                          News &amp; Updates
                        </div>
                      )}
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

          </div>
          </section>
        )}

        {/* --- FOOTER --- */}
        <Footer />
        <BackToTop />
      </div>
    </PageTransition>
  );
}
