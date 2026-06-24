import React from "react";
import { apiFetch, useAuth } from "../AuthContext";

type AuthMode = "login" | "signup";

const DEPARTMENTS = [
  "ICT",
  "Finance & Administration",
  "Legal",
  "Registry",
  "Human Resources",
  "Operations",
  "Procurement",
];

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const [mode, setMode] = React.useState<AuthMode>("login");

  // Login fields
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  // Signup fields
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [signupEmail, setSignupEmail] = React.useState("");
  const [signupPassword, setSignupPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [department, setDepartment] = React.useState(DEPARTMENTS[0]);

  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [isSigningUp, setIsSigningUp] = React.useState(false);

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setError(null);
    setSuccess(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    const err = await login(email, password);
    if (err) setError(err);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName || !lastName || !username || !signupEmail || !phone || !signupPassword || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (signupPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (signupPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSigningUp(true);
    try {
      const data = await apiFetch<{ message: string }>(
        "/signup",
        {
          method: "POST",
          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            username: username,
            email: signupEmail,
            phone_number: phone,
            department: department,
            password: signupPassword,
            confirm_password: confirmPassword,
          }),
        }
      );
      setSuccess(data.message + " Please sign in below.");
      setMode("login");
      setEmail(signupEmail);
      setPassword("");
      setFirstName("");
      setLastName("");
      setUsername("");
      setPhone("");
      setSignupEmail("");
      setSignupPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message || "Registration failed.");
    } finally {
      setIsSigningUp(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">🏢</div>
          <h1>URSB Asset Management</h1>
          <p>{mode === "login" ? "Sign in to your account" : "Create a new account"}</p>
        </div>

        {/* Mode Toggle */}
        <div className="auth-toggle">
          <button
            className={`auth-toggle-btn ${mode === "login" ? "active" : ""}`}
            onClick={() => switchMode("login")}
          >
            Sign In
          </button>
          <button
            className={`auth-toggle-btn ${mode === "signup" ? "active" : ""}`}
            onClick={() => switchMode("signup")}
          >
            Create Account
          </button>
        </div>

        {error && <div className="alert-error">{error}</div>}
        {success && <div className="alert-success">{success}</div>}

        {/* ── Login Form ── */}
        {mode === "login" && (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email Address</label>
              <input
                id="login-email"
                type="email"
                className="form-control"
                placeholder="e.g. admin@ursb.go.ug"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                className="form-control"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-login"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        )}

        {/* ── Signup Form ── */}
        {mode === "signup" && (
          <form onSubmit={handleSignup}>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-firstname">First Name</label>
              <input
                id="signup-firstname"
                type="text"
                className="form-control"
                placeholder="e.g. John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus
                autoComplete="given-name"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-lastname">Last Name</label>
              <input
                id="signup-lastname"
                type="text"
                className="form-control"
                placeholder="e.g. Mukasa"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-username">Username</label>
              <input
                id="signup-username"
                type="text"
                className="form-control"
                placeholder="e.g. jmukasa"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-phone">Phone Number</label>
              <input
                id="signup-phone"
                type="text"
                className="form-control"
                placeholder="e.g. +256700000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-email">Email Address</label>
              <input
                id="signup-email"
                type="email"
                className="form-control"
                placeholder="e.g. john@ursb.go.ug"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-dept">Department</label>
              <select
                id="signup-dept"
                className="form-control"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-password">Password</label>
              <input
                id="signup-password"
                type="password"
                className="form-control"
                placeholder="Min. 8 characters (with A-Z, a-z, 0-9, special)"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-confirm">Confirm Password</label>
              <input
                id="signup-confirm"
                type="password"
                className="form-control"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-login"
              disabled={isSigningUp}
            >
              {isSigningUp ? "Creating Account..." : "Create Account"}
            </button>
          </form>
        )}

        <div className="login-footer">
          <p className="text-small text-muted">
            {mode === "login"
              ? "New to URSB? Click Create Account to get started."
              : "Already have an account? Click Sign In above."}
          </p>
        </div>
      </div>
    </div>
  );
}
