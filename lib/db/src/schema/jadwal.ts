import { pgTable, text, integer, boolean, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jadwalOperasionalTable = pgTable("jadwal_operasional", {
  id: uuid("id").primaryKey().defaultRandom(),
  hariBuka: text("hari_buka").array().notNull().default(["senin", "selasa", "rabu", "kamis", "jumat"]),
  jamMulai: text("jam_mulai").notNull().default("08:00"),
  jamSelesai: text("jam_selesai").notNull().default("16:00"),
  kuotaPerHari: integer("kuota_per_hari").notNull().default(50),
  aktif: boolean("aktif").notNull().default(true),
  keterangan: text("keterangan"),
});

export const insertJadwalSchema = createInsertSchema(jadwalOperasionalTable).omit({
  id: true,
});

export const selectJadwalSchema = createSelectSchema(jadwalOperasionalTable);

export type InsertJadwal = z.infer<typeof insertJadwalSchema>;
export type Jadwal = typeof jadwalOperasionalTable.$inferSelect;
