import { bigint, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tipeTransaksiEnum = ["transfer_masuk", "transfer_keluar", "top_up"] as const;
export type TipeTransaksi = typeof tipeTransaksiEnum[number];

export const transaksiTable = pgTable("transaksi", {
  id: uuid("id").primaryKey().defaultRandom(),
  nasabahId: uuid("nasabah_id").notNull(),
  lawanId: uuid("lawan_id"),
  tipe: text("tipe").$type<TipeTransaksi>().notNull(),
  jumlah: bigint("jumlah", { mode: "number" }).notNull(),
  saldoSebelum: bigint("saldo_sebelum", { mode: "number" }).notNull(),
  saldoSesudah: bigint("saldo_sesudah", { mode: "number" }).notNull(),
  keterangan: text("keterangan"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const selectTransaksiSchema = createSelectSchema(transaksiTable);
export type Transaksi = typeof transaksiTable.$inferSelect;
