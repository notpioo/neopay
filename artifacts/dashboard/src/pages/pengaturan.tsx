import { useGetStatusWA, getGetStatusWAQueryKey, useGetQrWA, getGetQrWAQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, MessageSquare, CheckCircle2, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import QRCode from "react-qr-code";

export default function Pengaturan() {
  const queryClient = useQueryClient();

  const { data: statusWA, isLoading: isLoadingStatus } = useGetStatusWA({
    query: { queryKey: getGetStatusWAQueryKey() }
  });

  const isConnected = statusWA?.terhubung;

  const { data: qrData, isLoading: isLoadingQr, refetch: refetchQr } = useGetQrWA({
    query: { 
      queryKey: getGetQrWAQueryKey(),
      enabled: !isConnected && statusWA !== undefined 
    }
  });

  useEffect(() => {
    if (statusWA !== undefined && !isConnected) {
      const interval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: getGetStatusWAQueryKey() });
        refetchQr();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [isConnected, statusWA, queryClient, refetchQr]);

  if (isLoadingStatus) {
    return <div className="space-y-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full max-w-md" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pengaturan Sistem</h1>
        <p className="text-muted-foreground mt-1">Konfigurasi integrasi dan notifikasi NeoPay</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-green-600" />
            Koneksi WhatsApp Bot
          </CardTitle>
          <CardDescription>Bot WhatsApp digunakan untuk mengirimkan notifikasi antrian otomatis kepada nasabah.</CardDescription>
        </CardHeader>
        <CardContent>
          {isConnected ? (
            <div className="flex flex-col items-center justify-center p-8 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle2 className="w-16 h-16 text-green-600 mb-4" />
              <h3 className="text-xl font-bold text-green-800 mb-1">WhatsApp Terhubung</h3>
              <p className="text-green-700 text-center mb-6">
                Bot aktif pada nomor: <span className="font-mono font-semibold">{statusWA.nomorWA || 'Tersembunyi'}</span>
              </p>
              <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: getGetStatusWAQueryKey() })}>
                <RefreshCw className="w-4 h-4 mr-2" /> Cek Status
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 border rounded-xl bg-slate-50">
              <AlertTriangle className="w-12 h-12 text-orange-500 mb-4" />
              <h3 className="text-lg font-bold text-slate-800 mb-2">WhatsApp Belum Terhubung</h3>
              <p className="text-slate-600 text-center mb-6 max-w-md">
                Pindai QR Code di bawah ini menggunakan aplikasi WhatsApp Anda (Linked Devices) untuk mengaktifkan notifikasi bot kepada nasabah.
              </p>
              
              <div className="bg-white p-4 rounded-lg shadow-sm mb-6 border">
                {isLoadingQr ? (
                  <Skeleton className="w-64 h-64" />
                ) : qrData?.qr ? (
                  <div className="w-64 h-64 p-2 flex items-center justify-center">
                    <QRCode
                      value={qrData.qr}
                      size={240}
                      style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                      viewBox="0 0 256 256"
                    />
                  </div>
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center bg-slate-100 text-slate-400 text-sm text-center p-4">
                    Memuat QR Code...<br/>Atau server WA sedang offline.
                  </div>
                )}
              </div>

              <Button onClick={() => { queryClient.invalidateQueries({ queryKey: getGetStatusWAQueryKey() }); refetchQr(); }}>
                <RefreshCw className="w-4 h-4 mr-2" /> Muat Ulang QR
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
