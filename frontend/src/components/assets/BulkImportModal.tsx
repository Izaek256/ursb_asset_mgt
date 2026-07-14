import React, { useState, useRef, useCallback } from "react";
import { ICONS } from "../../utils/icons";
import Button from "../common/Button";
import Modal from "../Modal";

const CSV_TEMPLATE = `asset_name,asset_type,category,serial_number,condition,source_type,procurement_ref,cost,acquisition_date,supplier,department
Dell Latitude 7420,ICT Equipment,Laptops,SN-DELL-001,New,Procurement,PR-2026-001,4500000,2026-05-10,Dell Uganda,IT
Executive Office Chair,Furniture,Chairs,SN-FURN-099,Good,Procurement,PR-2026-002,850000,2026-06-15,Furniture City,HR`;

interface ImportSummary {
  total_rows: number;
  imported: number;
  skipped: number;
  errors: Array<{
    row: number;
    serial_number: string | null;
    reason: string;
  }>;
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export default function BulkImportModal({ isOpen, onClose, onImportSuccess }: BulkImportModalProps) {
  const [importMode, setImportMode] = useState<"add" | "update">("add");
  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // Streaming progress states
  const [progress, setProgress] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "asset_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const validateAndSetFile = (selectedFile: File) => {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx') {
      setErrorMsg("Unsupported file type. Please upload a CSV or XLSX file.");
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      setErrorMsg("File too large. Maximum size is 5 MB.");
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

  const handleImport = async () => {
    if (!file) return;

    setIsLoading(true);
    setIsProcessing(true);
    setErrorMsg(null);
    setSummary(null);
    setProgress(0);
    setTotalRows(0);
    setStartTime(Date.now());
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("import_mode", importMode);

    try {
      const response = await fetch("/api/v1/assets/import", {
        method: "POST",
        credentials: "include",
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        let msg = "An error occurred during import.";
        if (response.status === 400 || response.status === 413 || response.status === 500) {
          msg = errorData?.detail || `HTTP ${response.status} error`;
        }
        throw new Error(msg);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Unable to read progress stream.");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);

          if (msg.type === "start") {
            setTotalRows(msg.total_rows);
            setProgress(0);
          } else if (msg.type === "progress") {
            setProgress(msg.current);
            setTotalRows(msg.total);
          } else if (msg.type === "summary") {
            setSummary(msg);
            if (msg.imported > 0) {
              onImportSuccess();
            }
          } else if (msg.type === "error") {
            throw new Error(msg.detail);
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setErrorMsg("Import cancelled by user. All database changes have been rolled back.");
      } else {
        setErrorMsg(err.message || "Failed to connect to the server.");
      }
    } finally {
      setIsLoading(false);
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const resetForm = () => {
    setFile(null);
    setSummary(null);
    setErrorMsg(null);
    setShowErrors(false);
    setProgress(0);
    setTotalRows(0);
    setStartTime(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    if (isLoading || isProcessing) return;
    resetForm();
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  // Circular progress helper values
  const percentage = totalRows > 0 ? Math.round((progress / totalRows) * 100) : 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  let etaText = "Calculating time remaining...";
  if (startTime && progress > 0 && totalRows > 0) {
    const elapsed = Date.now() - startTime;
    const speed = progress / elapsed; // items per ms
    const remainingItems = totalRows - progress;
    const remainingTimeMs = remainingItems / speed;
    const remainingSeconds = Math.round(remainingTimeMs / 1000);
    if (remainingSeconds > 0) {
      etaText = `${remainingSeconds} seconds remaining`;
    } else {
      etaText = "Finishing up...";
    }
  }

  return (
    <Modal open={isOpen} onClose={handleClose} title="Bulk Import & Update Assets">
      <div className="mt-2 text-ink">
        {isProcessing ? (
          /* Circular Progress View */
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
                <span className="text-3xl font-extrabold text-ink">{percentage}%</span>
                <span className="text-[11px] text-ink-dim font-semibold mt-0.5">{progress} / {totalRows}</span>
              </div>
            </div>
            <div className="text-center">
              <h4 className="text-base font-bold text-ink mb-1">
                {importMode === "add" ? "Importing new assets..." : "Updating existing assets..."}
              </h4>
              <p className="text-sm text-ink-dim">
                {etaText}
              </p>
            </div>
          </div>
        ) : !summary ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="text-xs sm:text-sm text-ink-dim">
                Upload a CSV or XLSX file containing assets.
              </div>
              <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2 text-xs py-1.5 px-3">
                <ICONS.download className="w-3.5 h-3.5" />
                Template
              </Button>
            </div>

            {/* Mode Selection */}
            <div className="flex gap-4 border-b border-sky-page/10 pb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="add"
                  checked={importMode === "add"}
                  onChange={() => setImportMode("add")}
                  className="text-ursb focus:ring-ursb"
                  disabled={isLoading}
                />
                <span className="text-xs sm:text-sm font-medium text-ink">Add New Assets</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="update"
                  checked={importMode === "update"}
                  onChange={() => setImportMode("update")}
                  className="text-ursb focus:ring-ursb"
                  disabled={isLoading}
                />
                <span className="text-xs sm:text-sm font-medium text-ink">Update Existing Assets</span>
              </label>
            </div>

            <div
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer
                ${isDragActive ? "border-ursb bg-sky-50" : "border-sky-border hover:bg-sky-50"}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragActive(false); }}
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
              <p className="text-[10px] text-ink-dim">
                CSV or XLSX, max 5 MB
              </p>
            </div>

            {file && (
              <div className="flex items-center justify-between bg-sky-page p-3 rounded-xl border border-sky-border">
                <div className="flex items-center gap-3 overflow-hidden">
                  <ICONS.document className="w-5 h-5 text-ursb shrink-0" />
                  <div className="flex flex-col truncate">
                    <span className="text-xs sm:text-sm font-semibold text-ink truncate">{file.name}</span>
                    <span className="text-[10px] text-ink-dim">{formatFileSize(file.size)}</span>
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
          /* Final Summary View */
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 
                ${summary.imported > 0 && summary.skipped === 0 ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"}`}>
                <ICONS.checkCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-ink">Import Complete</h2>
                <p className="text-ink-dim text-xs mt-0.5">
                  {summary.imported} of {summary.total_rows} rows processed successfully. {summary.skipped} rows skipped.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1 bg-green-50 border border-green-100 rounded-xl p-3 flex flex-col items-center">
                <span className="text-2xl font-bold text-green-600">{summary.imported}</span>
                <span className="text-xs font-medium text-green-700">Successful</span>
              </div>
              <div className="flex-1 bg-orange-50 border border-orange-100 rounded-xl p-3 flex flex-col items-center">
                <span className="text-2xl font-bold text-orange-600">{summary.skipped}</span>
                <span className="text-xs font-medium text-orange-700">Skipped (Errors)</span>
              </div>
            </div>

            {summary.errors.length > 0 && (
              <div className="flex flex-col gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowErrors(!showErrors)}
                  className="justify-between w-full border-orange-200 text-orange-700 hover:bg-orange-50 text-xs py-2"
                >
                  <span className="font-semibold">View Error Details ({summary.errors.length})</span>
                  <ICONS.chevronDown className={`w-4 h-4 transition-transform ${showErrors ? "rotate-180" : ""}`} />
                </Button>
                
                {showErrors && (
                  <div className="overflow-hidden rounded-xl border border-sky-border max-h-48 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-sky-page border-b border-sky-border text-[10px] uppercase tracking-wider text-ink-dim sticky top-0">
                          <th className="p-2 font-semibold">Row</th>
                          <th className="p-2 font-semibold">Serial</th>
                          <th className="p-2 font-semibold">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {summary.errors.map((err, i) => (
                          <tr key={i} className="border-b border-sky-border last:border-0 hover:bg-sky-50/50">
                            <td className="p-2 text-ink-dim">{err.row}</td>
                            <td className="p-2 font-medium text-ink truncate max-w-24">{err.serial_number || "—"}</td>
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

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-sky-page/10 pt-4 mt-6">
        {isProcessing ? (
          <Button variant="danger-outline" onClick={() => abortControllerRef.current?.abort()}>
            Cancel & Rollback
          </Button>
        ) : !summary ? (
          <>
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleImport} disabled={!file || isLoading}>
              {isLoading ? "Processing..." : `Start ${importMode === "add" ? "Import" : "Update"}`}
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
}
