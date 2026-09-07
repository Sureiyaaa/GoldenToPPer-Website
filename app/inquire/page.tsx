import { createClient } from '@supabase/supabase-js';
import InquireClient from './inquireclient';
import type { Metadata } from 'next';

// Developers: SEO configuration for the Inquiry page.
export const metadata: Metadata = {
  title: 'Inquire Now | Golden Topper',
  description: 'Register your interest in Golden Topper properties. Get exclusive floor plans, pricing details, and priority viewing opportunities.',
  openGraph: {
    title: 'Inquire Now | Golden Topper',
    description: 'Register your interest in premium real estate developments by Golden Topper.',
    url: 'https://www.goldentopper.vercel.app/inquire',
    siteName: 'Golden Topper',
    images: [
      {
        url: '/images/inquire/building1.webp',
        width: 1200,
        height: 630,
        alt: 'Golden Topper Property Inquiry',
      }
    ],
    locale: 'en_PH',
    type: 'website',
  },
};

// Rebuild this page in the background every 60 seconds so the dropdown is always up to date
export const revalidate = 60;

export default async function InquirePage() {
  // Fetch live active projects from Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: projects } = await supabase
    .from('project_table')
    .select('id, title')
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('title', { ascending: true });

  return <InquireClient projects={projects || []} />;
}