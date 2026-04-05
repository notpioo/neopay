import { Router, type IRouter } from "express";
import { db, nasabahTable, antrianTable, cabangTable, transaksiTable, permintaanTable } from "@workspace/db";
import { eq, desc, and, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { requireAuthWithNasabah } from "../middlewares/auth";
import { UpdateProfilBody, DaftarNotifBody, SetPinBody, UbahPinBody, TransferBody } from "@workspace/api-zod";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(pin, salt, 32)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

async function verifikasiPin(storedHash: string, inputPin: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(":");
  const inputHash = (await scryptAsync(inputPin, salt, 32)) as Buffer;
  return timingSafeEqual(Buffer.from(hash, "hex"), inputHash);
}

export { verifikasiPin };

const router: IRouter = Router();

router.get("/nasabah/profil", requireAuthWithNasabah, async (req, res): Promise<void> => {
  res.json(req.nasabah);
});

router.put("/nasabah/profil", requireAuthWithNasabah, async (req, res): Promise<void> => {
  const parsed = UpdateProfilBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ pesan: parsed.error.message });
    return;
  }

  const nasabahId = req.nasabah!.id;
  const updateData: { nama?: string; noHp?: string; nik?: string; noRekening?: string; updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (parsed.data.nama) updateData.nama = parsed.data.nama;
  if (parsed.data.noHp) updateData.noHp = parsed.data.noHp;

  const [updated] = await db
    .update(nasabahTable)
    .set(updateData)
    .where(eq(nasabahTable.id, nasabahId))
    .returning();

  res.json(updated);
});

router.post("/nasabah/daftar-notif", requireAuthWithNasabah, async (req, res): Promise<void> => {
  const parsed = DaftarNotifBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ pesan: parsed.error.message });
    return;
  }

  const nasabahId = req.nasabah!.id;

  await db
    .update(nasabahTable)
    .set({ oneSignalPlayerId: parsed.data.playerId, updatedAt: new Date() })
    .where(eq(nasabahTable.id, nasabahId));

  res.json({ pesan: "Berhasil mendaftarkan notifikasi push" });
});

router.get("/nasabah/cek-rekening", requireAuthWithNasabah, async (req, res): Promise<void> => {
  const noRekening = req.query.noRekening as string | undefined;

  if (!noRekening) {
    res.status(400).json({ pesan: "Parameter noRekening wajib diisi." });
    return;
  }

  const [penerima] = await db
    .select({
      id: nasabahTable.id,
      nama: nasabahTable.nama,
      noRekening: nasabahTable.noRekening,
      aktif: nasabahTable.aktif,
    })
    .from(nasabahTable)
    .where(eq(nasabahTable.noRekening, noRekening))
    .limit(1);

  if (!penerima) {
    res.status(404).json({ pesan: "Nomor rekening tidak ditemukan." });
    return;
  }

  if (penerima.id === req.nasabah!.id) {
    res.status(400).json({ pesan: "Tidak bisa transfer ke rekening sendiri." });
    return;
  }

  if (!penerima.aktif) {
    res.status(400).json({ pesan: "Rekening tujuan tidak aktif." });
    return;
  }

  res.json({ nama: penerima.nama, noRekening: penerima.noRekening });
});

