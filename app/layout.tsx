import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import CookieConsentProvider from './components/cookie-consent';

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Golden Topper",
  description: "Better Cities, Better Lives",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en"> 
      {/* Add font-sans here to set the default */}
      <body className={`${poppins.variable} font-sans antialiased`}>
        <CookieConsentProvider>{children}</CookieConsentProvider>
      </body>
    </html>
  );
}
