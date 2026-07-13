import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
import { ICONS } from "../utils/icons";
import Button from "../components/common/Button";
import FormInput from "../components/common/FormInput";
import SuccessBanner from "../components/common/SuccessBanner";

// Background slideshow assets
import logoImg from "../assets/logo 1.jpeg";

type AuthMode = "signin" | "signup";

const DEPARTMENTS = [
  { value: "ICT", label: "ICT" },
  { value: "Registration", label: "Registration" },
  { value: "Finance", label: "Finance" },
  { value: "Legal", label: "Legal" },
  { value: "Human Resources", label: "Human Resources" },
  { value: "Business Registration", label: "Business Registration" },
];

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const [mode, setMode] = React.useState<AuthMode>("signin");
  const [isMounted, setIsMounted] = React.useState(false);
  const [postAuthMessage, setPostAuthMessage] = React.useState<string | null>(null);

  // Slideshow state
  const slides = [
    "https://res.cloudinary.com/dun3og1nu/image/upload/v1783924198/building_1_qtql5q.jpg",
    "https://res.cloudinary.com/dun3og1nu/image/upload/v1783924198/building_2_lga9u4.jpg",
    "https://res.cloudinary.com/dun3og1nu/image/upload/v1783924199/cabinet_or4efw.jpg"
  ];
  const [activeSlide, setActiveSlide] = React.useState(0);

  // Form states
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [signupEmail, setSignupEmail] = React.useState("");
  const [signupPassword, setSignupPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [department, setDepartment] = React.useState(DEPARTMENTS[0].value);

  // Alerts
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [isSigningUp, setIsSigningUp] = React.useState(false);
  const [isDeactivated, setIsDeactivated] = React.useState(false);

  // Mount animation trigger
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Background slideshow interval
  React.useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [slides.length]);

  // Check URL params and sessionStorage
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("deactivated") === "true") {
      setIsDeactivated(true);
    }
    const message = sessionStorage.getItem("post_auth_message");
    if (message) {
      setPostAuthMessage(message);
      sessionStorage.removeItem("post_auth_message");
    }
  }, []);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setSuccess(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsDeactivated(false);

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
    setSuccess(null);

    if (
      !firstName ||
      !lastName ||
      !username ||
      !signupEmail ||
      !phone ||
      !signupPassword ||
      !confirmPassword
    ) {
      setError("Please fill in all fields.");
      return;
    }

    // Password validation constraints
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(signupPassword)) {
      setError(
        "Password must be at least 8 characters with upper, lower, number, and special character."
      );
      return;
    }

    if (signupPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSigningUp(true);
    try {
      const data = await apiFetch<{ message: string }>("/signup", {
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
      });

      setSuccess(`${data.message} Please sign in below.`);
      setMode("signin");
      setEmail(signupEmail);
      setPassword("");
      // Clear signup form
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
    <div className="relative min-height-screen min-h-screen w-full flex flex-col items-center justify-center overflow-x-hidden overflow-y-auto px-4 py-12 select-none">
      {/* ── Background Slideshow ─────────────────────────────────────────────────── */}
      <div className="fixed inset-0 z-0 overflow-hidden bg-navy-deep pointer-events-none">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              activeSlide === index ? "opacity-100 z-10" : "opacity-0 z-0"
            }`}
          >
            <div
              className={`w-full h-full bg-cover bg-center transition-transform duration-[6000ms] ease-linear transform ${
                activeSlide === index
                  ? "scale-116 animate-kenburns"
                  : "scale-108"
              } motion-reduce:transition-none motion-reduce:transform-none motion-reduce:scale-100 motion-reduce:animate-none`}
              style={{
                backgroundImage: `url(${slide})`,
              }}
            />
          </div>
        ))}
        {/* Subtle overlay gradients */}
        <div className="absolute inset-0 z-20 bg-gradient-to-b from-navy-deep/14 via-navy-deep/6 to-navy-deep/24" />
        <div className="absolute inset-0 z-20 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(8,17,31,0.28)_100%)]" />
      </div>

      {/* ── Fixed Footer Label ────────────────────────────────────────────────────── */}
      <div className="fixed bottom-4 right-6 z-30 text-right select-none pointer-events-none hidden sm:block">
        <span className="text-[10px] uppercase font-bold tracking-widest text-ice/40 select-none">
          Uganda Registration Services Bureau
        </span>
      </div>

      {/* ── Slideshow Dots ───────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 select-none">
        {slides.map((_, index) => (
          <div
            key={index}
            className={`h-[7px] rounded-full transition-all duration-300 ${
              activeSlide === index
                ? "w-5 bg-white opacity-100"
                : "w-[7px] bg-white/40 opacity-35"
            }`}
          />
        ))}
      </div>

      {/* ── Session Auth Message Banner ───────────────────────────────────────────── */}
      {postAuthMessage && (
        <div className="relative z-30 mb-5 w-full max-w-[420px] animate-fadeIn motion-reduce:animate-none">
          <SuccessBanner
            message={postAuthMessage}
            onDismiss={() => setPostAuthMessage(null)}
          />
        </div>
      )}

      {/* ── Main Glass Card ──────────────────────────────────────────────────────── */}
      <div
        className={`relative z-30 w-full max-w-[420px] rounded-[20px] bg-glass-blue/16 backdrop-blur-2xl backdrop-saturate-150 border border-glass-border/38 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] shadow-2xl p-6 sm:p-10 transition-all duration-700 ease-out transform ${
          isMounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[22px]"
        } motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100 motion-reduce:translate-y-0`}
      >
        {/* Floating Logo Badge */}
        <div className="flex justify-center mb-5 select-none">
          <div className="w-[88px] h-[88px] rounded-full p-[3px] bg-gradient-to-tr from-pastel-gold via-pastel-pink via-pastel-blue to-pastel-purple shadow-lg relative animate-float motion-reduce:animate-none">
            <div className="absolute inset-[3px] bg-white rounded-full flex items-center justify-center overflow-hidden">
              <img
                src={logoImg}
                alt="URSB Logo"
                className="w-[72px] h-[72px] object-contain p-1 select-none pointer-events-none"
              />
            </div>
            {/* Gloss highlight shine */}
            <div className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white/40 filter blur-[2px] pointer-events-none" />
          </div>
        </div>

        {/* Header Text */}
        <div className="text-center mb-6 select-none">
          <h1 className="text-[19px] font-bold text-white tracking-wide font-sans">
            URSB Asset Management
          </h1>
          <p className="text-sm text-white/60 mt-1.5 transition-all duration-200">
            {mode === "signin"
              ? "Sign in to your account"
              : "Create a new account"}
          </p>
        </div>

        {/* Translucent Tab Switcher */}
        <div className="flex p-1 bg-navy-deep/40 backdrop-blur-sm rounded-xl border border-glass-border/10 mb-6 select-none">
          <button
            type="button"
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer focus:outline-none ${
              mode === "signin"
                ? "bg-white text-ursb shadow-sm"
                : "text-white/60 hover:text-white bg-transparent"
            }`}
            onClick={() => switchMode("signin")}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer focus:outline-none ${
              mode === "signup"
                ? "bg-white text-ursb shadow-sm"
                : "text-white/60 hover:text-white bg-transparent"
            }`}
            onClick={() => switchMode("signup")}
          >
            Create Account
          </button>
        </div>

        {/* Error / Success Alerts */}
        {isDeactivated && (
          <div className="mb-5 p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2">
            <ICONS.alertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>Your account has been deactivated. Contact your administrator.</span>
          </div>
        )}
        {error && (
          <div className="mb-5 p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn motion-reduce:animate-none">
            <ICONS.alertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-5 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn motion-reduce:animate-none">
            <ICONS.checkCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* ── Forms Panel Container (Auto-Height Grid) ───────────────────────────── */}
        <div className="relative w-full">
          {/* Sign In Form Panel */}
          <div
            className={`grid transition-[grid-template-rows] duration-500 ease-out ${
              mode === "signin" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            } motion-reduce:transition-none motion-reduce:grid-rows-[1fr]`}
          >
            <div className="overflow-hidden">
              <form
                onSubmit={handleLogin}
                className={`flex flex-col gap-5 transition-all duration-300 ${
                  mode === "signin"
                    ? "opacity-100 translate-y-0 delay-150"
                    : "opacity-0 -translate-y-2 pointer-events-none"
                } motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100`}
              >
                <FormInput
                  type="email"
                  label="Email Address"
                  placeholder="e.g. admin@ursb.go.ug"
                  value={email}
                  onChange={setEmail}
                  autoFocus
                  autoComplete="email"
                />
                <FormInput
                  type="password"
                  label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                />
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  isLoading={isLoading}
                  className="mt-2"
                >
                  Sign In
                </Button>
                <div className="border-t border-glass-border/16 my-1" />
                <p className="text-center text-xs text-white/50">
                  New to URSB?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className="font-bold text-ice hover:text-white underline bg-transparent border-none cursor-pointer focus:outline-none"
                  >
                    Create Account
                  </button>{" "}
                  to get started.
                </p>
              </form>
            </div>
          </div>

          {/* Create Account Form Panel */}
          <div
            className={`grid transition-[grid-template-rows] duration-500 ease-out ${
              mode === "signup" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            } motion-reduce:transition-none motion-reduce:grid-rows-[1fr]`}
          >
            <div className="overflow-hidden">
              <form
                onSubmit={handleSignup}
                className={`flex flex-col gap-5 transition-all duration-300 ${
                  mode === "signup"
                    ? "opacity-100 translate-y-0 delay-150"
                    : "opacity-0 -translate-y-2 pointer-events-none"
                } motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100`}
              >
                <div className="flex gap-4">
                  <FormInput
                    type="text"
                    label="First Name"
                    placeholder="e.g. John"
                    value={firstName}
                    onChange={setFirstName}
                    required
                    autoComplete="given-name"
                  />
                  <FormInput
                    type="text"
                    label="Last Name"
                    placeholder="e.g. Mukasa"
                    value={lastName}
                    onChange={setLastName}
                    required
                    autoComplete="family-name"
                  />
                </div>
                <FormInput
                  type="text"
                  label="Username"
                  placeholder="e.g. jmukasa"
                  value={username}
                  onChange={setUsername}
                  required
                  autoComplete="username"
                />
                <FormInput
                  type="text"
                  label="Phone Number"
                  placeholder="e.g. +256700000000"
                  value={phone}
                  onChange={setPhone}
                  required
                  autoComplete="tel"
                />
                <FormInput
                  type="email"
                  label="Email Address"
                  placeholder="e.g. john@ursb.go.ug"
                  value={signupEmail}
                  onChange={setSignupEmail}
                  required
                  autoComplete="email"
                />
                <FormInput
                  type="select"
                  label="Department"
                  value={department}
                  onChange={setDepartment}
                  options={DEPARTMENTS}
                  required
                />
                <FormInput
                  type="password"
                  label="Password"
                  placeholder="Min. 8 chars (A-Z, a-z, 0-9, special)"
                  value={signupPassword}
                  onChange={setSignupPassword}
                  required
                  autoComplete="new-password"
                />
                <FormInput
                  type="password"
                  label="Confirm Password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  required
                  autoComplete="new-password"
                />
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  isLoading={isSigningUp}
                  className="mt-2"
                >
                  Create Account
                </Button>
                <div className="border-t border-glass-border/16 my-1" />
                <p className="text-center text-xs text-white/50">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="font-bold text-ice hover:text-white underline bg-transparent border-none cursor-pointer focus:outline-none"
                  >
                    Sign In
                  </button>{" "}
                  instead.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
