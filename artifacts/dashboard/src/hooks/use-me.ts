import { useQuery } from "@tanstack/react-query";
import { getToken, setUser, type StoredUser, type UserRole } from "@/lib/auth";

interface MeResponse {
  nasabah: StoredUser | null;
}

async function fetchMe(): Promise<StoredUser | null> {
  const token = getToken();
  if (!token) return null;
  const res = await fetch("/api/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    // Lempar error supaya QueryCache global handler bisa tangkap & redirect ke login
    const err = Object.assign(new Error("Unauthorized"), { status: 401 });
    throw err;
  }
  if (!res.ok) return null;
  const data: MeResponse = await res.json();
  if (data.nasabah) setUser(data.nasabah);
  return data.nasabah;
}

export function useMe() {
  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    enabled: !!getToken(),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const role: UserRole | null = data?.role ?? null;
  const nama: string | null = data?.nama ?? null;

  return { user: data ?? null, role, nama };
}
