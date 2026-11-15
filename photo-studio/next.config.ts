import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@google/genai", "@electric-sql/pglite", "pg"],
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
