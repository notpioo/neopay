import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Sajikan frontend static di production (Railway / hosting lain)
// dist/index.mjs ada di artifacts/api-server/dist/, jadi ../../dashboard/dist/public
// mengarah ke artifacts/dashboard/dist/public relatif dari root proyek
const STATIC_DIR = path.resolve(__dirname, "../../dashboard/dist/public");
if (process.env.NODE_ENV === "production" && fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR));

  // SPA fallback — semua rute non-/api kembalikan index.html
  app.get("/{*path}", (_req: Request, res: Response) => {
    res.sendFile(path.join(STATIC_DIR, "index.html"));
  });
}

// Global error handler — pastikan semua error dikembalikan sebagai JSON, bukan HTML
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Terjadi kesalahan server";
  logger.error({ err, url: req.url, method: req.method }, "Unhandled error");
  res.status(500).json({ pesan: "Terjadi kesalahan server", detail: message });
});

export default app;
