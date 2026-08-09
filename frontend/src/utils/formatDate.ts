/**
 * Consistent date + time formatting — East Africa Time (EAT, UTC+3), 12-hour with AM/PM.
 * All timestamps stored in UTC are converted to EAT for display.
 */

const EAT_LOCALE = "en-UG"; // Uganda locale — falls back to en if unavailable
const EAT_TZ    = "Africa/Kampala"; // UTC+3, no DST

/** Full datetime: "20 Jul 2026, 08:02 AM" (EAT) */
export function fmtDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(EAT_LOCALE, {
    timeZone: EAT_TZ,
    day:      "2-digit",
    month:    "short",
    year:     "numeric",
    hour:     "2-digit",
    minute:   "2-digit",
    hour12:   true,
  });
}

/**
 * Date-only for fields that are genuinely date-only (e.g. expected return date,
 * acquisition date, scheduled service date): "20 Jul 2026"
 */
export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(EAT_LOCALE, {
    timeZone: EAT_TZ,
    day:      "2-digit",
    month:    "short",
    year:     "numeric",
  });
}
