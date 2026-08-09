import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "../AuthContext";

interface UseApiWithLoadingOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  initialLoading?: boolean;
}

interface UseApiWithLoadingReturn<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  execute: (path: string, options?: RequestInit) => Promise<T | null>;
  reset: () => void;
}

export function useApiWithLoading<T = any>(
  options: UseApiWithLoadingOptions = {}
): UseApiWithLoadingReturn<T> {
  const { onSuccess, onError, initialLoading = false } = options;
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(initialLoading);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (path: string, requestOptions: RequestInit = {}): Promise<T | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await apiFetch<T>(path, requestOptions);
        setData(result);
        onSuccess?.(result);
        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        onError?.(errorObj);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [onSuccess, onError]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    data,
    isLoading,
    error,
    execute,
    reset,
  };
}

interface UseMutationOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

interface UseMutationReturn {
  mutate: (path: string, options?: RequestInit) => Promise<any>;
  isLoading: boolean;
  error: Error | null;
  reset: () => void;
}

export function useMutation(options: UseMutationOptions = {}): UseMutationReturn {
  const { onSuccess, onError } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (path: string, requestOptions: RequestInit = {}): Promise<any> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await apiFetch(path, requestOptions);
        onSuccess?.(result);
        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        onError?.(errorObj);
        throw errorObj;
      } finally {
        setIsLoading(false);
      }
    },
    [onSuccess, onError]
  );

  const reset = useCallback(() => {
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    mutate,
    isLoading,
    error,
    reset,
  };
}

interface UseQueryOptions {
  enabled?: boolean;
  refetchInterval?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export function useQuery<T = any>(
  path: string | null,
  options: UseQueryOptions = {}
): UseApiWithLoadingReturn<T> {
  const { enabled = true, refetchInterval, onSuccess, onError } = options;
  const hook = useApiWithLoading<T>({ onSuccess, onError });

  const fetchData = useCallback(async () => {
    if (enabled && path) {
      await hook.execute(path);
    }
  }, [enabled, path, hook]);

  // Initial fetch
  useEffect(() => {
    if (enabled && path) {
      fetchData();
    }
  }, [enabled, path, fetchData]);

  // Refetch interval
  useEffect(() => {
    if (refetchInterval && enabled && path) {
      const interval = setInterval(fetchData, refetchInterval);
      return () => clearInterval(interval);
    }
  }, [refetchInterval, enabled, path, fetchData]);

  return hook;
}
