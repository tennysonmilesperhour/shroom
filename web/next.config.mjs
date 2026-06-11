/** @type {import('next').NextConfig} */

// Public Supabase URL is needed in connect-src for client-side reads. Since
// our open-access architecture does NOT call Supabase from the browser, the
// CSP can omit it — but we leave the pattern in so a future feature can
// reach Supabase without rewriting the CSP.
const SUPABASE_HOST = "https://*.supabase.co";

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js requires inline scripts for its runtime hydration boot.
      // Without a nonce-pipeline (middleware) this is the practical choice.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Inline style attributes are used throughout the React tree.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src 'self' ${SUPABASE_HOST} wss://*.supabase.co`,
      // Truth Source embeds live Google Sheets in <iframe>s; without an
      // explicit frame-src this falls back to default-src 'self' and the
      // embeds are blocked.
      "frame-src 'self' https://docs.google.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
