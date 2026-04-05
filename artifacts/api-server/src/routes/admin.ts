import { Router, type IRouter } from "express";
import { db, antrianTable, jadwalOperasionalTable, nasabahTable, cabangTable, transaksiTable } from "@workspace/db";
import { eq, and, asc, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { requireAdmin, requireTellerAtauAdmin } from "../middlewares/auth";
import { kirimPushNotif } from "../lib/onesignal";
import { kirimPesanWA } from "../lib/whatsapp";
import { triggerNotifikasiAntrian } from "./antrian";
import { getStatusWA, getQrWA, inisialisasiWA } from "../lib/whatsapp";
import { UpdateJadwalBody } from "@workspace/api-zod";

const router: IRouter = Router();

function getTanggalHariIni(): string {
  const nowWIB = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return nowWIB.toISOString().split("T")[0];
}

router.put("/admin/antrian/:id/panggil", requireTellerAtauAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [antrianWithNasabah] = await db
    .select({
      id: antrianTable.id,
      nasabahId: antrianTable.nasabahId,
      tanggal: antrianTable.tanggal,
      nomorAntrian: antrianTable.nomorAntrian,
      jenisLayanan: antrianTable.jenisLayanan,
      status: antrianTable.status,
      catatan: antrianTable.catatan,
      createdAt: antrianTable.createdAt,
      updatedAt: antrianTable.updatedAt,
      namaNasabah: nasabahTable.nama,
      noHpNasabah: nasabahTable.noHp,
      namaCabang: cabangTable.nama,
      alamatCabang: cabangTable.alamat,
    })
    .from(antrianTable)
    .leftJoin(nasabahTable, eq(antrianTable.nasabahId, nasabahTable.id))
    .leftJoin(cabangTable, eq(antrianTable.cabangId, cabangTable.id))
    .where(eq(antrianTable.id, rawId));

  if (!antrianWithNasabah) {
    res.status(404).json({ pesan: "Antrian tidak ditemukan" });
    return;
  }

  if (!["menunggu"].includes(antrianWithNasabah.status)) {
    res.status(400).json({
      pesan: `Antrian tidak bisa dipanggil dari status '${antrianWithNasabah.status}'. Hanya antrian berstatus 'menunggu' yang bisa dipanggil.`,
    });
    return;
  }

  const petugasId = (req as any).nasabah?.id ?? null;
  const namaPetugas = (req as any).nasabah?.nama ?? null;

  const [updated] = await db
    .update(antrianTable)
    .set({ status: "dipanggil", dilayaniOlehId: petugasId, updatedAt: new Date() })
    .where(eq(antrianTable.id, rawId))
    .returning();

  const [nasabah] = await db
    .select()
    .from(nasabahTable)
    .where(eq(nasabahTable.id, updated.nasabahId));

  const loket = antrianWithNasabah.jenisLayanan?.toUpperCase() ?? "Teller";

  if (nasabah) {
    const jenisLabel = antrianWithNasabah.jenisLayanan === "cs" ? "Customer Service" : "Teller";
    const nomorFormatted = `${antrianWithNasabah.jenisLayanan === "cs" ? "CS" : "T"}-${String(antrianWithNasabah.nomorAntrian).padStart(3, "0")}`;
    const namaCabang = antrianWithNasabah.namaCabang ?? "Cabang NeoPay";
    const alamatCabang = antrianWithNasabah.alamatCabang ?? "-";
    const pesanWA =
      `🔔 *GILIRAN ANDA SEKARANG!*\n\n` +
      `Halo *${nasabah.nama}*, nomor antrian Anda baru saja dipanggil.\n\n` +
      `*Detail Antrian:*\n` +
      `• Nomor Antrian : *${nomorFormatted}*\n` +
      `• Layanan       : *${jenisLabel}*\n` +
      `• Cabang        : *${namaCabang}*\n` +
      `• Alamat        : ${alamatCabang}\n` +
      `• Petugas       : *${namaPetugas ?? "–"}*\n\n` +
      `Mohon segera menuju loket. Jika tidak hadir, nomor antrian Anda akan dilewati.\n\n` +
      `— *NeoPay*`;
    await kirimPesanWA(nasabah.noHp, pesanWA);

    if (nasabah.oneSignalPlayerId) {
      await kirimPushNotif({
        playerIds: [nasabah.oneSignalPlayerId],
        judul: "🔔 Giliran Anda Sekarang!",
        isi: `${nomorFormatted} dipanggil — Loket ${loket}. Segera menuju loket!`,
        data: { tipe: "giliran_sekarang", antrianId: rawId },
      });
    }
  }

  await triggerNotifikasiAntrian(rawId);

  res.json({
    antrian: {
      ...updated,
      namaNasabah: antrianWithNasabah.namaNasabah,
      noHpNasabah: antrianWithNasabah.noHpNasabah,
      namaPetugas,
    },
  });
});

