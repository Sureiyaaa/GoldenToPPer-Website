-- Add article_sections JSONB column for repeatable section-based layouts
-- Additive, non-breaking change; legacy columns (article_content, article_layout, excerpt) preserved
-- Section structure: { version: 1, sections: [...], createdAt, updatedAt }
-- Application validates structure; no database constraint applied

ALTER TABLE public.news_updates
ADD COLUMN IF NOT EXISTS article_sections JSONB DEFAULT NULL;

-- Constraint: Validation deferred to application layer for flexibility
