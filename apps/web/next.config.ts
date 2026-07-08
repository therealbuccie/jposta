import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@jposta/ui", "@jposta/types"],
};

export default nextConfig;
