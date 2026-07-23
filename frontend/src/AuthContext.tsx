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
  phone_number?: string;
  theme?: string;
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
  _token?: string,
  timeoutMs = 10000
): Promise<T> {
  const isFormData = opts.body instanceof FormData;
  const headers: Record<string, string> = {
    // Don't set Content-Type for FormData — the browser sets it automatically
    // with the correct multipart boundary. Forcing application/json breaks file uploads.
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(opts.headers as Record<string, string> || {}),
  };
  // Note: JWT token header is ignored because we are using HTTP cookies.

  const controller = new AbortController();
  const timerId = window.setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...opts,
      headers,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error("Request timed out. Is the server running?");
    }
    throw err;
  } finally {
    window.clearTimeout(timerId);
  }

  if (res.status === 401) {
    // If we get 401, clear local user session
    // Only reload/redirect to login if not already on the login page
    if (window.location.pathname !== "/login") {
      // Show toast notification
      if ((window as any).toast) {
        (window as any).toast.error("Session Expired", "Please log in again to continue.");
      }
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
        if ((window as any).toast) {
          (window as any).toast.error("Account Deactivated", "Your account has been deactivated. Please contact your administrator.");
        }
        window.location.pathname = "/login?deactivated=true";
      }
      throw new Error("Account deactivated");
    }
    // Show permission error toast
    if ((window as any).toast) {
      (window as any).toast.error("Access Denied", body.detail || "You don't have permission to perform this action.");
    }
    throw new Error(body.detail || `Request failed (${res.status})`);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Show error toast for other errors
    if ((window as any).toast) {
      const errorMessage = body.detail || `Request failed (${res.status})`;
      (window as any).toast.error("Error", errorMessage);
    }
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  // Handle 204 No Content responses (no body to parse)
  if (res.status === 204) {
    return null as T;
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
    } catch (err: any) {
      // Don't redirect on auth check failure - just clear user state
      // The apiFetch function already handles 401 redirects
      console.error("Auth check failed:", err.message);
      setUser(null);
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  // Apply / remove dark mode class whenever user theme preference changes
  useEffect(() => {
    if (user?.theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [user?.theme]);

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
