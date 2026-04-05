import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Maximize2, Minimize2, Building2, Clock } from "lucide-react";

type AntrianItem = {
  id: string;
  nomorAntrian: number;
  jenisLayanan: string;
  status: string;
  cabangId: string | null;
  cabangNama: string | null;
  cabangKode: string | null;
};

type Cabang = {
  id: string;
  nama: string;
  kode: string;
  alamat: string | null;
  jamBuka: string;
  jamTutup: string;
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getWIBClock() {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const iso = wib.toISOString();
  const date = iso.slice(0, 10);
  const time = iso.slice(11, 19);
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const dayName = days[new Date().getDay()] ?? "";
  return { date, time, dayName };
}

async function fetchPublic(path: string) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function isBuka(jamBuka: string, jamTutup: string): boolean {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const nowMenit = now.getUTCHours() * 60 + now.getUTCMinutes();
  const [bH, bM] = jamBuka.split(":").map(Number);
  const [tH, tM] = jamTutup.split(":").map(Number);
  return nowMenit >= (bH ?? 8) * 60 + (bM ?? 0) && nowMenit < (tH ?? 15) * 60 + (tM ?? 0);
}

// ─── Palet warna ──────────────────────────────────────────────────────────────
const PRIMARY      = "#1B988D";
const PRIMARY_DARK = "#146e66";
const PRIMARY_LT   = "#e8f9f7";
const PRIMARY_MID  = "#b2e8e4";
const BG           = "#f0f7f6";
const CARD         = "#ffffff";
const BORDER       = "#d4eeeb";
const TEXT         = "#0d3533";
const MUTED        = "#6b9e9a";

export default function Display() {
  const [antrian, setAntrian]               = useState<AntrianItem[]>([]);
  const [cabangList, setCabangList]         = useState<Cabang[]>([]);
  const [clock, setClock]                   = useState(getWIBClock());
  const [lastRefresh, setLastRefresh]       = useState<Date | null>(null);
  const [isFullscreen, setIsFullscreen]     = useState(false);
  const [selectedCabang, setSelectedCabang] = useState<string>("");
  const [loading, setLoading]               = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [antrianRes, cabangRes] = await Promise.all([
        fetchPublic("/api/antrian/hari-ini"),
        fetchPublic("/api/cabang"),
      ]);
      setAntrian(antrianRes.data ?? []);
      setCabangList(cabangRes.data ?? []);
      setLastRefresh(new Date());
    } catch { /* silent retry */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const id = setInterval(fetchData, 10_000); return () => clearInterval(id); }, [fetchData]);
  useEffect(() => { const id = setInterval(() => setClock(getWIBClock()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  const cabangToShow = selectedCabang ? cabangList.filter(c => c.id === selectedCabang) : cabangList;
  const cabangStats  = cabangToShow.map(cabang => {
    const antrianCabang = antrian.filter(a => a.cabangId === cabang.id);
    const layananStats  = (["teller", "cs"] as const).map(jenis => {
      const list      = antrianCabang.filter(a => a.jenisLayanan === jenis);
      const dipanggil = list.find(a => a.status === "dipanggil" || a.status === "sedang_dilayani");
      const menunggu  = list.filter(a => a.status === "menunggu").length;
      return { jenis, dipanggil, menunggu };
    });
    return { cabang, layananStats };
  });

  const lastRefreshStr = lastRefresh
    ? lastRefresh.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "-";

  const isSingle = selectedCabang !== "" && cabangStats.length === 1;

  return (
    <div className="flex flex-col select-none" style={{
      height: "100dvh", overflow: "hidden",
      background: BG, color: TEXT, fontFamily: "Inter, sans-serif",
    }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header className="flex-shrink-0 flex items-center justify-between" style={{
        height: "clamp(68px, 10vh, 96px)",
        padding: "0 clamp(16px, 2vw, 32px)",
        background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`,
        boxShadow: "0 3px 18px rgba(27,152,141,0.35)",
      }}>

        {/* Brand */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="rounded-xl flex items-center justify-center flex-shrink-0" style={{
            width: "clamp(44px, 5.5vh, 58px)", height: "clamp(44px, 5.5vh, 58px)",
            background: "rgba(255,255,255,0.18)",
          }}>
            <img src="/neopay-logo.png" alt="NeoPay"
              style={{ width: "72%", height: "72%", objectFit: "contain" }} />
          </div>
          <div>
            <div className="font-black text-white" style={{
              fontSize: "clamp(20px, 3vh, 30px)", lineHeight: 1.1,
            }}>NeoPay</div>
            <div style={{
              fontSize: "clamp(12px, 1.5vh, 15px)",
              color: "rgba(255,255,255,0.82)",
              letterSpacing: "0.08em",
              fontWeight: 600,
            }}>Layar Antrian Digital</div>
          </div>
        </div>

        {/* Cabang filter */}
        <div className="flex items-center flex-wrap justify-center" style={{ gap: "clamp(5px, 0.7vw, 10px)" }}>
          {[{ id: "", kode: "Semua" }, ...cabangList.map(c => ({ id: c.id, kode: c.kode }))].map(opt => {
            const active = selectedCabang === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setSelectedCabang(opt.id)}
                className="flex items-center rounded-xl font-bold transition-all"
                style={{
                  gap: "5px",
                  padding: "clamp(6px, 0.8vh, 10px) clamp(14px, 1.4vw, 22px)",
                  fontSize: "clamp(13px, 1.6vh, 16px)",
                  background: active ? "#fff" : "rgba(255,255,255,0.18)",
                  color: active ? PRIMARY : "#fff",
                  border: `2px solid ${active ? "#fff" : "rgba(255,255,255,0.35)"}`,
                  letterSpacing: "0.04em",
                  boxShadow: active ? "0 2px 8px rgba(0,0,0,0.12)" : "none",
                }}
              >
                {opt.id && <Building2 style={{ width: 14, height: 14 }} />}
                {opt.kode}
              </button>
            );
          })}
        </div>

        {/* Jam WIB */}
        <div className="text-right flex-shrink-0">
          <div className="font-mono font-black text-white" style={{
            fontSize: "clamp(32px, 5vh, 54px)", letterSpacing: "0.06em", lineHeight: 1,
          }}>
            {clock.time}
          </div>
          <div style={{
            fontSize: "clamp(12px, 1.5vh, 15px)",
            color: "rgba(255,255,255,0.82)",
            fontWeight: 600,
            letterSpacing: "0.04em",
          }}>
            {clock.dayName}, {clock.date} WIB
          </div>
        </div>
      </header>

      {/* ══ MAIN ════════════════════════════════════════════════════════════ */}
      <main className="flex-1 min-h-0" style={{
        padding: "clamp(8px, 1.2vh, 14px) clamp(10px, 1.4vw, 16px)",
      }}>
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-pulse font-semibold" style={{ color: MUTED, fontSize: "clamp(14px, 2vh, 22px)" }}>
              Memuat data antrian…
            </div>
          </div>
        ) : cabangStats.length === 0 ? (
          <div className="h-full flex items-center justify-center" style={{ color: MUTED, fontSize: "clamp(14px, 2vh, 22px)" }}>
            Tidak ada cabang aktif
          </div>
        ) : (
          <div
            className="h-full"
            style={{
              display: "grid",
              gap: "clamp(8px, 1.2vh, 14px)",
              gridTemplateColumns: isSingle ? "1fr" : "repeat(2, 1fr)",
              gridTemplateRows: isSingle
                ? "1fr"
                : `repeat(${Math.ceil(cabangStats.length / 2)}, 1fr)`,
            }}
          >
            {cabangStats.map(({ cabang, layananStats }) => {
              const buka = isBuka(cabang.jamBuka ?? "08:00", cabang.jamTutup ?? "15:00");
              return (
                <div
                  key={cabang.id}
                  className="flex flex-col rounded-2xl overflow-hidden"
                  style={{
                    background: CARD,
                    border: `1.5px solid ${BORDER}`,
                    boxShadow: "0 2px 12px rgba(27,152,141,0.08)",
                  }}
                >
                  {/* Cabang header */}
                  <div
                    className="flex items-center flex-shrink-0"
                    style={{
                      padding: "clamp(7px, 1vh, 12px) clamp(12px, 1.6vw, 20px)",
                      background: buka ? PRIMARY_LT : "#f5f5f5",
                      borderBottom: `2px solid ${buka ? PRIMARY_MID : "#e0e0e0"}`,
                    }}
                  >
                    <Building2 style={{
                      width: "clamp(16px, 2vh, 22px)", height: "clamp(16px, 2vh, 22px)",
                      color: buka ? PRIMARY : "#aaa",
                      flexShrink: 0,
                    }} />
                    <span
                      className="font-extrabold ml-2"
                      style={{ fontSize: "clamp(15px, 2vh, 22px)", color: buka ? TEXT : "#888" }}
                    >
                      {cabang.nama}
                    </span>
                    <span
                      className="font-mono font-bold ml-2"
                      style={{ fontSize: "clamp(12px, 1.4vh, 15px)", color: buka ? PRIMARY : "#bbb" }}
                    >
                      {cabang.kode}
                    </span>
                    <span
                      className="ml-auto font-bold rounded-full"
                      style={{
                        padding: "clamp(4px, 0.5vh, 6px) clamp(12px, 1.4vw, 18px)",
                        fontSize: "clamp(12px, 1.4vh, 14px)",
                        letterSpacing: "0.06em",
                        background: buka ? "#dcfce7" : "#fee2e2",
                        color: buka ? "#15803d" : "#dc2626",
                        border: `1.5px solid ${buka ? "#86efac" : "#fca5a5"}`,
                      }}
                    >
                      {buka
                        ? `BUKA · ${cabang.jamBuka}–${cabang.jamTutup}`
                        : `TUTUP · ${cabang.jamBuka}–${cabang.jamTutup}`}
                    </span>
                  </div>

                  {/* Layanan panels */}
                  <div className="flex-1 min-h-0 grid grid-cols-2" style={{
                    gap: "clamp(6px, 0.9vh, 10px)",
                    padding: "clamp(6px, 0.9vh, 10px)",
                  }}>
                    {layananStats.map(({ jenis, dipanggil, menunggu }) => {
                      const aktif    = !!dipanggil;
                      const nomorStr = dipanggil ? String(dipanggil.nomorAntrian).padStart(3, "0") : "—";
                      const label    = jenis === "teller" ? "TELLER" : "CUSTOMER SERVICE";

                      return (
                        <div
                          key={jenis}
                          className="rounded-xl flex flex-col items-center justify-center relative overflow-hidden"
                          style={{
                            background: aktif
                              ? `linear-gradient(145deg, ${PRIMARY_LT} 0%, #d0f5f2 100%)`
                              : "#fafafa",
                            border: aktif
                              ? `2.5px solid ${PRIMARY}`
                              : `1.5px solid #e8e8e8`,
                            boxShadow: aktif
                              ? `0 0 0 3px ${PRIMARY_MID}, 0 4px 16px rgba(27,152,141,0.18)`
                              : "none",
                            gap: "clamp(4px, 0.6vh, 8px)",
                            padding: "clamp(8px, 1.2vh, 16px)",
                            transition: "all 0.3s ease",
                          }}
                        >
                          {/* Pulse dot kalau aktif */}
                          {aktif && (
                            <div style={{
                              position: "absolute", top: 10, right: 12,
                              width: "clamp(8px, 1.1vh, 12px)",
                              height: "clamp(8px, 1.1vh, 12px)",
                              borderRadius: "50%",
                              background: PRIMARY,
                              boxShadow: `0 0 8px ${PRIMARY}`,
                              animation: "dipanggil-pulse 1.4s ease-in-out infinite",
                            }} />
                          )}

                          {/* Label layanan */}
                          <span
                            className="font-black tracking-widest text-center leading-none"
                            style={{
                              fontSize: "clamp(14px, 1.6vh, 18px)",
                              color: aktif ? PRIMARY_DARK : "#bbb",
                              letterSpacing: "0.14em",
                            }}
                          >
                            {label}
                          </span>

                          {/* Nomor antrian */}
                          <span
                            className="font-mono font-black leading-none"
                            style={{
                              fontSize: isSingle
                                ? "clamp(80px, 18vh, 160px)"
                                : "clamp(48px, 8vh, 88px)",
                              color: aktif ? PRIMARY : "#ddd",
                              textShadow: aktif ? `0 2px 12px rgba(27,152,141,0.3)` : "none",
                              letterSpacing: "-0.02em",
                            }}
                          >
                            {nomorStr}
                          </span>

                          {/* Status bawah */}
                          {aktif ? (
                            <span
                              className="font-bold text-center"
                              style={{
                                fontSize: "clamp(13px, 1.5vh, 16px)",
                                color: PRIMARY,
                                letterSpacing: "0.06em",
                                animation: "dipanggil-pulse 1.4s ease-in-out infinite",
                              }}
                            >
                              ● SEDANG DIPANGGIL
                            </span>
                          ) : (
                            <span
                              className="text-center"
                              style={{ fontSize: "clamp(13px, 1.5vh, 16px)", color: "#bbb" }}
                            >
                              {menunggu > 0 ? `${menunggu} menunggu` : "Antrian kosong"}
                            </span>
                          )}

                          {aktif && menunggu > 0 && (
                            <span style={{ fontSize: "clamp(12px, 1.3vh, 14px)", color: MUTED }}>
                              {menunggu} menunggu
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ══ FOOTER ══════════════════════════════════════════════════════════ */}
      <footer
        className="flex-shrink-0 flex items-center justify-between"
        style={{
          height: "clamp(42px, 5vh, 52px)",
          padding: "0 clamp(16px, 1.8vw, 28px)",
          background: CARD,
          borderTop: `1.5px solid ${BORDER}`,
        }}
      >
        <span className="flex items-center gap-2" style={{
          fontSize: "clamp(12px, 1.4vh, 14px)",
          color: MUTED,
        }}>
          <Clock style={{ width: 15, height: 15 }} />
          Diperbarui otomatis setiap 10 detik · Terakhir: {lastRefreshStr}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 rounded-lg font-semibold transition-all"
            style={{
              padding: "clamp(5px, 0.6vh, 8px) clamp(12px, 1.2vw, 16px)",
              fontSize: "clamp(12px, 1.4vh, 14px)",
              background: "#f0f7f6",
              color: MUTED,
              border: `1.5px solid ${BORDER}`,
            }}
          >
            <RefreshCw style={{ width: 14, height: 14 }} />
            Perbarui
          </button>
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 rounded-lg font-semibold transition-all"
            style={{
              padding: "clamp(5px, 0.6vh, 8px) clamp(12px, 1.2vw, 16px)",
              fontSize: "clamp(12px, 1.4vh, 14px)",
              background: PRIMARY_LT,
              color: PRIMARY_DARK,
              border: `1.5px solid ${PRIMARY_MID}`,
            }}
          >
            {isFullscreen ? <Minimize2 style={{ width: 14, height: 14 }} /> : <Maximize2 style={{ width: 14, height: 14 }} />}
            {isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
          </button>
        </div>
      </footer>

      <style>{`
        @keyframes dipanggil-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