router.put("/admin/antrian/:id/selesai", requireTellerAtauAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [antrianWithNasabah] = await db
    .select({
      id: antrianTable.id,
      status: antrianTable.status,
      namaNasabah: nasabahTable.nama,
      noHpNasabah: nasabahTable.noHp,
    })
    .from(antrianTable)
    .leftJoin(nasabahTable, eq(antrianTable.nasabahId, nasabahTable.id))
    .where(eq(antrianTable.id, rawId));

  if (!antrianWithNasabah) {
    res.status(404).json({ pesan: "Antrian tidak ditemukan" });
    return;
  }

  if (!["dipanggil", "sedang_dilayani"].includes(antrianWithNasabah.status)) {
    res.status(400).json({
      pesan: `Antrian tidak bisa diselesaikan dari status '${antrianWithNasabah.status}'.`,
    });
    return;
  }

  const namaPetugas = (req as any).nasabah?.nama ?? null;

  const [updated] = await db
    .update(antrianTable)
    .set({ status: "selesai", updatedAt: new Date() })
    .where(eq(antrianTable.id, rawId))
    .returning();

  res.json({
    antrian: {
      ...updated,
      namaNasabah: antrianWithNasabah.namaNasabah,
      noHpNasabah: antrianWithNasabah.noHpNasabah,
      namaPetugas,
    },
  });
});

router.put("/admin/antrian/:id/skip", requireTellerAtauAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [antrianWithNasabah] = await db
    .select({
      id: antrianTable.id,
      status: antrianTable.status,
      nomorAntrian: antrianTable.nomorAntrian,
      jenisLayanan: antrianTable.jenisLayanan,
      nasabahId: antrianTable.nasabahId,
      namaNasabah: nasabahTable.nama,
      noHpNasabah: nasabahTable.noHp,
      oneSignalPlayerId: nasabahTable.oneSignalPlayerId,
      namaCabang: cabangTable.nama,
      alamatCabang: cabangTable.alamat,
    })
    .from(antrianTable)
    .leftJoin(nasabahTable, eq(antrianTable.nasabahId, nasabahTable.id))
    .leftJoin(cabangTable, eq(antrianTable.cabangId, cabangTable.id))
    .where(eq(antrianTable.id, rawId));

  if (!antrianWithNasabah) {
    res.status(404).json({ pesan: "Antrian tidak ditemukan" });
    return;
  }

  if (!["menunggu", "dipanggil"].includes(antrianWithNasabah.status)) {
    res.status(400).json({
      pesan: `Antrian tidak bisa di-skip dari status '${antrianWithNasabah.status}'.`,
    });
    return;
  }

  const namaPetugas = (req as any).nasabah?.nama ?? null;

  const [updated] = await db
    .update(antrianTable)
    .set({ status: "dibatalkan", updatedAt: new Date() })
    .where(eq(antrianTable.id, rawId))
    .returning();

  // Kirim notifikasi ke nasabah yang dilewati
  if (antrianWithNasabah.noHpNasabah && antrianWithNasabah.namaNasabah) {
    const jenisLabel = antrianWithNasabah.jenisLayanan === "cs" ? "Customer Service" : "Teller";
    const nomorFormatted = `${antrianWithNasabah.jenisLayanan === "cs" ? "CS" : "T"}-${String(antrianWithNasabah.nomorAntrian).padStart(3, "0")}`;
    const namaCabang = antrianWithNasabah.namaCabang ?? "Cabang NeoPay";
    const alamatCabang = antrianWithNasabah.alamatCabang ?? "-";
    const pesanWA =
      `⚠️ *ANTRIAN ANDA DILEWATI*\n\n` +
      `Halo *${antrianWithNasabah.namaNasabah}*, nomor antrian Anda telah dilewati karena tidak hadir saat dipanggil.\n\n` +
      `*Detail Antrian:*\n` +
      `• Nomor Antrian : *${nomorFormatted}*\n` +
      `• Layanan       : *${jenisLabel}*\n` +
      `• Cabang        : *${namaCabang}*\n` +
      `• Alamat        : ${alamatCabang}\n\n` +
      `Jika Anda masih berada di lokasi, silakan hubungi petugas di loket untuk informasi lebih lanjut.\n\n` +
      `Mohon maaf atas ketidaknyamanannya.\n` +
      `— *NeoPay*`;
    await kirimPesanWA(antrianWithNasabah.noHpNasabah, pesanWA);

    if (antrianWithNasabah.oneSignalPlayerId) {
      await kirimPushNotif({
        playerIds: [antrianWithNasabah.oneSignalPlayerId],
        judul: "⚠️ Antrian Anda Dilewati",
        isi: `${nomorFormatted} dilewati karena tidak hadir. Hubungi petugas jika masih di lokasi.`,
        data: { tipe: "antrian_dilewati", antrianId: rawId },
      });
    }
  }

  res.json({
    antrian: {
      ...updated,
      namaNasabah: antrianWithNasabah.namaNasabah,
      noHpNasabah: antrianWithNasabah.noHpNasabah,
      namaPetugas,
    },
  });
});

