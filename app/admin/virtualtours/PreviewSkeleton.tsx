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

export default function PreviewSkeleton({ data }: { data: any }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const rooms = data.rooms || [];
  const currentRoom = rooms[activeIndex];

  // Prevent out of bounds if an admin deletes a room while previewing
  useEffect(() => {
    if (rooms.length > 0 && activeIndex >= rooms.length) {
      setActiveIndex(Math.max(0, rooms.length - 1));
    }
  }, [rooms.length, activeIndex]);

  const handleNext = () => setActiveIndex((prev) => (prev + 1) % rooms.length);
  const handlePrev = () => setActiveIndex((prev) => (prev - 1 + rooms.length) % rooms.length);

  return (
    <div className="w-full bg-black font-sans text-gray-900 flex flex-col relative h-full min-h-screen">
      
      {/* Fake Top Bar */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black/90 to-transparent z-50 flex justify-between items-start p-6 md:p-8 pointer-events-none">
        <div className="pointer-events-auto flex flex-col items-start gap-2">
          <span className="text-brand-gold text-[10px] font-bold uppercase tracking-[0.2em] bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
            Live Preview
          </span>
          <h3 className="text-white font-serif text-2xl md:text-3xl ml-2 drop-shadow-md">
            {currentRoom?.title || 'Room Title'}
          </h3>
        </div>
      </div>

      {/* The 360 Viewer */}
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

      {/* Admin Live Navigation Controls */}
      {rooms.length > 1 && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-6 bg-black/60 backdrop-blur-lg px-6 py-3 rounded-full border border-white/10 shadow-2xl">
          <button onClick={handlePrev} className="p-2 text-white hover:text-brand-gold transition-colors outline-none cursor-pointer"><ChevronLeft size={24} /></button>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Room</span>
            <span className="text-brand-gold text-xs font-bold tracking-[0.2em]">{activeIndex + 1} / {rooms.length}</span>
          </div>
          <button onClick={handleNext} className="p-2 text-white hover:text-brand-gold transition-colors outline-none cursor-pointer"><ChevronRight size={24} /></button>
        </div>
      )}

    </div>
  );
}