import { createClient } from '@supabase/supabase-js'; 
import HomeClient from './homeclient';
import type { Metadata } from 'next';

// SEO: This tells Google and Social Media exactly what homepage is
export const metadata: Metadata = {
  title: 'Golden Topper',
  description: 'Golden Topper develops prime real estate projects, elevating lifestyles and creating better communities across the Philippines. Discover City Clou, El Sol, and La Vida.',
  openGraph: {
    title: 'Golden Topper | Better City, Better Lives',
    description: 'Discover world-class residential and commercial developments by Golden Topper.',
    url: 'https://www.goldentopper.vercel.app', // Update this when we get the domain
    siteName: 'Golden Topper',
    images: [
      {
        url: '/images/landingpage/BDC_Goldentopper.jpg', // This image will show on Facebook/Twitter links
        width: 1200,
        height: 630,
        alt: 'Golden Topper Developments',
      }
    ],
    locale: 'en_PH',
    type: 'website',
  },
};

// CACHING: Rebuilds the page every 60 seconds if data changes
export const revalidate = 60; 

export default async function HomePage() {
  // PERFORMANCE FIX: Use the raw supabase-js client for Server Components 
  // so it doesn't look for browser cookies and crash during Vercel's build process.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Fetch the data on the server instantly
  const { data: latestNews, error } = await supabase
    .from('news_updates')
    .select('*')
    .order('date', { ascending: false })
    .limit(4);

  if (error) {
    console.error("Failed to fetch news on server:", error.message);
  }
  
  return <HomeClient initialNews={latestNews || []} />;
}