'use client';

import { useEffect, useRef } from 'react';
import { ArrowUp } from 'lucide-react';

export default function BackToTop() {
  const topBtnRef = useRef<HTMLDivElement>(null);
  const progressCircleRef = useRef<SVGCircleElement>(null);

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
            // Added a fallback to prevent division by zero at the very top of the page
            const progress = totalHeight > 0 ? window.scrollY / totalHeight : 0;
            const dashoffset = 289.03 - (progress * 289.03);
            progressCircleRef.current.style.strokeDashoffset = dashoffset.toString();
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Trigger once on mount to set initial state
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div 
      ref={topBtnRef}
      className="fixed bottom-26 right-4 md:bottom-16 md:right-12 z-50 transition-all duration-500 ease-out opacity-0 translate-y-10 pointer-events-none group"
    >
      <button 
        onClick={scrollToTop} 
        className="relative w-18 h-18 md:w-20 md:h-20 flex items-center justify-center rounded-full bg-brand-blue shadow-[0_4px_12px_rgba(0,0,0,0.3)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.5)] transition-all duration-300 active:scale-90 focus-visible:ring-4 focus-visible:ring-brand-gold outline-none"
        aria-label="Back to top"
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r="46" fill="transparent" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
          <circle
            ref={progressCircleRef}
            cx="50"
            cy="50"
            r="46"
            fill="transparent"
            stroke="var(--color-brand-gold)"
            strokeWidth="4"
            strokeDasharray="289.03" 
            strokeDashoffset="289.03"
            strokeLinecap="round"
          />
        </svg>
        <ArrowUp size={32} className="relative z-10 text-white group-hover:text-brand-gold group-hover:-translate-y-1 transition-all duration-300" aria-hidden="true" />
      </button>
      <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[12px] py-1 px-2.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase tracking-widest font-bold">
        Top
      </span>
    </div>
  );
}