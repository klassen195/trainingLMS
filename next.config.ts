import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
