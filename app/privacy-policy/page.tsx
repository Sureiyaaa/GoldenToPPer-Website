import PrivacyClient from './privacyclient';
import type { Metadata } from 'next';

// Developers: SEO and Open Graph configuration for the Privacy Policy page.
export const metadata: Metadata = {
  title: 'Privacy Policy | Golden Topper',
  description: 'Read the Golden Topper Privacy Policy to understand how we collect, use, and protect your personal information.',
  openGraph: {
    title: 'Privacy Policy | Golden Topper',
    description: 'Learn how Golden Topper protects your data and privacy.',
    url: 'https://www.goldentopper.vercel.app/privacy-policy',
    siteName: 'Golden Topper',
    images: [
      {
        url: '/images/privacy/building1.webp',
        width: 1200,
        height: 630,
        alt: 'Golden Topper Privacy Policy',
      }
    ],
    locale: 'en_PH',
    type: 'website',
  },
};

export default function PrivacyPolicyPage() {
  return <PrivacyClient />;
}