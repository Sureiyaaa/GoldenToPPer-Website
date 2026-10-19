'use client';

import React from 'react';
import Image from 'next/image';
import { renderArticleContent, type TiptapDoc } from '@/lib/rendering/article-content';
import type { ArticleSection, ArticleSectionsDocument } from '@/app/types/article-sections';
import { ArticleSectionLayout } from './ArticleSectionLayout';

interface ArticleSectionsProps {
  document: ArticleSectionsDocument;
  isEditing?: boolean;
}

/**
 * Shared section rendering component for public pages and admin preview
 * Handles all section layouts with responsive behavior
 * No Tiptap runtime; uses renderArticleContent for body rendering
 */
export function ArticleSections({ document, isEditing = false }: ArticleSectionsProps) {
  if (!document.sections || document.sections.length === 0) {
    return null;
  }

  return (
    <div className="news-article-sections relative w-full bg-white">
      {document.sections.map((section) => (
        <ArticleSectionRenderer
          key={section.id}
          section={section}
          isEditing={isEditing}
        />
      ))}
    </div>
  );
}

interface ArticleSectionRendererProps {
  section: ArticleSection;
  isEditing?: boolean;
}

function ArticleSectionRenderer({ section, isEditing = false }: ArticleSectionRendererProps) {
  const regionClass = (isEditing: boolean) =>
    isEditing
      ? 'rounded-md outline-none transition-all focus-visible:ring-2 focus-visible:ring-brand-gold'
      : '';

  // Render section heading if enabled
  const heading = section.headingEnabled && section.heading?.trim() ? (
    <h2 className={`news-article-section-heading font-serif text-2xl md:text-3xl font-normal text-brand-blue leading-[1.2] ${regionClass(isEditing)}`}>
      {section.heading}
    </h2>
  ) : null;

  // Render body content
  const body = section.body ? (
    <div className={`news-article-body max-w-none text-gray-700 ${regionClass(isEditing)}`}>
      {renderArticleContent(section.body as TiptapDoc)}
    </div>
  ) : null;

  // Render section image if present
  const sectionImage = section.image ? (
    <div className="relative w-full rounded-md overflow-hidden">
      <Image
        src={section.image}
        alt="Section content"
        width={800}
        height={600}
        className="w-full h-auto object-contain"
        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 90vw, 85rem"
      />
    </div>
  ) : null;

  return (
    <ArticleSectionLayout
      layout={section.layout}
      heading={heading}
      body={body}
      image={sectionImage}
    />
  );
}
