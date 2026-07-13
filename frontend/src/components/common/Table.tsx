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
}

export default function Table<T>({
  data,
  columns,
  rowKey,
  emptyMessage = "No items found.",
  isLoading = false,
  embedded = false,
}: TableProps<T>) {
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
            {data.map((item) => (
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
    </div>
  );
}
