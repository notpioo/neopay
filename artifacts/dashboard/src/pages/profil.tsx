import { useGetProfilSaya, getGetProfilSayaQueryKey, useUpdateProfil, useGetRiwayat, getGetRiwayatQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef } from "react";
import { UserCircle, History, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const profilSchema = z.object({
  nama: z.string().min(2, "Nama minimal 2 karakter").optional(),
  noHp: z.string().min(10, "Nomor HP tidak valid").optional(),
});

export default function Profil() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const initRef = useRef<boolean>(false);

  const { data: profil, isLoading } = useGetProfilSaya({
    query: { queryKey: getGetProfilSayaQueryKey() }
  });

  const { data: riwayat, isLoading: isRiwayatLoading } = useGetRiwayat({
    query: { queryKey: getGetRiwayatQueryKey() }
  });

  const updateMutation = useUpdateProfil({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProfilSayaQueryKey() });
        toast({ title: "Profil berhasil diperbarui" });
      },
      onError: (err) => {
        toast({ title: "Gagal memperbarui profil", description: err.data?.pesan, variant: "destructive" });
      }
    }
  });

  const form = useForm<z.infer<typeof profilSchema>>({
    resolver: zodResolver(profilSchema),
    defaultValues: {
      nama: "",
      noHp: "",
    },
  });

  useEffect(() => {
    if (profil && !initRef.current) {
      form.reset({
        nama: profil.nama,
        noHp: profil.noHp,
      });
      initRef.current = true;
    }
  }, [profil, form]);

  if (isLoading) {
    return <div className="space-y-4 max-w-2xl"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  const onSubmit = (values: z.infer<typeof profilSchema>) => {
    updateMutation.mutate({ data: values });
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "menunggu": return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Menunggu</Badge>;
      case "dipanggil": return <Badge className="bg-primary hover:bg-primary text-primary-foreground">Dipanggil</Badge>;
      case "sedang_dilayani": return <Badge className="bg-blue-600 hover:bg-blue-600 text-white">Dilayani</Badge>;
      case "selesai": return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Selesai</Badge>;
      case "dibatalkan": return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Dibatalkan</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profil Akun</h1>
        <p className="text-muted-foreground mt-1">Kelola informasi data diri dan lihat riwayat antrian</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-primary" />
              Informasi Pribadi
            </CardTitle>
            <CardDescription>Pastikan nomor HP aktif untuk menerima notifikasi antrian.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 pb-6 border-b border-border/50 space-y-3">
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Email Terdaftar</div>
                <div className="text-lg">{profil?.email}</div>
              </div>
              {(profil as any)?.nik && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">NIK</div>
                  <div>{(profil as any).nik}</div>
                </div>
              )}
              {(profil as any)?.noRekening && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Nomor Rekening</div>
                  <div className="font-mono">{(profil as any).noRekening}</div>
                </div>
              )}
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Role</div>
                <Badge variant="outline" className="capitalize">{(profil as any)?.role ?? "nasabah"}</Badge>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="nama"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama Lengkap</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="noHp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nomor WhatsApp</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Riwayat Antrian
            </CardTitle>
            <CardDescription>Daftar antrian yang pernah Anda ambil di NeoPay.</CardDescription>
          </CardHeader>
          <CardContent>
            {isRiwayatLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : !riwayat?.data || riwayat.data.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground border rounded-xl border-dashed">
                <Clock className="w-12 h-12 opacity-20 mb-3" />
                <p>Belum ada riwayat antrian.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {riwayat.data.map((item: any) => (
                  <div key={item.id} className="p-4 border rounded-xl flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-1">{item.tanggal}</div>
                      <div className="font-semibold flex items-center gap-2">
                        No. Antrian: <span className="text-primary text-lg">{String(item.nomorAntrian).padStart(3, '0')}</span>
                      </div>
                      {item.jenisLayanan && (
                        <Badge variant="outline" className="capitalize text-xs mt-1">{item.jenisLayanan}</Badge>
                      )}
                    </div>
                    <div>
                      {getStatusBadge(item.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
