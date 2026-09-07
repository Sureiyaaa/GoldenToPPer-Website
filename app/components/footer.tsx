'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Facebook, Instagram, Youtube } from 'lucide-react';
import { createClient } from '@/lib/supabase/client'; // Ensure this matches your project's path

export default function Footer() {

  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFooterProjects = async () => {
      try {
        const supabase = createClient();
        
        const { data, error } = await supabase
          .from('project_table') 
          .select('id, title, slug')
          .eq('is_active', true) 
          .order('id', { ascending: false }) 
          .limit(5);

        if (error) {
          console.error("Footer Fetch Error:", error.message);
          setIsLoading(false);
          return;
        }

        if (data) {
          setProjects(data);
        }
      } catch (err) {
        console.error("Unexpected Error:", err);
      } finally {
        setIsLoading(false); 
      }
    };

    fetchFooterProjects();
  }, []);

  return (
    <footer className="relative bg-brand-blue text-white pt-10 pb-12 overflow-hidden border-t border-white/10 ">
      
      {/* Background Texture for a Premium Feel */}
      <div className="absolute inset-0 opacity-[0.6] pointer-events-none mix-blend-overlay">
        <img src="/images/footer/footer_image.png" alt="Background Texture" className="w-full h-full object-cover object-center" />
      </div>

      <div className="relative z-10 w-full max-w-[88rem] mx-auto px-6 md:px-12 flex flex-col">
        
        {/* ================= TOP ANCHOR: LOGO & SOCIALS ================= */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-start mb-4 gap-8">
          <div>
              <img 
                src="/images/footer/GoldenTopperlogo.svg" 
                alt="Golden Topper" 
                className="h-10 md:h-12 w-auto mb-4" 
              />
          </div>
          
          {/* UPDATED: Stacked layout with centered text */}
          <div className="flex flex-col gap-3 mt-2 md:mt-0">
            <div className="flex gap-4 items-center">
              <Link href="https://www.facebook.com/goldentopperofficial/" className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center hover:bg-brand-gold hover:text-[#132243] hover:border-brand-gold transition-all duration-300 outline-none cursor-pointer">
                <Facebook size={20} strokeWidth={1.5} />
              </Link>
              <Link href="https://www.instagram.com/goldentopperofficial/" className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center hover:bg-brand-gold hover:text-[#132243] hover:border-brand-gold transition-all duration-300 outline-none cursor-pointer">
                <Instagram size={20} strokeWidth={1.5} />
              </Link>
              <Link href="https://www.youtube.com/@livewithgoldentopper" className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center hover:bg-brand-gold hover:text-[#132243] hover:border-brand-gold transition-all duration-300 outline-none cursor-pointer">
                <Youtube size={20} strokeWidth={1.5} />
              </Link>
            </div>
            
            {/* Contact Us Link - Centered Below */}
            <Link 
              href="/contact" 
              className="text-sm font-bold tracking-widest uppercase hover:text-gray-300 text-brand-gold transition-colors text-center"
            >
              Contact Us
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 w-full border-t border-white/10 pt-12 mb-4">
          
          {/* COLUMN 1: GLOBAL OFFICES */}
          <div className="flex flex-col gap-8">
            <h4 className="font-semibold text-[11px] tracking-[0.2em] uppercase text-white">Global Offices</h4>
            
            <div className="flex flex-col gap-2">
              <span className="text-[10px] tracking-widest text-brand-gold uppercase font-bold">Metro Manila</span>
              <p className="text-sm text-gray-100 font-light leading-relaxed">
                27F High Street South Corporate Plaza,<br />
                Bonifacio Global City 1630
              </p>
              <a href="tel:+63288167616" className="text-sm font-medium text-white underline underline-offset-4 hover:text-brand-gold transition-colors">(+63) 02 8816 7616</a>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] tracking-widest text-brand-gold uppercase font-bold">Cebu City</span>
              <p className="text-sm text-gray-100 font-light leading-relaxed">
                0549, Dionisio Jakosalem St. Cebu City
              </p>
              <a href="tel:+63323848888" className="text-sm font-medium text-white underline underline-offset-4 hover:text-brand-gold transition-colors">(+63) 032 384 8888</a>
            </div>

          </div>

          {/* COLUMN 2: EXPLORE */}
          <div className="flex flex-col gap-8 lg:pl-8">
            <h4 className="font-semibold text-[11px] tracking-[0.2em] uppercase text-white">Explore GT</h4>
            
            <div className="flex flex-col gap-4">
              <span className="text-[10px] tracking-widest text-brand-gold uppercase font-bold">About</span>
              <ul className="flex flex-col gap-3 text-sm text-gray-100 font-light">
                <li><Link href="/story" className="hover:text-brand-gold transition-colors">Our Story</Link></li>
              </ul>
            </div>

            <div className="flex flex-col gap-4 mt-4">
              <span className="text-[10px] tracking-widest text-brand-gold uppercase font-semibold">Discover</span>
              <ul className="flex flex-col gap-3 text-sm text-gray-100 font-light">
                <li><Link href="/partnerbanks" className="hover:text-brand-gold transition-colors">Partner Banks</Link></li>
                <li><Link href="/news&updates" className="hover:text-brand-gold transition-colors">News & Updates</Link></li>
                <li><Link href="/buyers-guide" className="hover:text-brand-gold transition-colors">Buyer's Guide</Link></li>
               <li><a href="/partnerbanks?apply=true" className="hover:text-brand-gold transition-colors outline-none cursor-pointer">Loan Application</a></li>
              </ul>
            </div>
          </div>

         {/* COLUMN 3: PROJECTS */}
          <div className="flex flex-col gap-8 lg:pl-8">
            <h4 className="font-semibold text-[11px] tracking-[0.2em] uppercase text-white">Projects</h4>
            
           <ul className="flex flex-col gap-4 text-sm text-gray-100 font-light">
              {isLoading ? (
                // Show this only while actively fetching
                <li><span className="opacity-50 transition-colors">Loading projects...</span></li>
              ) : projects.length > 0 ? (
                // Show this if projects exist
                projects.map((project) => (
                  <li key={project.id}>
                    <Link href={`/projects/${project.slug}`} className="hover:text-brand-gold transition-colors">
                      {project.title}
                    </Link>
                  </li>
                ))
              ) : (
                // Show this if the query succeeded but found 0 projects
                <li><span className="opacity-50 transition-colors">No active projects found.</span></li>
              )}
            </ul>
          </div>

          {/* COLUMN 4: LEGAL */}
          <div className="flex flex-col gap-8 lg:pl-8">
            <h4 className="font-semibold text-[11px] tracking-[0.2em] uppercase text-white">Legal</h4>
            
            <ul className="flex flex-col gap-4 text-sm text-gray-100 font-light">
              <li><Link href="/privacy-policy" className="hover:text-brand-gold transition-colors outline-none cursor-pointer">Privacy Policy</Link></li>
              <li><Link href="/terms-of-use" className="hover:text-brand-gold transition-colors outline-none cursor-pointer">Terms of Use</Link></li>
            </ul>
          </div>

        </div>

        {/* ================= BOTTOM BAR ================= */}
        <div className="w-full border-t border-white/10 pt-8 text-center md:text-left">
          <p className="text-gray-300 mt-2 text-[12px] md:text-xs">
            © 2026 Golden Topper Investments Inc. All Rights Reserved.
          </p>
        </div>

      </div>
    </footer>
  );
}