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
  results?: any;
}

interface ImportProgressContextValue {
  jobs: ImportJob[];
  activeJob: ImportJob | null;
  startJob: (type: ImportType, label: string) => string; // returns job id
  updateJob: (id: string, patch: Partial<Omit<ImportJob, "id" | "type" | "results">>) => void;
  dismissJob: (id: string) => void;
  cancelJob: (id: string) => void;
  clearDoneJobs: () => void;

  /**
   * Callback registered by whoever owns the visible import modal.
   * The progress bar calls this when the user clicks "View details".
   */
  openImportModal: ((jobId?: string) => void) | null;
  setOpenImportModal: (fn: ((jobId?: string) => void) | null) => void;

  /**
   * Dedicated callback for the global user-import modal (lives in App.tsx).
   */
  openUserImportModal: ((jobId?: string) => void) | null;
  setOpenUserImportModal: (fn: ((jobId?: string) => void) | null) => void;

  /**
   * Dedicated callback for the credentials page import modal.
   */
  openCredentialsImportModal: ((jobId?: string) => void) | null;
  setOpenCredentialsImportModal: (fn: ((jobId?: string) => void) | null) => void;

  // New modal tracking
  viewingJobId: string | null;
  setViewingJobId: (id: string | null) => void;

  // Registry for multiple listeners
  registerJobCompleteListener: (key: string, fn: (job: ImportJob) => void) => () => void;
  registerCancelJobListener: (key: string, fn: (id: string) => void) => () => void;
}

const ImportProgressContext = createContext<ImportProgressContextValue>(null!);

export function ImportProgressProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [openImportModal, setOpenImportModalState] = useState<((jobId?: string) => void) | null>(null);
  const [openUserImportModal, setOpenUserImportModalState] = useState<((jobId?: string) => void) | null>(null);
  const [openCredentialsImportModal, setOpenCredentialsImportModalState] = useState<((jobId?: string) => void) | null>(null);
  const [viewingJobId, setViewingJobId] = useState<string | null>(null);

  const jobCompleteListeners = React.useRef<Map<string, (job: ImportJob) => void>>(new Map());
  const cancelJobListeners = React.useRef<Map<string, (id: string) => void>>(new Map());

  const registerJobCompleteListener = useCallback((key: string, fn: (job: ImportJob) => void) => {
    jobCompleteListeners.current.set(key, fn);
    return () => {
      jobCompleteListeners.current.delete(key);
    };
  }, []);

  const registerCancelJobListener = useCallback((key: string, fn: (id: string) => void) => {
    cancelJobListeners.current.set(key, fn);
    return () => {
      cancelJobListeners.current.delete(key);
    };
  }, []);

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
    setViewingJobId(id); // Set as currently viewing job
    return id;
  }, []);

  const updateJob = useCallback(
    (id: string, patch: Partial<Omit<ImportJob, "id" | "type" | "results">>) => {
      setJobs((prev) => {
        const updated = prev.map((j) => (j.id === id ? { ...j, ...patch } : j));

        // Check if job just completed
        const job = updated.find((j) => j.id === id);
        if (job && patch.status === "done" && job.status === "done") {
          // Trigger all registered listeners
          jobCompleteListeners.current.forEach((fn) => fn(job));
          // Show toast notification
          if ((window as any).toast) {
            (window as any).toast.success(
              "Import Complete",
              `${job.summary?.imported ?? 0} items imported successfully`
            );
          }
        }

        return updated;
      });
    },
    []
  );

  const dismissJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setViewingJobId((prev) => (prev === id ? null : prev));
  }, []);

  const cancelJob = useCallback((id: string) => {
    setJobs((prev) => {
      const job = prev.find((j) => j.id === id);
      if (job && job.status === "running") {
        cancelJobListeners.current.forEach((fn) => fn(id));
      }
      return prev.map((j) => j.id === id ? { ...j, status: "error", errorMsg: "Cancelled by user" } : j);
    });
  }, []);

  const clearDoneJobs = useCallback(() => {
    setJobs((prev) => prev.filter((j) => j.status === "running"));
  }, []);

  // Prefer the running job; fall back to most recent done/error one
  const activeJob: ImportJob | null =
    jobs.find((j) => j.status === "running") ??
    jobs.find((j) => j.status === "done" || j.status === "error") ??
    null;

  const setOpenImportModal = useCallback((fn: ((jobId?: string) => void) | null) => {
    setOpenImportModalState(() => fn);
  }, []);

  const setOpenUserImportModal = useCallback((fn: ((jobId?: string) => void) | null) => {
    setOpenUserImportModalState(() => fn);
  }, []);

  const setOpenCredentialsImportModal = useCallback((fn: ((jobId?: string) => void) | null) => {
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
        cancelJob,
        clearDoneJobs,
        openImportModal,
        setOpenImportModal,
        openUserImportModal,
        setOpenUserImportModal,
        openCredentialsImportModal,
        setOpenCredentialsImportModal,
        viewingJobId,
        setViewingJobId,
        registerJobCompleteListener,
        registerCancelJobListener,
      }}
    >
      {children}
    </ImportProgressContext.Provider>
  );
}

export function useImportProgress() {
  return useContext(ImportProgressContext);
}
