'use client';

export type StoryEditorRegion = 'year' | 'title' | 'description' | 'image';

type MilestonePreviewData = {
  year: string;
  title: string;
  description: string;
  image?: string;
};

type PreviewSkeletonProps = {
  data: MilestonePreviewData;
  selectedRegion: StoryEditorRegion;
  onSelectRegion: (region: StoryEditorRegion) => void;
};

export default function PreviewSkeleton({ data, selectedRegion, onSelectRegion }: PreviewSkeletonProps) {
  const selectionClass = (region: StoryEditorRegion) =>
    `cursor-pointer rounded-lg outline-none transition-all focus-visible:ring-2 focus-visible:ring-brand-gold ${
      selectedRegion === region
        ? 'ring-2 ring-brand-gold ring-offset-4 ring-offset-[#050B14]'
        : 'hover:ring-2 hover:ring-brand-gold/70 hover:ring-offset-4 hover:ring-offset-[#050B14]'
    }`;

  return (
    <div className="relative mx-auto flex min-h-[560px] w-full max-w-5xl items-center overflow-hidden rounded-2xl border border-white/10 bg-[#050B14] px-8 py-20 text-white shadow-2xl md:px-16">
      {data.image && <img src={data.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#050B14]/95 via-[#050B14]/70 to-[#050B14]/40" />
      <span aria-hidden="true" className="pointer-events-none absolute right-0 top-10 max-w-full overflow-hidden whitespace-nowrap font-serif text-[min(22vw,12rem)] font-black leading-none text-white/[0.06]">{data.year}</span>

      <button
        type="button"
        onClick={() => onSelectRegion('image')}
        aria-label="Edit milestone image"
        aria-pressed={selectedRegion === 'image'}
        className={`group absolute inset-3 z-10 ${selectionClass('image')}`}
      >
        <span className="absolute right-5 top-5 rounded-full border border-white/30 bg-[#050B14]/70 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-white/90 backdrop-blur-sm transition-colors group-hover:border-brand-gold group-hover:text-brand-gold">
          Edit Image
        </span>
      </button>

      <div className="pointer-events-none relative z-20 flex w-full items-center gap-8 md:gap-14">
        <div className="relative flex self-stretch shrink-0 flex-col items-center">
          <div className="absolute inset-y-0 w-[2px] bg-white/20" />
          <div className="relative mt-16 h-6 w-6 rounded-full border-2 border-brand-gold bg-[#050B14] shadow-[0_0_18px_rgba(208,179,112,0.6)]" />
        </div>
        <div className="pointer-events-auto min-w-0 max-w-2xl space-y-6">
          <button type="button" onClick={() => onSelectRegion('year')} aria-label="Edit milestone year" aria-pressed={selectedRegion === 'year'} className={`block text-left ${selectionClass('year')}`}>
            <span className="block font-serif text-5xl font-bold text-brand-gold md:text-7xl">{data.year}</span>
          </button>
          <button type="button" onClick={() => onSelectRegion('title')} aria-label="Edit milestone title" aria-pressed={selectedRegion === 'title'} className={`block w-full text-left ${selectionClass('title')}`}>
            <span className="block font-serif text-2xl font-semibold leading-tight text-white md:text-4xl">{data.title}</span>
          </button>
          <button type="button" onClick={() => onSelectRegion('description')} aria-label="Edit milestone description" aria-pressed={selectedRegion === 'description'} className={`block w-full text-left ${selectionClass('description')}`}>
            <span className="block whitespace-pre-wrap text-sm font-light leading-relaxed text-white/90 md:text-lg">{data.description}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