router.post("/nasabah/transfer", requireAuthWithNasabah, async (req, res): Promise<void> => {
  const parsed = TransferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ pesan: parsed.error.message });
    return;
  }

  const nasabah = req.nasabah!;

  if (!nasabah.pin) {
    res.status(400).json({ pesan: "PIN transaksi belum diset. Harap buat PIN terlebih dahulu." });
    return;
  }

  if (nasabah.pinLockedUntil && new Date() < new Date(nasabah.pinLockedUntil)) {
    res.status(400).json({ pesan: "Akun terkunci sementara karena terlalu banyak percobaan PIN salah. Coba lagi nanti." });
    return;
  }

  const pinValid = await verifikasiPin(nasabah.pin, parsed.data.pin);

  if (!pinValid) {
    const attempts = (nasabah.pinAttempts ?? 0) + 1;
    const locked = attempts >= 3;
    await db
      .update(nasabahTable)
      .set({
        pinAttempts: attempts,
        pinLockedUntil: locked ? new Date(Date.now() + 15 * 60 * 1000) : null,
        updatedAt: new Date(),
      })
      .where(eq(nasabahTable.id, nasabah.id));

    res.status(400).json({
      pesan: locked
        ? "PIN salah 3 kali. Akun dikunci selama 15 menit."
        : `PIN salah. Sisa percobaan: ${3 - attempts}`,
    });
    return;
  }

  const { noRekening, jumlah, keterangan } = parsed.data;

  const [tujuan] = await db
    .select()
    .from(nasabahTable)
    .where(eq(nasabahTable.noRekening, noRekening))
    .limit(1);

  if (!tujuan) {
    res.status(400).json({ pesan: "Nomor rekening tujuan tidak ditemukan." });
    return;
  }

  if (tujuan.id === nasabah.id) {
    res.status(400).json({ pesan: "Tidak bisa transfer ke rekening sendiri." });
    return;
  }

  if (!tujuan.aktif) {
    res.status(400).json({ pesan: "Rekening tujuan tidak aktif." });
    return;
  }

  const [freshNasabah] = await db.select().from(nasabahTable).where(eq(nasabahTable.id, nasabah.id)).limit(1);

  if (freshNasabah.saldo < jumlah) {
    res.status(400).json({ pesan: "Saldo tidak mencukupi." });
    return;
  }

  let saldoAkhirPengirim = 0;
  let transaksiId = "";
  let transaksiCreatedAt: Date = new Date();

  await db.transaction(async (tx) => {
    const [updatedPengirim] = await tx
      .update(nasabahTable)
      .set({ saldo: freshNasabah.saldo - jumlah, updatedAt: new Date() })
      .where(eq(nasabahTable.id, nasabah.id))
      .returning({ saldo: nasabahTable.saldo });

    const [updatedPenerima] = await tx
      .update(nasabahTable)
      .set({ saldo: tujuan.saldo + jumlah, updatedAt: new Date() })
      .where(eq(nasabahTable.id, tujuan.id))
      .returning({ saldo: nasabahTable.saldo });

    const [transaksiPengirim] = await tx.insert(transaksiTable).values({
      nasabahId: nasabah.id,
      lawanId: tujuan.id,
      tipe: "transfer_keluar",
      jumlah,
      saldoSebelum: freshNasabah.saldo,
      saldoSesudah: updatedPengirim.saldo,
      keterangan: keterangan ?? null,
    }).returning({ id: transaksiTable.id, createdAt: transaksiTable.createdAt });

    await tx.insert(transaksiTable).values({
      nasabahId: tujuan.id,
      lawanId: nasabah.id,
      tipe: "transfer_masuk",
      jumlah,
      saldoSebelum: tujuan.saldo,
      saldoSesudah: updatedPenerima.saldo,
      keterangan: keterangan ?? null,
    });

    saldoAkhirPengirim = updatedPengirim.saldo;
    transaksiId = transaksiPengirim.id;
    transaksiCreatedAt = transaksiPengirim.createdAt;
  });

  await db
    .update(nasabahTable)
    .set({ pinAttempts: 0, updatedAt: new Date() })
    .where(eq(nasabahTable.id, nasabah.id));

  res.json({
    pesan: "Transfer berhasil",
    transaksiId,
    jumlah,
    saldoAkhir: saldoAkhirPengirim,
    createdAt: transaksiCreatedAt,
    penerima: {
      nama: tujuan.nama,
      noRekening: tujuan.noRekening,
    },
  });
});

