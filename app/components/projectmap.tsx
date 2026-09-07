'use client';

import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, LayersControl } from 'react-leaflet';
import * as LucideIcons from 'lucide-react';
import { RefreshCw, ChevronDown, Car, Footprints, MapPin, ArrowRight, Plus, Minus } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

// ==========================================
// SHARED TYPES & CONSTANTS
// ==========================================
type ProjectKey = 'cityclou' | 'elsol' | 'lavida' | 'parkone';

interface UnifiedMapProps {
  projectKey?: ProjectKey;
  onProjectSelect?: (imageUrl: string) => void;
}

interface Project {
  id: number;
  name: string;
  address: string;
  city: string;
  slug: string;
  coords: [number, number];
  image: string;
  unit: { id: number; title: string; thumbnail: string }[];
  type?: string;
  icon?: string;
  drivetime?: string;
  walktime?: string;
  is_active?: boolean;
}

const phBounds = L.latLngBounds([4.5, 116.9], [21.5, 126.6]);

const getIconComponent = (iconName: string) => {
  return (LucideIcons as any)[iconName] || LucideIcons.HelpCircle;
};

// ==========================================
// ANIMATED SIDEBAR PIN (FEATURES ONLY)
// ==========================================
// ==========================================
// OPTION 1: SOLID DROP PIN
// ==========================================
const AnimatedLegendPin = ({ isActive }: { isActive: boolean }) => {
  return (
    <svg 
      width="18" height="18" 
      viewBox="0 0 24 24" 
      className={`shrink-0 transition-all duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}
    >
      <path 
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" 
        fill="currentColor" 
      />
      <circle 
        cx="12" cy="9" r="2.5" 
        className={`transition-all duration-300 origin-[12px_9px] fill-[#FDFBF7] ${isActive ? 'scale-0' : 'group-hover:scale-0'}`} 
      />
    </svg>
  );
};

// ==========================================
// MAP CONTROLLER
// ==========================================
function MapController({ center, zoom, isActive }: { center: [number, number], zoom: number, isActive?: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!center || (center[0] === 0 && center[1] === 0)) return;

    if (isActive) {
      const isMobile = window.innerWidth < 768;
      const targetPoint = map.project(center, zoom);

      if (isMobile) {
        targetPoint.y += 20;
      } else {
        targetPoint.x += 60;
      }

      const offsetLatLng = map.unproject(targetPoint, zoom);
      map.flyTo(offsetLatLng, zoom, { duration: 1.5 });

    } else {
      map.flyTo(center, zoom, { duration: 1.5 });
    }
  }, [center, zoom, map, isActive]);

  return null;
}

function CustomZoomControl() {
  const map = useMap();
  const controlRef = useRef(null);

  useEffect(() => {
    if (controlRef.current) {
      L.DomEvent.disableClickPropagation(controlRef.current);
      L.DomEvent.disableScrollPropagation(controlRef.current);
    }
  }, []);

  return (
    <div
      ref={controlRef}
      className="absolute top-4 right-4 md:top-auto md:bottom-6 md:left-6 md:right-auto z-[400] flex flex-col gap-2"
    >
      <button
        onClick={() => map.zoomIn()}
        className="w-9 h-9 md:w-10 md:h-10 bg-brand-blue/95 backdrop-blur-md border border-brand-gold/40 rounded-xl shadow-lg flex items-center justify-center text-white hover:bg-brand-gold hover:text-brand-blue hover:border-brand-gold transition-all duration-300"
        aria-label="Zoom in"
      >
        <Plus size={20} />
      </button>
      <button
        onClick={() => map.zoomOut()}
        className="w-9 h-9 md:w-10 md:h-10 bg-brand-blue/95 backdrop-blur-md border border-brand-gold/40 rounded-xl shadow-lg flex items-center justify-center text-white hover:bg-brand-gold hover:text-brand-blue hover:border-brand-gold transition-all duration-300"
        aria-label="Zoom out"
      >
        <Minus size={20} />
      </button>
    </div>
  );
}

