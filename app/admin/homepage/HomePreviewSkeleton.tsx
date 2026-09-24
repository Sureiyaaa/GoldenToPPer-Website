// app/admin/homepage/HomePreviewSkeleton.tsx
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Play, ArrowRight, Move3d } from 'lucide-react';

export type HomepageEditorRegion = 
  | 'hero-section' 
  | `slide:${number}` 
  | 'about-section' 
  | 'dev-areas' 
  | `dev-item:${number}` 
  | 'process-section' 
  | `process-step:${number}` 
  | 'video-section' 
  | 'awards-section' 
  | `award:${number}`
  | 'news-section'
  | `news-item:${number}`;

interface HomePreviewSkeletonProps {
  data: any;
  selectedRegion: HomepageEditorRegion;
  onSelectRegion: (region: HomepageEditorRegion) => void;
}

export default function HomePreviewSkeleton({
  data,
  selectedRegion,
  onSelectRegion
}: HomePreviewSkeletonProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [activeDev, setActiveDev] = useState(0);

  const heroSlides = data.heroSlides?.length > 0 ? data.heroSlides : [];
  const currentSlide = heroSlides[activeSlide] || heroSlides[0] || {};
  const devAreas = data.developmentAreas?.length > 0 ? data.developmentAreas : [];
  const currentDev = devAreas[activeDev] || devAreas[0] || {};
  const processSteps = data.processSteps?.length > 0 ? data.processSteps : [];
  const newsArticles = data.newsArticles?.length > 0 ? data.newsArticles : [];
  const settings = data.settings || {};

  const select = (e: React.MouseEvent, region: HomepageEditorRegion) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectRegion(region);
  };

  useEffect(() => {
    if (selectedRegion?.startsWith('dev-item:')) {
      const idx = Number(selectedRegion.split(':')[1]);
      if (!isNaN(idx)) setActiveDev(idx);
    } else if (selectedRegion?.startsWith('slide:')) {
      const idx = Number(selectedRegion.split(':')[1]);
      if (!isNaN(idx)) setActiveSlide(idx);
    }
  }, [selectedRegion]);

  return (
    <div className="relative font-sans text-gray-900 bg-[#E7E7E7] overflow-x-hidden select-none">
      
      {/* 1. HERO SECTION */}
      <section 
        onClick={(e) => select(e, `slide:${activeSlide}`)}
        className={`relative h-[85vh] w-full overflow-hidden bg-black cursor-pointer transition-all ${
          selectedRegion.startsWith('slide:') || selectedRegion === 'hero-section' ? 'ring-4 ring-brand-gold' : 'hover:ring-2 hover:ring-white/40'
        }`}
      >
        {currentSlide.image && (
          <Image src={currentSlide.image} alt="" fill className="object-cover opacity-60" priority />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/40" />

        <div className="absolute inset-0 z-20 flex flex-col justify-center items-center text-center px-6">
          <p className="text-white text-xs font-bold uppercase tracking-[0.3em] mb-4">
            {currentSlide.location || 'Location'}, Philippines
          </p>
          <h1 className="text-5xl lg:text-7xl font-serif text-white mb-6">
            {currentSlide.heading_line_1} <br />
            <span className="text-brand-gold">{currentSlide.heading_line_2}</span>
          </h1>

          <div className="flex gap-4">
            <span className="bg-brand-blue text-white px-8 py-3.5 text-[11px] font-bold uppercase tracking-widest rounded-sm">
              View Project
            </span>
            <span className="bg-black/50 border border-white/20 text-white px-8 py-3.5 text-[11px] font-bold uppercase tracking-widest rounded-sm flex items-center gap-2">
              <Move3d size={15} className="text-brand-gold" /> Virtual Tour
            </span>
          </div>

          <div className="absolute bottom-8 flex gap-3 z-30">
            {heroSlides.map((slide: any, idx: number) => (
              <button
                key={slide.id || idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSlide(idx);
                  onSelectRegion(`slide:${idx}`);
                }}
                className={`w-28 h-14 relative rounded overflow-hidden border-2 transition-all ${
                  activeSlide === idx ? 'border-brand-gold scale-105' : 'border-white/20 opacity-50'
                }`}
              >
                {slide.image && <Image src={slide.image} alt="" fill className="object-cover" />}
                <div className="absolute inset-0 bg-black/40 flex items-end p-1 text-[9px] font-bold text-white truncate">
                  {slide.heading_line_1}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. ABOUT US & STATS SECTION */}
      <section
        onClick={(e) => select(e, 'about-section')}
        className={`py-24 bg-white px-6 md:px-12 cursor-pointer transition-all ${
          selectedRegion === 'about-section' ? 'ring-4 ring-brand-gold' : 'hover:ring-2 hover:ring-brand-blue/20'
        }`}
      >
        <div className="max-w-[90rem] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
            <h4 className="text-brand-gold font-bold text-xs uppercase tracking-widest mb-3">
              {settings.about_tagline || 'About Us'}
            </h4>
            <h2 className="text-brand-blue text-4xl lg:text-5xl font-serif mb-6">
              {settings.about_heading || 'Better Cities, Better Lives'}
            </h2>
            <div className="text-gray-600 space-y-4 text-base font-light leading-relaxed">
              <p>{settings.about_description_1}</p>
              <p>{settings.about_description_2}</p>
            </div>
          </div>

          <div className="lg:col-span-4 lg:col-start-9 space-y-8">
            <div>
              <span className="text-brand-gold text-5xl font-serif">{settings.stat_projects_val}{settings.stat_projects_suffix}</span>
              <p className="text-brand-blue text-lg font-serif">{settings.stat_projects_label}</p>
            </div>
            <div>
              <span className="text-brand-gold text-5xl font-serif">{settings.stat_team_val}{settings.stat_team_suffix}</span>
              <p className="text-brand-blue text-lg font-serif">{settings.stat_team_label}</p>
            </div>
            <div>
              <span className="text-brand-gold text-5xl font-serif">{settings.stat_landbank_val}{settings.stat_landbank_suffix}</span>
              <p className="text-brand-blue text-lg font-serif">{settings.stat_landbank_label}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. DEVELOPMENT AREAS SECTION */}
      <section 
        onClick={(e) => select(e, `dev-item:${activeDev}`)}
        className={`py-20 bg-[#E7E7E7] px-6 md:px-12 cursor-pointer transition-all ${
          selectedRegion === 'dev-areas' || selectedRegion.startsWith('dev-item:') ? 'ring-4 ring-brand-gold' : 'hover:ring-2 hover:ring-brand-blue/20'
        }`}
      >
        <div className="max-w-[85rem] mx-auto bg-white rounded-sm shadow-xl flex flex-col lg:flex-row overflow-hidden min-h-[480px]">
          <div className="w-full lg:w-[30%] flex flex-col border-r border-gray-100 bg-white">
            {devAreas.map((area: any, idx: number) => (
              <button
                key={area.id || idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveDev(idx);
                  onSelectRegion(`dev-item:${idx}`);
                }}
                className={`flex-1 p-6 text-left border-b border-gray-100 flex items-center justify-between transition-colors ${
                  activeDev === idx ? 'bg-gray-50 text-brand-blue font-bold' : 'text-gray-500 hover:bg-gray-50/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="font-serif text-brand-gold">{area.tab_number}</span>
                  <span className="text-sm">{area.tab_title}</span>
                </div>
                <ArrowRight size={16} className={activeDev === idx ? 'opacity-100 text-brand-gold' : 'opacity-0'} />
              </button>
            ))}
          </div>

          <div className="w-full lg:w-[35%] relative min-h-[250px] bg-gray-200">
            {currentDev.image && <Image src={currentDev.image} alt="" fill className="object-cover" />}
          </div>

          <div className="w-full lg:w-[35%] p-8 lg:p-12 flex flex-col justify-center bg-white">
            <h5 className="text-[10px] font-bold text-brand-gold uppercase tracking-widest mb-3">{currentDev.subtitle}</h5>
            <h3 className="text-3xl font-serif text-brand-blue mb-4 whitespace-pre-line leading-tight">{currentDev.heading}</h3>
            <p className="text-sm text-gray-500 leading-relaxed font-light">{currentDev.description}</p>
          </div>
        </div>
      </section>

      {/* 4. AWARDS MARQUEE */}
      <section
        onClick={(e) => select(e, 'awards-section')}
        className={`py-8 bg-brand-blue text-white cursor-pointer transition-all ${
          selectedRegion === 'awards-section' || selectedRegion.startsWith('award:') ? 'ring-4 ring-brand-gold' : 'hover:ring-2 hover:ring-white/20'
        }`}
      >
        <div className="flex gap-16 justify-center items-center px-8 overflow-x-auto">
          {(data.awards || []).map((aw: any, idx: number) => (
            <div
              key={aw.id || idx}
              onClick={(e) => {
                e.stopPropagation();
                onSelectRegion(`award:${idx}`);
              }}
              className={`flex flex-col items-center text-center shrink-0 w-64 p-3 rounded-xl transition-all ${
                selectedRegion === `award:${idx}` ? 'bg-white/10 ring-2 ring-brand-gold' : 'hover:bg-white/5'
              }`}
            >
              <img src={aw.icon_image || '/images/landingpage/award.svg'} alt="" className="w-16 h-auto mb-2 pointer-events-none" />
              <h3 className="text-sm font-bold text-brand-gold whitespace-pre-line leading-tight">{aw.title}</h3>
              <p className="text-xs text-gray-300 mt-1">{aw.subtitle_1} {aw.subtitle_2 && `· ${aw.subtitle_2}`}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. THE GOLDEN STANDARD PROCESS */}
      <section
        onClick={(e) => select(e, 'process-section')}
        className={`py-24 px-6 md:px-12 max-w-[90rem] mx-auto cursor-pointer transition-all ${
          selectedRegion === 'process-section' || selectedRegion.startsWith('process-step:') ? 'ring-4 ring-brand-gold' : 'hover:ring-2 hover:ring-brand-blue/20'
        }`}
      >
        <div className="mb-12">
          <p className="text-xs uppercase tracking-widest text-brand-gold font-bold mb-2">{settings.process_tagline || 'The Process'}</p>
          <h2 className="text-4xl font-serif text-brand-blue">{settings.process_heading || 'The Golden Standard.'}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {processSteps.map((step: any, idx: number) => (
            <div 
              key={step.id || idx}
              onClick={(e) => {
                e.stopPropagation();
                onSelectRegion(`process-step:${idx}`);
              }}
              className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm"
            >
              <div className="h-44 relative mb-4 rounded overflow-hidden bg-gray-100">
                {step.image && <Image src={step.image} alt="" fill className="object-cover" />}
              </div>
              <span className="text-2xl font-serif text-brand-gold font-bold block mb-2">{step.step_number}</span>
              <h4 className="text-xl font-serif text-brand-blue mb-2">{step.title}</h4>
              <p className="text-xs text-gray-500 leading-relaxed font-light">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. FEATURED VIDEO IMPACT SECTION */}
      <section
        onClick={(e) => select(e, 'video-section')}
        className={`h-screen bg-black text-white relative flex flex-col items-center justify-center cursor-pointer transition-all ${
          selectedRegion === 'video-section' ? 'ring-4 ring-brand-gold' : 'hover:ring-2 hover:ring-white/20'
        }`}
      >
        <div className="text-center z-10 mb-8">
          <p className="text-xs uppercase tracking-[0.4em] font-bold opacity-80 mb-2">{settings.video_subtitle || 'BUILD YOUR'}</p>
          <h2 className="text-6xl font-serif text-brand-gold">{settings.video_heading || 'FUTURE HERE'}</h2>
        </div>

        <div className="w-[70%] max-w-4xl aspect-video rounded bg-gray-900 border border-white/20 relative overflow-hidden flex items-center justify-center">
          {settings.video_thumbnail && (
            <Image src={settings.video_thumbnail} alt="" fill className="object-cover opacity-50" />
          )}
          <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-full flex items-center justify-center z-10 border border-white/30">
            <Play className="text-white ml-1 fill-white" size={32} />
          </div>
        </div>
      </section>

      {/* 7. NEWS & UPDATES SECTION */}
      <section
        onClick={(e) => select(e, 'news-section')}
        className={`max-w-[90rem] mx-auto px-6 md:px-12 py-24 cursor-pointer transition-all ${
          selectedRegion === 'news-section' || selectedRegion.startsWith('news-item:') ? 'ring-4 ring-brand-gold' : 'hover:ring-2 hover:ring-brand-blue/20'
        }`}
      >
        <div className="mb-12">
          <div className="text-xs tracking-widest uppercase text-brand-gold font-bold mb-3">
            News &amp; Updates
          </div>
          <h2 className="text-4xl lg:text-5xl font-serif text-brand-blue">
            The latest from <span className="text-brand-gold">Golden Topper.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {newsArticles.map((article: any, idx: number) => (
            <div
              key={article.id || idx}
              onClick={(e) => {
                e.stopPropagation();
                onSelectRegion(`news-item:${idx}`);
              }}
              className={`bg-white rounded-xl border overflow-hidden p-4 flex flex-col transition-all ${
                selectedRegion === `news-item:${idx}` ? 'border-brand-gold ring-2 ring-brand-gold' : 'border-gray-200 hover:shadow-md'
              }`}
            >
              <div className="h-40 w-full relative rounded-lg overflow-hidden bg-gray-100 mb-4">
                {article.image && <Image src={article.image} alt="" fill className="object-cover" />}
                <span className="absolute top-2 left-2 bg-white/90 text-brand-blue font-bold text-[9px] uppercase tracking-wider px-2 py-1 rounded">
                  {article.category}
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-gold mb-1">{article.date}</span>
              <h4 className="font-serif font-bold text-sm text-brand-blue line-clamp-2 mb-2">{article.title}</h4>
              <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{article.excerpt}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}