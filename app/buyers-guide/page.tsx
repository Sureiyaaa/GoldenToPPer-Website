import BuyersGuideClient from './guideclient';
import type { Metadata } from 'next';

// Developers: SEO and Open Graph configuration for the Buyer's Guide page.
export const metadata: Metadata = {
  title: 'Buyer\'s Guide | Golden Topper',
  description: 'Navigate the property buying process with ease. Learn about unit selection, reservation requirements, payment terms, and turnover guidelines.',
  openGraph: {
    title: 'Buyer\'s Guide | Golden Topper',
    description: 'Expert tips and valuable insights to help you make informed real estate purchasing decisions.',
    url: 'https://www.goldentopper.vercel.app/buyers-guide',
    siteName: 'Golden Topper',
    images: [
      {
        url: '/images/buyers-guide/buyers-guide.webp',
        width: 1200,
        height: 630,
        alt: 'Golden Topper Buyer\'s Guide',
      }
    ],
    locale: 'en_PH',
    type: 'website',
  },
};

export default function BuyersGuidePage() {
  return <BuyersGuideClient />;
}