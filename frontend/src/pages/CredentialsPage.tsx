import React from "react";
import * as XLSX from "xlsx";
import pdfIcon  from "../assets/icons8-export-pdf-50.png";
import xlsxIcon from "../assets/icons8-export-excel-50.png";
import { useAuth } from "../AuthContext";
import { apiFetch } from "../AuthContext";
import { ICONS } from "../utils/icons";
import Button from "../components/common/Button";
import KebabMenu from "../components/common/KebabMenu";
import DropdownButton from "../components/common/DropdownButton";
import PageHeader from "../components/PageHeader";
import ErrorMessage from "../components/ErrorMessage";
import { filterInputCls, filterSelectCls } from "../components/common/FilterBar";
import Table, { Column } from "../components/common/Table";
import Modal from "../components/Modal";

interface RecentAccount {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  department: string | null;
  created_at: string;
  password_revoked: boolean;
}

interface RecentAccountsResponse {
  total: number;
  page: number;
  page_size: number;
  accounts: RecentAccount[];
}

interface BulkImportAccount {
  full_name: string;
  email: string;
  role: string;
  generated_password: string;
}

interface BulkImportResponse {
  total_rows: number;
  created: number;
  skipped: number;
  errors: Array<{ row: number; email: string | null; reason: string }>;
  accounts: BulkImportAccount[];
}

interface RegenResult {
  user_id: string;
  full_name: string;
  email: string;
  generated_password: string;
  expires_at: string;
}

