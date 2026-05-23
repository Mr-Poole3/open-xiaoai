/** PM2 process config — run from /opt/migpt/current on VPS. */
module.exports = {
  apps: [
    {
      name: "migpt",
      script: "node_modules/.bin/tsx",
      args: "migpt/index.ts",
      env_file: ".env",
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
