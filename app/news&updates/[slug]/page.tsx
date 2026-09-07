import { createClient } from '@supabase/supabase-js';
import SingleNewsClient from './newsclient';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

// 1. FIX: In Next.js 15, params is a Promise
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Await the params before extracting the slug
  const resolvedParams = await params;
  const decodedSlug = decodeURIComponent(resolvedParams.slug);
  
  // Fetch basic article info for the SEO tags
  const { data: article } = await supabase
    .from('news_updates')
    .select('title, excerpt, image')
    .ilike('slug', `%${decodedSlug}%`)
    .is('is_archived', null)
    .eq('is_active', true)
    .single();

  if (!article) {
    return {
      title: 'Article Not Found | Golden Topper News',
      description: 'The requested article could not be found.',
    };
  }

  // Fallback description logic to ensure a description always exists
  const metaDescription = article.excerpt 
    ? (article.excerpt.length > 155 ? `${article.excerpt.substring(0, 155)}...` : article.excerpt)
    : `Read the latest updates regarding ${article.title} at Golden Topper.`;

  return {
    title: `${article.title} | Golden Topper News`,
    description: metaDescription,
    openGraph: {
      title: `${article.title} | Golden Topper News`,
      description: metaDescription,
      url: `https://www.goldentopper.vercel.app/news&updates/${resolvedParams.slug}`,
      siteName: 'Golden Topper',
      images: [
        {
          url: article.image || '/images/placeholder.webp',
          width: 1200,
          height: 630,
          alt: article.title,
        }
      ],
      locale: 'en_PH',
      type: 'article',
    },
  };
}

// Revalidate the data cache every 60 seconds
export const revalidate = 60;

// 2. FIX: Same here, params is a Promise
export default async function DynamicNewsPage({ params }: { params: Promise<{ slug: string }> }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Await the params!
  const resolvedParams = await params;
  const decodedSlug = decodeURIComponent(resolvedParams.slug);

  // Fetch the full article payload
  const { data: article, error } = await supabase
    .from('news_updates')
    .select('*')
    .ilike('slug', `%${decodedSlug}%`)
    .is('is_archived', null)
    .eq('is_active', true)
    .single();

  if (error || !article) {
    console.error("Error fetching article data:", error);
    notFound(); // Tells Next.js to render the 404 page
  }

  // Pass the pre-fetched data to the client component
  return <SingleNewsClient initialArticle={article} />;
}