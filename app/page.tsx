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

  // 2. Fetch projects with joined virtual tours
  const { data: projectsData, error: projectsError } = await supabase
    .from('project_table')
    .select(`
      id,
      title,
      slug,
      image,
      virtual_tours (*)
    `)
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('id', { ascending: true });

  if (projectsError) {
    console.error("Failed to fetch projects with tours:", projectsError.message);
  }

  // Format projects with their active virtual tours
  const formattedProjects = (projectsData || []).map((project: any) => ({
    id: project.id,
    name: project.title,
    title: project.title,
    slug: project.slug,
    virtual_tours: (project.virtual_tours || []).filter(
      (tour: any) => tour.status === 'Active'
    ),
  }));
  
  return (
    <HomeClient 
      initialNews={latestNews || []} 
      initialProjects={formattedProjects} 
    />
  );
}