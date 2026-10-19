-- Presentation setting only; keep the image available to cards and social metadata.
ALTER TABLE public.news_updates
ADD COLUMN IF NOT EXISTS show_cover_on_article BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.news_updates.show_cover_on_article IS
'Display the featured cover on the article detail page. Does not affect the image asset, cards, or section images.';
