import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  // Pin the monorepo root so a stray lockfile higher up (e.g. in the home folder) is ignored.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@errand/core"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default config;
