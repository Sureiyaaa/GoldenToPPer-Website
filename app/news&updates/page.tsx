import { createClient } from '@supabase/supabase-js'; 
import NewsClient from './newsclient';
import type { Metadata } from 'next';

// Developers: SEO configuration for the News and Updates directory.
export const metadata: Metadata = {
  title: 'News & Updates | Golden Topper',
  description: 'Read the latest announcements, press releases, and updates on Golden Topper properties and community developments.',
  openGraph: {
    title: 'News & Updates | Golden Topper',
    description: 'Stay updated with the latest news and property announcements from Golden Topper.',
    url: 'https://www.goldentopper.vercel.app/news&updates',
    siteName: 'Golden Topper',
    images: [
      {
        url: '/images/news-updates/news_updates_bg.png', 
        width: 1200,
        height: 630,
        alt: 'Golden Topper News and Updates',
      }
    ],
    locale: 'en_PH',
    type: 'website',
  },
};

// Developers: Cache the news feed and automatically regenerate every 60 seconds.
export const revalidate = 60;

export default async function NewsUpdatesPage() {
  // Developers: Utilizing the raw server-side Supabase client to prevent build errors on deployment.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Developers: Fetch the news directly on the server to ensure SEO crawlers can read the content.
  const { data: newsData, error } = await supabase
    .from('news_updates')
    .select('*')
    .is('is_archived', null)
    .eq('is_active', true)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching news on server:', error.message);
  }

  return <NewsClient initialNews={newsData || []} />;
}