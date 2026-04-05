import pg from "pg";

const { Pool } = pg;

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("SUPABASE_DB_URL or DATABASE_URL must be set");
  process.exit(1);
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

const sql = `
-- Tabel pasien
CREATE TABLE IF NOT EXISTS pasien (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id TEXT UNIQUE NOT NULL,
  nama TEXT NOT NULL,
  no_hp TEXT NOT NULL,
  email TEXT NOT NULL,
  one_signal_player_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabel jadwal_praktek
CREATE TABLE IF NOT EXISTS jadwal_praktek (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hari_buka TEXT[] NOT NULL DEFAULT ARRAY['senin','selasa','rabu','kamis','jumat'],
  jam_mulai TEXT NOT NULL DEFAULT '08:00',
  jam_selesai TEXT NOT NULL DEFAULT '17:00',
  kuota_per_hari INTEGER NOT NULL DEFAULT 30,
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  keterangan TEXT
);

-- Tabel antrian
CREATE TABLE IF NOT EXISTS antrian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pasien_id UUID NOT NULL REFERENCES pasien(id),
  tanggal DATE NOT NULL,
  nomor_antrian INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'menunggu'
    CHECK (status IN ('menunggu','dipanggil','sedang_dilayani','selesai','dibatalkan')),
  catatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index untuk performa query antrian per tanggal
CREATE INDEX IF NOT EXISTS idx_antrian_tanggal ON antrian(tanggal);
CREATE INDEX IF NOT EXISTS idx_antrian_status ON antrian(status);
CREATE INDEX IF NOT EXISTS idx_antrian_pasien ON antrian(pasien_id);

-- Insert jadwal default jika belum ada
INSERT INTO jadwal_praktek (hari_buka, jam_mulai, jam_selesai, kuota_per_hari, aktif, keterangan)
SELECT
  ARRAY['senin','selasa','rabu','kamis','jumat'],
  '08:00', '17:00', 30, TRUE,
  'Jadwal praktek default klinik gigi'
WHERE NOT EXISTS (SELECT 1 FROM jadwal_praktek LIMIT 1);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Menjalankan migrasi database...");
    await client.query(sql);
    console.log("Migrasi berhasil! Tabel berhasil dibuat:");
    console.log("  ✓ pasien");
    console.log("  ✓ jadwal_praktek");
    console.log("  ✓ antrian");
    console.log("  ✓ Jadwal default diisi");
  } catch (err) {
    console.error("Migrasi gagal:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
