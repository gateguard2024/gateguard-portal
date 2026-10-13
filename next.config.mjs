/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.eagleeyenetworks.com" },
      { protocol: "https", hostname: "*.brivo.com" },
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
    ],
  },
  experimental: {
    // Keep pdfkit out of the webpack bundle so its built-in AFM font metrics
    // (Helvetica.afm, etc.) resolve from node_modules at runtime instead of a
    // webpack chunk — fixes "ENOENT … chunks/data/Helvetica.afm" on Vercel.
    serverComponentsExternalPackages: ["pdfkit"],
    // And make sure those font-metric files are actually shipped in the function.
    outputFileTracingIncludes: {
      "/api/**": ["./node_modules/pdfkit/js/data/*.afm"],
    },
  },
};

export default nextConfig;
