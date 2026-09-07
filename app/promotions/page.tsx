import { createClient } from '@supabase/supabase-js'; 
import PromotionsClient from './promotionsclient';
import type { Metadata } from 'next';

// SEO Configuration for the Promotions Directory
export const metadata: Metadata = {
  title: 'Exclusive Promos | Golden Topper',
  description: 'Discover curated real estate investments and exclusive promotional offers from Golden Topper across the Philippines.',
  openGraph: {
    title: 'Exclusive Promos | Golden Topper',
    description: 'Discover curated real estate investments and exclusive promotional offers from Golden Topper.',
    url: 'https://www.goldentopper.vercel.app/promotions',
    siteName: 'Golden Topper',
    images: [
      {
        url: '/images/landingpage/BDC_Goldentopper.jpg',
        width: 1200,
        height: 630,
        alt: 'Golden Topper Promotions',
      }
    ],
    locale: 'en_PH',
    type: 'website',
  },
};

export const revalidate = 60; 

export default async function PromotionsPage() {
  // Utilizing the raw supabase-js client to ensure build stability on the server
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: promotions, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('is_active', true)
    // .is('deleted_at', null) // Uncomment if you are using soft deletes on promotions
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching promotions on server:', error);
  }

  // Format the DB fields to match what your PromotionsClient interface expects
  const formattedPromotions = (promotions || []).map((promo) => ({
    id: promo.id,
    title: promo.title,
    // Safely generating a slug from the title since we removed the actual slug field from the DB
    slug: promo.title ? promo.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '',
    tag: promo.status || "Special Offer", 
    validUntil: promo.validity_date, 
    image: promo.image || '/images/placeholder.webp',
    excerpt: promo.description, 
  }));

  return <PromotionsClient initialPromotions={formattedPromotions} />;
}