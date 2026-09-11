import { createClient } from '@supabase/supabase-js';
import InquireClient from './inquireclient';
import type { Metadata } from 'next';
import { Suspense } from 'react';

// ============================================================
// SEO CONFIGURATION
// ============================================================

export const metadata: Metadata = {
  title: 'Inquire Now | Golden Topper',

  description:
    'Register your interest in Golden Topper properties. Get exclusive floor plans, pricing details, and priority viewing opportunities.',

  openGraph: {
    title: 'Inquire Now | Golden Topper',

    description:
      'Register your interest in premium real estate developments by Golden Topper.',

    url: 'https://www.goldentopper.vercel.app/inquire',

    siteName: 'Golden Topper',

    images: [
      {
        url: '/images/inquire/building1.webp',
        width: 1200,
        height: 630,
        alt: 'Golden Topper Property Inquiry',
      },
    ],

    locale: 'en_PH',
    type: 'website',
  },
};

// Revalidate project data every 60 seconds
export const revalidate = 60;

// ============================================================
// INQUIRE PAGE
// ============================================================

export default async function InquirePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ============================================================
  // FETCH ACTIVE PROJECTS
  // ============================================================

  const { data: projects, error } = await supabase
    .from('project_table')
    .select('id, title')
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('title', { ascending: true });

  // ============================================================
  // ERROR LOGGING
  // ============================================================

  if (error) {
    console.error('Failed to load projects:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <Suspense fallback={null}>
      <InquireClient projects={projects || []} />
    </Suspense>
  );
}