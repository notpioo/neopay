import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, ShieldCheck, Landmark, User, Search, ChevronLeft, ChevronRight, ArrowUpDown, Ban, CheckCircle } from "lucide-react";

type UserRole = "nasabah" | "teller" | "admin";
type FilterRole = "semua" | UserRole;
type SortKey = "terbaru" | "terlama" | "nama_az" | "nama_za" | "role";

interface UserItem {
  id: string;
  nama: string;
  email: string;
  noHp: string;
  nik?: string | null;
  noRekening?: string | null;
  role: UserRole;
  aktif: boolean;
  createdAt: string;
}

const ROLE_CONFIG: Record<UserRole, { label: string; variant: "default" | "secondary" | "outline"; icon: React.ElementType; color: string; bg: string }> = {
  admin:   { label: "Admin",   variant: "default",   icon: ShieldCheck, color: "text-primary",          bg: "bg-primary/10" },
  teller:  { label: "Teller",  variant: "secondary",  icon: Landmark,    color: "text-blue-600",         bg: "bg-blue-50" },
  nasabah: { label: "Nasabah", variant: "outline",    icon: User,        color: "text-muted-foreground",  bg: "bg-muted/40" },
};

const PAGE_SIZE = 15;

function formatTanggal(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

async function fetchUsers(): Promise<UserItem[]> {
  const res = await fetch("/api/admin/users", {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Gagal memuat daftar user");
  const data = await res.json();
  return data.users;
}

async function updateRole(id: string, role: UserRole): Promise<UserItem> {
  const res = await fetch(`/api/admin/users/${id}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error("Gagal mengubah role");
  return (await res.json()).user;
}

async function toggleSuspend(id: string, aktif: boolean): Promise<UserItem> {
  const res = await fetch(`/api/admin/users/${id}/suspend`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ aktif }),
  });
  if (!res.ok) throw new Error("Gagal mengubah status akun");
  return (await res.json()).user;
}

export default function UserManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<FilterRole>("semua");
  const [sortKey, setSortKey] = useState<SortKey>("terbaru");
  const [page, setPage] = useState(1);

  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<UserItem | null>(null);

  const { data: users, isLoading, isError } = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchUsers,
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => updateRole(id, role),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditingUser(null);
      setPendingRole(null);
      toast({ title: `Role ${updated.nama} diubah menjadi ${ROLE_CONFIG[updated.role].label}` });
    },
    onError: () => {
      toast({ title: "Gagal mengubah role", variant: "destructive" });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: ({ id, aktif }: { id: string; aktif: boolean }) => toggleSuspend(id, aktif),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setSuspendTarget(null);
      toast({ title: updated.aktif ? `Akun ${updated.nama} diaktifkan kembali` : `Akun ${updated.nama} disuspend` });
    },
    onError: () => {
      toast({ title: "Gagal mengubah status akun", variant: "destructive" });
    },
  });

  const counts = useMemo(() => {
    if (!users) return null;
    return {
      semua:   users.length,
      admin:   users.filter((u) => u.role === "admin").length,
      teller:  users.filter((u) => u.role === "teller").length,
      nasabah: users.filter((u) => u.role === "nasabah").length,
    };
  }, [users]);

  const filtered = useMemo(() => {
    if (!users) return [];
    let list = [...users];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.nama.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.noHp.includes(q)
      );
    }

    if (filterRole !== "semua") {
      list = list.filter((u) => u.role === filterRole);
    }

    list.sort((a, b) => {
      if (sortKey === "terbaru") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortKey === "terlama") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortKey === "nama_az") return a.nama.localeCompare(b.nama, "id");
      if (sortKey === "nama_za") return b.nama.localeCompare(a.nama, "id");
      if (sortKey === "role") return a.role.localeCompare(b.role);
      return 0;
    });

    return list;
  }, [users, search, filterRole, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handleFilterChange = (v: FilterRole) => { setFilterRole(v); setPage(1); };
  const handleSortChange = (v: SortKey) => { setSortKey(v); setPage(1); };

  const FILTER_TABS: { key: FilterRole; label: string }[] = [
    { key: "semua",   label: `Semua (${counts?.semua ?? 0})` },
    { key: "nasabah", label: `Nasabah (${counts?.nasabah ?? 0})` },
    { key: "teller",  label: `Teller (${counts?.teller ?? 0})` },
    { key: "admin",   label: `Admin (${counts?.admin ?? 0})` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Manajemen User</h1>
        <p className="text-muted-foreground mt-1">Kelola role dan status semua pengguna sistem NeoPay</p>
      </div>

      {counts && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            { key: "admin",   Icon: ShieldCheck, color: "text-primary",         label: "Admin" },
            { key: "teller",  Icon: Landmark,    color: "text-blue-600",         label: "Teller" },
            { key: "nasabah", Icon: User,        color: "text-muted-foreground", label: "Nasabah" },
            { key: "semua",   Icon: Users,       color: "text-foreground",        label: "Total" },
          ] as const).map(({ key, Icon, color, label }) => (
            <Card key={key} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => handleFilterChange(key as FilterRole)}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{counts[key]}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-5 h-5 text-primary" />
            Daftar Pengguna
          </CardTitle>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cari nama, email, atau no HP..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
              <Select value={sortKey} onValueChange={(v) => handleSortChange(v as SortKey)}>
                <SelectTrigger className="w-40 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="terbaru">Terbaru</SelectItem>
                  <SelectItem value="terlama">Terlama</SelectItem>
                  <SelectItem value="nama_az">Nama A–Z</SelectItem>
                  <SelectItem value="nama_za">Nama Z–A</SelectItem>
                  <SelectItem value="role">Berdasar Role</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-1.5 flex-wrap pt-1">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleFilterChange(tab.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filterRole === tab.key
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-muted-foreground border-border hover:border-primary/40"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="px-5 pb-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : isError ? (
            <p className="text-center text-muted-foreground py-8">Gagal memuat daftar user.</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {search ? `Tidak ada user cocok dengan "${search}"` : "Belum ada pengguna terdaftar."}
            </p>
          ) : (
            <>
              <div className="divide-y">
                {paginated.map((user) => {
                  const cfg = ROLE_CONFIG[user.role];
                  const Icon = cfg.icon;
                  const isEditing = editingUser?.id === user.id;

                  return (
                    <div key={user.id} className={`py-3.5 flex items-start justify-between gap-4 ${!user.aktif ? "opacity-50" : ""}`}>
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          <Icon className={`w-4 h-4 ${cfg.color}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium truncate">{user.nama}</p>
                            {!user.aktif && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Suspended</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                            {user.noHp && (
                              <p className="text-xs text-muted-foreground">{user.noHp}</p>
                            )}
                            {user.noRekening && (
                              <p className="text-xs text-muted-foreground font-mono">Rek: {user.noRekening}</p>
                            )}
                            <p className="text-xs text-muted-foreground">Daftar: {formatTanggal(user.createdAt)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isEditing ? (
                          <>
                            <Select
                              defaultValue={user.role}
                              onValueChange={(val) => {
                                setPendingRole(val as UserRole);
                              }}
                              disabled={roleMutation.isPending}
                            >
                              <SelectTrigger className="w-28 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="nasabah">Nasabah</SelectItem>
                                <SelectItem value="teller">Teller</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              className="h-8 text-xs px-3"
                              disabled={!pendingRole || roleMutation.isPending}
                              onClick={() => {
                                if (pendingRole) {
                                  roleMutation.mutate({ id: user.id, role: pendingRole });
                                }
                              }}
                            >
                              Simpan
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs"
                              onClick={() => { setEditingUser(null); setPendingRole(null); }}
                              disabled={roleMutation.isPending}
                            >
                              Batal
                            </Button>
                          </>
                        ) : (
                          <>
                            <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => { setEditingUser(user); setPendingRole(null); }}
                            >
                              Ubah Role
                            </Button>
                            <Button
                              size="sm"
                              variant={user.aktif ? "ghost" : "outline"}
                              className={`h-8 text-xs px-2 ${user.aktif ? "text-red-500 hover:text-red-600 hover:bg-red-50" : "text-green-600 hover:text-green-700 hover:bg-green-50"}`}
                              onClick={() => setSuspendTarget(user)}
                            >
                              {user.aktif ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t mt-2">
                  <p className="text-xs text-muted-foreground">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} dari {filtered.length} user
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                      .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((item, idx) =>
                        item === "..." ? (
                          <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground text-sm">…</span>
                        ) : (
                          <Button
                            key={item}
                            size="sm"
                            variant={page === item ? "default" : "outline"}
                            className="h-8 w-8 p-0 text-xs"
                            onClick={() => setPage(item as number)}
                          >
                            {item}
                          </Button>
                        )
                      )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingRole && !!editingUser} onOpenChange={(open) => { if (!open) { setEditingUser(null); setPendingRole(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Ubah Role</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ubah role <strong>{editingUser?.nama}</strong> dari{" "}
              <strong>{editingUser ? ROLE_CONFIG[editingUser.role].label : ""}</strong> menjadi{" "}
              <strong>{pendingRole ? ROLE_CONFIG[pendingRole].label : ""}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setEditingUser(null); setPendingRole(null); }}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (editingUser && pendingRole) {
                  roleMutation.mutate({ id: editingUser.id, role: pendingRole });
                }
              }}
              disabled={roleMutation.isPending}
            >
              Ya, Ubah
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!suspendTarget} onOpenChange={(open) => { if (!open) setSuspendTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {suspendTarget?.aktif ? "Suspend Akun" : "Aktifkan Akun"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {suspendTarget?.aktif
                ? <>Yakin suspend akun <strong>{suspendTarget?.nama}</strong>? Nasabah ini tidak bisa login sampai diaktifkan kembali.</>
                : <>Yakin aktifkan kembali akun <strong>{suspendTarget?.nama}</strong>? Nasabah ini bisa login seperti biasa.</>
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className={suspendTarget?.aktif ? "bg-red-600 hover:bg-red-700" : ""}
              onClick={() => {
                if (suspendTarget) {
                  suspendMutation.mutate({ id: suspendTarget.id, aktif: !suspendTarget.aktif });
                }
              }}
              disabled={suspendMutation.isPending}
            >
              {suspendTarget?.aktif ? "Ya, Suspend" : "Ya, Aktifkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
