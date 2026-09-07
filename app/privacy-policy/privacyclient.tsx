'use client';

import Navbar from '@/app/components/navbar';
import Footer from '@/app/components/footer';
import PageTransition from '@/app/components/page-transitions';
import Image from 'next/image';
import { motion } from 'framer-motion';
import Lenis from 'lenis';
import { useEffect } from 'react';

export default function PrivacyClient() {

  // Developers: Lenis Smooth Scroll Setup & Bulletproof Refresh
  useEffect(() => {
    window.history.scrollRestoration = 'manual';

    const lenis = new Lenis({
      duration: 1.8,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    setTimeout(() => {
      window.scrollTo(0, 0);
      lenis.scrollTo(0, { immediate: true });
    }, 50);

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#F9F9F7] font-sans flex flex-col selection:bg-brand-gold selection:text-white">
        
        {/* ================= FIXED: NAVIGATION BAR OVERLAY ================= */}
        <div className="relative z-50">
          <Navbar />
        </div>

        {/* Cinematic Hero Area - FADING BACKGROUND RESTORED */}
        <section className="relative w-full h-[50vh] min-h-[400px] flex items-center justify-center overflow-hidden bg-[#0A1128]">
          <div className="absolute inset-0 z-0">
            <Image 
              src="/images/privacy/building1.webp" 
              alt="Golden Topper Architecture" 
              fill 
              className="object-cover opacity-40 grayscale mix-blend-luminosity"
              priority
            />
            {/* Adjusted Gradient: Deep navy at top/middle for text contrast, fading to page bg at the very bottom */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0A1128]/95 via-brand-blue/80 to-[#F9F9F7]"></div>
          </div>
          
          <div className="relative z-10 max-w-[90rem] mx-auto w-full px-6 md:px-12 flex flex-col items-center text-center mt-16">
            
            {/* MATCHED FORMAT: Eyebrow Text with lines */}
            <div className="font-semibold flex flex-wrap justify-center text-[0.65rem] sm:text-xs md:text-sm tracking-[0.3em] md:tracking-[0.4em] uppercase text-white/80 font-bold mb-4 md:mb-6 gap-4 items-center">
              Legal Information
            </div>
            
            {/* MATCHED FORMAT: Shining Text with Anti-Clipping Fixes */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-serif text-white leading-[1.1] md:leading-[1.15] tracking-tight mb-4 max-w-5xl drop-shadow-2xl shadow-black py-2">
              <motion.span 
                initial={{ backgroundPosition: "200% center" }}
                animate={{ backgroundPosition: "-200% center" }}
                transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-brand-gold via-[#fff2cd] to-brand-gold bg-[length:200%_auto] drop-shadow-[0_0_20px_rgba(197,160,113,0.4)] pr-4 pb-2 pt-1 overflow-visible"
              >
                Privacy Policy
              </motion.span>
            </h1>
            
            {/* SUBTITLE */}
            <p className="text-white/80 text-[10px] md:text-xs tracking-widest uppercase font-semibold drop-shadow-md">
              Last Updated: May 2023
            </p>

          </div>
        </section>

        {/* Content Area with Sticky Sidebar Layout */}
        <main className="flex-grow max-w-[90rem] mx-auto w-full px-6 md:px-12 py-20 lg:py-32 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24 relative z-20">
          
          {/* Desktop Sticky Table of Contents */}
          <aside className="hidden lg:block lg:col-span-4 relative">
            <div className="sticky top-40 bg-white p-8 rounded-sm shadow-[0_20px_40px_rgba(0,0,0,0.03)] border border-gray-100">
              <h4 className="text-xs tracking-widest uppercase text-brand-gold font-bold mb-6">Contents</h4>
              <ul className="space-y-4 text-sm font-medium text-gray-500">
                <li><a href="#information-we-collect" className="hover:text-brand-blue transition-colors flex items-center gap-2 before:content-[''] before:w-0 hover:before:w-2 before:h-[1px] before:bg-brand-gold before:transition-all">Information We Collect</a></li>
                <li><a href="#how-we-use" className="hover:text-brand-blue transition-colors flex items-center gap-2 before:content-[''] before:w-0 hover:before:w-2 before:h-[1px] before:bg-brand-gold before:transition-all">How We Use Your Information</a></li>
                <li><a href="#information-sharing" className="hover:text-brand-blue transition-colors flex items-center gap-2 before:content-[''] before:w-0 hover:before:w-2 before:h-[1px] before:bg-brand-gold before:transition-all">Information Sharing</a></li>
              </ul>
            </div>
          </aside>

          {/* Main Legal Text */}
          <div className="lg:col-span-8 flex flex-col gap-16">
            
            <motion.section 
              id="information-we-collect"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-serif text-brand-blue mb-6 flex items-center gap-4">
                <span className="text-brand-gold text-xl font-light">01.</span> Information We Collect
              </h2>
              <div className="text-gray-600 font-light leading-relaxed text-lg space-y-4 border-l border-gray-200 pl-6">
                <p>
                  We collect information to provide better services to all our users. The types of personal information we may collect include:
                </p>
                <ul className="list-disc pl-6 space-y-3 marker:text-brand-gold">
                  <li><strong className="text-gray-800 font-medium">Contact Details:</strong> Name, email address, phone number.</li>
                  <li><strong className="text-gray-800 font-medium">Preferences:</strong> Property preferences and specific unit inquiries.</li>
                  <li><strong className="text-gray-800 font-medium">Financial Data:</strong> Information provided during loan pre-applications.</li>
                  <li><strong className="text-gray-800 font-medium">Technical Data:</strong> Website usage data, IP addresses, and analytics.</li>
                </ul>
              </div>
            </motion.section>

            <motion.section 
              id="how-we-use"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-serif text-brand-blue mb-6 flex items-center gap-4">
                <span className="text-brand-gold text-xl font-light">02.</span> How We Use Your Information
              </h2>
              <div className="text-gray-600 font-light leading-relaxed text-lg space-y-4 border-l border-gray-200 pl-6">
                <p>
                  We use the information we collect from all our services to provide, maintain, protect and improve them, to develop new ones, and to protect Golden Topper and our users. 
                </p>
                <p>
                  We also use this information to offer you tailored content – such as providing you with more relevant property recommendations, exclusive pre-selling access, and updates on our latest luxury developments.
                </p>
              </div>
            </motion.section>

            <motion.section 
              id="information-sharing"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-serif text-brand-blue mb-6 flex items-center gap-4">
                <span className="text-brand-gold text-xl font-light">03.</span> Information Sharing
              </h2>
              <div className="text-gray-600 font-light leading-relaxed text-lg space-y-4 border-l border-gray-200 pl-6">
                <p>
                  We do not share personal information with companies, organizations, and individuals outside of Golden Topper unless one of the following circumstances applies:
                </p>
                <ul className="list-disc pl-6 space-y-3 marker:text-brand-gold">
                  <li>With your explicit, recorded consent.</li>
                  <li>For external processing by trusted partners (e.g., our listed Partner Banks during loan applications).</li>
                  <li>For legal reasons and regulatory compliance within the Philippines.</li>
                </ul>
              </div>
            </motion.section>

          </div>
        </main>

        <Footer />
      </div>
    </PageTransition>
  );
}