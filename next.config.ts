import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ...(process.env.NEXT_PUBLIC_KSS_STAGE === "staging"
        ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]
        : []),
    ] }];
  },
};

export default nextConfig;
