import { logger } from "./logger";

const ONE_SIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONE_SIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

export async function kirimPushNotif(params: {
  playerIds: string[];
  judul: string;
  isi: string;
  data?: Record<string, unknown>;
}): Promise<boolean> {
  if (!ONE_SIGNAL_APP_ID || !ONE_SIGNAL_API_KEY) {
    logger.warn("OneSignal belum dikonfigurasi, notifikasi dilewati");
    return false;
  }

  if (params.playerIds.length === 0) {
    return false;
  }

  try {
    const body = {
      app_id: ONE_SIGNAL_APP_ID,
      include_player_ids: params.playerIds,
      headings: { id: params.judul, en: params.judul },
      contents: { id: params.isi, en: params.isi },
      data: params.data ?? {},
    };

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONE_SIGNAL_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error({ errText, status: response.status }, "Gagal kirim push notif OneSignal");
      return false;
    }

    logger.info({ playerIds: params.playerIds }, "Push notifikasi terkirim");
    return true;
  } catch (err) {
    logger.error({ err }, "Error kirim push notif");
    return false;
  }
}
