// app/admin/virtualtours/PreviewSkeleton.tsx
'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { Move3d, ChevronLeft, ChevronRight } from 'lucide-react';

const DynamicVirtualTour = dynamic(() => import('@/app/components/VirtualTour'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d1b3e]">
      <Move3d size={40} className="text-brand-gold animate-bounce mb-4" />
      <p className="text-brand-gold animate-pulse tracking-widest text-sm font-bold uppercase">Loading 360° Engine...</p>
    </div>
  ),
});

interface PreviewSkeletonProps {
  data: {
    projectName?: string;
    towerName?: string;
    unitName?: string;
    rooms?: Array<{
      id?: string;
      title: string;
      url: string;
    }>;
  };
}

export default function PreviewSkeleton({ data }: PreviewSkeletonProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const rooms = data?.rooms || [];
  const currentRoom = rooms[activeIndex];

  // Prevent index out of bounds when rooms are removed
  useEffect(() => {
    if (rooms.length > 0 && activeIndex >= rooms.length) {
      setActiveIndex(Math.max(0, rooms.length - 1));
    }
  }, [rooms.length, activeIndex]);

  const handleNext = () => setActiveIndex((prev) => (prev + 1) % rooms.length);
  const handlePrev = () => setActiveIndex((prev) => (prev - 1 + rooms.length) % rooms.length);

  return (
    <div className="w-full bg-black font-sans text-gray-900 flex flex-col relative h-full min-h-screen select-none">
      
      {/* 4-Tier Breadcrumb Header */}
      <div className="absolute top-0 left-0 w-full bg-gradient-to-b from-black/90 via-black/50 to-transparent z-50 p-6 pointer-events-none flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[#D4AF37] text-[10px] font-bold uppercase tracking-[0.2em] bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-[#D4AF37]/30 shadow-lg pointer-events-auto">
            Live Preview
          </span>
        </div>

        {/* 3 Pills: Project -> Tower -> Unit */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-xl border border-white/15 text-xs text-white/80">
            <span className="text-[9px] uppercase tracking-wider text-[#d4b26f] block font-semibold">Project</span>
            <span className="font-medium text-white">{data?.projectName || 'Project'}</span>
          </div>

          <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-xl border border-white/15 text-xs text-white/80">
            <span className="text-[9px] uppercase tracking-wider text-[#d4b26f] block font-semibold">Tower</span>
            <span className="font-medium text-white">{data?.towerName || 'Tower A'}</span>
          </div>

          <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-xl border border-white/15 text-xs text-white/80">
            <span className="text-[9px] uppercase tracking-wider text-[#d4b26f] block font-semibold">Unit</span>
            <span className="font-medium text-white">{data?.unitName || 'Unit Layout'}</span>
          </div>
        </div>
      </div>

      {/* 360 Viewer */}
      <div className="flex-1 w-full h-full cursor-grab active:cursor-grabbing relative z-0">
        {currentRoom?.url ? (
          <DynamicVirtualTour key={currentRoom.url} image={currentRoom.url} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full bg-[#0a1128] border-2 border-dashed border-gray-700 m-8 rounded-2xl">
            <Move3d size={48} className="text-gray-600 mb-4" />
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No Panorama Uploaded</p>
          </div>
        )}
      </div>

      {/* View Areas Carousel */}
      {rooms.length > 0 && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50 pointer-events-auto flex items-center gap-3 bg-black/65 hover:bg-black/75 backdrop-blur-2xl px-4 py-2.5 rounded-[24px] border border-white/15 shadow-2xl max-w-[90vw]">
          {rooms.length > 1 && (
            <button 
              type="button"
              onClick={handlePrev} 
              className="p-1.5 text-white/70 hover:text-white transition-colors cursor-pointer outline-none"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
          )}

          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {rooms.map((room, index) => {
              const isSelected = activeIndex === index;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`relative px-3 py-1.5 rounded-lg text-xs font-sans transition-all cursor-pointer outline-none flex items-center gap-2 ${
                    isSelected 
                      ? 'bg-white/20 border border-[#d4b26f] text-[#d4b26f] font-semibold shadow-[0_0_10px_rgba(212,178,111,0.3)]' 
                      : 'bg-black/40 border border-white/10 text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="truncate max-w-[90px]">{room.title || `Area ${index + 1}`}</span>
                </button>
              );
            })}
          </div>

          {rooms.length > 1 && (
            <button 
              type="button"
              onClick={handleNext} 
              className="p-1.5 text-white/70 hover:text-white transition-colors cursor-pointer outline-none"
            >
              <ChevronRight size={20} strokeWidth={2.5} />
            </button>
          )}
        </div>
      )}

    </div>
  );
}