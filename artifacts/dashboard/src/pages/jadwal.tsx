import { useGetJadwal, getGetJadwalQueryKey, useUpdateJadwal } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef } from "react";

const HARI_PILIHAN = [
  { id: "senin", label: "Senin" },
  { id: "selasa", label: "Selasa" },
  { id: "rabu", label: "Rabu" },
  { id: "kamis", label: "Kamis" },
  { id: "jumat", label: "Jumat" },
  { id: "sabtu", label: "Sabtu" },
  { id: "minggu", label: "Minggu" },
];

const jadwalSchema = z.object({
  hariBuka: z.array(z.string()).min(1, "Pilih minimal satu hari buka"),
  kuotaPerHari: z.coerce.number().min(1, "Kuota minimal 1"),
  aktif: z.boolean(),
  keterangan: z.string().optional(),
});

export default function Jadwal() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const initRef = useRef<boolean>(false);

  const { data: jadwal, isLoading } = useGetJadwal({
    query: { queryKey: getGetJadwalQueryKey() }
  });

  const updateMutation = useUpdateJadwal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetJadwalQueryKey() });
        toast({ title: "Jadwal operasional berhasil diperbarui" });
      },
      onError: (err) => {
        toast({ title: "Gagal memperbarui jadwal", description: err.data?.pesan, variant: "destructive" });
      }
    }
  });

  const form = useForm<z.infer<typeof jadwalSchema>>({
    resolver: zodResolver(jadwalSchema),
    defaultValues: {
      hariBuka: [],
      kuotaPerHari: 50,
      aktif: true,
      keterangan: "",
    },
  });

  useEffect(() => {
    if (jadwal && !initRef.current) {
      form.reset({
        hariBuka: jadwal.hariBuka,
        kuotaPerHari: jadwal.kuotaPerHari,
        aktif: jadwal.aktif,
        keterangan: jadwal.keterangan || "",
      });
      initRef.current = true;
    }
  }, [jadwal, form]);

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-[400px] w-full" /></div>;
  }

  const onSubmit = (values: z.infer<typeof jadwalSchema>) => {
    updateMutation.mutate({ data: values });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pengaturan Jadwal</h1>
        <p className="text-muted-foreground mt-1">Atur hari operasional, kuota nasabah per hari, dan status layanan. Jam buka/tutup diatur per cabang di halaman Kelola Cabang.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Jadwal Operasional NeoPay</CardTitle>
          <CardDescription>Pengaturan ini berlaku global untuk semua cabang. Jam buka/tutup masing-masing cabang diatur secara terpisah.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <FormField
                control={form.control}
                name="aktif"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Status Layanan Antrian</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Matikan jika bank sedang libur atau tidak melayani nasabah.
                      </div>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-aktif" />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="kuotaPerHari"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kuota Nasabah Per Hari</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} data-testid="input-kuota" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hariBuka"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-base">Hari Operasional</FormLabel>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {HARI_PILIHAN.map((item) => (
                        <FormField
                          key={item.id}
                          control={form.control}
                          name="hariBuka"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={item.id}
                                className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-muted/50 cursor-pointer"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(item.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, item.id])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== item.id
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer w-full">
                                  {item.label}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="keterangan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Keterangan Tambahan (Opsional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Misal: Libur nasional, layanan terbatas, dll." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full sm:w-auto" disabled={updateMutation.isPending} data-testid="btn-simpan-jadwal">
                {updateMutation.isPending ? "Menyimpan..." : "Simpan Jadwal"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
