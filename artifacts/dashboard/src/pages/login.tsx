import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMasuk } from "@workspace/api-client-react";
import { setToken, setUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const masukMutation = useMasuk({
    mutation: {
      onSuccess: (data) => {
        setToken(data.token);
        if (data.nasabah) setUser(data.nasabah as any);
        toast({ title: "Login Berhasil" });
        setLocation("/dashboard");
      },
      onError: (error) => {
        toast({ 
          title: "Login Gagal", 
          description: error.data?.pesan || "Terjadi kesalahan",
          variant: "destructive"
        });
      }
    }
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    masukMutation.mutate({ data: values });
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-xl overflow-hidden border border-border/50">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <img src="/neopay-logo.png" alt="NeoPay" className="w-24 h-24 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-center text-foreground mb-1">NeoPay</h1>
          <p className="text-center text-muted-foreground text-sm mb-8">Masuk untuk menggunakan layanan antrian digital</p>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="nasabah@neopay.id" {...field} data-testid="input-email" />
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
              <Button 
                type="submit" 
                className="w-full mt-6" 
                disabled={masukMutation.isPending}
                data-testid="button-login"
              >
                {masukMutation.isPending ? "Memproses..." : "Masuk"}
              </Button>
            </form>
          </Form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Belum punya akun?{" "}
            <button
              type="button"
              onClick={() => setLocation("/daftar")}
              className="text-primary font-medium hover:underline"
              data-testid="link-ke-daftar"
            >
              Daftar di sini
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
