import PaymentClient from './paymentclient';
import type { Metadata } from 'next';

// Developers: SEO configuration for the Payment gateway page.
export const metadata: Metadata = {
  title: 'Online Payment | Golden Topper',
  description: 'Securely process your real estate payments, downpayments, and reservation fees for Golden Topper properties via our secure payment gateway.',
  openGraph: {
    title: 'Online Payment | Golden Topper',
    description: 'Securely process your real estate payments for Golden Topper properties.',
    url: 'https://www.goldentopper.vercel.app/payment',
    siteName: 'Golden Topper',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=1200&auto=format&fit=crop',
        width: 1200,
        height: 630,
        alt: 'Golden Topper Online Payment',
      }
    ],
    locale: 'en_PH',
    type: 'website',
  },
};

export default function PaymentPage() {
  return <PaymentClient />;
}