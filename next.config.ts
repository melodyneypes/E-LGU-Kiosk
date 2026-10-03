import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.10.181",
    "100.125.65.69",
    "superradical-hairy-samir.ngrok-free.dev",
    "msi-eulysis",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ofxkeckgfxdthonilpfk.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "bweqpzpmpxkczajorinb.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "e-lgu.vercel.app",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
