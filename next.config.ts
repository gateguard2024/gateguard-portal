import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.eagleeyenetworks.com" },
      { protocol: "https", hostname: "*.brivo.com" },
    ],
  },
};

export default nextConfig;
