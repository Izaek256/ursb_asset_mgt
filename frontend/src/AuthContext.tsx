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
  token: string | null; // Keep for compatibility, but we use cookies now
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => void;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>(null!);

// ── API helper ───────────────────────────────────────────────────────────────────
const API_BASE = "/api/v1";

export async function apiFetch<T>(
  path: string,
  opts: RequestInit = {},
  _token?: string | null // Unused, we use cookies
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> || {}),
  };
  
  const res = await fetch(`${API_BASE}${path}`, { 
    ...opts, 
    headers,
    credentials: "include" 
  });
  
  if (res.status === 401 && path !== "/login" && path !== "/auth/check") {
    // Session expired — redirect
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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Validate session on mount
  useEffect(() => {
    refreshUser();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    setIsLoading(true);
    try {
      await apiFetch("/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await refreshUser();
      return null; // success
    } catch (err: any) {
      return err.message || "Login failed";
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/logout", { method: "POST" });
    } catch (e) {
      // ignore
    }
    setUser(null);
    window.location.pathname = "/login";
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiFetch<any>("/auth/check", { method: "GET" });
      if (data.authenticated) {
        setUser({
          user_id: data.email, // backend schema might not return user_id currently
          full_name: `${data.first_name || ""} ${data.last_name || ""}`.trim() || data.username || data.email,
          email: data.email,
          role: data.role || "Employee", // Default fallback if not sent
          department: data.department || "",
          is_active: data.is_active !== false,
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, token: "cookie-auth", login, logout, isLoading, refreshUser }}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
