import { Router, type IRouter } from "express";
import { db, antrianTable, jadwalOperasionalTable, nasabahTable, cabangTable } from "@workspace/db";
import { alias } from "drizzle-orm/pg-core";
import { eq, and, asc, desc, count, inArray, sql } from "drizzle-orm";
import { requireAuthWithNasabah } from "../middlewares/auth";
import { kirimPushNotif } from "../lib/onesignal";
import { kirimPesanWA } from "../lib/whatsapp";

const router: IRouter = Router();

const STATUS_AKTIF = ["menunggu", "dipanggil", "sedang_dilayani"] as const;

function getTanggalHariIni(): string {
  const nowWIB = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return nowWIB.toISOString().split("T")[0];
}

function getNamaHariIni(): string {
  const hariIndo = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
  const nowWIB = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return hariIndo[nowWIB.getUTCDay()] ?? "senin";
}

/** Cek apakah waktu sekarang (WIB, UTC+7) dalam rentang jam operasional */
function isJamOperasional(jamMulai: string, jamSelesai: string): boolean {
  const nowWIB = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const totalMenitSekarang = nowWIB.getUTCHours() * 60 + nowWIB.getUTCMinutes();

  const [mulaiH, mulaiM] = jamMulai.split(":").map(Number);
  const [selesaiH, selesaiM] = jamSelesai.split(":").map(Number);
  const totalMenitMulai   = (mulaiH ?? 8) * 60 + (mulaiM ?? 0);
  const totalMenitSelesai = (selesaiH ?? 16) * 60 + (selesaiM ?? 0);

  return totalMenitSekarang >= totalMenitMulai && totalMenitSekarang < totalMenitSelesai;
}

const MENIT_PER_NASABAH = 8;

/**
 * GET /antrian/hari-ini — publik, TIDAK menampilkan data pribadi nasabah
 */
router.get("/antrian/hari-ini", async (req, res): Promise<void> => {
  const tanggal = getTanggalHariIni();
  const petugasTable = alias(nasabahTable, "petugas");

  const antrianHariIni = await db
    .select({
      id: antrianTable.id,
      tanggal: antrianTable.tanggal,
      nomorAntrian: antrianTable.nomorAntrian,
      jenisLayanan: antrianTable.jenisLayanan,
      status: antrianTable.status,
      catatan: antrianTable.catatan,
      cabangId: antrianTable.cabangId,
      cabangNama: cabangTable.nama,
      cabangKode: cabangTable.kode,
      dilayaniOlehId: antrianTable.dilayaniOlehId,
      namaPetugas: petugasTable.nama,
      createdAt: antrianTable.createdAt,
      updatedAt: antrianTable.updatedAt,
    })
    .from(antrianTable)
    .leftJoin(cabangTable, eq(antrianTable.cabangId, cabangTable.id))
    .leftJoin(petugasTable, eq(antrianTable.dilayaniOlehId, petugasTable.id))
    .where(
      and(
        eq(antrianTable.tanggal, tanggal),
        inArray(antrianTable.status, [...STATUS_AKTIF, "selesai", "dibatalkan"]),
      )
    )
    .orderBy(desc(antrianTable.createdAt));

  const totalAktif = antrianHariIni.filter((a) => (STATUS_AKTIF as readonly string[]).includes(a.status)).length;

  res.json({ data: antrianHariIni, total: totalAktif });
});

/**
 * GET /antrian/status-saya (dan alias /antrian/saya) — antrian aktif milik nasabah
 */
