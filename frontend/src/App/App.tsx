import { useEffect, useState } from "react";
import Login from "../components/Login/Login";
import "./App.css";

interface AuthState {
  loading: boolean;
  authenticated: boolean;
  email?: string;
  firstName?: string;
  username?: string;
}

function App() {
  const [auth, setAuth] = useState<AuthState>({ loading: true, authenticated: false });

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/v1/auth/check", {
        credentials: "include",
      });
      if (!response.ok) {
        setAuth({ loading: false, authenticated: false });
        return;
      }
      const data = await response.json();
      setAuth({
        loading: false,
        authenticated: true,
        email: data.email,
        firstName: data.first_name ?? undefined,
        username: data.username ?? undefined,
      });
    } catch (err) {
      setAuth({ loading: false, authenticated: false });
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const signOut = async () => {
    await fetch("/api/v1/logout", {
      method: "POST",
      credentials: "include",
    });
    setAuth({ loading: false, authenticated: false });
  };

  if (auth.loading) {
    return <div className="pageShell">Checking authentication...</div>;
  }

  if (!auth.authenticated) {
    return <Login onSuccess={checkAuth} />;
  }

  const welcomeName = auth.firstName || auth.username || auth.email || "";

  return (
    <div className="pageShell">
      <div className="card">
        <h1>Welcome back{welcomeName ? `, ${welcomeName}` : ""}</h1>
        <p>Signed in as {auth.email}</p>
        <button onClick={signOut} className="actionButton">
          Sign out
        </button>
      </div>
    </div>
  );
}

export default App;
