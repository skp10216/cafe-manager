/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@cafe-manager/core'],
  experimental: {
    optimizePackageImports: ['@mui/icons-material', '@mui/material'],
  },
};

module.exports = nextConfig;




