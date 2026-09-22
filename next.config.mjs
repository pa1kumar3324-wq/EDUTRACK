/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
  },
  async headers() {
    // Content-Security-Policy sources, beyond 'self':
    //  - *.supabase.co: the Supabase project's REST/Auth/Storage/Realtime API
    //    (connect-src) and avatar/asset URLs served from Storage (img-src).
    //  - api.dicebear.com: generated fallback avatars (img-src).
    //  - generativelanguage.googleapis.com: Tsareena's direct
    //    browser-to-Gemini calls (connect-src) — see components/ai/geminiClient.ts.
    // If you tighten this further, re-verify the Tsareena chat flow and
    // avatar images still load — an overly strict CSP will silently break both.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://api.dicebear.com",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    const securityHeaders = [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      },
    ];

    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
