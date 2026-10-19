-- Add article_layout field to news_updates table
-- Stores layout preset identifier for article rendering
-- Additive migration: defaults to 'image-above' for backward compatibility

ALTER TABLE news_updates
ADD COLUMN article_layout VARCHAR(50) DEFAULT 'image-above'
CONSTRAINT article_layout_valid CHECK (
  article_layout IN ('image-above', 'title-above', 'image-contained', 'sidebar-image-right', 'sidebar-image-left')
);

-- Comment for documentation
COMMENT ON COLUMN news_updates.article_layout IS
  'Article layout preset identifier. Valid values: image-above (full-width image hero above title/body),
   title-above (title/body above full-width image), image-contained (image aligned with text width below body),
   sidebar-image-right (title/body left, image right), sidebar-image-left (image left, title/body right).
   Defaults to image-above for backward compatibility with existing articles.';
