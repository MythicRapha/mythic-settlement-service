module.exports = {
  apps: [
    {
      name: "mythic-settlement",
      script: "dist/index.js",
      restart_delay: 5000,
      max_restarts: 10,
    },
  ],
};
