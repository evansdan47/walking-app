import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root to the webapp directory so Turbopack doesn't
    // crawl the parent monorepo (Expo app, android/, node_modules, etc.)
    // and exhaust memory on Windows.
    root: __dirname,
    // Alias @convex to the local generated copy inside webapp/convex.
    // (Using ../convex would be outside turbopack.root and fail to resolve.)
    resolveAlias: {
      "@convex": path.resolve(__dirname, "./convex"),
    },
  },
};

export default nextConfig;
