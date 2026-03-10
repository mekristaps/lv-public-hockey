import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from your Supabase project
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vupeizosyzxyvzcwqcoo.supabase.co',
      },
    ],
  },
  // Ensure the Deno code in /supabase doesn't break the Next.js build
  typescript: {
    ignoreBuildErrors: true, 
  },
};

export default nextConfig;