async function handlerStatusSaya(req: any, res: any): Promise<void> {
  const tanggal = getTanggalHariIni();
  const nasabahId = req.nasabah!.id;

  const antrianAktifList = await db
    .select()
    .from(antrianTable)
    .where(
      and(
        eq(antrianTable.nasabahId, nasabahId),
        eq(antrianTable.tanggal, tanggal),
        inArray(antrianTable.status, [...STATUS_AKTIF]),
      )
    )
    .orderBy(asc(antrianTable.nomorAntrian));

  const antrianSaya = antrianAktifList[0] ?? null;

  if (!antrianSaya) {
    res.status(404).json({ pesan: "Tidak ada antrian aktif hari ini" });
    return;
  }

  // Ambil info cabang jika ada
  let infoCabang = null;
  if (antrianSaya.cabangId) {
    const [cabang] = await db
      .select({ id: cabangTable.id, nama: cabangTable.nama, kode: cabangTable.kode, alamat: cabangTable.alamat })
      .from(cabangTable)
      .where(eq(cabangTable.id, antrianSaya.cabangId));
    infoCabang = cabang ?? null;
  }

  // Filter posisi per-cabang dan per-jenis-layanan (lebih akurat)
  const filterPosisi = antrianSaya.cabangId
    ? and(
        eq(antrianTable.tanggal, tanggal),
        eq(antrianTable.cabangId, antrianSaya.cabangId),
        eq(antrianTable.jenisLayanan, antrianSaya.jenisLayanan),
        eq(antrianTable.status, "menunggu"),
      )
    : and(
        eq(antrianTable.tanggal, tanggal),
        eq(antrianTable.jenisLayanan, antrianSaya.jenisLayanan),
        eq(antrianTable.status, "menunggu"),
      );

  const [antrianMenungguResult] = await db
    .select({ jumlah: count() })
    .from(antrianTable)
    .where(filterPosisi);

  const antrianMenunggu = await db
    .select({ id: antrianTable.id })
    .from(antrianTable)
    .where(filterPosisi)
    .orderBy(asc(antrianTable.nomorAntrian));

  // Cari yang sedang dipanggil di cabang + jenis layanan yang sama
  const filterDipanggil = antrianSaya.cabangId
    ? and(
        eq(antrianTable.tanggal, tanggal),
        eq(antrianTable.cabangId, antrianSaya.cabangId),
        eq(antrianTable.jenisLayanan, antrianSaya.jenisLayanan),
        eq(antrianTable.status, "dipanggil"),
      )
    : and(
        eq(antrianTable.tanggal, tanggal),
        eq(antrianTable.jenisLayanan, antrianSaya.jenisLayanan),
        eq(antrianTable.status, "dipanggil"),
      );

  const [dipanggilSekarang] = await db
    .select({
      id: antrianTable.id,
      nomorAntrian: antrianTable.nomorAntrian,
      jenisLayanan: antrianTable.jenisLayanan,
      status: antrianTable.status,
    })
    .from(antrianTable)
    .where(filterDipanggil)
    .orderBy(asc(antrianTable.nomorAntrian));

  const posisi = antrianMenunggu.findIndex((a) => a.id === antrianSaya.id) + 1;
  const posisiAktual = posisi > 0 ? posisi - 1 : 0; // 0 = giliran selanjutnya, 1 = ada 1 orang di depan, dst.

  const sedangDipanggil = antrianSaya.status === "dipanggil";
  const estimasiMenit = sedangDipanggil ? 0 : posisiAktual * MENIT_PER_NASABAH;

  // Ambil nama petugas jika ada
  let namaPetugas: string | null = null;
  if (antrianSaya.dilayaniOlehId) {
    const [petugas] = await db
      .select({ nama: nasabahTable.nama })
      .from(nasabahTable)
      .where(eq(nasabahTable.id, antrianSaya.dilayaniOlehId));
    namaPetugas = petugas?.nama ?? null;
  }

  res.json({
    antrian: {
      id: antrianSaya.id,
      nasabahId: antrianSaya.nasabahId,
      cabangId: antrianSaya.cabangId,
      cabang: infoCabang,
      tanggal: antrianSaya.tanggal,
      nomorAntrian: antrianSaya.nomorAntrian,
      jenisLayanan: antrianSaya.jenisLayanan,
      status: antrianSaya.status,
      catatan: antrianSaya.catatan,
      dilayaniOlehId: antrianSaya.dilayaniOlehId,
      namaPetugas,
      createdAt: antrianSaya.createdAt,
      updatedAt: antrianSaya.updatedAt,
      namaNasabah: req.nasabah!.nama,
      noHpNasabah: req.nasabah!.noHp,
    },
    posisi: posisiAktual,
    totalMenunggu: antrianMenungguResult?.jumlah ?? 0,
    sedangDipanggil,
    estimasiMenit,
    dipanggilSekarang: dipanggilSekarang ?? null,
  });
}

