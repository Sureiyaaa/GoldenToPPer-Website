import TermsClient from './termsclient';
import type { Metadata } from 'next';

// Developers: SEO and Open Graph configuration for the Terms of Use page.
export const metadata: Metadata = {
  title: 'Terms of Use | Golden Topper',
  description: 'Read the Golden Topper Terms of Use to understand the rules and guidelines for using our website and services.',
  openGraph: {
    title: 'Terms of Use | Golden Topper',
    description: 'Understand the terms and conditions for using Golden Topper digital platforms.',
    url: 'https://www.goldentopper.vercel.app/terms-of-use',
    siteName: 'Golden Topper',
    images: [
      {
        url: '/images/terms/building1.webp',
        width: 1200,
        height: 630,
        alt: 'Golden Topper Terms of Use',
      }
    ],
    locale: 'en_PH',
    type: 'website',
  },
};

export default function TermsOfUsePage() {
  return <TermsClient />;
}