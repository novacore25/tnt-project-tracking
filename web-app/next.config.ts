import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    staleTimes: {
      dynamic: 300, // 5 menit cache untuk Server Components dinamis
      static: 1800,
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
