# NeoPay — Skema API: Transfer & Minta

## Base URL & Header

```
Base URL : https://<domain>/api
Auth     : Authorization: Bearer <token>
Content  : Content-Type: application/json
```

## Format Error

```json
{ "pesan": "Pesan error yang bisa ditampilkan langsung ke user" }
```

---

## Autentikasi

### Login

```
POST /api/masuk
Content-Type: application/json
```

**Request:**
```json
{
  "email": "user@email.com",
  "password": "password123"
}
```

**Response sukses `200`:**
```json
{
  "token": "eyJhbGci...",
  "nasabah": {
    "id": "uuid",
    "nama": "Budi Santoso",
    "email": "user@email.com",
    "noRekening": "8123456789",
    "saldo": 500000,
    "aktif": true,
    "pin": "ada_isi_atau_null",
    "role": "nasabah"
  }
}
```

> Simpan `token` untuk digunakan sebagai `Authorization: Bearer <token>` di semua request berikutnya.

---

#### Penanganan Error Login

> **PENTING:** Jangan hardcode satu pesan untuk semua kegagalan login. Bedakan berdasarkan HTTP status code:

| HTTP Status | Artinya | Yang ditampilkan ke user |
|---|---|---|
| `401` | Email atau password salah | Baca field `pesan` dari response body |
| `403` | Akun dinonaktifkan/suspend | Baca field `pesan` dari response body |
| `400` | Request tidak valid | Baca field `pesan` dari response body |

**Contoh response `401`:**
```json
{ "pesan": "Email atau password salah" }
```

**Contoh response `403` (akun suspend):**
```json
{ "pesan": "Akun Anda telah dinonaktifkan. Hubungi admin untuk informasi lebih lanjut." }
```

**Pseudocode handling yang benar:**
```
val response = api.login(email, password)

when (response.code) {
    200  -> simpan token, lanjut ke home
    401  -> tampilkan response.body.pesan   // "Email atau password salah"
    403  -> tampilkan response.body.pesan   // "Akun Anda telah dinonaktifkan..."
    else -> tampilkan "Terjadi kesalahan, coba lagi"
}
```

> ❌ **Salah:** Tampilkan "periksa email/password" untuk semua kegagalan login
> ✅ **Benar:** Selalu baca field `pesan` dari response body sesuai status code-nya

---

## PIN Transaksi

PIN wajib diset sebelum bisa transfer. Cek field `pin` di response profil — jika `null` berarti belum diset.

### Set PIN (Pertama Kali)

```
POST /api/nasabah/pin/set
Authorization: Bearer <token>
```

**Request:**
```json
{
  "pin": "123456"
}
```

> PIN harus tepat 6 digit angka.

**Response `200`:**
```json
{ "pesan": "PIN transaksi berhasil dibuat" }
```

**Error `400`:** jika PIN sudah pernah dibuat sebelumnya → arahkan ke halaman ganti PIN.

---

### Ganti PIN

```
PUT /api/nasabah/pin/ubah
Authorization: Bearer <token>
```

**Request:**
```json
{
  "pinLama": "123456",
  "pinBaru": "654321"
}
```

**Response `200`:**
```json
{ "pesan": "PIN transaksi berhasil diubah" }
```

**Error `400`:**
| Pesan | Tindakan |
|-------|----------|
| `"PIN lama salah. Sisa percobaan: N"` | Tampilkan sisa percobaan di UI |
| `"PIN salah 3 kali. Akun dikunci selama 15 menit."` | Blokir form, tampilkan countdown |
| `"Akun terkunci sementara..."` | Tampilkan info waktu tunggu |
| `"PIN belum pernah dibuat..."` | Arahkan ke halaman set PIN |

---

## Transfer Saldo

Alur transfer dibagi **2 langkah**:

```
[Step 1] Ketik no. rekening → validasi → tampil nama penerima
[Step 2] Isi nominal + catatan + PIN → submit transfer
```

---

### Step 1 — Cek Rekening Penerima

```
GET /api/nasabah/cek-rekening?noRekening=0987654321
Authorization: Bearer <token>
```

Panggil saat user selesai mengetik nomor rekening (misal: saat field kehilangan fokus atau tombol "Cari" ditekan).

**Response sukses `200`:**
```json
{
  "nama": "Siti Aminah",
  "noRekening": "0987654321"
}
```

Tampilkan `nama` ke user sebagai konfirmasi penerima sebelum lanjut ke step 2.

**Error:**
| HTTP | Pesan | Tindakan |
|------|-------|----------|
| `404` | `"Nomor rekening tidak ditemukan."` | Tampilkan error di field no. rek |
| `400` | `"Tidak bisa transfer ke rekening sendiri."` | Tampilkan error |
| `400` | `"Rekening tujuan tidak aktif."` | Tampilkan error |

---

### Step 2 — Eksekusi Transfer

```
POST /api/nasabah/transfer
Authorization: Bearer <token>
```

**Request:**
```json
{
  "noRekening": "0987654321",
  "jumlah": 50000,
  "pin": "123456",
  "keterangan": "Bayar makan siang"
}
```

> `keterangan` opsional. `jumlah` minimum 1 (dalam rupiah).

