import { AssetCreatePayload, AssetResponse } from "../types/asset";

interface ApiFieldError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export class ApiError extends Error {
  status: number;
  fieldErrors: Map<string, string>;

  constructor(status: number, message: string, fieldErrors?: Map<string, string>) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors ?? new Map();
  }
}

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));

    // FastAPI 422 validation errors
    if (response.status === 422 && Array.isArray(data.detail)) {
      const fieldErrors = new Map<string, string>();
      for (const err of data.detail as ApiFieldError[]) {
        // loc is like ["body", "asset_name"]
        const field = err.loc[err.loc.length - 1];
        if (typeof field === "string") {
          fieldErrors.set(field, err.msg);
        }
      }
      throw new ApiError(422, "Validation failed", fieldErrors);
    }

    throw new ApiError(
      response.status,
      data.detail ?? "An unexpected error occurred",
    );
  }

  return response.json();
}

export function createAsset(payload: AssetCreatePayload): Promise<AssetResponse> {
  return apiRequest<AssetResponse>("/api/v1/assets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getAssets(): Promise<AssetResponse[]> {
  return apiRequest<AssetResponse[]>("/api/v1/assets");
}
