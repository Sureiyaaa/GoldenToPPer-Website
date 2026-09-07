'use client';

import Navbar from '@/app/components/navbar';
import Footer from '@/app/components/footer';
import PageTransition from '@/app/components/page-transitions';
import Image from 'next/image';
import { motion } from 'framer-motion';
import Lenis from 'lenis';
import { useEffect } from 'react';

export default function TermsClient() {
  
  // Developers: Lenis Smooth Scroll Setup & Bulletproof Refresh
  useEffect(() => {
    // Force native browser to the top BEFORE Lenis boots up
    window.history.scrollRestoration = 'manual';

    const lenis = new Lenis({
      duration: 1.8,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    // The timeout gives the browser 50ms to settle and snap to top
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
        <div className="relative z-50">
          <Navbar />
        </div>

        {/* Cinematic Hero Area - MAINTAINED FADING BACKGROUND, UPDATED TYPOGRAPHY */}
        <section className="relative w-full h-[50vh] min-h-[400px] flex items-center justify-center overflow-hidden bg-[#0A1128]">
          <div className="absolute inset-0 z-0">
            <Image 
              src="/images/terms/building1.webp" 
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
            
            {/* UPDATED: text-5xl sm:text-6xl and pr-4 pb-2 pt-1 for italic tails */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-serif text-white leading-[1.1] md:leading-[1.15] tracking-tight mb-4 max-w-5xl drop-shadow-2xl shadow-black py-2">
              <motion.span 
                initial={{ backgroundPosition: "200% center" }}
                animate={{ backgroundPosition: "-200% center" }}
                transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                className="font-normal inline-block text-transparent bg-clip-text bg-gradient-to-r from-brand-gold via-[#fff2cd] to-brand-gold bg-[length:200%_auto] drop-shadow-[0_0_20px_rgba(197,160,113,0.4)] pr-4 pb-2 pt-1 overflow-visible"
              >
                Terms of Use
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
                <li><a href="#acceptance" className="hover:text-brand-blue transition-colors flex items-center gap-2 before:content-[''] before:w-0 hover:before:w-2 before:h-[1px] before:bg-brand-gold before:transition-all">Acceptance of Terms</a></li>
                <li><a href="#intellectual-property" className="hover:text-brand-blue transition-colors flex items-center gap-2 before:content-[''] before:w-0 hover:before:w-2 before:h-[1px] before:bg-brand-gold before:transition-all">Intellectual Property</a></li>
                <li><a href="#disclaimer" className="hover:text-brand-blue transition-colors flex items-center gap-2 before:content-[''] before:w-0 hover:before:w-2 before:h-[1px] before:bg-brand-gold before:transition-all">Disclaimer of Warranties</a></li>
              </ul>
            </div>
          </aside>

          {/* Main Legal Text */}
          <div className="lg:col-span-8 flex flex-col gap-16">
            
            <motion.section 
              id="acceptance"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-serif text-brand-blue mb-6 flex items-center gap-4">
                <span className="text-brand-gold text-xl font-light">01.</span> Acceptance of Terms
              </h2>
              <div className="text-gray-600 font-light leading-relaxed text-lg space-y-4 border-l border-gray-200 pl-6">
                <p>
                  By accessing and using the Golden Topper digital platform and related services, you accept and agree to be bound by the terms and provision of this agreement. 
                </p>
                <p>
                  If you do not agree to abide by the above, please refrain from using this service. Continued use of the platform constitutes your ongoing acceptance of these terms.
                </p>
              </div>
            </motion.section>

            <motion.section 
              id="intellectual-property"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-serif text-brand-blue mb-6 flex items-center gap-4">
                <span className="text-brand-gold text-xl font-light">02.</span> Intellectual Property Rights
              </h2>
              <div className="text-gray-600 font-light leading-relaxed text-lg space-y-4 border-l border-gray-200 pl-6">
                <p>
                  All content, trademarks, and data on this website—including but not limited to architectural blueprints, software, databases, text, graphics, icons, hyperlinks, private information, designs, and agreements—are the exclusive property of, or licensed to, Golden Topper.
                </p>
                <p>
                  As such, they are protected from infringement by local and international legislation and treaties. Unauthorized reproduction or distribution is strictly prohibited.
                </p>
              </div>
            </motion.section>

            <motion.section 
              id="disclaimer"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-serif text-brand-blue mb-6 flex items-center gap-4">
                <span className="text-brand-gold text-xl font-light">03.</span> Disclaimer of Warranties
              </h2>
              <div className="text-gray-600 font-light leading-relaxed text-lg space-y-4 border-l border-gray-200 pl-6">
                <p>
                  The information on this website is provided "as is" without any representations or warranties, express or implied. Golden Topper makes no representations or warranties in relation to this website or the information and materials provided on this website.
                </p>
                <p>
                  Prices, availability of units, and project details are subject to change without prior notice. Final specifications are to be referenced in official physical contracts.
                </p>
              </div>
            </motion.section>

          </div>
        </main>

        <Footer />
      </div>
    </PageTransition>
  );
}