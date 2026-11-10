/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Set output file tracing root to silence workspace root warning
  outputFileTracingRoot: require('path').join(__dirname),
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
  // Suppress WebSocket HMR warnings in production-like environments
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Suppress WebSocket connection errors for HMR
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        { module: /use-websocket/ },
      ];
    }
    return config;
  },
  // Disable dev indicators if not in development
  devIndicators: {
    buildActivity: process.env.NODE_ENV === 'development',
  },
  // Add turbopack config to fix workspace root inference
  // We're using webpack explicitly for production builds
  turbopack: {
    root: require('path').resolve(__dirname),
  },
  async rewrites() {
    return [
      {
        source: '/api-docs/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api-docs/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

