import { useImportProgress } from "../context/ImportProgressContext";
import { ICONS } from "../utils/icons";

/**
 * Persistent bottom chrome strip that mirrors the header's visual language.
 * Appears whenever a bulk import is active or has just finished.
 * Multiple bars stack vertically when multiple jobs are running.
 * Clicking anywhere on a bar re-opens its source modal.
 */
function SingleProgressBar({ job, dismissJob, openImportModal, openUserImportModal, openCredentialsImportModal }: {
  job: any;
  dismissJob: (id: string) => void;
  openImportModal: (() => void) | null;
  openUserImportModal: (() => void) | null;
  openCredentialsImportModal: (() => void) | null;
}) {
  const isRunning = job.status === "running";
  const isDone    = job.status === "done";
  const isError   = job.status === "error";
  const pct       = job.progress;

  /* ── derived tokens ─────────────────────────────────────────────────────── */
  const fillClass   = isError ? "bg-badge-roseText"  : isDone ? "bg-badge-greenText" : "bg-ursb";
  const chipBg      = isError ? "bg-badge-roseBg"    : isDone ? "bg-badge-greenBg"   : "bg-stat-blueChip";
  const chipText    = isError ? "text-badge-roseText" : isDone ? "text-badge-greenText" : "text-badge-blueText";

  const statusLine = isError
    ? (job.errorMsg ?? "Import failed")
    : isDone
    ? `${job.summary?.imported ?? 0} imported · ${job.summary?.skipped ?? 0} skipped`
    : job.total > 0
    ? `${job.processed} of ${job.total} rows processed`
    : "Preparing…";

  const handleOpen = () => {
    // Use the appropriate modal opener based on import type
    if (job.type === "user" && openUserImportModal) {
      openUserImportModal();
    } else if (job.type === "credentials" && openCredentialsImportModal) {
      openCredentialsImportModal();
    } else if (openImportModal) {
      openImportModal();
    }
  };

  return (
    <div
      className="border-t border-sky-cardBorder bg-sky-topbar/95 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label={`Import: ${statusLine}`}
    >
      {/* ── hairline progress rail – flush to top edge of bar ─────────────── */}
      <div className="h-[3px] w-full bg-sky-border/40 overflow-hidden">
        <div
          className={`h-full ${fillClass} transition-[width] duration-500 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* ── main strip ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-5 sm:px-8 py-2.5 cursor-pointer group"
        onClick={handleOpen}
        title="Click to view import details"
      >
        {/* Status icon chip */}
        <span
          className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${chipBg} ${chipText}`}
        >
          {isRunning ? (
            <ICONS.spinner className="w-3.5 h-3.5 animate-spin" />
          ) : isDone ? (
            <ICONS.checkCircle className="w-3.5 h-3.5" />
          ) : (
            <ICONS.alertCircle className="w-3.5 h-3.5" />
          )}
        </span>

        {/* Label + subtitle */}
        <div className="flex-1 min-w-0 flex flex-col gap-0">
          <span className="text-xs font-bold text-ink truncate leading-tight group-hover:text-ursb transition-colors">
            {job.label}
          </span>
          <span className="text-[11px] text-ink-dim truncate leading-tight mt-0.5">
            {statusLine}
          </span>
        </div>

        {/* Inline progress pill – only while running and total is known */}
        {isRunning && job.total > 0 && (
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <div className="w-28 h-1.5 rounded-full bg-sky-border/60 overflow-hidden">
              <div
                className={`h-full rounded-full ${fillClass} transition-[width] duration-500 ease-out`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[11px] font-bold tabular-nums text-ink-dim w-8 text-right">
              {pct}%
            </span>
          </div>
        )}

        {/* "View details" affordance */}
        <span className="shrink-0 text-[11px] font-semibold text-ursb group-hover:underline underline-offset-2 transition-all hidden sm:block">
          View details
        </span>
        <ICONS.chevronRight className="shrink-0 w-3.5 h-3.5 text-ink-dim group-hover:text-ursb transition-colors" />

        {/* Dismiss – only when finished */}
        {!isRunning && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              dismissJob(job.id);
            }}
            aria-label="Dismiss"
            className="shrink-0 w-7 h-7 flex items-center justify-center text-ink-dim hover:text-ink transition-colors ml-1"
          >
            <ICONS.close className="w-3.5 h-3.5 stroke-[2.4]" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function ImportProgressBar() {
  const { jobs, dismissJob, openImportModal, openUserImportModal, openCredentialsImportModal } = useImportProgress();

  // Show all running jobs, plus the most recent done/error job if no running jobs
  const runningJobs = jobs.filter((j) => j.status === "running");
  const doneJob = runningJobs.length === 0 ? jobs.find((j) => j.status === "done" || j.status === "error") : null;
  const visibleJobs = runningJobs.length > 0 ? runningJobs : (doneJob ? [doneJob] : []);

  if (visibleJobs.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9000] select-none shadow-[0_-2px_12px_rgba(20,58,99,0.08)]">
      {visibleJobs.map((job) => (
        <SingleProgressBar
          key={job.id}
          job={job}
          dismissJob={dismissJob}
          openImportModal={openImportModal}
          openUserImportModal={openUserImportModal}
          openCredentialsImportModal={openCredentialsImportModal}
        />
      ))}
    </div>
  );
}
