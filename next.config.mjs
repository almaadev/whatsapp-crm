/** @type {import('next').NextConfig} */

const nextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: [
    'localhost:3000',
    '127.0.0.1:3000',
    '*.ngrok-free.dev',
    '*.ngrok-free.app',
    '*.ngrok.io',
    '*.ngrok.app',
    'puzzle-footnote-ointment.ngrok-free.dev',
    'pediatric-opossum-gambling.ngrok-free.dev',
  ],

  experimental: {
    serverActions: {
      allowedOrigins: [
        "*.ngrok-free.dev",
        "*.ngrok-free.app",
        "*.ngrok.io",
        "*.ngrok.app",
        "puzzle-footnote-ointment.ngrok-free.dev",
        "pediatric-opossum-gambling.ngrok-free.dev",
      ]
    }
  }
};

export default nextConfig;
