import { pgTable, text, boolean, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cabangTable = pgTable("cabang", {
  id: uuid("id").primaryKey().defaultRandom(),
  nama: text("nama").notNull(),
  kode: text("kode").notNull().unique(),
  alamat: text("alamat"),
  aktif: boolean("aktif").notNull().default(true),
  jamBuka: text("jam_buka").notNull().default("08:00"),
  jamTutup: text("jam_tutup").notNull().default("15:00"),
});

export const insertCabangSchema = createInsertSchema(cabangTable).omit({ id: true });
export const selectCabangSchema = createSelectSchema(cabangTable);

export type InsertCabang = z.infer<typeof insertCabangSchema>;
export type Cabang = typeof cabangTable.$inferSelect;
