/** PM2 process config — run from /opt/migpt/current on VPS. */
const fs = require("node:fs");
const path = require("node:path");

function loadDotEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i <= 0) continue;
    env[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim();
  }
  return env;
}

module.exports = {
  apps: [
    {
      name: "migpt",
      script: "migpt/index.ts",
      interpreter: "node",
      interpreter_args: "--import tsx",
      cwd: __dirname,
      env: loadDotEnv(path.join(__dirname, ".env")),
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
