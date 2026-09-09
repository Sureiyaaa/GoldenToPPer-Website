import { createClient } from '@supabase/supabase-js'; 
import HomeClient from './homeclient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Golden Topper',
  description: 'Golden Topper develops prime real estate projects, elevating lifestyles and creating better communities across the Philippines. Discover City Clou, El Sol, and La Vida.',
  openGraph: {
    title: 'Golden Topper | Better City, Better Lives',
    description: 'Discover world-class residential and commercial developments by Golden Topper.',
    url: 'https://www.goldentopper.vercel.app',
    siteName: 'Golden Topper',
    images: [
      {
        url: '/images/landingpage/BDC_Goldentopper.jpg',
        width: 1200,
        height: 630,
        alt: 'Golden Topper Developments',
      }
    ],
    locale: 'en_PH',
    type: 'website',
  },
};

export const revalidate = 60; 

export default async function HomePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 1. Fetch latest news
  const { data: latestNews } = await supabase
    .from('news_updates')
    .select('*')
    .order('date', { ascending: false })
    .limit(4);

  // 2. Fetch virtual tours directly
  const { data: virtualTours, error: toursError } = await supabase
    .from('virtual_tours')
    .select('*')
    .eq('status', 'Active');

  if (toursError) {
    console.error("Failed to fetch virtual tours:", toursError.message);
  }

  // Structure tours into the project format expected by the modal
  const formattedProjects = (virtualTours || []).map((tour: any) => ({
    id: tour.id,
    name: tour.title?.replace(/ units$/i, '').trim(),
    title: tour.title,
    slug: tour.title?.toLowerCase().replace(/\s+/g, '-'),
    virtual_tours: [tour],
  }));
  
  return (
    <HomeClient 
      initialNews={latestNews || []} 
      initialProjects={formattedProjects} 
    />
  );
}