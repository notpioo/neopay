import { pgTable, text, integer, timestamp, uuid, date } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { nasabahTable } from "./nasabah";
import { cabangTable } from "./cabang";

export const statusAntrian = ["menunggu", "dipanggil", "sedang_dilayani", "selesai", "dibatalkan"] as const;
export type StatusAntrian = typeof statusAntrian[number];

export const jenisLayanan = ["teller", "cs"] as const;
export type JenisLayanan = typeof jenisLayanan[number];

export const antrianTable = pgTable("antrian", {
  id: uuid("id").primaryKey().defaultRandom(),
  nasabahId: uuid("nasabah_id")
    .notNull()
    .references(() => nasabahTable.id),
  cabangId: uuid("cabang_id")
    .references(() => cabangTable.id),
  tanggal: date("tanggal").notNull(),
  nomorAntrian: integer("nomor_antrian").notNull(),
  jenisLayanan: text("jenis_layanan", { enum: jenisLayanan }).notNull().default("teller"),
  status: text("status", { enum: statusAntrian }).notNull().default("menunggu"),
  catatan: text("catatan"),
  dilayaniOlehId: uuid("dilayani_oleh_id").references(() => nasabahTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertAntrianSchema = createInsertSchema(antrianTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectAntrianSchema = createSelectSchema(antrianTable);

export type InsertAntrian = z.infer<typeof insertAntrianSchema>;
export type Antrian = typeof antrianTable.$inferSelect;
