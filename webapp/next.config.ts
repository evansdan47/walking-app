import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),  // prevent Next.js from walking parent lockfiles
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@convex": path.resolve(__dirname, "./convex"),
    };
    return config;
  },
};

export default nextConfig;
