import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
  async rewrites() {
    // Default to same-origin (empty string) for production behind reverse proxy.
    // Override with API_BASE_URL=http://localhost:3001 in .env.local for development.
    const apiBaseUrl =
      process.env.API_BASE_URL || "";

    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;