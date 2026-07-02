import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Table({ data, columns, rowKey, emptyMessage = "No items found.", isLoading = false, embedded = false, }) {
    if (isLoading) {
        return (_jsx("div", { className: "flex justify-center items-center py-12 bg-white border border-sky-cardBorder rounded-2xl", children: _jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-ursb motion-reduce:animate-none" }) }));
    }
    if (data.length === 0) {
        return (_jsx("div", { className: "bg-white border border-sky-cardBorder rounded-2xl p-10 text-center text-ink-dim font-medium", children: emptyMessage }));
    }
    const wrapperCls = embedded
        ? "overflow-hidden"
        : "bg-white border border-sky-cardBorder rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-250 motion-reduce:transition-none";
    return (_jsx("div", { className: wrapperCls, children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full border-collapse text-left text-sm text-ink", children: [_jsx("thead", { children: _jsx("tr", { className: "bg-sky-topbar border-b border-sky-cardBorder select-none", children: columns.map((col, idx) => (_jsx("th", { className: `text-[10px] uppercase font-bold tracking-wider text-ink-dim px-4 sm:px-5 py-3.5 ${col.className || ""}`, children: col.header }, idx))) }) }), _jsx("tbody", { className: "divide-y divide-sky-page/30", children: data.map((item) => (_jsx("tr", { className: "hover:bg-sky-page/20 transition-colors duration-150 motion-reduce:transition-none", children: columns.map((col, idx) => (_jsx("td", { className: `px-4 sm:px-5 py-4 align-middle ${col.className || ""}`, children: col.render(item) }, idx))) }, rowKey(item)))) })] }) }) }));
}
