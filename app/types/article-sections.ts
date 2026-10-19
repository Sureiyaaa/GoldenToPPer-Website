import { parseArticleContent, type TiptapDoc } from '@/lib/rendering/article-content';

/**
 * Article Sections Model
 * Supports repeatable sections with independent layouts, headings, images, and body content
 */

export type SectionLayout =
  | 'image-above'      // Image full-width above body
  | 'image-below'      // Image full-width below body
  | 'image-contained'  // Legacy: render as Image Below
  | 'image-left'       // Image left (40%), body right (60%)
  | 'image-right'      // Body left (60%), image right (40%)
  | 'text-only';       // Legacy: standard paragraph width, stored image stays hidden

export type SectionImagePlacement = Exclude<SectionLayout, 'image-contained' | 'text-only'>;

/** Resolve presentation without changing legacy values or revealing hidden images. */
export function getSectionImagePlacement(layout: SectionLayout): SectionImagePlacement | null {
  if (layout === 'text-only') return null;
  return layout === 'image-contained' ? 'image-below' : layout;
}

export interface ArticleSection {
  id: string;                    // Stable UUID for editor identity
  heading?: string;              // Optional section heading
  headingEnabled: boolean;       // Whether to display heading (preserve text when disabled)
  layout: SectionLayout;         // Section layout preset
  body: Record<string, any>;     // Tiptap JSON document (rich text)
  image?: string;                // Optional section image URL
  order: number;                 // Display order within article
}

export interface ArticleSectionsDocument {
  version: 1;
  sections: ArticleSection[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Legacy article content adapted as initial section (in-memory only, not persisted)
 * Allows articles to use sections model without migration of existing content
 */
export interface LegacyArticleAdapter {
  title: string;
  excerpt: string;
  article_content?: Record<string, any> | string | null;
  image?: string | null;
  article_layout?: string;
}

/**
 * Suggested word count thresholds for guidance (non-blocking)
 */
export const SECTION_LENGTH_GUIDANCE = {
  min: 50,        // Suggest minimum for better readability
  typical: 300,   // Typical section length
  max: 800,       // Suggest maximum for clarity (not enforced)
} as const;

/**
 * Convert legacy article to sections model (in-memory, non-persisting)
 * Adapts existing article_content or excerpt into an initial section
 */
export function adaptLegacyArticleToSections(
  legacy: LegacyArticleAdapter
): ArticleSectionsDocument {
  const id = `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Use article_content if available (rich text), otherwise excerpt (plain text)
  const body = parseArticleContent((legacy.article_content as TiptapDoc | string | null) || legacy.excerpt);

  // Images are optional; newly adapted sections use a supported placement.
  const layout: SectionImagePlacement = 'image-above';

  const section: ArticleSection = {
    id,
    heading: undefined,
    headingEnabled: false,
    layout,
    body,
    image: legacy.image || undefined,
    order: 0,
  };

  const now = new Date().toISOString();
  return {
    version: 1,
    sections: [section],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Validate section structure
 */
export function isValidSection(section: any): section is ArticleSection {
  return (
    section &&
    typeof section === 'object' &&
    typeof section.id === 'string' &&
    section.id.length > 0 &&
    typeof section.headingEnabled === 'boolean' &&
    typeof section.layout === 'string' &&
    isValidSectionLayout(section.layout) &&
    section.body &&
    typeof section.body === 'object' &&
    typeof section.order === 'number'
  );
}

export function isValidSectionLayout(value: any): value is SectionLayout {
  const validLayouts: SectionLayout[] = [
    'image-above',
    'image-below',
    'image-contained',
    'image-left',
    'image-right',
    'text-only',
  ];
  return validLayouts.includes(value);
}

/**
 * Validate sections document
 */
export function isValidSectionsDocument(doc: any): doc is ArticleSectionsDocument {
  return (
    doc &&
    typeof doc === 'object' &&
    doc.version === 1 &&
    Array.isArray(doc.sections) &&
    doc.sections.every((s: any) => isValidSection(s)) &&
    typeof doc.createdAt === 'string' &&
    typeof doc.updatedAt === 'string'
  );
}

/**
 * Derive plain-text excerpt from sections for backward compatibility
 * Takes first non-empty paragraph from first section
 */
export function deriveExcerptFromSections(doc: ArticleSectionsDocument): string {
  for (const section of doc.sections) {
    if (section.body && section.body.content) {
      for (const block of section.body.content) {
        if (block.type === 'paragraph' && block.content) {
          let text = '';
          for (const inline of block.content) {
            if (inline.type === 'text') {
              text += inline.text || '';
            }
          }
          if (text.trim()) return text.substring(0, 200); // Excerpt limit
        }
      }
    }
  }
  return '';
}
