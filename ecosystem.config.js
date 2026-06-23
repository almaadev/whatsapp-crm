module.exports = {
  apps: [
    {
      name: "whatsapp-crm",
      script: "src/server.js",
      instances: "max", // Uses all available CPU cores
      exec_mode: "cluster", // Enables Load Balancing
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};