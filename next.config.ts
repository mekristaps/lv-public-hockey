import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

// const withSerwist = withSerwist({
//   swSrc: "app/sw.ts", // Point to your service worker file
//   swDest: "public/sw.js",
//   disable: process.env.NODE_ENV === "development",
// });

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
};

export default withSerwist(nextConfig);
