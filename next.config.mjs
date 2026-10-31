/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a self-contained server in .next/standalone for the Docker image
  output: "standalone",
  images: {
    // AVIF first, falling back to WebP, for browsers that support them
    formats: ["image/avif", "image/webp"],
    // Only these local paths can go through the image optimiser
    localPatterns: [
      { pathname: "/images/**", search: "" },
      { pathname: "/uploads/**", search: "" },
    ],
  },
  async headers() {
    return [
      {
        // Belt and braces alongside the noindex meta tags
        source: "/:path(admin|portal)/:rest*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
