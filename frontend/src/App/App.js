import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import Login from "../components/Login/Login";
import "./App.css";
function App() {
    const [auth, setAuth] = useState({ loading: true, authenticated: false });
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
        }
        catch (err) {
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
        return _jsx("div", { className: "pageShell", children: "Checking authentication..." });
    }
    if (!auth.authenticated) {
        return _jsx(Login, { onSuccess: checkAuth });
    }
    const welcomeName = auth.firstName || auth.username || auth.email || "";
    return (_jsx("div", { className: "pageShell", children: _jsxs("div", { className: "card", children: [_jsxs("h1", { children: ["Welcome back", welcomeName ? `, ${welcomeName}` : ""] }), _jsxs("p", { children: ["Signed in as ", auth.email] }), _jsx("button", { onClick: signOut, className: "actionButton", children: "Sign out" })] }) }));
}
export default App;
