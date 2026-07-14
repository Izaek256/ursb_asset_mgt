import React from "react";
import { apiFetch } from "../AuthContext";
import { ICONS } from "../utils/icons";
import Button from "../components/common/Button";
import { Dropdown } from "../components/common/Dropdown";
import { CHART, DEPT_BAR_CLASSES, DOT_CLASSES } from "../theme/chartColors";
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────────
interface StatCard {
  label: string;
  value: number;
}
interface RecentAsset {
  id: string;
  name: string;
  category: string;
  value: string;
  date: string;
}
interface CategoryBreakdown {
  name: string;
  count: number;
  total: string;
  pct: number;
}
interface MonthlyAcquisition {
  month: string;
  count: number;
}
interface DepartmentAllocation {
  dept: string;
  assets: number;
}
interface DashboardData {
  stats: StatCard[];
  recent_assets: RecentAsset[];
  categories: CategoryBreakdown[];
  monthly_acquisitions: MonthlyAcquisition[];
  departments: DepartmentAllocation[];
  maintenance_due: number;
}

// ── Fallback mock data ───────────────────────────────────────────────────────────
const MOCK: DashboardData = {
  stats: [
    { label: "Total Assets", value: 23 },
    { label: "Active / Assigned", value: 14 },
    { label: "In Maintenance", value: 2 },
    { label: "Disposed", value: 3 },
  ],
  recent_assets: [
    { id: "1", name: "Dell Latitude 5540", category: "ICT Equipment", value: "UGX 3,200,000", date: "Today" },
    { id: "2", name: "Office Desk (Mahogany)", category: "Furniture", value: "UGX 850,000", date: "Today" },
    { id: "3", name: "Toyota Land Cruiser Prado", category: "Vehicle", value: "UGX 120,000,000", date: "Today" },
  ],
  categories: [
    { name: "ICT Equipment", count: 12, total: "UGX 45,230,000", pct: 78 },
    { name: "Furniture", count: 4, total: "UGX 6,000,000", pct: 32 },
    { name: "Vehicle", count: 3, total: "UGX 290,000,000", pct: 88 },
    { name: "Software", count: 2, total: "UGX 14,350,000", pct: 22 },
  ],
  monthly_acquisitions: [
    { month: "Jan", count: 2 }, { month: "Feb", count: 1 }, { month: "Mar", count: 3 },
    { month: "Apr", count: 0 }, { month: "May", count: 2 }, { month: "Jun", count: 1 },
    { month: "Jul", count: 1 }, { month: "Aug", count: 0 }, { month: "Sep", count: 0 },
    { month: "Oct", count: 0 }, { month: "Nov", count: 0 }, { month: "Dec", count: 0 },
  ],
  departments: [
    { dept: "ICT", assets: 10 },
    { dept: "Administration", assets: 5 },
    { dept: "Finance", assets: 3 },
    { dept: "Legal", assets: 1 },
  ],
  maintenance_due: 3,
};

const CORE_STAT_KEYS = ["total", "active", "maintenance", "disposed"] as const;

const resolveStatCard = (stats: StatCard[], key: (typeof CORE_STAT_KEYS)[number]): StatCard => {
  const matchers: Record<(typeof CORE_STAT_KEYS)[number], (label: string) => boolean> = {
    total: (label) => label.toLowerCase().includes("total"),
    active: (label) => label.toLowerCase().includes("active") || label.toLowerCase().includes("assigned"),
    maintenance: (label) => label.toLowerCase().includes("maintenance"),
    disposed: (label) => label.toLowerCase().includes("disposed"),
  };
  const defaults: Record<(typeof CORE_STAT_KEYS)[number], StatCard> = {
    total: { label: "Total Assets", value: 0 },
    active: { label: "Active / Assigned", value: 0 },
    maintenance: { label: "In Maintenance", value: 0 },
    disposed: { label: "Disposed", value: 0 },
  };
  return stats.find((s) => matchers[key](s.label)) ?? defaults[key];
};

