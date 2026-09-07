'use client';

import { motion } from 'framer-motion'; 

export default function PreviewSkeleton({ data }: { data: any }) {
  const BLANK_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  const imageSrc = data.image || BLANK_IMAGE;

  return (
    <div className="w-full bg-white font-sans text-gray-900 pointer-events-none selection:bg-brand-gold selection:text-white flex flex-col relative min-h-full">
      
      {/* Fake Navbar placeholder for realism */}
      <div className="absolute top-0 left-0 w-full h-16 md:h-20 bg-gradient-to-b from-black/80 to-transparent z-50 flex items-center px-6">
         <div className="w-32 h-8 bg-white/20 rounded-sm backdrop-blur-sm"></div>
      </div>

      {/* --- HERO COVER --- */}
      <section className="relative w-full h-[50vh] min-h-[400px] z-10 bg-black overflow-hidden shadow-xl">
        <img 
          src={imageSrc}
          alt={data.title}
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/20 z-10"></div>
      </section>

      {/* --- EDITORIAL ARTICLE CONTENT --- */}
      <main className="w-full relative z-20 bg-white py-16 md:py-24 shadow-[0_-20px_50px_rgba(0,0,0,0.1)]">
        <div className="max-w-[85rem] mx-auto px-6 md:px-12">
          
          <motion.header 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 max-w-[70rem]" 
          >
            <div className="flex items-center gap-4 mb-4">
              <span className="text-brand-gold text-[10px] md:text-xs font-bold uppercase tracking-widest border border-brand-gold/30 px-3 py-1 rounded-full bg-brand-gold/5">
                {data.category}
              </span>
              <p className="text-brand-gold text-[10px] md:text-xs font-bold uppercase tracking-widest">
                {data.date}
              </p>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-brand-blue leading-[1.15] font-normal">
              {data.title}
            </h1>
          </motion.header>

          <motion.article 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="prose prose-lg md:prose-xl max-w-[80rem]"
          >
            <div className="whitespace-pre-wrap text-base md:text-lg text-gray-600 leading-relaxed font-light">
              {data.excerpt}
            </div>
          </motion.article>

        </div>
      </main>
    </div>
  );
}