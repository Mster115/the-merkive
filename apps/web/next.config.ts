import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@merky/game-sdk", "@merky/games", "@merky/ui"],
  eslint: { ignoreDuringBuilds: true },
  // Two dev servers (or a build racing a dev server) sharing .next corrupt
  // each other; MB_DIST_DIR lets a second instance use its own output dir.
  distDir: process.env.MB_DIST_DIR || ".next",
  // The server minifier breaks the prerender of "/" with a webpack-runtime
  // TypeError (dev and unminified prod are fine). Server-side only — no
  // client bundle impact.
  experimental: { serverMinification: false },
};

export default nextConfig;
