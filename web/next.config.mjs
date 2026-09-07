/** @type {import('next').NextConfig} */

// Public Supabase URL is needed in connect-src for client-side reads. Since
// our open-access architecture does NOT call Supabase from the browser, the
// CSP can omit it — but we leave the pattern in so a future feature can
// reach Supabase without rewriting the CSP.
const SUPABASE_HOST = "https://*.supabase.co" +
  (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("http://127.0.0.1:")
    ? ` ${process.env.NEXT_PUBLIC_SUPABASE_URL}` : "");

// A build identifier that is ALWAYS present, computed once per build.
//
// The version-watcher toast compares the build the user's tab is running
// against the build currently serving /api/version; a mismatch means a new
// deploy is live. For that comparison to work the id must (a) exist on every
// deploy and (b) change on every deploy.
//
// A deployment id is the primary identity because it changes even when the
// same Git commit is redeployed. The old commit-first order made those
// deployments indistinguishable and silently suppressed the update prompt.
// The commit SHA remains a fallback for providers that do not expose a
// deployment id, followed by a build-time timestamp for local/self-hosted
// builds. Inlining it via `env` freezes the value into both the client bundle
// and the server, so each deploy's code carries its own immutable id.
const BUILD_ID =
  process.env.VERCEL_DEPLOYMENT_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  `local-${Date.now()}`;

// Always ask the stable production alias which deployment is current. A
// relative /api/version request is ineffective on Vercel's immutable deploy
// URLs (and when Skew Protection pins a session), because it keeps reaching
// the same old deployment forever.
const PRODUCTION_HOST =
  process.env.NEXT_PUBLIC_PRODUCTION_HOST ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  "";
const PRODUCTION_ORIGIN = (
  process.env.SHROOM_PRODUCTION_ORIGIN ||
  (PRODUCTION_HOST
    ? `https://${PRODUCTION_HOST.replace(/^https?:\/\//, "").replace(/\/$/, "")}`
    : "")
).replace(/\/$/, "");
const VERSION_ENDPOINT = PRODUCTION_ORIGIN
  ? `${PRODUCTION_ORIGIN}/api/version`
  : "/api/version";

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
    value: "camera=(self), microphone=(self), geolocation=(), interest-cohort=()",
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
      `img-src 'self' data: blob: ${SUPABASE_HOST}`,
      "font-src 'self' data:",
      `connect-src 'self' ${SUPABASE_HOST} wss://*.supabase.co${PRODUCTION_ORIGIN ? ` ${PRODUCTION_ORIGIN}` : ""}`,
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
  // sharp 0.35 loads libvips dynamically; explicitly trace its Linux shared
  // library into Vercel functions (a macOS-only local run cannot reveal this).
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@img/sharp-libvips-linux-x64/**/*", "./node_modules/@img/sharp-linux-x64/**/*"],
  },
  distDir: process.env.SHROOM_NEXT_DIST_DIR || ".next",
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
  async rewrites() {
    return process.env.NODE_ENV === "development" && process.env.SHROOM_WORKBOOK_DEV_URL
      ? [{ source: "/api/workbook", destination: `${process.env.SHROOM_WORKBOOK_DEV_URL}/api/workbook` }]
      : [];
  },
  images: {
    remotePatterns: [
      ...(process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("http://127.0.0.1:")
        ? [{ protocol: "http", hostname: "127.0.0.1", port: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).port, pathname: "/storage/v1/object/sign/**" }]
        : []),
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/sign/**",
      },
    ],
  },
  // Exposed to client + server bundles so the version-watcher can compare
  // the running build against the deployed one. See BUILD_ID above.
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
    NEXT_PUBLIC_VERSION_ENDPOINT: VERSION_ENDPOINT,
  },
  // Tie Next's own build id to ours so static asset URLs change per deploy too.
  generateBuildId: () => BUILD_ID,
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
