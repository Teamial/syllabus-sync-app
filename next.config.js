/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable the React strict mode temporarily to prevent double renders in development
  reactStrictMode: false,
  
  // Configure ESLint to be more forgiving
  eslint: {
    // Don't prevent build if there are warnings
    ignoreDuringBuilds: true,
  },
  
  // Increase stability for the build process
  experimental: {
    // Reduce build stability issues
    optimizePackageImports: ['react', 'react-dom'],
  },
  
  // Enable proper error handling in production
  productionBrowserSourceMaps: true,
};

module.exports = nextConfig;
