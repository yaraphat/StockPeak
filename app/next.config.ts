import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Block framing (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Basic XSS protection for old browsers
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // Don't send referrer to external sites
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features not needed
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS — enforce HTTPS (1 year, include subdomains)
  // Only sent over HTTPS; harmless if served on HTTP locally
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  headers: async () => [
    {
      // Apply to all routes
      source: "/:path*",
      headers: securityHeaders,
    },
  ],
};

export default nextConfig;
