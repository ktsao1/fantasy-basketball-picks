import type { NextConfig } from "next";

// A static dashboard: every page loads the pipeline's JSON in the browser, so it
// doesn't use Cache Components or Partial Prefetching (the create-next-app defaults).
const nextConfig: NextConfig = {};

export default nextConfig;