router.get("/antrian/saya", requireAuthWithNasabah, handlerStatusSaya);
router.get("/antrian/status-saya", requireAuthWithNasabah, handlerStatusSaya);

/**
 * POST /antrian/ambil (dan alias /antrian) — ambil nomor antrian baru
 */
async function handlerAmbilAntrian(req: any, res: any): Promise<void> {
  const tanggal = getTanggalHariIni();
  const hariIni = getNamaHariIni();
  const nasabahId = req.nasabah!.id;

  const jenisLayanan = req.body?.jenisLayanan ?? "teller";
  const validJenisLayanan = ["teller", "cs"];
  if (!validJenisLayanan.includes(jenisLayanan)) {
    res.status(400).json({ pesan: "Jenis layanan tidak valid. Pilih: teller atau cs" });
    return;
  }

  // Wajib pilih cabang
  const cabangId = req.body?.cabangId ?? null;
  if (!cabangId) {
    res.status(400).json({ pesan: "Cabang wajib dipilih" });
    return;
  }

  // Validasi cabang ada dan aktif
  const [cabang] = await db
    .select()
    .from(cabangTable)
    .where(and(eq(cabangTable.id, cabangId), eq(cabangTable.aktif, true)));

  if (!cabang) {
    res.status(404).json({ pesan: "Cabang tidak ditemukan atau tidak aktif" });
    return;
  }

  const [jadwalAktif] = await db
    .select()
    .from(jadwalOperasionalTable)
    .where(eq(jadwalOperasionalTable.aktif, true));

  if (!jadwalAktif) {
    res.status(400).json({ pesan: "Bank sedang tidak beroperasi" });
    return;
  }

  if (!jadwalAktif.hariBuka.includes(hariIni)) {
    res.status(400).json({ pesan: `Bank tutup hari ini (${hariIni})` });
    return;
  }

  // Cek jam operasional per-cabang
  if (!isJamOperasional(cabang.jamBuka, cabang.jamTutup)) {
    res.status(400).json({
      pesan: `${cabang.nama} saat ini tutup. Jam operasional cabang ini: ${cabang.jamBuka}–${cabang.jamTutup} WIB`,
    });
    return;
  }

  // Cek antrian aktif nasabah hari ini (lintas cabang)
  const [antrianAktif] = await db
    .select({ id: antrianTable.id, status: antrianTable.status })
    .from(antrianTable)
    .where(
      and(
        eq(antrianTable.nasabahId, nasabahId),
        eq(antrianTable.tanggal, tanggal),
        inArray(antrianTable.status, [...STATUS_AKTIF]),
      )
    );

  if (antrianAktif) {
    res.status(409).json({ pesan: "Anda sudah memiliki antrian aktif hari ini" });
    return;
  }

  // Kuota dihitung per-cabang
  const [jumlahAntrianCabangResult] = await db
    .select({ jumlah: count() })
    .from(antrianTable)
    .where(
      and(
        eq(antrianTable.tanggal, tanggal),
        eq(antrianTable.cabangId, cabangId),
      )
    );

  const jumlahAntrianCabang = Number(jumlahAntrianCabangResult?.jumlah ?? 0);

  if (jumlahAntrianCabang >= jadwalAktif.kuotaPerHari) {
    res.status(400).json({ pesan: `Kuota antrian di ${cabang.nama} hari ini sudah penuh` });
    return;
  }

  // Nomor antrian unik per cabang + per jenis layanan
  const [jumlahPerLayananResult] = await db
    .select({ jumlah: count() })
    .from(antrianTable)
    .where(
      and(
        eq(antrianTable.tanggal, tanggal),
        eq(antrianTable.cabangId, cabangId),
        eq(antrianTable.jenisLayanan, jenisLayanan),
      )
    );

  const nomorAntrian = Number(jumlahPerLayananResult?.jumlah ?? 0) + 1;
  const catatan = typeof req.body?.catatan === "string" ? req.body.catatan : null;

  const [antrianBaru] = await db
    .insert(antrianTable)
    .values({
      nasabahId,
      cabangId,
      tanggal,
      nomorAntrian,
      jenisLayanan,
      status: "menunggu",
      catatan,
    })
    .returning();

  res.status(201).json({
    antrian: {
      ...antrianBaru,
      cabang: { id: cabang.id, nama: cabang.nama, kode: cabang.kode },
      namaNasabah: req.nasabah!.nama,
      noHpNasabah: req.nasabah!.noHp,
    },
    posisi: nomorAntrian,
  });
}

