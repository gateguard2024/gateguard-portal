/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.eagleeyenetworks.com" },
      { protocol: "https", hostname: "*.brivo.com" },
    ],
  },
};

export default nextConfig;
