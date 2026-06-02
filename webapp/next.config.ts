import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname, '..'),  // monorepo root — sets relativeAppDir so Vercel finds the build output
  turbopack: {
    resolveAlias: {
      "@convex": "./convex",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@convex": path.resolve(__dirname, "./convex"),
    };
    return config;
  },
};

export default nextConfig;
