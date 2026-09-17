import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  // sharp@0.35+ libvips .so is often missing from Vercel/Turbopack traces; keep the linux package in the bundle.
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
    ],
  },
  async redirects() {
    return [
      { source: "/courses", destination: "/programs", permanent: true },
      { source: "/courses/:id", destination: "/programs/:id", permanent: true },
      {
        source: "/courses/:id/lessons/:moduleId",
        destination: "/programs/:id/modules/:moduleId",
        permanent: true,
      },
      { source: "/instructor/courses/new", destination: "/instructor/programs/new", permanent: true },
      {
        source: "/instructor/courses/:id/edit",
        destination: "/instructor/programs/:id/edit",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
