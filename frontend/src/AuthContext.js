import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useCallback, useEffect } from "react";
const AuthContext = createContext(null);
// ── API helper ───────────────────────────────────────────────────────────────────
const API_BASE = "/api/v1";
export async function apiFetch(path, opts = {}, _token) {
    const headers = {
        "Content-Type": "application/json",
        ...(opts.headers || {}),
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
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const refreshUser = useCallback(async () => {
        try {
            const data = await apiFetch("/auth/check");
            setUser(data);
        }
        catch {
            setUser(null);
        }
        finally {
            setIsInitialLoading(false);
        }
    }, []);
    // Validate session on mount
    useEffect(() => {
        refreshUser();
    }, [refreshUser]);
    const login = useCallback(async (email, password) => {
        setIsLoading(true);
        try {
            // 1. Post credentials to /login
            await apiFetch("/login", {
                method: "POST",
                body: JSON.stringify({ email, password }),
            });
            // 2. Perform /auth/check to fetch user details
            const checkData = await apiFetch("/auth/check");
            setUser(checkData);
            return null; // success
        }
        catch (err) {
            return err.message || "Login failed";
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    const logout = useCallback(async () => {
        try {
            await apiFetch("/logout", { method: "POST" });
        }
        catch (e) {
            console.error("Logout failed on server", e);
        }
        setUser(null);
        window.location.pathname = "/login";
    }, []);
    return (_jsx(AuthContext.Provider, { value: { user, login, logout, isLoading, isInitialLoading, refreshUser }, children: children }));
}
export function useAuth() {
    return useContext(AuthContext);
}