router.post("/antrian", requireAuthWithNasabah, handlerAmbilAntrian);
router.post("/antrian/ambil", requireAuthWithNasabah, handlerAmbilAntrian);

/**
 * PUT /antrian/:id/batal dan DELETE /antrian/:id — batalkan antrian milik sendiri
 */
async function handlerBatalAntrian(req: any, res: any): Promise<void> {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const nasabahId = req.nasabah!.id;

  const [antrian] = await db
    .select()
    .from(antrianTable)
    .where(eq(antrianTable.id, rawId));

  if (!antrian) {
    res.status(404).json({ pesan: "Antrian tidak ditemukan" });
    return;
  }

  if (antrian.nasabahId !== nasabahId) {
    res.status(403).json({ pesan: "Tidak boleh membatalkan antrian orang lain" });
    return;
  }

  if (["selesai", "dibatalkan"].includes(antrian.status)) {
    res.status(400).json({ pesan: "Antrian sudah selesai atau sudah dibatalkan" });
    return;
  }

  const [updated] = await db
    .update(antrianTable)
    .set({ status: "dibatalkan", updatedAt: new Date() })
    .where(eq(antrianTable.id, rawId))
    .returning();

  res.json({
    antrian: {
      ...updated,
      namaNasabah: req.nasabah!.nama,
      noHpNasabah: req.nasabah!.noHp,
    },
  });
}

router.put("/antrian/:id/batal", requireAuthWithNasabah, handlerBatalAntrian);
router.delete("/antrian/:id", requireAuthWithNasabah, handlerBatalAntrian);

export default router;

/**
 * triggerNotifikasiAntrian — dipanggil setelah admin memanggil nasabah.
 * Mengirim notifikasi WA + push untuk 3 kondisi:
 *   - Giliran sekarang (nasabah yang dipanggil)
 *   - 1 nomor lagi
 *   - 3 nomor lagi
 */
