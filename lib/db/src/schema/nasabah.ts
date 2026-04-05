import { bigint, boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleEnum = ["nasabah", "teller", "admin"] as const;
export type UserRole = typeof roleEnum[number];

export const nasabahTable = pgTable("nasabah", {
  id: uuid("id").primaryKey().defaultRandom(),
  supabaseUserId: text("supabase_user_id").unique().notNull(),
  nama: text("nama").notNull(),
  noHp: text("no_hp").notNull(),
  email: text("email").notNull(),
  nik: text("nik"),
  noRekening: text("no_rekening"),
  tanggalLahir: text("tanggal_lahir"),
  saldo: bigint("saldo", { mode: "number" }).notNull().default(0),
  role: text("role").$type<UserRole>().notNull().default("nasabah"),
  oneSignalPlayerId: text("one_signal_player_id"),
  pin: text("pin"),
  pinAttempts: integer("pin_attempts").notNull().default(0),
  pinLockedUntil: timestamp("pin_locked_until", { withTimezone: true }),
  aktif: boolean("aktif").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertNasabahSchema = createInsertSchema(nasabahTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectNasabahSchema = createSelectSchema(nasabahTable);

export type InsertNasabah = z.infer<typeof insertNasabahSchema>;
export type Nasabah = typeof nasabahTable.$inferSelect;
