'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, LayersControl, Polyline } from 'react-leaflet';
import * as LucideIcons from 'lucide-react';
import { RefreshCw, ChevronDown, MapPinHouse, Car, Footprints, Plus, Minus, Route } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

// ==========================================
// SHARED TYPES & CONSTANTS
// ==========================================
interface UnifiedMapProps {
  projectSlug: string; 
}

const phBounds = L.latLngBounds([4.5, 116.9], [21.5, 126.6]);

const getIconComponent = (iconName: string) => {
  return (LucideIcons as any)[iconName] || LucideIcons.MapPin;
};

// ==========================================
// ANIMATED SIDEBAR PIN (FEATURES ONLY)
// ==========================================
const AnimatedLegendPin = ({ isActive }: { isActive: boolean }) => {
  return (
    <svg 
      width="18" height="18" 
      viewBox="0 0 24 24" 
      className={`shrink-0 transition-all duration-300 md:w-[18px] md:h-[18px] ${isActive ? 'scale-110 text-brand-blue' : 'text-brand-gold group-hover:scale-110 group-hover:text-brand-gold'}`}
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
// MAP CONTROLS & CINEMATIC CAMERA (FIXED FOR MULTIPLE CLICKS)
// ==========================================

// 1. Handles default map centering when NO route is active
function MapController({ center, zoom, isActive, hasRoute }: { center: [number, number], zoom: number, isActive?: boolean, hasRoute: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (hasRoute) return; 

    if (!center) return;
    if (isActive) {
      const isMobile = window.innerWidth < 768;
      const targetPoint = map.project(center, zoom);
      
      if (isMobile) targetPoint.y += 20; else targetPoint.x += 60;
      
      const offsetLatLng = map.unproject(targetPoint, zoom);
      map.flyTo(offsetLatLng, zoom, { duration: 1.5 });
    } else {
      map.flyTo(center, zoom, { duration: 1.5 });
    }
  }, [center, zoom, map, isActive, hasRoute]);

  return null;
}

// 2. High-framerate camera that locks onto the path tip
function PathCameraFollower({ currentPath, fullRoute, startPoint }: { currentPath: [number, number][], fullRoute: [number, number][] | null, startPoint: [number, number] }) {
  const map = useMap();
  const trackingRef = useRef(false);
  const currentRouteIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!fullRoute || fullRoute.length === 0 || !startPoint) {
      trackingRef.current = false;
      currentRouteIdRef.current = null;
      return;
    }

    // FIX: Detect if a BRAND NEW route was clicked, and forcefully reset the camera's memory
    const routeId = `${fullRoute[0][0]}-${fullRoute[fullRoute.length-1][0]}`;
    if (currentRouteIdRef.current !== routeId) {
      trackingRef.current = false;
      currentRouteIdRef.current = routeId;
    }

    const isMobile = window.innerWidth < 768;

    // PHASE 1: Cinematic swoop down to the starting point
    if (currentPath.length === 0 && !trackingRef.current) {
      trackingRef.current = true; // Arm the camera tracker

      const targetPoint = map.project(startPoint, 17);
      if (isMobile) targetPoint.y += 100; else targetPoint.x += 60;
      const offsetLatLng = map.unproject(targetPoint, 17);

      map.flyTo(offsetLatLng, 17, { duration: 1.2 });
      return;
    }

    // PHASE 2: Close monitoring (lock camera to the growing tip of the path)
    if (currentPath.length > 0 && trackingRef.current) {
      const latestPoint = currentPath[currentPath.length - 1];
      const currentZoom = map.getZoom();

      const targetPoint = map.project(latestPoint, currentZoom);
      if (isMobile) targetPoint.y += 100; else targetPoint.x += 60;
      const offsetLatLng = map.unproject(targetPoint, currentZoom);

      map.setView(offsetLatLng, currentZoom, { animate: false });

      // PHASE 3: Arrived at destination
      if (currentPath.length === fullRoute.length) {
        trackingRef.current = false; // Turn tracker off
        setTimeout(() => {
          map.setZoomAround(offsetLatLng, 16, { animate: true });
        }, 300);
      }
    }
  }, [currentPath, fullRoute, map, startPoint]);

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
    <div ref={controlRef} className="absolute top-4 right-4 md:top-auto md:bottom-6 md:left-6 md:right-auto z-[400] flex flex-col gap-2 pointer-events-auto">
      <button onClick={() => map.zoomIn()} className="w-9 h-9 md:w-10 md:h-10 bg-brand-blue/95 backdrop-blur-md border border-brand-gold/40 rounded-xl shadow-lg flex items-center justify-center text-white hover:bg-brand-gold hover:text-brand-blue transition-all duration-300"><Plus size={20} /></button>
      <button onClick={() => map.zoomOut()} className="w-9 h-9 md:w-10 md:h-10 bg-brand-blue/95 backdrop-blur-md border border-brand-gold/40 rounded-xl shadow-lg flex items-center justify-center text-white hover:bg-brand-gold hover:text-brand-blue transition-all duration-300"><Minus size={20} /></button>
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
  const isProject = type === 'project';
  const iconPropSize = isProject ? 20 : 14;
  const containerSizeClass = isProject ? 'w-10 h-10 md:w-12 md:h-12' : 'w-7 h-7 md:w-8 md:h-8';
  const leafletIconSize: [number, number] = isProject ? [48, 56] : [32, 40];
  const leafletIconAnchor: [number, number] = isProject ? [24, 56] : [16, 40];
  const bgColor = isProject ? 'var(--color-brand-gold)' : 'var(--color-brand-blue)';

  const activeMarkerClass = isActive ? 'active-poi-marker' : '';
  const activeRippleClass = isActive ? 'active-poi-ripple' : '';

  const isUrl = iconValue && (iconValue.startsWith('http') || iconValue.startsWith('/'));
  let iconHtml = '';

  if (isUrl) {
    iconHtml = `<img src="${iconValue}" alt="icon" style="width: 55%; height: 55%; object-fit: contain; filter: drop-shadow(0px 2px 2px rgba(0,0,0,0.2));" />`;
  } else {
    const IconComponent = (LucideIcons as any)[iconValue] || LucideIcons.MapPin;
    iconHtml = renderToString(<IconComponent size={iconPropSize} color="white" strokeWidth={2.5} />);
  }

  return L.divIcon({
    className: 'bg-transparent',
    html: `
      <div class="${activeMarkerClass} flex flex-col items-center drop-shadow-md transition-all duration-500 origin-bottom">
        <div class="${containerSizeClass} ${activeRippleClass} rounded-full flex items-center justify-center border-2 border-white shadow-inner" style="background-color: ${bgColor}; transition: all 0.4s ease;">
          ${iconHtml}
        </div>
        <div class="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent transition-all duration-400" style="border-top-color: ${bgColor}; transform: translateY(-1px);"></div>
      </div>
    `,
    iconSize: leafletIconSize, iconAnchor: leafletIconAnchor, popupAnchor: [0, -leafletIconAnchor[1]]
  });
};

