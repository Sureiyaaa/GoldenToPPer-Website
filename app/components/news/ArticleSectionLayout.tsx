import type { ReactNode } from 'react';
import { getSectionImagePlacement, type SectionLayout } from '@/app/types/article-sections';

interface ArticleSectionLayoutProps {
  layout: SectionLayout;
  heading: ReactNode;
  body: ReactNode;
  image: ReactNode;
}

// Keep the same keyed text/editor subtree when placement changes.
// Legacy text-only images remain stored but hidden until a placement is chosen.
export function ArticleSectionLayout({ layout, heading, body, image }: ArticleSectionLayoutProps) {
  const placement = getSectionImagePlacement(layout);
  const showImage = Boolean(image && placement);
  const media = showImage ? <div key="image" className="news-section-media">{image}</div> : null;
  const text = <div key="text" className="news-section-text">{heading}{body}</div>;

  return (
    <section className="news-article-section w-full border-b border-gray-100 last:border-b-0">
      <div className="mx-auto max-w-[85rem] px-6 md:px-12">
        <div className="news-section-layout" data-image-placement={showImage ? placement : 'none'}>
          {placement === 'image-below' ? [text, media] : [media, text]}
        </div>
      </div>
    </section>
  );
}
