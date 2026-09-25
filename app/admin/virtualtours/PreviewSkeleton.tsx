'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Move3d, PlusCircle } from 'lucide-react';

const DynamicVirtualTour = dynamic(() => import('@/app/components/VirtualTour'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[#0d1b3e]">
      <Move3d size={40} className="mb-4 animate-bounce text-brand-gold" />
      <p className="animate-pulse text-sm font-bold uppercase tracking-widest text-brand-gold">
        Loading 360° Engine...
      </p>
    </div>
  ),
});

type PreviewRegion = 'project' | 'tower' | 'unit' | 'area';

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
  activeRoomId?: string | null;
  selectedRegion?: PreviewRegion;
  onSelectProject?: () => void;
  onSelectTower?: () => void;
  onSelectUnit?: () => void;
  onRoomChange?: (roomId: string) => void;
  onAddRoom?: () => void;
}

export default function PreviewSkeleton({
  data,
  activeRoomId,
  selectedRegion,
  onSelectProject,
  onSelectTower,
  onSelectUnit,
  onRoomChange,
  onAddRoom,
}: PreviewSkeletonProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const rooms = data?.rooms || [];
  const currentRoom = rooms[activeIndex];

  useEffect(() => {
    if (rooms.length === 0) {
      setActiveIndex(0);
      return;
    }

    if (activeIndex >= rooms.length) {
      setActiveIndex(Math.max(0, rooms.length - 1));
    }
  }, [rooms.length, activeIndex]);

  useEffect(() => {
    if (!activeRoomId) return;

    const index = rooms.findIndex((room) => room.id === activeRoomId);
    if (index >= 0 && index !== activeIndex) {
      setActiveIndex(index);
    }
  }, [activeRoomId, rooms, activeIndex]);

  const selectRoom = (index: number) => {
    setActiveIndex(index);
    const roomId = rooms[index]?.id;
    if (roomId) onRoomChange?.(roomId);
  };

  const handleNext = () => {
    if (rooms.length === 0) return;
    selectRoom((activeIndex + 1) % rooms.length);
  };

  const handlePrev = () => {
    if (rooms.length === 0) return;
    selectRoom((activeIndex - 1 + rooms.length) % rooms.length);
  };

  const contextButtonClass = (active: boolean) =>
    `min-w-[116px] rounded-xl border px-3 py-2 text-left backdrop-blur-md transition-all outline-none ${
      active
        ? 'border-[#d4b26f] bg-black/75 shadow-[0_0_0_2px_rgba(212,178,111,0.12)]'
        : 'border-white/15 bg-black/60 hover:border-white/30 hover:bg-black/75'
    }`;

  return (
    <div className="relative flex h-full min-h-0 w-full select-none flex-col overflow-hidden bg-black font-sans text-gray-900">
      {/* EDITABLE CONTEXT */}
      <div className="pointer-events-none absolute left-0 top-0 z-50 flex w-full flex-col gap-3 bg-gradient-to-b from-black/90 via-black/50 to-transparent p-5 md:p-6">
        <div>
          <span className="pointer-events-auto inline-flex rounded-full border border-[#D4AF37]/30 bg-black/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#D4AF37] shadow-lg backdrop-blur-md">
            Live Preview
          </span>
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSelectProject}
            className={contextButtonClass(selectedRegion === 'project')}
          >
            <span className="block text-[9px] font-semibold uppercase tracking-wider text-[#d4b26f]">
              Project
            </span>
            <span className="mt-0.5 block truncate text-xs font-semibold text-white">
              {data?.projectName || 'Project'}
            </span>
          </button>

          <button
            type="button"
            onClick={onSelectTower}
            className={contextButtonClass(selectedRegion === 'tower')}
          >
            <span className="block text-[9px] font-semibold uppercase tracking-wider text-[#d4b26f]">
              Tower
            </span>
            <span className="mt-0.5 block truncate text-xs font-semibold text-white">
              {data?.towerName || 'No tower'}
            </span>
          </button>

          <button
            type="button"
            onClick={onSelectUnit}
            className={contextButtonClass(selectedRegion === 'unit')}
          >
            <span className="block text-[9px] font-semibold uppercase tracking-wider text-[#d4b26f]">
              Unit
            </span>
            <span className="mt-0.5 block truncate text-xs font-semibold text-white">
              {data?.unitName || 'No unit'}
            </span>
          </button>
        </div>
      </div>

      {/* 360 VIEWER */}
      <div className="relative z-0 h-full w-full flex-1 cursor-grab active:cursor-grabbing">
        {currentRoom?.url ? (
          <DynamicVirtualTour key={currentRoom.url} image={currentRoom.url} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center bg-[#0a1128] px-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5">
              <Move3d size={34} className="text-brand-gold" />
            </div>
            <p className="mt-5 text-sm font-bold uppercase tracking-widest text-white/70">
              {rooms.length > 0 ? 'No Panorama Uploaded' : 'No View Areas Yet'}
            </p>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-white/40">
              {rooms.length > 0
                ? 'Select this view area in the inspector to upload or replace its 360° panorama.'
                : 'Add a view area from the room strip below to start building this unit tour.'}
            </p>
          </div>
        )}
      </div>

      {/* VIEW AREAS */}
      <div className="pointer-events-none absolute bottom-16 left-1/2 z-50 w-auto max-w-[94%] -translate-x-1/2">
        <div className="pointer-events-auto flex items-end gap-2 rounded-[24px] border border-white/15 bg-black/65 px-3 py-2.5 shadow-2xl backdrop-blur-2xl transition-colors hover:bg-black/75">
          {rooms.length > 1 && (
            <button
              type="button"
              onClick={handlePrev}
              className="mb-2 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/70 outline-none transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Previous view area"
            >
              <ChevronLeft size={19} strokeWidth={2.5} />
            </button>
          )}

          <div className="flex max-w-[72vw] items-end gap-2 overflow-x-auto px-1 py-0.5">
            {rooms.map((room, index) => {
              const isSelected = activeIndex === index;

              return (
                <button
                  key={room.id || `${room.title}-${index}`}
                  type="button"
                  onClick={() => selectRoom(index)}
                  className="group flex w-[88px] shrink-0 flex-col items-center gap-1.5 outline-none"
                >
                  <span
                    className={`max-w-[84px] truncate text-[10px] font-semibold transition-colors ${
                      isSelected ? 'text-white' : 'text-white/65 group-hover:text-white'
                    }`}
                  >
                    {room.title || `Area ${index + 1}`}
                  </span>

                  <span
                    className={`relative flex h-12 w-[76px] overflow-hidden rounded-xl border transition-all ${
                      isSelected
                        ? 'border-[#d4b26f] shadow-[0_0_0_2px_rgba(212,178,111,0.2)]'
                        : 'border-white/15 group-hover:border-white/35'
                    }`}
                  >
                    {room.url ? (
                      <img src={room.url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-white/5">
                        <Move3d size={16} className="text-white/35" />
                      </span>
                    )}
                  </span>
                </button>
              );
            })}

            {onAddRoom && (
              <button
                type="button"
                onClick={onAddRoom}
                className="group flex w-[88px] shrink-0 flex-col items-center gap-1.5 outline-none"
              >
                <span className="max-w-[84px] truncate text-[10px] font-semibold text-white/55 transition-colors group-hover:text-[#d4b26f]">
                  Add Area
                </span>
                <span className="flex h-12 w-[76px] items-center justify-center rounded-xl border border-dashed border-white/25 bg-white/5 text-white/50 transition-all group-hover:border-[#d4b26f]/70 group-hover:bg-[#d4b26f]/10 group-hover:text-[#d4b26f]">
                  <PlusCircle size={18} />
                </span>
              </button>
            )}
          </div>

          {rooms.length > 1 && (
            <button
              type="button"
              onClick={handleNext}
              className="mb-2 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/70 outline-none transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Next view area"
            >
              <ChevronRight size={19} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
