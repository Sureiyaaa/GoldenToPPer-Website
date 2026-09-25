'use client';

import { motion } from 'framer-motion';

export type NewsEditorRegion = 'image' | 'meta' | 'title' | 'excerpt';

type NewsPreviewData = {
  image?: string;
  title: string;
  category: string;
  date: string;
  excerpt: string;
};

type PreviewSkeletonProps = {
  data: NewsPreviewData;
  selectedRegion: NewsEditorRegion | 'slug';
  onSelectRegion: (region: NewsEditorRegion) => void;
};

export default function PreviewSkeleton({
  data,
  selectedRegion,
  onSelectRegion,
}: PreviewSkeletonProps) {
  const regionClass = (region: NewsEditorRegion) =>
    `rounded-md outline-none transition-all focus-visible:ring-2 focus-visible:ring-brand-gold ${
      selectedRegion === region
        ? 'ring-2 ring-brand-gold ring-offset-4'
        : 'hover:ring-2 hover:ring-brand-gold/60 hover:ring-offset-4'
    }`;

  return (
    <div className="relative flex min-h-full w-full flex-col bg-white font-sans text-gray-900 shadow-xl selection:bg-brand-gold selection:text-white">
      {/* A visual stand-in for the public navigation, not an editor control. */}
      <div className="pointer-events-none absolute left-0 top-0 z-20 flex h-16 w-full items-center bg-gradient-to-b from-black/80 to-transparent px-6 md:h-20">
        <div className="h-8 w-32 rounded-sm bg-white/20 backdrop-blur-sm" />
      </div>

      <section className="relative z-10 h-screen min-h-[400px] w-full overflow-hidden bg-black">
        {data.image ? (
          <img
            src={data.image}
            alt={data.title}
            className="absolute inset-0 h-full w-full object-cover opacity-80"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-blue to-[#0d1b3e] text-center">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">
                Featured Image
              </p>
              <p className="mt-2 text-sm text-white/60">Add an article image</p>
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-black/40 via-transparent to-black/20" />
        <button
          type="button"
          onClick={() => onSelectRegion('image')}
          aria-label="Edit featured image"
          aria-pressed={selectedRegion === 'image'}
          className={`group absolute inset-3 z-10 cursor-pointer ${regionClass('image')}`}
        >
          <span className="absolute bottom-4 right-4 rounded-full border border-white/50 bg-black/50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            Edit Featured Image
          </span>
        </button>
      </section>

      <main className="relative z-20 w-full bg-white py-20 md:py-32">
        <div className="mx-auto max-w-[85rem] px-6 md:px-12">
          <motion.header
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 max-w-[70rem]"
          >
            <button
              type="button"
              onClick={() => onSelectRegion('meta')}
              aria-label="Edit article details and publication date"
              aria-pressed={selectedRegion === 'meta'}
              className={`mb-4 block cursor-pointer text-left ${regionClass('meta')}`}
            >
              <span className="text-[11px] font-bold uppercase tracking-widest text-brand-gold md:text-xs">
                {data.date}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onSelectRegion('title')}
              aria-label="Edit article title"
              aria-pressed={selectedRegion === 'title'}
              className={`block w-full cursor-pointer text-left ${regionClass('title')}`}
            >
              <span className="block font-serif text-4xl font-normal leading-[1.15] text-brand-blue md:text-5xl lg:text-6xl">
                {data.title}
              </span>
            </button>
          </motion.header>

          <motion.article
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-12 w-full"
          >
            <button
              type="button"
              onClick={() => onSelectRegion('excerpt')}
              aria-label="Edit article content"
              aria-pressed={selectedRegion === 'excerpt'}
              className={`block w-full cursor-pointer text-left ${regionClass('excerpt')}`}
            >
              <span className="block text-base leading-[1.85] text-gray-700 md:text-[17px]">
                {data.excerpt.split(/\n+/).filter(Boolean).map((paragraph, index) => (
                  <span
                    key={index}
                    className="mb-6 block text-left md:text-justify [text-align-last:left]"
                  >
                    {paragraph.trim()}
                  </span>
                ))}
              </span>
            </button>
          </motion.article>
        </div>
      </main>
    </div>
  );
}
