# NeoPay — Sistem Antrian Digital Bank

NeoPay adalah sistem antrian digital berbasis web untuk layanan perbankan, dibangun di atas arsitektur monorepo pnpm.

## Arsitektur

```
workspace/
├── artifacts/
│   ├── dashboard/        ← React + Vite frontend (SPA)
│   └── api-server/       ← Express.js REST API backend
├── lib/
│   ├── db/               ← Drizzle ORM + schema PostgreSQL
│   ├── api-spec/         ← OpenAPI 3.1 spec (sumber kebenaran)
│   ├── api-client-react/ ← Orval-generated React Query hooks
│   └── api-zod/          ← Orval-generated Zod schemas
```

## Domain / Konsep Bisnis

| Lama (Klinik) | Baru (Bank NeoPay) |
|---|---|
| pasien | nasabah |
| dokter | teller |
| jadwal_praktek | jadwal_operasional |
| klinik_token | neopay_token |

**Role:** `nasabah`, `teller`, `admin`  
**Jenis Layanan:** `teller`, `cs`, `kredit`

## Stack Teknologi

- **Frontend:** React 19, Vite, TailwindCSS, shadcn/ui, React Query (TanStack)
- **Backend:** Express.js, Pino logger, Zod validasi
- **Database:** PostgreSQL via Drizzle ORM (Supabase)
- **Auth:** Supabase Auth (JWT Bearer token)
- **Codegen:** Orval dari OpenAPI spec → React Query hooks + Zod schemas
- **Notifikasi:** WhatsApp (Baileys), OneSignal push notif

## Database Schema

- `nasabah` — profil user dengan `nik`, `no_rekening`, role (nasabah/teller/admin)
- `cabang` — data cabang bank (nama, kode unik, alamat, aktif)
- `antrian` — antrean dengan `nasabah_id`, `cabang_id`, `jenis_layanan` (teller/cs/kredit), status, nomor antrian per-cabang-per-layanan
- `jadwal_operasional` — jam buka bank, hari buka, kuota per hari (berlaku global untuk semua cabang)

## API Routes

| Method | Path | Deskripsi |
|---|---|---|
| POST | /api/daftar | Registrasi nasabah |
| POST | /api/masuk | Login |
| GET | /api/me | Profil user yang login |
| GET | /api/antrian/hari-ini | Antrian hari ini (publik) |
| GET | /api/antrian/status-saya | Status antrian nasabah |
| POST | /api/antrian/ambil | Ambil nomor antrian |
| PUT | /api/antrian/:id/batal | Batalkan antrian |
| PUT | /api/admin/antrian/:id/panggil | Admin panggil nasabah |
| PUT | /api/admin/antrian/:id/selesai | Admin tandai selesai |
| PUT | /api/admin/antrian/:id/skip | Admin lewati nasabah |
| GET | /api/admin/dasbor | Statistik dasbor |
| GET/PUT | /api/admin/jadwal | Jadwal operasional |
| GET | /api/nasabah/profil | Profil nasabah login |
| PUT | /api/nasabah/profil | Update profil |
| GET | /api/nasabah/riwayat | Riwayat antrian |
| PATCH | /api/admin/users/:id/role | Ubah role user |

## Alur Codegen

1. Edit `lib/api-spec/openapi.yaml`
2. Jalankan `pnpm --filter @workspace/api-spec run codegen`
3. File di-generate ke `lib/api-client-react/src/generated/` dan `lib/api-zod/src/generated/`
4. Build API server: `pnpm --filter @workspace/api-server run build`

## Cara Jalankan

```bash
# Install deps
pnpm install

# Push schema DB
pnpm --filter @workspace/db run push

# Codegen
pnpm --filter @workspace/api-spec run codegen

# Build API
pnpm --filter @workspace/api-server run build

# Start dashboard (spawns API server otomatis)
pnpm --filter @workspace/dashboard run dev
```

## Environment Variables (Secrets)

- `SUPABASE_URL` — URL project Supabase
- `SUPABASE_ANON_KEY` — Anon key Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key Supabase
- `SUPABASE_DB_URL` — Connection URL database Supabase
- `ONESIGNAL_APP_ID` — OneSignal app ID (opsional)
- `ONESIGNAL_API_KEY` — OneSignal API key (opsional)
- `PORT` — Port server (auto-assign oleh Replit)
- `BASE_PATH` — Base path frontend (auto-assign oleh Replit)
