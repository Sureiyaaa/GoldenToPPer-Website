'use client';

import React from 'react';
import { motion } from 'framer-motion';

/**
 * Shared layout presets for article rendering
 * Used by both admin preview (editable) and public pages (read-only)
 */

export type ArticleLayoutPreset =
  | 'image-above'
  | 'title-above'
  | 'image-contained'
  | 'sidebar-image-right'
  | 'sidebar-image-left';

export const ARTICLE_LAYOUT_PRESETS: Record<ArticleLayoutPreset, { label: string; description: string }> = {
  'image-above': {
    label: 'Image Hero',
    description: 'Full-width image above title & body',
  },
  'title-above': {
    label: 'Title First',
    description: 'Title & body above full-width image',
  },
  'image-contained': {
    label: 'Image Contained',
    description: 'Image below body, aligned with text width',
  },
  'sidebar-image-right': {
    label: 'Sidebar Right',
    description: 'Title/body left, image right',
  },
  'sidebar-image-left': {
    label: 'Sidebar Left',
    description: 'Image left, title/body right',
  },
};

export function isValidLayout(value: any): value is ArticleLayoutPreset {
  return Object.keys(ARTICLE_LAYOUT_PRESETS).includes(value);
}

export function normalizeLayout(value: any): ArticleLayoutPreset {
  if (isValidLayout(value)) return value;
  return 'image-above';
}

interface ArticleLayoutProps {
  preset: ArticleLayoutPreset;
  // Slots: media is optional; title, metadata, body are required
  media?: React.ReactNode;
  title: React.ReactNode;
  metadata: React.ReactNode; // Date/category badge
  body: React.ReactNode;     // Body content (EditorContent or rendered)
  isEditing?: boolean;       // true = admin preview, false = public page
}

