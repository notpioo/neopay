-- ============================================================
-- NeoPay Migration: pasien/jadwal_praktek → nasabah/jadwal_operasional
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. Buat tabel nasabah (menggantikan pasien)
CREATE TABLE IF NOT EXISTS "nasabah" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "supabase_user_id"     text NOT NULL,
  "nama"                 text NOT NULL,
  "no_hp"                text NOT NULL DEFAULT '',
  "email"                text NOT NULL DEFAULT '',
  "nik"                  text,
  "no_rekening"          text,
  "role"                 text NOT NULL DEFAULT 'nasabah',
  "one_signal_player_id" text,
  "created_at"           timestamptz NOT NULL DEFAULT now(),
  "updated_at"           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "nasabah_supabase_user_id_unique" UNIQUE("supabase_user_id")
);

-- 2. Migrasi data dari pasien → nasabah (jika tabel pasien masih ada)
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
ON CONFLICT (supabase_user_id) DO NOTHING;

-- 3. Buat tabel jadwal_operasional (menggantikan jadwal_praktek)
CREATE TABLE IF NOT EXISTS "jadwal_operasional" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "hari_buka"      text[] NOT NULL DEFAULT '{"senin","selasa","rabu","kamis","jumat"}',
  "jam_mulai"      text NOT NULL DEFAULT '08:00',
  "jam_selesai"    text NOT NULL DEFAULT '16:00',
  "kuota_per_hari" integer NOT NULL DEFAULT 50,
  "aktif"          boolean NOT NULL DEFAULT true,
  "keterangan"     text
);

-- 4. Insert jadwal default jika tabel masih kosong
INSERT INTO jadwal_operasional (hari_buka, jam_mulai, jam_selesai, kuota_per_hari, aktif)
SELECT
  '{"senin","selasa","rabu","kamis","jumat"}',
  '08:00',
  '16:00',
  50,
  true
WHERE NOT EXISTS (SELECT 1 FROM jadwal_operasional LIMIT 1);

-- 5. Perbarui tabel antrian:
--    a. Tambah kolom nasabah_id (jika belum ada)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'antrian' AND column_name = 'nasabah_id'
  ) THEN
    ALTER TABLE antrian ADD COLUMN "nasabah_id" uuid;
  END IF;
END
$$;

--    b. Tambah kolom jenis_layanan (jika belum ada)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'antrian' AND column_name = 'jenis_layanan'
  ) THEN
    ALTER TABLE antrian ADD COLUMN "jenis_layanan" text NOT NULL DEFAULT 'teller';
  END IF;
END
$$;

--    c. Isi nasabah_id dari pasien_id yang ada (jika kolom pasien_id masih ada)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'antrian' AND column_name = 'pasien_id'
  ) THEN
    UPDATE antrian SET nasabah_id = pasien_id WHERE nasabah_id IS NULL;
  END IF;
END
$$;

--    d. Set nasabah_id NOT NULL setelah diisi
ALTER TABLE antrian ALTER COLUMN nasabah_id SET NOT NULL;

--    e. Tambah foreign key ke nasabah (jika belum ada)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'antrian_nasabah_id_nasabah_id_fk'
  ) THEN
    ALTER TABLE antrian
      ADD CONSTRAINT "antrian_nasabah_id_nasabah_id_fk"
      FOREIGN KEY ("nasabah_id") REFERENCES nasabah("id");
  END IF;
END
$$;

-- 6. Verifikasi hasil
SELECT 'nasabah' as tabel, count(*) as jumlah FROM nasabah
UNION ALL
SELECT 'jadwal_operasional', count(*) FROM jadwal_operasional
UNION ALL
SELECT 'antrian', count(*) FROM antrian;
