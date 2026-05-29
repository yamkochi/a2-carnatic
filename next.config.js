/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true, // 🔴 This turns on the "use server" feature flag
  },
  // Keep any other existing configuration settings below if you have them
}

module.exports = nextConfig
