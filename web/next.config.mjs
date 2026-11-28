/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // "standalone" makes VPS deployment easy: node .next/standalone/server.js
  output: 'standalone',
  // deploy/build-web.sh builds into a folder that is not live (.next-a / .next-b) and then switches to it,
  // so visitors never get a half-built site; without the variable everything stays in .next as before
  distDir: process.env.NEXT_DIST_DIR || '.next',
  compress: true,
};
export default nextConfig;
