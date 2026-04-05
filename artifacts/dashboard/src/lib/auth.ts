export type UserRole = "admin" | "teller" | "nasabah";

export interface StoredUser {
  id: string;
  nama: string;
  email: string;
  noHp: string;
  nik?: string | null;
  noRekening?: string | null;
  role: UserRole;
}

export function getToken() {
  return localStorage.getItem("neopay_token");
}

export function setToken(token: string) {
  localStorage.setItem("neopay_token", token);
}

export function removeToken() {
  localStorage.removeItem("neopay_token");
}

export function getUser(): StoredUser | null {
  const raw = localStorage.getItem("neopay_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function setUser(user: StoredUser | null) {
  if (user) {
    localStorage.setItem("neopay_user", JSON.stringify(user));
  } else {
    localStorage.removeItem("neopay_user");
  }
}

export function removeUser() {
  localStorage.removeItem("neopay_user");
}

export function getUserRole(): UserRole | null {
  const token = getToken();
  if (!token) return null;

  const user = getUser();
  if (user?.role) return user.role;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return (payload.app_metadata?.role as UserRole) || "nasabah";
  } catch {
    return "nasabah";
  }
}

export function getUserName(): string | null {
  const user = getUser();
  if (user?.nama) return user.nama;

  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.user_metadata?.nama || payload.email || null;
  } catch {
    return null;
  }
}
