"use client"; 

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// Developers: Utilizing Next.js Image component to enable WebP compression and aggressive caching
import Image from 'next/image';

export default function HeroCarousel() {
  const heroImages = [
    '/images/navigation/parkone.png',
    '/images/navigation/City_Clou_image.png',
    '/images/navigation/elsol.webp',
    '/images/navigation/lavida.webp'
  ];

  const [currentImage, setCurrentImage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % heroImages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [heroImages.length]);

  return (
    <section className="relative w-full h-screen min-h-[650px] flex flex-col justify-center z-10 overflow-hidden bg-black">
      
      {/* Background Image Carousel */}
      <AnimatePresence>
        <motion.div
          key={currentImage}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0 z-0"
        >
          {/* Developers: Image component forces the browser to pull optimized WebP files instead of full-res CSS backgrounds */}
          <Image
            src={heroImages[currentImage]}
            alt="Property Showcase"
            fill
            priority={currentImage === 0}
            sizes="100vw"
            className="object-cover object-center"
          />
        </motion.div>
      </AnimatePresence>
      
      {/* Dark Gradient Overlay for Text Legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/60 z-0 pointer-events-none"></div>

      {/* Centered Content Container */}
      <div className="max-w-[90rem] mx-auto w-full px-6 md:px-12 relative z-10 flex flex-col items-center text-center">
        
        {/* Eyebrow Text */}
        <div className="flex flex-wrap justify-center text-[0.65rem] text-[12px] sm:text-xs md:text-[18px] tracking-[0.2em] md:tracking-[0.3em] uppercase text-white font-medium mb-6 md:mb-8 gap-4 items-center">
          Property Portfolio
        </div>

        {/* Animated Heading */}
        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-serif font-normal text-white leading-[1.1] md:leading-[1.15] tracking-tight mb-6 sm:mb-8 max-w-5xl drop-shadow-2xl shadow-black py-2"
        >
          {/* THE SHINING EFFECT */}
          <motion.span 
            initial={{ backgroundPosition: "200% center" }}
            animate={{ backgroundPosition: "-200% center" }}
            transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
            className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-brand-gold via-[#fff2cd] to-brand-gold bg-[length:200%_auto] drop-shadow-[0_0_20px_rgba(197,160,113,0.4)] pr-4 pb-2 pt-1"
          >
            Our Projects
          </motion.span>
        </motion.h1>

        {/* Animated Paragraph */}
        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
          className="text-sm sm:text-base md:text-lg lg:text-xl text-white/90 font-normal leading-relaxed max-w-3xl mx-auto drop-shadow-md mb-10 md:mb-12"
        >
          Innovating the real estate landscape by creating diversified living spaces built for an elevated way of life.
        </motion.p>
        
      </div>
    </section>
  );
}