router.get("/admin/dasbor", requireTellerAtauAdmin, async (req, res): Promise<void> => {
  const tanggal = getTanggalHariIni();
  const cabangIdFilter = typeof req.query.cabangId === "string" ? req.query.cabangId : null;

  const whereBase = cabangIdFilter
    ? and(eq(antrianTable.tanggal, tanggal), eq(antrianTable.cabangId, cabangIdFilter))
    : eq(antrianTable.tanggal, tanggal);

  const semuaAntrian = await db
    .select()
    .from(antrianTable)
    .where(whereBase);

  const menunggu = semuaAntrian.filter((a) => a.status === "menunggu").length;
  const dipanggil = semuaAntrian.filter((a) => a.status === "dipanggil").length;
  const sedangDilayani = semuaAntrian.filter((a) => a.status === "sedang_dilayani").length;
  const selesai = semuaAntrian.filter((a) => a.status === "selesai").length;
  const dibatalkan = semuaAntrian.filter((a) => a.status === "dibatalkan").length;

  const tellerCount = semuaAntrian.filter((a) => a.jenisLayanan === "teller").length;
  const csCount = semuaAntrian.filter((a) => a.jenisLayanan === "cs").length;


  const [antrianAktifRaw] = await db
    .select({
      id: antrianTable.id,
      nasabahId: antrianTable.nasabahId,
      cabangId: antrianTable.cabangId,
      tanggal: antrianTable.tanggal,
      nomorAntrian: antrianTable.nomorAntrian,
      jenisLayanan: antrianTable.jenisLayanan,
      status: antrianTable.status,
      catatan: antrianTable.catatan,
      createdAt: antrianTable.createdAt,
      updatedAt: antrianTable.updatedAt,
      namaNasabah: nasabahTable.nama,
      noHpNasabah: nasabahTable.noHp,
    })
    .from(antrianTable)
    .leftJoin(nasabahTable, eq(antrianTable.nasabahId, nasabahTable.id))
    .where(and(whereBase as any, eq(antrianTable.status, "dipanggil")))
    .orderBy(asc(antrianTable.nomorAntrian));

  res.json({
    tanggal,
    cabangId: cabangIdFilter,
    totalAntrian: semuaAntrian.length,
    menunggu,
    dipanggil,
    sedangDilayani,
    selesai,
    dibatalkan,
    tellerCount,
    csCount,
    antrianAktif: antrianAktifRaw ?? null,
  });
});

router.get("/admin/jadwal", requireAdmin, async (req, res): Promise<void> => {
  const [jadwal] = await db.select().from(jadwalOperasionalTable);
  if (!jadwal) {
    res.status(404).json({ pesan: "Jadwal belum dikonfigurasi" });
    return;
  }
  res.json(jadwal);
});

router.put("/admin/jadwal", requireAdmin, async (req, res): Promise<void> => {
  const parsed = UpdateJadwalBody.safeParse(req.body);
  if (!parsed.success) {
    const pesanError = parsed.error.issues.map((i) => i.message).join("; ");
    res.status(400).json({ pesan: pesanError });
    return;
  }

  const [jadwalAda] = await db.select().from(jadwalOperasionalTable);

  if (jadwalAda) {
    const [updated] = await db
      .update(jadwalOperasionalTable)
      .set(parsed.data)
      .where(eq(jadwalOperasionalTable.id, jadwalAda.id))
      .returning();
    res.json(updated);
  } else {
    const d = parsed.data;
    const [created] = await db
      .insert(jadwalOperasionalTable)
      .values({
        hariBuka: d.hariBuka ?? ["senin", "selasa", "rabu", "kamis", "jumat"],
        jamMulai: d.jamMulai ?? "08:00",
        jamSelesai: d.jamSelesai ?? "16:00",
        kuotaPerHari: d.kuotaPerHari ?? 50,
        aktif: d.aktif ?? true,
        keterangan: d.keterangan ?? null,
      })
      .returning();
    res.json(created);
  }
});

