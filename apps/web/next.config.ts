import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@merky/game-sdk", "@merky/games", "@merky/ui"],
  eslint: { ignoreDuringBuilds: true },
  // The server minifier breaks the prerender of "/" with a webpack-runtime
  // TypeError (dev and unminified prod are fine). Server-side only — no
  // client bundle impact.
  experimental: { serverMinification: false },
};

export default nextConfig;
