import { bigint, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { nasabahTable } from "./nasabah";

export const permintaanTable = pgTable("permintaan", {
  id: uuid("id").primaryKey().defaultRandom(),
  pembuatId: uuid("pembuat_id").notNull().references(() => nasabahTable.id),
  pembayarId: uuid("pembayar_id").references(() => nasabahTable.id),
  jumlah: bigint("jumlah", { mode: "number" }).notNull(),
  keterangan: text("keterangan"),
  kode: text("kode").unique().notNull(),
  status: text("status").$type<"menunggu" | "selesai" | "kadaluarsa">().notNull().default("menunggu"),
  expiredAt: timestamp("expired_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
