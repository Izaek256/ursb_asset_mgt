import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
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
    const [mode, setMode] = React.useState("login");
    // Login fields
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    // Signup fields
    const [fullName, setFullName] = React.useState("");
    const [signupEmail, setSignupEmail] = React.useState("");
    const [signupPassword, setSignupPassword] = React.useState("");
    const [confirmPassword, setConfirmPassword] = React.useState("");
    const [department, setDepartment] = React.useState(DEPARTMENTS[0]);
    const [error, setError] = React.useState(null);
    const [success, setSuccess] = React.useState(null);
    const [isSigningUp, setIsSigningUp] = React.useState(false);
    const switchMode = (m) => {
        setMode(m);
        setError(null);
        setSuccess(null);
    };
    const handleLogin = async (e) => {
        e.preventDefault();
        setError(null);
        if (!email || !password) {
            setError("Please enter both email and password.");
            return;
        }
        const err = await login(email, password);
        if (err)
            setError(err);
    };
    const handleSignup = async (e) => {
        e.preventDefault();
        setError(null);
        if (!fullName || !signupEmail || !signupPassword) {
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
            const data = await apiFetch("/auth/signup", {
                method: "POST",
                body: JSON.stringify({
                    full_name: fullName,
                    email: signupEmail,
                    password: signupPassword,
                    department,
                }),
            });
            setSuccess(data.message + " Please sign in below.");
            setMode("login");
            setEmail(signupEmail);
            setPassword("");
            setFullName("");
            setSignupEmail("");
            setSignupPassword("");
            setConfirmPassword("");
        }
        catch (err) {
            setError(err.message || "Registration failed.");
        }
        finally {
            setIsSigningUp(false);
        }
    };
    return (_jsx("div", { className: "login-page", children: _jsxs("div", { className: "login-card", children: [_jsxs("div", { className: "login-brand", children: [_jsx("div", { className: "login-logo", children: "\uD83C\uDFE2" }), _jsx("h1", { children: "URSB Asset Management" }), _jsx("p", { children: mode === "login" ? "Sign in to your account" : "Create a new account" })] }), _jsxs("div", { className: "auth-toggle", children: [_jsx("button", { className: `auth-toggle-btn ${mode === "login" ? "active" : ""}`, onClick: () => switchMode("login"), children: "Sign In" }), _jsx("button", { className: `auth-toggle-btn ${mode === "signup" ? "active" : ""}`, onClick: () => switchMode("signup"), children: "Create Account" })] }), error && _jsx("div", { className: "alert-error", children: error }), success && _jsx("div", { className: "alert-success", children: success }), mode === "login" && (_jsxs("form", { onSubmit: handleLogin, children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", htmlFor: "login-email", children: "Email Address" }), _jsx("input", { id: "login-email", type: "email", className: "form-control", placeholder: "e.g. admin@ursb.go.ug", value: email, onChange: (e) => setEmail(e.target.value), autoFocus: true, autoComplete: "email" })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", htmlFor: "login-password", children: "Password" }), _jsx("input", { id: "login-password", type: "password", className: "form-control", placeholder: "Enter your password", value: password, onChange: (e) => setPassword(e.target.value), autoComplete: "current-password" })] }), _jsx("button", { type: "submit", className: "btn btn-primary btn-login", disabled: isLoading, children: isLoading ? "Signing in..." : "Sign In" })] })), mode === "signup" && (_jsxs("form", { onSubmit: handleSignup, children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", htmlFor: "signup-name", children: "Full Name" }), _jsx("input", { id: "signup-name", type: "text", className: "form-control", placeholder: "e.g. John Mukasa", value: fullName, onChange: (e) => setFullName(e.target.value), autoFocus: true, autoComplete: "name" })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", htmlFor: "signup-email", children: "Email Address" }), _jsx("input", { id: "signup-email", type: "email", className: "form-control", placeholder: "e.g. john@ursb.go.ug", value: signupEmail, onChange: (e) => setSignupEmail(e.target.value), autoComplete: "email" })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", htmlFor: "signup-dept", children: "Department" }), _jsx("select", { id: "signup-dept", className: "form-control", value: department, onChange: (e) => setDepartment(e.target.value), children: DEPARTMENTS.map((d) => (_jsx("option", { value: d, children: d }, d))) })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", htmlFor: "signup-password", children: "Password" }), _jsx("input", { id: "signup-password", type: "password", className: "form-control", placeholder: "Min. 8 characters", value: signupPassword, onChange: (e) => setSignupPassword(e.target.value), autoComplete: "new-password" })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", htmlFor: "signup-confirm", children: "Confirm Password" }), _jsx("input", { id: "signup-confirm", type: "password", className: "form-control", placeholder: "Re-enter your password", value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value), autoComplete: "new-password" })] }), _jsx("button", { type: "submit", className: "btn btn-primary btn-login", disabled: isSigningUp, children: isSigningUp ? "Creating Account..." : "Create Account" })] })), _jsx("div", { className: "login-footer", children: _jsx("p", { className: "text-small text-muted", children: mode === "login"
                            ? "New to URSB? Click Create Account to get started."
                            : "Already have an account? Click Sign In above." }) })] }) }));
}
