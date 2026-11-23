import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // Pin the project root so the build ignores any lockfiles above this folder.
    root: import.meta.dirname,
  },
};

export default nextConfig;