// ==========================================
// UPDATED IMAGE PINS (ACCEPTS DYNAMIC URLs)
// ==========================================
const getBuildingMarkerIcon = (isActive: boolean, iconUrl: string) => {
  return L.divIcon({
    className: 'bg-transparent border-none',
    html: `
      <div class="${isActive ? 'active-building-marker' : 'scale-100'} transition-all duration-500 drop-shadow-[0_12px_12px_rgba(0,0,0,0.5)] flex items-center justify-center" style="transform-origin: bottom center; width: 50px; height: 50px;">
        <img 
          src="${iconUrl}" 
          alt="Building Marker" 
          style="width: 100px; height: 100px; object-fit: contain; transform: translateY(-25px);"
        />
      </div>
    `,
    iconSize: [50, 50],
    iconAnchor: [25, 50],
  });
};

const getUnifiedIcon = (type: string, isActive: boolean, iconValue: string) => {
  const containerSizeClass = 'w-7 h-7 md:w-8 md:h-8';
  const leafletIconSize: [number, number] = [32, 40];
  const leafletIconAnchor: [number, number] = [16, 40];

  const bgColor = isActive ? 'var(--color-brand-gold)' : 'var(--color-brand-blue)'; 

  const isUrl = iconValue && (iconValue.startsWith('http') || iconValue.startsWith('/'));
  let iconHtml = '';

  if (isUrl) {
    iconHtml = `<img src="${iconValue}" alt="icon" style="width: 55%; height: 55%; object-fit: contain; filter: drop-shadow(0px 2px 2px rgba(0,0,0,0.2));" />`;
  } else {
    const IconComponent = (LucideIcons as any)[iconValue] || LucideIcons.MapPin;
    iconHtml = renderToString(<IconComponent size={14} color="white" strokeWidth={2.5} />);
  }

  return L.divIcon({
    className: 'bg-transparent',
    html: `
      <div class="${isActive ? 'active-poi-marker' : ''} flex flex-col items-center drop-shadow-md transition-all duration-500 origin-bottom">
        <div class="${containerSizeClass} ${isActive ? 'active-poi-ripple' : ''} rounded-full flex items-center justify-center border-2 border-white shadow-inner" style="background-color: ${bgColor}; transition: all 0.4s ease;">
          ${iconHtml}
        </div>
        <div class="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent transition-all duration-400" style="border-top-color: ${bgColor}; transform: translateY(-1px);"></div>
      </div>
    `,
    iconSize: leafletIconSize,
    iconAnchor: leafletIconAnchor,
    popupAnchor: [0, -leafletIconAnchor[1]]
  });
};

