import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { setAuthTokenGetter, ApiError } from "@workspace/api-client-react";
import { getToken, getUserRole, removeToken, removeUser } from "@/lib/auth";

import Layout from "@/components/layout";
import Login from "@/pages/login";
import Daftar from "@/pages/daftar";
import Dashboard from "@/pages/dashboard";
import Antrian from "@/pages/antrian";
import Jadwal from "@/pages/jadwal";
import Pasien from "@/pages/pasien";
import Pengaturan from "@/pages/pengaturan";
import Profil from "@/pages/profil";
import UserManagement from "@/pages/users";
import ApiDocs from "@/pages/api-docs";
import Cabang from "@/pages/cabang";
import Riwayat from "@/pages/riwayat";
import Display from "@/pages/display";
import TestNotif from "@/pages/test-notif";
import { useEffect } from "react";

// Try to use setAuthTokenGetter
try {
  setAuthTokenGetter(getToken);
} catch (e) {
  console.warn("Could not set auth token getter");
}

function handle401(error: unknown) {
  const status =
    error instanceof ApiError
      ? error.status
      : (error as { status?: number })?.status;

  if (status === 401) {
    removeToken();
    removeUser();
    if (!window.location.pathname.endsWith("/login")) {
      window.location.href = import.meta.env.BASE_URL + "login";
    }
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handle401 }),
  mutationCache: new MutationCache({ onError: handle401 }),
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, adminOnly = false }: { component: any, adminOnly?: boolean }) {
  const [location, setLocation] = useLocation();
  
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLocation("/login");
    } else if (adminOnly) {
      const role = getUserRole();
      if (role !== "admin") {
        setLocation("/dashboard");
      }
    }
  }, [location, setLocation, adminOnly]);

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/display" component={Display} />
      <Route path="/login" component={Login} />
      <Route path="/daftar" component={Daftar} />
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/antrian">
        {() => <ProtectedRoute component={Antrian} />}
      </Route>
      <Route path="/jadwal">
        {() => <ProtectedRoute component={Jadwal} adminOnly />}
      </Route>
      <Route path="/nasabah">
        {() => <ProtectedRoute component={Pasien} adminOnly />}
      </Route>
      <Route path="/pengaturan">
        {() => <ProtectedRoute component={Pengaturan} adminOnly />}
      </Route>
      <Route path="/users">
        {() => <ProtectedRoute component={UserManagement} adminOnly />}
      </Route>
      <Route path="/cabang">
        {() => <ProtectedRoute component={Cabang} adminOnly />}
      </Route>
      <Route path="/riwayat">
        {() => <ProtectedRoute component={Riwayat} />}
      </Route>
      <Route path="/profil">
        {() => <ProtectedRoute component={Profil} />}
      </Route>
      <Route path="/docs">
        {() => <ProtectedRoute component={ApiDocs} adminOnly />}
      </Route>
      <Route path="/test-notif">
        {() => <ProtectedRoute component={TestNotif} adminOnly />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
