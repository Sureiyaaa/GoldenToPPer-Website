import StoryClient from './storyclient';
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js'; 

export const metadata: Metadata = {
  title: 'Our Story | Golden Topper',
  description: 'Learn about Golden Topper\'s history, mission, and commitment to building better cities and better lives in the Philippines.',
  openGraph: {
    title: 'Our Story | Golden Topper',
    description: 'Discover the legacy and vision behind Golden Topper.',
    url: 'https://www.goldentopper.vercel.app/story',
    siteName: 'Golden Topper',
    images: [
      {
        url: '/images/story/story_bg.png', 
        width: 1200,
        height: 630,
        alt: 'Golden Topper Story',
      }
    ],
    locale: 'en_PH',
    type: 'website',
  },
};

// 1. ADD THIS LINE: Forces the page to fetch fresh data on every load!
export const dynamic = 'force-dynamic';

export default async function StoryPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 2. ADD THE FILTERS: .is('is_archived', null) and .eq('is_active', true)
  const { data: dbMilestones, error } = await supabase
    .from('our story')
    .select('*')
    .is('is_archived', null) // Hides archived milestones
    .eq('is_active', true)   // Hides toggled-off (hidden) milestones
    .order('year', { ascending: true });

  if (error) {
    console.error("Error fetching story data:", error);
  }

  // Map the database columns to the prop names your GSAP client expects
  const milestones = dbMilestones?.map((item) => ({
    year: item.year.toString(), 
    title: item.title,
    desc: item.description,     
    img: item.image             
  })) || [];

  // Pass the dynamic data to the client component
  return <StoryClient milestones={milestones} />;
}