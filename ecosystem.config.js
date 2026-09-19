module.exports = {
  apps: [
    {
      name: "whatsapp-crm",
      script: "src/server.js",
      instances: 1, // Crucial: Prevents Socket.IO 400 session ID unknown errors from un-stickied round-robin cluster workers
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};