router.get("/nasabah/transaksi", requireAuthWithNasabah, async (req, res): Promise<void> => {
  const nasabahId = req.nasabah!.id;
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
      namaLawan: lawanTable.nama,
      noRekeningLawan: lawanTable.noRekening,
    })
    .from(transaksiTable)
    .leftJoin(lawanTable, eq(transaksiTable.lawanId, lawanTable.id))
    .where(eq(transaksiTable.nasabahId, nasabahId))
    .orderBy(desc(transaksiTable.createdAt));

  res.json({ data: transaksi, total: transaksi.length });
});

router.post("/nasabah/pin/set", requireAuthWithNasabah, async (req, res): Promise<void> => {
  const parsed = SetPinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ pesan: parsed.error.message });
    return;
  }

  const nasabah = req.nasabah!;

  if (nasabah.pin) {
    res.status(400).json({ pesan: "PIN sudah pernah dibuat. Gunakan fitur ganti PIN." });
    return;
  }

  const pinHash = await hashPin(parsed.data.pin);

  await db
    .update(nasabahTable)
    .set({ pin: pinHash, pinAttempts: 0, updatedAt: new Date() })
    .where(eq(nasabahTable.id, nasabah.id));

  res.json({ pesan: "PIN transaksi berhasil dibuat" });
});

router.put("/nasabah/pin/ubah", requireAuthWithNasabah, async (req, res): Promise<void> => {
  const parsed = UbahPinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ pesan: parsed.error.message });
    return;
  }

  const nasabah = req.nasabah!;

  if (!nasabah.pin) {
    res.status(400).json({ pesan: "PIN belum pernah dibuat. Gunakan fitur set PIN terlebih dahulu." });
    return;
  }

  if (nasabah.pinLockedUntil && new Date() < new Date(nasabah.pinLockedUntil)) {
    res.status(400).json({ pesan: "Akun terkunci sementara karena terlalu banyak percobaan PIN salah. Coba lagi nanti." });
    return;
  }

  const pinValid = await verifikasiPin(nasabah.pin, parsed.data.pinLama);

  if (!pinValid) {
    const attempts = (nasabah.pinAttempts ?? 0) + 1;
    const locked = attempts >= 3;
    await db
      .update(nasabahTable)
      .set({
        pinAttempts: attempts,
        pinLockedUntil: locked ? new Date(Date.now() + 15 * 60 * 1000) : null,
        updatedAt: new Date(),
      })
      .where(eq(nasabahTable.id, nasabah.id));

    res.status(400).json({
      pesan: locked
        ? "PIN salah 3 kali. Akun dikunci selama 15 menit."
        : `PIN lama salah. Sisa percobaan: ${3 - attempts}`,
    });
    return;
  }

  const pinBaruHash = await hashPin(parsed.data.pinBaru);

  await db
    .update(nasabahTable)
    .set({ pin: pinBaruHash, pinAttempts: 0, pinLockedUntil: null, updatedAt: new Date() })
    .where(eq(nasabahTable.id, nasabah.id));

  res.json({ pesan: "PIN transaksi berhasil diubah" });
});

router.get("/nasabah/riwayat", requireAuthWithNasabah, async (req, res): Promise<void> => {
  const nasabahId = req.nasabah!.id;
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
      namaCabang: cabangTable.nama,
      alamatCabang: cabangTable.alamat,
      kodeCabang: cabangTable.kode,
      namaPetugas: petugasTable.nama,
    })
    .from(antrianTable)
    .leftJoin(cabangTable, eq(antrianTable.cabangId, cabangTable.id))
    .leftJoin(petugasTable, eq(antrianTable.dilayaniOlehId, petugasTable.id))
    .where(eq(antrianTable.nasabahId, nasabahId))
    .orderBy(desc(antrianTable.createdAt));

  res.json({
    data: riwayat.map((a) => ({
      ...a,
      namaNasabah: req.nasabah!.nama,
      noHpNasabah: req.nasabah!.noHp,
    })),
    total: riwayat.length,
  });
});

// ── Minta (QR Payment Request) ───────────────────────────────────────────────

