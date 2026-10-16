-- Add article_content field to news_updates table
-- Stores rich text document for formatted articles (Tiptap JSON schema)
-- Nullable; existing articles have NULL (fall back to plain excerpt)

ALTER TABLE news_updates
ADD COLUMN article_content JSONB DEFAULT NULL;

-- Comment for documentation
COMMENT ON COLUMN news_updates.article_content IS 'Rich text article content in Tiptap JSON format. NULL for plain-text articles. Always kept in sync with excerpt field.';
