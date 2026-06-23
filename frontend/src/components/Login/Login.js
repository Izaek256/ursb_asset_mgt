import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import "./Login.css";
const DEPARTMENTS = [
    { value: "finance", label: "Finance" },
    { value: "it", label: "Information Technology (IT)" },
    { value: "hr", label: "Human Resources" },
    { value: "operations", label: "Operations" },
    { value: "procurement", label: "Procurement" },
    { value: "legal", label: "Legal" },
    { value: "marketing", label: "Marketing" },
    { value: "management", label: "Management" },
];
function PasswordInput({ id, value, onChange, placeholder, disabled, }) {
    const [show, setShow] = useState(false);
    return (_jsxs("div", { className: "pwWrap", children: [_jsx("input", { id: id, type: show ? "text" : "password", value: value, onChange: onChange, placeholder: placeholder, disabled: disabled, className: disabled ? "input inputDisabled pwInputPadded" : "input pwInputPadded" }), !disabled && (_jsx("button", { type: "button", className: "pwToggle", onClick: () => setShow((current) => !current), children: show ? "🙈" : "👁" }))] }));
}
function LoginPanel({ onGoCreate, onSuccess }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [attempts, setAttempts] = useState(0);
    const [error, setError] = useState("");
    const locked = attempts >= 3;
    const handleLogin = async () => {
        if (locked)
            return;
        if (!email.trim() || !password) {
            setError("Please enter your email and password.");
            return;
        }
        try {
            const res = await fetch("/api/v1/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email, password }),
            });
            if (res.ok) {
                onSuccess();
                return;
            }
            const data = await res.json().catch(() => ({}));
            const serverMessage = data.detail ?? "Invalid email or password.";
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);
            if (newAttempts >= 3) {
                setError(serverMessage);
            }
            else {
                setError(`${serverMessage} ${3 - newAttempts} attempt(s) remaining.`);
            }
        }
        catch {
            setError("Unable to connect to server. Please try again.");
        }
    };
    return (_jsxs("div", { className: "panel", children: [locked ? (_jsxs("div", { className: "lockBox", children: ["\uD83D\uDD12 ", _jsx("strong", { children: "Account temporarily locked" }), _jsx("p", { className: "lockText", children: "Too many failed attempts. Please contact your administrator or reset your password." })] })) : (_jsxs(_Fragment, { children: [error && _jsx("div", { className: "errorBox", children: error }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "loginEmail", className: "label", children: "Email address" }), _jsx("input", { id: "loginEmail", type: "email", value: email, onChange: (event) => setEmail(event.target.value), placeholder: "jane.doe@company.com", className: "input" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "loginPassword", className: "label", children: "Password" }), _jsx(PasswordInput, { id: "loginPassword", value: password, onChange: (event) => setPassword(event.target.value), placeholder: "Enter your password" }), _jsx("button", { type: "button", className: "forgotBtn", children: "Forgot password?" })] }), attempts > 0 && _jsxs("p", { className: "attemptsWarn", children: ["\u26A0 ", attempts, "/3 failed attempts"] })] })), _jsx("button", { type: "button", className: locked ? "btnMain btnDisabled" : "btnMain", onClick: handleLogin, disabled: locked, children: "Sign in" }), _jsx("button", { type: "button", className: "btnOutline", onClick: onGoCreate, children: "Create account" })] }));
}
function CreatePanel({ onGoLogin }) {
    const [form, setForm] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        department: "",
        username: "",
        password: "",
        confirmPassword: "",
    });
    const [errors, setErrors] = useState({});
    const [success, setSuccess] = useState(false);
    const updateField = (key) => (event) => {
        setForm((current) => ({ ...current, [key]: event.target.value }));
    };
    const handleCreate = async () => {
        const validation = {};
        if (!form.firstName.trim())
            validation.firstName = "Required";
        if (!form.lastName.trim())
            validation.lastName = "Required";
        if (!form.email.trim()) {
            validation.email = "Required";
        }
        else if (!/\S+@\S+\.\S+/.test(form.email)) {
            validation.email = "Enter a valid email";
        }
        if (!form.phone.trim())
            validation.phone = "Required";
        if (!form.department)
            validation.department = "Select a department";
        if (!form.username.trim())
            validation.username = "Required";
        if (!form.password)
            validation.password = "Required";
        else if (form.password.length < 6)
            validation.password = "Minimum 6 characters";
        if (form.password !== form.confirmPassword)
            validation.confirmPassword = "Passwords do not match";
        setErrors(validation);
        if (Object.keys(validation).length > 0)
            return;
        try {
            const res = await fetch("/api/v1/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    first_name: form.firstName,
                    last_name: form.lastName,
                    email: form.email,
                    phone_number: form.phone,
                    department: form.department,
                    username: form.username,
                    password: form.password,
                    confirm_password: form.confirmPassword,
                }),
            });
            if (res.ok) {
                setSuccess(true);
                return;
            }
            const data = await res.json().catch(() => ({}));
            setErrors({ api: data.detail ?? data.message ?? "Registration failed. Please try again." });
        }
        catch {
            setErrors({ api: "Unable to connect to server. Please try again." });
        }
    };
    if (success) {
        return (_jsxs("div", { className: "panel successPanel", children: [_jsx("div", { className: "successIcon", children: "\u2705" }), _jsx("h2", { className: "successTitle", children: "Account Created!" }), _jsx("p", { className: "successText", children: "Your account has been created successfully. You can now sign in." }), _jsx("button", { type: "button", className: "btnMain", onClick: onGoLogin, children: "Go to Sign in" })] }));
    }
    return (_jsxs("div", { className: "panel", children: [errors.api && _jsx("div", { className: "errorBox", children: errors.api }), _jsx("div", { className: "sectionTag", children: "\uD83D\uDC64 Personal details" }), _jsxs("div", { className: "row2", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "createFirstName", className: "label", children: "First name" }), _jsx("input", { id: "createFirstName", type: "text", value: form.firstName, onChange: updateField("firstName"), placeholder: "Jane", className: "input" }), errors.firstName && _jsx("p", { className: "errorMsg", children: errors.firstName })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "createLastName", className: "label", children: "Last name" }), _jsx("input", { id: "createLastName", type: "text", value: form.lastName, onChange: updateField("lastName"), placeholder: "Doe", className: "input" }), errors.lastName && _jsx("p", { className: "errorMsg", children: errors.lastName })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "createEmail", className: "label", children: "Email address" }), _jsx("input", { id: "createEmail", type: "email", value: form.email, onChange: updateField("email"), placeholder: "jane.doe@company.com", className: "input" }), errors.email && _jsx("p", { className: "errorMsg", children: errors.email })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "createPhone", className: "label", children: "Phone number" }), _jsx("input", { id: "createPhone", type: "tel", value: form.phone, onChange: updateField("phone"), placeholder: "+256 700 000 000", className: "input" }), errors.phone && _jsx("p", { className: "errorMsg", children: errors.phone })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "createDepartment", className: "label", children: "Department" }), _jsxs("select", { id: "createDepartment", value: form.department, onChange: updateField("department"), className: "input", children: [_jsx("option", { value: "", disabled: true, children: "Select your department" }), DEPARTMENTS.map((department) => (_jsx("option", { value: department.value, children: department.label }, department.value)))] }), errors.department && _jsx("p", { className: "errorMsg", children: errors.department })] }), _jsx("div", { className: "sep" }), _jsx("div", { className: "sectionTag", children: "\uD83D\uDD11 Account credentials" }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "createUsername", className: "label", children: "Username" }), _jsx("input", { id: "createUsername", type: "text", value: form.username, onChange: updateField("username"), placeholder: "Choose a username", className: "input" }), errors.username && _jsx("p", { className: "errorMsg", children: errors.username })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "createPassword", className: "label", children: "Password" }), _jsx(PasswordInput, { id: "createPassword", value: form.password, onChange: updateField("password"), placeholder: "Create a strong password" }), errors.password && _jsx("p", { className: "errorMsg", children: errors.password })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "createConfirmPassword", className: "label", children: "Confirm password" }), _jsx(PasswordInput, { id: "createConfirmPassword", value: form.confirmPassword, onChange: updateField("confirmPassword"), placeholder: "Repeat your password" }), errors.confirmPassword && _jsx("p", { className: "errorMsg", children: errors.confirmPassword })] }), _jsx("button", { type: "button", className: "btnMain", onClick: handleCreate, children: "Create account" }), _jsx("button", { type: "button", className: "btnOutline", onClick: onGoLogin, children: "Back to Sign in" })] }));
}
export default function Login({ onSuccess }) {
    const [view, setView] = useState("login");
    const isLogin = view === "login";
    return (_jsxs("div", { className: "pageShell", children: [_jsxs("div", { className: "brand", children: [_jsx("div", { className: "brandIcon", children: "\uD83C\uDFE2" }), _jsx("span", { className: "brandName", children: "Staff Portal" })] }), _jsxs("div", { className: "card", children: [_jsxs("div", { className: "cardHeader", children: [_jsx("div", { className: "avatarCircle", children: isLogin ? "👤" : "✏️" }), _jsx("h1", { className: "cardHeaderTitle", children: isLogin ? "Welcome back" : "Create account" }), _jsx("p", { className: "cardHeaderSub", children: isLogin ? "Sign in to access your account" : "Fill in your details to get started" })] }), isLogin ? (_jsx(LoginPanel, { onGoCreate: () => setView("create"), onSuccess: onSuccess })) : (_jsx(CreatePanel, { onGoLogin: () => setView("login") }))] }), _jsx("p", { className: "footer", children: "Secure staff access portal \u2014 All rights reserved" })] }));
}
