/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // "standalone" makes VPS deployment easy: node .next/standalone/server.js
  output: 'standalone',
};
export default nextConfig;
