import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const dbUrl = process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  throw new Error(
    "SUPABASE_DB_URL tidak ditemukan. Pastikan secret sudah di-set.",
  );
}

const isLocal =
  dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1");

// Parse URL manual supaya password dengan karakter '@' ditangani dengan benar
function parseDbUrl(url: string): pg.PoolConfig {
  // Format: postgresql://user:password@host:port/database
  // Tantangan: password bisa mengandung '@' atau karakter spesial lainnya
  const proto = url.match(/^(postgresql|postgres):\/\//)?.[0] ?? "postgresql://";
  const withoutProto = url.slice(proto.length);

  // Pisahkan credentials dari host dengan mencari '@' terakhir
  const lastAtSign = withoutProto.lastIndexOf("@");
  const credentials = withoutProto.slice(0, lastAtSign);
  const hostAndDb = withoutProto.slice(lastAtSign + 1);

  // Pisahkan user dan password pada ':' pertama
  const firstColon = credentials.indexOf(":");
  const user = credentials.slice(0, firstColon);
  const rawPassword = credentials.slice(firstColon + 1);

  // Decode URL encoding (%40 → @, %20 → space, dll)
  const password = decodeURIComponent(rawPassword);

  // Parse host:port/database
  const [hostPort, database] = hostAndDb.split("/");
  const colonIdx = hostPort.lastIndexOf(":");
  const host = colonIdx >= 0 ? hostPort.slice(0, colonIdx) : hostPort;
  const port = colonIdx >= 0 ? parseInt(hostPort.slice(colonIdx + 1), 10) : 5432;

  return {
    user,
    password,
    host,
    port,
    database: database?.split("?")[0] ?? "postgres",
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

export const pool = new Pool(parseDbUrl(dbUrl));

export const db = drizzle(pool, { schema });

export * from "./schema";
