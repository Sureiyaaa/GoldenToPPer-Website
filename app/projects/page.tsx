import { createClient } from '@supabase/supabase-js'; 
import ProjectsClient from './projectsclient';
import type { Metadata } from 'next';

// SEO Configuration for the Projects Directory
export const metadata: Metadata = {
  title: 'Our Projects | Golden Topper',
  description: 'Explore Golden Topper\'s premium real estate developments across the Philippines, including pre-selling and ready-for-occupancy properties.',
  openGraph: {
    title: 'Our Projects | Golden Topper',
    description: 'Explore premium residential and commercial real estate developments by Golden Topper.',
    url: 'https://www.goldentopper.vercel.app/projects',
    siteName: 'Golden Topper',
    images: [
      {
        url: '/images/landingpage/BDC_Goldentopper.jpg',
        width: 1200,
        height: 630,
        alt: 'Golden Topper Projects Directory',
      }
    ],
    locale: 'en_PH',
    type: 'website',
  },
};

export const revalidate = 60; 

export default async function ProjectsPage() {
  // Utilizing the raw supabase-js client to ensure build stability on the server
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from('project_table')
    .select(`
      *,
      unit_layout (title),
      project_tag (tags (tag_name)),
      virtual_tours (rooms, status) 
    `)
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching projects on server:', error);
  }

  const serializedProjects = (data || []).map((item: any) => ({
    id: item.id,
    name: item.title, 
    address: item.address,
    city: item.city,
    slug: item.slug,
    image: item.image || '/images/placeholder.webp',
    proximity: item.proximity,
    statusText: item.status || "Pre-Selling",
    tags: item.project_tag?.map((pt: any) => pt.tags.tag_name) || [],
    units: [...new Set((item.unit_layout || []).map((u: any) => u.title))] as string[],
    
    // Pass the 360 tour data and the old fallback url
    virtual_tours: item.virtual_tours?.filter((tour: any) => tour.status === 'Active') || [],
    virtual_tour_url: item.virtual_tour_url || null
  }));

  return <ProjectsClient initialProjects={serializedProjects} />;
}