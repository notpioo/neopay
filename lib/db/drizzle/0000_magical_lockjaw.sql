CREATE TABLE "nasabah" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supabase_user_id" text NOT NULL,
	"nama" text NOT NULL,
	"no_hp" text NOT NULL,
	"email" text NOT NULL,
	"nik" text,
	"no_rekening" text,
	"role" text DEFAULT 'nasabah' NOT NULL,
	"one_signal_player_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nasabah_supabase_user_id_unique" UNIQUE("supabase_user_id")
);
--> statement-breakpoint
CREATE TABLE "jadwal_operasional" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hari_buka" text[] DEFAULT '{"senin","selasa","rabu","kamis","jumat"}' NOT NULL,
	"jam_mulai" text DEFAULT '08:00' NOT NULL,
	"jam_selesai" text DEFAULT '16:00' NOT NULL,
	"kuota_per_hari" integer DEFAULT 50 NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"keterangan" text
);
--> statement-breakpoint
CREATE TABLE "antrian" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nasabah_id" uuid NOT NULL,
	"tanggal" date NOT NULL,
	"nomor_antrian" integer NOT NULL,
	"jenis_layanan" text DEFAULT 'teller' NOT NULL,
	"status" text DEFAULT 'menunggu' NOT NULL,
	"catatan" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "antrian" ADD CONSTRAINT "antrian_nasabah_id_nasabah_id_fk" FOREIGN KEY ("nasabah_id") REFERENCES "public"."nasabah"("id") ON DELETE no action ON UPDATE no action;