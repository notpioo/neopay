import { useEffect, useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  useGetAntrianHariIni, getGetAntrianHariIniQueryKey,
  useGetStatusSaya, getGetStatusSayaQueryKey,
  useAmbilAntrian, useBatalAntrian,
  usePanggilAntrian, useSelesaiAntrian, useSkipAntrian,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getUserRole, getToken } from "@/lib/auth";
import { Play, Check, SkipForward, Clock, RefreshCw, Ticket, Building2, Filter, UserCog } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!res.ok) throw { status: res.status, data: body };
  return body;
}

type Cabang = { id: string; nama: string; kode: string; alamat: string | null; aktif: boolean };
type CabangAntrian = { teller: number; cs: number };

function getStatusBadge(status: string) {
  switch(status) {
    case "menunggu": return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Menunggu</Badge>;
    case "dipanggil": return <Badge className="bg-primary hover:bg-primary text-white">Dipanggil</Badge>;
    case "sedang_dilayani": return <Badge className="bg-blue-600 hover:bg-blue-600 text-white">Dilayani</Badge>;
    case "selesai": return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Selesai</Badge>;
    case "dibatalkan": return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Dibatalkan</Badge>;
    default: return <Badge>{status}</Badge>;
  }
}

function getLayananBadge(jenis: string) {
  const map: Record<string, string> = { teller: "Teller", cs: "CS" };
  return <Badge variant="outline" className="text-xs capitalize">{map[jenis] ?? jenis}</Badge>;
}

const LAYANAN_OPTIONS = [
  { value: "teller", label: "Teller", desc: "Setor, tarik, transfer tunai" },
  { value: "cs",     label: "Customer Service", desc: "Pembukaan rekening, info produk" },

] as const;

