import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useDaftar, useMasuk } from "@workspace/api-client-react";
import { setToken, setUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const daftarSchema = z.object({
  nama: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  noHp: z.string().min(9, "Nomor HP minimal 9 digit").max(15, "Nomor HP maksimal 15 digit"),
  nik: z.string().length(16, "NIK harus 16 digit").optional().or(z.literal("")),
  tanggalLahir: z.string().min(1, "Tanggal lahir wajib diisi"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  konfirmasiPassword: z.string(),
}).refine((d) => d.password === d.konfirmasiPassword, {
  message: "Konfirmasi password tidak cocok",
  path: ["konfirmasiPassword"],
});

export default function Daftar() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof daftarSchema>>({
    resolver: zodResolver(daftarSchema),
    defaultValues: { nama: "", email: "", noHp: "", nik: "", tanggalLahir: "", password: "", konfirmasiPassword: "" },
  });

  const masukMutation = useMasuk({
    mutation: {
      onSuccess: (data) => {
        setToken(data.token);
        if (data.nasabah) setUser(data.nasabah as any);
        toast({ title: "Selamat datang di NeoPay!", description: "Akun berhasil dibuat." });
        setLocation("/dashboard");
      },
      onError: () => {
        toast({ title: "Daftar berhasil", description: "Silakan login dengan akun baru Anda." });
        setLocation("/login");
      },
    },
  });

  const daftarMutation = useDaftar({
    mutation: {
      onSuccess: (_data, variables) => {
        masukMutation.mutate({ data: { email: variables.data.email, password: variables.data.password } });
      },
      onError: (error: any) => {
        toast({
          title: "Pendaftaran Gagal",
          description: error?.data?.pesan || "Terjadi kesalahan, coba lagi.",
          variant: "destructive",
        });
      },
    },
  });

  const onSubmit = (values: z.infer<typeof daftarSchema>) => {
    daftarMutation.mutate({
      data: {
        nama: values.nama,
        email: values.email,
        noHp: values.noHp,
        password: values.password,
        nik: values.nik || undefined,
        tanggalLahir: values.tanggalLahir,
      },
    });
  };

  const isPending = daftarMutation.isPending || masukMutation.isPending;

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-xl overflow-hidden border border-border/50">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <img src="/neopay-logo.png" alt="NeoPay" className="w-24 h-24 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-center text-foreground mb-1">Daftar Akun NeoPay</h1>
          <p className="text-center text-muted-foreground text-sm mb-8">Buat akun untuk menggunakan layanan antrian digital</p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="nama"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Lengkap</FormLabel>
                    <FormControl>
                      <Input placeholder="Budi Santoso" {...field} data-testid="input-nama" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="budi@email.com" {...field} data-testid="input-email" />
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
                    <FormLabel>Nomor HP / WhatsApp</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="08123456789" {...field} data-testid="input-nohp" />
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
                    <FormLabel>NIK (Opsional)</FormLabel>
                    <FormControl>
                      <Input placeholder="16 digit NIK" {...field} data-testid="input-nik" maxLength={16} inputMode="numeric" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tanggalLahir"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal Lahir</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-tanggal-lahir" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} data-testid="input-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="konfirmasiPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Konfirmasi Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} data-testid="input-konfirmasi-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full mt-6"
                disabled={isPending}
                data-testid="button-daftar"
              >
                {isPending ? "Memproses..." : "Daftar Sekarang"}
              </Button>
            </form>
          </Form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Sudah punya akun?{" "}
            <button
              type="button"
              onClick={() => setLocation("/login")}
              className="text-primary font-medium hover:underline"
              data-testid="link-ke-login"
            >
              Masuk di sini
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
