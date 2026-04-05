import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { spawn, type ChildProcess } from "child_process";

// PORT hanya diperlukan untuk mode dev/preview, bukan saat build
const rawPort = process.env.PORT ?? "3000";
const port = Number(rawPort);

// BASE_PATH default "/" — cocok untuk Railway; Replit menggunakan "/dashboard"
const basePath = process.env.BASE_PATH ?? "/";

const API_PORT = 8080;
const API_BINARY = "/home/runner/workspace/artifacts/api-server/dist/index.mjs";

function apiServerPlugin() {
  let child: ChildProcess | null = null;

  return {
    name: "api-server-spawn",
    configureServer() {
      if (process.env.NODE_ENV === "production") return;

      child = spawn("node", ["--enable-source-maps", API_BINARY], {
        env: {
          ...process.env,
          PORT: String(API_PORT),
          NODE_ENV: "development",
        },
        stdio: "inherit",
        detached: false,
      });

      child.on("error", (err) => {
        console.error("[api-server] spawn error:", err.message);
      });

      child.on("exit", (code, signal) => {
        if (signal !== "SIGTERM" && signal !== "SIGKILL") {
          console.error(`[api-server] exited code=${code} signal=${signal}`);
        }
      });

      const cleanup = () => {
        if (child && !child.killed) child.kill("SIGTERM");
      };
      process.once("exit", cleanup);
      process.once("SIGINT", cleanup);
      process.once("SIGTERM", cleanup);
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    apiServerPlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      "/api": {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: false,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
