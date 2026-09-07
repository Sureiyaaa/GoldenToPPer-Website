import ContactClient from './contactclient';
import type { Metadata } from 'next';

// Developers: SEO and Open Graph configuration for the Contact page.
export const metadata: Metadata = {
  title: 'Contact Us | Golden Topper',
  description: 'Get in touch with Golden Topper. Our advisors are ready to guide you through our portfolio of premium residences and strategic investments.',
  openGraph: {
    title: 'Contact Us | Golden Topper',
    description: 'Connect with Golden Topper for inquiries regarding our premium real estate properties.',
    url: 'https://www.goldentopper.vercel.app/contact',
    siteName: 'Golden Topper',
    images: [
      {
        url: '/images/landingpage/BDC_Goldentopper.jpg', // Utilizing a generic high-quality fallback image
        width: 1200,
        height: 630,
        alt: 'Contact Golden Topper',
      }
    ],
    locale: 'en_PH',
    type: 'website',
  },
};

export default function ContactPage() {
  return <ContactClient />;
}