export default function CredentialsPage() {
  const { } = useAuth();
  const [adminPassword, setAdminPassword] = React.useState("");
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);

  const [accounts, setAccounts] = React.useState<RecentAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = React.useState(false);

  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [pageSize] = React.useState(20);

  // Bulk import state
  const [file, setFile] = React.useState<File | null>(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState(0);
  const [importProcessed, setImportProcessed] = React.useState(0);
  const [importTotal, setImportTotal] = React.useState(0);
  const [importError, setImportError] = React.useState<string | null>(null);
  const [importResults, setImportResults] = React.useState<BulkImportResponse | null>(null);
  const [showResults, setShowResults] = React.useState(false);
  const [showErrorsModal, setShowErrorsModal] = React.useState(false);
  const wsRef = React.useRef<WebSocket | null>(null);

  // Single user creation state
  const [singleFullName, setSingleFullName] = React.useState("");
  const [singleEmail, setSingleEmail] = React.useState("");
  const [singleRole, setSingleRole] = React.useState("EMPLOYEE");
  const [singleDepartment, setSingleDepartment] = React.useState("");
  const [isCreatingUser, setIsCreatingUser] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [singleUserResult, setSingleUserResult] = React.useState<{ full_name: string; email: string; role: string; generated_password: string } | null>(null);
  const [showSingleResult, setShowSingleResult] = React.useState(false);

  // Kebab menu & regenerate password state
  // (open/close state is now owned by <KebabMenu> — no kebabOpenId needed here)
  const [isRegenerating, setIsRegenerating] = React.useState(false);
  const [regenResult, setRegenResult] = React.useState<RegenResult | null>(null);
  const [showRegenModal, setShowRegenModal] = React.useState(false);

  const handleAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthenticating(true);
    try {
      const data = await apiFetch<RecentAccountsResponse>("/credentials/recent-accounts", {
        headers: { "X-Admin-Password": adminPassword },
      });
      setAccounts(data.accounts);
      setTotal(data.total);
      setIsAuthenticated(true);
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const fetchAccounts = React.useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingAccounts(true);
    try {
      const data = await apiFetch<RecentAccountsResponse>(
        `/credentials/recent-accounts?page=${page}&page_size=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
        { headers: { "X-Admin-Password": adminPassword } }
      );
      setAccounts(data.accounts);
      setTotal(data.total);
    } catch (err: any) {
      (window as any).toast?.error("Failed to fetch accounts", err.message || "Could not load account list.");
    } finally {
      setIsLoadingAccounts(false);
    }
  }, [isAuthenticated, page, pageSize, search, adminPassword]);

  React.useEffect(() => {
    if (isAuthenticated) {
      fetchAccounts();
    }
  }, [fetchAccounts, isAuthenticated]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleExportAccounts = (format: "pdf" | "xlsx") => {
    if (accounts.length === 0) {
      (window as any).toast?.warning("Nothing to export", "No accounts to export.");
      return;
    }

    if (format === "xlsx") {
      const exportData = accounts.map(a => ({
        "Full Name": a.full_name,
        "Email": a.email,
        "Role": a.role,
        "Department": a.department || "N/A",
        "Created At": new Date(a.created_at).toLocaleString(),
        "Password Status": a.password_revoked ? "Changed by user" : "One-time reveal"
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Credentials");
      XLSX.writeFile(wb, "URSB_Recent_Credentials.xlsx");
    } else if (format === "pdf") {
      import("jspdf").then(({ jsPDF }) => {
        import("jspdf-autotable").then(({ default: autoTable }) => {
          const doc = new jsPDF();
          doc.setFontSize(14);
          doc.text("URSB Recent Account Credentials", 14, 15);
          doc.setFontSize(10);
          doc.text(`Generated on ${new Date().toLocaleString()}`, 14, 22);

          autoTable(doc, {
            startY: 28,
            head: [["Full Name", "Email", "Role", "Password Status"]],
            body: accounts.map(a => [
              a.full_name,
              a.email,
              a.role,
              a.password_revoked ? "Changed by user" : "One-time reveal"
            ]),
            theme: 'grid',
            headStyles: { fillColor: [59, 106, 191] },
          });
          doc.save("URSB_Recent_Credentials.pdf");
        });
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImportError(null);
    setImportProgress(0);
    setImportProcessed(0);
    setImportTotal(0);
    setIsImporting(true);

    // Parse the file synchronously using a Promise wrapper so we can await it
    let rows: Record<string, string>[] = [];
    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
    } catch {
      setImportError("Failed to parse file. Ensure it is a valid CSV or XLSX.");
      setIsImporting(false);
      return;
    }

    if (rows.length === 0) {
      setImportError("The file contains no data rows.");
      setIsImporting(false);
      return;
    }

    // Obtain a short-lived one-time token before opening the WebSocket.
    // Browsers don't reliably send cookies on cross-origin WS upgrades,
    // so we exchange the session cookie for a query-param token here via
    // a normal credentialed HTTP request.
    let wsToken: string;
    try {
      const tokenData = await apiFetch<{ token: string }>("/users/ws-auth-token", {
        method: "POST",
      });
      wsToken = tokenData.token;
    } catch {
      setImportError("Failed to authenticate for import. Please try again.");
      setIsImporting(false);
      return;
    }

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const backendPort = import.meta.env.VITE_BACKEND_PORT || "8001";
    const wsHost = `${window.location.hostname}:${backendPort}`;
    const ws = new WebSocket(`${wsProtocol}//${wsHost}/api/v1/users/bulk-import-ws?token=${encodeURIComponent(wsToken)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify(rows));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "progress") {
        setImportProgress(msg.progress);
        setImportProcessed(msg.processed);
        setImportTotal(msg.total);
      } else if (msg.type === "complete") {
        setImportProgress(100);
        setIsImporting(false);
        wsRef.current = null;

        const result: BulkImportResponse = msg;
        setImportResults(result);
        setShowResults(result.accounts && result.accounts.length > 0);
        setFile(null);
        const fileInput = document.getElementById("import-file") as HTMLInputElement;
        if (fileInput) fileInput.value = "";

        if (result.errors && result.errors.length > 0) {
          setShowErrorsModal(true);
        }
      } else if (msg.type === "error") {
        setImportError(msg.message || "Import failed on server.");
        setIsImporting(false);
        wsRef.current = null;
      }
    };

    ws.onerror = () => {
      setImportError("Connection error. Please try again.");
      setIsImporting(false);
      wsRef.current = null;
    };

    ws.onclose = (event) => {
      if (isImporting && event.code !== 1000) {
        setImportError("Import was interrupted.");
        setIsImporting(false);
        wsRef.current = null;
      }
    };
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        full_name: "John Doe",
        email: "johndoe@ursb.go.ug",
        role: "EMPLOYEE",
        department: "Finance",
      },
      {
        full_name: "Jane Smith",
        email: "janesmith@ursb.go.ug",
        role: "ASSET_MANAGER",
        department: "IT",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    // Set column widths
    ws["!cols"] = [{ wch: 25 }, { wch: 30 }, { wch: 28 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    XLSX.writeFile(wb, "user_import_template.xlsx");
  };

  const handleCancelImport = () => {
    if (wsRef.current) {
      wsRef.current.close(1000, "User cancelled");
      wsRef.current = null;
    }
    setIsImporting(false);
    setImportProgress(0);
    setImportProcessed(0);
    setImportTotal(0);
    setImportError("Import cancelled. All changes have been rolled back.");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleCreateSingleUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!singleFullName || !singleEmail || !singleRole) {
      setCreateError("Please fill in all required fields.");
      return;
    }
    setIsCreatingUser(true);
    try {
      const data = await apiFetch<{ full_name: string; email: string; role: string; generated_password: string } & Record<string, any>>("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          full_name: singleFullName,
          email: singleEmail,
          role: singleRole,
          department: singleDepartment,
        }),
      });
      setSingleUserResult({
        full_name: data.full_name,
        email: data.email,
        role: data.role,
        generated_password: data.generated_password,
      });
      setShowSingleResult(true);
      setSingleFullName("");
      setSingleEmail("");
      setSingleRole("EMPLOYEE");
      setSingleDepartment("");
      // Refresh the accounts list to show the new user
      fetchAccounts();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create user");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleRegeneratePassword = async (account: RecentAccount) => {
    setIsRegenerating(true);
    try {
      const data = await apiFetch<{ generated_password: string; expires_at: string }>(
        `/credentials/${account.user_id}/regenerate-password`,
        {
          method: "POST",
          headers: { "X-Admin-Password": adminPassword },
        }
      );
      setRegenResult({
        user_id: account.user_id,
        full_name: account.full_name,
        email: account.email,
        generated_password: data.generated_password,
        expires_at: data.expires_at,
      });
      setShowRegenModal(true);
      fetchAccounts();
    } catch (err: any) {
      (window as any).toast?.error("Regenerate Failed", err.message || "Failed to regenerate password");
    } finally {
      setIsRegenerating(false);
    }
  };

  const columns: Column<RecentAccount>[] = [
    {
      header: "Full Name",
      render: (a) => a.full_name,
    },
    {
      header: "Email",
      render: (a) => a.email,
    },
    {
      header: "Role",
      render: (a) => a.role,
    },
    {
      header: "Department",
      render: (a) => a.department || "—",
    },
    {
      header: "Created At",
      render: (a) => new Date(a.created_at).toLocaleString(),
    },
    {
      header: "Password Status",
      render: (a) => (
        <div className="text-ink-dim text-sm">
          {a.password_revoked ? (
            /* Password has been changed by user */
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-100 whitespace-nowrap"
                title="User has changed their password"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
                Changed by User
              </span>
            </div>
          ) : (
            /* Active generated/temp password — but not stored, only shown once at creation */
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-600 border border-sky-100 whitespace-nowrap"
                title="Password was shown once at creation. Use regenerate if needed."
              >
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />
                One-time Reveal
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: "",
      render: (a) => (
        <div className="flex justify-end">
          <KebabMenu
            id={`kebab-${a.user_id}`}
            align="right"
            items={[
              {
                label: "Regenerate Password",
                icon: ICONS.regenerate,
                disabled: isRegenerating,
                onClick: () => {
                  handleRegeneratePassword(a);
                },
              },
            ]}
          />
        </div>
      ),
    },
  ];

  if (!isAuthenticated) {
    return (
      <div className="w-full flex flex-col gap-6 select-none font-sans">
        <PageHeader
          title="Credentials"
          subtitle="Review recently created user accounts"
        />
        <div className="bg-white border border-sky-cardBorder rounded-2xl p-8 sm:p-10 shadow-sm max-w-md mx-auto w-full">
          <h2 className="font-bold text-lg text-ink mb-2">Re-authenticate Required</h2>
          <p className="text-sm text-ink-dim mb-6">Enter your password to view recent account credentials.</p>
          <form onSubmit={handleAuthenticate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="admin-password" className="text-[10px] font-bold uppercase tracking-wider text-ink-dim">
                Your Password
              </label>
              <input
                id="admin-password"
                type="password"
                className={filterInputCls}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
                autoFocus
              />
            </div>
            {authError && <ErrorMessage message={authError} />}
            <Button type="submit" isLoading={isAuthenticating}>
              Verify & Continue
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="w-full flex flex-col gap-6 select-none font-sans">
      {/* Import Progress Modal */}
      <Modal open={isImporting} onClose={() => {}} title="">
        <div className="flex flex-col items-center px-4 pb-6 pt-2 select-none font-sans min-w-[320px]">
          <div className="relative flex items-center justify-center mb-6 mt-2">
            <svg className="w-40 h-40 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#e8eef8" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="52"
                fill="none"
                stroke="url(#progressGrad)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 52}`}
                strokeDashoffset={`${2 * Math.PI * 52 * (1 - importProgress / 100)}`}
                style={{ transition: "stroke-dashoffset 0.4s cubic-bezier(0.4,0,0.2,1)" }}
              />
              <defs>
                <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6a94d4" />
                  <stop offset="100%" stopColor="#3b6abf" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span
                className="font-black text-5xl leading-none text-[#3b6abf] tabular-nums"
                style={{ transition: "all 0.3s ease" }}
              >
                {importProgress}
              </span>
              <span className="text-base font-bold text-[#6a94d4] -mt-1">%</span>
            </div>
          </div>

          <p className="text-base font-bold text-ink mb-1 tracking-tight">
            {importProgress < 100 ? "Creating accounts…" : "Finalising import…"}
          </p>
          {importTotal > 0 && (
            <p className="text-xs text-ink-dim mb-5">
              {importProcessed} of {importTotal} accounts processed
            </p>
          )}

          <div className="w-full bg-sky-page/50 rounded-full h-2 mb-6 overflow-hidden border border-sky-cardBorder">
            <div
              className="bg-gradient-to-r from-[#6a94d4] to-[#3b6abf] h-full rounded-full"
              style={{ width: `${importProgress}%`, transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)" }}
            />
          </div>

          <Button
            variant="danger-outline"
            onClick={handleCancelImport}
            className="w-full justify-center"
          >
            Cancel Import
          </Button>
          <p className="text-[10px] text-ink-dim mt-3 text-center leading-relaxed">
            Cancelling will roll back all changes made so far.
          </p>
        </div>
      </Modal>

      {/* Import Errors Modal */}
      <Modal 
        open={showErrorsModal} 
        onClose={() => setShowErrorsModal(false)} 
        title="Import Errors / Duplicates Found"
      >
        <div className="flex flex-col gap-4 font-sans select-none p-2">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start">
            <ICONS.alert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-800 text-sm">Duplicate or Invalid Records Skipped</h4>
              <p className="text-amber-700 text-xs mt-1 leading-relaxed">
                The system successfully skipped the duplicate accounts listed below. All other new, valid accounts were successfully imported.
              </p>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto border border-sky-cardBorder rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-sky-page/50 border-b border-sky-cardBorder">
                <tr>
                  <th className="py-2.5 px-3 font-bold text-ink">Row</th>
                  <th className="py-2.5 px-3 font-bold text-ink">Email</th>
                  <th className="py-2.5 px-3 font-bold text-ink">Reason / Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-page/30 bg-white">
                {importResults?.errors.map((err, idx) => (
                  <tr key={idx} className="hover:bg-sky-page/20 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-ink-dim">Row {err.row}</td>
                    <td className="py-2.5 px-3 font-medium text-ink font-mono">{err.email || "—"}</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-100">
                        {err.reason === "Email already exists" ? "Duplicate Account" : err.reason}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="primary" onClick={() => setShowErrorsModal(false)}>
              Understood
            </Button>
          </div>
        </div>
      </Modal>

      {/* Regenerate Password Result Modal */}
      <Modal
        open={showRegenModal}
        onClose={() => { setShowRegenModal(false); setRegenResult(null); }}
        title="Password Regenerated"
      >
        {regenResult && (
          <div className="flex flex-col gap-6 font-sans select-none px-2 pb-2 min-w-[420px]">
            {/* Warning banner */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl p-5 flex gap-4 items-start shadow-sm">
              <div className="bg-white p-2 rounded-full shadow-sm border border-amber-100 shrink-0">
                <ICONS.alert className="w-5 h-5 text-amber-500" />
              </div>
              <div className="pt-0.5">
                <h4 className="font-bold text-amber-900 text-sm tracking-tight">Share securely</h4>
                <p className="text-amber-700/90 text-[13px] mt-1 leading-relaxed pr-2">
                  This password will not be shown again. Copy it now and share it securely. Expires in <strong>7 days</strong>.
                </p>
              </div>
            </div>

            {/* User details */}
            <div className="bg-white rounded-2xl border border-sky-cardBorder p-6 flex flex-col gap-5 shadow-sm">
              <div className="grid grid-cols-2 gap-4 text-sm pb-5 border-b border-sky-page/50">
                <div>
                  <div className="text-[10px] text-ink-dim font-bold uppercase tracking-widest mb-1">User</div>
                  <div className="font-bold text-ink">{regenResult.full_name}</div>
                </div>
                <div>
                  <div className="text-[10px] text-ink-dim font-bold uppercase tracking-widest mb-1">Email</div>
                  <div className="font-medium text-ink">{regenResult.email}</div>
                </div>
              </div>

              <div>
                <div className="text-[10px] text-ink-dim font-bold uppercase tracking-widest mb-2 flex items-center justify-between">
                  <span>Temporary Password</span>
                  <span className="text-[9px] text-ink-dim/60 normal-case font-medium bg-sky-page/50 px-2 py-0.5 rounded-full">
                    Active until {new Date(regenResult.expires_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 group">
                  <code className="font-mono text-base bg-[#f9f8f6] border-2 border-transparent group-hover:border-sky-cardBorder transition-colors px-4 py-3 rounded-xl text-ink font-semibold flex-1 select-all tracking-wide text-center">
                    {regenResult.generated_password}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(regenResult.generated_password)}
                    className="p-3 shrink-0 h-auto rounded-xl hover:bg-[#6a94d4] hover:text-white hover:border-[#6a94d4] transition-all"
                    title="Copy password"
                  >
                    <ICONS.copy className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="primary" onClick={() => { setShowRegenModal(false); setRegenResult(null); }} className="px-8 rounded-xl shadow-md">
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {showResults && importResults && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="font-bold text-amber-800 text-sm">Import Results</div>
              <div className="text-amber-600 text-xs mt-1">These passwords will not be shown again. Copy them now.</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowResults(false)}>
              Dismiss
            </Button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-amber-200">
                  <th className="text-left py-2 px-2 font-bold text-amber-800">Name</th>
                  <th className="text-left py-2 px-2 font-bold text-amber-800">Email</th>
                  <th className="text-left py-2 px-2 font-bold text-amber-800">Role</th>
                  <th className="text-left py-2 px-2 font-bold text-amber-800">Password</th>
                  <th className="text-left py-2 px-2 font-bold text-amber-800">Action</th>
                </tr>
              </thead>
              <tbody>
                {importResults.accounts.map((acc, idx) => (
                  <tr key={idx} className="border-b border-amber-100 last:border-b-0">
                    <td className="py-2 px-2">{acc.full_name}</td>
                    <td className="py-2 px-2">{acc.email}</td>
                    <td className="py-2 px-2">{acc.role}</td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-xs bg-amber-50 px-2 py-1 rounded">{acc.generated_password}</code>
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(acc.generated_password)} className="p-1">
                        <ICONS.copy className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showSingleResult && singleUserResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="font-bold text-green-800 text-sm">User Created Successfully</div>
              <div className="text-green-600 text-xs mt-1">This password will not be shown again. Copy it now.</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowSingleResult(false)}>
              Dismiss
            </Button>
          </div>
          <div className="bg-white rounded-lg p-4 border border-green-100">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-ink-dim font-bold uppercase">Name</div>
                <div className="font-medium">{singleUserResult.full_name}</div>
              </div>
              <div>
                <div className="text-xs text-ink-dim font-bold uppercase">Email</div>
                <div className="font-medium">{singleUserResult.email}</div>
              </div>
              <div>
                <div className="text-xs text-ink-dim font-bold uppercase">Role</div>
                <div className="font-medium">{singleUserResult.role}</div>
              </div>
              <div>
                <div className="text-xs text-ink-dim font-bold uppercase">Password</div>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-xs bg-sky-page/50 px-2 py-1 rounded">{singleUserResult.generated_password}</code>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(singleUserResult.generated_password)} className="p-1">
                    <ICONS.copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        title="Credentials"
        subtitle="Create user accounts and regenerate passwords. Passwords are shown once at creation and never stored."
      />

      {/* Top Section: Create User & Bulk Import Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Single User Creation Section */}
        <div className="bg-white border border-sky-cardBorder rounded-2xl p-6 md:p-8 shadow-sm flex flex-col h-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-sky-page/50 flex items-center justify-center text-[#3b6abf]">
              <ICONS.user className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-ink tracking-tight">Create User</h3>
              <p className="text-xs text-ink-dim mt-0.5">Add a new team member</p>
            </div>
          </div>

          <form onSubmit={handleCreateSingleUser} className="flex flex-col gap-5 flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="single-full-name" className="text-[10px] font-bold uppercase tracking-wider text-ink-dim">Full Name</label>
                <input id="single-full-name" type="text" className={filterInputCls} value={singleFullName} onChange={(e) => setSingleFullName(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="single-email" className="text-[10px] font-bold uppercase tracking-wider text-ink-dim">Email</label>
                <input id="single-email" type="email" className={filterInputCls} value={singleEmail} onChange={(e) => setSingleEmail(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="single-role" className="text-[10px] font-bold uppercase tracking-wider text-ink-dim">Role</label>
                <select id="single-role" className={filterSelectCls} value={singleRole} onChange={(e) => setSingleRole(e.target.value)} required>
                  <option value="EMPLOYEE">Employee</option>
                  <option value="ASSET_CUSTODIAN">Asset Custodian</option>
                  <option value="ASSET_MANAGER">Asset Manager</option>
                  <option value="SYSTEM_ADMINISTRATOR">System Administrator</option>
                  <option value="SUPER_SYSTEM_ADMINISTRATOR">Super System Administrator</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="single-department" className="text-[10px] font-bold uppercase tracking-wider text-ink-dim">Department</label>
                <input id="single-department" type="text" className={filterInputCls} value={singleDepartment} onChange={(e) => setSingleDepartment(e.target.value)} />
              </div>
            </div>
            
            <div className="mt-auto pt-5 flex justify-between items-center border-t border-sky-page/50">
              <div className="flex-1 mr-4">
                {createError && <ErrorMessage message={createError} />}
              </div>
              <Button type="submit" isLoading={isCreatingUser} className="px-6">
                Create User
              </Button>
            </div>
          </form>
        </div>

        {/* Bulk Import Section */}
        <div className="bg-white border border-sky-cardBorder rounded-2xl p-6 md:p-8 shadow-sm flex flex-col h-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-sky-page/50 flex items-center justify-center text-[#6a94d4]">
              <ICONS.upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-ink tracking-tight">Bulk Import</h3>
              <p className="text-xs text-ink-dim mt-0.5">Upload users via CSV/Excel</p>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-sky-cardBorder hover:border-[#6a94d4]/50 hover:bg-sky-page/20 transition-all rounded-xl p-6 text-center group mb-5">
              <div className="w-12 h-12 rounded-full bg-sky-page/60 text-ink-dim group-hover:text-[#6a94d4] flex items-center justify-center mb-3 transition-colors">
                <ICONS.file className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-ink mb-1">
                {file ? file.name : "Select a file to upload"}
              </p>
              <p className="text-xs text-ink-dim mb-5 max-w-[200px]">
                {file ? "Ready for import" : "Supports .csv and .xlsx formats up to 5MB"}
              </p>
              <div className="flex items-center gap-3">
                <input id="import-file" type="file" accept=".csv,.xlsx" onChange={handleFileChange} className="hidden" />
                <label
                  htmlFor="import-file"
                  className="font-bold transition-all focus:outline-none cursor-pointer rounded-lg py-2 px-5 text-sm bg-sky-page/50 text-ink hover:bg-sky-cardBorder"
                >
                  {file ? "Change File" : "Browse Files"}
                </label>
              </div>
            </div>

            {/* Required columns hint + template download */}
            <div className="mb-4 bg-sky-page/40 border border-sky-cardBorder rounded-xl px-4 py-3 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-dim mb-1.5">Required columns</p>
                <div className="flex flex-wrap gap-1.5">
                  {["full_name", "email", "role", "department"].map((col) => (
                    <code key={col} className="text-[11px] bg-white border border-sky-cardBorder px-2 py-0.5 rounded-md font-mono text-ink">
                      {col}
                    </code>
                  ))}
                </div>
                <p className="text-[10px] text-ink-dim mt-2">
                  Valid roles: <span className="font-mono">EMPLOYEE, ASSET_CUSTODIAN, ASSET_MANAGER, SYSTEM_ADMINISTRATOR</span>
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownloadTemplate}
                className="shrink-0 text-[#6a94d4] text-xs gap-1.5 whitespace-nowrap"
                title="Download sample template"
              >
                <ICONS.download className="w-3.5 h-3.5" />
                Template
              </Button>
            </div>

            <div className="flex items-center justify-between pt-5 border-t border-sky-page/50 relative">
              <DropdownButton
                label="Export Credentials"
                icon={ICONS.download}
                variant="ghost"
                direction="up"
                align="left"
                className="text-[#6a94d4]"
                items={[
                  {
                    label: "Export as PDF",
                    description: "Formatted report, print-ready",
                    imgSrc: pdfIcon,
                    onClick: () => handleExportAccounts("pdf"),
                  },
                  {
                    label: "Export as Excel",
                    description: "Editable spreadsheet (.xlsx)",
                    imgSrc: xlsxIcon,
                    onClick: () => handleExportAccounts("xlsx"),
                  },
                ]}
              />
              <div className="flex items-center gap-3">
                {importError && <div className="text-xs text-rose-500 font-medium">{importError}</div>}
                <Button onClick={handleImport} isLoading={isImporting} disabled={!file} className="px-8">
                  Import
                </Button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Recent Accounts Section */}
      <div className="bg-white border border-sky-cardBorder rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div className="flex flex-col gap-0.5">
            <h3 className="font-bold text-base text-ink">Recent Accounts (Last 7 Days)</h3>
            <p className="text-xs text-ink-dim">
              Passwords marked{" "}
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
                <span className="text-rose-500 font-medium">Changed</span>
              </span>{" "}
              have been updated by the user and the generated password is no longer active. Use the ⋮ menu to regenerate.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              className={filterInputCls}
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
        </div>
        {isLoadingAccounts ? (
          <div className="text-center py-8 text-ink-dim">Loading...</div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8 text-ink-dim">No recent accounts found.</div>
        ) : (
          <>
            <Table data={accounts} columns={columns} rowKey={(a) => a.user_id} emptyMessage="No accounts found." />
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-sky-page/30">
              <div className="text-sm text-ink-dim">
                Page {page} of {totalPages || 1} ({total} total)
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
