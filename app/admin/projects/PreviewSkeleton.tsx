'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import Image from "next/image";
import { Layers, Target, Key, MapPin, ArrowRight, ChevronLeft, ChevronRight, PlusCircle } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const BLANK_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

interface Amenity {
  id: number | string;
  editorIndex?: number;
  title: string;
  description: string;
  thumbnail: string;
  tower?: string | null;
}

export type ProjectEditorRegion =
  | 'hero-image'
  | 'project-title'
  | 'location'
  | 'awards'
  | 'tags'
  | 'editorial'
  | 'amenities'
  | `amenity:${number}`
  | 'unit-layouts'
  | `unit-layout:${number}`;

interface PreviewSkeletonProps {
  data: any;
  editorMode?: boolean;
  selectedRegion?: ProjectEditorRegion | null;
  onSelectRegion?: (region: ProjectEditorRegion) => void;
  onAddAmenity?: () => void;
  onAddLayout?: () => void;
}

function formatTowerName(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const legacyMatch = trimmed.match(/^tower\s+(\d+)$/i);
  if (legacyMatch) {
    const num = parseInt(legacyMatch[1], 10);
    const letter = String.fromCharCode(64 + num);
    return `Tower ${letter}`;
  }
  return trimmed;
}

function DummyMapSection() {
  return (
    <section className="relative py-24 bg-[#0A1128] overflow-hidden flex items-center min-h-[900px]">
      <div className="absolute inset-0 z-0 opacity-20" style={{ backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-brand-gold/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-brand-blue/30 rounded-full blur-[150px] pointer-events-none z-0" />
      <div className="max-w-[90rem] mx-auto px-6 md:px-12 relative z-20 flex flex-col items-center w-full">
        <div className="mb-12 text-center">
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-serif font-light leading-tight mb-4 text-white">
            Points of <span className="text-brand-gold">Interest</span>
          </h2>
          <p className="text-center font-light leading-relaxed text-white/70 text-lg md:text-xl max-w-2xl mx-auto">
            Everything you need, strategically positioned right around your sanctuary.
          </p>
        </div>
        <div className="w-full h-[500px] p-2 md:p-4 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
           <span className="text-brand-gold font-bold uppercase tracking-widest text-sm">Interactive Map disabled in Live Preview</span>
        </div>
      </div>
    </section>
  );
}

export default function PreviewSkeleton({
  data,
  editorMode = false,
  selectedRegion = null,
  onSelectRegion,
  onAddAmenity,
  onAddLayout,
}: PreviewSkeletonProps) {
  const blueprintSectionRef = useRef<HTMLElement>(null);
  
  // --- DRAG TO SCROLL STATE ---
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const didDrag = useRef(false);
  const targetScroll = useRef(0);
  const currentScroll = useRef(0);
  const rafId = useRef<number | null>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);

  const selectRegion = (
  e: React.MouseEvent,
  region: ProjectEditorRegion
) => {
  if (!editorMode) return;

  e.preventDefault();
  e.stopPropagation();

  onSelectRegion?.(region);
};

const regionStyle = (region: ProjectEditorRegion) => {
  if (!editorMode) return '';

  return `
    pointer-events-auto
    cursor-pointer
    transition-all
    duration-150
    ${
      selectedRegion === region
        ? 'ring-2 ring-brand-gold ring-offset-2 ring-offset-transparent'
        : 'hover:ring-2 hover:ring-white/70'
    }
  `;
};

    const availableTowers = useMemo<string[]>(() => {
      const towers = data.towers ?? [];

      return towers
        .map((tower: any) =>
          String(tower.name || '').trim()
        )
        .filter(Boolean);
    }, [data.towers]);

  const [selectedTower, setSelectedTower] = useState<string | null>(
    () => availableTowers[0] ?? null
  );

  useEffect(() => {
    if (availableTowers.length === 0) {
      if (selectedTower !== null) {
        setSelectedTower(null);
      }
      return;
    }

    const stillExists =
      selectedTower &&
      availableTowers.some(
        (tower) =>
          tower.toLowerCase() ===
          selectedTower.toLowerCase()
      );

    if (!stillExists) {
      setSelectedTower(
        availableTowers[0]
      );
    }
  }, [availableTowers, selectedTower]);

  const filteredAmenities = useMemo(() => {
    const amenities = data.amenities ?? [];
    const sortByTitle = (items: Amenity[]) =>
      [...items].sort((a, b) =>
        a.title.trim().localeCompare(b.title.trim(), undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      );

    if (!selectedTower) {
      return sortByTitle(amenities);
    }
    return sortByTitle(
      amenities.filter(
        (item: any) => !item.tower || item.tower.trim().toLowerCase() === selectedTower.toLowerCase()
      )
    );
  }, [data.amenities, selectedTower]);

  // 1. SMOOTH LERP LOOP
  useEffect(() => {
    const smoothDrag = () => {
      if (scrollContainerRef.current) {
        currentScroll.current += (targetScroll.current - currentScroll.current) * 0.08;
        scrollContainerRef.current.scrollLeft = currentScroll.current;
      }
      rafId.current = requestAnimationFrame(smoothDrag);
    };
    rafId.current = requestAnimationFrame(smoothDrag);
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
  }, []);

  useEffect(() => {
    targetScroll.current = 0;
    currentScroll.current = 0;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, [selectedTower]);

  // 2. DRAG HANDLERS
  const onDragStart = (
          e: React.MouseEvent | React.TouchEvent
        ) => {
          if (!scrollContainerRef.current) return;

          isDragging.current = true;
          didDrag.current = false;
          setIsGrabbing(true);

          const pageX =
            'touches' in e
              ? e.touches[0].pageX
              : e.pageX;

          startX.current = pageX;

          targetScroll.current =
            scrollContainerRef.current.scrollLeft;

          currentScroll.current =
            scrollContainerRef.current.scrollLeft;
        };

  const onDragMove = (
        e: React.MouseEvent | React.TouchEvent
      ) => {
        if (
          !isDragging.current ||
          !scrollContainerRef.current
        ) {
          return;
        }

        const pageX =
          'touches' in e
            ? e.touches[0].pageX
            : e.pageX;

        const rawMovement =
          startX.current - pageX;

        if (Math.abs(rawMovement) > 3) {
          didDrag.current = true;
        }

        const delta = rawMovement * 2;

        targetScroll.current += delta;
        startX.current = pageX;

        const maxScroll =
          scrollContainerRef.current.scrollWidth -
          scrollContainerRef.current.clientWidth;

        targetScroll.current = Math.max(
          0,
          Math.min(
            targetScroll.current,
            maxScroll
          )
        );
      };

  const onDragEnd = () => { isDragging.current = false; setIsGrabbing(false); };

  const scrollPrev = () => {
    if (!scrollContainerRef.current) return;
    const step = scrollContainerRef.current.clientWidth * 0.75;
    targetScroll.current = Math.max(0, targetScroll.current - step);
  };

  const scrollNext = () => {
    if (!scrollContainerRef.current) return;
    const step = scrollContainerRef.current.clientWidth * 0.75;
    const maxScroll = scrollContainerRef.current.scrollWidth - scrollContainerRef.current.clientWidth;
    targetScroll.current = Math.min(maxScroll, targetScroll.current + step);
  };

  // GSAP Animations scoped to the live preview container
  useEffect(() => {
    let ctx = gsap.context(() => {
      const towerGroups = gsap.utils.toArray('.tower-group');
      towerGroups.forEach((group: any) => {
        const cards = group.querySelectorAll('.blueprint-card');
        cards.forEach((card: any, i: number) => {
          if (i !== cards.length - 1) {
            gsap.to(card, {
              scale: 0.92,
              opacity: 0.4,
              filter: "blur(4px)",
              scrollTrigger: {
                trigger: cards[i + 1] as HTMLElement,
                scroller: "#preview-scroller",
                start: "top 85%",
                end: "top 20%",
                scrub: true,
              }
            });
          }
        });
      });
    });

    return () => ctx.revert();
  }, [data]); 

  // Format Tags
  const dbTags = data.project_tag?.map((pt: any) => ({
    label: pt.tags?.tag_name || '',
    icon: <Layers size={16} /> 
  })).filter((tag: any) => tag.label !== '') || [];

  const displayTags = [
    ...dbTags,
    { label: data.sqm, icon: <Target size={16} /> },
    { label: data.unit_total, icon: <Key size={16} /> },
  ].filter(tag => tag.label && tag.label !== '0-0 SQM' && tag.label !== '0 Units');

  const groupedLayouts = useMemo<
    Array<{
      towerName: string;
      plans: any[];
    }>
  >(() => {
    if (
      !data?.unit_layout ||
      !Array.isArray(data.unit_layout)
    ) {
      return [];
    }

    const cleanName = (
      val: string
    ) =>
      val
        .replace(
          /[\u2013\u2014]/g,
          '-'
        )
        .replace(/\s+/g, ' ')
        .trim();

    const normalize = (
      val: string
    ) =>
      cleanName(val).toLowerCase();

    const towerOrder =
      (data.towers || [])
        .map((tower: any) =>
          cleanName(
            String(
              tower?.name || ''
            )
          )
        )
        .filter(Boolean);

    const groups = new Map<
      string,
      {
        towerName: string;
        plans: any[];
      }
    >();

    data.unit_layout.forEach(
      (item: any) => {
        const towerName =
          item?.tower_name
            ? cleanName(
                String(
                  item.tower_name
                )
              )
            : 'Unassigned';

        const key =
          normalize(towerName);

        if (!groups.has(key)) {
          groups.set(key, {
            towerName,
            plans: [],
          });
        }

        groups.get(key)!.plans.push(
          item
        );
      }
    );

    groups.forEach((group) => {
      group.plans.sort(
        (a: any, b: any) => {
          const parseOrder = (
            value: unknown
          ) => {
            const parsed =
              Number(value);

            return Number.isFinite(
              parsed
            ) && parsed > 0
              ? parsed
              : Number.MAX_SAFE_INTEGER;
          };

          const orderDiff =
            parseOrder(
              a.sort_order
            ) -
            parseOrder(
              b.sort_order
            );

          if (orderDiff !== 0) {
            return orderDiff;
          }

          return (
            Number(
              a.editorIndex ?? 0
            ) -
            Number(
              b.editorIndex ?? 0
            )
          );
        }
      );
    });

    const ordered: Array<{
      towerName: string;
      plans: any[];
    }> = [];

    towerOrder.forEach(
      (towerName: string) => {
        const key =
          normalize(towerName);

        const group =
          groups.get(key);

        if (group) {
          ordered.push(group);
          groups.delete(key);
        }
      }
    );

    const remaining =
      Array.from(
        groups.values()
      ).sort((a, b) =>
        a.towerName.localeCompare(
          b.towerName,
          undefined,
          {
            numeric: true,
            sensitivity: 'base',
          }
        )
      );

    return [
      ...ordered,
      ...remaining,
    ];
  }, [
    data?.unit_layout,
    data?.towers,
  ]);

  return (
    <div className="relative font-sans text-gray-900 bg-[#E7E7E7] overflow-x-hidden">
      
      {/* --- HERO SECTION --- */}
        <section
          className={`
            relative
            h-[85vh]
            w-full
            overflow-hidden
            bg-gray-900
            ${
              editorMode
                ? 'pointer-events-auto'
                : 'pointer-events-none'
            }
          `}
        >

          {/* EDITABLE HERO IMAGE */}
          <div
            onClick={(e) =>
              selectRegion(e, 'hero-image')
            }
            className={`
              absolute inset-0
              ${regionStyle('hero-image')}
            `}
          >
            <Image
              src={data.image || BLANK_IMAGE}
              alt={data.title}
              fill
              sizes="100vw"
              priority
              className="object-cover"
            />

            {editorMode &&
              selectedRegion === 'hero-image' && (
                <span
                  className="
                    absolute
                    top-5 left-5
                    z-30
                    rounded-md
                    bg-brand-gold
                    px-3 py-1.5
                    text-[10px]
                    font-bold
                    uppercase
                    tracking-wider
                    text-brand-blue
                    shadow-lg
                  "
                >
                  Hero Image
                </span>
              )}
          </div>

          {/* DARK OVERLAY */}
          <div
            className="
              absolute inset-0
              bg-black/40
              pointer-events-none
              z-10
            "
          />

          {/* HERO CONTENT */}
          <div
            className="
              absolute inset-0
              z-20
              flex flex-col
              justify-end
              px-6 pb-16
              md:px-12 md:pb-24
              max-w-[90rem]
              mx-auto
              w-full
              pointer-events-none
            "
          >
            <div
              className="
                flex flex-col
                md:flex-row
                justify-between
                items-end
                w-full
              "
            >

              <div
                className="
                  flex flex-col
                  w-full md:w-auto
                "
              >

                {/* EDITABLE PROJECT TITLE */}
                <div
                  onClick={(e) =>
                    selectRegion(
                      e,
                      'project-title'
                    )
                  }
                  className={`
                    relative
                    w-fit
                    rounded-sm
                    ${regionStyle(
                      'project-title'
                    )}
                  `}
                >
                  {editorMode &&
                    selectedRegion ===
                      'project-title' && (
                      <span
                        className="
                          absolute
                          -top-7 left-0
                          rounded-md
                          bg-brand-gold
                          px-2 py-1
                          text-[9px]
                          font-bold
                          uppercase
                          tracking-wider
                          text-brand-blue
                          shadow-lg
                        "
                      >
                        Project Title
                      </span>
                    )}

                  <h1
                    className="
                      text-5xl
                      md:text-8xl
                      font-serif
                      mb-5
                      drop-shadow-2xl
                      py-2
                    "
                  >
                    <span
                      className="
                        inline-block
                        text-transparent
                        bg-clip-text
                        bg-gradient-to-r
                        from-brand-gold
                        via-[#fff2cd]
                        to-brand-gold
                        pr-4 pb-2 pt-1
                      "
                    >
                      {data.title ||
                        'Project Title'}
                    </span>
                  </h1>
                </div>


                {/* EDITABLE LOCATION */}
                <div
                  onClick={(e) =>
                    selectRegion(
                      e,
                      'location'
                    )
                  }
                  className={`
                    relative
                    flex
                    items-center
                    gap-2
                    mb-10
                    text-white/80
                    rounded-sm
                    w-fit
                    px-1 py-1
                    ${regionStyle(
                      'location'
                    )}
                  `}
                >
                  {editorMode &&
                    selectedRegion ===
                      'location' && (
                      <span
                        className="
                          absolute
                          -top-7 left-0
                          rounded-md
                          bg-brand-gold
                          px-2 py-1
                          text-[9px]
                          font-bold
                          uppercase
                          tracking-wider
                          text-brand-blue
                          shadow-lg
                        "
                      >
                        Location
                      </span>
                    )}

                  <span className="text-brand-gold">
                    <MapPin size={18} />
                  </span>

                  <span
                    className="
                      text-xs md:text-sm
                      font-bold
                      uppercase
                      tracking-[0.3em]
                    "
                  >
                    {data.city || 'City'},{' '}
                    {data.country ||
                      'Country'}
                  </span>
                </div>

              </div>


      {/* EDITABLE AWARD BADGE */}
      {data.img_awards &&
        data.img_awards !== '' && (
          <div
            onClick={(e) =>
              selectRegion(
                e,
                'awards'
              )
            }
            className={`
              relative
              hidden
              lg:block
              mb-10
              rounded-sm
              ${regionStyle(
                'awards'
              )}
            `}
          >
            {editorMode &&
              selectedRegion ===
                'awards' && (
                <span
                  className="
                    absolute
                    -top-7 left-0
                    rounded-md
                    bg-brand-gold
                    px-2 py-1
                    text-[9px]
                    font-bold
                    uppercase
                    tracking-wider
                    text-brand-blue
                    shadow-lg
                  "
                >
                  Awards
                </span>
              )}

            <Image
              src={data.img_awards}
              alt="Award"
              width={350}
              height={120}
              className="
                object-contain
                drop-shadow-2xl
              "
            />
          </div>
        )}
    </div>


    <div className="flex flex-col gap-8">

      {/* EDITABLE TAGS / STATS */}
      <div
        onClick={(e) =>
          selectRegion(
            e,
            'tags'
          )
        }
        className={`
          relative
          flex
          flex-wrap
          gap-4
          w-fit
          rounded-sm
          ${regionStyle(
            'tags'
          )}
        `}
      >
        {editorMode &&
          selectedRegion ===
            'tags' && (
            <span
              className="
                absolute
                -top-7 left-0
                rounded-md
                bg-brand-gold
                px-2 py-1
                text-[9px]
                font-bold
                uppercase
                tracking-wider
                text-brand-blue
                shadow-lg
              "
            >
              Tags & Stats
            </span>
          )}

        {displayTags.map(
          (tag, index) => (
            <span
              key={index}
              className="
                flex items-center
                gap-3
                px-6 py-3
                rounded-sm
                border
                border-white/30
                bg-black/30
                backdrop-blur-xl
                text-white
                text-[10px]
                md:text-xs
                font-bold
                uppercase
                tracking-[0.2em]
                shadow-2xl
              "
            >
              <span
                className="
                  text-brand-gold
                "
              >
                {tag.icon}
              </span>

              {tag.label}
            </span>
          )
        )}
      </div>


      <div
        className="
          flex flex-col
          sm:flex-row
          gap-4 sm:gap-6
          w-full sm:w-auto
        "
      >
        <div
          className="
            group
            relative
            flex
            items-center
            justify-center
            gap-6
            w-fit
            bg-brand-blue
            px-8 py-4
            overflow-hidden
            rounded-sm
            shadow-lg
          "
        >
          <span
            className="
              relative z-10
              text-[11px]
              tracking-[0.25em]
              font-bold
              text-white
              uppercase
            "
          >
            Inquire Now
          </span>

          <ArrowRight
            size={16}
            className="
              relative z-10
              text-white
            "
          />
        </div>
      </div>

    </div>
  </div>
</section>

      {/* --- EDITORIAL SECTION --- */}
      {data.extended_description?.length > 0 && (
        <section
          onClick={(e) =>
            selectRegion(e, 'editorial')
          }
          className={`
            relative
            min-h-screen
            py-24
            flex
            items-center
            transition-all
            duration-150

            ${
              editorMode
                ? `
                  pointer-events-auto
                  cursor-pointer
                  ${
                    selectedRegion === 'editorial'
                      ? 'ring-2 ring-inset ring-brand-gold'
                      : 'hover:ring-2 hover:ring-inset hover:ring-white/70'
                  }
                `
                : 'pointer-events-none'
            }
          `}
          style={{
            background: `linear-gradient(
              to bottom,
              #ffffff 0%,
              #ffffff 65%,
              ${
                data.extended_description[0]
                  ?.editorial_bg_color &&
                data.extended_description[0]
                  ?.editorial_bg_color !== 'transparent'
                  ? data.extended_description[0]
                      .editorial_bg_color
                  : '#ffffff'
              } 100%
            )`,
          }}
        >

          {/* EDITOR LABEL */}
          {editorMode &&
            selectedRegion === 'editorial' && (
              <span
                className="
                  absolute
                  top-5 left-5
                  z-30
                  rounded-md
                  bg-brand-gold
                  px-3 py-1.5
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-wider
                  text-brand-blue
                  shadow-lg
                "
              >
                Editorial Section
              </span>
            )}


          <div
            className="
              max-w-[90rem]
              mx-auto
              px-6 md:px-12
              w-full
              grid
              grid-cols-1
              lg:grid-cols-2
              gap-16
              items-center
              lg:h-[600px]
            "
          >

            {/* EDITORIAL IMAGE */}
            <div
              className="
                relative
                w-full
                h-[400px]
                lg:h-full
                rounded-sm
                overflow-hidden
                shadow-2xl
                bg-gray-200
                border
                border-gray-300
              "
            >
              <Image
                src={
                  data.extended_description[0]
                    ?.editorial_img ||
                  BLANK_IMAGE
                }
                alt="Editorial"
                fill
                className="object-cover"
              />
            </div>


            {/* EDITORIAL COPY */}
            <div
              className="
                flex
                flex-col
                gap-8
                items-start
                justify-center
                h-full
                overflow-hidden
              "
            >
              <h2
                className="
                  font-serif
                  text-2xl
                  sm:text-3xl
                  lg:text-[36px]
                  xl:text-[44px]
                  leading-[1.18]
                  transition-colors
                  duration-300
                  shrink-0
                "
                style={{
                  color:
                    data.extended_description[0]
                      ?.editorial_title_color ||
                    '#132243',
                }}
              >
                {(
                  data.extended_description[0]
                    ?.editorial_title ||
                  'Editorial Headline'
                )
                  .split('\n')
                  .map(
                    (
                      line: string,
                      idx: number
                    ) => (
                      <span
                        key={idx}
                        className="block"
                      >
                        {line}
                      </span>
                    )
                  )}
              </h2>


              <div
                className="
                  space-y-6
                  overflow-y-auto
                  w-full
                  pr-2
                "
                style={{
                  scrollbarWidth: 'thin',
                }}
              >
                <p
                  className="
                    text-lg
                    leading-relaxed
                    text-justify
                    whitespace-pre-line
                    transition-colors
                    duration-300
                  "
                  style={{
                    color:
                      data.extended_description[0]
                        ?.editorial_desc_color ||
                      '#4B5563',
                  }}
                >
                  {data.extended_description[0]
                    ?.editorial_long ||
                    'Write your description here...'}
                </p>
              </div>
            </div>

          </div>
        </section>
      )}
      
      {/* --- AMENITIES DRAGGABLE CAROUSEL SECTION --- */}
      {(
          data.amenities?.length > 0 ||
          editorMode
        ) && (
              <section
        className={`
          relative
          w-full
          bg-[#132243]
          flex
          flex-col
          justify-center
          py-24 md:py-32
          overflow-hidden
          group/amenities
          transition-all
          ${
            editorMode &&
            selectedRegion === 'amenities'
              ? 'ring-2 ring-inset ring-brand-gold'
              : ''
          }
        `}
      >
                {editorMode &&
          selectedRegion === 'amenities' && (
            <span
              className="
                absolute
                top-5 left-5
                z-40
                rounded-md
                bg-brand-gold
                px-3 py-1.5
                text-[10px]
                font-bold
                uppercase
                tracking-wider
                text-brand-blue
                shadow-lg
              "
            >
              Amenities Section
            </span>
          )}
                      <div
              onClick={(e) =>
                selectRegion(e, 'amenities')
              }
              className={`
                max-w-[90rem]
                px-6 md:px-12
                w-full
                mx-auto
                mb-8 md:mb-10
                shrink-0
                rounded-sm
                transition-all
                ${
                  editorMode
                    ? `
                      pointer-events-auto
                      cursor-pointer
                      hover:ring-2
                      hover:ring-white/50
                    `
                    : 'pointer-events-none'
                }
              `}
            >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 w-full text-white">
              <div>
                <div className="text-xs tracking-[0.25em] uppercase text-brand-gold font-bold mb-2 md:mb-4 flex items-center gap-3">
                  Amenities &amp; Facilities
                </div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif leading-tight">
                  <span className="inline-block whitespace-nowrap">
                    {data.extended_description?.[0]?.amenities_title || 'Experience A Fresh'}
                  </span>
                  <br />
                  <span className="text-brand-gold">
                    {data.extended_description?.[0]?.amenities_title_gold || `Way Of Living in ${data.title || 'this project'}.`}
                  </span>
                </h2>
              </div>
              <p className="text-white/70 font-light leading-relaxed max-w-sm text-justify md:text-right text-sm md:text-base hidden sm:block">
                Swipe, drag, or use the arrows to explore our expansive leisure amenities designed for your wellness.
              </p>
            </div>
          </div>

          {/* TOWER FILTER BADGES */}
          {availableTowers.length > 1 && (
            <div className="max-w-[90rem] px-6 md:px-12 w-full mx-auto mb-8 md:mb-10 pointer-events-auto">
              <div className="flex flex-col gap-4">
                <span className="text-[10px] md:text-xs tracking-[0.25em] uppercase text-white/40 font-bold">
                  Select Tower
                </span>
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  {availableTowers.map((tower) => {
                    const isActive = selectedTower === tower;
                    return (
                      <button
                        key={tower}
                        type="button"
                        onClick={() => setSelectedTower(tower)}
                        className={`px-5 md:px-7 py-3 rounded-full border text-xs md:text-sm uppercase tracking-[0.15em] transition-all duration-300 ${
                          isActive
                            ? 'bg-brand-gold border-brand-gold text-[#132243]'
                            : 'bg-transparent border-white/20 text-white/60 hover:text-white hover:border-brand-gold/70'
                        }`}
                      >
                        {formatTowerName(tower)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* CAROUSEL WRAPPER */}
          <div className="relative w-full">
            <button
              type="button"
              onClick={scrollPrev}
              aria-label="Previous Amenities"
              className="absolute left-4 md:left-8 top-[36%] -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-[#132243]/80 hover:bg-brand-gold border border-brand-gold/100 hover:border-[#132243]/100 text-brand-gold hover:text-[#132243] backdrop-blur-xl flex items-center justify-center transition-all duration-300 shadow-[0_8px_30px_rgba(0,0,0,0.5)] cursor-pointer outline-none group active:scale-95"
            >
              <ChevronLeft size={24} strokeWidth={2.5} className="transition-transform duration-300 group-hover:-translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={scrollNext}
              aria-label="Next Amenities"
              className="absolute right-4 md:right-8 top-[36%] -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-[#132243]/80 hover:bg-brand-gold border border-brand-gold/100 hover:border-[#132243]/100 text-brand-gold hover:text-[#132243] backdrop-blur-xl flex items-center justify-center transition-all duration-300 shadow-[0_8px_30px_rgba(0,0,0,0.5)] cursor-pointer outline-none group active:scale-95"
            >
              <ChevronRight size={24} strokeWidth={2.5} className="transition-transform duration-300 group-hover:translate-x-0.5" />
            </button>

            <div 
              ref={scrollContainerRef}
              onMouseDown={onDragStart} onMouseLeave={onDragEnd} onMouseUp={onDragEnd} onMouseMove={onDragMove}
              onTouchStart={onDragStart} onTouchEnd={onDragEnd} onTouchMove={onDragMove}
              className={`flex gap-6 md:gap-8 px-6 md:px-12 2xl:pl-[calc((100vw-90rem)/2+3rem)] overflow-x-hidden w-full items-start pb-8 ${isGrabbing ? 'cursor-grabbing' : 'cursor-grab'}`}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', touchAction: 'pan-y' }}
            >
              <style dangerouslySetInnerHTML={{ __html: `::-webkit-scrollbar { display: none; }` }} />
              
              {filteredAmenities.map(
              (item: any, index: number) => (
                <div
                  key={item.id || index}

                  onClick={(e) => {
                    if (
                      !editorMode ||
                      didDrag.current
                    ) {
                      return;
                    }

                    const sourceIndex =
                      Number.isInteger(
                        item.editorIndex
                      )
                        ? item.editorIndex
                        : index;

                    selectRegion(
                      e,
                      `amenity:${sourceIndex}` as ProjectEditorRegion
                    );
                  }}

                  className={`
                    shrink-0
                    w-[82vw]
                    sm:w-[50vw]
                    md:w-[40vw]
                    lg:w-[30vw]
                    flex
                    flex-col
                    group
                    select-none
                    rounded-xl
                    transition-all
                    ${
                      editorMode
                        ? `
                          pointer-events-auto
                          cursor-pointer
                          hover:ring-2
                          hover:ring-white/60
                          hover:ring-offset-4
                          hover:ring-offset-[#132243]
                        `
                        : 'pointer-events-none'
                    }

                    ${
                      selectedRegion ===
                      `amenity:${
                        Number.isInteger(
                          item.editorIndex
                        )
                          ? item.editorIndex
                          : index
                      }`
                        ? `
                          ring-2
                          ring-brand-gold
                          ring-offset-4
                          ring-offset-[#132243]
                        `
                        : ''
                    }
                  `}
                >
                  <div className="relative h-[38vh] min-h-[240px] max-h-[380px] w-full overflow-hidden rounded-xl bg-gray-800 shadow-2xl pointer-events-auto">
                    <Image src={item.thumbnail || BLANK_IMAGE} alt={item.title} fill draggable="false" sizes="(max-width: 768px) 82vw, (max-width: 1024px) 40vw, 30vw" className="object-cover group-hover:scale-105 transition-transform duration-[1.5s] ease-out pointer-events-none select-none" />
                    <div className="absolute inset-0 bg-black/15 group-hover:bg-transparent transition-colors duration-500 pointer-events-none" />
                  </div>
                  <div className="mt-5 flex flex-col gap-2 pr-4">
                    <div className="flex items-center gap-3">
                      <span className="text-brand-gold font-mono text-sm">{String(index + 1).padStart(2, '0')}</span>
                      <h3 className="text-xl md:text-2xl font-serif text-white">{item.title}</h3>
                    </div>
                    <p className="text-white/60 text-sm leading-relaxed pl-7 border-l border-white/10 line-clamp-3">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}

              {editorMode &&
                onAddAmenity && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();

                      if (
                        didDrag.current
                      ) {
                        return;
                      }

                      onAddAmenity();
                    }}
                    className="
                      shrink-0
                      w-[82vw]
                      sm:w-[50vw]
                      md:w-[40vw]
                      lg:w-[30vw]
                      min-h-[300px]
                      rounded-xl
                      border-2
                      border-dashed
                      border-white/20
                      bg-white/[0.03]
                      text-white/70
                      hover:text-brand-gold
                      hover:border-brand-gold/70
                      hover:bg-white/[0.06]
                      transition-all
                      flex
                      flex-col
                      items-center
                      justify-center
                      gap-3
                      cursor-pointer
                      pointer-events-auto
                    "
                  >
                    <span
                      className="
                        flex
                        h-12 w-12
                        items-center
                        justify-center
                        rounded-full
                        border
                        border-current
                      "
                    >
                      <PlusCircle
                        size={22}
                      />
                    </span>

                    <span
                      className="
                        text-xs
                        font-bold
                        uppercase
                        tracking-[0.2em]
                      "
                    >
                      Add Amenity
                    </span>

                    <span
                      className="
                        max-w-[220px]
                        text-center
                        text-xs
                        font-normal
                        normal-case
                        tracking-normal
                        text-white/40
                      "
                    >
                      Add a new amenity and edit it in the side panel.
                    </span>
                  </button>
                )}

              <div className="w-[5vw] md:w-[10vw] shrink-0 pointer-events-none" />
            </div>
          </div>
        </section>
      )}

      {/* --- ROOM BLUEPRINTS SECTION --- */}
      {(
        data.unit_layout?.length > 0 ||
        editorMode
      ) && (
        <section
          id="blueprints"
          ref={blueprintSectionRef}
          className={`
            relative
            w-full
            py-32
            bg-transparent
            z-10
            transition-all
            ${
              editorMode &&
              selectedRegion ===
                'unit-layouts'
                ? 'ring-2 ring-inset ring-brand-gold'
                : ''
            }
          `}
        >
          <div className="max-w-[75rem] mx-auto px-6 md:px-12 relative">

            {/* SECTION HEADING */}
            <div
              onClick={(e) =>
                selectRegion(
                  e,
                  'unit-layouts'
                )
              }
              className={`
                relative
                mb-20
                text-center
                rounded-sm
                ${
                  editorMode
                    ? `
                        pointer-events-auto
                        cursor-pointer
                        hover:ring-2
                        hover:ring-brand-blue/30
                      `
                    : ''
                }
              `}
            >
              {editorMode &&
                selectedRegion ===
                  'unit-layouts' && (
                  <span
                    className="
                      absolute
                      -top-8
                      left-1/2
                      -translate-x-1/2
                      z-30
                      rounded-md
                      bg-brand-gold
                      px-3 py-1.5
                      text-[10px]
                      font-bold
                      uppercase
                      tracking-wider
                      text-brand-blue
                      shadow-lg
                    "
                  >
                    Unit Layouts
                  </span>
                )}

              <div className="text-xs tracking-widest uppercase text-brand-blue font-bold mb-4 flex items-center justify-center gap-4">
                Room Blueprints
              </div>

              <h2 className="text-4xl md:text-5xl lg:text-7xl font-serif text-brand-blue leading-tight">
                Design Your{' '}
                <span className="text-brand-gold">
                  Sanctuary
                </span>
              </h2>
            </div>

            {/* EMPTY EDITOR STATE */}
            {editorMode &&
              groupedLayouts.length ===
                0 && (
                <div
                  className="
                    mb-16
                    rounded-2xl
                    border-2
                    border-dashed
                    border-brand-blue/20
                    bg-white/70
                    px-8 py-14
                    text-center
                    shadow-sm
                  "
                >
                  <p className="text-lg font-serif text-brand-blue">
                    No unit layouts yet
                  </p>

                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
                    Add the first floorplan,
                    then assign it to one of
                    this project's towers.
                  </p>

                  {onAddLayout && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onAddLayout();
                      }}
                      className="
                        mt-6
                        inline-flex
                        items-center
                        justify-center
                        rounded-xl
                        bg-brand-blue
                        px-5 py-3
                        text-xs
                        font-bold
                        uppercase
                        tracking-wider
                        text-white
                        shadow-md
                        hover:bg-brand-gold
                        hover:text-brand-blue
                        transition-colors
                      "
                    >
                      Add Unit Layout
                    </button>
                  )}
                </div>
              )}

            {/* GROUPED BY TOWER */}
            {groupedLayouts.map(
              ({
                towerName,
                plans,
              }) => (
                <div
                  key={towerName}
                  className="
                    tower-group
                    relative
                    mb-32
                    last:mb-0
                  "
                >
                  {/* STICKY TOWER HEADER */}
                  <div className="sticky top-20 md:top-24 z-20 pb-8 pt-2 flex justify-center pointer-events-none">
                    <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-brand-blue backdrop-blur-md border border-brand-gold/40 shadow-xl pointer-events-auto">
                      <span className="w-2 h-2 rounded-full bg-brand-gold animate-pulse" />

                      <span className="text-xs md:text-sm uppercase tracking-[0.25em] font-serif text-white font-medium">
                        {towerName}
                      </span>
                    </div>
                  </div>

                  {/* STACKING CARDS */}
                  <div className="relative">
                    {plans.map(
                      (
                        plan: any,
                        index: number
                      ) => {
                        const editorIndex =
                          Number(
                            plan.editorIndex
                          );

                        const region =
                          Number.isInteger(
                            editorIndex
                          )
                            ? (`unit-layout:${editorIndex}` as ProjectEditorRegion)
                            : 'unit-layouts';

                        const isSelected =
                          editorMode &&
                          selectedRegion ===
                            region;

                        return (
                          <div
                            key={
                              plan.id ||
                              `${towerName}-${index}`
                            }
                            onClick={(e) =>
                              selectRegion(
                                e,
                                region
                              )
                            }
                            className={`
                              blueprint-card
                              sticky
                              top-[22vh]
                              w-full
                              min-h-[60vh]
                              lg:h-[65vh]
                              bg-white
                              rounded-xl
                              shadow-[0_-10px_40px_rgba(0,0,0,0.08)]
                              border
                              overflow-hidden
                              flex
                              flex-col
                              lg:flex-row
                              mb-12
                              origin-top
                              transition-all
                              ${
                                editorMode
                                  ? `
                                      pointer-events-auto
                                      cursor-pointer
                                      ${
                                        isSelected
                                          ? 'border-brand-gold ring-2 ring-brand-gold ring-offset-4 ring-offset-[#E7E7E7]'
                                          : 'border-gray-100 hover:border-brand-gold/60 hover:shadow-xl'
                                      }
                                    `
                                  : 'border-gray-100'
                              }
                            `}
                            style={{
                              zIndex:
                                index + 1,
                            }}
                          >
                            {editorMode &&
                              isSelected && (
                                <span
                                  className="
                                    absolute
                                    top-4 left-4
                                    z-30
                                    rounded-md
                                    bg-brand-gold
                                    px-3 py-1.5
                                    text-[10px]
                                    font-bold
                                    uppercase
                                    tracking-wider
                                    text-brand-blue
                                    shadow-lg
                                  "
                                >
                                  Unit Layout
                                </span>
                              )}

                            <div
                              className="w-full lg:w-2/5 text-white p-8 md:p-12 lg:p-16 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-white/10 transition-colors"
                              style={{
                                backgroundColor:
                                  plan.bg_color ||
                                  '#051431',
                              }}
                            >
                              <div className="text-brand-gold font-mono text-sm mb-4">
                                {String(
                                  index + 1
                                ).padStart(
                                  2,
                                  '0'
                                )}
                              </div>

                              <h3 className="text-3xl md:text-4xl lg:text-5xl font-serif text-white mb-4">
                                {plan.title}
                              </h3>

                              <p className="font-sans tracking-widest text-white/70 font-bold text-sm md:text-base mb-8 uppercase">
                                {Number(
                                  plan.min_sqm
                                ) ===
                                  Number(
                                    plan.max_sqm
                                  ) ||
                                !plan.max_sqm
                                  ? `± ${
                                      plan.min_sqm ||
                                      0
                                    } SQM`
                                  : `± ${
                                      plan.min_sqm ||
                                      0
                                    } - ± ${
                                      plan.max_sqm ||
                                      0
                                    } SQM`}
                              </p>

                              <p className="text-white/80 leading-relaxed text-sm md:text-base">
                                {
                                  plan.description
                                }
                              </p>
                            </div>

                            <div className="w-full lg:w-3/5 relative p-8 md:p-12 bg-white flex items-center justify-center group">
                              <div className="relative w-full h-full min-h-[350px] lg:min-h-full transition-transform duration-700 ease-out group-hover:scale-105">
                                <Image
                                  src={
                                    plan.thumbnail ||
                                    BLANK_IMAGE
                                  }
                                  alt={
                                    plan.title
                                  }
                                  fill
                                  sizes="(max-width: 1024px) 100vw, 60vw"
                                  className="object-contain drop-shadow-2xl"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              )
            )}

            {/* ADD ANOTHER LAYOUT */}
            {editorMode &&
              groupedLayouts.length > 0 &&
              onAddLayout && (
                <div className="mt-10 flex justify-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onAddLayout();
                    }}
                    className="
                      inline-flex
                      items-center
                      justify-center
                      rounded-xl
                      border
                      border-dashed
                      border-brand-blue/30
                      bg-white/70
                      px-6 py-3
                      text-[10px]
                      font-bold
                      uppercase
                      tracking-wider
                      text-brand-blue
                      hover:border-brand-gold
                      hover:bg-brand-gold/10
                      transition-colors
                    "
                  >
                    + Add Unit Layout
                  </button>
                </div>
              )}
          </div>
        </section>
      )}

      {/* --- MAP SECTION --- */}
      <DummyMapSection />
    </div>
  );
}