export function ArticleLayout({
  preset,
  media,
  title,
  metadata,
  body,
  isEditing = false,
}: ArticleLayoutProps) {
  // Common container classes
  const contentContainerClass = 'mx-auto max-w-[85rem] px-6 md:px-12';
  const regionClass = (isEditing: boolean) =>
    isEditing
      ? 'rounded-md outline-none transition-all focus-visible:ring-2 focus-visible:ring-brand-gold'
      : '';

  switch (preset) {
    case 'image-above':
      return (
        <div className="relative flex min-h-full w-full flex-col bg-white font-sans text-gray-900 shadow-xl selection:bg-brand-gold selection:text-white">
          {/* Hero image section */}
          {media && (
            <section className="relative z-10 h-screen min-h-[400px] w-full overflow-hidden bg-black">
              <div className={`absolute inset-0 ${regionClass(isEditing)}`}>
                {media}
              </div>
            </section>
          )}

          {/* Content below hero */}
          <main className="relative z-20 w-full bg-white py-20 md:py-32">
            <div className={contentContainerClass}>
              <motion.header
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-12 max-w-[70rem]"
              >
                <div className={regionClass(isEditing)}>
                  {metadata}
                </div>
                <div className={regionClass(isEditing)}>
                  {title}
                </div>
              </motion.header>

              <motion.article
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`mt-12 w-full ${regionClass(isEditing)}`}
              >
                {body}
              </motion.article>
            </div>
          </main>
        </div>
      );

    case 'title-above':
      return (
        <div className="relative flex min-h-full w-full flex-col bg-white font-sans text-gray-900 selection:bg-brand-gold selection:text-white">
          {/* Content section at top */}
          <main className="relative z-20 w-full bg-white py-20 md:py-32">
            <div className={contentContainerClass}>
              <motion.header
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-12 max-w-[70rem]"
              >
                <div className={regionClass(isEditing)}>
                  {metadata}
                </div>
                <div className={regionClass(isEditing)}>
                  {title}
                </div>
              </motion.header>

              <motion.article
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`mt-12 w-full ${regionClass(isEditing)}`}
              >
                {body}
              </motion.article>
            </div>
          </main>

          {/* Hero image section below */}
          {media && (
            <section className="relative z-10 h-screen min-h-[400px] w-full overflow-hidden bg-black">
              <div className={`absolute inset-0 ${regionClass(isEditing)}`}>
                {media}
              </div>
            </section>
          )}
        </div>
      );

    case 'image-contained':
      return (
        <div className="relative flex min-h-full w-full flex-col bg-white font-sans text-gray-900 shadow-xl selection:bg-brand-gold selection:text-white">
          {/* Content with image below, aligned to text width */}
          <main className="relative z-20 w-full bg-white py-20 md:py-32">
            <div className={contentContainerClass}>
              <motion.header
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-12 max-w-[70rem]"
              >
                <div className={regionClass(isEditing)}>
                  {metadata}
                </div>
                <div className={regionClass(isEditing)}>
                  {title}
                </div>
              </motion.header>

              <motion.article
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`mt-12 w-full ${regionClass(isEditing)}`}
              >
                {body}
              </motion.article>

              {/* Image below, contained width */}
              {media && (
                <div className={`mt-12 w-full ${regionClass(isEditing)}`}>
                  {media}
                </div>
              )}
            </div>
          </main>
        </div>
      );

    case 'sidebar-image-right':
      return (
        <div className="relative flex min-h-full w-full flex-col bg-white font-sans text-gray-900 selection:bg-brand-gold selection:text-white">
          {/* Desktop: two columns; mobile: stacked (image first, then body) */}
          <main className="relative z-20 w-full bg-white py-20 md:py-32">
            <div className={contentContainerClass}>
              {/* Mobile: image first */}
              {media && (
                <div className={`mb-12 w-full md:hidden ${regionClass(isEditing)}`}>
                  <div className="h-[50vh] w-full overflow-hidden rounded-md bg-gray-200">
                    {media}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-12 md:gap-8 md:flex-row">
                {/* Left: title and body (60%) */}
                <div className="flex-1 md:w-[60%]">
                  <motion.header
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-12 max-w-[70rem]"
                  >
                    <div className={regionClass(isEditing)}>
                      {metadata}
                    </div>
                    <div className={regionClass(isEditing)}>
                      {title}
                    </div>
                  </motion.header>

                  <motion.article
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={regionClass(isEditing)}
                  >
                    {body}
                  </motion.article>
                </div>

                {/* Right: image (40%) - desktop only */}
                {media && (
                  <div className={`hidden md:flex md:w-[40%] ${regionClass(isEditing)}`}>
                    <div className="h-[50vh] w-full overflow-hidden rounded-md bg-gray-200">
                      {media}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      );

    case 'sidebar-image-left':
      return (
        <div className="relative flex min-h-full w-full flex-col bg-white font-sans text-gray-900 selection:bg-brand-gold selection:text-white">
          {/* Desktop: two columns (image left, body right); mobile: stacked (image first, then body) */}
          <main className="relative z-20 w-full bg-white py-20 md:py-32">
            <div className={contentContainerClass}>
              {/* Mobile: image first */}
              {media && (
                <div className={`mb-12 w-full md:hidden ${regionClass(isEditing)}`}>
                  <div className="h-[50vh] w-full overflow-hidden rounded-md bg-gray-200">
                    {media}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-12 md:gap-8 md:flex-row">
                {/* Left: image (40%) - desktop only */}
                {media && (
                  <div className={`hidden md:flex md:w-[40%] ${regionClass(isEditing)}`}>
                    <div className="h-[50vh] w-full overflow-hidden rounded-md bg-gray-200">
                      {media}
                    </div>
                  </div>
                )}

                {/* Right: title and body (60%) */}
                <div className="flex-1 md:w-[60%]">
                  <motion.header
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-12 max-w-[70rem]"
                  >
                    <div className={regionClass(isEditing)}>
                      {metadata}
                    </div>
                    <div className={regionClass(isEditing)}>
                      {title}
                    </div>
                  </motion.header>

                  <motion.article
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={regionClass(isEditing)}
                  >
                    {body}
                  </motion.article>
                </div>
              </div>
            </div>
          </main>
        </div>
      );

    default:
      // Fallback to image-above for unknown preset
      return <ArticleLayout preset="image-above" media={media} title={title} metadata={metadata} body={body} isEditing={isEditing} />;
  }
}
