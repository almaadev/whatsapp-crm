/** @type {import('next').NextConfig} */

const nextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ['http://localhost:3000','nonarsenic-nonparous-clotilde.ngrok-free.dev'],

  experimental: {
    serverActions: {
        allowedOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app"]
    }
  }
};

export default nextConfig;