router.get("/admin/wa/status", requireAdmin, async (req, res): Promise<void> => {
  res.json(getStatusWA());
});

router.get("/admin/wa/qr", requireAdmin, async (req, res): Promise<void> => {
  const statusWA = getStatusWA();

  if (statusWA.terhubung) {
    res.status(409).json({ pesan: "WhatsApp sudah terhubung" });
    return;
  }

  const qr = getQrWA();

  if (!qr) {
    inisialisasiWA().catch((err: unknown) => {
      req.log.error({ err }, "Gagal inisialisasi WhatsApp");
    });
    res.json({
      qr: "",
      pesan: "Inisialisasi WhatsApp dimulai. Coba lagi dalam beberapa detik untuk mendapatkan QR code.",
    });
    return;
  }

  res.json({ qr, pesan: "Scan QR code ini dengan aplikasi WhatsApp kamu" });
});

// ── Manajemen User ──────────────────────────────────────────────

router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const users = await db
    .select({
      id: nasabahTable.id,
      nama: nasabahTable.nama,
      email: nasabahTable.email,
      noHp: nasabahTable.noHp,
      nik: nasabahTable.nik,
      noRekening: nasabahTable.noRekening,
      role: nasabahTable.role,
      aktif: nasabahTable.aktif,
      createdAt: nasabahTable.createdAt,
      punyaDevice: nasabahTable.oneSignalPlayerId,
    })
    .from(nasabahTable)
    .orderBy(desc(nasabahTable.createdAt));

  res.json({
    users: users.map((u) => ({ ...u, punyaDevice: !!u.punyaDevice })),
  });
});

const VALID_ROLES = ["nasabah", "teller", "admin"] as const;
type ValidRole = typeof VALID_ROLES[number];

router.patch("/admin/users/:id/role", requireAdmin, async (req, res): Promise<void> => {
  const role = req.body?.role as string;
  if (!role || !VALID_ROLES.includes(role as ValidRole)) {
    res.status(400).json({ pesan: "Role tidak valid. Gunakan: nasabah, teller, atau admin" });
    return;
  }

  const { id } = req.params;

  const [updated] = await db
    .update(nasabahTable)
    .set({ role: role as ValidRole, updatedAt: new Date() })
    .where(eq(nasabahTable.id, id))
    .returning({
      id: nasabahTable.id,
      nama: nasabahTable.nama,
      email: nasabahTable.email,
      role: nasabahTable.role,
    });

  if (!updated) {
    res.status(404).json({ pesan: "User tidak ditemukan" });
    return;
  }

  res.json({ user: updated });
});

router.patch("/admin/users/:id/suspend", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  const aktif = req.body?.aktif;

  if (typeof aktif !== "boolean") {
    res.status(400).json({ pesan: "Field 'aktif' harus boolean (true/false)" });
    return;
  }

  const [updated] = await db
    .update(nasabahTable)
    .set({ aktif, updatedAt: new Date() })
    .where(eq(nasabahTable.id, id))
    .returning({
      id: nasabahTable.id,
      nama: nasabahTable.nama,
      email: nasabahTable.email,
      role: nasabahTable.role,
      aktif: nasabahTable.aktif,
    });

  if (!updated) {
    res.status(404).json({ pesan: "User tidak ditemukan" });
    return;
  }

  res.json({ user: updated });
});

// ── Test Notifikasi ──────────────────────────────────────────────────────────

router.post("/admin/test/wa", requireAdmin, async (req, res): Promise<void> => {
  const { noHp, pesan } = req.body as { noHp?: string; pesan?: string };
  if (!noHp || !pesan) {
    res.status(400).json({ pesan: "noHp dan pesan wajib diisi" });
    return;
  }
  const status = getStatusWA();
  if (status !== "terhubung") {
    res.status(503).json({ pesan: "WhatsApp belum terhubung, harap scan QR terlebih dahulu" });
    return;
  }
  const berhasil = await kirimPesanWA(noHp, pesan);
  if (!berhasil) {
    res.status(500).json({ pesan: "Gagal mengirim pesan WhatsApp" });
    return;
  }
  res.json({ pesan: "Pesan WhatsApp berhasil dikirim" });
});

