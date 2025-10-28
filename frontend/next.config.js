/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'ai-photo-prod-1379020062.picgz.myqcloud.com',
      'ai-photo-prod-1379020062.cos.ap-guangzhou.myqcloud.com'
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL + '/:path*'
      }
    ];
  }
};

module.exports = nextConfig;
