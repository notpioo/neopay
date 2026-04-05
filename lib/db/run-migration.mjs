import pg from "pg";

const { Client } = pg;

const DB_URL = process.env.MIGRATION_URL || process.env.SUPABASE_DB_URL;

if (!DB_URL) {
  console.error("Set MIGRATION_URL environment variable");
  process.exit(1);
}

const client = new Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  console.log("✅ Terhubung ke Supabase");

  // 1. Buat tabel nasabah
  await client.query(`
    CREATE TABLE IF NOT EXISTS "nasabah" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "supabase_user_id" text NOT NULL,
      "nama" text NOT NULL,
      "no_hp" text NOT NULL DEFAULT '',
      "email" text NOT NULL DEFAULT '',
      "nik" text,
      "no_rekening" text,
      "tanggal_lahir" text,
      "saldo" bigint NOT NULL DEFAULT 0,
      "role" text NOT NULL DEFAULT 'nasabah',
      "one_signal_player_id" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "nasabah_supabase_user_id_unique" UNIQUE("supabase_user_id")
    )
  `);
  // Tambah kolom baru jika tabel sudah ada tanpa kolom tersebut
  await client.query(`ALTER TABLE nasabah ADD COLUMN IF NOT EXISTS "tanggal_lahir" text`);
  await client.query(`ALTER TABLE nasabah ADD COLUMN IF NOT EXISTS "saldo" bigint NOT NULL DEFAULT 0`);
  console.log("✅ Tabel nasabah siap (+ tanggal_lahir, saldo)");

  // 2. Buat tabel jadwal_operasional
  await client.query(`
    CREATE TABLE IF NOT EXISTS "jadwal_operasional" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "hari_buka" text[] NOT NULL DEFAULT '{"senin","selasa","rabu","kamis","jumat"}',
      "jam_mulai" text NOT NULL DEFAULT '08:00',
      "jam_selesai" text NOT NULL DEFAULT '16:00',
      "kuota_per_hari" integer NOT NULL DEFAULT 50,
      "aktif" boolean NOT NULL DEFAULT true,
      "keterangan" text
    )
  `);
  console.log("✅ Tabel jadwal_operasional siap");

  // 3. Buat tabel antrian (baru, menggantikan yang lama)
  await client.query(`
    CREATE TABLE IF NOT EXISTS "antrian" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "nasabah_id" uuid NOT NULL REFERENCES nasabah(id),
      "tanggal" date NOT NULL,
      "nomor_antrian" integer NOT NULL,
      "jenis_layanan" text NOT NULL DEFAULT 'teller',
      "status" text NOT NULL DEFAULT 'menunggu',
      "catatan" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )
  `);
  console.log("✅ Tabel antrian siap");

  // 4. Migrasi data dari tabel pasien lama (jika ada)
  const { rows: pasienExists } = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'pasien'
    ) as exists
  `);

  if (pasienExists[0]?.exists) {
    await client.query(`
      INSERT INTO nasabah (id, supabase_user_id, nama, no_hp, email, role, created_at, updated_at)
      SELECT
        p.id,
        p.supabase_user_id,
        p.nama,
        COALESCE(p.no_hp, ''),
        COALESCE(p.email, ''),
        COALESCE(p.role, 'nasabah'),
        COALESCE(p.created_at, now()),
        COALESCE(p.updated_at, now())
      FROM pasien p
      ON CONFLICT (supabase_user_id) DO NOTHING
    `);
    console.log("✅ Data pasien lama dimigrasi ke nasabah");
  } else {
    console.log("ℹ️  Tabel pasien tidak ditemukan, skip migrasi data");
  }

  // 5. Insert jadwal default jika kosong
  const { rows: jadwalCount } = await client.query(`SELECT count(*) as n FROM jadwal_operasional`);
  if (parseInt(jadwalCount[0].n) === 0) {
    await client.query(`
      INSERT INTO jadwal_operasional (hari_buka, jam_mulai, jam_selesai, kuota_per_hari, aktif)
      VALUES ('{"senin","selasa","rabu","kamis","jumat"}', '08:00', '16:00', 50, true)
    `);
    console.log("✅ Jadwal default ditambahkan");
  }

  // 6. Verifikasi
  const results = await Promise.all([
    client.query(`SELECT count(*) as n FROM nasabah`),
    client.query(`SELECT count(*) as n FROM jadwal_operasional`),
    client.query(`SELECT count(*) as n FROM antrian`),
  ]);

  console.log("\n📊 Tabel di Supabase:");
  console.log(`  nasabah            : ${results[0].rows[0].n} baris`);
  console.log(`  jadwal_operasional : ${results[1].rows[0].n} baris`);
  console.log(`  antrian            : ${results[2].rows[0].n} baris`);
  console.log("\n🎉 Migrasi selesai! Semua tabel NeoPay siap digunakan.");

  await client.end();
}

run().catch(async (err) => {
  console.error("❌ Error:", err.message);
  await client.end().catch(() => {});
  process.exit(1);
});
