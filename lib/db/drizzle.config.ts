import { defineConfig } from "drizzle-kit";
import path from "path";

const dbUrl = process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  throw new Error(
    "SUPABASE_DB_URL tidak ditemukan. Pastikan secret sudah di-set.",
  );
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
    ssl: { rejectUnauthorized: false },
  },
});
