import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The recommend route reads these at request time; make sure Vercel ships them.
  outputFileTracingIncludes: {
    "/api/recommend": ["./data/*.json", "./recommend_prompt.md"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
