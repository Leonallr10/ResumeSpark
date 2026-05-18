import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/portfolio-generate",
        destination: "/portfolio-generator",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
