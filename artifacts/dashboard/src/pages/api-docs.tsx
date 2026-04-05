import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Copy, Check, FileCode2 } from "lucide-react";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface ApiField {
  name: string;
  type: string;
  required?: boolean;
  desc: string;
}

interface ApiEndpoint {
  method: HttpMethod;
  path: string;
  desc: string;
  auth: "Tidak perlu" | "Bearer Token (nasabah)" | "Bearer Token (teller/admin)" | "Bearer Token (hanya admin)";
  bodyFields?: ApiField[];
  responseDesc: string;
  responseSample: object | null;
  notes?: string;
}

interface ApiGroup {
  label: string;
  color: string;
  endpoints: ApiEndpoint[];
}

const BASE_URL = "/api";

const METHOD_COLOR: Record<HttpMethod, string> = {
  GET:    "bg-blue-100 text-blue-700 border-blue-200",
  POST:   "bg-green-100 text-green-700 border-green-200",
  PUT:    "bg-yellow-100 text-yellow-700 border-yellow-200",
  DELETE: "bg-red-100 text-red-700 border-red-200",
  PATCH:  "bg-purple-100 text-purple-700 border-purple-200",
};

const API_GROUPS: ApiGroup[] = [
  {
    label: "Autentikasi",
    color: "border-l-blue-500",
    endpoints: [
      {
        method: "POST",
        path: "/daftar",
        desc: "Daftar akun nasabah baru",
        auth: "Tidak perlu",
        bodyFields: [
          { name: "nama",         type: "string",  required: true,  desc: "Nama lengkap nasabah" },
          { name: "email",        type: "string",  required: true,  desc: "Alamat email (unik)" },
          { name: "password",     type: "string",  required: true,  desc: "Minimal 8 karakter" },
          { name: "noHp",         type: "string",  required: true,  desc: "Nomor HP aktif" },
          { name: "tanggalLahir", type: "string",  required: true,  desc: "Format: DD-MM-YYYY (dipakai generate no. rekening)" },
          { name: "nik",          type: "string",  required: false, desc: "Nomor KTP (opsional)" },
        ],
        responseDesc: "Token JWT + data nasabah baru. No. rekening digenerate otomatis: DDMM + 4 digit acak.",
        responseSample: {
          token: "eyJhbGciOiJFUzI1...",
          nasabah: {
            id: "uuid",
            nama: "Budi Santoso",
            email: "budi@email.com",
            noHp: "08123456789",
            noRekening: "15031234",
            tanggalLahir: "15-03-2001",
            saldo: 0,
            role: "nasabah",
          },
        },
      },
      {
        method: "POST",
        path: "/masuk",
        desc: "Login dengan email dan password",
        auth: "Tidak perlu",
        bodyFields: [
          { name: "email",    type: "string", required: true, desc: "Email terdaftar" },
          { name: "password", type: "string", required: true, desc: "Password akun" },
        ],
        responseDesc: "Token JWT + data nasabah. Simpan token di SharedPreferences untuk request berikutnya.",
        responseSample: {
          token: "eyJhbGciOiJFUzI1...",
          nasabah: {
            id: "uuid",
            nama: "Budi Santoso",
            role: "nasabah",
            noRekening: "15031234",
            saldo: 150000,
          },
        },
      },
      {
        method: "GET",
        path: "/me",
        desc: "Ambil data pengguna yang sedang login",
        auth: "Bearer Token (nasabah)",
        responseDesc: "Data nasabah berdasarkan token JWT.",
        responseSample: {
          nasabah: {
            id: "uuid",
            nama: "Budi Santoso",
            email: "budi@email.com",
            role: "nasabah",
          },
        },
      },
    ],
  },
  {
    label: "Antrian (Nasabah)",
    color: "border-l-green-500",
    endpoints: [
      {
        method: "GET",
        path: "/antrian/hari-ini",
        desc: "Lihat semua antrian hari ini (publik, tanpa login)",
        auth: "Tidak perlu",
        responseDesc: "List antrian hari ini beserta status, cabang, dan jenis layanan. Tidak menampilkan data pribadi nasabah.",
        responseSample: {
          data: [
            {
              id: "uuid",
              nomorAntrian: 1,
              jenisLayanan: "teller",
              status: "selesai",
              tanggal: "2026-04-03",
              cabangId: "uuid-cabang",
              cabangNama: "Cabang Prabumulih Utara",
              cabangKode: "CBG-001",
              dilayaniOlehId: "uuid-petugas",
              namaPetugas: "Rina Teller",
              createdAt: "2026-04-03T08:05:00.000Z",
              updatedAt: "2026-04-03T09:10:00.000Z",
            },
          ],
          total: 1,
        },
      },
      {
        method: "GET",
        path: "/antrian/saya",
        desc: "Cek status antrian aktif milik nasabah (alias dari /antrian/status-saya)",
        auth: "Bearer Token (nasabah)",
        responseDesc: "Data antrian aktif nasabah + posisi + estimasi waktu + info cabang + flag dipanggil. Return 404 jika tidak ada antrian aktif.",
        responseSample: {
          antrian: {
            id: "uuid",
            nomorAntrian: 5,
            jenisLayanan: "teller",
            status: "menunggu",
            tanggal: "2026-04-03",
            namaNasabah: "Budi Santoso",
            noHpNasabah: "08123456789",
            dilayaniOlehId: null,
            namaPetugas: null,
          },
          posisi: 3,
          totalMenunggu: 7,
          sedangDipanggil: false,
          estimasiMenit: 15,
          dipanggilSekarang: {
            nomorAntrian: 2,
            status: "dipanggil",
          },
          cabang: {
            id: "uuid-cabang",
            nama: "Cabang Utama Sudirman",
            kode: "CBG-001",
          },
        },
        notes: "sedangDipanggil=true berarti giliran nasabah ini sekarang. estimasiMenit = posisi × 8 menit (0 jika sedangDipanggil). posisi & totalMenunggu dihitung per-cabang per-jenisLayanan. 404 jika tidak ada antrian aktif.",
      },
      {
        method: "POST",
        path: "/antrian",
        desc: "Ambil nomor antrian baru (alias dari /antrian/ambil)",
        auth: "Bearer Token (nasabah)",
        bodyFields: [
          { name: "cabangId",    type: "string (UUID)", required: true,  desc: "ID cabang tujuan — ambil dari GET /cabang" },
          { name: "jenisLayanan", type: "string",       required: true,  desc: "Pilih: teller | cs" },
          { name: "catatan",      type: "string",       required: false, desc: "Keperluan / keterangan tambahan" },
        ],
        responseDesc: "Data antrian baru + posisi dalam antrean di cabang tersebut. Nomor antrian unik per-cabang per-jenis-layanan per-hari.",
        responseSample: {
          antrian: {
            id: "uuid",
            nomorAntrian: 5,
            jenisLayanan: "teller",
            status: "menunggu",
            cabangId: "uuid-cabang",
          },
          posisi: 5,
        },
        notes: "400 jika hari ini bukan hari operasional bank. 400 jika cabang yang dipilih saat ini tutup (cek jamBuka/jamTutup per cabang). 400 jika kuota harian penuh atau cabangId tidak ditemukan/tidak aktif. 409 jika sudah punya antrian aktif hari ini.",
      },
      {
        method: "DELETE",
        path: "/antrian/:id",
        desc: "Batalkan antrian milik sendiri (alias dari PUT /antrian/:id/batal)",
        auth: "Bearer Token (nasabah)",
        responseDesc: "Data antrian dengan status 'dibatalkan'.",
        responseSample: {
          antrian: {
            id: "uuid",
            status: "dibatalkan",
            updatedAt: "2026-04-03T10:30:00.000Z",
          },
        },
        notes: "403 jika mencoba batalkan antrian milik nasabah lain.",
      },
    ],
  },
  {
    label: "Nasabah",
    color: "border-l-teal-500",
    endpoints: [
      {
        method: "GET",
        path: "/nasabah/profil",
        desc: "Ambil profil nasabah yang login",
        auth: "Bearer Token (nasabah)",
        responseDesc: "Data lengkap profil nasabah.",
        responseSample: {
          id: "uuid",
          nama: "Budi Santoso",
          email: "budi@email.com",
          noHp: "08123456789",
          noRekening: "15031234",
          saldo: 150000,
          tanggalLahir: "15-03-2001",
        },
      },
      {
        method: "PUT",
        path: "/nasabah/profil",
        desc: "Update profil nasabah (nama, noHp)",
        auth: "Bearer Token (nasabah)",
        bodyFields: [
          { name: "nama", type: "string", required: false, desc: "Nama lengkap baru" },
          { name: "noHp", type: "string", required: false, desc: "Nomor HP baru" },
        ],
        responseDesc: "Profil yang sudah diperbarui.",
        responseSample: {
          id: "uuid",
          nama: "Budi Santoso Baru",
          noHp: "08198765432",
        },
      },
      {
        method: "GET",
        path: "/nasabah/riwayat",
        desc: "Riwayat antrian nasabah (semua waktu)",
        auth: "Bearer Token (nasabah)",
        responseDesc: "List semua antrian nasabah yang login, dari terbaru. Sudah include info cabang dan nama petugas.",
        responseSample: {
          data: [
            {
              id: "uuid",
              nasabahId: "uuid",
              cabangId: "uuid",
              tanggal: "2026-04-02",
              nomorAntrian: 3,
              jenisLayanan: "teller",
              status: "selesai",
              catatan: null,
              dilayaniOlehId: "uuid",
              createdAt: "2026-04-02T08:30:00.000Z",
              updatedAt: "2026-04-02T09:15:00.000Z",
              namaNasabah: "Budi Santoso",
              noHpNasabah: "08123456789",
              namaCabang: "Cabang Utama Jakarta",
              alamatCabang: "Jl. Sudirman No. 1, Jakarta",
              kodeCabang: "JKT-001",
              namaPetugas: "Siti Aminah",
            },
          ],
          total: 1,
        },
      },
      {
        method: "POST",
        path: "/nasabah/daftar-notif",
        desc: "Daftarkan OneSignal Player ID untuk push notifikasi",
        auth: "Bearer Token (nasabah)",
        bodyFields: [
          { name: "playerId", type: "string", required: true, desc: "OneSignal Player ID dari Android app" },
        ],
        responseDesc: "Konfirmasi pendaftaran notifikasi.",
        responseSample: { pesan: "Player ID berhasil didaftarkan" },
      },
      {
        method: "GET",
        path: "/nasabah/cek-rekening?noRekening={noRek}",
        desc: "Validasi nomor rekening dan ambil info penerima sebelum transfer. Digunakan di step pertama alur transfer (ketik no. rek → tampil nama penerima).",
        auth: "Bearer Token (nasabah)",
        responseDesc: "Nama dan nomor rekening penerima. Error 404 jika tidak ditemukan, 400 jika rekening sendiri atau tidak aktif.",
        responseSample: { nama: "Siti Aminah", noRekening: "0987654321" },
      },
      {
        method: "POST",
        path: "/nasabah/transfer",
        desc: "Transfer saldo ke nasabah lain via nomor rekening. PIN transaksi wajib sudah diset. Saldo diperbarui secara atomik.",
        auth: "Bearer Token (nasabah)",
        bodyFields: [
          { name: "noRekening", type: "string", required: true, desc: "Nomor rekening tujuan" },
          { name: "jumlah", type: "number", required: true, desc: "Jumlah transfer dalam rupiah (min 1)" },
          { name: "pin", type: "string", required: true, desc: "PIN transaksi 6 digit" },
          { name: "keterangan", type: "string", required: false, desc: "Keterangan transfer (opsional)" },
        ],
        responseDesc: "Transfer berhasil beserta ID transaksi, waktu, saldo akhir, dan detail penerima.",
        responseSample: {
          pesan: "Transfer berhasil",
          transaksiId: "uuid",
          jumlah: 50000,
          saldoAkhir: 450000,
          createdAt: "2026-04-05T10:30:00.000Z",
          penerima: { nama: "Siti Aminah", noRekening: "0987654321" },
        },
      },
      {
        method: "GET",
        path: "/nasabah/transaksi",
        desc: "Riwayat transaksi saldo nasabah (transfer masuk/keluar, top up) diurutkan terbaru.",
        auth: "Bearer Token (nasabah)",
        responseDesc: "List transaksi beserta nama dan nomor rekening lawan transaksi.",
        responseSample: {
          data: [
            {
              id: "uuid",
              nasabahId: "uuid",
              lawanId: "uuid",
              tipe: "transfer_keluar",
              jumlah: 50000,
              saldoSebelum: 500000,
              saldoSesudah: 450000,
              keterangan: "Bayar makan siang",
              namaLawan: "Budi Santoso",
              noRekeningLawan: "1234567890",
              createdAt: "2026-04-05T10:00:00.000Z",
            },
          ],
          total: 1,
        },
      },
      {
        method: "POST",
        path: "/nasabah/pin/set",
        desc: "Set PIN transaksi pertama kali. Gagal jika PIN sudah pernah dibuat.",
        auth: "Bearer Token (nasabah)",
        bodyFields: [
          { name: "pin", type: "string", required: true, desc: "PIN 6 digit angka" },
        ],
        responseDesc: "Konfirmasi PIN berhasil dibuat.",
        responseSample: { pesan: "PIN transaksi berhasil dibuat" },
      },
      {
        method: "PUT",
        path: "/nasabah/pin/ubah",
        desc: "Ganti PIN transaksi. Butuh PIN lama sebagai verifikasi. Akun terkunci 15 menit setelah 3x salah.",
        auth: "Bearer Token (nasabah)",
        bodyFields: [
          { name: "pinLama", type: "string", required: true, desc: "PIN lama untuk verifikasi (6 digit)" },
          { name: "pinBaru", type: "string", required: true, desc: "PIN baru yang ingin diset (6 digit)" },
        ],
        responseDesc: "Konfirmasi PIN berhasil diubah.",
        responseSample: { pesan: "PIN transaksi berhasil diubah" },
      },
    ],
  },
  {
    label: "Jadwal Operasional",
    color: "border-l-orange-500",
    endpoints: [
      {
        method: "GET",
        path: "/jadwal",
        desc: "Ambil jadwal operasional bank yang aktif (publik)",
        auth: "Tidak perlu",
        responseDesc: "Jadwal aktif: hari buka, kuota per hari, dan status aktif. Jam buka/tutup kini diatur per cabang masing-masing.",
        responseSample: {
          id: "uuid",
          hariBuka: ["senin", "selasa", "rabu", "kamis", "jumat"],
          kuotaPerHari: 50,
          aktif: true,
          keterangan: null,
        },
      },
    ],
  },
  {
    label: "Cabang",
    color: "border-l-cyan-500",
    endpoints: [
      {
        method: "GET",
        path: "/cabang",
        desc: "Daftar semua cabang aktif (publik, tanpa login)",
        auth: "Tidak perlu",
        responseDesc: "List cabang yang sedang aktif — digunakan nasabah & Android untuk memilih cabang saat ambil antrian. Termasuk jam operasional per cabang.",
        responseSample: {
          data: [
            {
              id: "uuid-cabang",
              nama: "Cabang Prabumulih Utara",
              kode: "CBG-001",
              alamat: "Jl. Jend. Sudirman No. 1",
              aktif: true,
              jamBuka: "08:00",
              jamTutup: "15:00",
            },
          ],
          total: 4,
        },
      },
      {
        method: "GET",
        path: "/cabang/:id/antrian",
        desc: "Jumlah antrian aktif per jenis layanan di satu cabang (real-time)",
        auth: "Tidak perlu",
        responseDesc: "Jumlah antrian menunggu untuk tiap layanan (teller/cs) di cabang tersebut. Dipakai untuk tampilkan estimasi sebelum ambil nomor.",
        responseSample: {
          cabangId: "uuid-cabang",
          cabangNama: "Cabang Utama Sudirman",
          antrian: {
            teller: 3,
            cs: 1,
          },
        },
        notes: "404 jika cabang tidak ditemukan atau tidak aktif.",
      },
      {
        method: "GET",
        path: "/admin/cabang",
        desc: "Daftar semua cabang termasuk yang nonaktif (admin)",
        auth: "Bearer Token (hanya admin)",
        responseDesc: "Semua cabang — aktif maupun tidak aktif. Termasuk jam operasional per cabang. Digunakan di halaman manajemen cabang dashboard.",
        responseSample: {
          data: [
            {
              id: "uuid-cabang",
              nama: "Cabang Prabumulih Utara",
              kode: "CBG-001",
              alamat: "Jl. Jend. Sudirman No. 1",
              aktif: true,
              jamBuka: "08:00",
              jamTutup: "15:00",
            },
          ],
          total: 4,
        },
      },
      {
        method: "POST",
        path: "/admin/cabang",
        desc: "Tambah cabang baru",
        auth: "Bearer Token (hanya admin)",
        bodyFields: [
          { name: "nama",     type: "string", required: true,  desc: "Nama lengkap cabang" },
          { name: "kode",     type: "string", required: true,  desc: "Kode unik cabang, contoh: CBG-005" },
          { name: "alamat",   type: "string", required: false, desc: "Alamat lengkap cabang" },
          { name: "jamBuka",  type: "string", required: false, desc: "Jam buka cabang format HH:MM, default: 08:00" },
          { name: "jamTutup", type: "string", required: false, desc: "Jam tutup cabang format HH:MM, default: 15:00" },
        ],
        responseDesc: "Data cabang baru yang berhasil dibuat. Aktif secara default.",
        responseSample: {
          id: "uuid-cabang-baru",
          nama: "Cabang Prabumulih Barat",
          kode: "CBG-005",
          alamat: "Jl. Ahmad Yani No. 10",
          aktif: true,
          jamBuka: "08:00",
          jamTutup: "15:00",
        },
        notes: "409 jika kode cabang sudah dipakai oleh cabang lain.",
      },
      {
        method: "PUT",
        path: "/admin/cabang/:id",
        desc: "Update data cabang (nama, kode, alamat, jam operasional, atau aktif/nonaktif)",
        auth: "Bearer Token (hanya admin)",
        bodyFields: [
          { name: "nama",     type: "string",  required: false, desc: "Nama baru cabang" },
          { name: "kode",     type: "string",  required: false, desc: "Kode baru cabang (harus unik)" },
          { name: "alamat",   type: "string",  required: false, desc: "Alamat baru cabang" },
          { name: "aktif",    type: "boolean", required: false, desc: "true untuk aktifkan, false untuk nonaktifkan" },
          { name: "jamBuka",  type: "string",  required: false, desc: "Jam buka cabang format HH:MM, contoh: \"08:00\"" },
          { name: "jamTutup", type: "string",  required: false, desc: "Jam tutup cabang format HH:MM, contoh: \"15:00\"" },
        ],
        responseDesc: "Data cabang setelah diperbarui.",
        responseSample: {
          id: "uuid-cabang",
          nama: "Cabang Prabumulih Utara",
          kode: "CBG-001",
          aktif: true,
          jamBuka: "08:00",
          jamTutup: "13:00",
        },
        notes: "404 jika ID cabang tidak ditemukan. 409 jika kode baru sudah dipakai cabang lain.",
      },
      {
        method: "DELETE",
        path: "/admin/cabang/:id",
        desc: "Nonaktifkan cabang (soft delete — data tidak dihapus)",
        auth: "Bearer Token (hanya admin)",
        responseDesc: "Cabang dinonaktifkan. Antrian lama tetap tersimpan, cabang hanya tidak bisa dipilih nasabah baru.",
        responseSample: {
          pesan: "Cabang berhasil dinonaktifkan",
          id: "uuid-cabang",
        },
        notes: "404 jika ID tidak ditemukan. Gunakan PUT /admin/cabang/:id dengan aktif=true untuk mengaktifkan kembali.",
      },
    ],
  },
  {
    label: "Teller & CS — Antrian",
    color: "border-l-red-500",
    endpoints: [
      {
        method: "PUT",
        path: "/admin/antrian/:id/panggil",
        desc: "Panggil nomor antrian ke loket",
        auth: "Bearer Token (teller/admin)",
        responseDesc: "Antrian berubah status jadi 'dipanggil'. Otomatis kirim notifikasi WA + push notif ke nasabah yang dipanggil, dan advance-warning ke nasabah urutan ke-3 berikutnya.",
        responseSample: {
          antrian: {
            id: "uuid",
            nasabahId: "uuid",
            cabangId: "uuid-cabang",
            tanggal: "2026-04-04",
            nomorAntrian: 4,
            jenisLayanan: "teller",
            status: "dipanggil",
            catatan: null,
            dilayaniOlehId: "uuid-petugas",
            namaNasabah: "Budi Santoso",
            noHpNasabah: "08123456789",
            namaPetugas: "Rina Teller",
            createdAt: "2026-04-04T08:10:00.000Z",
            updatedAt: "2026-04-04T09:05:00.000Z",
          },
        },
        notes: "400 jika status antrian bukan 'menunggu'. 404 jika antrian tidak ditemukan. dilayaniOlehId dan namaPetugas diisi otomatis dari akun teller/admin yang memanggil.",
      },
      {
        method: "PUT",
        path: "/admin/antrian/:id/selesai",
        desc: "Tandai antrian selesai dilayani",
        auth: "Bearer Token (teller/admin)",
        responseDesc: "Antrian berubah status jadi 'selesai'.",
        responseSample: {
          antrian: {
            id: "uuid",
            nomorAntrian: 4,
            jenisLayanan: "teller",
            status: "selesai",
            namaNasabah: "Budi Santoso",
            noHpNasabah: "08123456789",
            namaPetugas: "Rina Teller",
            updatedAt: "2026-04-04T09:20:00.000Z",
          },
        },
        notes: "400 jika status antrian bukan 'dipanggil' atau 'sedang_dilayani'. 404 jika antrian tidak ditemukan.",
      },
      {
        method: "PUT",
        path: "/admin/antrian/:id/skip",
        desc: "Skip / lewati antrian (nasabah tidak hadir)",
        auth: "Bearer Token (teller/admin)",
        responseDesc: "Antrian berubah status jadi 'dibatalkan'. Gunakan untuk nasabah yang tidak hadir saat dipanggil.",
        responseSample: {
          antrian: {
            id: "uuid",
            nomorAntrian: 4,
            jenisLayanan: "cs",
            status: "dibatalkan",
            namaNasabah: "Siti Aminah",
            noHpNasabah: "08199999999",
            namaPetugas: "Rina Teller",
            updatedAt: "2026-04-04T09:30:00.000Z",
          },
        },
        notes: "400 jika status antrian bukan 'menunggu' atau 'dipanggil'. 404 jika antrian tidak ditemukan.",
      },
    ],
  },
  {
    label: "Admin — Manajemen",
    color: "border-l-purple-500",
    endpoints: [
      {
        method: "GET",
        path: "/admin/dasbor",
        desc: "Statistik ringkasan antrian hari ini (opsional filter per cabang)",
        auth: "Bearer Token (teller/admin)",
        responseDesc: "Total antrian, breakdown per status dan per jenis layanan, plus antrian yang sedang dipanggil saat ini. Tambahkan ?cabangId=<uuid> untuk filter satu cabang saja.",
        responseSample: {
          tanggal: "2026-04-04",
          cabangId: null,
          totalAntrian: 20,
          menunggu: 5,
          dipanggil: 1,
          sedangDilayani: 0,
          selesai: 13,
          dibatalkan: 1,
          tellerCount: 12,
          csCount: 8,
          antrianAktif: {
            id: "uuid",
            nomorAntrian: 4,
            jenisLayanan: "teller",
            status: "dipanggil",
            namaNasabah: "Budi Santoso",
            noHpNasabah: "08123456789",
          },
        },
        notes: "Query param ?cabangId=<uuid> opsional — jika tidak disertakan, statistik mencakup semua cabang. antrianAktif adalah antrian berstatus 'dipanggil' pertama, atau null jika tidak ada.",
      },
      {
        method: "GET",
        path: "/admin/jadwal",
        desc: "Ambil jadwal operasional (versi admin)",
        auth: "Bearer Token (hanya admin)",
        responseDesc: "Semua jadwal termasuk yang tidak aktif.",
        responseSample: { data: [{ id: "uuid", hariBuka: ["senin", "jumat"], aktif: true }] },
      },
      {
        method: "PUT",
        path: "/admin/jadwal",
        desc: "Update jadwal operasional bank (hari buka, kuota, status, keterangan)",
        auth: "Bearer Token (hanya admin)",
        bodyFields: [
          { name: "hariBuka",    type: "string[]", required: false, desc: "Contoh: [\"senin\", \"selasa\", \"rabu\", \"kamis\", \"jumat\"]" },
          { name: "kuotaPerHari",type: "number",   required: false, desc: "Maks jumlah antrian per hari per cabang" },
          { name: "aktif",       type: "boolean",  required: false, desc: "false untuk matikan seluruh layanan antrian (darurat)" },
          { name: "keterangan",  type: "string",   required: false, desc: "Catatan tambahan, contoh: libur nasional" },
        ],
        responseDesc: "Jadwal yang sudah diperbarui. Jam buka/tutup kini diatur per cabang melalui PUT /admin/cabang/:id.",
        responseSample: { id: "uuid", hariBuka: ["senin", "selasa", "rabu", "kamis", "jumat"], kuotaPerHari: 60, aktif: true, keterangan: null },
        notes: "Jam operasional tidak lagi diatur di sini — gunakan PUT /admin/cabang/:id dengan field jamBuka dan jamTutup untuk mengatur jam per cabang.",
      },
      {
        method: "GET",
        path: "/admin/users",
        desc: "Daftar semua user terdaftar",
        auth: "Bearer Token (hanya admin)",
        responseDesc: "List semua nasabah/user dengan info peran.",
        responseSample: {
          data: [{ id: "uuid", nama: "Budi", email: "budi@email.com", role: "nasabah" }],
          total: 1,
        },
      },
      {
        method: "PATCH",
        path: "/admin/users/:id/role",
        desc: "Ubah peran user (nasabah / teller / admin)",
        auth: "Bearer Token (hanya admin)",
        bodyFields: [
          { name: "role", type: "string", required: true, desc: "Pilih: nasabah | teller | admin" },
        ],
        responseDesc: "Data user dengan peran baru.",
        responseSample: { id: "uuid", nama: "Budi", role: "teller" },
      },
      {
        method: "PATCH",
        path: "/admin/users/:id/suspend",
        desc: "Suspend atau aktifkan kembali akun user",
        auth: "Bearer Token (hanya admin)",
        bodyFields: [
          { name: "aktif", type: "boolean", required: true, desc: "false untuk suspend, true untuk aktifkan kembali" },
        ],
        responseDesc: "Data user dengan status aktif terbaru.",
        responseSample: { id: "uuid", nama: "Budi", email: "budi@email.com", role: "nasabah", aktif: false },
        notes: "Akun yang di-suspend tetap tersimpan di database. Status ini tidak otomatis memblokir token Supabase yang sudah ada — hanya sebagai flag di sistem NeoPay.",
      },
      {
        method: "GET",
        path: "/admin/wa/status",
        desc: "Status koneksi WhatsApp",
        auth: "Bearer Token (hanya admin)",
        responseDesc: "Status koneksi WA: 'terhubung' atau 'terputus'.",
        responseSample: { status: "terhubung" },
      },
      {
        method: "GET",
        path: "/admin/wa/qr",
        desc: "QR code untuk scan WhatsApp",
        auth: "Bearer Token (hanya admin)",
        responseDesc: "String raw QR code untuk di-render di frontend. Gunakan library QR (misal react-qr-code) untuk menampilkan gambarnya, bukan langsung di <img src>.",
        responseSample: { qr: "2@xxx,yyy,zzz..." },
      },
    ],
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={handleCopy} className="p-1 rounded hover:bg-white/20 transition-colors text-white/70 hover:text-white">
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function EndpointCard({ ep }: { ep: ApiEndpoint }) {
  const [open, setOpen] = useState(false);
  const fullPath = BASE_URL + ep.path;
  const sampleJson = ep.responseSample ? JSON.stringify(ep.responseSample, null, 2) : null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full text-left group">
          <div className="flex items-center gap-3 p-4 rounded-lg border bg-white hover:bg-muted/30 transition-colors">
            <span className={`text-xs font-bold px-2 py-1 rounded border shrink-0 ${METHOD_COLOR[ep.method]}`}>
              {ep.method}
            </span>
            <code className="text-sm font-mono text-foreground/80 flex-1 truncate">{fullPath}</code>
            <span className="text-sm text-muted-foreground hidden sm:block flex-1">{ep.desc}</span>
            {open
              ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1 ml-4 border-l-2 border-muted pl-4 space-y-4 pb-4">
          <p className="text-sm text-muted-foreground pt-2">{ep.desc}</p>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium ${
              ep.auth === "Tidak perlu"
                ? "bg-gray-50 text-gray-500 border-gray-200"
                : ep.auth === "Bearer Token (nasabah)"
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : ep.auth === "Bearer Token (teller/admin)"
                ? "bg-teal-50 text-teal-700 border-teal-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}>
              🔐 {ep.auth}
            </span>
          </div>

          {ep.bodyFields && ep.bodyFields.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Request Body (JSON)</p>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium">Field</th>
                      <th className="text-left p-2 font-medium">Tipe</th>
                      <th className="text-left p-2 font-medium">Wajib</th>
                      <th className="text-left p-2 font-medium">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ep.bodyFields.map((f, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 font-mono">{f.name}</td>
                        <td className="p-2 text-blue-600">{f.type}</td>
                        <td className="p-2">
                          {f.required
                            ? <span className="text-red-500 font-medium">Ya</span>
                            : <span className="text-muted-foreground">Tidak</span>}
                        </td>
                        <td className="p-2 text-muted-foreground">{f.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Response</p>
            <p className="text-sm text-foreground/80 mb-2">{ep.responseDesc}</p>
            {sampleJson && (
              <div className="rounded-md overflow-hidden">
                <div className="flex items-center justify-between bg-gray-800 px-3 py-1.5">
                  <span className="text-xs text-gray-400">Contoh Response</span>
                  <CopyButton text={sampleJson} />
                </div>
                <pre className="bg-gray-900 text-green-300 text-xs p-3 overflow-auto max-h-52 leading-relaxed">
                  {sampleJson}
                </pre>
              </div>
            )}
          </div>

          {ep.notes && (
            <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-xs text-yellow-800">
              ⚠️ {ep.notes}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function ApiDocs() {
  const [search, setSearch] = useState("");
  const baseUrl = `${window.location.origin}/api`;

  const filtered = API_GROUPS.map((group) => ({
    ...group,
    endpoints: group.endpoints.filter(
      (ep) =>
        search === "" ||
        ep.path.toLowerCase().includes(search.toLowerCase()) ||
        ep.desc.toLowerCase().includes(search.toLowerCase()) ||
        ep.method.toLowerCase().includes(search.toLowerCase()),
    ),
  })).filter((g) => g.endpoints.length > 0);

  const totalEndpoints = API_GROUPS.reduce((acc, g) => acc + g.endpoints.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <FileCode2 className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Dokumentasi API</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Semua endpoint REST API NeoPay — {totalEndpoints} endpoint tersedia.
        </p>
      </div>

      <Card className="border-l-4 border-l-teal-500 bg-teal-50/50">
        <CardContent className="pt-4 pb-3">
          <p className="text-sm font-semibold text-teal-700 mb-1 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-teal-500" />
            Base URL
          </p>
          <p className="text-xs text-muted-foreground mb-2">
            Semua endpoint diawali dengan path ini. URL dideteksi otomatis sesuai environment yang sedang berjalan.
          </p>
          <div className="rounded bg-gray-900 px-3 py-2 flex items-center justify-between">
            <code className="text-xs text-teal-300 font-mono">{baseUrl}</code>
            <CopyButton text={baseUrl} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4 pb-3">
          <p className="text-sm font-semibold text-primary mb-1">Cara Autentikasi</p>
          <p className="text-xs text-muted-foreground mb-2">
            Kirim token dari response <code className="font-mono">/api/masuk</code> atau <code className="font-mono">/api/daftar</code> di header:
          </p>
          <div className="rounded bg-gray-900 px-3 py-2 flex items-center justify-between">
            <code className="text-xs text-green-300 font-mono">Authorization: Bearer {"<token>"}</code>
            <CopyButton text="Authorization: Bearer <token>" />
          </div>
        </CardContent>
      </Card>

      <input
        type="text"
        placeholder="Cari endpoint... (contoh: antrian, GET, daftar)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
      />

      {filtered.map((group) => (
        <Card key={group.label} className={`border-l-4 ${group.color}`}>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-base font-semibold">{group.label}</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-2">
            {group.endpoints.map((ep, i) => (
              <EndpointCard key={i} ep={ep} />
            ))}
          </CardContent>
        </Card>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Tidak ada endpoint yang cocok dengan pencarian "<strong>{search}</strong>"
        </div>
      )}
    </div>
  );
}