function buatKodeMinta(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let kode = "NPY-";
  for (let i = 0; i < 8; i++) {
    kode += chars[Math.floor(Math.random() * chars.length)];
  }
  return kode;
}

router.post("/nasabah/minta", requireAuthWithNasabah, async (req, res): Promise<void> => {
  const nasabah = req.nasabah!;
  const { jumlah, keterangan } = req.body as { jumlah?: number; keterangan?: string };

  if (!jumlah || typeof jumlah !== "number" || jumlah < 1) {
    res.status(400).json({ pesan: "jumlah harus berupa angka minimal 1" });
    return;
  }

  if (!nasabah.noRekening) {
    res.status(400).json({ pesan: "Akun belum memiliki nomor rekening" });
    return;
  }

  let kode = buatKodeMinta();
  let attempts = 0;
  while (attempts < 5) {
    const existing = await db.select({ id: permintaanTable.id }).from(permintaanTable).where(eq(permintaanTable.kode, kode));
    if (existing.length === 0) break;
    kode = buatKodeMinta();
    attempts++;
  }

  const expiredAt = new Date(Date.now() + 30 * 60 * 1000);

  const [permintaan] = await db.insert(permintaanTable).values({
    pembuatId: nasabah.id,
    jumlah,
    keterangan: keterangan ?? null,
    kode,
    expiredAt,
  }).returning();

  res.status(201).json({
    id: permintaan.id,
    kode: permintaan.kode,
    jumlah: permintaan.jumlah,
    keterangan: permintaan.keterangan,
    namaPembuat: nasabah.nama,
    noRekeningPembuat: nasabah.noRekening,
    expiredAt: permintaan.expiredAt,
    status: permintaan.status,
  });
});

router.get("/nasabah/minta/:kode", requireAuthWithNasabah, async (req, res): Promise<void> => {
  const { kode } = req.params;

  const [permintaan] = await db
    .select()
    .from(permintaanTable)
    .where(eq(permintaanTable.kode, kode))
    .limit(1);

  if (!permintaan) {
    res.status(404).json({ pesan: "QR tidak ditemukan" });
    return;
  }

  const sekarang = new Date();
  if (permintaan.status === "selesai") {
    res.status(400).json({ pesan: "QR sudah dibayar sebelumnya" });
    return;
  }
  if (permintaan.status === "kadaluarsa" || sekarang > new Date(permintaan.expiredAt)) {
    res.status(400).json({ pesan: "QR sudah kadaluarsa" });
    return;
  }

  const [pembuat] = await db
    .select({ nama: nasabahTable.nama, noRekening: nasabahTable.noRekening })
    .from(nasabahTable)
    .where(eq(nasabahTable.id, permintaan.pembuatId))
    .limit(1);

  res.json({
    id: permintaan.id,
    kode: permintaan.kode,
    jumlah: permintaan.jumlah,
    keterangan: permintaan.keterangan,
    namaPembuat: pembuat?.nama ?? null,
    noRekeningPembuat: pembuat?.noRekening ?? null,
    expiredAt: permintaan.expiredAt,
    status: permintaan.status,
  });
});

