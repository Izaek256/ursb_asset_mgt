import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useCallback, useEffect } from "react";
const AuthContext = createContext(null);
// ── API helper ───────────────────────────────────────────────────────────────────
const API_BASE = "/api";
export async function apiFetch(path, opts = {}, token) {
    const headers = {
        "Content-Type": "application/json",
        ...(opts.headers || {}),
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
export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem("ursb_user");
            return saved ? JSON.parse(saved) : null;
        }
        catch {
            return null;
        }
    });
    const [token, setToken] = useState(() => localStorage.getItem("ursb_token"));
    const [isLoading, setIsLoading] = useState(false);
    // Validate token on mount
    useEffect(() => {
        if (token && !user) {
            refreshUser();
        }
    }, []);
    const login = useCallback(async (email, password) => {
        setIsLoading(true);
        try {
            const data = await apiFetch("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password }),
            });
            setToken(data.access_token);
            setUser(data.user);
            localStorage.setItem("ursb_token", data.access_token);
            localStorage.setItem("ursb_user", JSON.stringify(data.user));
            return null; // success
        }
        catch (err) {
            return err.message || "Login failed";
        }
        finally {
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
        if (!token)
            return;
        try {
            const data = await apiFetch("/auth/me", {}, token);
            setUser(data);
            localStorage.setItem("ursb_user", JSON.stringify(data));
        }
        catch {
            logout();
        }
    }, [token, logout]);
    return (_jsx(AuthContext.Provider, { value: { user, token, login, logout, isLoading, refreshUser }, children: children }));
}
export function useAuth() {
    return useContext(AuthContext);
}