const getStatConfig = (label: string) => {
  const l = label.toLowerCase();
  if (l.includes("total")) {
    return { icon: ICONS.assets, bg: "bg-stat-amberChip", text: "text-stat-amberIcon" };
  }
  if (l.includes("active") || l.includes("assigned")) {
    return { icon: ICONS.checkCircle, bg: "bg-stat-greenChip", text: "text-stat-greenIcon" };
  }
  if (l.includes("maintenance")) {
    return { icon: ICONS.maintenance, bg: "bg-stat-blueChip", text: "text-stat-blueIcon" };
  }
  if (l.includes("disposed")) {
    return { icon: ICONS.trashCircle, bg: "bg-stat-roseChip", text: "text-stat-roseIcon" };
  }
  return { icon: ICONS.assets, bg: "bg-stat-blueChip", text: "text-stat-blueIcon" };
};

export default function Dashboard({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = React.useState<number | null>(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);
  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (selectedYear) params.set("year", selectedYear.toString());
        if (selectedMonth) params.set("month", selectedMonth.toString());
        const result = await apiFetch<DashboardData>(`/dashboard/stats?${params.toString()}`, {});
        if (!cancelled) setData(result);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        if (!cancelled) setData(MOCK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedYear, selectedMonth]);

  if (loading || !data) {
    return (
      <div className="flex justify-center items-center py-20 select-none">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ursb" />
      </div>
    );
  }

  const statsList = CORE_STAT_KEYS.map((key) => resolveStatCard(data.stats, key));

  const totalDeptAssets = data.departments.reduce((sum, d) => sum + d.assets, 0) || 1;

  return (
    <div className="w-full flex flex-col gap-6 select-none font-sans">
      {/* Maintenance Alerts Widget */}
      {data.maintenance_due > 0 && (
        <div className="bg-white border border-sky-cardBorder rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow duration-250">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-stat-amberChip text-stat-amberIcon flex items-center justify-center shrink-0">
              <ICONS.maintenance className="w-5 h-5 stroke-[2.4]" />
            </span>
            <div className="flex flex-col">
              <span className="font-bold text-ink text-sm">
                Maintenance Schedule Warning
              </span>
              <span className="text-xs text-ink-dim mt-0.5">
                There are {data.maintenance_due} assets requiring scheduled maintenance or repairs.
              </span>
            </div>
          </div>
          <Button variant="primary" onClick={() => onNavigate("/maintenance")}>
            View Schedule
          </Button>
        </div>
      )}

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
        {statsList.map((s, index) => {
          const cfg = getStatConfig(s.label);
          const StatIcon = cfg.icon;
          const staggerDelays = ["", "anim-delay-75", "anim-delay-150", "anim-delay-200"];
          const delayClass = staggerDelays[index] ?? "anim-delay-200";
          return (
            <div
              key={s.label}
              className={`bg-white border border-sky-cardBorder rounded-2xl p-5 flex items-center gap-3.5 shadow-sm hover:shadow-xl hover:shadow-ursb/20 hover:-translate-y-1.5 hover:border-transparent duration-300 transition-all opacity-0 animate-statIn motion-reduce:animate-none motion-reduce:opacity-100 ${delayClass}`}
            >
              <span
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.text}`}
              >
                <StatIcon className="w-5 h-5 stroke-[2.4]" />
              </span>
              <div className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-dim leading-tight">
                  {s.label}
                </span>
                <span className="block text-2xl sm:text-3xl font-bold text-ink mt-1 font-sans leading-none tabular-nums">
                  {typeof s.value === "number" ? s.value.toLocaleString() : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left wider column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Acquisitions Bar Chart */}
          <div className="bg-white border border-sky-cardBorder rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-250">
            <div className="flex items-center justify-between border-b border-sky-page/20 pb-4 mb-4">
              <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                <ICONS.clock className="w-4 h-4 stroke-[2.2] text-ink-icon" />
                Asset Acquisitions
              </h3>
              <div className="flex items-center gap-2">
                <Dropdown.Root>
                  <Dropdown.Trigger
                    label={selectedYear.toString()}
                    variant="outline"
                    className="text-xs py-1.5 px-3"
                  />
                  <Dropdown.Panel align="right" minWidth="120px" className="!border-0 !rounded-none !shadow-none !bg-white !p-0 !text-center">
                    {years.map((year) => (
                      <Dropdown.Item
                        key={year}
                        label={year.toString()}
                        onClick={() => setSelectedYear(year)}
                        className="!rounded-none !border-0 !px-0 !py-2 !justify-center !text-center !text-left !text-xs !text-ink !hover:text-ink !hover:bg-transparent !focus:outline-none !focus:bg-transparent"
                      />
                    ))}
                  </Dropdown.Panel>
                </Dropdown.Root>
                <Dropdown.Root>
                  <Dropdown.Trigger
                    label={selectedMonth ? months.find(m => m.value === selectedMonth)?.label || "Month" : "All Months"}
                    variant="outline"
                    className="text-xs py-1.5 px-3"
                  />
                  <Dropdown.Panel align="right" minWidth="140px" className="!border-0 !rounded-none !shadow-none !bg-white !p-0 !text-center">
                    <Dropdown.Item
                      label="All Months"
                      onClick={() => setSelectedMonth(null)}
                      className="!rounded-none !border-0 !px-0 !py-2 !justify-center !text-center !text-left !text-xs !text-ink !hover:text-ink !hover:bg-transparent !focus:outline-none !focus:bg-transparent"
                    />
                    {months.map((month) => (
                      <Dropdown.Item
                        key={month.value}
                        label={month.label}
                        onClick={() => setSelectedMonth(month.value)}
                        className="!rounded-none !border-0 !px-0 !py-2 !justify-center !text-center !text-left !text-xs !text-ink !hover:text-ink !hover:bg-transparent !focus:outline-none !focus:bg-transparent"
                      />
                    ))}
                  </Dropdown.Panel>
                </Dropdown.Root>
              </div>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthly_acquisitions} margin={{ top: 15, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorAcquisitions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.ursbLight} />
                      <stop offset="50%" stopColor={CHART.ursb} />
                      <stop offset="100%" stopColor={CHART.ursbDark} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: CHART.ursbDark, fontSize: 10, fontWeight: 600 }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(215, 233, 252, 0.15)" }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white border border-sky-cardBorder px-2.5 py-1.5 rounded-lg shadow-md text-xs font-bold text-ursb">
                            {payload[0].value} assets
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="url(#colorAcquisitions)"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Assets List */}
          <div className="bg-white border border-sky-cardBorder rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-250">
            <div className="flex items-center justify-between border-b border-sky-page/20 pb-4 mb-4">
              <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                <ICONS.assets className="w-4.5 h-4.5 stroke-[2.2] text-ink-icon" />
                Recent Assets
              </h3>
              <div className="flex items-center gap-1.5">
                <Button variant="icon" className="w-8 h-8" onClick={() => onNavigate("/assets")} title="Search inventory" aria-label="Search inventory">
                  <ICONS.search className="w-4 h-4 stroke-[2.2]" />
                </Button>
                <Button variant="icon" className="w-8 h-8" onClick={() => onNavigate("/assets/register")} title="Add asset" aria-label="Add asset">
                  <ICONS.plus className="w-4 h-4 stroke-[2.2]" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col divide-y divide-sky-page/10">
              {data.recent_assets.map((a, idx) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between py-3 px-2 hover:bg-sky-page/20 rounded-xl transition-colors duration-150 motion-reduce:transition-none"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLASSES[idx % DOT_CLASSES.length]}`} />
                    <div className="flex flex-col">
                      <span className="font-bold text-ink text-xs sm:text-sm">
                        {a.name || "—"}
                      </span>
                      <span className="text-[10px] text-ink-dim font-medium mt-0.5">
                        {a.category || "—"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-xs sm:text-sm font-bold text-ink text-right">
                      {a.value || "—"}
                    </span>
                    <span className="text-[10px] text-ink-dim/60 font-semibold text-right">
                      {a.date || "—"}
                    </span>
                  </div>
                </div>
              ))}
              {data.recent_assets.length === 0 && (
                <div className="text-center py-6 text-xs text-ink-dim font-medium">
                  No assets registered yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right side panels */}
        <div className="flex flex-col gap-6">
          {/* Category breakdown */}
          <div className="bg-white border border-sky-cardBorder rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-250">
            <div className="border-b border-sky-page/20 pb-4 mb-4">
              <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                <ICONS.building className="w-4.5 h-4.5 stroke-[2.2] text-ink-icon" />
                Asset Categories
              </h3>
            </div>
            <div className="flex flex-col gap-5">
              {data.categories.map((c) => (
                <div key={c.name} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-ink">
                    <span className="font-bold truncate max-w-[130px]">
                      {c.name || "—"}
                    </span>
                    <span className="text-ink-dim">
                      {c.total || "—"}
                    </span>
                  </div>
                  {/* Gradient progress track */}
                  <div className="h-1.5 w-full bg-badge-greyBg rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-ursb to-emerald-400 transition-all duration-500 motion-reduce:transition-none"
                      style={{ width: `${Math.min(c.pct, 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-ink-dim/60 font-semibold">
                    {c.count} assets
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Department allocation */}
          <div className="bg-white border border-sky-cardBorder rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-250">
            <div className="border-b border-sky-page/20 pb-4 mb-4">
              <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                <ICONS.users className="w-4.5 h-4.5 stroke-[2.2] text-ink-icon" />
                Department Allocation
              </h3>
            </div>
            <div className="flex flex-col gap-4">
              {/* Stacked horizontal bar chart */}
              <div className="h-4 w-full bg-badge-greyBg rounded-lg overflow-hidden flex shadow-inner">
                {data.departments.map((d, idx) => {
                  const pct = (d.assets / totalDeptAssets) * 100;
                  return (
                    <div
                      key={d.dept}
                      className={`h-full first:rounded-l-lg last:rounded-r-lg transition-all duration-300 ${DEPT_BAR_CLASSES[idx % DEPT_BAR_CLASSES.length]}`}
                      style={{ width: `${pct}%` }}
                      title={`${d.dept}: ${d.assets} assets`}
                    />
                  );
                })}
              </div>

              {/* Department Legend */}
              <div className="flex flex-col gap-2">
                {data.departments.map((d, idx) => (
                  <div
                    key={d.dept}
                    className="flex items-center justify-between text-xs font-semibold text-ink"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${DEPT_BAR_CLASSES[idx % DEPT_BAR_CLASSES.length]}`} />
                      <span className="truncate max-w-[130px]">{d.dept || "—"}</span>
                    </div>
                    <span className="text-ink-dim font-bold">{d.assets}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Insight card */}
          <div className="bg-gradient-to-br from-ursb to-ursb-dark text-white rounded-2xl p-5 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center mb-3">
              <ICONS.alertCircle className="w-4 h-4 stroke-[2.2]" />
            </div>
            <h4 className="font-bold text-sm mb-1.5 font-sans leading-tight">
              Optimize Organization Assets
            </h4>
            <p className="text-[11.5px] text-sky-page/90 leading-relaxed">
              {data.maintenance_due > 0
                ? `${data.maintenance_due} asset(s) are overdue for scheduled service. Book maintenance schedules to extend lifecycle.`
                : "All organizational asset maintenance schedules are clean and completed. Awesome work!"}
            </p>
            <Button
              variant="outline"
              className="mt-4 w-full bg-white/10 hover:bg-white text-white hover:text-ursb border-white/20 hover:border-white shadow-none"
              onClick={() => onNavigate("/maintenance")}
            >
              View Maintenance Queue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