router.post("/nasabah/minta/:kode/bayar", requireAuthWithNasabah, async (req, res): Promise<void> => {
  const { kode } = req.params;
  const { pin } = req.body as { pin?: string };
  const pembayar = req.nasabah!;

  if (!pin) {
    res.status(400).json({ pesan: "PIN wajib diisi" });
    return;
  }

  if (!pembayar.pin) {
    res.status(400).json({ pesan: "PIN transaksi belum diset. Harap buat PIN terlebih dahulu." });
    return;
  }

  if (pembayar.pinLockedUntil && new Date() < new Date(pembayar.pinLockedUntil)) {
    res.status(400).json({ pesan: "Akun terkunci sementara karena terlalu banyak percobaan PIN salah. Coba lagi nanti." });
    return;
  }

  const [permintaan] = await db
    .select()
    .from(permintaanTable)
    .where(eq(permintaanTable.kode, kode))
    .limit(1);

  if (!permintaan) {
    res.status(404).json({ pesan: "QR tidak ditemukan" });
    return;
  }

  if (permintaan.pembuatId === pembayar.id) {
    res.status(400).json({ pesan: "Tidak bisa membayar permintaan sendiri" });
    return;
  }

  const sekarang = new Date();
  if (permintaan.status === "selesai") {
    res.status(400).json({ pesan: "QR sudah dibayar sebelumnya" });
    return;
  }
  if (permintaan.status === "kadaluarsa" || sekarang > new Date(permintaan.expiredAt)) {
    res.status(400).json({ pesan: "QR sudah kadaluarsa" });
    return;
  }

  const pinValid = await verifikasiPin(pembayar.pin, pin);
  if (!pinValid) {
    const attempts = (pembayar.pinAttempts ?? 0) + 1;
    const locked = attempts >= 3;
    await db
      .update(nasabahTable)
      .set({ pinAttempts: attempts, pinLockedUntil: locked ? new Date(Date.now() + 15 * 60 * 1000) : null, updatedAt: new Date() })
      .where(eq(nasabahTable.id, pembayar.id));
    res.status(400).json({
      pesan: locked ? "PIN salah 3 kali. Akun dikunci selama 15 menit." : `PIN salah. Sisa percobaan: ${3 - attempts}`,
    });
    return;
  }

  const [freshPembayar] = await db.select().from(nasabahTable).where(eq(nasabahTable.id, pembayar.id)).limit(1);
  if (freshPembayar.saldo < permintaan.jumlah) {
    res.status(400).json({ pesan: "Saldo tidak mencukupi." });
    return;
  }

  const [pembuat] = await db.select().from(nasabahTable).where(eq(nasabahTable.id, permintaan.pembuatId)).limit(1);
  if (!pembuat || !pembuat.aktif) {
    res.status(400).json({ pesan: "Akun pembuat permintaan tidak aktif" });
    return;
  }

  let saldoAkhirPembayar = 0;

  await db.transaction(async (tx) => {
    const [updatedPembayar] = await tx
      .update(nasabahTable)
      .set({ saldo: freshPembayar.saldo - permintaan.jumlah, updatedAt: new Date() })
      .where(eq(nasabahTable.id, pembayar.id))
      .returning({ saldo: nasabahTable.saldo });

    const [updatedPembuat] = await tx
      .update(nasabahTable)
      .set({ saldo: pembuat.saldo + permintaan.jumlah, updatedAt: new Date() })
      .where(eq(nasabahTable.id, pembuat.id))
      .returning({ saldo: nasabahTable.saldo });

    await tx.insert(transaksiTable).values({
      nasabahId: pembayar.id,
      lawanId: pembuat.id,
      tipe: "transfer_keluar",
      jumlah: permintaan.jumlah,
      saldoSebelum: freshPembayar.saldo,
      saldoSesudah: updatedPembayar.saldo,
      keterangan: permintaan.keterangan ?? `Bayar QR ${permintaan.kode}`,
    });

    await tx.insert(transaksiTable).values({
      nasabahId: pembuat.id,
      lawanId: pembayar.id,
      tipe: "transfer_masuk",
      jumlah: permintaan.jumlah,
      saldoSebelum: pembuat.saldo,
      saldoSesudah: updatedPembuat.saldo,
      keterangan: permintaan.keterangan ?? `Terima QR ${permintaan.kode}`,
    });

    await tx
      .update(permintaanTable)
      .set({ status: "selesai", pembayarId: pembayar.id, updatedAt: new Date() })
      .where(eq(permintaanTable.id, permintaan.id));

    saldoAkhirPembayar = updatedPembayar.saldo;
  });

  await db
    .update(nasabahTable)
    .set({ pinAttempts: 0, updatedAt: new Date() })
    .where(eq(nasabahTable.id, pembayar.id));

  res.json({ pesan: "Pembayaran berhasil", saldoAkhir: saldoAkhirPembayar });
});

export default router;
