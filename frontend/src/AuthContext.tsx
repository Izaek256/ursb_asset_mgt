import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

// ── Types ────────────────────────────────────────────────────────────────────────
export interface AuthUser {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  department: string;
  is_active: boolean;
  created_at?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => void;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>(null!);

// ── API helper ───────────────────────────────────────────────────────────────────
const API_BASE = "/api";

export async function apiFetch<T>(
  path: string,
  opts: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (res.status === 401) {
    // Token expired — clear session
    localStorage.removeItem("ursb_token");
    localStorage.removeItem("ursb_user");
    window.location.reload();
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

// ── Provider ─────────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem("ursb_user");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("ursb_token")
  );

  const [isLoading, setIsLoading] = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (token && !user) {
      refreshUser();
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    setIsLoading(true);
    try {
      const data = await apiFetch<{ access_token: string; user: AuthUser }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        }
      );
      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem("ursb_token", data.access_token);
      localStorage.setItem("ursb_user", JSON.stringify(data.user));
      return null; // success
    } catch (err: any) {
      return err.message || "Login failed";
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("ursb_token");
    localStorage.removeItem("ursb_user");
    window.location.pathname = "/login";
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<AuthUser>("/auth/me", {}, token);
      setUser(data);
      localStorage.setItem("ursb_user", JSON.stringify(data));
    } catch {
      logout();
    }
  }, [token, logout]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
