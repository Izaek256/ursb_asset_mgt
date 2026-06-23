import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
export default function Transfers() {
    const { token } = useAuth();
    const [transfers, setTransfers] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
    React.useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        apiFetch("/transfers", {}, token)
            .then((data) => { if (!cancelled)
            setTransfers(data); })
            .catch(() => { if (!cancelled)
            setTransfers([]); })
            .finally(() => { if (!cancelled)
            setIsLoading(false); });
        return () => { cancelled = true; };
    }, [token]);
    if (isLoading) {
        return _jsx("div", { className: "page-loading", children: "Loading transfers..." });
    }
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "filter-bar", children: _jsxs("div", { className: "filter-count", children: [transfers.length, " transfers"] }) }), _jsxs("div", { className: "card", children: [_jsxs("div", { className: "card-header", children: [_jsx("h2", { className: "card-title", children: "Asset Transfers" }), _jsx("div", { className: "text-small text-muted", children: "Custody change history" })] }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Asset" }), _jsx("th", { children: "From" }), _jsx("th", { children: "To" }), _jsx("th", { children: "Date" }), _jsx("th", { children: "Reason" }), _jsx("th", { children: "Authorised By" }), _jsx("th", { children: "Status" })] }) }), _jsx("tbody", { children: transfers.map((t) => (_jsxs("tr", { children: [_jsxs("td", { children: [_jsx("div", { className: "user-name", children: t.asset_name }), _jsx("div", { className: "text-small text-muted", children: t.asset_id })] }), _jsx("td", { children: t.from_user }), _jsx("td", { children: t.to_user }), _jsx("td", { className: "text-small", children: t.transfer_date }), _jsx("td", { className: "text-small", children: t.reason }), _jsx("td", { children: t.authorised_by }), _jsx("td", { children: _jsx("span", { className: `badge ${t.acknowledged ? "badge-active" : "badge-warning"}`, children: t.acknowledged ? "Acknowledged" : "Pending" }) })] }, t.transfer_id))) })] }), transfers.length === 0 && (_jsx("div", { className: "page-empty", children: "No transfers recorded yet." }))] })] }));
}
