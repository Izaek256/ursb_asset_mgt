import React, { createContext, useContext, useState, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export type ImportType = "asset" | "user" | "credentials";
export type ImportStatus = "idle" | "running" | "done" | "error";

export interface ImportJob {
  id: string;
  type: ImportType;
  label: string;
  status: ImportStatus;
  progress: number;   // 0–100
  processed: number;
  total: number;
  errorMsg?: string;
  summary?: {
    imported: number;
    skipped: number;
    total: number;
  };
}

interface ImportProgressContextValue {
  jobs: ImportJob[];
  activeJob: ImportJob | null;
  startJob: (type: ImportType, label: string) => string; // returns job id
  updateJob: (id: string, patch: Partial<Omit<ImportJob, "id" | "type">>) => void;
  dismissJob: (id: string) => void;
  clearDoneJobs: () => void;

  /**
   * Callback registered by whoever owns the visible import modal.
   * The progress bar calls this when the user clicks "View details".
   */
  openImportModal: (() => void) | null;
  setOpenImportModal: (fn: (() => void) | null) => void;

  /**
   * Dedicated callback for the global user-import modal (lives in App.tsx).
   * Set once on mount; never cleared.
   */
  openUserImportModal: (() => void) | null;
  setOpenUserImportModal: (fn: (() => void) | null) => void;

  /**
   * Dedicated callback for the credentials page import modal.
   * Set when credentials page mounts, cleared when unmounts.
   */
  openCredentialsImportModal: (() => void) | null;
  setOpenCredentialsImportModal: (fn: (() => void) | null) => void;
}

const ImportProgressContext = createContext<ImportProgressContextValue>(null!);

export function ImportProgressProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [openImportModal, setOpenImportModalState] = useState<(() => void) | null>(null);
  const [openUserImportModal, setOpenUserImportModalState] = useState<(() => void) | null>(null);
  const [openCredentialsImportModal, setOpenCredentialsImportModalState] = useState<(() => void) | null>(null);

  const startJob = useCallback((type: ImportType, label: string): string => {
    const id = `${type}-${Date.now()}`;
    const job: ImportJob = {
      id,
      type,
      label,
      status: "running",
      progress: 0,
      processed: 0,
      total: 0,
    };
    setJobs((prev) => {
      // Allow multiple jobs to run simultaneously - just add the new job
      // Clean up very old done/error jobs to prevent accumulation
      const filtered = prev.filter((j) => j.status === "running" || (j.status === "done" && j.id.length > 0));
      return [...filtered, job];
    });
    return id;
  }, []);

  const updateJob = useCallback(
    (id: string, patch: Partial<Omit<ImportJob, "id" | "type">>) => {
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
    },
    []
  );

  const dismissJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const clearDoneJobs = useCallback(() => {
    setJobs((prev) => prev.filter((j) => j.status === "running"));
  }, []);

  // Prefer the running job; fall back to most recent done/error one
  const activeJob: ImportJob | null =
    jobs.find((j) => j.status === "running") ??
    jobs.find((j) => j.status === "done" || j.status === "error") ??
    null;

  const setOpenImportModal = useCallback((fn: (() => void) | null) => {
    setOpenImportModalState(() => fn);
  }, []);

  const setOpenUserImportModal = useCallback((fn: (() => void) | null) => {
    setOpenUserImportModalState(() => fn);
  }, []);

  const setOpenCredentialsImportModal = useCallback((fn: (() => void) | null) => {
    setOpenCredentialsImportModalState(() => fn);
  }, []);

  return (
    <ImportProgressContext.Provider
      value={{
        jobs,
        activeJob,
        startJob,
        updateJob,
        dismissJob,
        clearDoneJobs,
        openImportModal,
        setOpenImportModal,
        openUserImportModal,
        setOpenUserImportModal,
        openCredentialsImportModal,
        setOpenCredentialsImportModal,
      }}
    >
      {children}
    </ImportProgressContext.Provider>
  );
}

export function useImportProgress() {
  return useContext(ImportProgressContext);
}