router.post("/admin/test/push", requireAdmin, async (req, res): Promise<void> => {
  const { target, nasabahId, judul, isi } = req.body as {
    target?: "semua" | "satu";
    nasabahId?: string;
    judul?: string;
    isi?: string;
  };
  if (!target || !judul || !isi) {
    res.status(400).json({ pesan: "target, judul, dan isi wajib diisi" });
    return;
  }

  let playerIds: string[] = [];

  if (target === "semua") {
    const semua = await db
      .select({ pid: nasabahTable.oneSignalPlayerId })
      .from(nasabahTable);
    playerIds = semua.map((n) => n.pid).filter(Boolean) as string[];
  } else {
    if (!nasabahId) {
      res.status(400).json({ pesan: "nasabahId wajib diisi untuk target satu user" });
      return;
    }
    const [nasabah] = await db
      .select({ pid: nasabahTable.oneSignalPlayerId })
      .from(nasabahTable)
      .where(eq(nasabahTable.id, nasabahId));
    if (!nasabah) {
      res.status(404).json({ pesan: "Nasabah tidak ditemukan di database" });
      return;
    }
    if (!nasabah.pid) {
      res.status(422).json({ pesan: "Nasabah ini belum mendaftarkan device (belum login di aplikasi mobile)" });
      return;
    }
    playerIds = [nasabah.pid];
  }

  if (playerIds.length === 0) {
    res.status(422).json({ pesan: "Tidak ada device terdaftar untuk menerima notifikasi" });
    return;
  }

  const berhasil = await kirimPushNotif({ playerIds, judul, isi });
  if (!berhasil) {
    res.status(500).json({ pesan: "Gagal mengirim push notifikasi" });
    return;
  }
  res.json({ pesan: `Push notifikasi berhasil dikirim ke ${playerIds.length} device` });
});

// ── Riwayat Semua (Teller & Admin) ──────────────────────────────────────────

router.get("/admin/transaksi/semua", requireTellerAtauAdmin, async (req, res): Promise<void> => {
  const pengirimTable = alias(nasabahTable, "pengirim");
  const lawanTable = alias(nasabahTable, "lawan");

  const transaksi = await db
    .select({
      id: transaksiTable.id,
      nasabahId: transaksiTable.nasabahId,
      lawanId: transaksiTable.lawanId,
      tipe: transaksiTable.tipe,
      jumlah: transaksiTable.jumlah,
      saldoSebelum: transaksiTable.saldoSebelum,
      saldoSesudah: transaksiTable.saldoSesudah,
      keterangan: transaksiTable.keterangan,
      createdAt: transaksiTable.createdAt,
      namaPengirim: pengirimTable.nama,
      noRekeningPengirim: pengirimTable.noRekening,
      namaLawan: lawanTable.nama,
      noRekeningLawan: lawanTable.noRekening,
    })
    .from(transaksiTable)
    .leftJoin(pengirimTable, eq(transaksiTable.nasabahId, pengirimTable.id))
    .leftJoin(lawanTable, eq(transaksiTable.lawanId, lawanTable.id))
    .orderBy(desc(transaksiTable.createdAt));

  res.json({ data: transaksi, total: transaksi.length });
});

router.get("/admin/antrian/riwayat", requireTellerAtauAdmin, async (req, res): Promise<void> => {
  const petugasTable = alias(nasabahTable, "petugas");

  const riwayat = await db
    .select({
      id: antrianTable.id,
      nasabahId: antrianTable.nasabahId,
      cabangId: antrianTable.cabangId,
      tanggal: antrianTable.tanggal,
      nomorAntrian: antrianTable.nomorAntrian,
      jenisLayanan: antrianTable.jenisLayanan,
      status: antrianTable.status,
      catatan: antrianTable.catatan,
      dilayaniOlehId: antrianTable.dilayaniOlehId,
      createdAt: antrianTable.createdAt,
      updatedAt: antrianTable.updatedAt,
      namaNasabah: nasabahTable.nama,
      noHpNasabah: nasabahTable.noHp,
      namaCabang: cabangTable.nama,
      alamatCabang: cabangTable.alamat,
      kodeCabang: cabangTable.kode,
      namaPetugas: petugasTable.nama,
    })
    .from(antrianTable)
    .leftJoin(nasabahTable, eq(antrianTable.nasabahId, nasabahTable.id))
    .leftJoin(cabangTable, eq(antrianTable.cabangId, cabangTable.id))
    .leftJoin(petugasTable, eq(antrianTable.dilayaniOlehId, petugasTable.id))
    .orderBy(desc(antrianTable.createdAt));

  res.json({ data: riwayat, total: riwayat.length });
});

export default router;
