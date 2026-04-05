import { useEffect, useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  useGetDasbor, getGetDasborQueryKey,
  useGetAntrianHariIni, getGetAntrianHariIniQueryKey,
  useGetStatusSaya, getGetStatusSayaQueryKey,
  useAmbilAntrian, useBatalAntrian,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getUserRole } from "@/lib/auth";
import {
  Users, Clock, CheckCircle2, XCircle, UserCheck,
  Ticket, AlertCircle, RefreshCw, ChevronRight, UserCog, Building2,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function apiFetch(path: string) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json();
}
type Cabang = { id: string; nama: string; kode: string; alamat: string | null };
const LAYANAN_OPTIONS = [
  { value: "teller", label: "Teller", desc: "Setor, tarik, transfer tunai" },
  { value: "cs", label: "Customer Service", desc: "Pembukaan rekening, info produk" },
] as const;

// ─── Admin / CS View ─────────────────────────────────────────────────────────
function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: dasbor, isLoading, isError } = useGetDasbor({
    query: { queryKey: getGetDasborQueryKey() },
  });

  useEffect(() => {
    const id = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetDasborQueryKey() });
    }, 10000);
    return () => clearInterval(id);
  }, [queryClient]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dasbor</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (isError || !dasbor) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dasbor</h1>
        <Card>
          <CardContent className="p-12 flex flex-col items-center text-center gap-4">
            <AlertCircle className="w-12 h-12 text-destructive opacity-60" />
            <p className="text-muted-foreground">Gagal memuat data dasbor. Pastikan koneksi ke server aktif.</p>
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: getGetDasborQueryKey() })}>
              <RefreshCw className="w-4 h-4 mr-2" /> Coba Lagi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = [
    { title: "Total Antrian", value: dasbor.totalAntrian, icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
    { title: "Menunggu", value: dasbor.menunggu, icon: Clock, color: "text-orange-600", bg: "bg-orange-100" },
    { title: "Sedang Dilayani", value: dasbor.sedangDilayani, icon: UserCheck, color: "text-primary", bg: "bg-primary/20" },
    { title: "Selesai", value: dasbor.selesai, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100" },
    { title: "Dibatalkan", value: dasbor.dibatalkan, icon: XCircle, color: "text-destructive", bg: "bg-destructive/20" },
  ];

  const layananStats = [
    { label: "Teller", value: (dasbor as any).tellerCount ?? 0 },
    { label: "CS", value: (dasbor as any).csCount ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dasbor NeoPay</h1>
        <p className="text-muted-foreground mt-1">Ringkasan antrian — {dasbor.tanggal}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((s, i) => (
          <Card key={i} className="border-border/50 shadow-sm">
            <CardContent className="p-5 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground truncate">{s.title}</p>
                <h3 className="text-2xl font-bold">{s.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {layananStats.map((l, i) => (
          <Card key={i} className="border-border/50 shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{l.value}</p>
              <p className="text-xs text-muted-foreground mt-1">Loket {l.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCheck className="w-5 h-5 text-primary" />
            Sedang Dipanggil
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 flex flex-col items-center justify-center text-center min-h-[200px]">
          {dasbor.antrianAktif ? (
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nomor Antrian</div>
              <div className="text-7xl font-bold text-primary">
                {String(dasbor.antrianAktif.nomorAntrian).padStart(3, '0')}
              </div>
              <div className="text-lg font-medium mt-2">{(dasbor.antrianAktif as any).namaNasabah || 'Nasabah'}</div>
              <Badge variant="outline" className="capitalize">{dasbor.antrianAktif.jenisLayanan}</Badge>
              {(dasbor.antrianAktif as any).namaPetugas && (
                <div className="text-sm text-muted-foreground flex items-center gap-1.5 justify-center">
                  <UserCog className="w-3.5 h-3.5" /> Petugas: {(dasbor.antrianAktif as any).namaPetugas}
                </div>
              )}
              {dasbor.antrianAktif.catatan && (
                <div className="text-sm text-muted-foreground px-4 py-2 bg-muted/20 rounded-md">
                  Catatan: {dasbor.antrianAktif.catatan}
                </div>
              )}
            </div>
          ) : (
            <div className="text-muted-foreground flex flex-col items-center gap-3">
              <Clock className="w-12 h-12 opacity-20" />
              <p>Belum ada nasabah yang sedang dilayani saat ini.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Teller View ──────────────────────────────────────────────────────────────
function TellerDashboard() {
  const { data, isLoading, isError, refetch } = useGetAntrianHariIni({
    query: { queryKey: getGetAntrianHariIniQueryKey() },
  });

  useEffect(() => {
    const id = setInterval(() => refetch(), 10000);
    return () => clearInterval(id);
  }, [refetch]);

  const list = data?.data ?? [];
  const sedangDilayani = list.find(a => a.status === "sedang_dilayani" || a.status === "dipanggil");
  const berikutnya = list.find(a => a.status === "menunggu");
  const menungguCount = list.filter(a => a.status === "menunggu").length;
  const selesaiCount = list.filter(a => a.status === "selesai").length;
  const totalCount = list.filter(a => a.status !== "dibatalkan").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "menunggu":       return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Menunggu</Badge>;
      case "dipanggil":      return <Badge className="bg-primary text-white">Dipanggil</Badge>;
      case "sedang_dilayani":return <Badge className="bg-blue-600 text-white">Dilayani</Badge>;
      case "selesai":        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Selesai</Badge>;
      case "dibatalkan":     return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Dibatalkan</Badge>;
      default:               return <Badge>{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-36 rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <img src="/neopay-logo.png" alt="NeoPay" className="w-9 h-9 object-contain" />
            Panel Teller
          </h1>
          <p className="text-muted-foreground mt-1">Antrian nasabah hari ini — auto-update setiap 10 detik</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} size="sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Segarkan
        </Button>
      </div>

      <Card className={`border-2 ${sedangDilayani ? "border-primary bg-primary/5" : "border-border/50"}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-muted-foreground flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            Nasabah Saat Ini
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sedangDilayani ? (
            <div className="flex items-center gap-4">
              <div className="text-5xl font-bold text-primary">
                {String(sedangDilayani.nomorAntrian).padStart(3, "0")}
              </div>
              <div>
                <p className="text-xl font-semibold">{(sedangDilayani as any).namaNasabah || "Nasabah"}</p>
                <div className="mt-1 flex items-center gap-2">
                  {getStatusBadge(sedangDilayani.status)}
                  <Badge variant="outline" className="capitalize text-xs">{sedangDilayani.jenisLayanan}</Badge>
                </div>
                {(sedangDilayani as any).namaPetugas && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <UserCog className="w-3 h-3" /> Petugas: {(sedangDilayani as any).namaPetugas}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground italic">Belum ada nasabah yang sedang dilayani.</p>
          )}
        </CardContent>
      </Card>

      {berikutnya && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChevronRight className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-xs text-orange-600 font-medium uppercase tracking-wide">Berikutnya</p>
                <p className="font-semibold">{(berikutnya as any).namaNasabah || "Nasabah"}</p>
              </div>
            </div>
            <span className="text-2xl font-bold text-orange-600">
              {String(berikutnya.nomorAntrian).padStart(3, "0")}
            </span>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-orange-600">{menungguCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Menunggu</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{selesaiCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Selesai</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{totalCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Total</p>
        </CardContent></Card>
      </div>

      {isError ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Gagal memuat antrian.</CardContent></Card>
      ) : list.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          <Clock className="w-10 h-10 opacity-20 mx-auto mb-3" />
          <p>Belum ada antrian hari ini.</p>
        </CardContent></Card>
      ) : (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Semua Antrian Hari Ini</CardTitle>
          </CardHeader>
          <div className="divide-y divide-border/50">
            {list.map(item => (
              <div key={item.id} className={`px-5 py-3 flex items-center justify-between ${item.status === "sedang_dilayani" || item.status === "dipanggil" ? "bg-primary/5" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className="w-10 text-center font-bold text-primary">{String(item.nomorAntrian).padStart(3, "0")}</span>
                  <div>
                    <div>
                      <span className="font-medium">{(item as any).namaNasabah || "Nasabah"}</span>
                      <Badge variant="outline" className="ml-2 capitalize text-xs">{item.jenisLayanan}</Badge>
                    </div>
                    {(item as any).namaPetugas && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <UserCog className="w-3 h-3" /> {(item as any).namaPetugas}
                      </p>
                    )}
                  </div>
                </div>
                {getStatusBadge(item.status)}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Nasabah View ──────────────────────────────────────────────────────────────
function NasabahDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCabang, setSelectedCabang] = useState("");
  const [selectedLayanan, setSelectedLayanan] = useState<"teller" | "cs">("teller");

  const { data: cabangData } = useQuery<{ data: Cabang[] }>({
    queryKey: ["cabang-publik"],
    queryFn: () => apiFetch("/api/cabang"),
  });
  const cabangList = cabangData?.data ?? [];

  const { data: status, isLoading, isError, error, refetch } = useGetStatusSaya({
    query: { queryKey: getGetStatusSayaQueryKey() },
  });
  const isNoQueue = isError && (error as any)?.status === 404;
  const isRealError = isError && !isNoQueue;

  const { data: antrianData } = useGetAntrianHariIni({
    query: { queryKey: getGetAntrianHariIniQueryKey() },
  });

  const ambilMutation = useAmbilAntrian({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetStatusSayaQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAntrianHariIniQueryKey() });
        toast({ title: "Antrian berhasil diambil!" });
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
        toast({ title: "Gagal membatalkan antrian", description: err.data?.pesan, variant: "destructive" });
      },
    },
  });

  useEffect(() => {
    const id = setInterval(() => refetch(), 15000);
    return () => clearInterval(id);
  }, [refetch]);

  const hasActiveQueue = status?.antrian && ["menunggu","dipanggil","sedang_dilayani"].includes(status.antrian.status);
  const totalAktif = antrianData?.data?.filter(a => ["menunggu","dipanggil","sedang_dilayani"].includes(a.status)).length ?? 0;

  const getStatusLabel = (s: string) => {
    switch(s) {
      case "menunggu": return { label: "Menunggu Dipanggil", color: "text-orange-600", bg: "bg-orange-50 border-orange-200" };
      case "dipanggil": return { label: "Anda Dipanggil!", color: "text-primary", bg: "bg-primary/5 border-primary/30" };
      case "sedang_dilayani": return { label: "Sedang Dilayani", color: "text-blue-600", bg: "bg-blue-50 border-blue-200" };
      default: return { label: s, color: "text-muted-foreground", bg: "bg-muted/20 border-border" };
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dasbor</h1>
        <p className="text-muted-foreground mt-1">Status antrian Anda hari ini</p>
      </div>

      {isRealError ? (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-10 h-10 text-destructive opacity-50 mx-auto mb-3" />
            <p className="text-muted-foreground">Gagal memuat status antrian.</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" /> Coba Lagi
            </Button>
          </CardContent>
        </Card>
      ) : hasActiveQueue && status?.antrian ? (
        (() => {
          const st = getStatusLabel(status.antrian.status);
          return (
            <Card className={`border-2 ${st.bg}`}>
              <CardContent className="p-8 flex flex-col items-center text-center gap-4">
                <p className={`text-sm font-semibold uppercase tracking-wider ${st.color}`}>{st.label}</p>
                <div className={`text-8xl font-bold ${st.color}`}>
                  {String(status.antrian.nomorAntrian).padStart(3, '0')}
                </div>
                <Badge variant="outline" className="capitalize">{status.antrian.jenisLayanan}</Badge>
                <div className="text-sm text-muted-foreground space-y-1">
                  {(status.posisi ?? 0) > 0 ? (
                    <>
                      <p>Ada <strong>{status.posisi}</strong> orang di depan Anda</p>
                      <p>Estimasi: ~<strong>{status.estimasiMenit}</strong> menit</p>
                    </>
                  ) : (
                    <p className="font-semibold text-orange-600">Giliran Anda hampir tiba, bersiaplah!</p>
                  )}
                  <p className="text-xs">Dalam antrian: <strong>{status.totalMenunggu}</strong> orang (termasuk Anda)</p>
                </div>
                {status.antrian.status === "menunggu" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10 mt-2"
                    onClick={() => batalMutation.mutate({ id: status.antrian!.id })}
                    disabled={batalMutation.isPending}
                  >
                    {batalMutation.isPending ? "Membatalkan..." : "Batalkan Antrian"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })()
      ) : (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-primary" />
              <p className="font-semibold text-foreground">Ambil Nomor Antrian</p>
            </div>

            {/* Pilih Layanan */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Pilih Layanan</p>
              <div className="grid grid-cols-2 gap-2">
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
                  </button>
                ))}
              </div>
            </div>

            {/* Pilih Cabang */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Pilih Cabang</p>
              {cabangList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Memuat cabang...</p>
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
                onClick={() => ambilMutation.mutate({ data: { jenisLayanan: selectedLayanan, cabangId: selectedCabang } as any })}
                disabled={ambilMutation.isPending || !selectedCabang}
                className="gap-2"
              >
                {ambilMutation.isPending ? "Mengambil..." : "Ambil Antrian"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" /> Perbarui Status
        </Button>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function Dashboard() {
  const role = getUserRole();
  if (role === "admin") return <AdminDashboard />;
  if (role === "teller") return <TellerDashboard />;
  return <NasabahDashboard />;
}
