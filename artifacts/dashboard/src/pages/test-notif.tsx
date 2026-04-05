import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Bell, Wifi, WifiOff, Loader2, Send, Users, User } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!res.ok) throw body;
  return body;
}

function StatusWA() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/wa/status"],
    queryFn: () => apiFetch("/api/admin/wa/status"),
    refetchInterval: 10000,
  });

  const status: string = data?.status ?? "tidak_diketahui";
  const terhubung = status === "terhubung";

  return (
    <div className="flex items-center gap-2">
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : terhubung ? (
        <>
          <Wifi className="w-4 h-4 text-green-600" />
          <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Terhubung</Badge>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4 text-red-500" />
          <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">Tidak Terhubung</Badge>
        </>
      )}
    </div>
  );
}

function SectionWA() {
  const { toast } = useToast();
  const [noHp, setNoHp] = useState("");
  const [pesan, setPesan] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/admin/test/wa", {
        method: "POST",
        body: JSON.stringify({ noHp, pesan }),
      }),
    onSuccess: (data) => {
      toast({ title: "Berhasil", description: data.pesan });
      setNoHp("");
      setPesan("");
    },
    onError: (err: any) => {
      toast({ title: "Gagal", description: err?.pesan ?? "Terjadi kesalahan", variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" />
            <CardTitle>Test WhatsApp</CardTitle>
          </div>
          <StatusWA />
        </div>
        <CardDescription>
          Kirim pesan WA percobaan ke nomor tertentu untuk memastikan koneksi berfungsi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="noHp">Nomor WhatsApp Tujuan</Label>
          <Input
            id="noHp"
            placeholder="cth: 6281234567890"
            value={noHp}
            onChange={(e) => setNoHp(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Format internasional tanpa tanda + (cth: 628xxxxxxxxxx)</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pesanWA">Isi Pesan</Label>
          <Textarea
            id="pesanWA"
            placeholder="Tulis pesan uji coba di sini..."
            rows={4}
            value={pesan}
            onChange={(e) => setPesan(e.target.value)}
          />
        </div>
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !noHp.trim() || !pesan.trim()}
          className="w-full sm:w-auto"
        >
          {mutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Mengirim...</>
          ) : (
            <><Send className="w-4 h-4 mr-2" />Kirim WA</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function SectionPush() {
  const { toast } = useToast();
  const [target, setTarget] = useState<"semua" | "satu">("semua");
  const [nasabahId, setNasabahId] = useState("");
  const [judul, setJudul] = useState("");
  const [isi, setIsi] = useState("");

  const { data: usersData } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: () => apiFetch("/api/admin/users"),
  });
  const users: any[] = usersData?.users ?? [];

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/admin/test/push", {
        method: "POST",
        body: JSON.stringify({ target, nasabahId: target === "satu" ? nasabahId : undefined, judul, isi }),
      }),
    onSuccess: (data) => {
      toast({ title: "Berhasil", description: data.pesan });
      setJudul("");
      setIsi("");
      setNasabahId("");
    },
    onError: (err: any) => {
      toast({ title: "Gagal", description: err?.pesan ?? "Terjadi kesalahan", variant: "destructive" });
    },
  });

  const disabled = mutation.isPending || !judul.trim() || !isi.trim() || (target === "satu" && !nasabahId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <CardTitle>Test Push Notifikasi</CardTitle>
        </div>
        <CardDescription>
          Kirim push notifikasi percobaan ke satu nasabah atau semua nasabah yang sudah daftar device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Target Penerima</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTarget("semua")}
              className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                target === "semua"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              <Users className="w-4 h-4" />
              Semua Nasabah
            </button>
            <button
              type="button"
              onClick={() => setTarget("satu")}
              className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                target === "satu"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              <User className="w-4 h-4" />
              Satu Nasabah
            </button>
          </div>
        </div>

        {target === "satu" && (
          <div className="space-y-2">
            <Label>Pilih Nasabah</Label>
            <Select value={nasabahId} onValueChange={setNasabahId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih nasabah..." />
              </SelectTrigger>
              <SelectContent>
                {users.map((u: any) => (
                  <SelectItem key={u.id} value={u.id} disabled={!u.punyaDevice}>
                    <span className={!u.punyaDevice ? "text-muted-foreground" : ""}>
                      {u.nama} — {u.email}
                      {!u.punyaDevice && " (belum daftar device)"}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Hanya nasabah yang sudah login di aplikasi mobile yang bisa dipilih.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="judul">Judul Notifikasi</Label>
          <Input
            id="judul"
            placeholder="cth: Pemberitahuan dari NeoPay"
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="isiNotif">Isi Notifikasi</Label>
          <Textarea
            id="isiNotif"
            placeholder="Tulis isi notifikasi di sini..."
            rows={4}
            value={isi}
            onChange={(e) => setIsi(e.target.value)}
          />
        </div>
        <Button
          onClick={() => mutation.mutate()}
          disabled={disabled}
          className="w-full sm:w-auto"
        >
          {mutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Mengirim...</>
          ) : (
            <><Send className="w-4 h-4 mr-2" />Kirim Notifikasi</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function TestNotif() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Test Notifikasi</h1>
        <p className="text-muted-foreground mt-1">
          Uji coba pengiriman WhatsApp dan push notifikasi secara langsung.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionWA />
        <SectionPush />
      </div>
    </div>
  );
}
