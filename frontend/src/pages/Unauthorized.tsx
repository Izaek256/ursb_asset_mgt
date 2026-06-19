import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Unauthorized() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div style={{ maxWidth: 500, margin: "4rem auto", textAlign: "center", fontFamily: "system-ui" }}>
      <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>403</div>
      <h1 style={{ marginBottom: "0.5rem" }}>Access Denied</h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>
        {user
          ? `Your account role (${user.role ?? "none"}) does not have permission to access this page.`
          : "You do not have permission to access this page."}
      </p>
      <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
        <button
          onClick={() => navigate("/")}
          style={{
            padding: "0.6rem 1.5rem",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Go Home
        </button>
        <Link
          to="/assets"
          style={{
            padding: "0.6rem 1.5rem",
            background: "#f3f4f6",
            color: "#333",
            borderRadius: 6,
            textDecoration: "none",
          }}
        >
          View Assets
        </Link>
      </div>
    </div>
  );
}