// ==========================================
// MAIN COMPONENT
// ==========================================
export default function UnifiedProjectMap({ projectSlug }: UnifiedMapProps) {
  
  const supabase = createClient();

  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);

  const [fullRouteData, setFullRouteData] = useState<[number, number][] | null>(null);
  const [animatedPath, setAnimatedPath] = useState<[number, number][]>([]);

  const activeLoc = useMemo(() => landmarks.find((l: any) => l.id === activeId), [landmarks, activeId]);
  const mainProject = useMemo(() => landmarks.find((l: any) => l.type === 'project'), [landmarks]);

  // LIVE DATABASE FETCH
  useEffect(() => {
    async function loadMapData() {
      if (!projectSlug) return;
      setIsLoading(true);

      try {
        let searchSlug = projectSlug.startsWith('/') ? projectSlug : `/${projectSlug}`;

        const { data: project, error: projErr } = await supabase.from('project_table').select('id, title, image, address, city, map_icon').eq('slug', searchSlug).single();
        if (projErr || !project) throw new Error('Project not found');

        const { data: parent } = await supabase.from('parent_marker').select('*').eq('project_id', project.id).single();

        const { data: children } = await supabase.from('child_marker_table').select('*, marker_type_table(*)').eq('project_id', project.id);

        const formattedData: any[] = [];

        if (parent && parent.latitude && parent.longitude) {
          formattedData.push({
            id: 'main-project',
            name: project.title,
            type: 'project',
            position: [parseFloat(parent.latitude), parseFloat(parent.longitude)],
            icon: project.map_icon || '/images/projectmap/pin.png', // Main project pin
            image: project.image,
            address: project.address || 'Project Location',
            city: project.city || null,
            description: 'Main Project Location'
          });
        }

        if (children) {
          const childMarkers = children
            .filter((c: any) => c.latitude && c.longitude) 
            .map((c: any) => ({
              id: c.id,
              name: c.interest_name,
              type: c.marker_type_table?.[0]?.name || 'Landmark',
              position: [parseFloat(c.latitude), parseFloat(c.longitude)],
              address: c.address,
              description: c.phrase,
              distance_km: c.distance_km ? `${c.distance_km} km` : null, 
              drivetime: c.distance_drive ? `${c.distance_drive} mins` : null,
              walktime: c.distance_walk ? `${c.distance_walk} mins` : null,
              image: c.thumbnail,
              icon: c.marker_type_table?.[0]?.icon || 'MapPin' 
            }));
          formattedData.push(...childMarkers);
        }

        setLandmarks(formattedData);
      } catch (error) {
        console.error("Error loading map data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadMapData();
  }, [projectSlug, supabase]);

  // FETCH ROUTE GEOMETRY
  useEffect(() => {
    async function fetchRoute() {
      if (!activeLoc || activeLoc.type === 'project' || !mainProject) {
        setFullRouteData(null);
        return;
      }
      try {
        const start = mainProject.position as [number, number];
        const end = activeLoc.position as [number, number];
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`);
        const data = await res.json();
        if (data.routes?.[0]) {
          const coords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
          setFullRouteData(coords);
        }
      } catch (e) { setFullRouteData(null); }
    }
    fetchRoute();
  }, [activeLoc, mainProject]);

  // ANIMATE THE PATH (WITH CINEMATIC DELAY)
  useEffect(() => {
    // FIX: INSTANTLY clear the old line the millisecond a new location is clicked
    setAnimatedPath([]); 

    if (!fullRouteData || fullRouteData.length === 0) {
      return;
    }

    let interval: NodeJS.Timeout;

    // 1.2 Second delay lets the camera "fly down" to the starting point BEFORE drawing starts
    const startDelay = setTimeout(() => {
      let currentIndex = 0;
      setAnimatedPath([fullRouteData[0]]);

      interval = setInterval(() => {
        currentIndex++;
        if (currentIndex >= fullRouteData.length) {
          clearInterval(interval);
          return;
        }
        setAnimatedPath(prev => [...prev, fullRouteData[currentIndex]]);
      }, 35); // Fast 35ms update rate for smooth tracking
    }, 1200);

    return () => {
      clearTimeout(startDelay);
      if (interval) clearInterval(interval);
    };
  }, [fullRouteData]);

  useEffect(() => {
    setIsMounted(true);
    if (window.innerWidth >= 768) setIsLegendOpen(true);
  }, []);

  useEffect(() => { setActiveId(null); setFullRouteData(null); }, [projectSlug]);

  if (!isMounted) return null;
  if (isLoading) return <div className="w-full h-[600px] bg-brand-blue rounded-2xl flex items-center justify-center text-white/50 text-sm font-normal uppercase tracking-widest animate-pulse border border-brand-gold/30 shadow-2xl">Loading Live Map Data...</div>;
  if (!mainProject) return <div className="w-full h-[600px] bg-[#0A1128] rounded-2xl flex items-center justify-center text-white/50 border border-white/10">No map coordinates configured for this project.</div>;

  const defaultCoords = mainProject.position as [number, number];

  return (
    <div className="relative w-full h-[600px] md:h-[600px] bg-brand-blue rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
      
      {/* Upgraded CSS Animations */}
      <style>{`
        @media (max-width: 767px) { .leaflet-top.leaflet-right { top: 6rem !important; right: 6px !important; } }
        @media (min-width: 768px) { .leaflet-top.leaflet-right { top: auto !important; bottom: 120px !important; left: 24px !important; right: auto !important; } }
        .leaflet-control-layers { border-radius: 12px !important; border: 1px solid rgba(212,175,55,0.3) !important; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important; }
        
        @keyframes map-float {
          0%, 100% { transform: translateY(0) scale(1.1); }
          50% { transform: translateY(-8px) scale(1.1); }
        }
          
        @keyframes map-ripple {
          0% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 1); } 
          70% { box-shadow: 0 0 0 15px rgba(212, 175, 55, 0.1); }
          100% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0); }
        }

        @keyframes map-ripple-large {
          0% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 1); }
          70% { box-shadow: 0 0 0 30px rgba(212, 175, 55, 0.1); }
          100% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0); }
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

      <MapContainer center={defaultCoords} zoom={15} minZoom={5} scrollWheelZoom={false} zoomControl={false} style={{ height: '100%', width: '100%', zIndex: 0 }} maxBounds={phBounds} maxBoundsViscosity={1.0} attributionControl={false}>
        <LayersControl>
          <LayersControl.BaseLayer name="Street View"><TileLayer url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" maxZoom={20} subdomains={['mt0','mt1','mt2','mt3']} /></LayersControl.BaseLayer>
          <LayersControl.BaseLayer checked name="Satellite"><TileLayer url="https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" maxZoom={20} subdomains={['mt0','mt1','mt2','mt3']} /></LayersControl.BaseLayer>
        </LayersControl>

        {/* DEFAULT CONTROLLER (Only runs when there is NO route) */}
        <MapController center={activeLoc ? (activeLoc.position as [number, number]) : defaultCoords} zoom={activeLoc ? 17 : 15} isActive={!!activeLoc} hasRoute={!!fullRouteData} />
        
        {/* CINEMATIC CAMERA FOLLOWER */}
        <PathCameraFollower startPoint={defaultCoords} currentPath={animatedPath} fullRoute={fullRouteData} />

        <CustomZoomControl />

        {/* Solid Gold Animated Path */}
        {animatedPath.length > 1 && (
          <Polyline 
            positions={animatedPath} 
            pathOptions={{ 
              color: 'var(--color-brand-gold)', 
              weight: 6, 
              opacity: 0.9,
              lineCap: 'round',
              lineJoin: 'round'
            }} 
          />
        )}

        {landmarks.map((loc: any) => (
          <Marker 
            key={loc.id} 
            position={loc.position as [number, number]} 
            icon={loc.type === 'project' 
              ? getBuildingMarkerIcon(activeLoc?.id === loc.id, loc.icon)
              : getUnifiedIcon(loc.type, activeLoc?.id === loc.id, loc.icon)
            } 
            eventHandlers={{ click: () => setActiveId(loc.id) }} 
          />
        ))}
      </MapContainer>

      {/* 1. LEGEND DRAWER */}
      <div className="absolute top-3 left-3 md:top-6 md:left-6 w-[200px] sm:w-[240px] md:w-72 max-w-sm bg-white/95 backdrop-blur-md shadow-xl rounded-xl md:rounded-2xl overflow-hidden pointer-events-auto z-[400]">
        <div className="h-1 w-full bg-gradient-to-r from-[#e6c27a] via-brand-gold to-[#997a40]"></div>
        <div className="p-3 md:p-5 flex justify-between items-center cursor-pointer" onClick={() => setIsLegendOpen(!isLegendOpen)}>
          <div>
            <span className="text-[8px] md:text-[10px] font-normal tracking-widest text-brand-gold uppercase block leading-none mb-0.5 md:mb-1">Select</span>
            <h4 className="text-brand-blue font-normal font-serif text-base md:text-[22px] leading-none">Nearby Interests</h4>
          </div>
          <ChevronDown size={18} className={`text-brand-blue transition-transform duration-500 md:w-[22px] md:h-[22px] ${isLegendOpen ? 'rotate-180' : ''}`} />
        </div>
        <div className={`grid transition-all duration-500 ${isLegendOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden bg-white/95">
            <div className="p-1.5 md:p-3 flex flex-col gap-0.5 md:gap-2 max-h-[30vh] md:max-h-[400px] overflow-y-auto custom-scrollbar">
              {landmarks.map((loc: any) => {
                const isActive = activeLoc?.id === loc.id;

                return (
                  <button 
                    key={loc.id} 
                    onClick={() => { 
                      setActiveId(loc.id); 
                      // FIX: Removed the mobile-only check. Drawer now closes on all devices.
                      setIsLegendOpen(false); 
                    }} 
                    className={`relative w-full text-left flex items-center gap-2 md:gap-4 px-2 py-1.5 md:px-4 md:py-3 rounded-lg md:rounded-xl transition-all duration-300 group ${isActive ? 'bg-brand-gold text-brand-blue' : 'hover:bg-brand-blue hover:text-white'}`}
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-1 md:w-1.5 bg-brand-gold transition-transform ${isActive ? 'scale-y-100' : 'scale-y-0 group-hover:scale-y-100'}`}></div>
                    
                    <AnimatedLegendPin isActive={isActive} />
                    
                    <div className="flex flex-col min-w-0">
                      <span className={`text-[11px] md:text-sm font-semibold truncate ${isActive ? 'text-brand-blue' : 'text-gray-700 group-hover:text-white'}`}>{loc.name}</span>
                      <span className={`text-[8px] md:text-[10px] uppercase truncate ${isActive ? 'text-brand-blue/80 font-normal' : 'text-brand-blue group-hover:text-brand-gold'}`}>{loc.type}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            {activeLoc && (
              <button 
                onClick={() => { 
                  setActiveId(null); 
                  setFullRouteData(null); 
                  // Optional UX Bonus: Open the drawer back up when they reset the map
                  setIsLegendOpen(true); 
                }} 
                className="w-full flex items-center justify-center gap-1 md:gap-2 py-2 md:py-3 bg-gray-50 text-[8px] md:text-[10px] font-normal text-brand-blue border-t tracking-widest uppercase hover:bg-gray-100 transition-colors"
              >
                <RefreshCw size={10} className="md:w-[12px] md:h-[12px]" /> Reset Map View
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. DETAIL CARD */}
      <AnimatePresence>
        {activeLoc && (
          <motion.div 
            initial={{ opacity: 0, y: 40, scale: 0.95 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, y: 20, scale: 0.95 }} 
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} 
            className="absolute bottom-3 left-3 right-3 md:bottom-auto md:top-6 md:right-6 md:left-auto md:w-96 bg-brand-blue/95 backdrop-blur-xl shadow-2xl rounded-xl md:rounded-2xl overflow-hidden border border-brand-gold/40 pointer-events-auto z-[400]"
          >
            {/* ========================================== */}
            {/* 📱 MOBILE COMPACT VIEW (< 768px)          */}
            {/* ========================================== */}
            <div className="flex flex-col p-3 md:hidden">
              <div className="flex gap-3 h-[84px]">
                {/* Square Thumbnail */}
                <div className="w-[84px] h-[84px] rounded-lg overflow-hidden shrink-0 relative bg-brand-blue border border-brand-gold/30">
                  <img src={activeLoc.image || '/images/placeholder.webp'} alt={activeLoc.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/150/142f72/d0b370?text=Loc' }} />
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-brand-gold text-[8px] uppercase font-black text-center py-0.5 tracking-wider">{activeLoc.type || 'Location'}</div>
                </div>
                
                {/* Info & Close Button */}
                <div className="flex flex-col flex-grow justify-center min-w-0 relative pr-6">
                  <button onClick={() => { setActiveId(null); setFullRouteData(null); }} className="absolute -top-1 -right-1 w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-brand-gold hover:text-brand-blue transition-colors">
                    <span className="text-sm font-light leading-none mb-0.5">&times;</span>
                  </button>
                  <h3 className="text-base font-normal font-serif text-brand-gold leading-tight truncate">{activeLoc.name}</h3>
                  <div className="flex items-start gap-1 mt-1 text-gray-300">
                    <MapPinHouse size={12} className="text-brand-gold mt-[3px] shrink-0" />
                    <h4 className="text-[11px] font-medium leading-snug opacity-90 line-clamp-2">
                      {activeLoc.address || 'Address unavailable'}
                      {activeLoc.city && `, ${activeLoc.city}`}
                    </h4>
                  </div>
                </div>
              </div>

              {/* Compact Stats Row */}
              {activeLoc.type !== 'project' && (
                <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-white/10">
                  <div className="flex items-center gap-1.5 justify-center bg-white/5 rounded p-1.5">
                    <Route size={12} className="text-brand-gold shrink-0" />
                    <span className="text-[10px] font-normal text-white truncate">{activeLoc.distance_km || '--'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-center bg-white/5 rounded p-1.5">
                    <Car size={12} className="text-brand-gold shrink-0" />
                    <span className="text-[10px] font-normal text-white truncate">{activeLoc.drivetime || '--'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-center bg-white/5 rounded p-1.5">
                    <Footprints size={12} className="text-brand-gold shrink-0" />
                    <span className="text-[10px] font-normal text-white truncate">{activeLoc.walktime || '--'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* ========================================== */}
            {/* 💻 DESKTOP FULL VIEW (>= 768px)            */}
            {/* ========================================== */}
            <div className="hidden md:flex flex-col max-h-[510px]">
               <div className="w-full h-52 bg-brand-blue overflow-hidden relative group shrink-0 border-b border-brand-gold/20">
                <img src={activeLoc.image || '/images/placeholder.webp'} alt={activeLoc.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/400x200/142f72/d0b370?text=Location' }} />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-blue via-brand-blue/20 to-transparent opacity-100"></div>
                <button onClick={() => { setActiveId(null); setFullRouteData(null); }} className="absolute top-4 right-4 w-8 h-8 bg-black/40 border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-brand-gold hover:border-brand-gold hover:text-brand-blue transition-all duration-300 z-10">
                  <span className="text-xl font-light leading-none">&times;</span>
                </button>
                <div className="absolute bottom-4 left-5 bg-brand-gold text-brand-blue text-[10px] uppercase font-black tracking-[0.2em] px-3 py-1 rounded-sm">{activeLoc.type || 'Location'}</div>
              </div>

              <div className="p-7 flex flex-col justify-start gap-4 flex-grow overflow-y-auto custom-scrollbar">
                <div className="space-y-2">
                  <h3 className="text-3xl font-normal font-serif text-brand-gold leading-[1.1] tracking-tight">{activeLoc.name}</h3>
                  <div className="flex items-start gap-2 text-gray-300">
                    <MapPinHouse size={14} className="text-brand-gold mt-0.5 shrink-0" />
                    <h4 className="text-[13px] tracking-wide font-medium leading-relaxed opacity-90">
                      {activeLoc.address || 'Address unavailable'}
                      {activeLoc.city && `, ${activeLoc.city}`}
                    </h4>
                  </div>
                </div>

                {activeLoc.description && <p className="text-[14px] leading-[1.5] text-gray-300 font-light">{activeLoc.description}</p>}

                {activeLoc.type !== 'project' && (
                  <div className="grid grid-cols-3 gap-3 py-2 border-y border-white/10 mt-auto">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-white/10 rounded-md shrink-0"><Route size={14} className="text-brand-gold" /></div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[9px] uppercase text-gray-400 font-black tracking-widest leading-none mb-1">Distance</span>
                        <span className="text-[13px] font-normal text-white break-words">{activeLoc.distance_km || '--'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-white/10 rounded-md shrink-0"><Car size={14} className="text-brand-gold" /></div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[9px] uppercase text-gray-400 font-black tracking-widest leading-none mb-1">Drive</span>
                        <span className="text-[13px] font-normal text-white break-words">{activeLoc.drivetime || '--'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-white/10 rounded-md shrink-0"><Footprints size={14} className="text-brand-gold" /></div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[9px] uppercase text-gray-400 font-black tracking-widest leading-none mb-1">Walk</span>
                        <span className="text-[13px] font-normal text-white break-words">{activeLoc.walktime || '--'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}