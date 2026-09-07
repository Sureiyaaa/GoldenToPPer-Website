import { createClient } from '@supabase/supabase-js';
import PartnerBanksClient from './partnerbanksclient';
import type { Metadata } from 'next';

// SEO Configuration for the Partner Banks Directory
export const metadata: Metadata = {
  title: 'Partner Banks & Financing | Golden Topper',
  description: 'Explore Golden Topper\'s network of accredited partner banks. Apply for a home loan and discover flexible financing terms for your real estate investment.',
  openGraph: {
    title: 'Partner Banks & Financing | Golden Topper',
    description: 'Secure your dream property with flexible financing options from our accredited bank partners.',
    url: 'https://www.goldentopper.vercel.app/partnerbanks',
    siteName: 'Golden Topper',
    images: [
      {
        url: '/images/banks-partner/partner-banks-cover.webp',
        width: 1200,
        height: 630,
        alt: 'Golden Topper Partner Banks',
      }
    ],
    locale: 'en_PH',
    type: 'website',
  },
};

// 🚨 FIX 1: Force dynamic rendering so when you click the Eye icon in Admin, it updates instantly!
export const dynamic = 'force-dynamic';

export default async function PartnerBanksPage() {
  // Use the raw supabase-js client to prevent browser API dependencies from crashing the server build
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    // Run all 3 queries concurrently to minimize server execution time
    const [projectsRes, banksRes, mappingsRes] = await Promise.all([
      // 🚨 FIX 2: Added .eq('is_active', true) to the project_table query
      supabase.from('project_table').select('id, title, status').is('deleted_at', null).eq('is_active', true),
      supabase.from('banks').select('*').is('is_archived', null).eq('is_active', true),
      supabase.from('project_banks').select('project_id, banks_id')
    ]);

    if (projectsRes.error) throw projectsRes.error;
    if (banksRes.error) throw banksRes.error;
    if (mappingsRes.error) throw mappingsRes.error;

    return (
      <PartnerBanksClient 
        initialProjects={projectsRes.data || []}
        initialBanks={banksRes.data || []}
        initialMappings={mappingsRes.data || []}
      />
    );
  } catch (err) {
    console.error("Error fetching Partner Banks data on server:", err);
    // Fallback to empty arrays to prevent unhandled runtime exceptions on the client
    return <PartnerBanksClient initialProjects={[]} initialBanks={[]} initialMappings={[]} />;
  }
}