export async function triggerNotifikasiAntrian(idAntrianDipanggil: string) {
  const nowWIB = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const tanggal = nowWIB.toISOString().split("T")[0];

  const [antrianDipanggil] = await db
    .select({
      nomorAntrian: antrianTable.nomorAntrian,
      cabangId: antrianTable.cabangId,
      jenisLayanan: antrianTable.jenisLayanan,
      namaCabang: cabangTable.nama,
      alamatCabang: cabangTable.alamat,
    })
    .from(antrianTable)
    .leftJoin(cabangTable, eq(antrianTable.cabangId, cabangTable.id))
    .where(eq(antrianTable.id, idAntrianDipanggil));

  if (!antrianDipanggil) return;

  const nomorDipanggil = antrianDipanggil.nomorAntrian;
  const namaCabang = antrianDipanggil.namaCabang ?? "Cabang NeoPay";
  const alamatCabang = antrianDipanggil.alamatCabang ?? "-";

  const jenisLabel = (jenis: string) =>
    jenis === "cs" ? "Customer Service" : "Teller";

  type KondisiNotif = {
    offset: number;
    statusFilter?: string;
    judul: string;
    pesanWA: (nama: string, nomor: number, jenis: string) => string;
    pesanPush: (nomor: number, jenis: string) => string;
    tipe: string;
  };

  const kondisiList: KondisiNotif[] = [
    {
      offset: 1,
      statusFilter: "menunggu",
      judul: "⏳ 1 Nomor Lagi!",
      pesanWA: (nama, nomor, jenis) => {
        const nomorFormatted = `${jenis === "cs" ? "CS" : "T"}-${String(nomor).padStart(3, "0")}`;
        const nomorDipanggilFormatted = `${jenis === "cs" ? "CS" : "T"}-${String(nomorDipanggil).padStart(3, "0")}`;
        return (
          `⏳ *TINGGAL 1 NOMOR LAGI!*\n\n` +
          `Halo *${nama}*, giliran Anda hampir tiba!\n\n` +
          `*Detail Antrian:*\n` +
          `• Nomor Anda          : *${nomorFormatted}*\n` +
          `• Nomor Baru Dipanggil: *${nomorDipanggilFormatted}*\n` +
          `• Layanan             : *${jenisLabel(jenis)}*\n` +
          `• Cabang              : *${namaCabang}*\n` +
          `• Alamat              : ${alamatCabang}\n\n` +
          `Segera bersiap di dekat loket. Giliran Anda berikutnya!\n\n` +
          `— *NeoPay*`
        );
      },
      pesanPush: (nomor, jenis) => {
        const nomorDipanggilFormatted = `${jenis === "cs" ? "CS" : "T"}-${String(nomorDipanggil).padStart(3, "0")}`;
        return `${nomorDipanggilFormatted} baru dipanggil. Anda giliran berikutnya, segera bersiap!`;
      },
      tipe: "antrian_satu_lagi",
    },
    {
      offset: 3,
      statusFilter: "menunggu",
      judul: "🔔 Giliran Hampir Tiba!",
      pesanWA: (nama, nomor, jenis) => {
        const nomorFormatted = `${jenis === "cs" ? "CS" : "T"}-${String(nomor).padStart(3, "0")}`;
        const nomorDipanggilFormatted = `${jenis === "cs" ? "CS" : "T"}-${String(nomorDipanggil).padStart(3, "0")}`;
        return (
          `🔔 *GILIRAN ANDA HAMPIR TIBA!*\n\n` +
          `Halo *${nama}*, nomor antrian Anda semakin dekat!\n\n` +
          `*Detail Antrian:*\n` +
          `• Nomor Anda          : *${nomorFormatted}*\n` +
          `• Nomor Baru Dipanggil: *${nomorDipanggilFormatted}*\n` +
          `• Layanan             : *${jenisLabel(jenis)}*\n` +
          `• Cabang              : *${namaCabang}*\n` +
          `• Alamat              : ${alamatCabang}\n` +
          `• Estimasi Tunggu     : *~${3 * 8} menit lagi*\n\n` +
          `Harap bersiap dan tidak jauh dari area loket.\n\n` +
          `— *NeoPay*`
        );
      },
      pesanPush: (nomor, jenis) => {
        const nomorDipanggilFormatted = `${jenis === "cs" ? "CS" : "T"}-${String(nomorDipanggil).padStart(3, "0")}`;
        return `${nomorDipanggilFormatted} dipanggil. 3 antrian lagi giliran Anda, harap bersiap!`;
      },
      tipe: "antrian_hampir",
    },
  ];

  await Promise.all(
    kondisiList.map(async (kondisi) => {
      const nomorTarget = nomorDipanggil + kondisi.offset;

      const whereClause = and(
        eq(antrianTable.tanggal, tanggal),
        eq(antrianTable.cabangId, antrianDipanggil.cabangId!),
        eq(antrianTable.jenisLayanan, antrianDipanggil.jenisLayanan),
        eq(antrianTable.nomorAntrian, nomorTarget),
        ...(kondisi.statusFilter
          ? [eq(antrianTable.status, kondisi.statusFilter)]
          : []),
      );

      const [antrianTarget] = await db
        .select({
          nasabahId: antrianTable.nasabahId,
          nomorAntrian: antrianTable.nomorAntrian,
          jenisLayanan: antrianTable.jenisLayanan,
        })
        .from(antrianTable)
        .where(whereClause);

      if (!antrianTarget) return;

      const [nasabahTarget] = await db
        .select()
        .from(nasabahTable)
        .where(eq(nasabahTable.id, antrianTarget.nasabahId));

      if (!nasabahTarget) return;

      const jenis = antrianTarget.jenisLayanan ?? "teller";
      const nomor = antrianTarget.nomorAntrian;

      await kirimPesanWA(nasabahTarget.noHp, kondisi.pesanWA(nasabahTarget.nama, nomor, jenis));

      if (nasabahTarget.oneSignalPlayerId) {
        await kirimPushNotif({
          playerIds: [nasabahTarget.oneSignalPlayerId],
          judul: kondisi.judul,
          isi: kondisi.pesanPush(nomor, jenis),
          data: { tipe: kondisi.tipe, nomorSaya: nomorTarget },
        });
      }
    }),
  );
}
