import React from "react";

export interface Column<T> {
  header: string;
  render: (item: T) => React.ReactNode;
  className?: string;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowKey: (item: T) => string | number;
  emptyMessage?: string;
  isLoading?: boolean;
  embedded?: boolean;
  pageSize?: number; // if provided, enables client-side pagination
}

export default function Table<T>({
  data,
  columns,
  rowKey,
  emptyMessage = "No items found.",
  isLoading = false,
  embedded = false,
  pageSize,
}: TableProps<T>) {
  const [page, setPage] = React.useState(1);

  // Reset to page 1 whenever data changes
  React.useEffect(() => {
    setPage(1);
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12 bg-white border border-sky-cardBorder rounded-2xl">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ursb motion-reduce:animate-none" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white border border-sky-cardBorder rounded-2xl p-10 text-center text-ink-dim font-medium">
        {emptyMessage}
      </div>
    );
  }

  const totalPages = pageSize ? Math.ceil(data.length / pageSize) : 1;
  const pageData = pageSize ? data.slice((page - 1) * pageSize, page * pageSize) : data;

  const wrapperCls = embedded
    ? "overflow-hidden"
    : "bg-white border border-sky-cardBorder rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-250 motion-reduce:transition-none";

  return (
    <div className={wrapperCls}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm text-ink">
          <thead>
            <tr className="bg-sky-topbar border-b border-sky-cardBorder select-none">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={`text-[10px] uppercase font-bold tracking-wider text-ink-dim px-4 sm:px-5 py-3.5 ${
                    col.className || ""
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-sky-page/30">
            {pageData.map((item) => (
              <tr
                key={rowKey(item)}
                className="hover:bg-sky-page/20 transition-colors duration-150 motion-reduce:transition-none"
              >
                {columns.map((col, idx) => (
                  <td
                    key={idx}
                    className={`px-4 sm:px-5 py-4 align-middle ${col.className || ""}`}
                  >
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination controls — shown only when pageSize is set and there's more than one page */}
      {pageSize && totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-sky-cardBorder bg-sky-topbar/50 select-none">
          <span className="text-xs text-ink-dim font-medium">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data.length)} of{" "}
            <span className="font-bold text-ink">{data.length}</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="px-2 py-1 rounded-lg text-xs font-semibold text-ink-dim hover:bg-sky-cardBorder disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="First page"
            >
              «
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-ink-dim hover:bg-sky-cardBorder disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              ‹
            </button>
            {/* Page number buttons — show window of 5 around current */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | "…")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…" ? (
                  <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-ink-dim">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                      page === p
                        ? "bg-ursb text-white shadow-sm"
                        : "text-ink-dim hover:bg-sky-cardBorder"
                    }`}
                    aria-label={`Page ${p}`}
                    aria-current={page === p ? "page" : undefined}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-ink-dim hover:bg-sky-cardBorder disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              ›
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="px-2 py-1 rounded-lg text-xs font-semibold text-ink-dim hover:bg-sky-cardBorder disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Last page"
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
