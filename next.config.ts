/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', 
    },
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      // Your REAL Supabase Storage Domain
      {
        protocol: 'https',
        hostname: 'bozkbnqydmpadcbbwpnb.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // TEMPORARY: Allow the fake placeholder URL so the page stops crashing
      {
        protocol: 'https',
        hostname: 'your-supabase-url.com',
      },
    ],
  },
};

export default nextConfig;