// ─── Nasabah: form pilih cabang + layanan sebelum ambil antrian ───────────────
function NasabahStatusCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLayanan, setSelectedLayanan] = useState<string>("teller");
  const [selectedCabang, setSelectedCabang] = useState<string>("");
  const [cabangAntrianInfo, setCabangAntrianInfo] = useState<CabangAntrian | null>(null);

  const { data: status, isLoading, isError: isStatusError, error: statusError } = useGetStatusSaya({
    query: { queryKey: getGetStatusSayaQueryKey() },
  });

  const { data: cabangData } = useQuery<{ data: Cabang[] }>({
    queryKey: ["cabang-publik"],
    queryFn: () => apiFetch("/api/cabang"),
  });
  const cabangList = cabangData?.data ?? [];

  // Saat cabang dipilih, fetch info antrian per layanan
  useEffect(() => {
    if (!selectedCabang) { setCabangAntrianInfo(null); return; }
    apiFetch(`/api/cabang/${selectedCabang}/antrian`)
      .then((res: any) => setCabangAntrianInfo(res.antrian ?? null))
      .catch(() => setCabangAntrianInfo(null));
  }, [selectedCabang]);

  const isNoQueue = isStatusError && (statusError as any)?.status === 404;

  const ambilMutation = useAmbilAntrian({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetStatusSayaQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAntrianHariIniQueryKey() });
        toast({ title: "Nomor antrian berhasil diambil!" });
      },
      onError: (err: any) => {
        toast({ title: "Gagal ambil antrian", description: err.data?.pesan, variant: "destructive" });
      },
    },
  });

  const batalMutation = useBatalAntrian({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetStatusSayaQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAntrianHariIniQueryKey() });
        toast({ title: "Antrian dibatalkan" });
      },
      onError: (err: any) => {
        toast({ title: "Gagal membatalkan", description: err.data?.pesan, variant: "destructive" });
      },
    },
  });

  const hasActive = !isStatusError && status?.antrian && ["menunggu","dipanggil","sedang_dilayani"].includes(status.antrian.status);

  if (isLoading) return <Skeleton className="h-36 w-full" />;

  // Tampilkan kartu antrian aktif jika nasabah sudah punya antrian
  if (hasActive && status?.antrian) {
    const a = status.antrian;
    const isDipanggil = a.status === "dipanggil" || a.status === "sedang_dilayani";
    return (
      <Card className={`border-2 ${isDipanggil ? "border-primary/40 bg-primary/5" : "border-orange-200 bg-orange-50/50"}`}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 ${isDipanggil ? "bg-primary text-white" : "bg-orange-100 text-orange-700"}`}>
                <span className="text-xl font-bold">{String(a.nomorAntrian).padStart(3,'0')}</span>
              </div>
              <div>
                <p className="font-semibold text-foreground">Nomor Antrian Saya</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1 flex-wrap">
                  <span className="capitalize">{a.jenisLayanan}</span>
                  {(a as any).cabang && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {(a as any).cabang.nama}
                    </span>
                  )}
                </div>
                {isDipanggil
                  ? <p className="text-sm font-medium text-primary">Anda dipanggil! Segera ke loket.</p>
                  : <p className="text-sm text-muted-foreground">
                      {(status.posisi ?? 0) > 0
                        ? `${status.posisi} orang di depan Anda · ~${status.estimasiMenit} menit`
                        : "Giliran Anda hampir tiba"}
                    </p>
                }
              </div>
            </div>
            {a.status === "menunggu" && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10 flex-shrink-0"
                onClick={() => batalMutation.mutate({ id: a.id })}
                disabled={batalMutation.isPending}
              >
                {batalMutation.isPending ? "..." : "Batalkan"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Form ambil antrian: pilih layanan + cabang
  if (isNoQueue) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Ticket className="w-5 h-5 text-primary" />
            <p className="font-semibold text-foreground">Ambil Nomor Antrian</p>
          </div>

          {/* Pilih Jenis Layanan */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Pilih Layanan</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {LAYANAN_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedLayanan(opt.value)}
                  className={`text-left p-3 rounded-lg border-2 transition-all ${
                    selectedLayanan === opt.value
                      ? "border-primary bg-white shadow-sm"
                      : "border-transparent bg-white/50 hover:bg-white hover:border-primary/30"
                  }`}
                >
                  <p className="font-semibold text-sm">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                  {cabangAntrianInfo && (
                    <p className="text-xs font-medium text-primary mt-1">
                      {(cabangAntrianInfo as any)[opt.value]} antrian
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Pilih Cabang */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Pilih Cabang</p>
            {cabangList.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada cabang tersedia</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {cabangList.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCabang(c.id)}
                    className={`text-left p-3 rounded-lg border-2 transition-all ${
                      selectedCabang === c.id
                        ? "border-primary bg-white shadow-sm"
                        : "border-transparent bg-white/50 hover:bg-white hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-sm">{c.nama}</p>
                        {c.alamat && <p className="text-xs text-muted-foreground">{c.alamat}</p>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => ambilMutation.mutate({ data: { jenisLayanan: selectedLayanan as any, cabangId: selectedCabang } as any })}
              disabled={ambilMutation.isPending || !selectedCabang}
              className="gap-2"
            >
              {ambilMutation.isPending ? "Mengambil..." : "Ambil Antrian"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

// ─── Filter layanan untuk teller/admin ────────────────────────────────────────
function LayananFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-muted-foreground font-medium">Layanan:</span>
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => onChange("")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
            value === "" ? "bg-primary text-white border-primary" : "border-border hover:border-primary/40 text-muted-foreground"
          }`}
        >
          Semua
        </button>
        {LAYANAN_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
              value === opt.value ? "bg-primary text-white border-primary" : "border-border hover:border-primary/40 text-muted-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Filter cabang untuk teller/admin ─────────────────────────────────────────
function CabangFilter({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data } = useQuery<{ data: Cabang[] }>({
    queryKey: ["cabang-publik"],
    queryFn: () => apiFetch("/api/cabang"),
  });
  const list = data?.data ?? [];

  if (list.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => onChange("")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
            value === "" ? "bg-primary text-white border-primary" : "border-border hover:border-primary/40 text-muted-foreground"
          }`}
        >
          Semua
        </button>
        {list.map((c) => (
          <button
            key={c.id}
            onClick={() => onChange(c.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border flex items-center gap-1.5 ${
              value === c.id ? "bg-primary text-white border-primary" : "border-border hover:border-primary/40 text-muted-foreground"
            }`}
          >
            <Building2 className="w-3 h-3" />
            {c.kode}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Antrian() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const role = getUserRole();
  const isAdmin = role === "admin" || role === "teller";
  const isNasabah = role === "nasabah";
  const [filterCabang, setFilterCabang] = useState("");
  const [filterLayanan, setFilterLayanan] = useState("");

  const { data, isLoading, refetch } = useGetAntrianHariIni({
    query: { queryKey: getGetAntrianHariIniQueryKey() },
  });

  const panggilMutation = usePanggilAntrian({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAntrianHariIniQueryKey() });
        toast({ title: "Nasabah dipanggil" });
      },
      onError: (err: any) => {
        toast({ title: "Gagal memanggil", description: err.data?.pesan, variant: "destructive" });
      },
    },
  });

  const selesaiMutation = useSelesaiAntrian({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAntrianHariIniQueryKey() });
        toast({ title: "Sesi selesai" });
      },
      onError: (err: any) => {
        toast({ title: "Gagal selesaikan", description: err.data?.pesan, variant: "destructive" });
      },
    },
  });

  const skipMutation = useSkipAntrian({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAntrianHariIniQueryKey() });
        toast({ title: "Nasabah dilewati" });
      },
      onError: (err: any) => {
        toast({ title: "Gagal lewati", description: err.data?.pesan, variant: "destructive" });
      },
    },
  });

  useEffect(() => {
    const id = setInterval(() => refetch(), 15000);
    return () => clearInterval(id);
  }, [refetch]);

  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Daftar Antrian</h1>
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      </div>
    );
  }

  const allAntrian = data?.data ?? [];
  // filter cabang + layanan di client side
  const antrianList = allAntrian.filter((a) => {
    if (filterCabang && (a as any).cabangId !== filterCabang) return false;
    if (filterLayanan && a.jenisLayanan !== filterLayanan) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Daftar Antrian</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? "Kelola antrian nasabah" : "Antrian nasabah"} hari ini ({antrianList.length} tampil / {allAntrian.length} total)
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Segarkan
        </Button>
      </div>

      {isAdmin && (
        <div className="flex flex-col gap-2">
          <CabangFilter value={filterCabang} onChange={setFilterCabang} />
          <LayananFilter value={filterLayanan} onChange={setFilterLayanan} />
        </div>
      )}

      {isNasabah && <NasabahStatusCard />}

      <div className="bg-white rounded-xl border border-border/50 shadow-sm overflow-hidden">
        {antrianList.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-muted-foreground text-center">
            <Clock className="w-12 h-12 opacity-20 mb-4" />
            <h3 className="text-lg font-medium text-foreground">Belum ada antrian</h3>
            <p>{filterCabang || filterLayanan ? "Tidak ada antrian yang cocok dengan filter ini." : "Antrian hari ini masih kosong."}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {antrianList.map((item) => (
              <div
                key={item.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xl font-bold text-primary">{String(item.nomorAntrian).padStart(3,'0')}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-foreground">{(item as any).namaNasabah || 'Nasabah'}</span>
                      {getStatusBadge(item.status)}
                      {getLayananBadge(item.jenisLayanan)}
                    </div>
                    {(item as any).noHpNasabah && (
                      <div className="text-sm text-muted-foreground">📞 {(item as any).noHpNasabah}</div>
                    )}
                    {(item as any).cabangNama && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3" /> {(item as any).cabangNama}
                      </div>
                    )}
                    {(item as any).namaPetugas && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <UserCog className="w-3 h-3" /> Petugas: {(item as any).namaPetugas}
                      </div>
                    )}
                    {item.catatan && (
                      <div className="text-sm mt-1 text-foreground/70 italic">"{item.catatan}"</div>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    {item.status === "menunggu" && (
                      <Button
                        size="sm"
                        onClick={() => panggilMutation.mutate({ id: item.id })}
                        disabled={panggilMutation.isPending}
                        className="gap-1.5"
                      >
                        <Play className="w-4 h-4" /> Panggil
                      </Button>
                    )}
                    {(item.status === "dipanggil" || item.status === "sedang_dilayani") && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => selesaiMutation.mutate({ id: item.id })}
                        disabled={selesaiMutation.isPending}
                        className="gap-1.5 bg-green-100 text-green-700 hover:bg-green-200"
                      >
                        <Check className="w-4 h-4" /> Selesai
                      </Button>
                    )}
                    {(item.status === "menunggu" || item.status === "dipanggil") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => skipMutation.mutate({ id: item.id })}
                        disabled={skipMutation.isPending}
                        className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <SkipForward className="w-4 h-4" /> Lewati
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
