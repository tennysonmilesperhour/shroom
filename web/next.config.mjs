/** @type {import('next').NextConfig} */

// Public Supabase URL is needed in connect-src for client-side reads. Since
// our open-access architecture does NOT call Supabase from the browser, the
// CSP can omit it — but we leave the pattern in so a future feature can
// reach Supabase without rewriting the CSP.
const SUPABASE_HOST = "https://*.supabase.co";

// A build identifier that is ALWAYS present, computed once per build.
//
// The version-watcher toast compares the build the user's tab is running
// against the build currently serving /api/version; a mismatch means a new
// deploy is live. For that comparison to work the id must (a) exist on every
// deploy and (b) change on every deploy.
//
// We deliberately do NOT rely solely on VERCEL_GIT_COMMIT_SHA: it is only
// populated when a project has "Automatically expose System Environment
// Variables" enabled, and is empty otherwise — which silently disabled the
// whole feature. We fall back to the Vercel deployment id, then to a
// build-time timestamp for local/self-hosted builds. Inlining it via `env`
// freezes the value into both the client bundle and the server, so each
// deploy's code carries its own immutable id.
const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  `local-${Date.now()}`;

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
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig = {
  // Exposed to client + server bundles so the version-watcher can compare
  // the running build against the deployed one. See BUILD_ID above.
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
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
