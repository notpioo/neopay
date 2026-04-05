import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Pencil, PowerOff, Power, X, Check, Clock } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";

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

type Cabang = { id: string; nama: string; kode: string; alamat: string | null; aktif: boolean; jamBuka: string; jamTutup: string };

const CABANG_KEY = ["admin", "cabang"];

function isBuka(jamBuka: string, jamTutup: string): boolean {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000); // WIB
  const nowMenit = now.getUTCHours() * 60 + now.getUTCMinutes();
  const [bH, bM] = jamBuka.split(":").map(Number);
  const [tH, tM] = jamTutup.split(":").map(Number);
  return nowMenit >= (bH ?? 8) * 60 + (bM ?? 0) && nowMenit < (tH ?? 15) * 60 + (tM ?? 0);
}

function FormCabang({
  initial,
  onSubmit,
  onCancel,
  isPending,
}: {
  initial?: Partial<Cabang>;
  onSubmit: (data: { nama: string; kode: string; alamat: string; jamBuka: string; jamTutup: string }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [nama, setNama] = useState(initial?.nama ?? "");
  const [kode, setKode] = useState(initial?.kode ?? "");
  const [alamat, setAlamat] = useState(initial?.alamat ?? "");
  const [jamBuka, setJamBuka] = useState(initial?.jamBuka ?? "08:00");
  const [jamTutup, setJamTutup] = useState(initial?.jamTutup ?? "15:00");

  return (
    <div className="border rounded-xl p-5 bg-primary/5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Nama Cabang</Label>
          <Input
            placeholder="Cabang Sudirman"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Kode Cabang</Label>
          <Input
            placeholder="CBG-001"
            value={kode}
            onChange={(e) => setKode(e.target.value.toUpperCase())}
          />
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label>Alamat <span className="text-muted-foreground text-xs">(opsional)</span></Label>
          <Input
            placeholder="Jl. Jend. Sudirman No. 1"
            value={alamat}
            onChange={(e) => setAlamat(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Jam Buka <span className="text-muted-foreground text-xs">(WIB)</span></Label>
          <Input
            type="time"
            value={jamBuka}
            onChange={(e) => setJamBuka(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Jam Tutup <span className="text-muted-foreground text-xs">(WIB)</span></Label>
          <Input
            type="time"
            value={jamTutup}
            onChange={(e) => setJamTutup(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
          <X className="w-4 h-4 mr-1" /> Batal
        </Button>
        <Button
          size="sm"
          onClick={() => onSubmit({ nama, kode, alamat, jamBuka, jamTutup })}
          disabled={isPending || !nama.trim() || !kode.trim()}
        >
          <Check className="w-4 h-4 mr-1" />
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>
    </div>
  );
}

export default function Cabang() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ data: Cabang[]; total: number }>({
    queryKey: CABANG_KEY,
    queryFn: () => apiFetch("/api/admin/cabang"),
  });

  const tambahMutation = useMutation({
    mutationFn: (body: { nama: string; kode: string; alamat: string; jamBuka: string; jamTutup: string }) =>
      apiFetch("/api/admin/cabang", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CABANG_KEY });
      setShowForm(false);
      toast({ title: "Cabang berhasil ditambahkan" });
    },
    onError: (err: any) => toast({ title: "Gagal tambah cabang", description: err.data?.pesan, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Cabang> }) =>
      apiFetch(`/api/admin/cabang/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CABANG_KEY });
      setEditingId(null);
      toast({ title: "Cabang berhasil diperbarui" });
    },
    onError: (err: any) => toast({ title: "Gagal update cabang", description: err.data?.pesan, variant: "destructive" }),
  });

  const toggleAktifMutation = useMutation({
    mutationFn: ({ id, aktif }: { id: string; aktif: boolean }) =>
      aktif
        ? apiFetch(`/api/admin/cabang/${id}`, { method: "PUT", body: JSON.stringify({ aktif: false }) })
        : apiFetch(`/api/admin/cabang/${id}`, { method: "PUT", body: JSON.stringify({ aktif: true }) }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: CABANG_KEY });
      toast({ title: vars.aktif ? "Cabang dinonaktifkan" : "Cabang diaktifkan" });
    },
    onError: (err: any) => toast({ title: "Gagal ubah status", description: err.data?.pesan, variant: "destructive" }),
  });

  const cabangList: Cabang[] = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Kelola Cabang</h1>
          <p className="text-muted-foreground mt-1">
            {cabangList.length} cabang terdaftar
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Tambah Cabang
          </Button>
        )}
      </div>

      {showForm && (
        <FormCabang
          onSubmit={(d) => tambahMutation.mutate(d)}
          onCancel={() => setShowForm(false)}
          isPending={tambahMutation.isPending}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : cabangList.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center text-muted-foreground">
            <Building2 className="w-12 h-12 opacity-20 mb-4" />
            <h3 className="text-lg font-medium text-foreground">Belum ada cabang</h3>
            <p>Tambahkan cabang pertama menggunakan tombol di atas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {cabangList.map((cabang) => (
            <Card key={cabang.id} className={`border ${!cabang.aktif ? "opacity-60" : ""}`}>
              {editingId === cabang.id ? (
                <CardContent className="pt-5">
                  <FormCabang
                    initial={cabang}
                    onSubmit={(d) => updateMutation.mutate({ id: cabang.id, body: d })}
                    onCancel={() => setEditingId(null)}
                    isPending={updateMutation.isPending}
                  />
                </CardContent>
              ) : (
                <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-semibold text-foreground">{cabang.nama}</span>
                        <Badge variant="outline" className="text-xs font-mono">{cabang.kode}</Badge>
                        <Badge
                          variant={cabang.aktif ? "default" : "secondary"}
                          className={cabang.aktif ? "bg-green-100 text-green-700 hover:bg-green-100 border-green-200" : ""}
                        >
                          {cabang.aktif ? "Aktif" : "Nonaktif"}
                        </Badge>
                        {cabang.aktif && (() => {
                          const buka = isBuka(cabang.jamBuka, cabang.jamTutup);
                          return (
                            <Badge className={buka
                              ? "bg-teal-100 text-teal-700 hover:bg-teal-100 border-teal-200"
                              : "bg-red-50 text-red-600 hover:bg-red-50 border-red-200"
                            }>
                              {buka ? "Buka" : "Tutup"}
                            </Badge>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          {cabang.jamBuka} – {cabang.jamTutup} WIB
                        </span>
                        {cabang.alamat && (
                          <span className="text-sm text-muted-foreground">{cabang.alamat}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingId(cabang.id)}
                      className="gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleAktifMutation.mutate({ id: cabang.id, aktif: cabang.aktif })}
                      disabled={toggleAktifMutation.isPending}
                      className={`gap-1.5 ${cabang.aktif ? "text-destructive border-destructive/30 hover:bg-destructive/10" : "text-green-700 border-green-300 hover:bg-green-50"}`}
                    >
                      {cabang.aktif
                        ? <><PowerOff className="w-3.5 h-3.5" /> Nonaktifkan</>
                        : <><Power className="w-3.5 h-3.5" /> Aktifkan</>
                      }
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
