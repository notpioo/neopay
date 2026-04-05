import { Router, type IRouter } from "express";
import { db, nasabahTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { supabase } from "../lib/supabase";
import { DaftarBody, MasukBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/daftar", async (req, res): Promise<void> => {
  const parsed = DaftarBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ pesan: parsed.error.message });
    return;
  }

  const { nama, email, password, noHp, nik, tanggalLahir } = parsed.data;

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    req.log.error({ authError }, "Gagal daftar Supabase");
    res.status(400).json({ pesan: authError?.message ?? "Gagal membuat akun" });
    return;
  }

  const userId = authData.user.id;

  // Generate nomor rekening 8 digit: DDMM + 4 digit acak
  // Contoh: lahir 15-03-2001 → "1503" + "7842" = "15037842"
  const [tahun, bulan, hari] = tanggalLahir.split("-");
  const noRekeningBaru = `${hari}${bulan}${String(Math.floor(Math.random() * 10_000)).padStart(4, "0")}`;

  const [nasabahBaru] = await db
    .insert(nasabahTable)
    .values({
      supabaseUserId: userId,
      nama,
      email,
      noHp,
      nik: nik ?? null,
      tanggalLahir,
      noRekening: noRekeningBaru,
      saldo: 0,
    })
    .returning();

  const { data: sessionData } = await supabase.auth.signInWithPassword({ email, password });
  const token = sessionData?.session?.access_token ?? "";

  res.status(201).json({
    token,
    nasabah: nasabahBaru,
  });
});

router.post("/masuk", async (req, res): Promise<void> => {
  const parsed = MasukBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ pesan: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (authError || !authData.user || !authData.session) {
    const msg = authError?.message?.toLowerCase() ?? "";
    if (msg.includes("banned") || msg.includes("user is banned")) {
      res.status(403).json({ pesan: "Akun Anda telah dinonaktifkan. Hubungi admin untuk informasi lebih lanjut." });
    } else {
      res.status(401).json({ pesan: "Email atau password salah" });
    }
    return;
  }

  let [nasabah] = await db
    .select()
    .from(nasabahTable)
    .where(eq(nasabahTable.supabaseUserId, authData.user.id));

  if (!nasabah) {
    const namaFromEmail = (authData.user.email ?? "").split("@")[0] ?? "Pengguna";
    const noRekeningAuto = "8" + String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, "0");
    [nasabah] = await db
      .insert(nasabahTable)
      .values({
        supabaseUserId: authData.user.id,
        nama: namaFromEmail,
        email: authData.user.email ?? "",
        noHp: "",
        noRekening: noRekeningAuto,
      })
      .returning();
  }

  if (!nasabah.aktif) {
    res.status(403).json({ pesan: "Akun Anda telah dinonaktifkan. Hubungi admin untuk informasi lebih lanjut." });
    return;
  }

  res.json({
    token: authData.session.access_token,
    nasabah: nasabah ?? null,
  });
});

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  const [nasabah] = await db
    .select()
    .from(nasabahTable)
    .where(eq(nasabahTable.supabaseUserId, req.user!.id));

  res.json({ nasabah: nasabah ?? null });
});

export default router;
