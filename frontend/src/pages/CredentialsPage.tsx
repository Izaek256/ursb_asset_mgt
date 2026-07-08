import React from "react";
import * as XLSX from "xlsx";
import { useAuth } from "../AuthContext";
import { apiFetch } from "../AuthContext";
import { ICONS } from "../utils/icons";
import Button from "../components/common/Button";
import PageHeader from "../components/PageHeader";
import ErrorMessage from "../components/ErrorMessage";
import SuccessBanner from "../components/common/SuccessBanner";
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
  password: string | null;
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

export default function CredentialsPage() {
  const { user } = useAuth();
  const [adminPassword, setAdminPassword] = React.useState("");
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);

  const [accounts, setAccounts] = React.useState<RecentAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = React.useState(false);
  const [accountsError, setAccountsError] = React.useState<string | null>(null);

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
  const [singleRole, setSingleRole] = React.useState("Employee");
  const [singleDepartment, setSingleDepartment] = React.useState("");
  const [isCreatingUser, setIsCreatingUser] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [singleUserResult, setSingleUserResult] = React.useState<{ full_name: string; email: string; role: string; generated_password: string } | null>(null);
  const [showSingleResult, setShowSingleResult] = React.useState(false);

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
    setAccountsError(null);
    try {
      const data = await apiFetch<RecentAccountsResponse>(
        `/credentials/recent-accounts?page=${page}&page_size=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
        { headers: { "X-Admin-Password": adminPassword } }
      );
      setAccounts(data.accounts);
      setTotal(data.total);
    } catch (err: any) {
      setAccountsError(err.message || "Failed to fetch accounts");
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

  const handleDownloadTemplate = () => {
    const csvContent = "full_name,email,role,department\nJohn Doe,john.doe@ursb.go.ug,Employee,ICT";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "user_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = () => {
    if (!file) return;
    setImportError(null);
    setImportProgress(0);
    setImportProcessed(0);
    setImportTotal(0);
    setIsImporting(true);

    // ── Parse file client-side with xlsx ─────────────────────────────────────
    const reader = new FileReader();
    reader.onload = (e) => {
      let rows: Record<string, string>[] = [];
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "binary" });
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

      // ── Open WebSocket ────────────────────────────────────────────────────
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/v1/users/bulk-import-ws`);
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
        // Abnormal close (cancelled by user closes with code 1000 intentionally)
        if (isImporting && event.code !== 1000) {
          setImportError("Import was interrupted.");
          setIsImporting(false);
          wsRef.current = null;
        }
      };
    };

    reader.readAsBinaryString(file);
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
      console.log("DEBUG: User creation response:", data);
      setSingleUserResult({
        full_name: data.full_name,
        email: data.email,
        role: data.role,
        generated_password: data.generated_password,
      });
      setShowSingleResult(true);
      setSingleFullName("");
      setSingleEmail("");
      setSingleRole("Employee");
      setSingleDepartment("");
    } catch (err: any) {
      console.error("DEBUG: User creation error:", err);
      setCreateError(err.message || "Failed to create user");
    } finally {
      setIsCreatingUser(false);
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
      header: "Password",
      render: (a) => (
        <div className="text-ink-dim text-sm">
          {a.password ? (
            <div className="flex items-center gap-2">
              <code className="font-mono text-xs bg-sky-page/50 px-2 py-1 rounded text-ink">{a.password}</code>
              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(a.password!)} className="p-1">
                <ICONS.copy className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1">
              <span>••••••••••••</span>
              <span className="text-[10px]">(not stored)</span>
            </span>
          )}
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
          {/* Large animated ring with big percentage number */}
          <div className="relative flex items-center justify-center mb-6 mt-2">
            <svg className="w-40 h-40 -rotate-90" viewBox="0 0 120 120">
              {/* Track circle */}
              <circle cx="60" cy="60" r="52" fill="none" stroke="#e8eef8" strokeWidth="8" />
              {/* Progress arc */}
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
            {/* Centered percentage text */}
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

          {/* Status line */}
          <p className="text-base font-bold text-ink mb-1 tracking-tight">
            {importProgress < 100 ? "Creating accounts…" : "Finalising import…"}
          </p>
          {importTotal > 0 && (
            <p className="text-xs text-ink-dim mb-5">
              {importProcessed} of {importTotal} accounts processed
            </p>
          )}

          {/* Progress bar */}
          <div className="w-full bg-sky-page/50 rounded-full h-2 mb-6 overflow-hidden border border-sky-cardBorder">
            <div
              className="bg-gradient-to-r from-[#6a94d4] to-[#3b6abf] h-full rounded-full"
              style={{ width: `${importProgress}%`, transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)" }}
            />
          </div>

          {/* Cancel button */}
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
          {/* The generated_password values exist only in React state and are lost on unmount or dismiss */}
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
        subtitle="Create user accounts and review credentials for recently created accounts (last 7 days)"
      />

      {/* Single User Creation Section */}
      <div className="bg-white border border-sky-cardBorder rounded-2xl p-6 shadow-sm">
        <h3 className="font-bold text-base text-ink mb-4">Create Single User</h3>
        <form onSubmit={handleCreateSingleUser} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="single-full-name" className="text-[10px] font-bold uppercase tracking-wider text-ink-dim">
              Full Name
            </label>
            <input
              id="single-full-name"
              type="text"
              className={filterInputCls}
              value={singleFullName}
              onChange={(e) => setSingleFullName(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="single-email" className="text-[10px] font-bold uppercase tracking-wider text-ink-dim">
              Email
            </label>
            <input
              id="single-email"
              type="email"
              className={filterInputCls}
              value={singleEmail}
              onChange={(e) => setSingleEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="single-role" className="text-[10px] font-bold uppercase tracking-wider text-ink-dim">
              Role
            </label>
            <select
              id="single-role"
              className={filterSelectCls}
              value={singleRole}
              onChange={(e) => setSingleRole(e.target.value)}
              required
            >
              <option value="Employee">Employee</option>
              <option value="Asset Custodian">Asset Custodian</option>
              <option value="Asset Manager">Asset Manager</option>
              <option value="System Administrator">System Administrator</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="single-department" className="text-[10px] font-bold uppercase tracking-wider text-ink-dim">
              Department
            </label>
            <input
              id="single-department"
              type="text"
              className={filterInputCls}
              value={singleDepartment}
              onChange={(e) => setSingleDepartment(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 flex justify-between items-center pt-2">
            {createError && <ErrorMessage message={createError} />}
            <Button type="submit" isLoading={isCreatingUser}>
              Create User
            </Button>
          </div>
        </form>
      </div>

      {/* Bulk Import Section */}
      <div className="bg-white border border-sky-cardBorder rounded-2xl p-6 shadow-sm">
        <h3 className="font-bold text-base text-ink mb-4">Bulk Import Users</h3>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <input
              id="import-file"
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="import-file"
              className="flex items-center justify-center font-bold transition-all duration-200 focus:outline-none transform active:scale-95 cursor-pointer select-none whitespace-nowrap rounded-xl py-2 px-4 text-sm bg-[#6a94d4] text-[#f9f8f6] hover:bg-[#f9f8f6] hover:text-[#6a94d4]"
            >
              {file ? file.name : "Choose File"}
            </label>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              Download Template
            </Button>
          </div>
          {importError && <ErrorMessage message={importError} />}
          <Button onClick={handleImport} isLoading={isImporting} disabled={!file}>
            Import
          </Button>
        </div>
      </div>

      {/* Recent Accounts Section */}
      <div className="bg-white border border-sky-cardBorder rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-base text-ink">Recent Accounts (Last 7 Days)</h3>
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
        {accountsError && <ErrorMessage message={accountsError} />}
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
