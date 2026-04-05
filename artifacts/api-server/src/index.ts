import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { inisialisasiWA, tutupWA } from "./lib/whatsapp";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);

// Graceful shutdown: pastikan semua koneksi ditutup saat SIGTERM/SIGINT
// sehingga port 8080 langsung bebas dan proses baru bisa bind
async function gracefulShutdown(signal: string) {
  logger.info({ signal }, "Menerima signal, memulai graceful shutdown...");

  // Tutup server HTTP (stop accepting new connections)
  server.close(() => {
    logger.info("HTTP server ditutup");
  });

  // Tutup koneksi WhatsApp Baileys
  await tutupWA();

  // Tutup pool database
  await pool.end();

  logger.info("Shutdown selesai");
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Bind ke 0.0.0.0 agar Replit proxy bisa mendeteksi port
server.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "Server listening");

  // Delay inisialisasi WA agar port responsif lebih dulu
  setTimeout(() => {
    inisialisasiWA().catch((err) => {
      logger.error({ err }, "Gagal inisialisasi WhatsApp saat startup");
    });
  }, 3000);
});
