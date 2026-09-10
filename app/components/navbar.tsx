'use client';

import { useState, useEffect } from 'react';
import { Menu, X, ArrowRight, ChevronDown, User } from 'lucide-react'; 
import { usePathname } from 'next/navigation';
import Link from 'next/link'; 
import { createClient } from '@/lib/supabase/client'; 

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const pathname = usePathname();
  
  const [dynamicProjects, setDynamicProjects] = useState<any[]>([]);
  const [activeProject, setActiveProject] = useState<any>({ name: '', image: '', description: '', path: '' });
  const [activeModules, setActiveModules] = useState<Record<string, boolean>>({});
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileSubmenuOpen, setMobileSubmenuOpen] = useState(false);

 const PROJECT_LOGOS: Record<string, { src: string; height: string }> = {
  'city clou': { src: '/images/logos/city-clou-logo.png', height: 'h-10 md:h-10 -ml-2' },
  'el sol': { src: '/images/logos/el-sol-logo.png', height: 'h-12 md:h-22 -ml-2 -mb-2' },
  'la vida': { src: '/images/logos/la-vida-logo.png', height: 'h-11 md:h-21 -ml-4 -mb-2' },
  'park one': { src: '/images/logos/park-one-logo.png', height: 'h-9 md:h-8 -ml-2' },
};

  useEffect(() => {
    const fetchProjects = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('navbar_projects')
        .select(`
          nav_title, 
          nav_image_url,
          tagline, 
          project_table ( slug )
        `)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (data) {
        const formattedProjects = data.map((p: any) => {
          const projectData = Array.isArray(p.project_table) ? p.project_table[0] : p.project_table;
          const slug = projectData?.slug || '';

          return {
            name: p.nav_title,
            path: `/projects/${slug.replace(/^\//, '')}`, 
            image: p.nav_image_url || '/images/placeholder.webp',
            description: p.tagline || ""
          };
        });
        
        setDynamicProjects(formattedProjects);
        if (formattedProjects.length > 0) {
          setActiveProject(formattedProjects[0]);
        }
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    const fetchModules = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('modules')
        .select('module_code, is_active');

      if (error) {
        console.error("Navbar failed to fetch modules:", error.message);
      }

      if (data) {
        const moduleMap: Record<string, boolean> = {};
        data.forEach(m => { moduleMap[m.module_code] = m.is_active; });
        setActiveModules(moduleMap);
      }
    };
    fetchModules();
  }, []);
  
  const baseNavItems = [
    { name: 'Our Story', path: '/story' }, 
    { 
      name: 'Projects', 
      path: '/projects',
      moduleCode: 'edit_project',
      submenu: dynamicProjects.length > 0 ? dynamicProjects : null 
    },
    { name: 'Partner Banks', path: '/partnerbanks', moduleCode: 'edit_banks' },
    { name: 'News & Updates', path: '/news&updates', moduleCode: 'edit_news' },
    { name: 'Promotions', path: '/promotions', moduleCode: 'promotion_code'},
    { name: 'Payment', path: '/payment', moduleCode: 'payment_code' } 
  ];
  
  const navItems = baseNavItems.filter(item => {
    if (!item.moduleCode) return true;
    return activeModules[item.moduleCode] !== false; 
  });

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setMobileSubmenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="fixed top-0 w-full z-[5000] flex justify-center pointer-events-none">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes star-movement-bottom {
          0% { transform: translate(0%, 0%); opacity: 1; }
          100% { transform: translate(-100%, 0%); opacity: 1; }
        }
        @keyframes star-movement-top {
          0% { transform: translate(0%, 0%); opacity: 1; }
          100% { transform: translate(100%, 0%); opacity: 1; }
        }
      `}} />

      <header
        className={`relative pointer-events-auto flex items-center justify-between backdrop-blur-xl transition-all duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isScrolled
            ? 'w-[calc(100%-2rem)] md:w-[calc(100%-6rem)] max-w-[calc(90rem-6rem)] h-16 bg-brand-blue text-brand-gold rounded-full shadow-2xl border border-white/10 px-6 md:px-8 mt-4'
            : 'w-full max-w-[100vw] h-20 bg-transparent text-brand-gold border-white/10 rounded-none px-6 md:px-12 mt-0'
        }`}
      >
        <div className="flex items-center drop-shadow-md z-[5001]">
          <Link href="/">
            <img
              src="/images/navigation/GoldenTopperlogo.svg"
              alt="Golden Topper Logo"
              className={`w-auto cursor-pointer transition-all duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isScrolled ? 'h-7' : 'h-10'
              } min-h-[40px] relative z-[5001]`}
            />
          </Link>
        </div>

        <nav className={`hidden md:flex ${isScrolled ? 'gap-4 lg:gap-6' : 'gap-6 lg:gap-10'} font-bold tracking-widest uppercase h-full transition-all duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)]`}>
          {navItems.map((item) => (
            <div 
              key={item.name} 
              className="relative group flex items-center h-full"
              onMouseEnter={() => item.submenu && setIsDropdownOpen(true)}
              onMouseLeave={() => item.submenu && setIsDropdownOpen(false)}
            >
              <Link
                href={item.path}
                className={`text-[12px] text-brand-gold hover:text-white transition-all duration-[800ms] flex items-center gap-2 drop-shadow-md whitespace-nowrap ${
                  isScrolled ? 'py-5' : 'py-6'
                }`}
              >
                {item.name}
                {item.submenu && (
                  <span className={`relative flex items-center justify-center w-5 h-5 overflow-hidden rounded-full border transition-all duration-300 ${
                    isDropdownOpen 
                      ? 'border-brand-gold' 
                      : 'border-brand-gold/30 group-hover:border-brand-gold'
                  }`}>
                    <span className={`absolute inset-0 bg-brand-gold transition-transform duration-300 ease-out ${
                      isDropdownOpen ? 'translate-y-0' : 'translate-y-full group-hover:translate-y-0'
                    }`} />
                    
                    <ChevronDown size={14} className={`relative z-10 transition-all duration-300 ${
                      isDropdownOpen ? 'rotate-180 text-brand-blue' : 'text-brand-gold group-hover:text-brand-blue'
                    }`} />
                  </span>
                )}
              </Link>

              {item.submenu && (
                <div 
                  className={`absolute top-full left-[-420px] pt-4 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isDropdownOpen 
                      ? 'opacity-100 pointer-events-auto visible' 
                      : 'opacity-0 pointer-events-none invisible delay-75' 
                  }`}
                >
                  <div className="absolute -top-6 left-0 w-full h-12 bg-transparent" />

                  <div className={`w-[1000px] h-[450px] bg-brand-blue/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl flex overflow-hidden origin-top transform transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isDropdownOpen ? 'scale-100 translate-y-0' : 'scale-[0.97] -translate-y-3'
                  }`}>
                    
                    <div className="w-[40%] bg-brand-blue p-8 flex flex-col justify-center gap-3 border-r border-white/10 z-10 relative">
                      <h4 className="text-[10px] text-gray-400 mb-4 tracking-[0.2em] ml-5">OUR DEVELOPMENTS</h4>
                      {item.submenu.map((sub: any) => (
                        <Link
                          href={sub.path}
                          key={sub.name}
                          onMouseEnter={() => setActiveProject(sub)}
                          className={`px-5 py-4 rounded-xl cursor-pointer transition-all duration-300 flex items-center justify-between group/link ${
                            activeProject.name === sub.name 
                              ? 'bg-brand-gold/10 border border-brand-gold/30 shadow-[inset_0_0_20px_rgba(208,179,112,0.1)]' 
                              : 'hover:bg-white/5 border border-transparent'
                          }`}
                        >
                          <span className={`text-[11px] uppercase transition-all duration-300 ${
                            activeProject.name === sub.name 
                              ? 'text-brand-gold font-bold tracking-widest drop-shadow-[0_0_5px_rgba(208,179,112,0.5)]' 
                              : 'text-gray-400 tracking-widest group-hover/link:text-white'
                          }`}>
                            {sub.name}
                          </span>
                          
                          <div className={`flex items-center justify-center rounded-full transition-all duration-300 ${
                            activeProject.name === sub.name 
                              ? 'w-8 h-8 bg-brand-gold shadow-[0_4px_10px_rgba(0,0,0,0.3)]' 
                              : 'w-8 h-8 bg-transparent border border-white/10 group-hover/link:border-brand-gold group-hover/link:bg-brand-gold'
                          }`}>
                            <ArrowRight size={16} strokeWidth={2.5} className={`transition-all duration-300 ${
                              activeProject.name === sub.name 
                                ? 'text-brand-blue translate-x-0' 
                                : 'text-gray-500 group-hover/link:text-brand-blue group-hover/link:translate-x-0.5'
                            }`} />
                          </div>
                        </Link>
                      ))}
                    </div>

                    <div className="w-[65%] relative overflow-hidden group/showcase bg-[#0d1b3e]">
                      {activeProject.name && (
                        <Link href={activeProject.path} className="absolute inset-0 block">
                          <img 
                            key={activeProject.name} 
                            src={activeProject.image} 
                            alt={activeProject.name} 
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1.5s] ease-out scale-100 group-hover/showcase:scale-105"
                            onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/800x600/142f72/D0B370?text=Image+Not+Found' }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none"></div>

                          <div className="absolute bottom-0 left-0 w-full p-10 flex flex-col items-start transform transition-transform duration-500 translate-y-4 group-hover/showcase:translate-y-0">
                            {(() => {
                              const key = (activeProject.name || '').toLowerCase().trim();
                              const logo = PROJECT_LOGOS[key];

                              return logo ? (
                                <div className="mb-4 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                                  <img
                                    src={logo.src}
                                    alt={activeProject.name}
                                    className={`${logo.height} w-auto object-contain`}
                                  />
                                </div>
                              ) : (
                                <h2 className="text-4xl font-serif text-white mb-3 drop-shadow-xl">
                                  {activeProject.name}
                                </h2>
                              );
                            })()}

                            <p className="text-sm text-gray-200 font-light leading-relaxed mb-6 line-clamp-3 normal-case tracking-normal drop-shadow-md max-w-md">
                              {activeProject.description}
                            </p>
                          </div>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>
        
        <div className={`flex items-center transition-all duration-[800ms] ${isScrolled ? 'gap-4' : 'gap-6'} z-[5001]`}>

          <div className="relative hidden md:inline-block overflow-hidden rounded-full cursor-pointer group bg-white/5" style={{ padding: '1.5px' }}>
            <div className="absolute bottom-[-12px] right-[-250%] w-[300%] h-[50%] rounded-full z-0" style={{ background: `radial-gradient(circle, #ffffff 0%, var(--color-brand-gold) 10%, transparent 30%)`, animation: `star-movement-bottom 3s linear infinite alternate` }}></div>
            <div className="absolute top-[-12px] left-[-250%] w-[300%] h-[50%] rounded-full z-0" style={{ background: `radial-gradient(circle, #ffffff 0%, var(--color-brand-gold) 10%, transparent 30%)`, animation: `star-movement-top 3s linear infinite alternate` }}></div>
            
            <div className={`relative z-10 w-full h-full rounded-full flex items-center gap-3 bg-brand-blue backdrop-blur-xl group-hover:bg-brand-blue transition-all duration-[800ms] ${isScrolled ? 'pr-5 p-1.5' : 'pr-6 p-1.5'}`}>
              <div className={`${isScrolled ? 'w-7 h-7' : 'w-8 h-8'} rounded-full bg-brand-gold/20 border border-brand-gold/50 overflow-hidden flex items-center justify-center transition-all duration-[800ms] group-hover:bg-brand-gold text-brand-gold group-hover:text-brand-blue`}>
                <ArrowRight size={14} strokeWidth={2.5} className="transition-transform duration-300 group-hover:translate-x-0.5" />
              </div>
              <Link href='/inquire' className="text-[11px] font-bold uppercase tracking-widest text-brand-gold group-hover:text-white transition-all duration-[800ms] whitespace-nowrap">
                Inquire Now
              </Link>
            </div>
          </div>

          <Link 
            href="/login" 
            className={`hidden md:flex items-center justify-center text-brand-gold hover:text-white transition-all duration-[800ms] outline-none ${
              isScrolled ? 'w-0 opacity-0 overflow-hidden pointer-events-none scale-50' : 'w-auto opacity-100 scale-100'
            }`}
            aria-label="Login"
          >
            <User size={26} strokeWidth={2} className="shrink-0" />
          </Link>

          <button 
            onClick={() => setIsMobileMenuOpen(true)} 
            className="md:hidden relative z-[5001] outline-none cursor-pointer transition-all duration-[800ms] text-brand-gold hover:text-white"
          >
            <Menu size={isScrolled ? 24 : 28} />
          </button>
        </div>
      </header>

      <div 
        className={`fixed inset-0 bg-brand-blue w-full h-[100dvh] pointer-events-auto transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] z-[6000] flex flex-col md:hidden overflow-hidden ${
          isMobileMenuOpen ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 md:px-8 h-24 shrink-0 border-b border-white/10">
          <img
            src="/images/navigation/GoldenTopperlogo.svg"
            alt="Golden Topper Logo"
            className="h-8 w-auto relative" 
          />
          <button 
            onClick={() => setIsMobileMenuOpen(false)} 
            className="text-brand-gold hover:text-white transition-colors outline-none cursor-pointer p-2 -mr-2"
            aria-label="Close menu"
          >
            <X size={36} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pt-4 pb-12 flex flex-col">
          <div className="flex flex-col w-full">
            {navItems.map((item, idx) => (
              <div key={idx} className="border-b border-white/10 py-5">
                {item.submenu ? (
                  <div className="flex flex-col">
                    <div className="flex justify-between items-center w-full">
                      <Link 
                        href={item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="text-base font-bold tracking-widest uppercase text-brand-gold outline-none"
                      >
                        {item.name}
                      </Link>
                      
                      <button 
                        onClick={() => setMobileSubmenuOpen(!mobileSubmenuOpen)}
                        className={`relative flex items-center justify-center w-8 h-8 overflow-hidden rounded-full border transition-all duration-300 outline-none cursor-pointer ${
                          mobileSubmenuOpen 
                            ? 'border-brand-gold' 
                            : 'border-brand-gold/30 hover:border-brand-gold'
                        }`}
                      >
                        <span className={`absolute inset-0 bg-brand-gold transition-transform duration-300 ease-out ${
                          mobileSubmenuOpen ? 'translate-y-0' : 'translate-y-full hover:translate-y-0'
                        }`} />
                        <ChevronDown size={18} strokeWidth={2} className={`relative z-10 transition-transform duration-300 ${
                          mobileSubmenuOpen ? 'rotate-180 text-brand-blue' : 'text-brand-gold hover:text-brand-blue'
                        }`} />
                      </button>
                    </div>
                    
                    <div className={`flex flex-col gap-4 overflow-hidden transition-all duration-500 ease-in-out ${mobileSubmenuOpen ? 'max-h-[400px] opacity-100 mt-5' : 'max-h-0 opacity-0 mt-0'}`}>
                      {item.submenu.map((sub: any, subIdx: number) => (
                        <Link 
                          key={subIdx} 
                          href={sub.path}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="group flex items-center justify-between text-brand-gold hover:text-white text-sm font-bold tracking-widest uppercase transition-colors pl-4 border-l border-brand-gold/50"
                        >
                          {sub.name}
                          <div className="w-6 h-6 rounded-full bg-brand-gold flex items-center justify-center opacity-0 -translate-x-4 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
                            <ArrowRight size={12} strokeWidth={3} className="text-brand-blue" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Link 
                    href={item.path} 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-base font-bold tracking-widest uppercase text-brand-gold block hover:text-white transition-colors"
                  >
                    {item.name}
                  </Link>
                )}
              </div>
            ))}
            
            <div className="border-b border-white/10 py-5">
              <Link 
                href="/login" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 text-base font-bold tracking-widest uppercase text-brand-gold hover:text-white transition-colors"
              >
                <User size={20} strokeWidth={2} />
                Login
              </Link>
            </div>
            
          </div>

          <div className="mt-12 w-full flex justify-center">
            <div className="relative inline-block w-full overflow-hidden rounded-full cursor-pointer group bg-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.5)]" style={{ padding: '1.5px' }}>
              <div className="absolute bottom-[-12px] right-[-250%] w-[300%] h-[50%] rounded-full z-0" style={{ background: `radial-gradient(circle, #ffffff 0%, var(--color-brand-gold) 10%, transparent 30%)`, animation: `star-movement-bottom 3s linear infinite alternate` }}></div>
              <div className="absolute top-[-12px] left-[-250%] w-[300%] h-[50%] rounded-full z-0" style={{ background: `radial-gradient(circle, #ffffff 0%, var(--color-brand-gold) 10%, transparent 30%)`, animation: `star-movement-top 3s linear infinite alternate` }}></div>
              <div className="relative z-10 w-full h-full rounded-full flex items-center justify-center gap-4 bg-brand-blue backdrop-blur-xl group-hover:bg-brand-blue transition-colors duration-300 py-3.5 px-6">
                <div className="w-8 h-8 rounded-full bg-brand-gold/20 border border-brand-gold/50 overflow-hidden flex items-center justify-center transition-all duration-300 group-hover:bg-brand-gold text-brand-gold group-hover:text-brand-blue shrink-0">
                  <ArrowRight size={14} strokeWidth={2.5} className="transition-transform duration-300 group-hover:translate-x-0.5" />
                </div>
                <Link
                  href='/inquire' 
                  onClick={() => setIsMobileMenuOpen(false)} 
                  className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-gold group-hover:text-white transition-colors duration-300"
                >
                  Inquire Now
                </Link>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}