// ==========================================
// MAIN COMPONENT
// ==========================================
export default function ProjectMap({ projectKey, onProjectSelect }: UnifiedMapProps) {

  const supabase = createClient();

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);

  const [hoveredBlueprint, setHoveredBlueprint] = useState<string | null>(null);

  const isUnifiedMode = !!projectKey;

  useEffect(() => {
    setIsMounted(true);
    if (window.innerWidth >= 768) {
      setIsLegendOpen(true);
    }

    if (isUnifiedMode) {
      import('../data/mapdata.json').then((data) => {
        const landmarks = data.default.landmarks[projectKey] || [];

        const formatted = landmarks.map((l: any) => ({
          id: l.id,
          name: l.name,
          address: l.address || '',
          city: l.city || '',
          slug: '',
          coords: l.position as [number, number],
          image: l.image || '/images/placeholder.webp',
          unit: [],
          type: l.type,
          icon: l.icon,
          drivetime: l.drivetime,
          walktime: l.walktime
        }));

        setProjects(formatted);
      });
    } else {
      fetchGlobalMapData();
    }
  }, [projectKey, isUnifiedMode]);

  const fetchGlobalMapData = async () => {
    try {
      const { data, error } = await supabase
        .from('project_table')
        .select(`
          id, title, address, city, slug, image, map_icon,
          parent_marker (latitude, longitude),
          unit_layout (id, title, thumbnail)
        `)
        .is('deleted_at', null)
        .eq('is_active', true);

      if (error) throw error;

      const formattedProjects: Project[] = data.map((item: any) => {
        const marker = Array.isArray(item.parent_marker) ? item.parent_marker[0] : item.parent_marker;
        return {
          id: item.id,
          name: item.title,
          address: item.address,
          city: item.city || '',
          slug: item.slug,
          coords: [parseFloat(marker?.latitude || 0), parseFloat(marker?.longitude || 0)],
          image: item.image || '/images/placeholder.webp',
          icon: item.map_icon || '/images/projectmap/pin.png', // Fallback to your default PNG if empty
          unit: item.unit_layout?.map((u: any) => ({
            id: u.id,
            title: u.title,
            thumbnail: u.thumbnail
          })) || [],
          type: 'project'
        };
      });

      setProjects(formattedProjects.filter(p => p.coords[0] !== 0));
    } catch (error) {
      console.error('Error fetching map markers:', error);
    }
  };

  useEffect(() => {
    setActiveProject(null);
    setHoveredBlueprint(null);
  }, [projectKey]);

  if (!isMounted) return null;

  const mainProject = projects.find(p => p.type === 'project');
  const defaultCenter: [number, number] = (isUnifiedMode && mainProject)
    ? mainProject.coords
    : [12.2797, 122.7740];

  const defaultZoom = isUnifiedMode ? 15 : 6;

  return (
    <div className="relative w-full h-[650px] md:h-[600px] bg-brand-blue rounded-2xl overflow-hidden shadow-2xl border border-gray-200">

      <style>{`
        @media (max-width: 767px) {
          .leaflet-top.leaflet-right {
            top: 6rem !important;
            right: 6px !important;
          }
        }
        @media (min-width: 768px) {
          .leaflet-top.leaflet-right {
            top: auto !important;
            bottom: 120px !important; 
            left: 24px !important;
            right: auto !important;
          }
        }
        .leaflet-control-layers {
          border-radius: 12px !important;
          border: 1px solid rgba(208, 179, 112, 0.3) !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
        }

        /* Float and Ripple Animations ONLY */
        @keyframes map-float {
          0%, 100% { transform: translateY(0) scale(1.1); }
          50% { transform: translateY(-8px) scale(1.1); }
        }
          
        @keyframes map-ripple {
          0% { box-shadow: 0 0 0 0 rgba(208, 179, 112, 1); } 
          70% { box-shadow: 0 0 0 15px rgba(208, 179, 112, 0.1); }
          100% { box-shadow: 0 0 0 0 rgba(208, 179, 112, 0); }
        }
        @keyframes map-ripple-large {
          0% { box-shadow: 0 0 0 0 rgba(208, 179, 112, 1); }
          70% { box-shadow: 0 0 0 30px rgba(208, 179, 112, 0.1); }
          100% { box-shadow: 0 0 0 0 rgba(208, 179, 112, 0); }
        }
        
        .active-building-marker {
          animation: map-float 3s ease-in-out infinite, map-ripple-large 2s cubic-bezier(0, 0.2, 0.8, 1) infinite;
          border-radius: 50%; 
        }
        
        .active-poi-marker {
          animation: map-float 2.5s ease-in-out infinite;
        }
        
        .active-poi-ripple {
          animation: map-ripple 1.5s cubic-bezier(0, 0.2, 0.8, 1) infinite;
        }
      `}</style>

      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        minZoom={5}
        scrollWheelZoom={false}
        zoomControl={false}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        maxBounds={isUnifiedMode ? phBounds : undefined}
        maxBoundsViscosity={1.0}
        attributionControl={false}
      >
        <LayersControl>
          <LayersControl.BaseLayer name="Street View">
            <TileLayer
              url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
              maxZoom={20}
              subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer checked name="Satellite">
            <TileLayer
              url="https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
              maxZoom={20}
              subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <MapController
          center={activeProject ? activeProject.coords : defaultCenter}
          zoom={activeProject ? (isUnifiedMode ? 17 : 16) : defaultZoom}
          isActive={!!activeProject}
        />

        <CustomZoomControl />

        {projects.map((project) => (
          <Marker
            key={project.id}
            position={project.coords}
            icon={isUnifiedMode && project.type !== 'project'
              ? getUnifiedIcon(project.type || 'poi', activeProject?.id === project.id, project.icon || 'MapPin')
              : getBuildingMarkerIcon(activeProject?.id === project.id, project.icon || '/images/projectmap/pin.png')
            }
            eventHandlers={{ click: () => setActiveProject(project) }}
          />
        ))}
      </MapContainer>

      {/* 1. COMPACT LEGEND DRAWER */}
      <div className="absolute top-3 left-3 md:top-6 md:left-6 w-[200px] sm:w-[240px] md:w-72 max-w-sm bg-white/95 backdrop-blur-md shadow-xl rounded-xl md:rounded-2xl overflow-hidden pointer-events-auto z-[2]">

        <div className="p-3 md:p-5 flex justify-between items-center cursor-pointer" onClick={() => setIsLegendOpen(!isLegendOpen)}>
          <div>
            <span className="text-[8px] md:text-[10px] tracking-widest text-brand-gold uppercase block leading-none mb-0.5 md:mb-1">Select</span>
            <h4 className="text-brand-blue font-serif text-base md:text-[22px] leading-none">
              {isUnifiedMode ? 'Nearby Interests' : 'Locations'}
            </h4>
          </div>
          <ChevronDown size={18} className={`text-brand-blue transition-transform duration-500 md:w-[22px] md:h-[22px] ${isLegendOpen ? 'rotate-180' : ''}`} />
        </div>

        <div className={`grid transition-all duration-500 ${isLegendOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden bg-white/95">
            <div className="p-1.5 md:p-3 flex flex-col gap-0.5 md:gap-2 max-h-[30vh] md:max-h-[400px] overflow-y-auto">

              {projects.map((project) => {
                const isActive = activeProject?.id === project.id;
                
                return (
                  <button
                    key={project.id}
                    onClick={() => {
                      setActiveProject(project);
                      if (window.innerWidth < 768) setIsLegendOpen(false);
                    }}
                    className={`relative w-full text-left flex items-center gap-2 md:gap-4 px-2 py-1.5 md:px-4 md:py-3 rounded-lg md:rounded-xl transition-all duration-300 group ${
                        isActive 
                        ? (isUnifiedMode ? 'bg-brand-gold text-brand-blue' : 'bg-brand-blue text-white')
                        : (isUnifiedMode ? 'text-brand-blue hover:bg-brand-blue hover:text-brand-gold' : 'text-brand-blue hover:bg-gray-100 hover:text-brand-gold')
                      }`}
                  >
                    {isUnifiedMode ? (
                      <>
                        <div className={`absolute left-0 top-0 bottom-0 w-1 md:w-1.5 bg-brand-gold transition-transform ${isActive ? 'scale-y-100' : 'scale-y-0 group-hover:scale-y-100'}`}></div>
                        
                        <AnimatedLegendPin isActive={isActive} />

                        <div className="flex flex-col min-w-0">
                          <span className={`text-[11px] md:text-sm truncate ${isActive ? 'text-brand-blue' : 'text-gray-700 group-hover:text-white'}`}>{project.name}</span>
                          <span className={`text-[8px] md:text-[10px] uppercase truncate ${isActive ? 'text-brand-blue/80' : 'text-brand-blue group-hover:text-brand-gold'}`}>{project.type}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <AnimatedLegendPin isActive={isActive} />
                        <span className="text-[11px] md:text-sm truncate">{project.name}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            {activeProject && isUnifiedMode && (
              <button onClick={() => setActiveProject(null)} className="w-full flex items-center justify-center gap-1 md:gap-2 py-2 md:py-3 bg-gray-50 text-[8px] md:text-[10px] text-brand-blue border-t tracking-widest uppercase">
                <RefreshCw size={10} className="md:w-[12px] md:h-[12px]" /> Reset Map View
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. COMPACT HORIZONTAL TEASER CARD (MOBILE) / FULL CARD (DESKTOP) */}
      <AnimatePresence>
        {activeProject && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-3 left-3 right-3 md:bottom-auto md:top-6 md:right-6 md:left-auto md:w-96 md:h-[510px] bg-brand-blue/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-xl md:rounded-2xl overflow-hidden border border-brand-gold/40 flex flex-col pointer-events-auto z-[2]"
          >
            {/* FIXED CLOSE BUTTON */}
            <button
              onClick={() => setActiveProject(null)}
              className="absolute top-2 left-2 md:top-3 md:right-3 w-6 h-6 bg-brand-blue/80 md:bg-black/40 border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-brand-gold hover:border-brand-gold hover:text-brand-blue transition-all duration-300 z-[2] shadow-md"
              aria-label="Close details"
            >
              <span className="text-xl leading-none mb-0.5">&times;</span>
            </button>

            <div className="flex flex-row md:flex-col h-[100px] md:h-full md:max-h-[510px]">

              {/* Header Image */}
              <div className="w-[100px] md:w-full h-full md:h-52 bg-brand-blue overflow-hidden relative group shrink-0 border-r border-brand-gold/30 md:border-b md:border-brand-gold/20">
                <img
                  src={activeProject.image}
                  alt={activeProject.name}
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-110"
                  onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/400x200/142f72/d0b370?text=Location' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-blue via-transparent to-transparent opacity-90 md:opacity-100"></div>

                <div className="hidden md:block absolute bottom-4 left-5 bg-brand-gold text-brand-blue text-[10px] uppercase tracking-[0.2em] px-3 py-1 rounded-sm">
                  {activeProject.type || 'Featured Project'}
                </div>
              </div>

              {/* Content Body */}
              <div className="p-3 pr-10 md:p-7 flex flex-col justify-center md:justify-start gap-1 md:gap-4 flex-grow overflow-hidden md:overflow-y-auto">

                <div className="space-y-0.5 md:space-y-2">
                  <h3 className="text-[17px] md:text-3xl font-serif text-brand-gold leading-[1.1] tracking-tight truncate">
                    {activeProject.name}
                  </h3>

                  {/* Address Line */}
                  <div className="flex items-center md:items-start gap-1 md:gap-2 text-gray-300">
                    <MapPin size={10} className="text-brand-gold md:mt-0.5 shrink-0 md:w-[14px] md:h-[14px]" />
                    <h4 className="text-[9px] md:text-[13px] tracking-wide leading-relaxed opacity-90 truncate">
                      {activeProject.address}, {activeProject.city}
                    </h4>
                  </div>
                </div>

                {isUnifiedMode && activeProject.type !== 'project' && (
                  <div className="hidden md:grid grid-cols-2 gap-3 py-2 border-y border-white/10 mt-auto">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-white/10 rounded-lg shrink-0"><Car size={14} className="text-brand-gold" /></div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[9px] uppercase text-gray-400 tracking-widest leading-none mb-1">Drive</span>
                        <span className="text-[13px] text-white truncate">{activeProject.drivetime || '5 mins'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-white/10 rounded-lg shrink-0"><Footprints size={14} className="text-brand-gold" /></div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[9px] uppercase text-gray-400 tracking-widest leading-none mb-1">Walk</span>
                        <span className="text-[13px] text-white truncate">{activeProject.walktime || '15 mins'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* HOVER TAGS SECTION */}
                {!isUnifiedMode && activeProject.unit && activeProject.unit.length > 0 && (
                  <div className="hidden md:flex flex-wrap gap-2 content-start mt-1 relative">
                    {activeProject.unit.slice(0, 3).map((unitItem) => (
                      <Link
                        key={`${activeProject.id}-${unitItem.id}`}
                        href={`/projects/${activeProject.slug}?blueprint=${unitItem.id}#blueprints`}
                        className="px-2 py-1 border border-brand-gold/40 text-[9px] uppercase tracking-[0.2em] text-brand-gold rounded-sm bg-brand-gold/10 hover:bg-brand-gold hover:text-brand-blue transition-colors"
                        onMouseEnter={() => setHoveredBlueprint(unitItem.thumbnail)}
                        onMouseLeave={() => setHoveredBlueprint(null)}
                      >
                        {unitItem.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Button */}
              {!isUnifiedMode && (
                <div className="flex items-center justify-center pr-3 md:p-8 md:pt-0 shrink-0">
                  <Link
                    href={`/projects/${activeProject.slug}`}
                    className="md:hidden flex items-center justify-center w-8 h-8 rounded-full bg-brand-gold text-brand-blue shadow-md"
                  >
                    <ArrowRight size={16} />
                  </Link>

                  <Link
                    href={`/projects/${activeProject.slug}`}
                    className="hidden md:flex group relative items-center justify-between w-full border border-brand-gold px-8 py-5 overflow-hidden transition-all duration-500"
                  >
                    <span className="absolute inset-0 w-0 bg-brand-gold transition-all duration-500 ease-out group-hover:w-full"></span>
                    <span className="relative text-[11px] tracking-[0.3em] text-brand-gold group-hover:text-brand-blue transition-colors duration-500 uppercase">
                      View Details
                    </span>
                    <ArrowRight size={16} className="relative text-brand-gold group-hover:text-brand-blue transition-colors duration-500" />
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* UNCLIPPED HOVER PREVIEW */}
      <AnimatePresence>
        {hoveredBlueprint && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:translate-x-[-100px] z-[2] pointer-events-none p-4 bg-white rounded-xl shadow-[0_30px_60px_rgba(0,0,0,0.5)] border border-brand-gold/50 flex items-center justify-center w-72 h-72 md:w-[350px] md:h-[350px]"
          >
            <img
              src={hoveredBlueprint}
              alt="Blueprint Preview"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.src = 'https://via.placeholder.com/400x400/142f72/d0b370?text=Preview+Unavailable'
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}