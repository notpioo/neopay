import { Router, type IRouter } from "express";
import { db, cabangTable, antrianTable } from "@workspace/db";
import { eq, asc, count, and, inArray } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

const JAM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function validateBodyCabang(body: any): {
  ok: true;
  data: { nama?: string; kode?: string; alamat?: string | null; aktif?: boolean; jamBuka?: string; jamTutup?: string };
} | { ok: false; pesan: string } {
  if (body.nama !== undefined && typeof body.nama !== "string") return { ok: false, pesan: "Nama harus berupa teks" };
  if (body.kode !== undefined && typeof body.kode !== "string") return { ok: false, pesan: "Kode harus berupa teks" };
  if (body.nama !== undefined && body.nama.trim() === "") return { ok: false, pesan: "Nama cabang tidak boleh kosong" };
  if (body.kode !== undefined && body.kode.trim() === "") return { ok: false, pesan: "Kode cabang tidak boleh kosong" };
  if (body.jamBuka !== undefined && !JAM_REGEX.test(body.jamBuka)) return { ok: false, pesan: "Format jam buka tidak valid (HH:MM)" };
  if (body.jamTutup !== undefined && !JAM_REGEX.test(body.jamTutup)) return { ok: false, pesan: "Format jam tutup tidak valid (HH:MM)" };
  return {
    ok: true,
    data: {
      nama: typeof body.nama === "string" ? body.nama.trim() : undefined,
      kode: typeof body.kode === "string" ? body.kode.trim().toUpperCase() : undefined,
      alamat: typeof body.alamat === "string" ? body.alamat.trim() : null,
      aktif: typeof body.aktif === "boolean" ? body.aktif : undefined,
      jamBuka: typeof body.jamBuka === "string" ? body.jamBuka : undefined,
      jamTutup: typeof body.jamTutup === "string" ? body.jamTutup : undefined,
    },
  };
}

/**
 * GET /cabang — daftar semua cabang aktif (publik)
 */
router.get("/cabang", async (_req, res): Promise<void> => {
  const cabangList = await db
    .select()
    .from(cabangTable)
    .where(eq(cabangTable.aktif, true))
    .orderBy(asc(cabangTable.kode));

  res.json({ data: cabangList, total: cabangList.length });
});

/**
 * GET /cabang/:id/antrian — jumlah antrian aktif per jenis layanan di cabang ini
 * Digunakan nasabah saat memilih cabang (info real-time sebelum ambil antrian)
 */
router.get("/cabang/:id/antrian", async (req, res): Promise<void> => {
  const cabangId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const tanggal = new Date().toISOString().split("T")[0];
  const STATUS_AKTIF = ["menunggu", "dipanggil", "sedang_dilayani"] as const;

  const [cabang] = await db
    .select()
    .from(cabangTable)
    .where(eq(cabangTable.id, cabangId));

  if (!cabang) {
    res.status(404).json({ pesan: "Cabang tidak ditemukan" });
    return;
  }

  const jenisLayananList = ["teller", "cs"] as const;
  const result: Record<string, number> = { teller: 0, cs: 0 };

  for (const jenis of jenisLayananList) {
    const [row] = await db
      .select({ jumlah: count() })
      .from(antrianTable)
      .where(
        and(
          eq(antrianTable.cabangId, cabangId),
          eq(antrianTable.tanggal, tanggal),
          eq(antrianTable.jenisLayanan, jenis),
          inArray(antrianTable.status, [...STATUS_AKTIF]),
        )
      );
    result[jenis] = Number(row?.jumlah ?? 0);
  }

  res.json({
    cabang: { id: cabang.id, nama: cabang.nama, kode: cabang.kode, alamat: cabang.alamat },
    tanggal,
    antrian: result,
    totalAktif: result.teller + result.cs,
  });
});

/**
 * GET /admin/cabang — semua cabang termasuk nonaktif (admin only)
 */
router.get("/admin/cabang", requireAdmin, async (_req, res): Promise<void> => {
  const cabangList = await db
    .select()
    .from(cabangTable)
    .orderBy(asc(cabangTable.kode));

  res.json({ data: cabangList, total: cabangList.length });
});

/**
 * POST /admin/cabang — tambah cabang baru (admin)
 */
router.post("/admin/cabang", requireAdmin, async (req, res): Promise<void> => {
  const validation = validateBodyCabang(req.body ?? {});
  if (!validation.ok) { res.status(400).json({ pesan: validation.pesan }); return; }
  const { data } = validation;

  if (!data.nama || !data.kode) {
    res.status(400).json({ pesan: "Nama dan kode cabang wajib diisi" });
    return;
  }

  const [existing] = await db
    .select({ id: cabangTable.id })
    .from(cabangTable)
    .where(eq(cabangTable.kode, data.kode));

  if (existing) {
    res.status(409).json({ pesan: `Kode cabang "${data.kode}" sudah digunakan` });
    return;
  }

  const [cabangBaru] = await db
    .insert(cabangTable)
    .values({
      nama: data.nama,
      kode: data.kode,
      alamat: data.alamat ?? null,
      aktif: data.aktif ?? true,
    })
    .returning();

  res.status(201).json(cabangBaru);
});

/**
 * PUT /admin/cabang/:id — update data cabang (admin)
 */
router.put("/admin/cabang/:id", requireAdmin, async (req, res): Promise<void> => {
  const cabangId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const validation = validateBodyCabang(req.body ?? {});
  if (!validation.ok) { res.status(400).json({ pesan: validation.pesan }); return; }
  const { data } = validation;

  const [cabangAda] = await db
    .select()
    .from(cabangTable)
    .where(eq(cabangTable.id, cabangId));

  if (!cabangAda) {
    res.status(404).json({ pesan: "Cabang tidak ditemukan" });
    return;
  }

  if (data.kode && data.kode !== cabangAda.kode) {
    const [kodeDuplikat] = await db
      .select({ id: cabangTable.id })
      .from(cabangTable)
      .where(eq(cabangTable.kode, data.kode));
    if (kodeDuplikat) {
      res.status(409).json({ pesan: `Kode cabang "${data.kode}" sudah digunakan` });
      return;
    }
  }

  const updateData: Partial<typeof cabangAda> = {};
  if (data.nama !== undefined) updateData.nama = data.nama;
  if (data.kode !== undefined) updateData.kode = data.kode;
  if (data.alamat !== undefined) updateData.alamat = data.alamat;
  if (data.aktif !== undefined) updateData.aktif = data.aktif;
  if (data.jamBuka !== undefined) updateData.jamBuka = data.jamBuka;
  if (data.jamTutup !== undefined) updateData.jamTutup = data.jamTutup;

  const [updated] = await db
    .update(cabangTable)
    .set(updateData)
    .where(eq(cabangTable.id, cabangId))
    .returning();

  res.json(updated);
});

/**
 * DELETE /admin/cabang/:id — nonaktifkan cabang (soft delete, admin)
 */
router.delete("/admin/cabang/:id", requireAdmin, async (req, res): Promise<void> => {
  const cabangId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [cabangAda] = await db
    .select()
    .from(cabangTable)
    .where(eq(cabangTable.id, cabangId));

  if (!cabangAda) {
    res.status(404).json({ pesan: "Cabang tidak ditemukan" });
    return;
  }

  const [updated] = await db
    .update(cabangTable)
    .set({ aktif: false })
    .where(eq(cabangTable.id, cabangId))
    .returning();

  res.json({ pesan: "Cabang berhasil dinonaktifkan", cabang: updated });
});

export default router;
