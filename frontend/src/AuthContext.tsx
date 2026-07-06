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
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => void;
  isLoading: boolean;
  isInitialLoading: boolean;
  refreshUser: () => Promise<void>;
  token?: string;
}

const AuthContext = createContext<AuthContextValue>(null!);

// ── API helper ───────────────────────────────────────────────────────────────────
const API_BASE = "/api/v1";

export async function apiFetch<T>(
  path: string,
  opts: RequestInit = {},
  _token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> || {}),
  };
  // Note: JWT token header is ignored because we are using HTTP cookies.

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...opts,
    headers,
  });

  if (res.status === 401) {
    // If we get 401, clear local user session
    // Only reload/redirect to login if not already on the login page
    if (window.location.pathname !== "/login") {
      window.location.pathname = "/login";
    }
    throw new Error("Unauthorized");
  }

  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    // Check for deactivated user message
    if (body.detail === "Account is deactivated. Contact your administrator.") {
      // Clear user state and redirect to login with deactivation message
      if (window.location.pathname !== "/login") {
        window.location.pathname = "/login?deactivated=true";
      }
      throw new Error("Account deactivated");
    }
    throw new Error(body.detail || `Request failed (${res.status})`);
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
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiFetch<{ authenticated: boolean } & AuthUser>("/auth/check");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  // Validate session on mount
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    setIsLoading(true);
    try {
      // 1. Post credentials to /login
      await apiFetch("/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      // 2. Perform /auth/check to fetch user details
      const checkData = await apiFetch<{ authenticated: boolean } & AuthUser>("/auth/check");
      setUser(checkData);
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
      console.error("Logout failed on server", e);
    }
    setUser(null);
    window.location.pathname = "/login";
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, isInitialLoading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
