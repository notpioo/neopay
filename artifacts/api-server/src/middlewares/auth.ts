import { Request, Response, NextFunction } from "express";
import { verifikasiToken } from "../lib/supabase";
import { db, nasabahTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      nasabah?: typeof nasabahTable.$inferSelect;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ pesan: "Token autentikasi diperlukan" });
    return;
  }

  const token = authHeader.split(" ")[1];
  const user = await verifikasiToken(token);

  if (!user) {
    res.status(401).json({ pesan: "Token tidak valid atau kadaluarsa" });
    return;
  }

  req.user = user;
  next();
}

export async function requireAuthWithNasabah(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ pesan: "Token autentikasi diperlukan" });
    return;
  }

  const token = authHeader.split(" ")[1];
  const user = await verifikasiToken(token);

  if (!user) {
    res.status(401).json({ pesan: "Token tidak valid atau kadaluarsa" });
    return;
  }

  req.user = user;

  const [nasabah] = await db
    .select()
    .from(nasabahTable)
    .where(eq(nasabahTable.supabaseUserId, user.id));

  if (!nasabah) {
    res.status(404).json({ pesan: "Profil nasabah tidak ditemukan" });
    return;
  }

  if (!nasabah.aktif) {
    res.status(403).json({ pesan: "Akun Anda telah dinonaktifkan. Hubungi admin untuk informasi lebih lanjut." });
    return;
  }

  req.nasabah = nasabah;
  next();
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ pesan: "Token autentikasi diperlukan" });
    return;
  }

  const token = authHeader.split(" ")[1];
  const user = await verifikasiToken(token);

  if (!user) {
    res.status(401).json({ pesan: "Token tidak valid atau kadaluarsa" });
    return;
  }

  const [dbUser] = await db
    .select({ role: nasabahTable.role, nama: nasabahTable.nama, id: nasabahTable.id })
    .from(nasabahTable)
    .where(eq(nasabahTable.supabaseUserId, user.id));

  const role = dbUser?.role ?? user.app_metadata?.role;
  if (role !== "admin") {
    res.status(403).json({ pesan: "Akses ditolak. Hanya admin yang diizinkan." });
    return;
  }

  req.user = user;
  req.nasabah = dbUser as any;
  next();
}

export async function requireTellerAtauAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ pesan: "Token autentikasi diperlukan" });
    return;
  }

  const token = authHeader.split(" ")[1];
  const user = await verifikasiToken(token);

  if (!user) {
    res.status(401).json({ pesan: "Token tidak valid atau kadaluarsa" });
    return;
  }

  const [dbUser] = await db
    .select()
    .from(nasabahTable)
    .where(eq(nasabahTable.supabaseUserId, user.id));

  const role = dbUser?.role ?? user.app_metadata?.role;
  if (role !== "admin" && role !== "teller") {
    res.status(403).json({ pesan: "Akses ditolak. Hanya teller atau admin yang diizinkan." });
    return;
  }

  req.user = user;
  req.nasabah = dbUser;
  next();
}
