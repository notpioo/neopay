import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetRiwayat, getGetRiwayatQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getToken, getUserRole } from "@/lib/auth";
import { ArrowDownLeft, ArrowUpRight, Clock, Building2, UserCog, Ticket, History, User } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = await res.json();
  if (!res.ok) throw { status: res.status, data: body };
  return body;
}

function formatTanggal(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatJam(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }) + " WIB";
}

function formatRupiah(n: number) {
  return "Rp" + n.toLocaleString("id-ID");
}

type TipeTab = "transaksi" | "antrian";

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
        active
          ? "bg-primary text-white border-primary"
          : "border-border text-muted-foreground hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    menunggu: "bg-orange-50 text-orange-700 border-orange-200",
    dipanggil: "bg-blue-50 text-blue-700 border-blue-200",
    sedang_dilayani: "bg-purple-50 text-purple-700 border-purple-200",
    selesai: "bg-green-50 text-green-700 border-green-200",
    dibatalkan: "bg-red-50 text-red-700 border-red-200",
  };
  const label: Record<string, string> = {
    menunggu: "Menunggu",
    dipanggil: "Dipanggil",
    sedang_dilayani: "Dilayani",
    selesai: "Selesai",
    dibatalkan: "Dibatalkan",
  };
  return (
    <Badge variant="outline" className={map[status] ?? ""}>
      {label[status] ?? status}
    </Badge>
  );
}

function SkeletonList() {
  return (
    <div className="divide-y divide-border/50">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="p-4 sm:p-5 flex items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

function TabTransaksi({ isStaff }: { isStaff: boolean }) {
  const endpoint = isStaff ? "/api/admin/transaksi/semua" : "/api/nasabah/transaksi";

  const { data, isLoading } = useQuery({
    queryKey: [endpoint],
    queryFn: () => apiFetch(endpoint),
  });

  const list: any[] = data?.data ?? [];

  if (isLoading) return <SkeletonList />;

  if (list.length === 0) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-muted-foreground text-center">
        <History className="w-12 h-12 opacity-20 mb-4" />
        <h3 className="text-lg font-medium text-foreground">Belum ada transaksi</h3>
        <p className="text-sm">Riwayat transfer akan muncul di sini.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/50">
      {list.map((item) => {
        const masuk = item.tipe === "transfer_masuk";
        return (
          <div key={item.id} className="p-4 sm:p-5 flex items-center gap-4 hover:bg-muted/20 transition-colors">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${masuk ? "bg-green-50" : "bg-red-50"}`}>
              {masuk
                ? <ArrowDownLeft className="w-5 h-5 text-green-600" />
                : <ArrowUpRight className="w-5 h-5 text-red-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="font-semibold text-foreground text-sm">
                  {masuk ? "Transfer Masuk" : "Transfer Keluar"}
                </span>
                <Badge variant="outline" className={masuk ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-500 border-red-200"}>
                  {masuk ? "Masuk" : "Keluar"}
                </Badge>
              </div>
              {isStaff && item.namaPengirim && (
                <p className="text-xs text-muted-foreground truncate font-medium">
                  <User className="w-3 h-3 inline mr-1" />
                  {item.namaPengirim} · {item.noRekeningPengirim}
                </p>
              )}
              {item.namaLawan && (
                <p className="text-xs text-muted-foreground truncate">
                  {masuk ? "Dari" : "Ke"}: {item.namaLawan} · {item.noRekeningLawan}
                </p>
              )}
              {item.keterangan && (
                <p className="text-xs text-muted-foreground truncate italic">{item.keterangan}</p>
              )}
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {formatTanggal(item.createdAt)}, {formatJam(item.createdAt)}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={`font-bold text-base ${masuk ? "text-green-600" : "text-red-500"}`}>
                {masuk ? "+" : "-"}{formatRupiah(item.jumlah)}
              </p>
              <p className="text-xs text-muted-foreground">Saldo: {formatRupiah(item.saldoSesudah)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TabAntrian({ isStaff }: { isStaff: boolean }) {
  const { data: dataNasabah, isLoading: loadingNasabah } = useGetRiwayat({
    query: { queryKey: getGetRiwayatQueryKey(), enabled: !isStaff },
  });

  const { data: dataAdmin, isLoading: loadingAdmin } = useQuery({
    queryKey: ["/api/admin/antrian/riwayat"],
    queryFn: () => apiFetch("/api/admin/antrian/riwayat"),
    enabled: isStaff,
  });

  const isLoading = isStaff ? loadingAdmin : loadingNasabah;
  const list: any[] = isStaff
    ? (dataAdmin?.data ?? [])
    : ((dataNasabah as any)?.data ?? []);

  if (isLoading) return <SkeletonList />;

  if (list.length === 0) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-muted-foreground text-center">
        <Ticket className="w-12 h-12 opacity-20 mb-4" />
        <h3 className="text-lg font-medium text-foreground">Belum ada riwayat antrian</h3>
        <p className="text-sm">Antrian yang pernah diambil akan muncul di sini.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/50">
      {list.map((item) => (
        <div key={item.id} className="p-4 sm:p-5 flex items-center gap-4 hover:bg-muted/20 transition-colors">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-primary">{String(item.nomorAntrian).padStart(3, "0")}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <StatusBadge status={item.status} />
              <Badge variant="outline" className="text-xs">
                {item.jenisLayanan === "cs" ? "Customer Service" : "Teller"}
              </Badge>
            </div>
            {isStaff && item.namaNasabah && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 font-medium">
                <User className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{item.namaNasabah}</span>
              </div>
            )}
            {item.namaCabang && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <Building2 className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{item.namaCabang}</span>
              </div>
            )}
            {item.namaPetugas && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <UserCog className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">Petugas: {item.namaPetugas}</span>
              </div>
            )}
            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {formatTanggal(item.tanggal)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Riwayat() {
  const [tab, setTab] = useState<TipeTab>("transaksi");
  const role = getUserRole();
  const isStaff = role === "teller" || role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Riwayat</h1>
        <p className="text-muted-foreground mt-1">
          {isStaff ? "Semua riwayat transaksi dan antrian nasabah" : "Riwayat transaksi dan antrian Anda"}
        </p>
      </div>

      <div className="flex gap-2">
        <TabBtn active={tab === "transaksi"} onClick={() => setTab("transaksi")}>Transaksi</TabBtn>
        <TabBtn active={tab === "antrian"} onClick={() => setTab("antrian")}>Antrian</TabBtn>
      </div>

      <div className="bg-white rounded-xl border border-border/50 shadow-sm overflow-hidden">
        {tab === "transaksi" ? <TabTransaksi isStaff={isStaff} /> : <TabAntrian isStaff={isStaff} />}
      </div>
    </div>
  );
}
