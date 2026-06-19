import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";

interface AuthUser {
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  phoneNumber?: string;
  department?: string;
  role?: string;
}

interface AuthContextValue {
  loading: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  checkAuth: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  loading: true,
  authenticated: false,
  user: null,
  checkAuth: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/auth/check", {
        credentials: "include",
      });
      if (!response.ok) {
        setUser(null);
        setLoading(false);
        return;
      }
      const data = await response.json();
      setUser({
        email: data.email,
        firstName: data.first_name ?? undefined,
        lastName: data.last_name ?? undefined,
        username: data.username ?? undefined,
        phoneNumber: data.phone_number ?? undefined,
        department: data.department ?? undefined,
        role: data.role ?? undefined,
      });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/v1/logout", {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <AuthContext.Provider
      value={{
        loading,
        authenticated: !!user,
        user,
        checkAuth,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
