import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Calendar, Settings, UserCircle, LogOut, Menu, ShieldCheck, FileCode2, Building2, Monitor, History, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getUserRole, removeToken, removeUser } from "@/lib/auth";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useMe } from "@/hooks/use-me";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { role: liveRole, nama: liveName } = useMe();
  const role = liveRole ?? getUserRole();
  const isAdmin = role === "admin";

  const handleLogout = () => {
    removeToken();
    removeUser();
    setLocation("/login");
  };

  const roleLabel =
    role === "admin" ? "Admin" :
    role === "teller" ? "Teller & CS" :
    "Nasabah";

  const navGroups = [
    {
      label: "Umum",
      show: true,
      items: [
        { name: "Dashboard",  href: "/dashboard", icon: LayoutDashboard, show: true },
        { name: "Antrian",   href: "/antrian",   icon: Users,           show: true },
        { name: "Riwayat",   href: "/riwayat",   icon: History,         show: true },
      ],
    },
    {
      label: "Operasional",
      show: isAdmin,
      items: [
        { name: "Jadwal",  href: "/jadwal",  icon: Calendar,   show: isAdmin },
        { name: "Cabang",  href: "/cabang",  icon: Building2,  show: isAdmin },
        { name: "Nasabah", href: "/nasabah", icon: UserCircle, show: isAdmin },
      ],
    },
    {
      label: "Administrasi",
      show: isAdmin,
      items: [
        { name: "Kelola User",    href: "/users",       icon: ShieldCheck, show: isAdmin },
        { name: "Test Notifikasi", href: "/test-notif", icon: Bell,       show: isAdmin },
        { name: "Pengaturan",  href: "/pengaturan",  icon: Settings,    show: isAdmin },
        { name: "Docs API",    href: "/docs",         icon: FileCode2,   show: isAdmin },
      ],
    },
    {
      label: "Akun",
      show: true,
      items: [
        { name: "Profil", href: "/profil", icon: UserCircle, show: true },
      ],
    },
  ];

  const NavContent = () => (
    <div className="flex flex-col h-full bg-white border-r">
      <div className="p-6 border-b border-border/50">
        <h2 className="text-xl font-bold text-primary tracking-tight flex items-center gap-2">
          <img src="/neopay-logo.png" alt="NeoPay" className="w-8 h-8 object-contain" />
          NeoPay
        </h2>
        <div className="mt-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {roleLabel}
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-4 overflow-y-auto scrollbar-hide">
        {navGroups.filter(g => g.show).map((group) => {
          const visibleItems = group.items.filter(item => item.show);
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = location === item.href;
                  return (
                    <Link key={item.href} href={item.href}>
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className={`w-full justify-start ${isActive ? 'text-primary-foreground bg-primary/90 hover:bg-primary' : 'text-foreground/70 hover:text-primary hover:bg-primary/10'}`}
                        data-testid={`nav-${item.name.toLowerCase()}`}
                      >
                        <item.icon className="mr-3 h-5 w-5" />
                        {item.name}
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border/50 space-y-1">
        <Button
          variant="ghost"
          className="w-full justify-start text-foreground/70 hover:text-primary hover:bg-primary/10"
          onClick={() => window.open(import.meta.env.BASE_URL + "display", "_blank")}
        >
          <Monitor className="mr-3 h-5 w-5" />
          Layar Antrian
        </Button>
        <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleLogout} data-testid="nav-logout">
          <LogOut className="mr-3 h-5 w-5" />
          Keluar
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-muted/30">
      <div className="hidden md:block w-64 flex-shrink-0">
        <NavContent />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden flex items-center justify-between p-4 bg-white border-b">
          <h2 className="text-xl font-bold text-primary flex items-center gap-2">
            <img src="/neopay-logo.png" alt="NeoPay" className="w-7 h-7 object-contain" />
            NeoPay
          </h2>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <NavContent />
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
