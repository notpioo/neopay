#!/usr/bin/env node
// Script sementara untuk push schema ke Supabase
// Jalankan: node lib/db/push-supabase.mjs
import { execSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
console.log("DB URL tersedia:", dbUrl ? "Ya (" + dbUrl.substring(0, 30) + "...)" : "TIDAK ADA");

if (!dbUrl || !dbUrl.includes("supabase")) {
  console.error("SUPABASE_DB_URL tidak ditemukan atau bukan Supabase URL.");
  process.exit(1);
}

console.log("Menjalankan drizzle-kit push ke Supabase...");
execSync("pnpm --filter @workspace/db run push", {
  stdio: "inherit",
  env: { ...process.env },
  cwd: path.resolve(__dirname, "../.."),
});

console.log("✅ Schema berhasil di-push ke Supabase!");
