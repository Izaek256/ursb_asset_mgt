import React, { useState, useRef, useCallback } from "react";
import { ICONS } from "../../utils/icons";
import Button from "../common/Button";
import Modal from "../Modal";
import { apiFetch } from "../../AuthContext";
import { useImportProgress } from "../../context/ImportProgressContext";

const CSV_TEMPLATE = `full_name,email,role,department
John Doe,john.doe@ursb.go.ug,EMPLOYEE,ICT
Jane Smith,jane.smith@ursb.go.ug,ASSET_MANAGER,Finance`;

interface CreatedAccount {
  full_name: string;
  email: string;
  role: string;
  generated_password: string;
}

interface ImportError {
  row: number;
  email: string | null;
  reason: string;
}

interface ImportSummary {
  total_rows: number;
  created: number;
  skipped: number;
  errors: ImportError[];
  accounts: CreatedAccount[];
}

import { forwardRef, useImperativeHandle } from "react";

interface BulkUserImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
  onMinimize?: () => void;
  jobId?: string | null;
}

export interface BulkUserImportModalRef {
  handleCancel: () => void;
}

const BulkUserImportModal = forwardRef<BulkUserImportModalRef, BulkUserImportModalProps>(({
  isOpen,
  onClose,
  onImportSuccess,
  onMinimize,
  jobId,
}, ref) => {
  const { startJob, updateJob, jobs } = useImportProgress();

  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [copied, setCopied] = useState(false);

  // Progress tracking
  const [progress, setProgress] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const jobIdRef = useRef<string | null>(null);

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "user_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const validateAndSetFile = (selectedFile: File) => {
    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv" && ext !== "xlsx") {
      setErrorMsg("Unsupported file type. Please upload a CSV or XLSX file.");
      return;
    }
    if (selectedFile.size > 2 * 1024 * 1024) {
      setErrorMsg("File too large. Maximum size is 2 MB.");
      return;
    }
    setErrorMsg(null);
    setFile(selectedFile);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  /** Parse the CSV/XLSX file into row objects in the browser */
  const parseFile = async (f: File): Promise<Record<string, string>[]> => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext === "csv") {
      const text = await f.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) return [];
      const headers = lines[0].split(",").map((h) => h.trim());
      return lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim());
        return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
      });
    } else {
      // XLSX — use the server-side HTTP endpoint instead for xlsx
      // We switch to multipart upload for xlsx files
      return [];
    }
  };

  const handleImport = async () => {
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();

    setIsLoading(true);
    setIsProcessing(true);
    setErrorMsg(null);
    setSummary(null);
    setProgress(0);
    setProcessed(0);
    setTotal(0);

    const jobId = startJob("user", `Importing users — ${file.name}`);
    jobIdRef.current = jobId;

    try {
      if (ext === "xlsx") {
        // XLSX: use HTTP endpoint (no streaming for xlsx, but still runs in "background" visually)
        await runHttpImport(file, jobId);
      } else {
        // CSV: use WebSocket streaming endpoint
        const rows = await parseFile(file);
        if (rows.length === 0) {
          throw new Error("File is empty or could not be parsed.");
        }
        await runWebSocketImport(rows, jobId);
      }
    } catch (err: any) {
      const msg = err.message || "Import failed.";
      setErrorMsg(msg);
      if (jobIdRef.current) {
        updateJob(jobIdRef.current, { status: "error", errorMsg: msg });
      }
    } finally {
      setIsLoading(false);
      setIsProcessing(false);
      wsRef.current = null;
    }
  };

  /** HTTP (non-streaming) path — used for XLSX files */
  const runHttpImport = async (f: File, jobId: string) => {
    updateJob(jobId, { progress: 30, processed: 0, total: 1 });

    const formData = new FormData();
    formData.append("file", f);

    const result = await apiFetch<ImportSummary>("/users/bulk-import", {
      method: "POST",
      body: formData,
    });

    updateJob(jobId, {
      status: "done",
      progress: 100,
      processed: result.created,
      total: result.total_rows,
      summary: {
        imported: result.created,
        skipped: result.skipped,
        total: result.total_rows,
      },
    });

    setSummary(result);
    if (result.created > 0) onImportSuccess();
  };

  /** WebSocket streaming path — used for CSV files */
  const runWebSocketImport = async (
    rows: Record<string, string>[],
    jobId: string
  ) => {
    // 1. Get a one-time WS auth token
    const { token } = await apiFetch<{ token: string }>(
      "/users/ws-auth-token",
      { method: "POST" }
    );

    return new Promise<void>((resolve, reject) => {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const wsUrl = `${proto}://${window.location.host}/api/v1/users/bulk-import-ws?token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify(rows));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "progress") {
            const pct = msg.progress ?? 0;
            setProgress(pct);
            setProcessed(msg.processed ?? 0);
            setTotal(msg.total ?? 0);
            updateJob(jobId, {
              progress: pct,
              processed: msg.processed ?? 0,
              total: msg.total ?? 0,
            });
          } else if (msg.type === "complete") {
            const result: ImportSummary = {
              total_rows: msg.total_rows,
              created: msg.created,
              skipped: msg.skipped,
              errors: msg.errors ?? [],
              accounts: msg.accounts ?? [],
            };
            setSummary(result);
            updateJob(jobId, {
              status: "done",
              progress: 100,
              processed: msg.created,
              total: msg.total_rows,
              summary: {
                imported: msg.created,
                skipped: msg.skipped,
                total: msg.total_rows,
              },
            });
            if (msg.created > 0) onImportSuccess();
            ws.close();
            resolve();
          } else if (msg.type === "error") {
            reject(new Error(msg.message || "Server error during import."));
            ws.close();
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        reject(new Error("WebSocket connection failed."));
      };

      ws.onclose = (e) => {
        if (e.code === 4001) {
          reject(new Error("Authentication failed. Please try again."));
        }
        // Other close codes are handled via onmessage/onerror
      };
    });
  };

  const resetForm = () => {
    setFile(null);
    setSummary(null);
    setErrorMsg(null);
    setShowErrors(false);
    setShowPasswords(false);
    setCopied(false);
    setProgress(0);
    setProcessed(0);
    setTotal(0);
    jobIdRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    if (isLoading || isProcessing) return;
    resetForm();
    onClose();
  };

  /** Minimize: hide modal, keep WS running */
  const handleMinimize = () => {
    if (onMinimize) {
      onMinimize();
    } else {
      onClose();
    }
  };

  useImperativeHandle(ref, () => ({
    handleCancel: handleCancelImport
  }));

  // Restore modal state when opened from progress bar or sync with running job
  React.useEffect(() => {
    if (isOpen && jobId && jobId.startsWith("user-")) {
      const job = jobs.find((j) => j.id === jobId);
      if (job) {
        jobIdRef.current = job.id;
        if (job.status === "running") {
          setIsProcessing(true);
          setProgress(job.progress);
          setProcessed(job.processed);
          setTotal(job.total);
          setErrorMsg(null);
          setSummary(null);
        } else if (job.status === "done") {
          setIsProcessing(false);
          setIsLoading(false);
          setSummary(job.results || null);
          setErrorMsg(null);
        } else if (job.status === "error") {
          setIsProcessing(false);
          setIsLoading(false);
          setErrorMsg(job.errorMsg || "Import failed");
          setSummary(null);
        }
      }
    }
  }, [isOpen, jobId, jobs]);

  const handleCancelImport = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    const msg = "Import cancelled by user.";
    setErrorMsg(msg);
    if (jobIdRef.current) {
      updateJob(jobIdRef.current, { status: "error", errorMsg: msg });
    }
    setIsLoading(false);
    setIsProcessing(false);
  };

  const copyCredentials = () => {
    if (!summary) return;
    const text = summary.accounts
      .map(
        (a) =>
          `${a.full_name} | ${a.email} | ${a.role} | Password: ${a.generated_password}`
      )
      .join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <Modal open={isOpen} onClose={handleClose} title="Bulk User Import" onMinimize={isProcessing ? handleMinimize : undefined}>
      <div className="mt-2 text-ink">
        {isProcessing ? (
          /* ── Progress View ── */
          <div className="flex flex-col items-center justify-center py-6 gap-6 select-none">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="72"
                  cy="72"
                  r={radius}
                  className="text-sky-page"
                  strokeWidth="8"
                  stroke="currentColor"
                  fill="transparent"
                />
                <circle
                  cx="72"
                  cy="72"
                  r={radius}
                  className="text-ursb transition-all duration-300 ease-out"
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-ink">{progress}%</span>
                {total > 0 && (
                  <span className="text-[11px] text-ink-dim font-semibold mt-0.5">
                    {processed} / {total}
                  </span>
                )}
              </div>
            </div>
            <div className="text-center">
              <h4 className="text-base font-bold text-ink mb-1">
                Creating user accounts…
              </h4>
              <p className="text-sm text-ink-dim">
                Generating secure passwords and setting up accounts.
              </p>
            </div>
            <p className="text-xs text-ink-dim text-center">
              You can minimize this dialog — the import continues in the background.
            </p>
          </div>
        ) : !summary ? (
          /* ── File Selection View ── */
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="text-xs sm:text-sm text-ink-dim">
                Upload a CSV or XLSX file with user details.
              </div>
              <Button
                variant="outline"
                onClick={handleDownloadTemplate}
                className="gap-2 text-xs py-1.5 px-3"
              >
                <ICONS.download className="w-3.5 h-3.5" />
                Template
              </Button>
            </div>

            {/* Required columns hint */}
            <div className="bg-sky-page border border-sky-border rounded-xl p-3 text-xs text-ink-dim">
              <p className="font-semibold text-ink mb-1">Required columns</p>
              <p>
                <code className="text-ursb">full_name</code>,{" "}
                <code className="text-ursb">email</code>,{" "}
                <code className="text-ursb">role</code>,{" "}
                <code className="text-ursb">department</code> (optional)
              </p>
              <p className="mt-1">
                Email must be <code className="text-ursb">@ursb.go.ug</code>.
                Passwords are auto-generated.
              </p>
            </div>

            <div
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer
                ${
                  isDragActive
                    ? "border-ursb bg-sky-50"
                    : "border-sky-border hover:bg-sky-50"
                }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragActive(false);
              }}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              />
              <div className="w-10 h-10 rounded-full bg-sky-page flex items-center justify-center text-ursb mb-3">
                <ICONS.upload className="w-5 h-5" />
              </div>
              <p className="text-xs sm:text-sm font-semibold text-ink mb-1">
                Click to browse or drag & drop
              </p>
              <p className="text-[10px] text-ink-dim">CSV or XLSX, max 2 MB</p>
            </div>

            {file && (
              <div className="flex items-center justify-between bg-sky-page p-3 rounded-xl border border-sky-border">
                <div className="flex items-center gap-3 overflow-hidden">
                  <ICONS.document className="w-5 h-5 text-ursb shrink-0" />
                  <div className="flex flex-col truncate">
                    <span className="text-xs sm:text-sm font-semibold text-ink truncate">
                      {file.name}
                    </span>
                    <span className="text-[10px] text-ink-dim">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setFile(null)}
                  className="text-red-500 hover:bg-red-50 shrink-0 text-xs py-1"
                  disabled={isLoading}
                >
                  Remove
                </Button>
              </div>
            )}

            {errorMsg && (
              <div className="bg-red-50 text-red-700 p-3 rounded-xl border border-red-200 text-xs sm:text-sm">
                {errorMsg}
              </div>
            )}
          </div>
        ) : (
          /* ── Summary View ── */
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0
                ${
                  summary.created > 0 && summary.skipped === 0
                    ? "bg-green-100 text-green-600"
                    : "bg-orange-100 text-orange-600"
                }`}
              >
                <ICONS.checkCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-ink">
                  Import Complete
                </h2>
                <p className="text-ink-dim text-xs mt-0.5">
                  {summary.created} of {summary.total_rows} accounts created.{" "}
                  {summary.skipped} rows skipped.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1 bg-green-50 border border-green-100 rounded-xl p-3 flex flex-col items-center">
                <span className="text-2xl font-bold text-green-600">
                  {summary.created}
                </span>
                <span className="text-xs font-medium text-green-700">Created</span>
              </div>
              <div className="flex-1 bg-orange-50 border border-orange-100 rounded-xl p-3 flex flex-col items-center">
                <span className="text-2xl font-bold text-orange-600">
                  {summary.skipped}
                </span>
                <span className="text-xs font-medium text-orange-700">
                  Skipped
                </span>
              </div>
            </div>

            {/* Generated credentials */}
            {summary.accounts.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-ink">
                    Generated Credentials
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      className="text-xs py-1 gap-1"
                      onClick={() => setShowPasswords((v) => !v)}
                    >
                      {showPasswords ? (
                        <ICONS.eyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <ICONS.eye className="w-3.5 h-3.5" />
                      )}
                      {showPasswords ? "Hide" : "Show"}
                    </Button>
                    <Button
                      variant="outline"
                      className="text-xs py-1 gap-1"
                      onClick={copyCredentials}
                    >
                      <ICONS.copy className="w-3.5 h-3.5" />
                      {copied ? "Copied!" : "Copy All"}
                    </Button>
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-sky-border max-h-52 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-sky-page border-b border-sky-border text-[10px] uppercase tracking-wider text-ink-dim sticky top-0">
                        <th className="p-2 font-semibold">Name</th>
                        <th className="p-2 font-semibold">Email</th>
                        <th className="p-2 font-semibold">Role</th>
                        <th className="p-2 font-semibold">Password</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      {summary.accounts.map((acc, i) => (
                        <tr
                          key={i}
                          className="border-b border-sky-border last:border-0 hover:bg-sky-50/50"
                        >
                          <td className="p-2 font-medium text-ink truncate max-w-28">
                            {acc.full_name}
                          </td>
                          <td className="p-2 text-ink-dim truncate max-w-36">
                            {acc.email}
                          </td>
                          <td className="p-2 text-ink-dim">{acc.role}</td>
                          <td className="p-2 font-mono text-ink">
                            {showPasswords ? acc.generated_password : "••••••••••••"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-ink-dim">
                  These passwords are only shown once. Share them securely with each user.
                </p>
              </div>
            )}

            {/* Errors */}
            {summary.errors.length > 0 && (
              <div className="flex flex-col gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowErrors(!showErrors)}
                  className="justify-between w-full border-orange-200 text-orange-700 hover:bg-orange-50 text-xs py-2"
                >
                  <span className="font-semibold">
                    View Error Details ({summary.errors.length})
                  </span>
                  <ICONS.chevronDown
                    className={`w-4 h-4 transition-transform ${
                      showErrors ? "rotate-180" : ""
                    }`}
                  />
                </Button>
                {showErrors && (
                  <div className="overflow-hidden rounded-xl border border-sky-border max-h-40 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-sky-page border-b border-sky-border text-[10px] uppercase tracking-wider text-ink-dim sticky top-0">
                          <th className="p-2 font-semibold">Row</th>
                          <th className="p-2 font-semibold">Email</th>
                          <th className="p-2 font-semibold">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {summary.errors.map((err, i) => (
                          <tr
                            key={i}
                            className="border-b border-sky-border last:border-0 hover:bg-sky-50/50"
                          >
                            <td className="p-2 text-ink-dim">{err.row}</td>
                            <td className="p-2 font-medium text-ink truncate max-w-32">
                              {err.email || "—"}
                            </td>
                            <td className="p-2 text-red-600">{err.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-end gap-3 border-t border-sky-page/10 pt-4 mt-6">
        {isProcessing ? (
          <>
            <Button variant="danger-outline" onClick={handleCancelImport}>
              Cancel Import
            </Button>
          </>
        ) : !summary ? (
          <>
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={!file || isLoading}
            >
              {isLoading ? "Processing…" : "Start Import"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={resetForm}>
              Import Another File
            </Button>
            <Button variant="primary" onClick={handleClose}>
              Done
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
});

BulkUserImportModal.displayName = "BulkUserImportModal";

export default BulkUserImportModal;
