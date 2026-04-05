import { logger } from "./logger";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = path.resolve(__dirname, "../../wa-session");

type WAStatus = "tidak_terhubung" | "menunggu_qr" | "terhubung";

interface WAState {
  status: WAStatus;
  qr: string | null;
  nomorWA: string | null;
  sock: unknown | null;
  saveCreds: (() => Promise<void>) | null;
}

const state: WAState = {
  status: "tidak_terhubung",
  qr: null,
  nomorWA: null,
  sock: null,
  saveCreds: null,
};

export function getStatusWA() {
  return {
    terhubung: state.status === "terhubung",
    status: state.status,
    nomorWA: state.nomorWA,
  };
}

export function getQrWA() {
  return state.qr;
}

export async function inisialisasiWA() {
  try {
    const {
      default: makeWASocket,
      useMultiFileAuthState,
      DisconnectReason,
      fetchLatestBaileysVersion,
      makeCacheableSignalKeyStore,
    } = await import("@whiskeysockets/baileys");

    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }

    const { state: authState, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    state.saveCreds = saveCreds;

    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: {
        creds: authState.creds,
        keys: makeCacheableSignalKeyStore(authState.keys, logger as Parameters<typeof makeCacheableSignalKeyStore>[1]),
      },
      printQRInTerminal: false,
      logger: logger.child({ module: "baileys" }) as Parameters<typeof makeWASocket>[0]["logger"],
    });

    state.sock = sock;
    state.status = "menunggu_qr";

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        state.qr = qr;
        state.status = "menunggu_qr";
        logger.info("QR code WhatsApp tersedia untuk di-scan");
      }

      if (connection === "close") {
        const shouldReconnect =
          (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode !==
          DisconnectReason.loggedOut;

        state.status = "tidak_terhubung";
        state.nomorWA = null;

        if (shouldReconnect) {
          logger.info("Koneksi WhatsApp terputus, mencoba reconnect...");
          setTimeout(() => inisialisasiWA(), 5000);
        } else {
          logger.info("WhatsApp logout, hapus session dan reconnect");
          fs.rmSync(SESSION_DIR, { recursive: true, force: true });
          setTimeout(() => inisialisasiWA(), 3000);
        }
      }

      if (connection === "open") {
        state.status = "terhubung";
        state.qr = null;
        state.nomorWA = sock.user?.id?.split(":")[0] ?? null;
        logger.info({ nomorWA: state.nomorWA }, "WhatsApp terhubung");
      }
    });

    sock.ev.on("creds.update", saveCreds);
  } catch (err) {
    logger.error({ err }, "Gagal inisialisasi WhatsApp");
  }
}

export async function tutupWA(): Promise<void> {
  if (state.sock) {
    try {
      const sock = state.sock as { end: (error?: Error) => void };
      sock.end(undefined);
    } catch {
      // abaikan error saat menutup socket
    }
    state.sock = null;
    state.status = "tidak_terhubung";
    logger.info("Koneksi WhatsApp ditutup (graceful shutdown)");
  }
}

export async function kirimPesanWA(nomorHp: string, pesan: string): Promise<boolean> {
  if (state.status !== "terhubung" || !state.sock) {
    logger.warn("WhatsApp belum terhubung, pesan tidak terkirim");
    return false;
  }

  try {
    const nomor = nomorHp.replace(/\D/g, "");
    const jid = nomor.startsWith("0")
      ? `62${nomor.slice(1)}@s.whatsapp.net`
      : `${nomor}@s.whatsapp.net`;

    const sock = state.sock as {
      sendMessage: (jid: string, content: { text: string }) => Promise<unknown>;
    };

    await sock.sendMessage(jid, { text: pesan });
    logger.info({ nomor, pesan }, "Pesan WhatsApp terkirim");
    return true;
  } catch (err) {
    logger.error({ err, nomorHp }, "Gagal kirim pesan WhatsApp");
    return false;
  }
}