**Response sukses `200`:**
```json
{
  "pesan": "Transfer berhasil",
  "transaksiId": "uuid-transaksi",
  "jumlah": 50000,
  "saldoAkhir": 450000,
  "createdAt": "2026-04-05T10:30:00.000Z",
  "penerima": {
    "nama": "Siti Aminah",
    "noRekening": "0987654321"
  }
}
```

> `createdAt` adalah timestamp ISO 8601 — format tanggal dan jam dari sini sesuai kebutuhan UI (contoh: `5 Apr 2026, 10:30`).
> Gunakan `transaksiId` untuk navigasi ke halaman detail/bukti transaksi.

**Error `400`:**
| Pesan dari backend | Tindakan di app |
|--------------------|-----------------|
| `"PIN transaksi belum diset..."` | Arahkan ke halaman set PIN |
| `"Akun terkunci sementara..."` | Tampilkan info tunggu 15 menit |
| `"PIN salah. Sisa percobaan: N"` | Tampilkan sisa percobaan |
| `"PIN salah 3 kali. Akun dikunci..."` | Blokir input PIN, tampilkan timer |
| `"Saldo tidak mencukupi."` | Tampilkan error saldo |

**Syarat sebelum buka halaman transfer:**
- Cek field `pin` di profil nasabah — jika `null`, arahkan ke set PIN dulu
- PIN harus 6 digit angka

---

## Riwayat Transaksi Saldo

```
GET /api/nasabah/transaksi
Authorization: Bearer <token>
```

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "nasabahId": "uuid",
      "lawanId": "uuid",
      "tipe": "transfer_keluar",
      "jumlah": 50000,
      "saldoSebelum": 500000,
      "saldoSesudah": 450000,
      "keterangan": "Bayar makan siang",
      "namaLawan": "Siti Aminah",
      "noRekeningLawan": "0987654321",
      "createdAt": "2026-04-05T10:00:00.000Z"
    }
  ],
  "total": 1
}
```

**Nilai `tipe`:**
| Nilai | UI |
|-------|----|
| `transfer_keluar` | Merah / minus |
| `transfer_masuk` | Hijau / plus |
| `top_up` | Hijau / plus |

---

## Minta (QR Payment Request)

> Fitur ini menggunakan QR code. Backend menyimpan permintaan dan menghasilkan kode unik. Android yang me-render QR dan men-scan-nya.

### Buat Permintaan (Generate QR)

```
POST /api/nasabah/minta
Authorization: Bearer <token>
```

**Request:**
```json
{
  "jumlah": 75000,
  "keterangan": "Patungan makan"
}
```

> `keterangan` opsional. `jumlah` minimum 1.

**Response `201`:**
```json
{
  "id": "uuid-permintaan",
  "kode": "NPY-A1B2C3D4",
  "jumlah": 75000,
  "keterangan": "Patungan makan",
  "namaPembuat": "Budi Santoso",
  "noRekeningPembuat": "1234567890",
  "expiredAt": "2026-04-05T10:30:00.000Z",
  "status": "menunggu"
}
```

> Gunakan field `kode` sebagai isi QR code. QR berlaku **30 menit** (`expiredAt`).

**Android — cara render QR:** encode string `kode` ke QR menggunakan library seperti `zxing` atau `qrcode-kotlin`.

---

### Scan QR — Ambil Detail Permintaan

```
GET /api/nasabah/minta/{kode}
Authorization: Bearer <token>
```

Dipanggil setelah Android berhasil scan QR dan mendapat string `kode`.

**Response `200`:**
```json
{
  "id": "uuid-permintaan",
  "kode": "NPY-A1B2C3D4",
  "jumlah": 75000,
  "keterangan": "Patungan makan",
  "namaPembuat": "Budi Santoso",
  "noRekeningPembuat": "1234567890",
  "expiredAt": "2026-04-05T10:30:00.000Z",
  "status": "menunggu"
}
```

**Error `400`:** QR sudah kadaluarsa atau sudah dibayar.

---

### Bayar Permintaan (Setelah Konfirmasi User)

```
POST /api/nasabah/minta/{kode}/bayar
Authorization: Bearer <token>
```

**Request:**
```json
{
  "pin": "123456"
}
```

**Response `200`:**
```json
{
  "pesan": "Pembayaran berhasil",
  "saldoAkhir": 375000
}
```

**Error `400`:** sama seperti error transfer (PIN salah, saldo tidak cukup, dll) ditambah:
- QR sudah kadaluarsa
- QR sudah dibayar sebelumnya
- Tidak bisa bayar permintaan sendiri

---

### Alur Lengkap Fitur Minta

```
[Pembuat]                          [Pembayar]
    |                                   |
POST /minta  ──► dapat kode             |
    |                                   |
Render QR dari kode                     |
    |                                   |
    |          Scan QR                  |
    |◄──────────────────────── GET /minta/{kode}
    |                                   |
    |                          Tampil detail: nama, jumlah
    |                                   |
    |                          User konfirmasi + input PIN
    |                                   |
    |◄──────────────────── POST /minta/{kode}/bayar
    |                                   |
Status berubah jadi "selesai"    saldoAkhir dikembalikan
```

---

*Catatan: Endpoint `/minta` belum tersedia, akan ditambahkan ke backend segera.*
