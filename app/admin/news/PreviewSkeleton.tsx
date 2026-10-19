'use client';

import React, { useMemo } from 'react';
import type { Editor } from '@tiptap/react';
import { parseArticleContent } from '@/lib/rendering/article-content';
import { adaptLegacyArticleToSections, isValidSectionsDocument, type ArticleSectionsDocument } from '@/app/types/article-sections';
import { SectionBodyEditor, type SectionPreviewTarget } from './SectionBodyEditor';
import { Image as ImageIcon } from 'lucide-react';

export type NewsEditorRegion = 'overview' | 'image' | 'header' | 'excerpt' | 'slug' | 'sections' | 'section-image' | 'section-heading' | 'section-body';

type NewsPreviewData = {
  image?: string;
  show_cover_on_article?: boolean | null;
  title: string;
  category: string;
  date: string;
  excerpt: string;
  article_content?: string | null;
  article_layout?: string;
  article_sections?: ArticleSectionsDocument | null;
};

type PreviewSkeletonProps = {
  data: NewsPreviewData;
  selectedRegion: NewsEditorRegion;
  onSelectRegion: (region: NewsEditorRegion) => void;
  selectedSectionId: string | null;
  sectionEditor: Editor | null;
  onSelectSection: (sectionId: string, target: SectionPreviewTarget) => void;
};

export default function PreviewSkeleton({
  data,
  selectedRegion,
  onSelectRegion,
  selectedSectionId,
  sectionEditor,
  onSelectSection,
}: PreviewSkeletonProps) {
  const showCover = Boolean(data.image) && data.show_cover_on_article !== false;
  // Determine sections to render (use article_sections if valid, else adapt legacy)
  const sectionsDoc: ArticleSectionsDocument = useMemo(() => {
    if (data.article_sections && isValidSectionsDocument(data.article_sections)) {
      return data.article_sections;
    }
    // Adapt legacy content to sections in-memory
    return adaptLegacyArticleToSections({
      title: data.title,
      excerpt: data.excerpt,
      article_content: data.article_content ? parseArticleContent(data.article_content) : null,
      image: data.image,
      article_layout: data.article_layout,
    });
  }, [data]);

  const regionClass = (region: NewsEditorRegion) =>
    `rounded-md outline-none transition-all focus-visible:ring-2 focus-visible:ring-brand-gold ${
      selectedRegion === region
        ? 'ring-2 ring-brand-gold ring-offset-4'
        : 'hover:ring-2 hover:ring-brand-gold/60 hover:ring-offset-4'
    }`;

  return (
    <div className="relative w-full bg-white flex flex-col">
      {/* Article Cover Image and Header */}
      {showCover && (
        <div data-news-cover className="relative h-screen min-h-[400px] w-full overflow-hidden bg-black">
          <img
            src={data.image}
            alt={data.title}
            className="absolute inset-0 h-full w-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/20 z-10 pointer-events-none"></div>
          <button
            type="button"
            onClick={() => onSelectRegion('image')}
            aria-label="Edit article cover image"
            aria-pressed={selectedRegion === 'image'}
            className={`group absolute inset-3 z-10 cursor-pointer rounded-md outline-none transition-all focus-visible:ring-2 focus-visible:ring-brand-gold ${
              selectedRegion === 'image'
                ? 'ring-2 ring-brand-gold ring-offset-4'
                : 'hover:ring-2 hover:ring-brand-gold/60 hover:ring-offset-4'
            }`}
          >
            <span className="absolute bottom-4 right-4 rounded-full border border-white/50 bg-black/50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              Edit Featured Image
            </span>
          </button>
        </div>
      )}

      {/* Title and Metadata Section */}
      <div className="news-article-header relative z-20 w-full bg-white pt-16 md:pt-24">
        {!showCover && (
          <button
            type="button"
            onClick={() => onSelectRegion('image')}
            aria-label="Edit article cover image"
            aria-pressed={selectedRegion === 'image'}
            className={`absolute right-6 top-4 inline-flex items-center gap-2 border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-blue shadow-sm hover:border-brand-gold md:right-12 ${regionClass('image')}`}
          >
            <ImageIcon size={14} aria-hidden="true" /> Featured Image
          </button>
        )}
        <div className="mx-auto max-w-[85rem] px-6 md:px-12">
          <button
            type="button"
            onClick={() => onSelectRegion('header')}
            aria-label="Edit article header"
            aria-pressed={selectedRegion === 'header'}
            className={`block w-full cursor-pointer text-left ${regionClass('header')}`}
          >
            <span data-news-header-part="date" className="mb-4 block">
              <span className="text-brand-gold text-[11px] md:text-xs font-bold uppercase tracking-widest">
                {data.date}
              </span>
            </span>
            <span data-news-header-part="title" className="news-article-title block font-serif text-4xl font-normal leading-[1.15] text-brand-blue md:text-5xl lg:text-6xl">
              {data.title}
            </span>
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="news-article-sections relative w-full bg-white">
        {sectionsDoc.sections.map((section, index) => {
          const isActiveSection = selectedSectionId === section.id;
          const activeTarget = isActiveSection && selectedRegion.startsWith('section-')
            ? selectedRegion.slice('section-'.length) as SectionPreviewTarget : null;
          return (
            <div key={section.id} data-news-preview-section={section.id}>
              <SectionBodyEditor
                section={section}
                sectionLabel={section.heading?.trim() || `Section ${index + 1}`}
                editor={isActiveSection ? sectionEditor : null}
                isEditing={isActiveSection}
                activeTarget={activeTarget}
                onSelectTarget={(target) => onSelectSection(section.id, target)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
