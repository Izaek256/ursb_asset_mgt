import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "../context/AuthContext";
import ProtectedRoute from "../components/ProtectedRoute";
import AssetList from "../pages/AssetList";
import AssetRegistration from "../pages/AssetRegistration";
import Unauthorized from "../pages/Unauthorized";
import Login from "../components/Login/Login";

function LoginPage() {
  const { checkAuth } = useAuth();
  return <Login onSuccess={checkAuth} />;
}

function Home() {
  const { user, signOut, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const welcomeName = user.firstName || user.username || user.email || "";

  return (
    <div style={{ maxWidth: 600, margin: "4rem auto", textAlign: "center", fontFamily: "system-ui" }}>
      <div style={{ padding: "2rem" }}>
        <h1>Welcome back{welcomeName ? `, ${welcomeName}` : ""}</h1>
        <p style={{ color: "#666" }}>Signed in as {user.email}</p>
        {user.role && (
          <p style={{ color: "#888", fontSize: "0.9rem" }}>Role: {user.role}</p>
        )}
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginTop: "1.5rem" }}>
          <a
            href="/assets"
            style={{
              padding: "0.6rem 1.5rem",
              background: "#2563eb",
              color: "#fff",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            View Assets
          </a>
          <button
            onClick={signOut}
            style={{
              padding: "0.6rem 1.5rem",
              background: "#f3f4f6",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Home />} />
          <Route path="/assets" element={<AssetList />} />
          <Route
            path="/assets/register"
            element={
              <ProtectedRoute allowedRoles={["Asset Manager"]}>
                <AssetRegistration />
              </ProtectedRoute>
            }
          />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
