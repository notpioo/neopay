import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useDaftar } from "@workspace/api-client-react";
import { UserPlus, Info } from "lucide-react";

const nasabahSchema = z.object({
  nama: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  noHp: z.string().min(10, "Nomor HP tidak valid"),
  tanggalLahir: z.string().min(1, "Tanggal lahir wajib diisi"),
  nik: z.string().optional(),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

export default function Pasien() {
  const { toast } = useToast();

  const daftarMutation = useDaftar({
    mutation: {
      onSuccess: () => {
        toast({ title: "Nasabah berhasil didaftarkan", description: "Nomor rekening telah digenerate otomatis." });
        form.reset();
      },
      onError: (err: { data?: { pesan?: string } }) => {
        toast({ title: "Gagal mendaftarkan nasabah", description: err.data?.pesan, variant: "destructive" });
      }
    }
  });

  const form = useForm<z.infer<typeof nasabahSchema>>({
    resolver: zodResolver(nasabahSchema),
    defaultValues: {
      nama: "",
      email: "",
      noHp: "",
      tanggalLahir: "",
      nik: "",
      password: "",
    },
  });

  const onSubmit = (values: z.infer<typeof nasabahSchema>) => {
    daftarMutation.mutate({ data: values });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manajemen Nasabah</h1>
        <p className="text-muted-foreground mt-1">Daftarkan akun nasabah baru ke dalam sistem NeoPay</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Daftar Nasabah Baru
          </CardTitle>
          <CardDescription>
            Nasabah yang didaftarkan dapat login dan mengambil antrian secara mandiri.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 p-3 mb-6">
            <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-primary/80">
              Nomor rekening akan digenerate otomatis dari tanggal lahir nasabah (format DDMM + 4 digit acak).
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="nama"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Lengkap</FormLabel>
                    <FormControl>
                      <Input placeholder="Budi Santoso" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="budi@example.com" {...field} />
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
                        <Input placeholder="081234567890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField
                  control={form.control}
                  name="tanggalLahir"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tanggal Lahir</FormLabel>
                      <FormControl>
                        <Input placeholder="DD-MM-YYYY" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nik"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NIK <span className="text-muted-foreground font-normal">(Opsional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="16 digit NIK" {...field} maxLength={16} inputMode="numeric" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password Default</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Minimal 6 karakter" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">Berikan password ini kepada nasabah untuk login pertama kali.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={daftarMutation.isPending} className="w-full sm:w-auto">
                {daftarMutation.isPending ? "Mendaftarkan..." : "Daftarkan Nasabah"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
