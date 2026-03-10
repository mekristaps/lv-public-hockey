// import { withSerwist } from "@serwist/turbopack";
// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   reactCompiler: true,
//   // @ts-ignore - Serwist injects these properties into the NextConfig type at runtime
//   swSrc: "app/sw.ts",
//   swDest: "public/sw.js",
//   disable: false, // Set to false so we can actually test on localhost
// };

// export default withSerwist(nextConfig);

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
