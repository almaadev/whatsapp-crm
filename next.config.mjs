/** @type {import('next').NextConfig} */
<<<<<<< HEAD
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  
=======

const nextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ['http://localhost:3000','nonarsenic-nonparous-clotilde.ngrok-free.dev'],

  experimental: {
    serverActions: {
        allowedOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app"]
    }
  }
>>>>>>> c1be5bc (Initial commit from new system)
};

export default nextConfig;
