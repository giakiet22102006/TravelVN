import fs from "node:fs";
import path from "node:path";

let envLoaded = false;

export function loadProjectEnv(rootDir = process.cwd()) {
  if (envLoaded) return;
  for (const file of [".env.local", ".env"]) {
    const fullPath = path.join(rootDir, file);
    if (!fs.existsSync(fullPath)) continue;
    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile(fullPath);
    } else {
      for (const rawLine of fs.readFileSync(fullPath, "utf8").split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        let val = line.slice(eq + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    }
  }
  envLoaded = true;
}

export function getJwtSecret() {
  loadProjectEnv();
  return (
    process.env.JWT_SECRET || "travelvn-fallback-dev-secret-change-in-prod"
  );
}

export function getWebhookSecret() {
  loadProjectEnv();
  return (
    process.env.PAYMENT_WEBHOOK_SECRET ||
    process.env.JWT_SECRET ||
    "dev-payment-webhook-secret"
  );
}

export function getCronSecret() {
  loadProjectEnv();
  return (process.env.CRON_SECRET || "").trim();
}

export function getAdminCreds() {
  loadProjectEnv();
  return {
    email: process.env.E2E_ADMIN_EMAIL || "levana@gmail.com",
    password: process.env.E2E_ADMIN_PASSWORD || "Admin@123",
  };
}
