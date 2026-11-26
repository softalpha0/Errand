import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  // Pin the monorepo root so a stray lockfile higher up (e.g. in the home folder) is ignored.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@errand/core", "@errand/celo"],
  poweredByHeader: false,
  // packages/celo uses NodeNext-style ".js" imports for ".ts" files; let webpack resolve them.
  webpack(config) {
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"], ...(config.resolve.extensionAlias ?? {}) };
    return config;
  },
  // errand-pearl.vercel.app (the SERV Hackathon 02 site) now forwards to the one Errand site.
  async redirects() {
    return [{ source: "/:path*", has: [{ type: "host", value: "errand-pearl.vercel.app" }], destination: "https://errand-thgw.vercel.app/:path*", permanent: true }];
  },
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
