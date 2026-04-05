import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, jadwalOperasionalTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/jadwal", async (_req, res): Promise<void> => {
  const [jadwalAktif] = await db
    .select()
    .from(jadwalOperasionalTable)
    .where(eq(jadwalOperasionalTable.aktif, true));

  if (!jadwalAktif) {
    res.status(404).json({ pesan: "Tidak ada jadwal aktif. Bank sedang tidak beroperasi." });
    return;
  }

  res.json(jadwalAktif);
});

export default router;
